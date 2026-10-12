# Audit remediation implementation progress

Last updated: 2026-10-12 Asia/Tashkent. The 2026-09-23 checkpoint below is historical.

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
- Current release-branch checkpoints include `a39ef30`, `b413454`, `a613832`
  and `b4ae108` (plus their preceding remediation commits).

Verification after this checkpoint:

- Backend tests: 244/244 passed.
- Backend and POS/Admin typechecks passed.
- Telegram typecheck passed.
- Read-only production smoke: 23/23 passed against the default public
  production domains; no write operation was performed.
- Media validation: 74 available product assets, 0 unresolved available
  product assets, 10 category assets.
- Production PostgreSQL backup was restored into an isolated container and all
  40 migrations were rehearsed there; production was not modified.

Still open before the final release: authenticated human Telegram/staff-group
acceptance, physical Godex/ESC-POS printer acceptance, real Desktop offline
and updater regression, customer media/browser visual acceptance, PR merge to
protected `main`, Dokploy deployment, and post-deploy smoke. The branch has
not been pushed; no PR or production deployment is claimed by this checkpoint.

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
- Desktop update feed now honors `MAZETTO_DESKTOP_UPDATE_URL`: the built-in
  GitHub release feed remains supported, while Dokploy/admin-managed generic
  feeds use electron-updater's generic provider. Both paths have regression
  tests; installed Windows download/install still requires human acceptance.
- Cash payment refunds are available from the admin Payments page. The flow
  requires `PAYMENT_REFUND`, an open branch shift and a reason, then writes an
  immutable reversal, cash transaction, audit event and refund receipt queue
  entry. Click/Payme/Card provider refunds remain disabled until signed
  provider callbacks and reconciliation are available.
- Admin sidebar access now follows the same permission-first rule as admin
  route access, so custom roles with `ADMIN_ACCESS` and an explicit section
  permission see the section in navigation even when they are not one of the
  built-in role codes. The behavior is covered by custom-role tests.
- Custom admin login redirects now include the full admin workspace permission
  set (homepage, kitchen monitor, courier/customer management, devices,
  payments, receipts, printers, shifts, inventory and recipes). Operational
  permissions such as `TABLE_VIEW` still keep their waiter workspace priority.
- Customer-web authentication now restores and rotates refresh sessions through
  the Secure HttpOnly cookie. Legacy local refresh tokens are consumed only
  once for migration, then removed; customer localStorage keeps no refresh
  token. Production cookie/CORS/CSRF behavior still needs hosted acceptance.

## Added database changes

- `20260921020000_receipt_documents`
- `20260921023000_device_credentials`

These migrations have not been applied to production. Existing enrolled Desktop
devices need a coordinated one-time re-enrollment after the credential migration.

## Verification completed

- Backend typecheck passed.
- Backend tests: 244 passed.
- Desktop typecheck passed.
- Desktop tests: 40 passed, including command registry, virtual printer and mutation-contract tests.
- POS typecheck and lint passed.
- Workspace typecheck/lint: 12/12 Turbo tasks passed.
- Workspace production build: 6/6 Turbo tasks passed.
- Operations validators: 33/33 passed, including the admin deletion matrix.
- `pnpm test`: backend 244/244 and Desktop 43/43 passed.
- `pnpm release:acceptance`: passed end-to-end after the runner was changed to
  call each package directly instead of relying on Turbo's aggregate process on
  Windows.

## Second local remediation batch

- `AUD-101` partial: all 40 migrations were applied to an isolated clean
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
- `AUD-102`: one `pnpm release:acceptance` runner now executes package-level
  generate/typecheck/lint/build/test stages, static validators, media asset
  validation and the disposable order-to-print E2E, with optional read-only
  production smoke, plus a human evidence record for backup, Telegram, Desktop
  and physical printing.
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

The clean-database rehearsal applies all 40 migrations, including refund and
expense-category lifecycle schemas, and verifies five refund foreign keys. The
guarded disposable E2E passed
after migration and seed, proving web and Telegram order creation through
payment, revenue, cash movement, stock movement, receipt, print job and payment
audit. Aggregate backend, Desktop, workspace and operations suites were rerun at
this checkpoint and passed as recorded above.

