# Audit remediation implementation progress

## Follow-up request re-confirmation (2026-10-13)

The six requirements reiterated by the user are tracked as AUD-164 through AUD-169 in Gate H; they remain six individually reported acceptance items, not one combined completion claim.
- AUD-164: Uzbek labels instead of raw English order-type enums.
- AUD-165: online WEB/TELEGRAM orders only in Kitchen by default; a System Settings switch controls whether POS-created cashier/waiter orders are also visible, without changing kitchen print routing.
- AUD-166: handoff recipient name and cancellation reason/note are optional.
- AUD-167: configurable first displayed order number, including 1 instead of 101.
- AUD-168: product-level printer routing, default Kitchen, with a way to keep beverages off the kitchen printer.
- AUD-169: keyboard access for primary actions; Enter confirms the intended action and Escape dismisses the current dialog/menu.
Automated checks and real browser, offline refresh, enrolled-terminal, and physical-printer acceptance are reported separately for each ID.

Last updated: 2026-10-13 Asia/Tashkent. The 2026-09-23 checkpoint below is historical.

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
- `AUD-119`: receipt history summarizes all jobs in the latest enqueue batch and
  surfaces mixed/failing printer outcomes. Driver submission is not proof that
  paper came out; reprint clears any prior manual/offline printed mark.
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
  A fresh production backup, PostgreSQL 18 restore, 61-migration replay and
  rollback verification now satisfy the restore portion of the release gate.

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

1. `AUD-101`: a fresh production backup was verified, restored into isolated
   PostgreSQL 18 databases, and all 61 migrations (including the two current
   branch migrations) were applied twice; second run was a no-op and rollback
   restore matched. Production migration/deploy remains gated on branch review,
   final operator smoke and separate release approval.
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

## Audit continuation: cash refund drawer protection (2026-10-13)

- Cashier-flow review found that a cash refund, including a paid item cancellation, could be recorded even when the open shift no longer had enough cash. Refunds now lock and recheck the open branch shift, calculate its current ledger balance, and reject an overdraw before recording the refund or cash transaction. The shared balance helper is used by both shift reporting and refund validation.
- Added regression coverage for full payment refund overdraw, item-cancellation refund overdraw, and legacy opening-balance handling. The focused financial suite passed 19/19; the full workspace `pnpm test` passed, including backend 705/705 and the shared HTTP retry suite 3/3.
- `pnpm verify` passed: 14/14 lint/typecheck tasks, 7/7 builds, and 33/33 repository validators. Full `pnpm release:acceptance` passed after providing its required isolated loopback PostgreSQL at 127.0.0.1:15432; all 60 migrations, seed, and disposable DB-backed order-to-cash-to-stock-to-print E2E passed. The script dropped its temporary database in its cleanup path; the temporary PostgreSQL container was stopped and removed and the port is closed.
- The first acceptance attempt correctly stopped because no local test PostgreSQL was listening at the default 5432; no production or shared development DB was used. The rerun used only a temporary local container. No production migration, write, push, merge, or deploy occurred.
- Browser QA for the six workflow controls is still blocked by the existing POS dev-server timeout. Physical printer checks, Windows offline/reconnect, live Telegram and NBU reconciliation, tenant A/B staging, rollback rehearsal, and the complete manual review of tracked files remain open. This checkpoint does not mean the whole-project audit is complete.
- Read-only production dependency advisory check (`pnpm audit --prod`) reported no known vulnerabilities; no dependency or lockfile change was made.
- Rechecked the POS UI server after release verification: `127.0.0.1:3117/login` still returned no response within 15 seconds, and its Next server process was using 25.4% CPU / 36.6% memory. Port 3105 returned an HTTP 307 redirect. Both processes use the same `apps/pos-web` checkout; `next.config.ts` does not set a separate `distDir`, so concurrent `.next` contention is a plausible cause, not yet proven. Neither process was stopped or restarted. Browser QA remains unverified.
- Headless browser smoke on 3105 confirmed `/login` returns HTML but client assets return HTTP 500; the captured login is unstyled and `/admin/settings` stays at “Yuklanmoqda”. The referenced chunk is absent from the current `.next/static/chunks` while the long-running `next start` process remains alive. This is a local preview/build-artifact mismatch, not evidence of a production-domain failure. Full UI acceptance is still pending a non-conflicting preview environment; the existing servers were left untouched.
- Evaluated Prisma 7.10.0 temporarily: workspace tests, typecheck/lint, backend build, static validators, all 60 migrations and isolated order-to-cash E2E passed, but the `pg` concurrent-query deprecation warning remained. Because the warning was not resolved and pnpm refreshed unrelated lockfile entries, the package and lockfile changes were reverted; the tracked project remains on Prisma 7.2.0. The warning is still an open, non-blocking investigation item, not a confirmed production failure.

## Audit continuation: immutable refund receipt snapshots (2026-10-13)

- Found that an explicitly empty `items` or `payments` snapshot on a refund receipt was treated as if the snapshot were absent. Reprint formatting could consequently copy the order's current products and payments into the refund slip.
- ESC/POS generation now preserves explicit empty arrays and uses current order data only for legacy receipts whose snapshot arrays are absent. Added regression coverage for both the refund and legacy paths.
- Focused receipt/reprint tests passed 8/8; backend typecheck and lint passed; full workspace `pnpm test` passed, including backend 706/706 and all package/smoke tests. `git diff --check` passed.
- No schema or dependency change was needed. The fix has not been pushed or deployed; physical printer confirmation and the broader audit remain pending.

## Audit continuation: isolated POS browser acceptance (2026-10-13)

- The existing POS dev server on port 3117 still times out; it and the existing server on 3105 were left untouched. A separate copy of POS source was run with Webpack on port 3123, isolating its build output from both processes.
- Playwright rendered `/login` with HTTP 200 and no browser-console errors. With a test-only session and fully mocked API, `/admin/settings` rendered the kitchen visibility toggle and order-number input; toggling the former sent `false → true`, saving the latter sent `101 → 1`. At a 390px viewport, document/body width remained 390px with no horizontal overflow.
- These checks prove current UI rendering and mocked interaction only; they do not prove real API persistence, staff authorization against production, offline synchronization, or printer output. No production or shared development API was contacted.
- Browser keyboard smoke on the same isolated settings UI confirmed Enter activates the focused confirmation action and Escape dismisses without sending another PATCH. A mocked product-create journey confirmed the editor defaults to KITCHEN and posts the selected `RECEIPT` route with the product payload; the redirect to the edit route completed with no browser-console errors.
- Printer-route browser evidence remains mocked; persisted tenant data, offline Desktop synchronization, and physical mixed-printer behavior remain unverified.

## Audit continuation: multi-printer receipt status (2026-10-13)

- Receipt history previously loaded only one print job, so a failed job appeared as neutral “Tasdiq yo‘q” and simultaneous printer outcomes could be hidden.
- The receipt list now loads minimal status/timestamp fields for printer jobs. The UI summarizes only the newest creation-time batch, surfaces failed and mixed outcomes as errors, and ignores stale failures from earlier reprints.
- Added focused tests for failed/mixed/recovered batches and the receipt-list query shape.
- Verification: backend tests 709/709 plus shared HTTP retry 3/3; POS tests 87/87; backend/POS typechecks and targeted POS ESLint passed; git diff --check passed.
- Browser/live printer acceptance, production deployment, and the wider repository audit remain open. No push or deploy occurred.

## Audit continuation: Kitchen POS API visibility guard (2026-10-13)

- Follow-up review of `AUD-165` found that the System Settings switch filtered the Kitchen queue/history, but a known POS kitchen-ticket ID could still be fetched or changed through the detail/action endpoints while the switch was off.
- POS tickets are now excluded from Kitchen detail and action lookups when disabled. The Kitchen UI transition rechecks the setting inside the locked order transaction to prevent stale-screen or request-timing bypasses. Telegram's independent staff action path and kitchen-ticket printer creation are unchanged.
- Added regression coverage for disabled/enabled detail and action filters plus the transactional recheck. Kitchen settings tests passed 4/4; focused cash/shift/refund tests passed 55/55; product routing, Uzbek Telegram labels, cancellation, and tenant settings tests passed 18/18. Full backend suite passed 711/711 and shared HTTP retry tests passed 3/3; backend typecheck and targeted ESLint passed.
- Cash/shift ledger review confirmed open-shift row locks on sales, payments, expenses/withdrawals, refunds, and shift closure; ordered two-shift locks on transfers; and correct opening-float and closing-count treatment in current versus historical summaries. No new ledger defect was confirmed in this pass.
- `AUD-164`–`AUD-169` remain separate report items. Browser acceptance for the full login/POS/payment/shift keyboard path, real settings persistence/offline refresh, Desktop offline behavior, and physical printer routing remain open. No push, merge, production migration/write, or deployment occurred.

