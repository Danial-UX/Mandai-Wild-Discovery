# Design Document — Mandai Wild Discovery

## ⚠️ Setup Risk #1: Bedrock Model Access (Read Before Anything Else)

Amazon Bedrock model access is **not enabled by default**. Before any backend work can be tested
against real Bedrock, a team member with AWS console access must navigate to
**Amazon Bedrock → Model access → Manage model access** in the target region and request access
for the chosen Claude model. Access is usually approved within minutes but can take up to 24 hours.

**Action required:**
1. Confirm your AWS account has Bedrock available in `us-east-1`.
2. Enable model access for `anthropic.claude-3-sonnet-20240229-v1:0` (or equivalent Claude 3 model).
3. Copy the full Model ARN from the console — you need it for the IAM policy and for `BEDROCK_MODEL_ID`.

**If access is not yet confirmed, use the Local Mock Stub** (see section below) so frontend
development can proceed in parallel.

---

## Architecture Overview

```
Browser (React SPA)
    │
    │  POST /identify  (multipart or JSON with Base64 image)
    ▼
API Gateway — HTTP API (us-east-1)
    │
    │  Lambda proxy integration
    ▼
Lambda: mandai-wild-discovery-fn  (Node.js 20.x)
    │
    ├─── mode == "identify"  →  Bedrock Runtime InvokeModel
    │                              (Claude 3 multimodal)
    │
    └─── mode == "chat"      →  Bedrock Runtime InvokeModel
                                   (Claude 3 text prompt)
```

**No database. No second function. No auth. No history stored.**

All P1 features (Wild Passport, GBIF map, Ah Meng Chat) either run entirely in the browser or
reuse the single existing Lambda route.

---

## AWS Resource Inventory

| Resource | Name / ID | Notes |
|---|---|---|
| Region | `us-east-1` | Must match Bedrock model availability |
| Lambda | `mandai-wild-discovery-fn` | Node.js 20.x, 512 MB, 10 s timeout |
| API Gateway | `mandai-wild-discovery-api` | HTTP API (not REST API) |
| Route | `POST /identify` | Lambda proxy |
| Lambda Execution Role | `mandai-wild-discovery-role` | See IAM section |
| CloudWatch Log Group | `/aws/lambda/mandai-wild-discovery-fn` | Auto-created |
| Bedrock Model | `anthropic.claude-3-sonnet-20240229-v1:0` | See setup risk above |

---

## Endpoint Contract

### Route

```
POST https://<api-id>.execute-api.us-east-1.amazonaws.com/identify
Content-Type: application/json
```

---

### Request Body — Photo Identification (mode: identify)

