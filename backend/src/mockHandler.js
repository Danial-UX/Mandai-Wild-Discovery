// mockHandler.js - returns canned JSON for local frontend development.
// Usage: run `npm run dev:mock`, or set MOCK_MODE=true.
// No Bedrock, no AWS credentials required.
//
// The returned animal is chosen by the caller via `mockId` (see the mock animal
// selector in the UI). Facts respect `ageMode`. Kept in sync with the frontend mock.

import { getMockAnimal, DEFAULT_MOCK_ID } from './mockAnimals.js';

const NOT_CONFIDENT = {
  species: '',
  confident: false,
  facts: ['', '', ''],
  clarify_prompt:
    "Hmm, I'm not sure what animal this is! Can you describe what you see - its colour, size, or any special features?",
};

function confidentResponse(animal, ageMode) {
  return {
    species: animal.species,
    confident: true,
    facts: ageMode === 'adult' ? animal.facts.adult : animal.facts.kids,
    clarify_prompt: null,
  };
}

/**
 * Lambda-shaped mock handler.
 * @param {{ body?: string }} event
 * @returns {Promise<{statusCode:number, headers:object, body:string}>}
 */
export async function mockHandler(event) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  };

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    body = {};
  }

  const send = (statusCode, payload) => ({
    statusCode,
    headers,
    body: JSON.stringify(payload),
  });

  if (body.mode === 'chat') {
    const animal = getMockAnimal(body.mockId || DEFAULT_MOCK_ID);
    return send(200, { answer: animal.chat });
  }

  if (body.mode && body.mode !== 'identify') {
    return send(400, { error: 'Unsupported mode' });
  }

  // Deep-link (QR) path: species provided, no image -> always confident.
  if (body.species && !body.image) {
    const animal = getMockAnimal(body.mockId || DEFAULT_MOCK_ID);
    return send(200, { ...confidentResponse(animal, body.ageMode), species: body.species });
  }

  // Explicit low-confidence selection lets you demo that path on demand.
  if (body.mockId === 'not-confident') {
    return send(200, NOT_CONFIDENT);
  }

  const animal = getMockAnimal(body.mockId || DEFAULT_MOCK_ID);
  return send(200, confidentResponse(animal, body.ageMode));
}
