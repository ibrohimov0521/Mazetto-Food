# Audit remediation implementation progress

Last local checkpoint: 2026-09-21 13:05 Asia/Tashkent.

This file tracks implementation before the requested final combined push and
deploy. Changes below are intentionally local until the whole release batch is
ready and its database rollout has been rehearsed.

## Implemented and automated-test verified locally

- `AUD-110`: receipts now have `documentType`; uniqueness is
  `(orderId, documentType)`, allowing one sale and one cancellation document.
- `AUD-111`: Desktop discovers active ONLINE printers with usable host metadata
  and claims only their jobs. Unassigned jobs are claimed only when a fallback
  printer is configured.
- `AUD-112`: Printers is visible in the `Kassa va hisobot` sidebar group and the
  navigation validator covers it.
- `AUD-113`: audited `DELETE /printers/:id` performs history-preserving
  deactivation and the Admin action uses it.
- `AUD-118`: ESC/POS rendering uses the immutable receipt content snapshot;
  legacy rows retain a compatibility fallback.
- `AUD-119`: a receipt becomes printed only after all of its non-cancelled jobs
  are printed; reprint resets the aggregate print flag.
- `AUD-120`: all kitchen offline actions match backend PATCH routes.
- `AUD-121`: item cancellation and cash-transfer accept/reject have exact typed
  offline command definitions and regression tests.
- `AUD-123`: the Desktop device credential is encrypted with Electron
  `safeStorage` (Windows DPAPI) instead of being stored as plaintext in SQLite.
- Device hardening portion of `AUD-122`: enrollment issues a random 256-bit
  device secret, only its hash is stored server-side, official Gateway and print
  worker send it, and the backend uses constant-time verification.

## Added database changes

- `20260921020000_receipt_documents`
- `20260921023000_device_credentials`

These migrations have not been applied to production. Existing enrolled Desktop
devices need a coordinated one-time re-enrollment after the credential migration.

## Verification completed

- Backend typecheck passed.
- Backend tests: 231 passed.
- Desktop typecheck passed.
- Desktop tests: 38 passed, including command registry, virtual printer and mutation-contract tests.
- POS typecheck and lint passed.
- Workspace typecheck/lint: 12/12 Turbo tasks passed.
- Workspace production build: 6/6 Turbo tasks passed.
- Operations validators: 31/31 passed.
- `pnpm test`: backend 231/231 and Desktop 38/38 passed.
- Windows note: the combined `pnpm verify` run completed all 18 Turbo tasks,
  but its interactive Turbo cache writer did not exit after printing success;
  `pnpm validate` was therefore run separately and exited successfully.

## Second local remediation batch

- `AUD-101` partial: all 39 migrations were applied twice to an isolated clean
  PostgreSQL 18 database and historical migration checksums are now enforced by
  `pnpm validate`. A restored-production-copy rehearsal remains mandatory.
- `AUD-114`/`AUD-115`: Desktop reports/tests every managed printer; the receipt
  queue exposes errors and audited dead-letter/stale-job retry.
- `AUD-116`: Desktop is canonical; the legacy print-agent is inert unless an
  explicit opt-in environment flag is set.
- `AUD-117` automation portion: a virtual TCP ESC/POS printer proves one-time
  cancellation output, long-item bytes and cut bytes. Physical 58/80 mm testing
  is still a human release gate.
- `AUD-122`/`AUD-123`/`AUD-124`: operational roles require enrolled Desktop
  credentials, the remembered staff session is encrypted with Windows
  `safeStorage`, and a redacted support bundle can be exported.
- `AUD-125`: every backend staff mutation is classified by an AST contract test
  as queueable or explicitly online-only.
- `AUD-130` safety gate: only CASH is exposed/accepted until signed provider
  integrations exist; fake successful card/Click/Payme payments are blocked.
- `AUD-132`/`AUD-133`: ingredient and warehouse edit/archive lifecycle,
  reference/stock protection, Admin controls and branch readiness were added.
- `AUD-134` was verified as already implemented: modifiers have an explicit
  reversible active/archive lifecycle.
- `AUD-135`: bounded four-digit random identifiers were replaced with UUID
  entropy while retaining human-readable prefixes.
- `AUD-142`: media upload authorization is purpose-aware; homepage managers can
  upload only homepage assets and catalog editors only catalog assets.
- `AUD-144`: kitchen seed permissions no longer include shift/cash ownership.
- `AUD-150`: customer order polling backs off to two minutes while its scoped
  authenticated realtime socket is healthy and returns to 15 seconds offline.
- `AUD-154`: the protected system-health view includes timeout-bounded,
  credential-redacted geocoding and media dependency readiness.
- `AUD-102`: one `pnpm release:acceptance` runner now executes workspace verify
  and tests, with optional read-only production smoke, plus a human evidence
  record for backup, Telegram, Desktop and physical printing.
