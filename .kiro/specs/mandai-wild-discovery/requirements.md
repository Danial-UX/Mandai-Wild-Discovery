# Requirements Document

## Introduction

Mandai Wild Discovery is an AI-powered guest experience for Mandai Wildlife Parks (Singapore Zoo,
Bird Paradise, River Wonders, Night Safari). Guests upload or photograph an animal, and the app
identifies the species and returns three short, fun, curiosity-sparking facts tuned to a selected
age mode (Kids or Adult). Stretch features add a session-based Wild Passport collector, a GBIF
distribution map with a time-slider, a follow-up Ah Meng chat, and several P2 enhancements — all
without adding a database, a second Lambda, or authentication.

## Glossary

- **App**: The Mandai Wild Discovery single-page React application served to guests in a browser.
- **Backend**: The AWS-hosted API composed of API Gateway (HTTP API) and the single Lambda function.
- **Lambda**: The single AWS Lambda function that handles all server-side logic.
- **Bedrock**: Amazon Bedrock Runtime, used to invoke a Claude multimodal model.
- **Model**: The Claude multimodal model accessed through Bedrock (e.g., `anthropic.claude-3-sonnet-20240229-v1:0`).
- **IdentifyResponse**: The structured JSON object `{ "species": string, "confident": boolean, "facts": string[3], "clarify_prompt": string|null }` returned by the Lambda for photo identification requests.
- **ChatResponse**: The structured JSON object `{ "answer": string }` returned by the Lambda for follow-up chat requests.
- **Kids Mode**: Age-mode setting where facts use simplified vocabulary and each fact is at most 24 words (under 25).
- **Adult Mode**: Age-mode setting where facts may use richer language and each fact is at most 39 words (under 40).
- **Wild Passport**: A client-side session collection of identified species, stored exclusively in `sessionStorage`.
- **GBIF API**: The public Global Biodiversity Information Facility occurrence search API at `api.gbif.org`.
- **Mock Stub**: A local development module that returns canned `IdentifyResponse` JSON without calling Bedrock.
- **Ah Meng Chat**: A follow-up conversational interface allowing guests to ask questions about an identified species.
- **Model ARN**: The full Amazon Resource Name of the Bedrock model in use, used to scope the IAM policy.

---

## Requirements

---

### P0 — Core Feature (must be fully working before any P1/P2 work begins)

---

### Requirement 1: Animal Photo Identification

**User Story:** As a guest, I want to upload or photograph an animal and receive its species name
and three fun facts, so that I can learn about the wildlife I encounter at the park.

#### Acceptance Criteria

1. WHEN a guest submits a JPEG or PNG photo of at most 10 MB, THE App SHALL encode the image as Base64 and send it to the Backend within 1 second of submission.
2. WHEN the Backend receives a photo payload, THE Lambda SHALL invoke Bedrock with the image and return an `IdentifyResponse` to the caller within 5 seconds of the Lambda invocation start.
3. THE Lambda SHALL always include exactly three non-empty strings, each at most 250 characters, in the `facts` array of `IdentifyResponse` when `confident` is `true`.
4. WHEN `confident` is `true`, THE Lambda SHALL include the identified species name as a non-empty string of at most 100 characters in the `species` field of `IdentifyResponse`.
5. WHEN the Model returns well-formed JSON matching `IdentifyResponse`, THE Lambda SHALL forward that object as the HTTP 200 response body.
6. IF the Model output cannot be parsed as a valid `IdentifyResponse`, OR the Bedrock call fails, times out, or is unavailable, THEN THE Lambda SHALL return HTTP 200 with the graceful error object `{ "species": "", "confident": false, "facts": ["", "", ""], "clarify_prompt": "Sorry, something went wrong. Please try again." }`.
7. IF a guest submits a file that is not a JPEG or PNG, or exceeds 10 MB, THEN THE App SHALL reject the submission with a visible error message and SHALL preserve the current age-mode and view state.

---

### Requirement 2: Age-Mode Fact Tone

**User Story:** As a guest (or parent), I want to select a Kids or Adult reading level, so that
the facts are appropriate and engaging for the person holding the phone.

#### Acceptance Criteria