The final local acceptance rerun passed backend, POS, customer-web,
Telegram-bot, print-agent and Desktop typecheck/lint/build stages, 33/33
validators, media validation with 0 unresolved product assets, 244 backend
tests, 43 Desktop tests and the disposable 40-migration E2E. A `pg@8`
deprecation warning can still be emitted by Prisma's
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

At the 2026-09-23 checkpoint, the then-current release acceptance passed using
40 migrations. That result is historical and is superseded by the 2026-10-12
run recorded below. The package-level runner retains TURBO_DAEMON=false to avoid
the prior Windows Turbo hang.

Historical production incident (2026-09-23 10:32 Asia/Tashkent): `pnpm release:smoke` failed 0/23 when the public Cloudflare-backed hostnames returned HTTP 530. This incident is superseded by the read-only production smoke on 2026-10-12, which passed 27/27. The later smoke verifies the currently deployed baseline only; it does not mean the uncommitted audit worktree is deployed.


## Current audit continuation: offline tender gate and verification status (2026-10-12)

- Reinspection found the Desktop gateway validated an offline POS tender as cash-only but did not check whether CASH was enabled in the cached POS catalog. That could queue a locally paid sale after a known disabled-cash snapshot, then have the server reject it on replay. Paid offline POS sales now require CASH to be explicitly active in the last cached catalog; otherwise no outbox or local print job is created.
- Deferred-payment dine-in remains allowed without an enabled tender because no payment is collected at order creation; it queues only the kitchen document. Regression coverage proves both outcomes.
- The settings UI now states that an offline terminal uses its last synchronized payment-method configuration; a remote change cannot reach it until reconnection. Existing pending actions should be synchronized before changing cashier payment settings.
- The related existing-order payment path was also found to miss the last synchronized cashier tender settings. Offline payment now requires a fresh (maximum 12-hour) `/payments/methods` snapshot containing CASH; missing, stale, malformed, or disabled snapshots fail before queuing payment or receipt output.
- Gateway tests passed 52/52 and full Desktop tests passed 174 TAP outcomes. Fresh `pnpm test`, `pnpm verify` (14 lint/typecheck tasks, 7 builds, 33 validators), and isolated `pnpm release:acceptance` all passed. Acceptance applied all 59 migrations and passed seed plus database-backed order-to-cash-to-stock-to-print E2E; its temporary volume-free PostgreSQL 18 container and loopback port were removed and verified closed. Read-only production smoke passed 27/27 against the deployed baseline.
- No push, merge, production write, migration, or deployment was performed. Physical printer and disconnected Windows terminal acceptance remain external; manual review of the remaining tracked repository is not complete.
- Code review also found the local Desktop shift-report route did not enforce shift permissions. The route now requires `SHIFT_CLOSE`, `SHIFT_VIEW_OWN`, or `SHIFT_VIEW_BRANCH`, and own-shift permissions must match the report's employee ID. Regression tests reject missing permission and another employee's report before queueing.
- After this authorization change, workspace tests, `pnpm verify` (14 lint/typecheck tasks, 7 builds, 33 validators), and isolated `pnpm release:acceptance` all passed. The disposable PostgreSQL 18 container and loopback port were removed and verified closed; production read-only smoke remains 27/27 on the deployed baseline.

## Audit continuation: cashier payment-method override and recovery (2026-10-12)