## Audit continuation: tenant-isolated order numbering (2026-10-13)

- A data-model review found the configurable daily order sequence still queried the maximum across all restaurants and used a source/date-only advisory lock. One restaurant's high number could therefore affect another restaurant configured to start at 1.
- Orders now carry their owning tenant, the allocator filters and locks by tenant/source/Tashkent date, and the uniqueness constraint is tenant-scoped. Added a migration that backfills existing order tenant IDs from their branch before enforcing the foreign key and non-null constraint.
- Updated the older database acceptance fixtures to supply tenant IDs. Added a DB validator proving a tenant can start at `WEB1` while another tenant with `WEB980` independently advances to `WEB981`; wired it into disposable order-to-cash acceptance.
- Verification: backend typecheck passed; full backend suite passed 712/712 plus shared HTTP retry 3/3; focused Kitchen visibility and tenant-sequence tests passed 5/5; targeted ESLint passed; Prisma schema validation passed; all 61 migration checksums passed. Disposable loopback PostgreSQL applied all 61 migrations, seeded successfully, and the extended order-to-cash-to-stock-to-print E2E passed. The E2E first exposed an outdated Kitchen settings stub; the acceptance harness was corrected to read its isolated tenant setting and then passed.
- No production or staging database was changed. No push, merge, migration, or deployment was performed. Production backup/restore rehearsal, browser and Desktop offline parity, physical mixed-printer output, live Telegram/NBU reconciliation, and the complete grouped source audit remain open.

## Audit continuation: Desktop offline sequence isolation (2026-10-13)

- Desktop stored its offline POS sequence under one device-wide key, so changing restaurants on the same workstation could carry one tenant's number forward into another tenant. This contradicted the configurable tenant-specific start and the backend's tenant-scoped allocator.
- JWT context now exposes the tenant claim to the offline gateway, and both offline allocation and successful online POS responses persist their latest sequence under a tenant/date key. Tokens without a tenant claim fall back to branch scope. Branches and cashiers within a tenant share the local counter; distinct tenants do not.
- Added an integration test that caches three branch bootstraps, goes offline, creates orders as two users across two branches in tenant A and one branch in tenant B, and asserts displayed numbers `1`, `2`, and `1` respectively.
- Verification: Desktop gateway tests passed 53/53; complete Desktop suite passed 178/178 including nested tests; Desktop typecheck, targeted ESLint, and build passed. This verifies a single local Desktop database and mocked reconnect behavior, not number uniqueness across multiple separate terminals that are simultaneously offline.
- No application process was restarted. No push, production migration, or deployment was done. Multi-terminal offline number leases, Windows-device keyboard/printer/offline acceptance, live Telegram/NBU reconciliation, and the broader grouped audit remain open.

## Audit continuation: cashier and waiter Kitchen visibility (2026-10-13)

- POS source is shared by cashier and waiter table orders. With the Kitchen setting disabled, all POS-origin orders are hidden, including waiter/table orders; WEB and TELEGRAM remain visible. The setting applies to Kitchen list/history, known-ticket detail/actions, the action transaction recheck, Desktop bootstrap, and offline optimistic projection. Kitchen print routing is unchanged.
- Backend regression tests verify cashier and waiter/table POS orders are hidden while WEB and TELEGRAM remain visible. The POS-Web System Settings panel exposes the control.
- Verification: full backend suite passed (the command completed successfully before the Desktop suite), Desktop suite 178/178, workspace lint/typecheck 14/14, build 7/7, repository validators 33/33, and `git diff --check` passed.
- Browser UI checks for the setting were previously mocked and cover toggle interaction; no live tenant data, staging tenant A/B, real printer output, production migration, push, or deployment was used for this follow-up. Offline data can only reflect the latest cached setting while disconnected; server-side reads/actions enforce the current setting after reconnect.
- Extended disposable E2E to submit the same offline POS display sequence twice; the database assigned distinct ordered numbers. Backend script typecheck and `pnpm qa:isolated-order-e2e` passed all 61 migrations, seed, and the order-to-cash-to-stock-to-print flow. The temporary database was dropped; the dedicated audit PostgreSQL container was left running. This proves collision resolution on reconnect, not uniqueness of paper tickets printed by multiple terminals before they reconnect.

## Audit continuation: keyboard navigation coverage (2026-10-13)

- Audited the shared POS `Button` component, login form, dialog key handler, and Escape handlers for role menus. A TypeScript JSX scan found no clickable passive `div`, `span`, list, table, or section elements in tracked POS UI files; native buttons/links retain browser keyboard activation.
- Dialog Enter skips repeats, IME composition, modifiers, editable text areas, selects, buttons, and non-text inputs; explicitly marked primary actions win, and a disabled primary does not fall through to another action. Escape closes modal and role-menu UI; modal focus is trapped and restored.
- POS tests passed 87/87, including keyboard shortcut guard tests. Real workstation acceptance of login, POS payment, refund, shift close, and Escape/focus behavior remains outstanding; previous browser evidence for the settings dialog used a mocked API.

## Audit continuation: production backup and restore rehearsal (2026-10-13)

- Created a fresh production database archive in the server's restricted secure-backup directory; file mode is 0600 and pg_restore listed 703 archive entries. The backup is not in the repository.
- Restored the archive into two disposable PostgreSQL 18 databases bound only to loopback. Applied the current migrations to one restore twice; the second run reported no pending migrations. The independent restore had matching row counts for the checked core tables.
- The rehearsal removed both temporary databases and its dedicated temporary PostgreSQL container. Production was read-only; no production migration, write, push, or deployment occurred.
- Fixed the restore helper's Linux pnpm executable invocation and added a guarded PostgreSQL-tool-container path for hosts without local psql/pg_restore; it requires a dedicated audit container with a matching loopback port.
- Verification after the helper changes: node syntax check, git diff check, root lint and package tests, workspace lint/typecheck 14/14, builds 7/7, repository validators 33/33, and the full backup/restore/double-migration rehearsal passed.
- Full grouped source audit, live workstation keyboard acceptance, physical mixed-printer acceptance, and real-browser/offline/multi-terminal acceptance remain open.

## Separate status: user-requested workflow items (2026-10-13)

- AUD-164: Uzbek order-type labels are used in POS/Kitchen history, receipts/reprints, Desktop offline receipts, and Telegram; raw enum names should not appear in user-facing views.
- AUD-165: when disabled, Kitchen hides all POS-origin orders (cashier and waiter/table); WEB and TELEGRAM remain visible. The System Settings toggle, API detail/action guards, Desktop projection, and kitchen print path are covered by automated tests.
- AUD-166: handoff recipient name and operator cancellation note are optional; the workflow still writes its internal audit reason. Mocked UI submission passed for blank Kitchen handoff/cancellation and cashier item cancellation; live workstation acceptance remains open.
- AUD-167: order-number start is configurable (default 101, supports 1) with tenant/source/date isolation. Enrolled terminal suffixes make offline provisional labels distinct; physical printer readability and workstation acceptance remain open.
- AUD-168: per-product routing supports kitchen, customer receipt only, or no print; automated mixed-order and Desktop offline tests pass. Physical mixed-printer output remains open.
- AUD-169: native keyboard activation, guarded Enter, Escape dismissal, and modal focus handling are tested. Real workstation login, sale/payment, refund, shift-close, and focus acceptance remain open.

## Consolidated release acceptance (2026-10-13)

- The complete `pnpm release:acceptance` run passed with the disposable audit PostgreSQL endpoint configured: backend, POS, customer web, Telegram, print agent, and Desktop checks; 14 workspace lint/typecheck tasks; 7 builds; 33 repository validators; media validation (85 files, 0 unresolved assets); and isolated order-to-cash-to-stock-to-print E2E after applying all 61 migrations.
- `pnpm audit --prod`, root lint, root/package tests, and the production backup restore rehearsal also passed. `git diff --check` is clean.
- This is automated acceptance evidence, not completion of the full repository audit or real-world acceptance. No production smoke, migration, push, or deployment was performed. Physical receipt-printer routing, real workstation/browser flows, live settings persistence and offline refresh, and the multi-terminal offline paper-number guarantee remain open.

## Audit continuation: concurrent print queue recovery (2026-10-13)

