# Audit remediation implementation progress

Last local checkpoint: 2026-09-23 Asia/Tashkent.

## Continuation checkpoint: 2026-09-23

The following release-candidate changes are on branch
`fix/release-readiness-batch` and are not deployed to production yet:

- Admin permanent and bulk deletion was added for products, categories,
  orders, receipts, staff, devices, printers, suppliers, customers,
  ingredients, warehouses, roles, expense categories, branches, modifiers,
  homepage slides/promotions, halls and tables.
- Destructive actions are guarded by permission, branch scope and historical
  references. Financial/order history is not deleted when doing so would break
  audit or ledger integrity; the API rejects those records explicitly.
- Single-row delete actions now use the same permanent-delete contract as the
  corresponding bulk action where both archive and delete are offered.
- Receipts now expose the same guarded permanent-delete action for one row as
  for multi-selection; an open receipt detail is closed after deletion.
- The destructive-action audit is now explicit: operational master data has
  guarded single-row and multi-row permanent deletion where references allow
  it; audit events, payments, expense records, shifts and reports remain
  immutable, while reversible business data keeps archive/restore controls.
- Hall/table administration follows the same rule: empty halls/tables can be
  permanently removed, but tables with order history are rejected rather than
  corrupting historical orders.
- Current commits in the release branch include `5052c68`, `13fcad1`,
  `401a1a8`, `a52a34a`, `d189511`, `30b797c`, `0005229`, `359c1e7`, `4cfecc1` and
  `684349e`, `f50d47b` and `a39ef30` (plus their preceding remediation commits).

Verification after this checkpoint:

- Backend tests: 240/240 passed.
- Backend and POS/Admin typechecks passed.
- Telegram typecheck passed.
- Read-only release smoke: 22/22 passed.
- Media validation: 74 available product assets, 0 unresolved available
  product assets, 10 category assets.
- Production PostgreSQL backup was restored into an isolated container and all
  40 migrations were rehearsed there; production was not modified.

Still open before the final release: authenticated human Telegram/staff-group
acceptance, physical Godex/ESC-POS printer acceptance, real Desktop offline
and updater regression, customer media/browser visual acceptance, PR merge to
protected `main`, Dokploy deployment, and post-deploy smoke. The branch has
been pushed, but no PR or production deployment is claimed by this checkpoint.

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
- Telegram diagnostic commands now terminate before customer authentication on
  the customer webhook, and staff diagnostics reply with the token belonging
  to the webhook that received the update. Legacy quick-add callbacks cannot
  add hidden/legacy products back into a customer cart.
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
31/31 validators, 240 backend tests, 40 Desktop tests and the disposable
40-migration E2E. A `pg@8` deprecation warning can still be emitted by Prisma's
interactive transaction adapter during the deliberate concurrent-idempotency
exercise; the assertions and cleanup pass, and this dependency warning is not
recorded as production certification.

Customer browser QA was also run in installed Chrome at 375, 390, 430, 768,
1024, 1366 and 1440 px. It found no horizontal overflow, sub-11px text or page
runtime error. The text-only brand fallback was raised above AA contrast. Full
product/hero media inspection is still pending because this checkout does not
contain the generated public media and its local API content was unavailable.

## Remaining release gates

1. `AUD-101`: the current production backup was obtained from the PostgreSQL
   Docker service, restored to isolation, checked with `pg_restore --list`, and
   all 40 migrations were rehearsed against the restored copy. Production
   migration/deploy is still gated on PR merge and the final rollback record.
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

Latest local acceptance: `pnpm release:acceptance` passed all workspace
verification, automated tests, 40-migration disposable E2E, and cleanup. It
did not run production smoke or deploy; those remain intentionally gated on
physical printer/live Telegram evidence and protected-main release flow.

The read-only smoke suite was also rerun locally after that acceptance:
`pnpm release:smoke` passed `22/22`, including backend/database, customer-web,
POS/admin, protected operational routes and media health. This is local smoke
evidence, not a claim that the protected production deployment has occurred.