- PostgreSQL sorts NULL first for descending nullable `branchId`; four payment paths had relied on `branchId DESC` to put branch-specific methods first. An inactive branch override could therefore be dropped by the active-only query and a global method could reappear.
- Added one explicit resolver used by POS catalog, Desktop bootstrap, cashier payment-method listing, and existing-order settlement. Branch rows now win independent of query order; an inactive branch override suppresses the global method, including when a stale global method ID is submitted.
- A malformed or empty stored `cashier_payment_methods` allowlist no longer falls back to CASH. The admin control ignores unknown stored codes while editing, so a manager can repair the setting instead of getting stuck.
- Backend tests passed 674/674 plus 3 shared HTTP retry tests. POS tests passed 74/74. Backend and POS lint/typecheck passed; the admin settings browser QA passed at 1600, 768, 360, and 320 px, including Click/Payme toggles, confirmation, and recovery from an invalid stored value.
- Fresh workspace `pnpm verify` passed after the payment-method edits: 14 lint/typecheck tasks, 7 builds, and 33 validators. Full `pnpm release:acceptance` passed backend and Desktop tests, all validators, media validation, 59 migrations, seed, and database-backed order-to-cash-to-stock-to-print E2E using the explicit isolated-admin URL.
- The first acceptance attempt exposed a test-environment assumption: isolated E2E ignored `DATABASE_URL` and tried port 5432, while this server's development database is loopback port 5433. The script now uses `MAZETTO_E2E_ADMIN_DATABASE_URL`, then `DATABASE_URL`, then its safe localhost default; connection failures explain the override. After this harness edit, the isolated E2E passed again using only `DATABASE_URL`; formatting and all 33 validators passed. The test-created database was confirmed dropped each time. No production DB was used.
- The production read-only smoke remains the previously recorded 27/27 deployed-baseline result; it was not rerun for these unreleased source changes. No push, merge, production write, or deployment was performed.
- Physical printer, Windows offline/reconnect, real-account Telegram, NBU reconciliation, tenant A/B staging, application rollback, and manual review of all tracked repository files remain open.

## Audit continuation: tenant staff authentication (2026-10-12)

- Review found that a trusted active membership with no active non-platform role could still produce a successful tenant login with an empty role and permission set. Tenant membership resolution now rejects empty or platform-only role assignments.
- Added focused coverage for valid cashier membership, missing/platform-only roles, inactive tenant/user, and branch-scoped membership without a matching active employee.
- Focused tests passed 4/4; full backend tests passed 678/678 plus shared HTTP retry tests 3/3; backend typecheck and lint passed. Read-only production counts found 0 active memberships without an active restaurant role and all 3 active employee-linked user accounts matched their same-branch tenant membership. This does not verify any user's password or reproduce the reported desktop login attempt.
- No push, merge, production write, or deployment was performed. Full repository manual review and external acceptance gates remain open.

## Audit continuation: desktop login and device enrollment (2026-10-12)

- Desktop native login rejected a valid user session when the computer had not yet been enrolled. That prevented the UI from reaching the existing device-enrollment screen. It now returns the authenticated session and lets the shared post-login check route unapproved devices to enrollment; desktop API/printer access remains device-protected.
- The login page's pre-existing-session redirect runs once and remains offline-friendly; it cannot override a fresh login while that login's device-aware enrollment check is finishing.
- Added a regression contract test for session preservation and enrollment routing. Desktop tests passed 175/175; POS tests passed 74/74; desktop and POS typechecks/lint passed.
- Fresh `pnpm verify` passed (14 lint/typecheck tasks, 7 builds, 33 validators). Full `pnpm release:acceptance` passed, including backend and desktop suites, media validation, all 59 migrations, seed, and DB-backed order-to-cash-to-stock-to-print E2E on local disposable PostgreSQL. The temporary database count returned to zero.
- No push, merge, production write, migration, or deployment was performed. The workstation login still needs real-user acceptance after a desktop release; full tracked-file manual review and physical printer/provider/staging gates remain open.

### Device heartbeat redirect correction (2026-10-12)

- Follow-up review found the enrollment redirect still treated every failed heartbeat and local gateway exception as proof that a workstation was unregistered. That could misroute a valid login during a temporary network/gateway outage or for a disabled device.
- Enrollment is now triggered only by an explicit `404` from the device heartbeat while the local gateway reports `online`. The enrollment screen distinguishes an unregistered device from network, gateway, and other server failures, offers a retry for unknown status, and treats a successful enrollment as success without depending on a follow-up heartbeat.
- The focused Desktop login/enrollment regression test passed. Full `pnpm test` passed; `pnpm verify` passed all 14 lint/typecheck tasks, 7 builds, and 33 validators; isolated `pnpm release:acceptance` passed all 59 migrations, seed, and database-backed order-to-cash-to-stock-to-print E2E. The test database was confirmed dropped (count 0). No push, migration, production write, or deploy has occurred.
- Real Windows workstation login/enrollment acceptance and the broader manual repository review remain open.