- Confirmed that simultaneous missing-job recovery requests could both pass the existence check and enqueue duplicate print jobs for one receipt.
- Added a receipt-scoped PostgreSQL transaction advisory lock to both durable print-job creation and recovery; recovery rechecks for an existing job only after acquiring the lock. Explicit reprints remain intentional new jobs.
- Added a regression test with two concurrent recovery requests and updated queue test doubles for the transaction lock.
- Verification: 36 print/receipt tests passed; backend suite passed 714/714 plus 3 shared HTTP retry tests; backend typecheck/lint passed; all 61 migrations and disposable order-to-print E2E passed; full release acceptance passed with 33 validators and all app builds.
- Physical printer/model acceptance and live workstation/browser/offline multi-terminal checks remain open. No production write/migration, push, or deployment was performed.

## Correction: terminal-bound offline labels (2026-10-13)

- Earlier `AUD-167` notes saying separate offline terminals can print duplicate provisional labels are superseded by the current implementation.
- Bootstrap supplies each enrolled terminal with its unique device-ID suffix. Desktop prints `<sequence>-<device suffix>` offline; the backend validates that label against the active enrolled device in the same branch and tenant. Offline sales are rejected when the terminal is unregistered or the label does not match.
- Existing automated evidence: two independent Desktop stores on one branch assert distinct provisional labels and exactly-once replay; backend coverage rejects a forged/foreign terminal label; bootstrap coverage checks the device suffix.
- This proves app-level provisional label uniqueness under the enrolled-device flow, not physical readability or a real two-printer end-to-end run. Actual printer output and live workstation acceptance remain open.
- The older multi-terminal offline-number risk note is historical; terminal-bound label tests represent the current implementation.

## Audit continuation: authenticated browser role matrix (2026-10-13)

- The first matrix used an invalid empty-array response for `/reports/sales` and did not fail on browser page exceptions. Updated it to return contract-shaped dashboard/report data and assert there are no uncaught page errors.
- Added SUPER_ADMIN. The mocked-API Playwright matrix now checks SUPER_ADMIN, ADMIN, branch manager, accountant, cashier, waiter, kitchen, and courier at desktop (1440px) and mobile (390px) widths.
- Verification: all 16 role/viewport cases passed with no horizontal overflow or page exceptions; the script passes Node syntax check and targeted ESLint.
- This is rendered navigation/permission smoke with mocked APIs, not transactional persistence or production-data verification. The temporary localhost server was stopped; no production access or writes occurred.

## Admin settings UI verification (2026-10-13)

- Extended the admin-settings QA script to cover saving order-number start 1 and toggling POS-order visibility in Kitchen, then reloading and verifying both settings at four viewport widths.
- Result: 1600, 768, 360, and 320px passed on the current branch's isolated Next server; script syntax and targeted ESLint pass.
- This browser test uses a mocked API and is not evidence of a production database write, tenant authorization, or Desktop offline-cache refresh. No production read/write, push, or deploy was performed.

## Immediate setting cache isolation check (2026-10-13)

- Added a regression test with deliberately stale per-tenant Redis cache values. The Kitchen visibility and order-number settings read the current DB value and remain isolated by tenant.
- Targeted setting tests passed 5/5; backend lint and both TypeScript typechecks passed. No production data, push, or deploy changed.

## Full backend suite after settings regression (2026-10-13)

- Backend suite passed 719/719, and the shared transient-HTTP retry suite passed 3/3 after the new settings-cache regression test. Production was not modified.

## Read-only production migration audit (2026-10-13)

- Production migration table contains 59 completed entries, zero failed/unfinished/rolled-back entries, no unknown migrations, and no checksum mismatches against the matching repository files. The branch has two new pending migrations.
- Production preflight: zero orders without tenant-bound branches, zero duplicate tenant/source/date/display-sequence tuples, and 74 KITCHEN plus 4 NONE product routes. The NONE products are beverages.
- Corrected the pending printer migration to change only the future default to KITCHEN, preserving existing NONE selections. Added a regression test and verified the exact SQL in a disposable PostgreSQL database.
- Created and verified a fresh restricted production backup, restored it to isolated PostgreSQL 18, ran all 61 migrations twice, and checked that data counts and route distribution remained identical. Rollback restore comparison passed.
- Full release acceptance passed, including all builds, lint/typechecks, application tests, 33 validators, media checks, and disposable order-to-cash-to-stock-to-print E2E. Production remains unchanged; no push/deploy.

## Audit continuation: receipt snapshot fidelity (2026-10-13)

- Receipt documents already store order number, item, modifier, note, payment, amount, and timestamp snapshots, and reprints render from that immutable payload. The admin detail view was still displaying live order items/payments, which could contradict the saved receipt after edits or refunds.
- Updated receipt details to prefer the saved snapshot, including an explicit empty item list for refunds; legacy rows without snapshot arrays retain the prior fallback. The saved display order number, modifiers, and notes are now shown from the document snapshot.
- Focused receipt/print tests passed 24/24; POS typecheck and targeted ESLint passed. git diff --check is clean.
- Print state intentionally distinguishes driver submission from physical paper output; operators are prompted to check paper, and mixed printer failures are surfaced instead of claiming success.
- No database, production service, push, or deployment was changed.
- Follow-up: receipt JSON now includes explicit `schemaVersion: 1` for sale, cancellation, refund, and kitchen documents; receipt-writer regression assertions cover the version.
- Verification after this follow-up: focused receipt snapshot/writer/reprint tests passed 8/8 and the full `pnpm release:acceptance` run exited 0, including all package checks/builds, 33 validators, replay of all 61 migrations in the disposable database, seed, and order-to-cash-to-stock-to-print E2E. No production smoke, migration, push, or deploy was performed.

## Read-only production runtime smoke (2026-10-13)

- Public GET checks returned HTTP 200 for the customer home page, checkout URL, POS admin route, and API health endpoint. API health reports backend/database `ok` and Redis `connected`; this does not validate authenticated mutations.
- Runtime Telegram agent status: customer bot is `degraded` with `tokenConfigured=false`, `secretConfigured=false`, and backend reachable; staff bot is `ready` with both credentials configured and backend reachable.
- No credential values were read or copied and no webhook/configuration was changed. Owner authorization is pending before configuring the customer bot sidecar.

## Audit continuation: offline order-number date continuity (2026-10-13)

- Found a cross-midnight mismatch: Desktop selected a provisional sequence by Tashkent date, but an offline order replayed after midnight could be persisted under the replay date. This could make printed/offline and server order-number dates disagree.
- Desktop now stores offlineDisplayOrderDate with the terminal-bound sequence. The backend validates the strict Tashkent date, rejects future/invalid dates, scopes allocation and duplicate detection by that date, and includes the date in the idempotency request hash.
- Also found that raising the server start while a terminal was disconnected could reject its already printed lower number. The server now uses the configured start for new allocation but preserves a valid, unique terminal-bound label at replay; the DB sequence remains server-allocated. E2E simulates a cached start of 1 while the server uses 101.
- Legacy queued sales with a terminal-bound provisional label but no date derive the date from their persisted queuedAt. If that timestamp is missing or invalid, replay fails closed for reconciliation instead of silently assigning the next day's date.
- Verification: backend date/idempotency tests 10/10; 43 focused order, cash, refund, kitchen, printer, and Telegram tests passed; Desktop gateway suite 54/54 plus the legacy queued-sale date regression 1/1; backend app/scripts typechecks passed; isolated 61-migration order E2E passed; full release acceptance passed with exit code 0 after these changes; git diff --check passed.
- This closes the code-level midnight regression only. Live browser/workstation, actual multi-terminal printing, and USB/Windows-spooler/LAN printer acceptance remain open. No production data/migration, push, or deployment was performed.

## Audit continuation: explicit keyboard confirmation actions (2026-10-13)

- Found that Enter could fall through to the last enabled dialog button when no primary action was declared. That could trigger an unintended cancel, deletion, or other action depending on button order.
- Enter now activates only an explicitly marked `data-keyboard-primary` button. Disabled or unmarked actions do nothing. Dialogs without a primary action focus the dialog container rather than an arbitrary footer button, preventing native Enter activation; normal buttons remain keyboard-focusable, and Escape still dismisses dialogs.
- Added explicit primary markers to cashier product add, post-sale continuation, payment completion, shift close/transfer, kitchen cancellation/handoff, waiter item removal, courier confirmation, and waiter item submission flows. Multiple receipt reprint buttons intentionally have no automatic Enter action.
- Verification: POS tests 87/87; POS TypeScript, ESLint, and production build passed. This is automated UI evidence; physical workstation acceptance of login, payment/refund, shift close, and focus/Escape behavior remains open. No push, production migration, or deployment was performed.

