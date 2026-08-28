// prompts.js — Bedrock prompt builders for identify (multimodal) and chat (text) modes.
// Mirrors the templates documented in design.md.

/**
 * Build the system prompt for photo identification.
 * @param {"kids"|"adult"} ageMode
 * @returns {string}
 */
export function buildIdentifySystemPrompt(ageMode) {
  const isKids = ageMode !== 'adult'; // default to kids per Requirement 2.3
  const ageBlock = isKids
    ? [
        '- Write for children aged 6-12.',
        '- Use simple words. Avoid scientific jargon.',
        '- Each fact MUST be 25 words or fewer.',
        '- Use exclamation points and fun language.',
      ].join('\n')
    : [
        '- Write for adults interested in nature and conservation.',
        '- You may use scientific or naturalist terminology.',
        '- Each fact MUST be 40 words or fewer.',
      ].join('\n');

  return `You are a friendly wildlife expert at Mandai Wildlife Parks. Your job is to identify animals in
photos and share fascinating facts. You MUST reply with ONLY a JSON object - no explanation, no
markdown, no code fence - matching this exact shape:

{
  "species": "<common name of the animal, or empty string if unsure>",
  "confident": <true if you can identify the animal with high confidence, false otherwise>,
  "facts": ["<fact 1>", "<fact 2>", "<fact 3>"],
  "clarify_prompt": "<friendly question asking the guest to describe what they see, or null if confident>"
}

Age mode: ${isKids ? 'kids' : 'adult'}

${ageBlock}

Treat "high confidence" as 0.70 or above. If you are not confident, set "confident" to false, leave
"species" as an empty string, set "facts" to ["", "", ""], and write a warm, encouraging
"clarify_prompt".`;
}

/**
 * Build the multimodal user message content for identification.
 * @param {string} base64Image - Base64 image bytes, no data URI prefix.
 * @param {string} mediaType - "image/jpeg" or "image/png".
 * @returns {Array}
 */
export function buildIdentifyUserContent(base64Image, mediaType) {
  return [
    {
      type: 'image',
      source: {
        type: 'base64',
        media_type: mediaType,
        data: base64Image,
      },
    },
    {
      type: 'text',
      text: 'Please identify the animal in this photo and respond with the JSON object as instructed.',
    },
  ];
}

/**
 * Build a text-only identification request for the QR deep-link path (no image).
 * @param {string} species
 * @returns {Array}
 */
export function buildDeepLinkUserContent(species) {
  return [
    {
      type: 'text',
      text: `A guest scanned an exhibit QR code for the species "${species}". Treat this species name as ground truth, set "confident" to true, and respond with the JSON object as instructed.`,
    },
  ];
}

/**
 * Build the chat system prompt (Ah Meng follow-up chat).
 * @param {string} species
 * @param {string[]} facts
 * @returns {string}
 */
export function buildChatSystemPrompt(species, facts) {
  const safeFacts = Array.isArray(facts) ? facts : [];
  const [f1 = '', f2 = '', f3 = ''] = safeFacts;
  return `You are Ah Meng, a knowledgeable and friendly wildlife guide at Mandai Wildlife Parks.
A guest has already identified a ${species} and been given these three facts:

1. ${f1}
2. ${f2}
3. ${f3}

Answer the guest's follow-up question in 2-4 sentences. Be warm, accurate, and age-appropriate.
Reply with ONLY a JSON object: { "answer": "<your response>" }`;
}