## Audit continuation: order status override and paid cancellation (2026-10-12)

- Forced status changes now require `ADMIN_ACCESS` whenever they bypass terminal-order rules, skip kitchen confirmation, or omit employee identity. Normal cashier/kitchen status transitions are unchanged.
- Generic order cancellation now refuses while net collected payments remain (successful payment less recorded refunds), preventing status-only cancellation from silently leaving money unreturned. A separate provider-confirmed non-cash refund path is still not available.
- Backend tests passed 681/681 plus 3 shared HTTP retry tests. Focused order status/tenant tests passed 19/19. Full `pnpm verify` passed 14 lint/typecheck tasks, 7 builds, and 33 validators. Isolated `pnpm release:acceptance` passed migrations, seed, and DB-backed order-to-cash-to-stock-to-print E2E; its PostgreSQL container and port were removed/closed.
- No push, merge, production write, migration, or deployment was performed. Non-cash provider refunds, physical printer, Windows offline/reconnect, live Telegram, tenant A/B staging, rollback rehearsal, and full manual review remain open.

## Audit continuation: cashier balance protection (2026-10-12)

- Review of cashier cash movements found that manual EXPENSE/WITHDRAW entries could exceed the open shift's available cash. The backend now locks the shift, recomputes its ledger balance inside the transaction, and rejects an overdraw before writing the transaction.
- Desktop offline cash movements now require a fresh open-shift snapshot, include pending outbox projections in the available-balance check, and fail closed when the cached state is absent, stale, or insufficient. Regression coverage checks online overdraw, sequential offline overdraw, and stale shift cache.
- Focused Desktop gateway tests passed 52/52. Full `pnpm test` passed (backend 683/683 plus shared HTTP retry 3/3; Desktop 175/175; package and smoke suites passed). `pnpm verify` passed 14 lint/typecheck tasks, 7 builds, and 33 validators. `pnpm release:acceptance` passed after starting a separate loopback-only disposable PostgreSQL container: all 59 migrations, seed, and DB-backed order-to-cash-to-stock-to-print E2E. The temporary test database and container were removed; port 15432 is no longer in use.
- The first acceptance attempt was blocked because no test PostgreSQL was listening on the default port 5432. It did not touch production; the isolated-container retry passed. No push, merge, production write, migration, or deployment was performed.
- A follow-up tenant-scope audit found that shift closure without an idempotency key did not repeat the tenant/branch authorization inside the locked transaction. The check now runs in every close path; a regression test confirms a foreign-tenant shift is rejected before any shift or ledger write. Backend tests passed 684/684 plus shared HTTP retry 3/3, `pnpm verify` passed all 14/14 lint/typecheck tasks, 7/7 builds, and 33/33 validators, and full isolated release acceptance passed again after this fix.
- This is a targeted financial/offline audit, not a manual review of every tracked file. Full per-file review, physical printer tests, real Windows offline/reconnect, live Telegram, NBU QR/SMS reconciliation, tenant A/B staging, and rollback rehearsal remain open.

## Audit continuation: conservative dead-code review (2026-10-12)

- Repository inventory contains 1,277 tracked files. A Knip scan reported numerous candidates, but cross-reference review showed many are loaded dynamically or by Docker, validation scripts, declarations, QA tooling, or documentation workflows. Those files were intentionally kept; static-analysis output alone was not treated as deletion evidence.
- Two exported backend helpers were confirmed to have no call sites after repository-wide reference searches and removed: `displayOrderNumber` from `order-display-number.ts` and `assertBranchExists` from `order-guards.ts`. No dependency was removed and no uncertain asset, script, route, or configuration file was deleted.
- After these removals, full `pnpm test` passed, including backend 684/684 plus shared HTTP retry 3/3 and Desktop 175/175; `pnpm verify` passed all 14 lint/typecheck tasks, 7 builds, and 33 validators. The preceding isolated database acceptance passed after the financial and tenant-scope changes; it was not rerun for these non-behavioral helper removals.
- At this audit checkpoint before the date-filter fix, the working tree contained 48 modified tracked files and 13 untracked paths. The two new date-filter helper/test files raise the current untracked count to 15. Existing `.orig` copies and QA artifacts are preserved because their ownership and purpose are not fully established. No push, merge, production write, migration, or deployment was performed.
- The 1,277-file inventory is not a claim of manual line-by-line review. Remaining grouped audit and external acceptance gates still include refund/payment-provider behavior, receipt variants and physical printers, Windows offline/reconnect, live Telegram and NBU SMS reconciliation, tenant A/B staging, rollback rehearsal, and UX interaction coverage.
- A production-dependency advisory scan (`pnpm audit --prod --audit-level low`) returned no known vulnerabilities. No package was upgraded or removed during this audit pass.