## Audit continuation: isolated tenant A/B and owner UI QA (2026-10-13)

- Re-ran the isolated owner-platform QA against a fresh, randomly named database in the loopback-only `mazetto-dev-postgres` container. The first run correctly reached the owner UI but failed because its visual assertion still expected the prior `0.82` surface opacity while current CSS uses `0.72`.
- Updated that assertion to match the current source design and corrected the result message so a local isolated run cannot be mistaken for a staging run.
- The rerun passed verified-domain routing, same-phone OTP isolation, tenant-scoped branch/settings reads and writes, access/refresh-token isolation, unknown-host handling, membership backfill, role authorization, owner login, reports, diagnostics and site registration. The temporary QA database was dropped; the container's database list returned to its prior state.
- This is isolated local integration evidence, not a test against the actual staging or production environment. A separate live staging A/B run on 2026-10-13 passed against the currently deployed staging image `f6531fc`; the candidate branch itself is not deployed there, so candidate-specific staging verification and final migration release gates remain open.

## Staging candidate preflight (2026-10-13)

- Read-only preflight confirmed staging database `mazetto_staging` on PostgreSQL 18.6 has 58 finished migrations; latest is `20261004100000_telegram_notification_outbox`. The branch has 61 migrations, so three are pending on staging: `20261009190000_partial_cash_item_refunds`, `20261013120000_product_kitchen_printer_routing`, and `20261013140000_tenant_scoped_order_numbers`. Production remains at 59/61 and has only the final two pending.
- Created staging-only backup `/home/javohir/backups/mazetto-staging/mazetto-staging-before-audit-8b42159-20261013.dump`; SHA-256 `9ecb4ea5386007e7286954a1fa9c57f60810609fc84c597d34a264670af9d92d`. PostgreSQL `pg_restore --list` returned 716 archive entries. No migration or production data change was made.
- PR checks `verify` and `windows-desktop-package` passed on `8b42159` (docs-only after code-verified `b064d8e`). The exact candidate image was built from the pushed SHA and deployed only to the staging Swarm service; the previous `f6531fc` image remains tagged for rollback.
- The verified staging backup was made before changes. All three migrations missing from staging were applied successfully; Prisma status is 61/61, API health is 200, PostgreSQL is `ok`, Redis is connected, and the guarded staging A/B harness passed with cleanup confirmed.
- This staging harness is not a full cashier-to-kitchen cash/receipt UI regression and does not print on real hardware. Restore/rollback rehearsal, live Windows acceptance, physical printer routing, and production release remain open.

## Audit continuation: isolated shift/kassa regression target (2026-10-13)

- Found that the Shift/Kassa DB regression only searched for localhost text in DATABASE_URL and left synthetic fixtures behind. A URL containing localhost as a username or path could pass while targeting the wrong database.
- Added a URL parser guard requiring PostgreSQL, exact host localhost or 127.0.0.1, port 5433, and database shift_qa; host, port, hostaddr, and service query overrides are rejected. Added allow/deny tests for malformed, remote, wrong-port/database, and query-override URLs.
- Created shift_qa only after confirming it was absent in the loopback-only mazetto-dev-postgres container, applied all 61 migrations, ran the DB-backed cashier/shift validation successfully, then dropped only that temporary database. Existing QA, staging, and production databases were not modified.
- Verification: guard tests 2/2, full backend tests passed, backend app and scripts typechecks passed, targeted ESLint passed, diff check clean.
- The concurrency stress test emitted a non-failing pg 8.23 / Prisma PostgreSQL-adapter query-queue deprecation warning. The validation passed; retain this as an upstream compatibility warning to revisit before a pg 9 upgrade, not as a confirmed business-logic defect.

## Audit continuation: DB smoke target isolation (2026-10-13)

- Confirmed PostgreSQL URL parsing honors query-level host and port, so checking for localhost text or only URL.hostname is not an adequate safety boundary. There is no evidence that any earlier test wrote to a wrong target.
- Added strict loopback PostgreSQL URL parsing and per-script database/port allowlists to 13 DB-backed validators, including order, kitchen, POS/cash, settings, staff, Telegram, maintenance, and tenant-migration checks. Query overrides for host, hostaddr, port, service, database, and dbname are rejected.
- The disposable order E2E and backup-restore rehearsal now validate loopback PostgreSQL and use the local postgres admin database; delivery-location QA restricts its target to local mazetto_dev. The staging A/B harness now also checks protocol, internal port 5432, and route overrides.
- Regression checks passed for the TypeScript and Node URL guards; backend application/scripts typechecks, targeted ESLint, the full backend and transient-HTTP test run, Node syntax checks, and git diff --check passed.
- Full release acceptance initially lacked a PostgreSQL service at its default 5432 endpoint. It was rerun successfully using the verified dev-container loopback mapping `127.0.0.1:5433`; the E2E created and dropped one unique disposable database after applying 61 migrations. Existing databases, staging, and production data were not changed.
- No push, merge, production migration, or deployment was made.
- ensure-print-queue.mjs is unreferenced and duplicates an existing Prisma migration; it is intentionally retained pending confirmation that it has no manual recovery use.
- This closes the test-target guard finding on the audit branch only. The broader business-flow, UI, offline, payment, Telegram, and physical-printer audit remains open; this change is not a production release.

## Local UI acceptance continuation (2026-10-13)

- The first browser run used a stale Next dev server on port 3103; it returned 404 for old chunk hashes, so login JavaScript never ran. The existing server was left untouched. A fresh production-mode server on 127.0.0.1:3104 resolved the harness issue.
- `qa:role-matrix`: 8 roles at 1440px and 390px passed navigation, overflow, and page-error checks; blank Kitchen handoff and cancellation requests passed at 1440px.
- `qa-admin-settings`: mocked save/reload of order-number start and Kitchen POS visibility passed at 1600, 768, 360, and 320px.
- `qa-cashier-history`: blank item cancellation succeeded with the note omitted at 375px and 1280px; the input resets between items and the history view does not overflow.
- `qa-pos-layout`: order creation and payment-panel layout passed at 1600, 768, 360, and 320px with no horizontal overflow.
- `qa-shift-close-report`: all 205 fixture orders printed into the report; 80mm/A4 output, browser fallback, Desktop queue, and 375/768/1366px behavior passed.
- These are mocked/browser acceptance checks, not live tenant persistence or physical printer proof. Offline-setting refresh, physical printer output, live cashier login/payment/refund, and production gate acceptance remain open.

## Audit continuation: shift-close keyboard confirmation (2026-10-13)

- Strengthened `qa-shift-close-report` to dismiss the confirmation with Escape, assert that the shift-close API was not called, wait until order loading enables the primary action, and confirm with Enter.
- The initial version asserted primary-button focus while that button was disabled during order loading; this was a test timing assumption, not a product defect. The modal-level guarded Enter action works once the intended confirmation is ready.
- Browser regression passed at 375, 768, and 1366px; the report included all 205 fixture orders, browser printing, offline fallback, Desktop queue, and 80mm/A4 output checks. Node syntax and targeted ESLint passed.
- This updates only local automated browser evidence. Live workstation acceptance, physical printers, and release gates remain open; no push, migration, or deploy occurred.

## Audit continuation: staging database restore rehearsal (2026-10-13)

- Rechecked staging backup `mazetto-staging-before-audit-8b42159-20261013.dump`; SHA-256 matched the recorded `9ecb4ea5386007e7286954a1fa9c57f60810609fc84c597d34a264670af9d92d`.
- Restored it into a new loopback-only PostgreSQL 18.6 container, applied all 61 migrations twice, and restored a second independent rollback copy. The second migration run had no pending migrations; restored row counts matched.
- The dump contained zero branches, employees, orders, payments, receipts, and products. Therefore the routing-preservation assertion was vacuous and this does not validate a populated-data migration.
- The temporary databases and ephemeral container were removed; staging and production were not written. Evidence: `.release-evidence/database-restore-rehearsal.json`.
- Database restore mechanics passed, but the full release gate remains open for object-store restore, representative non-empty fixtures, candidate-specific order-to-cash/receipt regression, and human workstation/physical-printer acceptance.

## Audit continuation: BestTeam owner panel isolated QA (2026-10-13)

