// handler.js — the single Mandai Wild Discovery Lambda.
// Handles mode: "identify" (multimodal photo) and mode: "chat" (text follow-up),
// both through Bedrock Runtime InvokeModel. Always returns predictable JSON.

import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from '@aws-sdk/client-bedrock-runtime';
import {
  buildIdentifySystemPrompt,
  buildIdentifyUserContent,
  buildDeepLinkUserContent,
  buildChatSystemPrompt,
} from './prompts.js';

const REGION = process.env.AWS_REGION || 'us-east-1';
const MODEL_ID =
  process.env.BEDROCK_MODEL_ID || 'anthropic.claude-3-sonnet-20240229-v1:0';

const client = new BedrockRuntimeClient({ region: REGION });

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
};

// Graceful error object (Requirement 1.6 / 8.3).
const SAFE_DEFAULTS = Object.freeze({
  species: '',
  confident: false,
  facts: ['', '', ''],
  clarify_prompt: 'Sorry, something went wrong. Please try again.',
});

const MAX_SPECIES_LEN = 100;
const MAX_FACT_LEN = 250;
const MAX_CLARIFY_LEN = 200;

/**
 * Lambda entry point.
 */
export async function handler(event) {
  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return json(200, SAFE_DEFAULTS);
  }

  try {
    if (body.mode === 'chat') {
      return await handleChat(body);
    }
    if (body.mode === 'identify') {
      return await handleIdentify(body);
    }
    // Unrecognised mode (Requirement 11.6).
    return json(400, { error: 'Unsupported mode' });
  } catch (err) {
    // Any unexpected failure returns the graceful default (never a 500 to the guest).
    console.error('Unhandled error:', err);
    return json(200, SAFE_DEFAULTS);
  }
}

/**
 * Photo identification (or QR deep-link when species is provided without an image).
 */
async function handleIdentify(body) {
  const ageMode = body.ageMode === 'adult' ? 'adult' : 'kids';
  const system = buildIdentifySystemPrompt(ageMode);

  let userContent;
  if (body.species && !body.image) {
    // QR deep-link path: no image, species is ground truth.
    userContent = buildDeepLinkUserContent(String(body.species));
  } else {
    const mediaType =
      body.mediaType === 'image/png' ? 'image/png' : 'image/jpeg';
    userContent = buildIdentifyUserContent(body.image, mediaType);
  }

  let raw;
  try {
    raw = await invokeClaude(system, userContent);
  } catch (err) {
    console.error('Bedrock identify call failed:', err);
    return json(200, SAFE_DEFAULTS);
  }

  const parsed = safeParseJson(raw);
  if (!parsed) {
    return json(200, SAFE_DEFAULTS);
  }

  return json(200, normalizeIdentify(parsed));
}

/**
 * Ah Meng follow-up chat.
 */
async function handleChat(body) {
  const species = typeof body.species === 'string' ? body.species : body?.context?.species || '';
  const facts = Array.isArray(body?.context?.facts) ? body.context.facts : [];
  const question = typeof body.question === 'string' ? body.question : '';

  const system = buildChatSystemPrompt(species, facts);
  const userContent = [{ type: 'text', text: question }];

  let raw;
  try {
    raw = await invokeClaude(system, userContent);
  } catch (err) {
    console.error('Bedrock chat call failed:', err);
    return json(200, { answer: 'Sorry, I could not answer that just now. Please try again.' });
  }

  const parsed = safeParseJson(raw);
  const answer =
    parsed && typeof parsed.answer === 'string' && parsed.answer.trim()
      ? parsed.answer
      : 'Sorry, I could not answer that just now. Please try again.';

  return json(200, { answer });
}

/**
 * Invoke Claude 3 via Bedrock and return the model's text output.
 */
async function invokeClaude(system, userContent) {
  const requestBody = {
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: 1024,
    system,
    messages: [{ role: 'user', content: userContent }],
  };

  const command = new InvokeModelCommand({
    modelId: MODEL_ID,
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify(requestBody),
  });

  const response = await client.send(command);
  const decoded = JSON.parse(new TextDecoder().decode(response.body));
  // Claude messages API returns content as an array of blocks.
  if (Array.isArray(decoded.content)) {
    return decoded.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim();
  }
  return '';
}

/**
 * Parse a model string into JSON, tolerating stray text or code fences.
 * @returns {object|null}
 */
function safeParseJson(text) {
  if (!text || typeof text !== 'string') return null;
  const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    // Fall back to the first {...} block found in the text.
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

/**
 * Coerce a parsed identify object into a valid IdentifyResponse, filling safe
 * defaults for missing/invalid fields and enforcing confidence invariants.
 */
function normalizeIdentify(parsed) {
  const confident = parsed.confident === true;

  if (!confident) {
    const clarify =
      typeof parsed.clarify_prompt === 'string' && parsed.clarify_prompt.trim()
        ? clamp(parsed.clarify_prompt, MAX_CLARIFY_LEN)
        : "Hmm, I'm not sure what animal this is! Can you describe what you see - its colour, size, or any special features?";
    return {
      species: '',
      confident: false,
      facts: ['', '', ''],
      clarify_prompt: clarify,
    };
  }

  // Confident branch: enforce exactly three non-empty facts and a species name.
  const rawFacts = Array.isArray(parsed.facts) ? parsed.facts : [];
  const facts = [0, 1, 2].map((i) => {
    const f = typeof rawFacts[i] === 'string' ? rawFacts[i].trim() : '';
    return clamp(f, MAX_FACT_LEN);
  });

  const species =
    typeof parsed.species === 'string' ? clamp(parsed.species.trim(), MAX_SPECIES_LEN) : '';

  // If the model claimed confidence but produced empty content, downgrade gracefully.
  if (!species || facts.some((f) => !f)) {
    return {
      species: '',
      confident: false,
      facts: ['', '', ''],
      clarify_prompt:
        "Hmm, I'm not sure what animal this is! Can you describe what you see - its colour, size, or any special features?",
    };
  }

  return {
    species,
    confident: true,
    facts,
    clarify_prompt: null,
  };
}

function clamp(str, max) {
  return str.length > max ? str.slice(0, max) : str;
}

function json(statusCode, payload) {
  return {
    statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify(payload),
  };
}