```json
{
  "mode": "identify",
  "image": "<Base64-encoded image bytes>",
  "mediaType": "image/jpeg",
  "ageMode": "kids"
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `mode` | `"identify"` | Yes | Constant for photo identification requests |
| `image` | string | Yes | Base64-encoded image, no data URI prefix |
| `mediaType` | string | Yes | `"image/jpeg"` or `"image/png"` |
| `ageMode` | `"kids"` \| `"adult"` | Yes | Controls fact vocabulary and length |

---

### Request Body — Ah Meng Chat (mode: chat)  *(P1)*

```json
{
  "mode": "chat",
  "question": "Why does the clouded leopard have such big paws?",
  "context": {
    "species": "Clouded Leopard",
    "facts": [
      "Clouded leopards have the longest canine teeth relative to body size of any living cat.",
      "They are excellent climbers and can hang upside down from branches.",
      "Clouded leopards are native to the foothills of the Himalayas through mainland Southeast Asia."
    ]
  }
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `mode` | `"chat"` | Yes | Constant for follow-up chat requests |
| `question` | string | Yes | Guest's free-text question |
| `context.species` | string | Yes | Species from the prior identification |
| `context.facts` | string[] | Yes | The three facts already shown to the guest |

---

### Response Body — Photo Identification (IdentifyResponse)

```json
{
  "species": "Clouded Leopard",
  "confident": true,
  "facts": [
    "Clouded leopards have the longest canine teeth relative to body size of any living cat.",
    "They are excellent climbers and can hang upside down from branches using their flexible ankles.",
    "Their gorgeous spotted coat helps them hide in dappled forest light — nature's camouflage!"
  ],
  "clarify_prompt": null
}
```

Low-confidence example:

```json
{
  "species": "",
  "confident": false,
  "facts": ["", "", ""],
  "clarify_prompt": "Hmm, I'm not sure what animal this is! Can you describe what you see — its colour, size, or any special features?"
}
```

Graceful error fallback (malformed model output):

```json
{
  "species": "",
  "confident": false,
  "facts": ["", "", ""],
  "clarify_prompt": "Sorry, something went wrong. Please try again."
}
```

---

### Response Body — Ah Meng Chat (ChatResponse)  *(P1)*

```json
{
  "answer": "Great question! Clouded leopards have large, padded paws to help them grip branches tightly. Think of them like built-in climbing shoes!"
}
```

Error response (unrecognised mode):

```json
{
  "error": "Unsupported mode"
}
```
HTTP status: 400

---

## Bedrock Prompt Templates

### Identify Prompt (sent to Claude 3 as a multimodal message)

**System prompt:**

```
You are a friendly wildlife expert at Mandai Wildlife Parks. Your job is to identify animals in
photos and share fascinating facts. You MUST reply with ONLY a JSON object — no explanation, no
markdown, no code fence — matching this exact shape:

{
  "species": "<common name of the animal, or empty string if unsure>",
  "confident": <true if you can identify the animal with high confidence, false otherwise>,
  "facts": ["<fact 1>", "<fact 2>", "<fact 3>"],
  "clarify_prompt": "<friendly question asking the guest to describe what they see, or null if confident>"
}

Age mode: {{AGE_MODE}}

{{#if KIDS_MODE}}
- Write for children aged 6–12.
- Use simple words. Avoid scientific jargon.
- Each fact MUST be 25 words or fewer.
- Use exclamation points and fun language.
{{else}}
- Write for adults interested in nature and conservation.
- You may use scientific or naturalist terminology.
- Each fact MUST be 40 words or fewer.
{{/if}}

If you are not confident, set "confident" to false, leave "species" as an empty string,
set "facts" to ["", "", ""], and write a warm, encouraging "clarify_prompt".
```

**User message (multimodal):**

```json
[
  {
    "type": "image",
    "source": {
      "type": "base64",
      "media_type": "{{MEDIA_TYPE}}",
      "data": "{{BASE64_IMAGE}}"
    }
  },
  {
    "type": "text",
    "text": "Please identify the animal in this photo and respond with the JSON object as instructed."
  }
]
```

---

### Chat Prompt (sent to Claude 3 as a text-only message)  *(P1)*

**System prompt:**

```
You are Ah Meng, a knowledgeable and friendly wildlife guide at Mandai Wildlife Parks.
A guest has already identified a {{SPECIES}} and been given these three facts:

1. {{FACT_1}}
2. {{FACT_2}}
3. {{FACT_3}}

Answer the guest's follow-up question in 2–4 sentences. Be warm, accurate, and age-appropriate.
Reply with ONLY a JSON object: { "answer": "<your response>" }
```

**User message:**

```
{{GUEST_QUESTION}}
```

---

## IAM Policy

### Lambda Execution Role: `mandai-wild-discovery-role`

Attach this inline policy to the role. Replace the placeholder ARNs with your actual values.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowBedrockInvokeModel",
      "Effect": "Allow",
      "Action": "bedrock:InvokeModel",
      "Resource": "arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-3-sonnet-20240229-v1:0"
    },
    {
      "Sid": "AllowCloudWatchLogs",
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "arn:aws:logs:us-east-1:<ACCOUNT_ID>:log-group:/aws/lambda/mandai-wild-discovery-fn:*"
    }
  ]
}
```

**Trust policy** (same as any Lambda execution role):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "lambda.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
```

> Replace `<ACCOUNT_ID>` with your 12-digit AWS account ID.
> If you change the model, update the `Resource` ARN in the `AllowBedrockInvokeModel` statement.

---

## CORS Configuration

Configure these CORS settings on the API Gateway HTTP API:

```json
{
  "allowOrigins": ["http://localhost:3000", "*"],
  "allowMethods": ["POST", "OPTIONS"],
  "allowHeaders": ["Content-Type", "X-Requested-With"],
  "maxAge": 300
}
```

AWS CDK equivalent:

```typescript
new HttpApi(this, 'MandaiApi', {
  corsPreflight: {
    allowOrigins: ['http://localhost:3000', '*'],
    allowMethods: [CorsHttpMethod.POST, CorsHttpMethod.OPTIONS],
    allowHeaders: ['Content-Type', 'X-Requested-With'],
    maxAge: Duration.seconds(300),
  },
});
```

API Gateway handles the `OPTIONS` preflight automatically when CORS is configured at the API level;
no separate `OPTIONS` route is needed.

---

## Local Mock Stub

**Purpose:** Allows Teammate B (frontend) to develop and test the full UI without waiting for
Bedrock access or a deployed Lambda.

**File:** `backend/src/mockHandler.js` (or `mockHandler.ts`)