- `pnpm --filter backend qa:platform-isolated` passed against a uniquely named disposable database in the local `mazetto-dev-postgres` container.
- Verified tenant domain resolution, login and refresh, unknown-host denial, membership onboarding and role isolation, monitoring, reports, activity/audit history, and owner web login plus site registration through the Next proxy.
- The test cleaned up its isolated database successfully. No staging or production database was written, and no push, merge, migration release, or deployment occurred.
- This closes isolated owner-panel QA only. At this checkpoint, populated-data restore and object-store recovery remained open; the later populated-backup SQL rehearsal is documented below. Object-store recovery, real tenant-user acceptance, and live restaurant workstation/printer gates remain open.

## Audit continuation: populated database backup restore (2026-10-13)

- Restored `/home/javohir/backups/mazetto/predeploy-5150e2b/mazetto-production.dump` (374,937 bytes; SHA-256 `31077340bddce327dbb4f76ffc1a2c2486ff00a3fc09096bc52adef483a926ca`) only into a disposable PostgreSQL 18.6 container bound to loopback.
- The older 2026-09-26 snapshot had 78 products (74 `KITCHEN`, 4 `NONE`), one order, and one payment. No product names, customer details, or other row contents were inspected. The route breakdown remained unchanged after applying all 61 migrations twice; the rehearsal's independent rollback restore counts matched.
- The isolated container, temporary databases, and its anonymous volume were removed. The earlier empty-staging rehearsal evidence file was preserved and restored; staging and live production were not written.
- This validates SQL restore/migration mechanics against one older, low-volume non-empty backup. It does not establish current-backup freshness, object-store recovery, candidate-specific live order-to-cash behavior, or human workstation/physical-printer acceptance.

## Audit continuation: POS keyboard checkout acceptance (2026-10-13)

- A focused source review found the POS checkout's primary submit button was not marked as the intended Enter action. Pressing Enter from the received-cash field therefore did not confirm checkout.
- Marked that button as the dialog's guarded keyboard-primary action. Extended `qa-staff-workspaces` to submit with Enter, dismiss a failed attempt with Escape without creating another request, reopen the checkout, and retry with Enter using the same idempotency key.
- The full staff UI browser suite passed, including POS, Kitchen, courier, shift and view-only role flows; targeted ESLint, Node syntax, and `git diff --check` passed. A dedicated test server on port 3111 was stopped; pre-existing dev servers were untouched.
- This closes the mocked POS Enter/Escape acceptance only. Login, refund, Desktop, complete focus/IME traversal, and live workstation acceptance remain open; no push, migration, or deployment occurred.

## Audit continuation: receipt deletion and durable print safety (2026-10-13)

- Found that hard-deleting a receipt cascaded to its durable print jobs and attempts, including jobs waiting, processing, submitted to the driver, or in dead-letter review.
- Receipt deletion now uses the per-receipt queue advisory lock, row-locks existing print jobs against concurrent claims, and refuses deletion unless all jobs are already printed or cancelled.
- Added a tenant-scoped regression test proving unresolved jobs are locked and the receipt is not deleted.
- Verification: backend suite 731/731 plus transient HTTP retry 3/3, backend typecheck, targeted ESLint, and `git diff --check` pass. The 61-migration isolated database order-to-cash-to-print E2E also confirms the receipt and pending print job remain when hard-delete is refused.
- No production mutation, push, or deploy occurred. Simultaneous claim/delete stress and live admin acceptance remain open.

## Audit continuation: printer deletion and durable target safety (2026-10-13)

- Found that deleting a printer could null the durable `printerId` on an unfinished print job, losing which physical target was intended.
- Printer update, deactivation, and deletion now share queue serialization. Before assigning a job, the queue writer rechecks that the locked printer is still active; deletion locks associated jobs and is refused while any job is unresolved. Successful deletion is audit logged.
- Added tenant-scoped delete protection and a queue/delete race regression test. The isolated 61-migration order-to-cash-to-print E2E confirms a pending job keeps its printer target and the printer cannot be deleted; a concurrent agent-claim/delete race on isolated PostgreSQL confirms deletion is refused after job claim.
- Verification: backend suite 731/731, HTTP retry suite 3/3, backend typecheck, targeted ESLint, and `git diff --check` pass. Repeated production-like contention and real admin acceptance remain open.
- No production mutation, push, or deploy occurred.

## Audit continuation: stable printer configuration for queued jobs (2026-10-13)

- Found that `PrintJob` stores the printer ID while the agent reads the current printer type/metadata. Updating the route or device metadata with unfinished jobs could silently redirect old jobs.
- Printer type and metadata edits now acquire the printer queue lock, lock associated jobs, and reject the edit while any job is unresolved. Name/status changes remain available. Metadata is re-read after locking so concurrent partial edits merge against the latest value.
- Added unit and database-backed regressions: pending jobs block target edits without changing printer config; isolated DB claim/delete race retains the target. Backend suite 731/731, transient HTTP retries 3/3, typecheck, lint, and 61-migration E2E pass. Real admin/device acceptance remains open.
- No production mutation, push, or deploy occurred.

## Full workspace verification after printer safeguards (2026-10-13)

- The root `pnpm test` completed successfully across the workspace (exit code 0).
- `pnpm verify` passed: 14 lint/typecheck tasks, 7 package builds, and 33 repository validators. The backend suite passed 731/731 with transient HTTP retries 3/3; isolated PostgreSQL E2E applied all 61 migrations and passed the order-to-cash-to-stock-to-print flow.
- `git diff --check` passed and no rejected patch files remain in source, scripts, tests, or audit docs.
- These are candidate-branch automated checks. Full source audit, live tenant setting/offline refresh, Windows workstation, physical printer transports, current object-store restore, and production release gates remain open. No production write, migration, push, or deploy occurred.

## Final release acceptance rerun (2026-10-13)

- After the receipt/printer queue safeguards, pnpm release:acceptance completed successfully: package typechecks, lint, builds and tests; 33/33 static validators; 85 media assets with zero unresolved product assets; and the disposable PostgreSQL order-to-cash-to-stock-to-print E2E using all 61 migrations.
- The disposable database was dropped by the E2E cleanup path; a separate catalog check confirmed zero remaining mazetto_step8_release databases. The audit PostgreSQL container remained loopback-only at 127.0.0.1:15432.
- E2E emitted a non-failing pg 8.23 / Prisma PostgreSQL adapter query-queue deprecation warning. The test passed; no application-level defect has been established from this warning. Keep it as an upstream compatibility follow-up before a pg 9 upgrade.
- This run did not execute production smoke and did not change staging or production. Physical printer transports, real Windows/offline acceptance, current object-store restore, complete manual source review, and the production release gate remain open.

## Read-only production smoke (2026-10-13)

- Ran the production smoke against the configured live Mazetto Food API, customer web, POS web, BestTeam owner login, and media host. All 27/27 GET/HEAD checks passed, including database health, protected routes returning 401, customer checkout routes, admin login/settings routes, and catalog image assets.
- The smoke script was reviewed before execution and uses GET/HEAD only. No order, payment, setting, database, or deployment mutation was performed.
- This verifies public route and asset availability only; it does not prove authenticated user workflows, tenant-setting persistence, printer output, Telegram delivery, or offline workstation behavior.

## Transaction query audit continuation (2026-10-13)

- Removed explicit concurrent Prisma calls from interactive transactions in the current-shift summary, warehouse archive checks, shift-close snapshot, and Desktop bootstrap. Desktop bootstrap keeps the checked branch ID narrowed across its asynchronous snapshot loader.
- Backend typecheck passed. Focused cash, inventory, bootstrap, and shift tests passed 29/29. The isolated order-to-cash-to-stock-to-print E2E passed again with all 61 migrations and cleaned up its disposable database.
- The full backend suite then passed 731/731 plus shared HTTP retry tests 3/3; ESLint passed for all four changed services.
- The non-failing pg 8.23 deprecation warning remains in Prisma's internal relation-query loading path (the trace showed related category/product-bundle and order graph queries queued on one client). It is not evidence of a failed business flow, but remains an adapter/pg compatibility follow-up; do not upgrade pg or mark it resolved without a supported Prisma fix and regression coverage.
- The six user-requested requirements remain tracked individually as AUD-164..169. Automated checks are not a substitute for the remaining live UI/offline/physical-printer acceptance listed in the remediation plan. No production mutation, push, or deploy occurred.

## Candidate POS-to-kitchen acceptance (2026-10-13)