- `AUD-140`/`AUD-143`: authorization remains permission-first for custom roles;
  every shell route must now declare sidebar, child, workspace or hidden intent.
- `AUD-141`: browser refresh secrets are migrated out of localStorage into
  rotating HttpOnly SameSite cookies; Desktop retains OS-protected storage.
- `AUD-151`/`AUD-153`/`AUD-155`: Telegram's single webhook owner, alert owners
  and thresholds are documented and validated; system health reports print
  dead letters, stale devices and a redacted CORS configuration fingerprint.
- `AUD-131` core CASH workflow: branch managers with `PAYMENT_REFUND` can fully
  refund a successful CASH payment against an open branch shift. The operation
  is idempotent and records an immutable refund, negative revenue adjustment,
  cash drawer outflow, actor/reason audit event and dedicated refund receipt.
  Reports expose the refunded amount and exclude the reversed payment from net
  successful sales. Provider and partial-item refunds remain disabled.
- `AUD-160` staff matrix: real Chromium verifies ADMIN, BRANCH_MANAGER,
  ACCOUNTANT, CASHIER, WAITER, KITCHEN and COURIER primary routes plus denied
  admin access at 1440px and 390px. Customer visual QA remains blocked in this
  checkout because its generated media directory is absent.
- `AUD-161`: `pnpm qa:isolated-order-e2e` now creates a guarded localhost-only
  disposable database, applies all migrations, seeds catalog data, and proves
  web/Telegram order idempotency plus order-to-cash-to-stock-to-receipt-to-print
  and audit integrity before always destroying the database. The command is a
  mandatory stage of `pnpm release:acceptance`.
- `AUD-103`: this audit directory is the current release source of truth;
  historical phase notes are explicitly superseded and runtime/local/deployed
  claims remain separated.
- `AUD-162`: customer ordering is explicitly online-only. Checkout observes
  browser connectivity, disables confirmation with a visible reason while
  offline, and never stores an offline order for later ambiguous submission.
- Expense category completeness: categories are branch-scoped master data with
  create, rename and archive controls. New expenses require an active category;
  historical expense category snapshots remain immutable and audit events cover
  every category mutation.
- Database recovery tooling: `pnpm db:rehearse-restore -- <backup>` now performs
  a localhost-only disposable restore, checksum evidence, migration replay and
  second-restore rollback proof for `.dump`, `.sql` and `.sql.gz` archives.
  The runner is ready, but a current production backup is still required before
  it can satisfy the release gate.

The clean-database rehearsal applies all 39 migrations, including refund and
expense-category lifecycle schemas, and verifies five refund foreign keys. The
guarded disposable E2E passed
after migration and seed, proving web and Telegram order creation through
payment, revenue, cash movement, stock movement, receipt, print job and payment
audit. Aggregate backend, Desktop, workspace and operations suites were rerun at
this checkpoint and passed as recorded above.

The final local acceptance rerun passed 12/12 typecheck/lint tasks, 6/6 builds,
31/31 validators, 231 backend tests, 38 Desktop tests and the disposable
39-migration E2E. A `pg@8` deprecation warning can still be emitted by Prisma's
interactive transaction adapter during the deliberate concurrent-idempotency
exercise; the assertions and cleanup pass, and this dependency warning is not
recorded as production certification.

Customer browser QA was also run in installed Chrome at 375, 390, 430, 768,
1024, 1366 and 1440 px. It found no horizontal overflow, sub-11px text or page
runtime error. The text-only brand fallback was raised above AA contrast. Full
product/hero media inspection is still pending because this checkout does not
contain the generated public media and its local API content was unavailable.

## Remaining release gates

1. `AUD-101`: obtain a current production backup, restore it to isolation,
   reconcile `_prisma_migrations`, and rehearse deploy plus rollback. No
   production migration or deploy before this gate.
2. `AUD-102`, `AUD-152`, `AUD-160`: complete recorded customer media/browser
   and live Telegram staff-group acceptance. Staff role matrix and disposable
   order-to-cash-to-stock-to-print E2E are automated.
3. `AUD-117`: perform physical 58/80 mm printer acceptance when hardware exists.
4. `AUD-130` and the provider portion of `AUD-131`: signed Click/Payme/Card
   initiation, callbacks, reconciliation and provider refunds remain disabled.
   Partial item-level returns also require an allocation policy.
5. `AUD-141`: verify Secure HttpOnly cookie forwarding on deployed customer and
   staff hostnames. Route intent and permission-first metadata are automated.
6. `AUD-151`, `AUD-153`, `AUD-155`: collect production Telegram ownership,
   alert routing and expected CORS fingerprint evidence in the acceptance record.
7. `AUD-163`: courier proof-of-delivery needs a photo/signature and privacy
   retention decision before implementation; it is not a current core release
   claim.
8. Only after the blocking gates: bump Desktop version, build/publish update,
   run release smoke, then perform the single requested push/deploy.
