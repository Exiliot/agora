# 2026-04-18 · Forgot-password flow

User flagged: "forgot password flow does not work." Right – the API had the endpoints but the web had no route mounted at `/reset`, so the "Forgot password?" link from sign-in fell through the SPA catch-all and bounced straight back to `/sign-in`. The reset link that the server logs (no mailer in this demo) pointed at a page that didn't exist.

## Pieces that were already there

- `POST /api/auth/password-reset/request` – anti-enumeration 204 for any well-formed email.
- `POST /api/auth/password-reset/consume` – takes `{ token, password }`, rotates the password hash, and revokes every sibling session via `deleteSessionsForUserExcept(userId, null)`.
- Tokens are 32-byte random base64url; SHA-256 hash persisted; 30-minute TTL; single-use.
- A prior `process.env.NODE_ENV !== 'production'` guard around the `console.error('[AUTH reset link]', link)` meant the link never printed in the docker build (`NODE_ENV=production`), and the `req.log.debug` variant was below pino's default info level. Net effect: operator had no way to recover the link.

## What landed

- `apps/web/src/pages/reset/ResetPasswordPage.tsx`, a dual-mode modal:
  - No `?token=` → email form → `useRequestPasswordReset` → success toast ("if that email matches an account, we've sent a reset link") + a demo hint (`docker compose logs api | grep "AUTH reset link"`).
  - With `?token=…` → new-password + confirm form → `useConsumePasswordReset` → `navigate('/sign-in', { replace: true, state: { flash: 'Password updated. Sign in with the new one.' } })`. On `invalid_token`, shows "this reset link is invalid or has expired – request a new one".
- `useRequestPasswordReset` / `useConsumePasswordReset` feature hooks.
- `SignInPage` reads `location.state.flash` and renders it as a success toast (suppressed if an error toast is already visible).
- Route: `<Route path="/reset" element={<ResetPasswordPage />} />` under `AuthLayout`.
- Dropped the env-guard in `auth/routes.ts` so the reset link is always logged to stderr with the `[AUTH reset link]` tag and also to pino at `info`. The comment above the log notes that in a real deployment with a mailer wired up the link should NOT be logged – agora ships as a demo with no mail service, so the operator's only option is the log.

## UAT

Registered → requested reset → found the link in `docker compose logs api | grep AUTH` → consumed it with a new password → got redirected to `/sign-in` with the success flash → signed in with the new password. Old sessions in other tabs were invalidated (401 on the next `/api/auth/me`), which is the deliberate side-effect of `deleteSessionsForUserExcept`.

## Takeaways

- An `NODE_ENV !== 'production'` guard around operator diagnostics in a Dockerised demo build is an anti-pattern: `NODE_ENV=production` is exactly the mode the user runs in. The guard made the feature unusable without anyone realising. If it needs a guard at all, it should be an explicit env var like `AGORA_DEMO_MODE=1`.
- pino's default level swallowed debug-level lines; `info` is the baseline if you want the operator to see it.
- React Router's `state` is the right channel for the "password updated" flash – avoids a query-param that would live in the history and browser's URL bar.