- Extended the isolated release E2E to run the POS/Kassa DB validator against its disposable database after seed. The validator now proves cash sale/revenue/shift linkage, one kitchen ticket, a persisted customer receipt plus kitchen receipt, and at least one durable print job for each receipt.
- POS-origin orders are asserted hidden from the kitchen queue/actions by default; after the tenant setting is enabled, the same ticket becomes visible and can complete its kitchen lifecycle. The prior setting value is restored in `finally`, so later validators do not inherit test state.
- Replaced a catch-and-fallback mixed-sale test with an explicit mismatched-variant rejection and a valid modifier + variant + set sale assertion. Also updated the validator's stale English cash-error expectation to the current Uzbek message.
- The full isolated run passed: all 61 migrations, display-number validation, POS/Kassa flow, then customer online/Telegram ordering E2E. Backend typecheck and ESLint passed; the full backend suite remains 731/731 plus 3/3 shared HTTP retry tests.
- The pg 8.23 / Prisma internal relation-query queue deprecation warning remains non-failing. No push, production migration, or deploy occurred. Manual physical-printer output, Windows offline/reconnect, object-store restore/rollback, and authenticated live acceptance remain open.
## Audit continuation: payment, inventory, and desktop credentials (2026-10-13)

- Current PR head is `24160e7` with 62 migrations; production remains at the verified 59-migration baseline. PR CI run #850 passed. The prior staging A/B evidence is for an earlier 61-migration candidate, not this head.
- Desktop saved-login source review found Electron `safeStorage` in the main process and a saved-account picker/removal flow. Five credential tests and the Desktop build passed; packaged Windows restart/select/remove acceptance remains open.
- Payment allowlist audit found disabled cashier methods are hidden and rejected by both POS checkout and existing-order payment writes. Focused config/payment/POS tests passed 36/36; this does not add Click/Payme provider callbacks.
- Added four tests for inventory readiness: missing warehouse, inactive recipe ingredient, no-recipe branch, and foreign-branch rejection. Added three modifier lifecycle tests for duplicate IDs, referenced modifiers, and missing IDs. These seven tests passed; backend typecheck and targeted ESLint passed.
- Corrected a stale modifier UI comment that claimed no delete endpoint existed; deletion is restricted to modifiers not assigned to products.
- Payment/inventory code review in this batch found no confirmed money or tenant-scope defect. NBU SMS auto-matching, live Telegram group checks, Windows offline workflow, current object-store restore, and physical printer acceptance remain external gates.
- No production write, migration, or deployment occurred during this audit batch. Untracked user/server backup files were preserved.
## Kitchen ticket identifiers and 62-migration E2E (2026-10-13)

- Source audit found KitchenService caught a ticket-number unique violation and retried the insert inside the same interactive PostgreSQL transaction. Since a database constraint error can leave that transaction aborted, this retry path was not reliable.
- Kitchen ticket allocation now takes an advisory transaction lock for each candidate and checks the unique ticket number before insert; collisions move to a fresh candidate before the transaction is poisoned. Two focused tests cover a pre-existing collision and the bounded retry limit.
- The isolated order-number validator now runs 12 separate Prisma transactions concurrently and asserts a unique 1–12 sequence. The fixture tenant, branch, and orders are removed in a finally block.
- Targeted kitchen/order/printer tests passed 62/62. Full backend suite passed 740/740; shared HTTP retry tests passed 3/3. Backend application and script typechecks, plus targeted ESLint, passed.
- The disposable release E2E applied all 62 migrations, then passed order-number validation, POS/Kassa validation, and customer WEB/TELEGRAM order E2E. Its cleanup path dropped the disposable DB. The pg 8.23 / Prisma query-queue deprecation warning remains non-failing.
- This proves the current worktree against a disposable DB, not a staging A/B or production run. Production write, migration, and deployment remain unperformed pending release gates.

## Current 62-migration staging acceptance (2026-10-13)

- Exact PR head `fc12251ad00c4fef1def1bc3d41606e3d1a620f3` passed GitHub Actions CI run #851: `verify` and `windows-desktop-package`.
- Built staging image `mazetto-staging-api-crmkze:fc12251`. Before migration, confirmed the API's DB target was `mazetto_staging` on the staging-only Docker network and the prior schema was 61/61.
- Created and verified a staging-only pre-migration backup at `/home/javohir/backups/mazetto-staging/mazetto-staging-before-audit-fc12251-20261013.dump` (297,650 bytes; SHA-256 `a40a43fa6bcb655318e47b497f771dc6a19e2fb4f8f442aabbf2b0c256ca7056`; `pg_restore --list` passed).
- Applied only `20261013130000_order_tenant_legacy_writer_guard` to staging. The candidate service converged on image `fc12251` with automatic rollback enabled; rollback tag `mazetto-staging-api-crmkze:rollback-fc12251` preserves the previous staging image.
- Post-deploy health returned 200 with PostgreSQL `ok` and Redis connected; candidate Prisma status is 62/62.
- The guarded staging A/B harness passed tenant membership/cache isolation, host/domain policy, realtime order delivery/reconnect, logout revocation, reports/audit, OTP sessions, and tenant media isolation. Its cleanup assertions restored one baseline tenant and zero fixture branches, users, memberships, domains, customers, settings, orders, roles, permissions, outbox rows, or media objects.
- Historical PR #296 staging checkpoint (2026-10-13): its description recorded production at the then-verified 59-migration baseline; no production migration, service deploy, or second-restaurant activation occurred at that checkpoint. Later release PRs supersede that production version.
- Historical live-acceptance list as of 2026-10-13: real Windows/offline workstation flows, authenticated POS/Kitchen/cashier acceptance, physical customer receipt printers and transports, real Telegram group delivery/buttons, and current object-store restore plus application rollback exercise. NBU integration was cancelled by the owner on 2026-10-14 and is not an active requirement.

## Tenant-bound catalog and homepage candidate (2026-10-14)

- The production release PR #302 is merged at `951f344214e11446428d2fdc2c79d26ba27d5380`; CI #867, Desktop Release #178, Deploy #336 and production smoke succeeded. The production tag is on that commit. No migration was needed for that release.
- Continued on `audit/catalog-tenant-boundary-20261014`. Recipe list/detail/upsert and homepage public/admin operations now fail closed on ambiguous active tenants. Branch-linked products/categories are scoped to the sole active tenant, including list, validation and bulk deletion. Homepage rows without linked products/categories have no tenant column and remain shared; a schema ownership migration plus staging A/B proof is needed before multiple active tenants can be served.
- Six focused tests passed, including foreign variant/product/branch behavior, route fail-closed behavior, and tenant-scoped bulk deletion. Full backend tests passed 746/746; shared transient HTTP tests 3/3. Backend application/script typechecks, targeted ESLint and Prettier, backend Nest build, POS-web typecheck and production build passed.
- User confirmed current operations are cash-only and cancelled NBU integration. Repository source has no active NBU reconciliation module; removed the stale bank-SMS instruction from cashier UI. Historical NBU notes are explicitly canceled and preserved for audit; payment records were not changed.
- PR #303 is open from this branch at exact head `98f40274addd2fbc227aa9b0a8e5e31bcc4159f6`; GitHub CI run #871 (`38542246010`) passed both `verify` and `windows-desktop-package`.
- Built and deployed exact candidate image `mazetto-staging-api-crmkze:98f4027` (image ID `sha256:f5c4f2576d72a11bcf02c07501c738c238cf33d7fcc29ead29fa2914bd7cb7b7`). Staging service converged with rollback-on-failure enabled; health returned 200, PostgreSQL and Redis were healthy, and Prisma reported 62/62 migrations. No schema migration was added by this PR.
- Staging-only pre-deploy backup: `/home/javohir/backups/mazetto-staging/mazetto-staging-before-pr303-98f4027-20261014T092849Z.dump`, 299,114 bytes, SHA-256 `ea95add9c9d6a0028ec5ef61fb7e3e14f755b9d50a8d12193773b44bc3fb5d72`; `pg_restore --list` succeeded. Previous staging image is preserved as `mazetto-staging-api-crmkze:rollback-98f4027`.
- Exact-image staging tenant A/B proof passed for catalog recipe/homepage scoping, live order delivery/reconnect, customer logout revocation, host/domain, reports/audit, OTP sessions and tenant media isolation. Fixture cleanup returned the database to one baseline tenant and zero fixture branches, devices, users, employees, memberships, domains, customers, challenges, settings, roles, permissions, orders, order events and outbox rows; media cleanup also passed.
- Current acceptance matrix is K/A/S=PASS, R/P=OPEN for this candidate. Production remains on `951f344`; no production migration/deploy or second-restaurant activation occurred. Owner cancelled NBU integration on 2026-10-14; active policy is cash-only and historical payment records were not altered.

