# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

## Vercel deployment

The frontend is the Vite static build (`dist/`). The same Vercel project serves the Express API through the Node.js function at [`api/[...path].js`](./api/[...path].js), so the default `VITE_API_BASE_URL=/api` keeps browser requests same-origin. `vercel.json` sets the frontend install/build/output commands and separately installs the backend's locked dependencies. Use Node.js 22.x.

### Vercel project settings

Import the repository and set:

- **Root Directory:** repository root (`.`)
- **Framework Preset:** Vite
- **Install Command:** `npm ci && npm ci --prefix server`
- **Build Command:** `npm run build`
- **Output Directory:** `dist`
- **Node.js Version:** 22.x
- **Functions region:** choose the region nearest the primary users and Blob store

These values are also in [`vercel.json`](./vercel.json). Leave `VITE_API_BASE_URL` at `/api` for this single-project setup. If the frontend and API are hosted on different origins, build with the API's HTTPS base URL and set the backend's `CORS_ALLOWED_ORIGINS` to the exact frontend origins (comma-separated).

### Environment variables

Add variables in **Project → Settings → Environment Variables**, choosing the applicable Production, Preview, and Development targets. Do not add secret values to source control or any `VITE_` variable.

Required for the demo flow:

- `DEMO_EXAMINER_EMAIL`: dedicated examiner demo account email
- `DEMO_EXAMINER_PASSWORD`: strong examiner demo password
- `DEMO_SESSION_SECRET`: random secret of at least 32 characters; keep stable across deployments so signed sessions remain verifiable
- `VITE_API_BASE_URL`: `/api` for this deployment (the frontend also defaults to this value)

Required durable storage:

- Create a **Private** Vercel Blob store under **Storage → Create Storage → Blob**, connect it to this Vercel project, and enable the target environments. The SDK uses the connected store's Vercel OIDC credentials (`BLOB_STORE_ID` and `VERCEL_OIDC_TOKEN`) automatically. If connecting the store is not available, configure its server-only `BLOB_READ_WRITE_TOKEN` instead; never prefix it with `VITE_`.

Optional:

- `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`: public Supabase project URL and anon/publishable key, only when frontend Supabase Auth is used
- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`: server-only Supabase project URL and service-role key, required for API validation of Supabase access tokens
- `CORS_ALLOWED_ORIGINS`: comma-separated exact frontend origins when the frontend is on another host; same-origin requests do not require a production entry

For Supabase role lookup, run [`server/supabase/auth-roles.sql`](./server/supabase/auth-roles.sql) in the Supabase SQL editor and provision examiner rows in `public.user_roles` from a trusted server/admin process. Never grant examiner role from browser-controlled metadata. The API's Supabase authentication path is retained; monitoring events use Blob storage in this Vercel setup.

### Storage model and limits

Vercel Functions do not use the local JSON files. In Vercel runtime, demo accounts and monitoring events use a **private, record-per-object** Blob layout: one account object keyed by a SHA-256 digest of normalized email, and one event object keyed by event UUID. Reviews update just that event object with an ETag precondition; filtering and listing never delete records. Local development and tests retain the existing serialized JSON-file stores under ignored `server/data/`.

This is durable demo storage, not a transactional database: listing reads each record and is intended for small demo volumes. Blob object creation prevents duplicate account/event keys; candidate identifiers are human-readable demo IDs and are not a production identity system. Set retention/cleanup policy and use a database with transactional indexing before real examinations or sensitive production workloads. Existing local JSON records are not automatically migrated to Blob.

### Manual verification after configuration

Before opening access to users, deploy a Preview build and verify `/api/health`, candidate registration/sign-in, examiner sign-in and review, and a full exam event round trip. Check the Blob store is **Private**, all function environments are connected, the secret variables are present in each environment, and the browser bundle contains no server-only values.

## Local demo authentication

Run `npm run dev` to start the Express backend and Vite frontend. Set `VISIONABLE_DEMO_ONLY=1` to run only the frontend. Local demo candidate accounts and monitoring events use backend-managed JSON files under the ignored `server/data/` directory; on Vercel, private Blob records are used instead. The browser stores only the current signed demo session. Existing browser-only candidate accounts are migrated to the backend the first time the candidate signs in successfully. There is no password reset for demo accounts.

Candidate registration always creates a candidate account. Local examiner credentials are provided by the backend's local demo defaults; use environment-specific credentials for any deployed instance.

Demo passwords are hashed on the backend, and the backend issues signed, expiring role tokens. Examiner API endpoints verify the signed role (or an existing Supabase token and server-provisioned role); candidate registration cannot create examiner access. Vercel requires explicit server-side examiner credentials and a stable signing secret. Demo authentication is for demonstration only, not production identity management.

Run `npm test` for frontend service tests, `npm run lint` for linting, `npm run build` for a production build, and `npm test --prefix server` for backend tests.

## Voice and keyboard accessibility

Login and account-selection guidance uses the browser's built-in speech synthesis, with controls to repeat, pause, resume, or stop it. Voice control starts only after the user activates Start Voice Control and its app-level session stays mounted across internal VisionAble navigation, including the landing page, account selection, login/signup, and exam. Navigation commands include “Candidate login”, “Examiner login”, “Create candidate account” or “Sign up”, “Read instructions”, and “Go back”. On the login form, commands include “Email field”, “Password field”, “Sign in”, “Create account”, “Repeat instructions”, and “Go back”. Recognized phrases and resulting actions are shown in text. Say “Pause voice control” or “Stop voice control” to pause application commands; the microphone remains active in a minimal mode that accepts only “Resume voice control”/“Start voice control” or “Stop microphone”. The persistent status explicitly indicates this wake-listening mode. “Stop microphone” fully ends recognition and releases its session; voice cannot restart it afterward, so use the labeled Start/Restart Voice Control button with keyboard or screen reader. Voice control also suspends recognition while a password field is focused or email dictation uses the microphone, then resumes when focus leaves or dictation ends where the browser permits. Browser speech recognition may require a fresh user gesture after interruptions or when the browser ends the session, and it does not persist across full-page reloads or external navigation. Voice control is optional; use the keyboard or screen reader for every action, and use the login page's previous/next field controls as needed.

Candidate sign-in offers an optional camera face check. The camera starts only after the candidate activates Start camera; the live preview and face/no-face status are informational and never authenticate a user. The existing MediaPipe detector is reused, and camera tracks and detector resources are released when stopped or when leaving sign-in. Camera denial or detector failure does not block login.

Email dictation is optional, requires an explicit microphone-button activation, and listens for one utterance at a time. It stops active login voice control and waits for its recognizer to end before requesting email recognition. The UI distinguishes permission/startup errors, no speech, processing, and recognized text; invalid non-empty recognition is preserved in the editable email field for correction and is never submitted automatically. Login voice control can remain active across multiple commands where the browser supports it, but stops when navigating to a different page and must be explicitly started again there. It stops when a password field receives focus so app-managed recognition cannot capture password entry. The application never dictates, speaks, or displays recognized password content; keyboard input or a trusted password manager is recommended. Any operating-system input/dictation tool is separate from the application and has its own availability and privacy behavior.

Exam commands use short phrases such as “Next question” and “Select option B”; unclear or low-confidence recognition requires choosing a confirmation button. “Submit exam” only opens the existing confirmation dialog and never submits automatically. Camera status and exam outcomes are spoken where browser speech synthesis is supported.

Speech recognition and synthesis use browser capabilities; recognition support, audio handling, network requirements, and available voices vary by browser. No paid speech API or additional speech service is configured. If microphone or speech support is unavailable, keyboard, visible text, and screen-reader access remain available.

## Demo monitoring event storage

Candidate exam events are sent to `POST /api/monitoring-events`; the examiner dashboard lists events from `GET /api/monitoring-events` and saves notes/statuses through `PATCH /api/monitoring-events/:id/review`. All three endpoints require a valid candidate or examiner role. Events carry an exam-session UUID and the dashboard defaults to the latest session; choosing an earlier session only filters the displayed data and never deletes server records. For demo sessions, the backend verifies its own signed tokens; existing Supabase access-token authentication and server-assigned roles remain supported.

The backend serializes local JSON-file updates and replaces files atomically. Missing files start empty; malformed or unsupported files are reported and are not overwritten. Event records are stored in `server/data/monitoring-events.json`; backend demo accounts are stored separately in `server/data/demo-users.json`. On Vercel these stores are private Blob objects and the dashboard refreshes shared events periodically; the browser does not store monitoring events.

**Both local JSON and Vercel Blob modes are demo storage, not production-grade examination records.** Local files are intended for one backend process. Blob records are private and durable but lack the transactional querying, retention, and operational controls needed for real examinations or sensitive production data. Supabase Auth credentials and existing Supabase token/role validation remain separate; Supabase is not used as the monitoring-event database.