## Audit continuation: Tashkent date filters (2026-10-12)

- A cross-page review found that payment, expense, receipt, and shift date filters converted HTML date inputs to UTC-day boundaries. Since restaurant calendar days use Asia/Tashkent, records between local midnight and 04:59:59 could appear under the wrong selected date or be omitted.
- Added a shared Tashkent-day boundary converter and applied it to all four pages. It validates calendar dates and sends the local day's exact UTC start/end instants. A repository search found no remaining production UI filters using the old UTC-day construction.
- Regression tests cover both UTC boundaries and malformed/impossible dates. POS web suite passed 76/76; POS TypeScript check, ESLint, and production build passed. Afterward, full workspace `pnpm test` passed; `pnpm verify` passed 14/14 lint/typecheck tasks, 7/7 builds, and 33/33 validators; `git diff --check` passed. Read-only production smoke then passed 27/27 on the deployed baseline; it does not include this unreleased branch change. The date fix is local to the server audit branch and has not been pushed or deployed.
## Audit continuation: Tashkent dashboard and Telegram scope (2026-10-12)

- Fixed the remaining backend "today" timezone mismatches: the owner dashboard now uses the shared Asia/Tashkent report range, and Telegram management counts are constrained to the authenticated tenant, optional branch, and the full Tashkent day.
- Fixed POS admin default dates/year so expense entry and custom report inputs do not pick the previous UTC day before 05:00 Tashkent.
- Regression coverage added for Tashkent date rollover, dashboard day bounds, and Telegram tenant boundaries. Backend 685/685 plus HTTP retry 3/3 and POS 78/78 passed. Full workspace verify passed 14/14 lint/typechecks, 7/7 builds, and 33/33 validators. Release acceptance passed all 59 migrations, seed, media validation, and isolated database order-to-cash-to-stock-to-print E2E.
- Disposable PostgreSQL container/port removed. No push, merge, production write, or deployment. Complete manual review of all tracked files and hardware/provider/live-account acceptance are still open.

## Audit continuation: local offline print validation (2026-10-12)
- Local offline receipt, kitchen, and other driver-printed documents now pass the same completeness check as server print jobs before dispatch. Incomplete payloads fail locally instead of sending a blank/partial page to the printer.
- Regression test confirms an incomplete offline receipt is not sent to the printer; realistic offline receipt and kitchen payload fixtures remain covered.
- Desktop tests passed 177/177; Desktop typecheck, lint, and build passed. Full workspace verify passed 14/14 typecheck/lint tasks, 7/7 builds, and 33/33 validators.
- Not pushed or deployed. Physical Windows receipt-printer acceptance and the broader manual audit remain open.

## Audit continuation: cashier dine-in settlement and printer routing (2026-10-13)

- Extended the disposable database acceptance with the restaurant's actual DINE_IN flow: create as pay-later, verify no payment/revenue/cash/customer receipt is written, verify a kitchen ticket and KITCHEN receipt route only to the kitchen printer, then accept cash and verify one payment, revenue record, cash SALE, and customer receipt routed only to the cashier receipt printer.
- Backend typecheck passed after the scenario was added. Isolated database acceptance passed all 59 migrations, seed, and the expanded order-to-cash-to-stock-to-print E2E.
- The temporary PostgreSQL container was removed and loopback test port 15432 is closed. The broader workspace test and verification suites had passed immediately before this acceptance-only addition; no production write, push, or deploy was performed.
- This does not replace physical printer or live restaurant acceptance; those gates and the wider repository audit remain open.

## Audit continuation: requested order workflow controls (2026-10-13)