1. WHEN a guest selects Kids Mode and submits a photo, THE Lambda SHALL instruct the Model to keep each fact at 24 words or fewer and to use vocabulary suitable for children aged 6–12.
2. WHEN a guest selects Adult Mode and submits a photo, THE Lambda SHALL instruct the Model to keep each fact at 39 words or fewer and MAY permit scientific or naturalist terminology.
3. THE App SHALL default to Kids Mode on first load.
4. WHEN a guest toggles the age-mode control, THE App SHALL apply the newly selected mode to the next submission without requiring a page reload.

---

### Requirement 3: Low-Confidence Handling

**User Story:** As a guest, I want the app to be honest when it cannot identify an animal, so that
I am not misled by a confident-sounding wrong answer.

#### Acceptance Criteria

1. WHEN the Model's identification confidence is below 0.70, THE Lambda SHALL set `confident` to `false` in `IdentifyResponse`.
2. WHEN the Model's identification confidence is at or above 0.70, THE Lambda SHALL set `confident` to `true` in `IdentifyResponse`.
3. WHEN `confident` is `false`, THE Lambda SHALL populate `clarify_prompt` with a non-empty string of at most 200 characters that asks the guest to describe what they see, and SHALL set `facts` to `["", "", ""]` and `species` to `""`.
4. WHEN `confident` is `true`, THE Lambda SHALL set `clarify_prompt` to `null` in `IdentifyResponse`.
5. WHEN the App receives an `IdentifyResponse` with `confident` equal to `false`, THE App SHALL display the `clarify_prompt` string prominently and SHALL NOT display the facts area.

---

### Requirement 4: Frontend Single-Page Layout

**User Story:** As a guest, I want a clean, mobile-first interface with a photo button, age-mode
toggle, and response area, so that the experience feels native to a wildlife park setting.

#### Acceptance Criteria

1. THE App SHALL render all primary controls (photo upload/camera button, Kids/Adult toggle, response area) on a single page such that no navigation to another route or full page reload occurs during a complete identify-and-view cycle.
2. THE App SHALL apply a single documented green and earth-tone colour palette (primary greens, browns, and warm neutrals) consistently across all primary controls and the response area, with no colours outside the documented palette used for these elements.
3. THE App SHALL use a mobile-first responsive layout that, at viewport widths from 320 px to 1024 px and above, presents all primary controls without horizontal scrolling, without overlapping or clipped controls, and with every primary control visible and tappable.
4. WHILE a submitted photo is being processed (from submission until an `IdentifyResponse` or an error is received), THE App SHALL display a visible loading indicator and SHALL keep the submit button disabled.
5. WHEN the App receives an `IdentifyResponse` or a processing error for a submitted photo, THE App SHALL remove the loading indicator and re-enable the submit button.
6. WHEN a photo upload or camera-capture action is triggered on a device that exposes a native file picker or camera interface, THE App SHALL present that native interface; IF the device exposes no such interface, THEN THE App SHALL present the standard file-selection control without displaying an error.

---

### Requirement 5: Backend Architecture

**User Story:** As a developer, I want a minimal, stateless backend, so that there is nothing to
manage, scale, or secure beyond a single function and its IAM role.

#### Acceptance Criteria

1. THE Backend SHALL consist of exactly one API Gateway HTTP API route and exactly one Lambda function; no additional Lambda functions, Step Functions, queues, or databases SHALL be deployed.
2. WHEN the Lambda handles a request, THE Lambda SHALL invoke Bedrock using the `bedrock:InvokeModel` action and SHALL parse the Model response in accordance with the JSON contract and defensive-parsing rules in Requirement 8 before returning it to the caller.
3. THE Lambda SHALL NOT write guest data to any persistent store, disk, or external service that outlives the invocation, and SHALL NOT depend on state retained from any prior invocation; each invocation SHALL produce its response solely from the current request payload.
4. IF the Bedrock `InvokeModel` call fails, times out, or is throttled, THEN THE Lambda SHALL return HTTP 200 with the graceful error object defined in Requirement 1, Acceptance Criterion 6, and SHALL NOT retain any request data after returning.

---

### Requirement 6: IAM Least Privilege