## Cash-only POS and kitchen completion follow-up (2026-10-14)

- Fixed POS cash completion to respect `kitchen_pos_orders_enabled`: when POS tickets are hidden from kitchen (default), full cash payment completes the POS order/ticket; when enabled, an active kitchen ticket remains for kitchen handoff, and handoff does not add the payment to cash a second time.
- Narrowed the customer online-payment DTO to `CASH`. The DB checkout integration sends unsupported `CLICK`, `PAYME` and `CARD` values and confirms rejection; historical payment rows and display labels were not removed.
- Searched active application source for NBU/`QR_ID`/bank-SMS reconciliation. No such integration exists; historical notes are cancelled, not active runtime behavior.
- Backend 746/746 tests, HTTP retry 3/3, targeted lint/typecheck, and CI run #874 (`38547858823`) passed, including Windows desktop packaging, the full verify pipeline, unified cash DB integration, customer checkout/outbox DB integration and production-mode health smoke.
- Built exact commit `379f3c0660c054d8e1e50e1ff66b37744c3b0e7b` as `mazetto-staging-api-crmkze:379f3c0`, image ID `sha256:31abad2c25f3c84935f4b0f035aeb51db60b439145c468d7b7d7fd0d294084b8`. Deployed only to staging service `mazetto-staging-api-crmkze` with stop-first update and rollback-on-failure; service converged.
- Before deploy, verified staging-only backup `/home/javohir/backups/mazetto-staging/mazetto-staging-before-pr303-379f3c0-20261014T101942Z.dump` (299,114 bytes, SHA-256 `80a2a101ca6ab6e3056946bfc0e9242c6fba37f9f9dcea2d6519c1059311d8c7`; `pg_restore --list` passed, 722 archive entries). Previous image remains available as `rollback-98f4027`.
- After rollout, health was HTTP 200 with PostgreSQL `ok` and Redis `connected`; migration status remained 62/62 (no migration was added). Exact-image staging A/B passed tenant membership/cache, order delivery/reconnect, logout revocation, host/domain, report/audit, OTP and media isolation; cleanup assertions restored one baseline tenant and zero test fixtures.
- This staging run proves startup and tenant isolation, not an authenticated cash write-path, real staff/device acceptance or production settlement. Production remains at `951f344`; no production migration/deploy and no second-restaurant activation occurred.

## Assigned printer queue concurrency (2026-10-14)

- Printer audit found the Desktop server-job worker claimed and awaited every print job serially, even when backend jobs targeted distinct assigned printers. The unassigned-job regression test explicitly required serial writes.
- Assigned jobs use one serial lane per physical queue, with at most four distinct queues active and a shared cap of five claimed jobs per tick. Duplicate local records are grouped by the matched Windows queue name; TCP records sharing normalized host and port are grouped too. Distinct queue writes can run concurrently. Unassigned jobs, which can fan out across Windows queues, remain serial and run after assigned lanes to avoid overlapping writes. Local offline queue behavior is unchanged.
- Automated tests prove two different printers can print concurrently while each printer's order is preserved, and duplicate Windows queue records remain sequential; the five-job cap and serial unassigned queue tests remain in place.
- First implementation verification: print-worker 39/39, full Desktop suite 180/180, typecheck/lint/build/preload build, and GitHub CI #876 passed. Follow-up duplicate-queue verification: print-worker 40/40; full Desktop 181/181; typecheck, targeted ESLint, Desktop TypeScript build and preload build passed. GitHub CI #878 (38555113236) passed Windows installer packaging and full verify, including migrations, CI tests/builds/validators, cash DB integration, checkout/outbox integration and backend health smoke. CI #876 did not include the follow-up.
- PR #303 follow-up commit `59d34e22558918da85622cc8abad629e17607dfe` is pushed after initial printer-worker commit `ef03afc3d202405162d124f54437cfebfb81a736`. No staging backend redeploy was needed because these changes affect only Desktop code; staging API remains `mazetto-staging-api-crmkze:379f3c0`. CI built an installer but does not publish or install it. Physical simultaneous multi-printer acceptance and production Desktop release remain open; Godex G500 single-printer confirmation does not prove concurrency. Grouping protects identical configured Windows queue names and TCP host/port pairs; separate aliases for the same hardware cannot be inferred automatically.
- NBU QR/SMS reconciliation was not present in active application source during this audit. Cash-only controls remain in place; historical payment rows and cancelled audit notes were preserved.

## Legacy shift cash reconciliation (2026-10-14)

- The owner confirmed current cash-only operation and cancelled NBU integration. A literal NBU search found no active reconciliation code in backend, POS web, customer web, or Desktop. NBU analysis files remain explicitly marked cancelled historical notes; payment schema and historical records were preserved.
- Read-only production aggregates for the last 30 days found 21 CASH payments totaling 1,645,000 so'm; each had one equal ORDER revenue record and one equal SALE cash transaction. No refunds were recorded in that window.
- The same read-only review found that 15 of 24 shifts closed in the last 30 days stored an expectedCash different from current-ledger recomputation. All 24 stored cashDifference values still equal closingBalance - expectedCash.
- Root cause: old SALE ledger rows have no Payment link, while the old shift-close formula derives cash sales only from Payment records. Current linked SALE rows must not be counted again.
- calculateShiftTotals now includes unmatched legacy SALE rows once in shift sales/cash totals, counts linked SALE plus Payment once, and keeps a CASH-Payment fallback when its SALE row is absent. No historical production ledger values were rewritten.
- Verification: focused shift tests 5/5; full backend suite 747/747; backend app and script typechecks passed; Nest build and HTTP retry tests 3/3 passed. Full-file Prettier still flags existing formatting elsewhere in shifts.service.ts; the edited calculation and test blocks are formatted. ESLint/npm runner was unavailable on the server checkout.
- Commit 75d915c was pushed to PR #303, passed CI #881, and deployed only to staging as image mazetto-staging-api-crmkze:75d915c. The staging-only pre-deploy backup is /home/javohir/backups/mazetto-staging/mazetto-20261014-115612441.dump (299,114 bytes; SHA-256 59fd35d5bb26455e562277249a5a610fe1f3d57d5c558f6710c40b30dd240fa5; pg_restore --list: 707 entries). The previous staging image is rollback-75d915c. Health returned 200 with PostgreSQL ok and Redis connected; migrations remain 62/62. No authenticated staging cash write was run. Production remains 951f344 with no writes, migration or deploy; the second restaurant remains inactive.

### Read-only reconciliation recheck (2026-10-14)

- Rechecked the production `mazetto` database inside a read-only transaction with a 10-second statement timeout. The trailing 30-day window contained 23 closed shifts; the candidate calculation matched stored `expectedCash` for 21. Stored `cashDifference` equaled `closingBalance - expectedCash` for all 23.
- Detail query isolated shifts #31 and #34 (2026-10-09). In both, candidate recomputation equals recorded `closingBalance`, and all cash movements predate close. Shift #34's 503,000 so'm gap is exactly two unlinked legacy SALE rows. Shift #31 has 14 unlinked SALE rows totaling 862,000 so'm, equal to closing balance, while stored `expectedCash` is 527,000 so'm; the old payment/revenue source cannot be reconstructed from current rows.
- These are historical traceability gaps, not demonstrated cash drawer shortages. No production rows were changed. The earlier "15/24 expectedCash mismatches" wording is not reproducible with the exact 30-day window and candidate formula; do not use it as a confirmed mismatch count.
- On branch head `4f2ac98`, focused payment/kitchen/shift tests passed 49/49. CI #882 (`38561052369`) passed both `verify` and `windows-desktop-package`. The API image remains `75d915c` on staging with health 200 and migrations 62/62; production remains `951f344`. The owner's NBU cancellation stands: no active NBU QR/SMS code exists, cash-only is enforced, and historical payment/schema records remain intact.


## Inventory source-movement concurrency (2026-10-14)

- Inventory audit found the source-key race path caught a PostgreSQL unique violation and queried again in the same transaction; PostgreSQL marks that transaction failed. A replay conflict could therefore fail instead of returning the original movement.
- Source-key movements now use `createMany(skipDuplicates: true)`; only the transaction that inserted the movement updates stock. Manual movements without source keys still use normal `create`.
- Added a parallel replay unit test proving one movement and one quantity increment, plus a real PostgreSQL test in `validate-unified-cash-db.ts`.
- Verification: inventory lifecycle tests 5/5, backend suite 748/748, HTTP retry tests 3/3, backend app/script typecheck, targeted lint and Prettier all passed.
- A fresh disposable database received all 62 migrations; the unified cash DB validator passed with the concurrent inventory replay. Its temporary `cash_qa` database was dropped; the pre-existing `ci` and `postgres` databases were preserved.
- No schema migration or production write was made. The code fix has not yet been pushed or deployed; staging and production remain unchanged pending CI and staging rollout.

