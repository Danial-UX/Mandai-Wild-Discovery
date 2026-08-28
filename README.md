# Mandai Wild Discovery

AI-powered guest experience for Mandai Wildlife Parks. Guests photograph an animal, and the app
identifies the species and returns three fun, age-appropriate facts. Stretch features add a
session-based Wild Passport, a GBIF distribution map with a decade time-slider, and an
"Ah Meng" follow-up chat.

## Project Structure

```
.
├── backend/          # AWS Lambda (Node.js 20.x) + local mock server
│   ├── src/
│   │   ├── handler.js        # Real Lambda: identify + chat branches, defensive parsing
│   │   ├── mockHandler.js    # Canned JSON responses for local dev
│   │   ├── prompts.js        # Bedrock system/user prompt builders
│   │   └── devServer.js      # Local Express server wrapping the handler(s)
│   ├── iam/
│   │   ├── execution-role-policy.json
│   │   └── trust-policy.json
│   └── package.json
└── frontend/         # Vite + React single-page app
    ├── src/
    │   ├── main.jsx
    │   ├── App.jsx
    │   ├── api/client.js
    │   ├── hooks/usePassport.js
    │   ├── components/
    │   └── styles/theme.css
    ├── index.html
    └── package.json
```

## Quick Start

### Backend (local mock)

```bash
cd backend
npm install
npm run dev:mock      # local server on http://localhost:3000 returning canned JSON
```

### Frontend

```bash
cd frontend
npm install
npm run dev           # Vite dev server on http://localhost:5173
```

By default the frontend runs against the in-browser mock (`VITE_MOCK_MODE=true`). To point it at
a real deployed API, set `VITE_MOCK_MODE=false` and `VITE_API_URL` in `frontend/.env.local`.

## Deployment (P0 backend)

The backend is a single Node.js 20.x Lambda behind one API Gateway HTTP API route (`POST /identify`).
See `design.md` and `backend/iam/` for the least-privilege IAM policy. Steps:

1. Enable Bedrock model access for `anthropic.claude-3-sonnet-20240229-v1:0` in `us-east-1`.
2. Create the execution role using `backend/iam/execution-role-policy.json` + `trust-policy.json`
   (replace `<ACCOUNT_ID>`).
3. Zip `backend/src` + `node_modules` and deploy as `mandai-wild-discovery-fn` (handler: `handler.handler`).
4. Set env vars `BEDROCK_MODEL_ID` and `AWS_REGION`.
5. Create the HTTP API, `POST /identify` proxy route, and CORS config from `design.md`.

## Environment Variables

| Variable | Used By | Example |
|---|---|---|
| `BEDROCK_MODEL_ID` | Lambda | `anthropic.claude-3-sonnet-20240229-v1:0` |
| `AWS_REGION` | Lambda | `us-east-1` |
| `VITE_API_URL` | Frontend | `https://<api-id>.execute-api.us-east-1.amazonaws.com` |
| `VITE_MOCK_MODE` | Frontend | `true` (local), `false` (deployed) |
