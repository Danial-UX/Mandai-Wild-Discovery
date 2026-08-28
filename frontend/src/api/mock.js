// In-browser mock used when VITE_MOCK_MODE=true. Mirrors backend/src/mockHandler.js
// so the frontend can run with no backend process at all.
//
// Which animal is returned is chosen by the caller via `mockId` (see the mock
// animal selector in the UI). If no id is supplied, the first animal is used.

import { getMockAnimal, DEFAULT_MOCK_ID } from './mockAnimals.js';

const NOT_CONFIDENT = {
  species: '',
  confident: false,
  facts: ['', '', ''],
  clarify_prompt:
    "Hmm, I'm not sure what animal this is! Can you describe what you see - its colour, size, or any special features?",
};

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

function confidentResponse(animal, ageMode) {
  const facts = ageMode === 'adult' ? animal.facts.adult : animal.facts.kids;
  return {
    species: animal.species,
    confident: true,
    facts,
    clarify_prompt: null,
  };
}

export async function mockIdentify(body) {
  await delay(700); // simulate latency so the loading state is visible

  // QR deep-link: species given, no image -> always confident with that species.
  if (body.species && !body.image) {
    const animal = getMockAnimal(body.mockId || DEFAULT_MOCK_ID);
    return { ...confidentResponse(animal, body.ageMode), species: body.species };
  }

  // Explicit "not sure" selection lets you demo the low-confidence path on demand.
  if (body.mockId === 'not-confident') {
    return NOT_CONFIDENT;
  }

  const animal = getMockAnimal(body.mockId || DEFAULT_MOCK_ID);
  return confidentResponse(animal, body.ageMode);
}

export async function mockChat(body) {
  await delay(600);
  const animal = getMockAnimal(body?.mockId || DEFAULT_MOCK_ID);
  return { answer: animal.chat };
}
