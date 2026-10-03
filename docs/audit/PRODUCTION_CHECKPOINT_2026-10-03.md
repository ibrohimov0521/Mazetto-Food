# Production checkpoint — 2026-10-03

This is the current live-release checkpoint. Older audit and acceptance records
below remain historical evidence; they are not statements about today's
production state.

## Deployed and verified

- Production is on `main` commit `c0047f80b32178671dea9ee11fddced03e3bc03e`.
  Deploy workflow run [#249](https://github.com/ibrohimov0521/Mazetto-Food/actions/runs/37137394204)
  completed successfully.
- The read-only production release smoke passed **27/27**. It checks API and
  database health, public menu/settings, unauthenticated access controls,
  customer routes on the root and `www` hostnames, checkout auth URL, POS
  health/login/admin routes, owner-console login, media health, and every
  returned customer-catalog image URL. It creates no order and changes no data.
- Browser inspection confirmed the customer home and menu render product data.
  The POS dashboard route correctly resolves to staff login when no session is
  present; no staff credentials were entered during this check.
- The published Windows Desktop release is **0.1.96**
  ([release](https://github.com/ibrohimov0521/Mazetto-Food/releases/tag/desktop-v0.1.96)).
  Its login UI has an app-managed “Shu qurilmada login va parolni eslab qolish”
  option backed by Windows protected storage. This is not Chrome's built-in
  password-manager prompt. The user's installed version and remembered-login
  flow have not been verified on the restaurant computer.
- Customer and staff Telegram service health was read-only checked earlier in
  this release cycle. That does not replace a real customer conversation or a
  staff-group order lifecycle test.

## Still requires acceptance

1. Sign in with a real non-superadmin employee on the production POS, verify
   branch and role permissions, then confirm the Desktop remembers and restores
   that account after a restart. Do not use or record a user's password in CI.
2. Rehearse Desktop/POS and kitchen operation with internet disconnected,
   reconnect, and reconcile queued work on the restaurant's actual Windows
   devices. The product does not promise that every screen or operation works
   offline.
3. Print sale, kitchen, cancellation and reprint documents on the actual 58/80
   mm printer(s), including a failed-connection and recovery test. Virtual
   ESC/POS tests are not physical evidence.
4. Complete human acceptance for customer Telegram verification/order and the
   staff-group lifecycle. Automated read-only bot health is not an order test.
5. Review the full customer journey visually on mobile and desktop with the
   restaurant owner, including authentic images, menu/cart, authentication,
   delivery/pickup, and order status. The present smoke is not a visual sign-off.
6. Keep Click/Payme/card payment initiation and provider refunds disabled until
   merchant credentials, signed callbacks, reconciliation and refund behavior
   are explicitly configured and tested.

## Verification limits in this checkpoint

- No production order, payment, staff mutation, migration or webhook change was
  made.
- The production smoke is a read-only HTTP check, not authenticated business
  acceptance.
- A full local monorepo test run was not repeated on the production host,
  to avoid running CPU- and memory-heavy builds beside live services. The
  non-interactive SSH PATH selects Node 22.22.1/Corepack 0.24.0, which fails
  before pnpm starts. The installed NVM toolchain works when explicitly loaded:
  `source /home/javohir/.nvm/nvm.sh && nvm use 22.23.2` (Node 22.23.2,
  Corepack 0.34.6). Full package verification should run in GitHub CI; the
  deployed application commit had a green CI run.
- A separate customer monitoring agent still lacks its own bot credentials.
  Those secrets must not be copied from another service without the owner's
  explicit approval; the primary customer webhook is a distinct, healthy path.

## Next implementation order

1. Repair the isolated server-side Node/package-manager toolchain and run the
   repository's documented verification suite against this exact `main`
   commit.
2. Reconcile production login errors using request IDs and sanitized server
   traces; validate the real staff account only with the owner/operator present.
3. Run browser visual and role-matrix acceptance, then fix only reproduced
   defects without changing MAZETTO FOOD branding.
4. Finish the restaurant-device offline and physical-printer acceptance.
5. Record each human gate and only then make a release-readiness decision.

Do not describe the system as “100% offline” or fully accepted until these
external checks have evidence.
