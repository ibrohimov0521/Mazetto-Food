# Production checkpoint - 2026-10-06

This checkpoint records the current Mazetto Food production and Windows Desktop
release state. Older audit records are historical and may describe older builds.

## Deployed and verified

- PRs [#223](https://github.com/ibrohimov0521/Mazetto-Food/pull/223) and #224
  added customer-web Uzbek/Russian localization and route-validator fixes.
  PRs #225 and #226 improved BestTeam dashboard text contrast. Production was
  at `fce924d1e5a3162f847e6db6059c069cb3c80248` before the current release.
- PR [#227](https://github.com/ibrohimov0521/Mazetto-Food/pull/227) adds
  backend request references for HTTP 5xx errors in Desktop login and device
  heartbeat flows. Authentication 401 messages are intentionally unchanged.
- PR #227 CI passed (run #661). Desktop Release run
  [37489750845](https://github.com/ibrohimov0521/Mazetto-Food/actions/runs/37489750845)
  built and published Windows Desktop 0.1.97, including the versioned installer,
  latest installer, blockmap and updater metadata.
- Main commit
  `88340b86eedc71c47ac3da23dab317e4329b2d13` passed CI and production Deploy
  [37490302852](https://github.com/ibrohimov0521/Mazetto-Food/actions/runs/37490302852).
  The release gate found no backend, web, bot, print-agent or media service
  changes; production smoke was skipped because no service runtime changed.
  The production tag now points to this commit.
- The earlier customer-web browser checks covered home, menu, cart, checkout,
  orders and profile in Uzbek and Russian at 390px and 1440px (24 combinations).
  They do not validate authenticated checkout or POS mutations.
- Read-only migration checks on production and staging reported 58/58 migrations
  applied and none pending. This is not a database restore or rollback rehearsal.
- Recent backend and POS log scans did not reproduce the reported 500 or invalid
  credential errors. Absence from the scan does not prove those flows are fixed.
- The production BestTeam monitor recently reported the configured Mazetto Food
  tenant healthy. This does not validate a non-superadmin login.

## Remaining acceptance and implementation

- A reported non-superadmin Desktop login still returns `Invalid credentials`.
  The same response intentionally covers a wrong password, inactive account, or
  missing/invalid tenant membership. Read-only aggregate checks found no general
  membership-to-employee gaps, but the specific account and its password were not
  verified or changed.
- The previously reported checkout and POS internal errors remain unreproduced.
  Capture their request references and correlate sanitized backend logs while
  testing with a non-superadmin account.
- The customer Telegram bot sidecar was observed without its expected token and
  webhook secret, while the backend has those settings; the sidecar reports a
  degraded/missing-token state. The staff bot sidecar is healthy. Do not copy
  credentials between services until the owner explicitly approves that access.
- BestTeam background/logo contrast and crop still need owner visual acceptance
  on mobile and desktop; deployed contrast changes do not substitute for review
  against the supplied artwork.
- Desktop offline queue coverage is substantial, but end-to-end operation still
  needs acceptance on the restaurant's Windows terminals. Verify disconnect,
  reconnect, queue recovery and physical 58/80 mm printer routing. Customer web
  checkout remains online-only.
- Click/Payme/card payment initiation, signed callbacks, reconciliation and
  provider refunds remain disabled pending merchant configuration and tests.
  Partial-item refund rules are undecided.
- Tenant-scoped PostgreSQL outbox worker is deployed with leases, ordering guards,
  retry/backoff and dead-letter handling; its automated tests passed. Live order
  acceptance and per-restaurant bot/webhook configuration remain open.
- Keep second-restaurant activation disabled until trusted host identity,
  membership and A/B isolation across APIs, jobs, media, realtime, bots and
  reports pass staging tests. Monitoring and DNS TXT ownership alone do not
  complete tenant provisioning.
- Database restore/rollback rehearsal, operational alert routing and courier
  proof-of-delivery policy remain open.

## Human gates, in order

1. Validate a real non-superadmin account and reproduce the login, OTP, checkout
   and POS flows. Do not send passwords in chat; use a temporary test account or
   a secure operator-assisted reset.
2. Explicitly approve or decline giving the customer Telegram bot sidecar access
   to the backend's existing bot token and webhook secret.
3. Approve the BestTeam and customer-web visuals on mobile and desktop.
4. Test offline recovery and physical printer output on the restaurant devices.
5. Approve a controlled live order and staff Telegram lifecycle test before any
   customer or staff notifications are sent.
6. Provide merchant configuration and refund business rules only if online
   payments and refunds are required.
7. Keep the second tenant inactive until staging A/B isolation and backup/restore
   evidence is recorded.