**User Story:** As a security-conscious operator, I want the Lambda execution role to grant only
the permissions it needs, so that a compromised function cannot access unintended AWS resources.

#### Acceptance Criteria

1. THE Lambda execution role SHALL grant exactly one Bedrock action, `bedrock:InvokeModel`, and SHALL scope its resource to the specific Model ARN only.
2. THE Lambda execution role SHALL grant exactly the three logging actions `logs:CreateLogGroup`, `logs:CreateLogStream`, and `logs:PutLogEvents`, and SHALL scope their resource to the Lambda's own CloudWatch log group ARN and the log streams beneath it, and to no other log group.
3. THE Lambda execution role SHALL grant no permissions other than the actions enumerated in Acceptance Criteria 1 and 2; it SHALL NOT grant any action for any other AWS service (for example, S3, DynamoDB, or Secrets Manager).
4. THE Lambda execution role SHALL NOT include a wildcard action (`*`) in any policy statement, and SHALL NOT include a wildcard or account-wide resource ARN for the `bedrock:InvokeModel` action.

---

### Requirement 7: CORS Configuration

**User Story:** As a frontend developer, I want CORS headers set correctly on the API, so that
the browser can call the endpoint from both local dev and the deployed origin.

#### Acceptance Criteria

1. THE API Gateway route SHALL include an `Access-Control-Allow-Origin` header that permits requests from `http://localhost:3000` (local dev) and `*` (prototype deployment).
2. THE API Gateway route SHALL accept `Content-Type` and `X-Requested-With` request headers.
3. THE API Gateway route SHALL respond to `OPTIONS` preflight requests with HTTP 204 and the appropriate CORS headers.

---

### Requirement 8: Structured JSON Contract and Defensive Parsing

**User Story:** As a developer, I want the Lambda to always return predictable JSON, so that the
frontend never receives an unstructured or unparseable response.

#### Acceptance Criteria

1. THE Lambda SHALL instruct the Model via its system prompt to reply with a JSON object matching exactly `{ "species": string, "confident": boolean, "facts": string[3], "clarify_prompt": string|null }` and no other top-level keys.
2. WHEN the Model response body contains valid JSON matching `IdentifyResponse`, THE Lambda SHALL return it as HTTP 200 with `Content-Type: application/json`.
3. IF the Model response body does not contain parseable JSON, THEN THE Lambda SHALL return HTTP 200 with the graceful error object defined in Requirement 1, Acceptance Criterion 6.
4. IF the Model response body contains JSON that is missing required fields, THEN THE Lambda SHALL fill missing fields with safe defaults (`""` for strings, `false` for booleans, `["","",""]` for the facts array, `null` for `clarify_prompt`) before returning.

---

### P1 — Stretch (implement only after all P0 requirements are met; must NOT add a database, a second Lambda, or authentication)

---

### Requirement 9: Wild Passport — Session Species Collection

**User Story:** As a guest, I want to collect the animals I identify into a passport during my
visit, so that I feel a sense of discovery and accomplishment.

#### Acceptance Criteria

1. WHEN an `IdentifyResponse` with `confident` equal to `true` is received, THE App SHALL add the identified species to the Wild Passport stored in `sessionStorage`.
2. THE App SHALL render the Wild Passport as a scrollable list or grid of species cards, each showing the species name.
3. WHEN the Wild Passport contains 3 distinct species, THE App SHALL display badge text "Explorer".
4. WHEN the Wild Passport contains 5 distinct species, THE App SHALL display badge text "Ranger".
5. WHEN the Wild Passport contains 10 distinct species, THE App SHALL display badge text "Wild Guardian".
6. THE App SHALL NOT send Wild Passport data to the Backend or any external service.
7. WHEN the browser session ends (tab or window closed), THE Wild Passport SHALL be cleared automatically as a consequence of `sessionStorage` behaviour.
8. THE App SHALL NOT add duplicate species entries when the same species is identified more than once in a session.

---

### Requirement 10: GBIF Distribution Map with Time-Slider

**User Story:** As a curious guest, I want to see on a map where in the world the identified
animal has been recorded, and step through decades of data, so that I understand its range.

#### Acceptance Criteria