```javascript
// mockHandler.js — returns canned JSON for local frontend development.
// Usage: set MOCK_MODE=true in your local .env, or swap this in during dev.

const MOCK_RESPONSES = {
  identify: {
    confident: {
      species: "Clouded Leopard",
      confident: true,
      facts: [
        "Clouded leopards have the longest canine teeth relative to body size of any living cat!",
        "They can climb down trees headfirst — thanks to super-flexible ankles that rotate backwards.",
        "A clouded leopard's spots are actually called 'clouds' because of their swirly, cloud-like shape."
      ],
      clarify_prompt: null
    },
    notConfident: {
      species: "",
      confident: false,
      facts: ["", "", ""],
      clarify_prompt: "Hmm, I'm not sure what animal this is! Can you describe what you see — its colour, size, or any special features?"
    }
  },
  chat: {
    answer: "Great question! Clouded leopards have large, padded paws to help them grip branches tightly — like built-in climbing shoes!"
  }
};

export async function mockHandler(event) {
  const body = JSON.parse(event.body || '{}');

  if (body.mode === 'chat') {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(MOCK_RESPONSES.chat)
    };
  }

  // Return not-confident response ~20% of the time for realistic testing
  const response = Math.random() < 0.2
    ? MOCK_RESPONSES.identify.notConfident
    : MOCK_RESPONSES.identify.confident;

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(response)
  };
}
```

**Frontend integration pattern:**

```javascript
// In your API client module:
const USE_MOCK = import.meta.env.VITE_MOCK_MODE === 'true';

export async function identifyAnimal(payload) {
  if (USE_MOCK) {
    // Import and call mock directly, or hit a local Express server wrapping mockHandler
    return mockHandler({ body: JSON.stringify(payload) }).then(r => JSON.parse(r.body));
  }
  const response = await fetch(import.meta.env.VITE_API_URL + '/identify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return response.json();
}
```

Set `VITE_MOCK_MODE=true` in `.env.local` to use the stub; set `VITE_API_URL` to the deployed
API Gateway URL when switching to real Bedrock.

---

## Lambda Handler Sketch

The following is a structural outline — not production code — to clarify the branching logic
that drives the integration seam between Teammate A and Teammate B.

```javascript
// handler.js
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';

const client = new BedrockRuntimeClient({ region: process.env.AWS_REGION || 'us-east-1' });
const MODEL_ID = process.env.BEDROCK_MODEL_ID; // e.g. anthropic.claude-3-sonnet-20240229-v1:0

const SAFE_DEFAULTS = {
  species: '', confident: false,
  facts: ['', '', ''],
  clarify_prompt: 'Sorry, something went wrong. Please try again.'
};

export async function handler(event) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  };

  try {
    const body = JSON.parse(event.body || '{}');

    if (body.mode === 'chat') {
      return handleChat(body, headers);
    } else if (body.mode === 'identify') {
      return handleIdentify(body, headers);
    } else {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Unsupported mode' }) };
    }
  } catch (err) {
    return { statusCode: 200, headers, body: JSON.stringify(SAFE_DEFAULTS) };
  }
}

async function handleIdentify(body, headers) {
  // Build multimodal Claude message with system prompt + image
  // Call InvokeModelCommand
  // Parse response; fall back to SAFE_DEFAULTS on any parse error
  // Return { statusCode: 200, headers, body: JSON.stringify(identifyResponse) }
}

async function handleChat(body, headers) {
  // Build text-only Claude message with context
  // Call InvokeModelCommand
  // Parse { answer } from response
  // Return { statusCode: 200, headers, body: JSON.stringify({ answer }) }
}
```

---

## P1 Frontend Architecture Notes

### Wild Passport (sessionStorage)

- Key: `mandai_passport` — value: `JSON.stringify(string[])` (array of species names).
- Updated by the `usePassport` hook immediately after a confident `IdentifyResponse` is received.
- Badge thresholds: 3 → "Explorer", 5 → "Ranger", 10 → "Wild Guardian".
- Deduplication: check `passport.includes(species)` before pushing.

### GBIF Distribution Map

- Library: Leaflet.js (lightweight, no API key needed) + React Leaflet wrapper.
- API call: `GET https://api.gbif.org/v1/occurrence/search?scientificName=<species>&year=<startYear>,<endYear>&limit=300`
- Decade slider: maps each tick to `year=YYYY,YYYY+9` query params.
- Timeout: wrap fetch in `Promise.race` with a 5-second rejection to trigger the graceful message.
- Tile layer: OpenStreetMap (free, no API key).

### Ah Meng Chat

- Rendered below the facts card only when `confident === true`.
- Sends `{ mode: "chat", question, context: { species, facts } }` to the same `/identify` endpoint.
- Displays `response.answer` in a chat-bubble style.
- No history stored beyond what is visible in the DOM.

---

## Environment Variables

| Variable | Used By | Example Value |
|---|---|---|
| `BEDROCK_MODEL_ID` | Lambda | `anthropic.claude-3-sonnet-20240229-v1:0` |
| `AWS_REGION` | Lambda (fallback) | `us-east-1` |
| `VITE_API_URL` | Frontend | `https://<api-id>.execute-api.us-east-1.amazonaws.com` |
| `VITE_MOCK_MODE` | Frontend | `true` (local dev), `false` (deployed) |
