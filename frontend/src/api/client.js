// API client — switches between the in-browser mock and a real deployed endpoint
// via VITE_MOCK_MODE. See design.md "Local Mock Stub".

import { mockIdentify, mockChat } from './mock.js';

export const USE_MOCK = import.meta.env.VITE_MOCK_MODE === 'true';
const API_URL = import.meta.env.VITE_API_URL || '';

const GRACEFUL_ERROR = {
  species: '',
  confident: false,
  facts: ['', '', ''],
  clarify_prompt: 'Sorry, something went wrong. Please try again.',
};

async function postIdentify(payload) {
  const res = await fetch(`${API_URL}/identify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
    },
    body: JSON.stringify(payload),
  });
  return res.json();
}

/**
 * Identify an animal from a Base64 image (or by species name for QR deep-links).
 * @param {{ image?: string, mediaType?: string, ageMode: string, species?: string }} payload
 */
export async function identifyAnimal(payload) {
  const body = { mode: 'identify', ...payload };
  try {
    if (USE_MOCK) return await mockIdentify(body);
    return await postIdentify(body);
  } catch (err) {
    console.error('identifyAnimal failed:', err);
    return GRACEFUL_ERROR;
  }
}

/**
 * Ask Ah Meng a follow-up question about the identified species.
 * @param {{ question: string, context: { species: string, facts: string[] } }} payload
 */
export async function askAhMeng(payload) {
  const body = { mode: 'chat', ...payload };
  try {
    if (USE_MOCK) return await mockChat(body);
    return await postIdentify(body);
  } catch (err) {
    console.error('askAhMeng failed:', err);
    return { answer: 'Sorry, I could not answer that just now. Please try again.' };
  }
}

/**
 * Read a File as Base64 (no data URI prefix) plus its media type.
 * @param {File} file
 * @returns {Promise<{ base64: string, mediaType: string }>}
 */
export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const comma = result.indexOf(',');
      resolve({
        base64: comma >= 0 ? result.slice(comma + 1) : result,
        mediaType: file.type === 'image/png' ? 'image/png' : 'image/jpeg',
      });
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
