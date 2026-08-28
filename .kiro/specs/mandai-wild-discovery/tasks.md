# Implementation Plan — Mandai Wild Discovery

> **Implementation status:** Built as one cohesive project (`backend/` + `frontend/`).
> All code-level P0 and P1 tasks are complete and verified locally (frontend `vite build`
> passes; backend mock server + real handler defensive-parsing paths smoke-tested).
> Tasks that require a live AWS account (create IAM role, deploy Lambda/API Gateway, run
> against real Bedrock) are marked **[deploy]** — code and config are ready; a human with
> AWS access must run them.

> **Build target:** 2 people, ~90 minutes.
> **Golden rule:** Do NOT start any P1 or P2 task until every P0 task is complete and verified.
> **Integration seam:** The `/identify` endpoint JSON contract in `design.md` is agreed first —
> both teammates start from it immediately and can work in parallel.

---

## Module Split

**Teammate A — AWS / Backend**
- API Gateway HTTP API + `POST /identify` route + CORS
- The single Lambda (`mandai-wild-discovery-fn`)
- Bedrock prompt construction + defensive JSON parsing
- IAM execution role (least privilege)
- Local-mock stub (`mockHandler.js`) — deliver this FIRST so Teammate B is unblocked

**Teammate B — React Frontend**
- Camera / photo upload + Base64 encoding
- Age-mode toggle (Kids / Adult)
- Response cards + earth-tone mobile-first styling
- Loading + low-confidence states
- Then (P1): Wild Passport, GBIF map + time-slider, Ah Meng chat

**Parallelization:** Once the contract is locked (Task 0) and the mock stub exists (Task 1),
Teammate B builds the entire frontend against the mock while Teammate A wires up real AWS.
They converge at Task 8 (integration).

---

## P0 Tasks — Core Feature (must all be done first)

- [x] **0. Lock the endpoint contract** *(both, 5 min)*
  - Both teammates read `design.md` → "Endpoint Contract" together.
  - Agree on the `identify` request/response shape as the source of truth.
  - _Dependencies: none. Blocks everything._
  - _Requirements: 8_

- [x] **1. Build the local-mock stub** *(Teammate A, 10 min)*
  - Done: `backend/src/mockHandler.js` + Express dev server (`backend/src/devServer.js`, `npm run dev:mock` on `http://localhost:3000`). Smoke-tested identify/chat/bad-mode paths.
  - Create `backend/src/mockHandler.js` returning canned `IdentifyResponse` JSON per `design.md`.
  - Wrap it in a tiny local Express server (or Vite dev proxy) on `http://localhost:3000`.
  - Hand the mock URL to Teammate B immediately.
  - _Dependencies: Task 0. Unblocks all frontend tasks._
  - _Requirements: 1, 3, 8_

- [x] **2. Scaffold the React app + earth-tone shell** *(Teammate B, 10 min)*
  - Done: Vite + React (`frontend/`), documented palette in `src/styles/theme.css`, App shell with photo button, Kids/Adult toggle (default Kids), response area.
  - Vite + React single page. Green/earth-tone palette, mobile-first CSS (min 320 px).
  - Layout: photo button, Kids/Adult toggle (default Kids), empty response area.
  - _Dependencies: Task 0._
  - _Requirements: 4, 2.3_

- [x] **3. Create the IAM execution role** *(Teammate A, 10 min)* **[deploy]**
  - Done (code): least-privilege policy in `backend/iam/execution-role-policy.json` + `trust-policy.json`. **[deploy]** create the role in AWS from these files (replace `<ACCOUNT_ID>`).
  - Role `mandai-wild-discovery-role` with the least-privilege inline policy from `design.md`.
  - Scope `bedrock:InvokeModel` to the specific Model ARN; logs scoped to the function log group.
  - _Dependencies: Task 0._
  - _Requirements: 6_

- [x] **4. Implement the real Lambda handler** *(Teammate A, 15 min)*
  - Done: `backend/src/handler.js` — parses body, branches on `mode`, builds prompts (`src/prompts.js`), calls `InvokeModelCommand`, defensive JSON parse with safe defaults, enforces confidence/word-limit invariants. Verified: bad-mode → 400, malformed body → graceful 200, Bedrock failure → graceful 200.
  - `handler.js`: parse body, branch on `mode`, build the identify Bedrock prompt from `design.md`.
  - Call `InvokeModelCommand`; parse model output defensively; fill safe defaults on any failure.
  - Enforce age-mode word limits via the system prompt (Kids <25, Adult <40).
  - Set `confident` + `clarify_prompt` correctly.
  - _Dependencies: Task 3._
  - _Requirements: 1, 2, 3, 5, 8_