- Order type labels were checked across staff history, kitchen history, Desktop offline receipts, and Telegram notifications; DINE_IN is presented as "Zal", with takeaway and delivery labels in Uzbek.
- Added/verified the System Settings switch that hides cashier-created POS orders from Kitchen while preserving kitchen receipt printing; online orders remain managed in Kitchen. Desktop snapshots and offline projections honor the same setting.
- Handoff recipient name is optional. Cancellation notes are now optional across order cancellation, cashier item cancellation, admin online orders, and manager kitchen cancellation. Required internal reason codes and default Uzbek history/receipt wording remain intact.
- The order display-number start setting is bounded from 1 to 1,000,000 (default 101) and used by POS, waiter, customer/Telegram creation, and Desktop offline numbering. Existing higher numbers are not reused when the configured start is lowered.
- Product printer routing defaults to KITCHEN, existing implicit NONE values are migrated to KITCHEN, and product editing can route customer-receipt-only items or suppress printing. Kitchen tickets and kitchen receipts filter non-kitchen products; the customer receipt retains the full order. Legacy BAR still shares the kitchen path; a separate bar printer station is not implemented.
- Added dialog keyboard confirmation: Enter submits a focused input form or activates the enabled primary/last action; it is ignored for textareas, selects, buttons, links, modifiers, repeats, and IME composition. Escape remains handled by the existing modal/dialog behavior. Login remains a native submit form. Dialog focus now avoids the close button where an action/input is available.
- Verification after these edits: backend suite passed (703 tests) plus shared HTTP retry suite (3); POS-Web passed 87 tests, typecheck, and lint; Desktop passed 177 tests, typecheck, and lint; backend typecheck/lint passed; `git diff --check` passed. The new settings, cancellation, and keyboard behavior have not been browser-tested against a running live UI in this pass.
- A disposable loopback PostgreSQL database applied all 60 migrations, including `20261013120000_product_kitchen_printer_routing`; seed and DB-backed order-to-cash-to-stock-to-print E2E passed. The test database was dropped and its temporary container/port were removed. No production or tenant-staging database was touched.
- The first repository validator run caught that the new migration had no SHA-256 manifest row. Added its checksum without modifying any historical migration; the full validator suite now passes 33/33. Media validation also passes (11 category assets, 74 available product assets, 0 unresolved assets).
- Read-only production smoke passed 27/27 on 2026-10-13, including backend/database health, protected endpoints, customer and staff web routes, BestTeam login, and production catalog media. This confirms only the currently deployed baseline, not these unreleased changes.
- No migration was run on production, no push/merge/deploy was done, and no files were deleted. Existing `.orig` files and unrelated dirty work were preserved.
- Remaining acceptance: interactively verify the settings and cancellation flows in browser/Desktop, test mixed product routing on the restaurant printer, and continue the grouped repository audit. Physical Windows printer/offline, live Telegram/NBU reconciliation, tenant A/B staging, application rollback, and deployment of the migration remain open. This checkpoint is not a line-by-line manual review of all tracked files.

## Audit continuation: roadmap and repeat verification (2026-10-13)

- Added six independent remediation items `AUD-164` through `AUD-169` for Uzbek order labels, Kitchen visibility for cashier orders, optional handoff/cancellation fields, configurable order numbering, product printer routing, and keyboard operation. Each item has its own acceptance criteria and will be reported separately.
- Re-ran the workspace `pnpm test`: successful, including backend 703/703 and shared HTTP retry 3/3; all other package suites in the workspace completed successfully.
- Re-ran `turbo run lint typecheck`: 14/14 tasks passed. `git diff --check` passed. All 60 migration checksums, including the new routing migration, passed when invoked from the correct migrations directory.
- Attempted mocked browser QA against the checkout's POS dev server on port 3117. `/`, `/login`, and `/admin/settings` did not return HTTP before timeout; the existing production-build server on 3105 returned 200 but is not the current source, so it was not used as evidence for these changes. No server process was restarted or stopped.
- No push, merge, production migration, or deploy was performed. Browser interaction for the six new controls, production backup/migration release gates, physical printer output, Windows offline/reconnect, live Telegram/NBU reconciliation, tenant A/B staging, rollback rehearsal, and the broader tracked-file audit remain open.