## Order mutation guard and inventory staging checkpoint (2026-10-14)

- This checkpoint supersedes the preceding inventory entry's pending-release status: the source-movement fix was pushed as `d4ddb38` to PR #303. GitHub Actions run #885 (`38565939222`) passed `verify` and Windows Desktop packaging.
- Exact image `mazetto-staging-api-crmkze:d4ddb38` was deployed only to the isolated staging service. The pre-deploy backup `/home/javohir/backups/mazetto-staging/mazetto-20261014-before-inventory-race-d4ddb38.dump` is 299,114 bytes, SHA-256 `cc663c8a3cd1c1752f194eb35e19f5d9bfcdde3c033636d596b19e973615d32f`; `pg_restore --list` returned 722 entries. Candidate health was HTTP 200 with PostgreSQL and Redis healthy; Prisma reported 62/62 migrations. The exact-image tenant A/B harness passed and cleaned up its fixtures.
- A separate order-lifecycle audit found that item additions and edits remained possible after kitchen submission, so persisted order contents could diverge from the existing kitchen ticket and stock effects. New item additions and quantity/modifier/note edits are now limited to `NEW` orders; item cancellation remains available through its existing path.
- The unified cash PostgreSQL validator now creates a NEW order, adds an item, submits it to the kitchen, and asserts later additions/edits are rejected without changing quantity or duplicating the kitchen ticket. Fresh disposable DB validation passed after all 62 migrations. Backend tests passed 748/748, shared HTTP retry tests 3/3, backend application/script typechecks and targeted ESLint passed.
- At the time of this pre-release checkpoint, the order-mutation guard and validator were uncommitted and had not passed CI or staging. Production remained unchanged; no production migration/write/deploy or second-restaurant activation occurred. NBU was cancelled by the owner; no active NBU integration exists in application source, and the cash-only policy remains in force. Untracked `.orig`/`.~N~` artifacts were left untouched.

## Order mutation guard staging rollout (2026-10-14)

- Commit `e5b201d354ecb436350b87ee0239f188ed9940db` was pushed to PR #303. GitHub Actions run `38570267400` passed full verification and Windows Desktop packaging, including clean-database migrations, unified cash DB integration, checkout/outbox integration and production-mode health smoke.
- Built exact image `mazetto-staging-api-crmkze:e5b201d` (image ID `sha256:fc75dbeda8327395d4f7ce66169f352ca7ab87eca7cc69191d3cffdcf07a2d20`). Previous image was preserved as `rollback-e5b201d`. Pre-rollout staging backup `/home/javohir/backups/mazetto-staging/mazetto-20261014-before-order-guard-e5b201d.dump` is 299,114 bytes, SHA-256 `9c746ad4dd8f90f6e5096019b3eeb3bbf8af51dd8e9170b16e8f3abc3dd67ab0`; `pg_restore --list` returned 722 entries.
- The staging service converged after the 60-second rollback-on-failure monitor. Health returned HTTP 200, PostgreSQL `ok`, Redis `connected`, and Prisma reported 62/62 migrations. The exact-image tenant A/B harness passed and cleaned up its synthetic fixtures.
- The authenticated order-mutation route itself had not been exercised at this checkpoint. Production service/database remain unchanged; there was no production migration/write/deploy and the second restaurant remains inactive.

## Authenticated order mutation route staging acceptance (2026-10-14)

- The A/B staging harness now exercises the real staff HTTP routes on the exact running runtime image `mazetto-staging-api-crmkze:e5b201d`; the harness itself was copied to a temporary container path and did not alter the deployed app image.
- Staff login, adding an item to a `NEW` order, and kitchen acceptance passed. Subsequent item-add and quantity-edit requests both returned HTTP 400; persisted quantity stayed 1 and the order retained exactly one kitchen ticket.
- Commit `1d48cde000251a88dbf6ba3d838ff5cee41d07d7` passed GitHub Actions CI #888 (`38575702066`): full `verify` and Windows Desktop package jobs both succeeded.
- Tenant A/B staff realtime delivery and reconnect/replay checks passed. The harness compares unique aggregate/order IDs so multiple valid lifecycle events for one order do not appear as cross-tenant leakage.
- Fixture cleanup passed. A read-only post-run query showed the single pre-existing tenant and zero fixture branches, users, employees, memberships, domains, customers, orders, order events, outbox events, kitchen tickets, permissions or roles.
- Staging runtime remains `e5b201d`, with no schema change; production service/database were not contacted for writes, no production deployment occurred, and the second restaurant remains inactive. Physical/employee acceptance and the production release gate remain distinct.

## Tenant-scoped kitchen POS visibility staging acceptance (2026-10-14)

- Extended the guarded A/B harness with an authenticated kitchen view role and real settings/kitchen HTTP requests. The test creates a POS order and kitchen ticket, verifies the setting defaults off, and checks the ticket is hidden.
- Enabling kitchen_pos_orders_enabled for tenant A made its ticket visible immediately. Tenant B's setting remained off and its kitchen endpoint could not see tenant A's ticket. Disabling the setting hid the ticket again.
- The exact running staging image was mazetto-staging-api-crmkze:e5b201d; only the disposable harness file was copied into the container. No app image, schema, production service or production data was changed.
- Harness completion and cleanup assertions passed: synthetic settings, roles, permissions, orders, tickets and other fixtures returned to the one-tenant, zero-fixture baseline. The temporary test script was removed from the container.
- Commit bd5276b0df52f1a413f171484b6c11ff6f4ea623 adds this guarded staging test to PR #303. GitHub Actions CI #890 (38579945599) passed full verify and Windows Desktop packaging. No staging redeploy or production deploy is required for this QA harness/documentation-only change.

## DINE_IN pay-later cashier staging acceptance (2026-10-14)

- The guarded tenant A/B harness now opens a temporary cashier shift, creates a POS DINE_IN order with payLater enabled, and retries the same idempotency key. Both responses resolve to one PENDING order and one PaymentOperation.
- Against the exact staging runtime mazetto-staging-api-crmkze:e5b201d, the order persisted only its KITCHEN ticket receipt; no customer RECEIPT, Payment, RevenueRecord, or order-linked CashTransaction appeared. The shift retained zero sales/cash totals and only its zero opening-balance row.
- The added POS order's live socket delivery and reconnect replay were included in tenant A's expected event set; tenant B remained isolated. The cleanup now removes payment, receipt, cash, revenue, operation and shift rows and verifies their baseline counts.
- The exact-image A/B harness passed and restored the staging database to its one-tenant, zero-fixture baseline. node --check, Prettier and git diff --check passed. This QA/docs-only update does not rebuild or redeploy the app.
- Production remains unchanged; no production database writes, migrations, app deploy or second-restaurant activation occurred. WEB/Telegram settlement and the remaining ledger/history checks stay separate acceptance gates.

## Immediate POS cash-sale staging acceptance (2026-10-14)

- The guarded tenant A/B harness now creates a temporary branch-scoped CASH method, logs in an authenticated synthetic cashier, submits a POS TAKEAWAY cash sale, and retries the same idempotency key.
- Against the exact staging runtime mazetto-staging-api-crmkze:e5b201d, the order has exactly one SUCCESS cash payment, one ORDER revenue row, one SALE cash transaction, one payment operation, and the expected KITCHEN plus customer RECEIPT documents. The replay returned the same order without duplicate financial rows.
- The shift API reported currentCash=1000 and two shift orders (the prior unpaid DINE_IN plus this paid takeaway); the unpaid DINE_IN remained excluded from payment/revenue/cash totals.
- Cleanup deleted the temporary payment method, permissions, orders, receipts, ledger rows and shift, then asserted the staging counts returned to the one-tenant, zero-fixture baseline. The temporary script was removed from the container.
- CI #892 passed full verify and Windows Desktop packaging for the preceding checkpoint; this cash-sale harness change needs its own CI run. It changes QA/docs only, so no app image rebuild or staging redeploy is needed.
- A literal source scan found no active NBU QR/SMS integration. Cash-only policy is already live; cancelled NBU analysis remains historical documentation, with schema and historical payments untouched.