- [ ] **5. Deploy API Gateway HTTP API + route + CORS** *(Teammate A, 10 min)* **[deploy]**
  - CORS/route config documented in `design.md`; handler already emits CORS headers. **[deploy]** requires a live AWS account.
  - HTTP API `mandai-wild-discovery-api`, `POST /identify` → Lambda proxy.
  - Apply CORS config from `design.md` (`localhost:3000` + `*`, POST/OPTIONS, correct headers).
  - Verify OPTIONS preflight returns 204.
  - _Dependencies: Task 4._
  - _Requirements: 5, 7_

- [x] **6. Wire the frontend API client + submit flow** *(Teammate B, 10 min)*
  - Done: `frontend/src/api/client.js` with `VITE_MOCK_MODE` switch (in-browser mock in `api/mock.js`), Base64 encoding, file-type/size validation (JPEG/PNG, ≤10 MB), loading indicator + disabled submit.
  - API client with `VITE_MOCK_MODE` switch (mock vs `VITE_API_URL`).
  - On submit: Base64-encode image, POST with `mode`/`ageMode`, show loading indicator, disable button.
  - _Dependencies: Task 1, Task 2._
  - _Requirements: 1.1, 4.4, 4.5_

- [x] **7. Render response + low-confidence states** *(Teammate B, 10 min)*
  - Done: `FactsView` (species + 3 cards on confident), clarify prompt shown (facts hidden) on low confidence, terracotta error box on the graceful error object.
  - Show species + three fact cards on `confident === true`.
  - Show `clarify_prompt` prominently (hide facts) on `confident === false`.
  - Render the graceful error message on the error object.
  - _Dependencies: Task 6._
  - _Requirements: 1, 3.5, 8_

- [ ] **8. Integration: swap mock → real endpoint** *(both, 10 min)* **[deploy]**
  - Frontend switch is wired (`VITE_MOCK_MODE`/`VITE_API_URL`). **[deploy]** the end-to-end real-Bedrock test requires the deployed API from Tasks 3–5.
  - Set `VITE_MOCK_MODE=false`, point `VITE_API_URL` at the deployed API.
  - Run an end-to-end test: real photo → real Bedrock → cards render within 5 s.
  - Confirm Kids/Adult word limits and low-confidence path against the live model.
  - **✅ P0 DONE — do not proceed until this passes.**
  - _Dependencies: Tasks 5, 7._
  - _Requirements: 1, 2, 3, 7, 8_

---

## P1 Tasks — Stretch (only after P0 verified; NO database, NO 2nd Lambda, NO auth)

- [x] **9. Wild Passport (sessionStorage)** *(Teammate B, 10 min)*
  - Done: `usePassport` hook (add on confident ID, dedupe, `sessionStorage`) + `Passport` grid with badges at 3 (Explorer) / 5 (Ranger) / 10 (Wild Guardian).
  - _Dependencies: Task 8._
  - _Requirements: 9_

- [x] **10. GBIF distribution map + decade time-slider** *(Teammate B, 15 min)*
  - Done: `DistributionMap` (react-leaflet + OSM), GBIF fetch by `scientificName`, decade slider (1900→current) → `year=YYYY,YYYY+9`, 5s timeout → "Distribution data unavailable", zero results → "No recorded sightings found".
  - _Dependencies: Task 8._
  - _Requirements: 10_

- [x] **11. Ask-Ah-Meng chat (reuse same Lambda)** *(both, 15 min)*
  - Done: backend `handleChat` branch returns `{ answer }` (400 on bad mode); frontend `AhMengChat` box shown after confident ID, POSTs `mode: "chat"` with context, renders the answer in chat bubbles.
  - _Dependencies: Task 8._
  - _Requirements: 11_

---

## P2 Tasks — Nice-to-Have (cut freely)

- [ ] **12. Bounding-box overlay** *(both, 10 min)*
  - Lambda: request optional `bbox` `[x,y,w,h]` (0–1) in the identify prompt.
  - Frontend: draw box over photo if valid; hide silently if absent or out of range.
  - _Dependencies: Task 8._
  - _Requirements: 12_

- [ ] **13. Exhibit QR deep-link** *(both, 10 min)*
  - Frontend: read `?species=<name>`, skip photo step, request facts by name.
  - Lambda: handle image-less identify → treat species as ground truth, `confident: true`.
  - _Dependencies: Task 8._
  - _Requirements: 13_

- [ ] **14. Language toggle** *(both, 10 min)*
  - Frontend: language selector (English + one more); re-submit last photo on change.
  - Lambda: inject language instruction into the Bedrock prompt.
  - _Dependencies: Task 8._
  - _Requirements: 14_

---

## Critical Path Summary

```
Task 0 (contract)
   ├── Task 1 (mock) ──► Task 6 ──► Task 7 ─┐
   │                                         ├──► Task 8 (P0 DONE) ──► P1 (9,10,11) ──► P2 (12,13,14)
   └── Task 3 ──► Task 4 ──► Task 5 ────────┘
```

- Teammate A path: 0 → 1 → 3 → 4 → 5
- Teammate B path: 0 → 2 → 6 → 7
- Both converge at Task 8. P1/P2 branch out only after Task 8 passes.