1. WHEN an `IdentifyResponse` with `confident` equal to `true` is received, THE App SHALL fetch occurrence records from the GBIF API using the species name as the `scientificName` query parameter.
2. THE App SHALL call `https://api.gbif.org/v1/occurrence/search` directly from the browser; no backend change or proxy SHALL be required.
3. THE App SHALL render occurrence points on an embedded map using the latitude and longitude from GBIF response records.
4. THE App SHALL display a decade time-slider allowing guests to filter occurrence records by decade from 1900 to the current decade.
5. WHEN the GBIF API call takes longer than 5 seconds or returns an HTTP error, THE App SHALL display a graceful message ("Distribution data unavailable") without blocking the facts view.
6. WHEN the GBIF API returns zero occurrence records for a species, THE App SHALL display the message "No recorded sightings found for this species" instead of an empty map.

---

### Requirement 11: Ask-Ah-Meng Follow-Up Chat

**User Story:** As a curious guest, I want to ask follow-up questions about the animal I just
identified, so that I can explore topics beyond the three preset facts.

#### Acceptance Criteria

1. THE App SHALL display an Ah Meng Chat input box after a confident identification is shown.
2. WHEN a guest submits a question in the Ah Meng Chat box, THE App SHALL send a request to the same Backend route with body `{ "mode": "chat", "question": string, "context": { "species": string, "facts": string[] } }`.
3. WHEN the Lambda receives a request with `"mode": "chat"`, THE Lambda SHALL branch away from the identification path and compose a Bedrock text prompt using the provided question and context.
4. WHEN the Lambda processes a chat request, THE Lambda SHALL return `{ "answer": string }` as the HTTP 200 response body.
5. THE Lambda SHALL handle both `"mode": "identify"` (photo) and `"mode": "chat"` requests within the same function; no second Lambda SHALL be created.
6. IF the Lambda receives a request body with an unrecognised `mode` value, THEN THE Lambda SHALL return HTTP 400 with `{ "error": "Unsupported mode" }`.

---

### P2 — Nice-to-Have (cut freely; do not implement until P0 and P1 are complete)

---

### Requirement 12: Bounding-Box Animal Overlay

**User Story:** As a guest, I want to see a box drawn around the animal in my photo, so that it
is clear which subject the app identified.

#### Acceptance Criteria

1. WHEN the Lambda processes a photo identification, THE Lambda SHALL request the Model to return an optional `bbox` field `[x, y, w, h]` using normalised 0–1 coordinates relative to the image dimensions.
2. WHEN the Model returns a `bbox` array with four numeric values each between 0 and 1, THE App SHALL draw the bounding box as an overlay on the displayed photo.
3. IF the Model does not return a `bbox` field or any value is outside 0–1, THEN THE App SHALL not draw any bounding box and SHALL NOT display an error to the guest.

---

### Requirement 13: Exhibit QR Deep-Link

**User Story:** As a park operator, I want to print QR codes at each exhibit that deep-link to
the facts view for that species, so that guests without a camera can still engage with the app.

#### Acceptance Criteria

1. WHEN the App loads with a `?species=<name>` URL query parameter, THE App SHALL skip the photo-upload step and immediately request facts for the named species from the Backend without an image payload.
2. WHEN a deep-link species request reaches the Lambda with no image, THE Lambda SHALL treat the species name as ground truth and set `confident` to `true` in `IdentifyResponse`.
3. WHEN a deep-link loads, THE App SHALL display the facts view and the GBIF distribution map (if P1 is implemented) for the specified species.

---

### Requirement 14: Language Toggle

**User Story:** As a multilingual guest, I want to switch the response language between English
and one additional language, so that visitors who prefer another language can enjoy the experience.

#### Acceptance Criteria

1. THE App SHALL display a language selector offering at least two language options: English and one additional language (e.g., Mandarin Chinese).
2. WHEN a guest selects a non-English language and submits a photo, THE Lambda SHALL include a language instruction in the Bedrock prompt directing the Model to produce the species name, facts, and `clarify_prompt` in the selected language.
3. WHEN the guest switches language, THE App SHALL re-submit the most recent photo (if any) to refresh the displayed facts in the new language without requiring a page reload.
