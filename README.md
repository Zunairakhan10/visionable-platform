# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

## Local demo authentication

Run `npm run dev` to start the frontend. The backend starts as well when `server/.env` (or both server Supabase environment variables) is configured; without it, the frontend still starts and monitoring data stays local. Set `VISIONABLE_DEMO_ONLY=1` to explicitly run just the frontend even if server configuration is present. The browser demo sign-in does not require `.env.local` or Supabase credentials. Candidate accounts are stored in this browser's `localStorage`; each password is stored as a salted PBKDF2-SHA-256 hash, while the current role/session is kept in a separate storage entry. Clearing this site's storage removes the demo accounts and session. There is no password reset for locally stored demo accounts.

Candidate registration always creates a candidate account. Examiner sign-in is separate and uses these shared demo credentials:

- Email: `examiner.demo@example.com`
- Password: `VisionAbleDemo@123`

This is frontend-only demonstration authentication. Locally stored accounts, sessions, and browser-side role checks can be changed by the user and must not be used to protect real exams or sensitive data. The Supabase backend integration, SQL migrations, and auth helpers remain available for a future production authentication flow; backend API sync still requires its server-side Supabase configuration.

Run `npm test` for frontend service tests, `npm run lint` for linting, `npm run build` for a production build, and `npm test --prefix server` for the backend authorization tests.

## Voice and keyboard accessibility

Login and account-selection guidance uses the browser's built-in speech synthesis, with controls to repeat, pause, resume, or stop it. Voice control starts only after the user activates Start Voice Control and its app-level session stays mounted across internal VisionAble navigation, including the landing page, account selection, login/signup, and exam. Navigation commands include “Candidate login”, “Examiner login”, “Create candidate account” or “Sign up”, “Read instructions”, and “Go back”. On the login form, commands include “Email field”, “Password field”, “Sign in”, “Create account”, “Repeat instructions”, and “Go back”. Recognized phrases and resulting actions are shown in text. Say “Pause voice control” or “Stop voice control” to pause application commands; the microphone remains active in a minimal mode that accepts only “Resume voice control”/“Start voice control” or “Stop microphone”. The persistent status explicitly indicates this wake-listening mode. “Stop microphone” fully ends recognition and releases its session; voice cannot restart it afterward, so use the labeled Start/Restart Voice Control button with keyboard or screen reader. Voice control also suspends recognition while a password field is focused or email dictation uses the microphone, then resumes when focus leaves or dictation ends where the browser permits. Browser speech recognition may require a fresh user gesture after interruptions or when the browser ends the session, and it does not persist across full-page reloads or external navigation. Voice control is optional; use the keyboard or screen reader for every action, and use the login page's previous/next field controls as needed.

Candidate sign-in offers an optional camera face check. The camera starts only after the candidate activates Start camera; the live preview and face/no-face status are informational and never authenticate a user. The existing MediaPipe detector is reused, and camera tracks and detector resources are released when stopped or when leaving sign-in. Camera denial or detector failure does not block login.

Email dictation is optional, requires an explicit microphone-button activation, and listens for one utterance at a time. It stops active login voice control and waits for its recognizer to end before requesting email recognition. The UI distinguishes permission/startup errors, no speech, processing, and recognized text; invalid non-empty recognition is preserved in the editable email field for correction and is never submitted automatically. Login voice control can remain active across multiple commands where the browser supports it, but stops when navigating to a different page and must be explicitly started again there. It stops when a password field receives focus so app-managed recognition cannot capture password entry. The application never dictates, speaks, or displays recognized password content; keyboard input or a trusted password manager is recommended. Any operating-system input/dictation tool is separate from the application and has its own availability and privacy behavior.

Exam commands use short phrases such as “Next question” and “Select option B”; unclear or low-confidence recognition requires choosing a confirmation button. “Submit exam” only opens the existing confirmation dialog and never submits automatically. Camera status and exam outcomes are spoken where browser speech synthesis is supported.

Speech recognition and synthesis use browser capabilities; recognition support, audio handling, network requirements, and available voices vary by browser. No paid speech API or additional speech service is configured. If microphone or speech support is unavailable, keyboard, visible text, and screen-reader access remain available.

## Supabase-backed monitoring events

1. Copy `.env.example` to `.env.local` and set the Supabase project URL and public anon/publishable key. These frontend values are public; never put the service-role key in a `VITE_` variable.
2. Keep `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in the ignored `server/.env`.
3. Run `server/supabase/schema.sql` and `server/supabase/auth-roles.sql` in the Supabase SQL Editor.
4. In Supabase Auth URL Configuration, set the local site URL (for example `http://localhost:5173`) and allow that URL as a redirect for email confirmation and password recovery. Add the deployed site URL in deployment.
5. Public account creation grants candidate access only. To provision an examiner, create/invite the user through an authorized administrative workflow, then run this SQL as a Supabase project administrator, replacing the email:

   ```sql
   insert into public.user_roles (user_id, role)
   select id, 'examiner'
   from auth.users
   where email = 'examiner@example.com'
   on conflict (user_id) do update set role = excluded.role;
   ```

   The browser cannot read or change `user_roles`. The backend checks the Supabase access token and resolves the role from this table for protected API requests.

The prototype's local demo sign-in does not create a Supabase Auth session. Events recorded in that mode remain in this browser and are labeled **Local demo only**. The monitoring API is used only when a real Supabase Auth session is available; the server validates its access token and role for every protected operation. A public frontend key alone does not authorize monitoring access. Shared event records are fetched again from the backend after opening the dashboard and are not cached in local storage.

The Supabase Auth login flow is not part of the local demo authentication. Until that flow is connected, users must have a valid Supabase Auth session (and an examiner role provisioned in `user_roles`) for cross-browser dashboard access. Frontend demo role checks are prototype navigation only and are not production authorization.
