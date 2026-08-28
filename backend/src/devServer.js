// devServer.js — local Express server that wraps the Lambda handler(s) so the
// frontend can develop against http://localhost:3000 without deploying to AWS.
//
//   npm run dev:mock   -> uses mockHandler (canned JSON, no AWS credentials)
//   npm run dev:real   -> uses the real handler (requires AWS creds + Bedrock access)

import express from 'express';
import cors from 'cors';
import { mockHandler } from './mockHandler.js';

const USE_MOCK = process.argv.includes('--mock') || process.env.MOCK_MODE === 'true';
const PORT = process.env.PORT || 3000;

// In real mode, warn early if no Bedrock auth is configured so failures are obvious.
if (!USE_MOCK && !process.env.AWS_BEARER_TOKEN_BEDROCK && !process.env.AWS_ACCESS_KEY_ID) {
  console.warn(
    '[warn] Real mode but no Bedrock credentials found.\n' +
      '       Set AWS_BEARER_TOKEN_BEDROCK (Bedrock API key) in backend/.env,\n' +
      '       or provide AWS access keys. Copy .env.example to .env to get started.'
  );
}

const app = express();
app.use(cors({ origin: ['http://localhost:3000', 'http://localhost:5173', '*'] }));
app.use(express.json({ limit: '15mb' })); // Base64 of a 10MB image is ~13.4MB.

// Lazily import the real handler only when needed (avoids requiring AWS SDK for mock runs).
let realHandler = null;
async function getHandler() {
  if (USE_MOCK) return mockHandler;
  if (!realHandler) {
    ({ handler: realHandler } = await import('./handler.js'));
  }
  return realHandler;
}

app.post('/identify', async (req, res) => {
  const handler = await getHandler();
  const event = { body: JSON.stringify(req.body || {}) };
  try {
    const result = await handler(event);
    res
      .status(result.statusCode)
      .set(result.headers || {})
      .send(result.body);
  } catch (err) {
    console.error('devServer error:', err);
    res.status(200).json({
      species: '',
      confident: false,
      facts: ['', '', ''],
      clarify_prompt: 'Sorry, something went wrong. Please try again.',
    });
  }
});

app.get('/health', (_req, res) => res.json({ ok: true, mode: USE_MOCK ? 'mock' : 'real' }));

app.listen(PORT, () => {
  console.log(
    `Mandai Wild Discovery dev server on http://localhost:${PORT} (${USE_MOCK ? 'MOCK' : 'REAL Bedrock'} mode)`
  );
});
