# Mazetto Food: 2026-10-10 code and workflow audit

This is the current release audit, scoped to the live server checkout. Earlier audit files are historical snapshots and are not proof of the current production state.

## Scope and evidence

- Inventoried 1,241 tracked repository files, including 818 tracked JavaScript/TypeScript-family files under `apps/`, `packages/`, and `scripts/`. Reviewed the active money, print, offline, shift, tenant, checkout, and notification flows through focused source inspection, tests, validators, and production smoke checks.
- The previous full workspace run passed 748 tests (backend 546, Desktop 136, POS 44, customer 17, Telegram 5). Typecheck and lint passed for all workspace projects. The repository's 33 operations validators passed. All workspace builds passed. After deployment #290 (a6707ab), the independent read-only production smoke passed 27/27.
- Follow-up local verification: backend source and script typechecks passed, all 548 backend tests passed, the changed Telegram service passed ESLint and the Nest production build. Customer web passed TypeScript, ESLint, 17 tests and production build in its separate release check.
- Ran an isolated browser flow with 205 mocked orders, 80 mm and A4 report rendering, 375/768/1366 px UI, automatic print invocation, reprint without a second close, and an offline post-close fetch failure. No production order or payment was created.
- A verified production database backup was written before release: `/mnt/storage/backups/mazetto/postgres/mazetto-20261009-190500773.dump` (532,612 bytes; 703 archive entries). No database migration is part of this change.
- These checks are broad regression coverage, not a claim that every source line or every physical device has been manually exercised.

## Corrected in this release

1. Shift close report: cashier close now requests every page of shift orders after closing, then opens an isolated print document with completed/delivered, cancelled and in-progress sections, each order's items, group subtotals, cash reconciliation and order count. Admin close also invokes printing. Closed shifts can be reprinted from both cashier history and admin shift details.
2. Shift membership: the backend includes orders created in the shift and orders whose revenue was recorded in the shift, while retaining tenant and branch scope. Paging has a stable secondary order key. The cashier's amount and date sort is applied by the backend before pagination.
3. Report accuracy: order face value is labeled separately from recorded shift sales revenue; cancelled orders are explicit. Invalid amounts are shown as unavailable, never silently folded into zero. User text is HTML escaped. A failed post-close fetch can use the pre-close snapshot with a prominent provisional/offline warning.
4. Receipt notes: empty or whitespace-only order and item notes are hidden in Windows-rendered and ESC/POS output. Real notes remain. Order service type is displayed separately.
5. Cashier history: payment refund records are included in the response, so refund details can actually render. Switching shift/filter/search now cancels the previous request, preventing stale results from replacing the selected view. After item cancellation, history reloads from the first page.
6. Desktop version increased to 0.1.106 so its changed renderer can be shipped as a new Windows release.
7. Paid online-order item refunds use the cashier-selected open shift only after the backend verifies branch scope and a matching successful sale transaction for every allocated payment; the refund is recorded against that shift.
8. Customer order-detail realtime refreshes are filtered to the displayed operational order ID. Customer-scoped rooms and the history dashboard behavior remain intact.
9. Three unreferenced legacy Telegram customer-auth helpers were removed; active menu, order, profile, branch and cart flows remain in their existing handlers/order service.

## Reviewed with no code changes

- Checkout/order/payment authority remains in the backend. Cash balance and shift sales records remain distinct.
- Shift history access continues to enforce tenant, branch, own/branch permission checks. The report only uses that authorized endpoint.
- Existing Desktop printer routing and deduplication tests pass; the shift report currently uses the operating system's browser print dialog.
- BestTeam platform and media files were not changed. BestTeam Control is a separate product from the restaurant POS/admin interface; the customer-web and Telegram changes above do not alter restaurant POS/admin workflows.

## Remaining operational and product gaps

- A browser print invocation is not proof that a printer fed paper. The shift report has not been physically tested on the restaurant's eventual receipt printer. Select its driver/paper in the print dialog and check a real multi-page shift. Godex G500 90 x 80 mm label printing was previously confirmed for receipts, not this long shift report.
- Offline shift close is refused while this user's branch has unresolved POS-order creation, cash-payment, or cash-transaction commands (pending, sending, conflict or dead-letter). A close with no pending cash posting can still be queued offline; its report remains provisional until server confirmation, and no automatic replacement print is asserted.
- Shift-history counts include orders created during the shift and legacy orders whose revenue was recorded in it, deduplicated by order. The UI now labels this total "Smenadagi buyurtmalar"; the close report lists the same broader set.
- The shared NBU QR's SMS contains no order ID. Same-amount payments cannot be assigned automatically or marked paid from an SMS alone. Bank API/reconciliation evidence is needed; see `docs/NBU_QR_RECONCILIATION.md`.
- Desktop 0.1.116 is the grouped release target for the current offline identity and multi-printer replay fixes. The existing 0.1.115 release does not contain these uncommitted changes; after publishing, install 0.1.116 on each workstation. Browser/POS updates do not replace an installed executable automatically.
- Production smoke is read-only and cannot prove a real customer checkout, a bank settlement, a shift with 205 real orders, Telegram delivery, or hardware spooler behavior. Those require controlled acceptance checks with the restaurant.

## Follow-up acceptance order

1. [x] Confirm production deploy #297 at `e3cb9c7` and read-only smoke 27/27. Desktop 0.1.110 is published; workstation installation remains separate acceptance.
2. Install Desktop 0.1.116 after it is published, then verify customer receipts omit the logo and organization name by default, kitchen tickets retain their separate settings, and both customer-receipt branding controls can be enabled again. Also test an already-cached unpaid order offline, reconnect sync, and manual reprint.
3. Close a controlled low-value test shift with multiple statuses on the restaurant workstation; inspect all printed pages and compare count, cancelled rows, payment entries, expected cash and closing cash with admin history.
4. Test restricted cashier/branch-manager roles, offline close and sync, and a paid online-order item refund against the selected shift without using a real customer payment.
5. Obtain NBU's merchant transaction API/export contract before implementing QR auto-reconciliation.

## Follow-up verification (2026-10-10)

- Production is now deploy #292 at `f320fd3`; the deploy workflow succeeded and independent read-only production smoke passed 27/27.
- Read-only checks returned HTTP 200 for apex and `www` home/checkout, POS dashboard, and API health. This does not exercise authenticated actions.
- Customer access tokens are memory-only in customer web; profile-only persistence, migration of old browser data, and refresh readiness were tested in PR #258. Real OTP/login was not exercised.
- Desktop credential storage is present in release 0.1.106: opt-in saved accounts use Electron `safeStorage`; it is not Chrome's native password prompt. Four targeted tests and Desktop/POS typechecks passed. Each workstation still needs the release installed and an account must opt in.
- Cashier payment-method tenant toggles are enforced both in catalog reads and payment writes. Backend payment/shift tests passed 18/18; POS checkout/kitchen tests passed 10/10. Customer checkout remains cash-only because no provider callback/reconciliation is connected.
- Kitchen pickup handover blocks unpaid balances and routes payment to cashier; it does not add cash from the kitchen screen.
- Shift close still loads all pages and prints grouped order detail; physical printer and offline-sync acceptance remain pending.
- Telegram map locations use an explicit Google Maps button with previews disabled; focused map/staff-panel tests passed 4/4. Historical group messages were not remotely edited.
- Repository scan found no tracked build/cache/database artifacts or actionable TODO markers. `.gitignore` now excludes local dump and SQLite runtime formats. No uncertain source files or dependencies were removed.
- Offline cashier payments now project a fully covered order as paid in cached payment queues. Offline shift close fails closed while unresolved POS-order or cash-payment commands remain for the branch. The Desktop suite passes 137/137; gateway coverage is 44/44; Desktop typecheck and focused ESLint pass.
- Human acceptance still needed: install Desktop 0.1.114 on workstations, test real receipt/shift paper on the chosen printer, verify offline close after sync, and obtain NBU merchant API/export details before automating QR reconciliation.
- Follow-up audit found offline expense/income commands were optimistically added to the shift balance but omitted from the offline-close guard. Version 0.1.108 includes that guard and a regression test; Desktop CI run #745, release #157, and deploy #294 succeeded. The release published `MAZETTO-Desktop-0.1.108-x64.exe`, and production tag now points to `9db7333`. Dokploy found no backend/web/Telegram service to deploy, so production smoke was skipped. Workstation installation remains separate acceptance.
- A subsequent cash-flow audit found a separate projection gap: queued offline cash payments marked orders paid but did not update the open shift's expected/current cash, cash sales, or distinct order count. The follow-up fix adds pending `SALE` ledger rows and projects those totals idempotently; the targeted offline-payment regression and full Desktop suite (138/138), Desktop typecheck, and diff validation pass. CI remains the final lint/release authority.
- Offline payment processing for an existing order now fails closed unless the device has a no-older-than-12-hours order and OPEN shift cached for the same branch and employee, the order is still unpaid/non-delivery, its complete active items are available, and the cash tender equals the exact outstanding balance. The payment and matching local receipt print job are persisted atomically; the receipt retains the real order source/number/items and current payment time, and the POS tells staff to check the paper output. Regression cases cover stale/missing cache, wrong employee, wrong shift, wrong branch, and amount mismatch.

## Current release confirmation (2026-10-10)

- PR #263 was squash-merged as `e3cb9c76d147582a478d563591a2ab8065992649`; production deploy workflow #297 succeeded and the remote `production` tag points to that commit.
- Desktop 0.1.110 was published. Main CI passed, and the independent read-only production smoke passed 27/27 after deployment.
- No database migration was needed for this release. Production checks do not replace workstation installation, a physical printer test, or a controlled offline payment-and-sync acceptance run.

## Audit continuation: inventory readiness

- The backend already exposes branch-scoped inventory readiness, but the POS admin inventory page did not consume it. A branch with recipe-backed items and no active warehouse could therefore reach order confirmation before the structural problem was visible in the admin UI; stock deduction then aborts the confirmation transaction.
- The inventory page now checks readiness for the selected branch (or the signed-in user's branch), avoids displaying a previous branch's late response, explains missing active warehouses and archived recipe ingredients, and links to recipe management only when the user has that permission. Global-scope users are prompted to choose a branch.
- A green readiness message means only that the warehouse and recipe structure pass these checks. It does not prove that ingredient quantities are sufficient.
- Focused validation passed: POS ESLint, TypeScript, tests 44/44, and optimized production build. The full repository CI/deploy workflow remains the release gate.

## Audit continuation: generated business numbers

- Rechecked historical finding AUD-005 against current code. Display order numbers use a transaction-scoped advisory lock; shift numbers use a branch-scoped advisory lock; POS checkout/order creation already retried unique-constraint conflicts. Customer/Telegram and waiter table-order transactions previously did not retry. The UUID hyphen was also being counted as part of order, kitchen-ticket, and receipt suffix lengths, leaving fewer random hex characters than intended.
- POS checkout/order, customer web/Telegram, and waiter table-order creation now use bounded whole-transaction P2002 retries. All business order numbers share one generator with their existing POS/WEB/TG/WTR prefixes and a 12-hex random suffix; the unused duplicate customer-order and waiter generators were removed. Kitchen ticket and receipt numbers now also take 12 actual hex characters after stripping UUID separators. Database uniqueness constraints remain authoritative.
- Receipt allocation still performs bounded candidate checks before insert. A highly unlikely race between the candidate lookup and insert can still abort a transaction with the unique index; no duplicate can be stored, but non-POS receipt transaction callers do not all have an outer P2002 retry. No migration or numbering schema change was introduced.
- Unit tests cover successful bounded retries, exhaustion, non-unique errors, POS/WEB/TG/WTR number formats, and receipt format. Backend verification passed: all 551 tests, ESLint on touched source/test files, app and script TypeScript checks, and Nest build. Full CI and production release remain the release gate.

## Audit continuation: manual receipt reprint

- Found a print-queue collision between offline replay protection and the explicit reprint action. After an offline receipt had printed locally and synced, Desktop treated every later server job for the same order/document type as a duplicate, so a cashier's manual reprint could be marked complete without reaching paper.
- Manual reprint jobs now carry an internal opt-in marker in the durable payload. Desktop skips local replay deduplication only for those jobs and strips the marker before sending content to the printer. Normal sync replay retains duplicate suppression; invalid/empty receipt data still fails printable-content validation rather than silently printing a blank page.
- No database/schema migration was needed. Regression coverage verifies the tenant-scoped reprint service adds the marker only for an explicit reprint, Desktop still suppresses ordinary replay, and a manual reprint reaches the configured system printer without exposing the internal marker in receipt content.
- Verification passed for the reprint change: backend tests 553/553, Desktop tests 139/139, focused ESLint, backend app and script TypeScript checks, Desktop TypeScript check, Nest build, and Desktop TypeScript/preload build.

## Latest release confirmation (2026-10-10)

- PR #267 merged as `d8b78df5011f9be4d80a3e4221e0d54d90574ebb`; Deploy #301 succeeded, including production smoke 27/27. The `production` tag was verified at this server-code commit.
- PR #268 then published MAZETTO Desktop 0.1.111. Desktop Release #163 succeeded and published the versioned installer, `latest` installer, blockmap, and `latest.yml`.
- Deploy #302 for the version/document-only commit succeeded and advanced `production` to `d4098e18d79e5ccce6abb28d9ebec492390a8e6c`; its production smoke was skipped because no runtime service inputs changed. Deploy #301's smoke covered the server runtime change.
- Installing Desktop 0.1.111 at the restaurant and physically verifying a requested reprint remain human acceptance steps.

## Audit continuation: customer receipt branding defaults

- The receipt editor already had separate logo and organization-name toggles per document type. The customer receipt defaulted both on, and saved legacy profiles survived app updates, so changing only the fresh-install defaults would not correct existing workstations.
- Customer receipt branding now defaults off. Desktop profile schema v2 migrates only legacy customer receipts that still have the default `MAZETTO FOOD` name and both default branding controls enabled; it preserves kitchen/other document profiles, custom organization names, and explicit hide choices. After migration, staff may turn either customer receipt option back on and that choice persists.
- Desktop version is 0.1.112 so the migration can reach installed workstations. POS/desktop type contract now includes the profile schema version. There is no backend/database change.
- Focused receipt tests passed 17/17 and the full Desktop suite passed 142/142. Focused ESLint, Desktop TypeScript build/preload build, and POS TypeScript check passed. Physical paper verification is still required after installing 0.1.112.

## Audit continuation: legacy shift opening balance

- The live cashier summary rebuilt the current drawer balance from cash ledger rows starting at zero. For an older/open shift whose stored `openingBalance` had no `OPENING_BALANCE` ledger row, the UI omitted the opening float even though shift-close and transfer calculations already had a legacy fallback.
- Current shift balance now uses `openingBalance` only when the opening ledger entry is absent, matching the established shift calculation and avoiding double-counting when the ledger entry exists.
- Regression tests cover both legacy and ledger-backed shifts. Backend suite passed 555/555; the new focused history suite passed 7/7; ESLint, backend app/script TypeScript checks, Nest build, and `git diff --check` all passed. Full CI and production release remain the gate for this continuation.

## Release confirmation: cashier item-cancellation permissions

- PR #270 was squash-merged as `cc6d708d2c1ece09ad3c878c9a315d39f8162d19`; Deploy #304 succeeded, production smoke passed, and the `production` tag was verified at that commit.
- POS history returned HTTP 200 in a read-only production request. No migration or Desktop release was needed.

## Audit continuation: item-cancellation payment status

- A service-level transaction regression exposed a financial status bug: after cancelling an item, order totals were recalculated and the code then subtracted that item's price a second time when deciding whether the remaining order was paid. An underpaid remainder could therefore be marked `PAID` incorrectly.
- The remaining total is computed once from the pre-cancellation order and reused for refund calculation and post-cancellation payment status. A follow-up check found that order-level status must represent whether the _new_ total is still owed, while the payment row retains its own `PARTIALLY_REFUNDED` audit status. The order is now `PAID` when net payments cover the reduced total, `PENDING` when a balance remains, and `REFUNDED` only when the zero-total order's funds have been fully returned. This prevents a fully covered pickup order from reappearing in the cashier queue while keeping underpaid orders payable.
- End-to-end service tests cover the cash refund ledger/receipt/revenue row and same-shift association, underpaid and exactly paid remainders, a prior refund with a remaining balance, non-cash refund rejection, and closed-shift rejection. Backend tests pass 560/560 (including the three transient-retry script tests); the focused cancellation suite passes 5/5. Backend ESLint, app/script TypeScript checks, Nest build, and `git diff --check` pass. Full PR CI and production release remain the gate.

## Release confirmation: legacy shift opening balance

- PR #269 was squash-merged as `bc92b7b7966c0e005736f426f5946378588b4868`; production Deploy #303 succeeded, including production smoke, and the `production` tag was verified at that commit.
- No migration was required. Physical workstation acceptance remains outstanding as listed above.

## Audit continuation: cashier item-cancellation permissions

- The server requires `PAYMENT_REFUND` only when cancelling an item creates an actual refund. The cashier history UI previously hid the cancel action for every order unless the user had that permission, including unpaid or still-underpaid orders where no refund is due.
- The UI now estimates the remaining paid balance from successful tenders and recorded refunds, and requires the extra permission only when the cancellation needs money returned. Invalid monetary data fails closed; the backend remains authoritative.
- Regression coverage checks unpaid, underpaid, overpaid, already-refunded, and invalid-value cases. POS web tests passed 48/48; POS ESLint, TypeScript, and optimized production build passed. `git diff --check` also passed.
- Full PR CI and production release remain the gate for this continuation. Backend refund authorization and accounting remain authoritative; the UI check only avoids offering an action that the backend must reject.

## Release confirmation: item-cancellation payment status

- PR #271 was squash-merged as `59449f250ad6598a32c8cbde36fe6a0279c997e7`; main CI #770 and production Deploy #305 succeeded, including production smoke. The `production` tag points to the merge commit.
- Read-only production checks returned HTTP 200 for the POS history page and the actual backend health path `/api/v1/health`. No database migration or Desktop release was required.

## Audit continuation: kitchen pickup refund balance

- Cross-role review found that kitchen handoff UI and backend validation counted only full `PAID`/`SUCCESS` payment rows and ignored partial-refund ledger rows. After an item cancellation, a refund could either show the full order as due or make the backend reject a correctly paid reduced-total pickup. The offline kitchen bootstrap also omitted payment details entirely.
- Kitchen API and offline bootstrap now include tender refund amounts; the UI and authoritative handoff check calculate net paid after refunds. Offline snapshots without the required payment/refund fields are rejected rather than used to show a misleading balance. No schema migration is required.
- Regression coverage verifies a refunded, fully-covered reduced order can be handed off, a genuine remaining balance still blocks handoff, refund-aware balance display, safe rejection of stale offline cache data, and the payment/refund fields in the branch-scoped bootstrap. Backend tests passed 562/562 plus transient-retry 3/3; focused kitchen/backend bootstrap tests passed 19/19; POS tests passed 51/51. Backend and POS ESLint, backend app/script and POS TypeScript checks, Nest build, POS production build, and `git diff --check` passed.

## Audit continuation: partial refund reporting

- Found that report queries treated only `PAID` and `SUCCESS` tenders as collected money. A cash payment changed to `PARTIALLY_REFUNDED` disappeared entirely from sales, cashier and product payment filters, even though the refund was separately reported. This understated the original payment and made the refund breakdown impossible to reconcile.
- The generic refund path also marked the order `PARTIALLY_REFUNDED` whenever any refund existed, even if the remaining payment still covered the order total. Order-level status now follows the same balance rule as item cancellation: `PAID` when net payment covers the current total, `PENDING` when it does not, and `REFUNDED` when all collected funds have been returned. The payment row continues to preserve its own refund status.
- Sales, payment-method, employee and product tender filters now include partial-refund payment rows; the refund amount remains separately reported. Product reporting still requires a settled order-level payment status, so an order with an outstanding balance is not counted as a completed product sale. Fully refunded payments remain excluded, matching the existing report rule.
- Regression coverage checks a 74,000 so'm payment with a 24,000 so'm refund: 74,000 remains visible as gross collected cash and 24,000 is shown separately. It also checks payment status filters across sales, product and employee reports and that fully refunded rows remain excluded.
- Regression coverage also verifies that a partial refund leaves a fully covered order `PAID` while an underpaid remainder stays `PENDING`. Verification passed: full backend test suite 564/564, transient HTTP retry tests 3/3, refund/report tests 8/8, focused ESLint, backend app/script TypeScript checks, Nest build, and `git diff --check`. No schema change or migration is needed; PR CI and production release remain the gate.

## Audit continuation: cashier collection after a partial refund

- After the generic refund path was aligned to order balance, a follow-up cashier-flow review found `processOrderPayment` still calculated outstanding balance from only `PAID`/`SUCCESS` rows and ignored refund ledger entries. A 74,000 so'm payment with 24,000 so'm refunded could therefore present the original 74,000 as still due and allow the cashier to collect more than the 24,000 so'm net balance.
- The order payment query now loads refund rows, and outstanding balance uses net collected value from successful or partially-refunded payment rows, subtracting refunds and clamping inconsistent negative values to zero. Failed, pending, and fully-refunded payment rows remain excluded.
- A regression test asserts that attempting to collect 50,000 so'm when only 24,000 so'm remains fails before payment-method resolution. Verification passed: full backend suite 565/565, transient HTTP retry tests 3/3, focused payment tests 5/5, ESLint, backend app/script TypeScript checks, Nest build, and `git diff --check`. No schema change or migration is required; PR CI and production release remain the gate.

## Release confirmation: cashier collection after a partial refund

- PR #274 was squash-merged as `7ec3c0649dd0b705d624dd82040a7f01b615da41`. Main CI #777 and production Deploy #308 succeeded; the `production` tag points to the merge commit.
- Read-only production checks returned HTTP 200 for API health, POS history, and the customer site. The server checkout is clean on `main` at the deployed commit.

## Audit continuation: refunds recorded in a later shift

- Reviewing shift-close accounting found that its payment query matched any revenue record in the shift. A payment refunded in a later shift has an `ADJUSTMENT` revenue record there, so the query could pull the original gross payment into the later shift's sales and cash totals, then also subtract that shift's refund transaction. This overstated expected cash and duplicated sales across shifts.
- The close snapshot now includes payment tenders only when their `ORDER` revenue record belongs to that shift. Order count still uses all revenue linked to the shift, so a refund-only order remains visible in the shift report. Refunds continue to reduce expected cash through the shift's cash-refund ledger entry. Ordinary and force-close paths share the same snapshot calculation.
- A regression test closes a later shift with a 50,000 so'm opening balance, a 24,000 so'm refund, and 26,000 so'm counted cash; it verifies zero cash difference and confirms the original payment is not imported into that shift. Local validation passed: backend tests 566/566, transient retry tests 3/3, focused shift tests 4/4, focused ESLint, backend app/script TypeScript checks, Nest build, and `git diff --check`. No migration is needed; PR CI and production release remain the gate.

## Audit continuation: dashboard revenue after a partial refund

- The main sales report retains partially refunded tenders as gross collected revenue and lists refunds separately, but the admin dashboard fallback summary filtered them out completely. If the detailed report failed or was unavailable, the same day's revenue number could be lower than the sales report.
- Dashboard summary now includes `PARTIALLY_REFUNDED`, while continuing to exclude fully refunded payments, matching the existing report rule. A tenant-scope regression asserts the exact status filter. Local validation passed: backend tests 566/566, focused dashboard/report tests 2/2, ESLint, backend TypeScript check, Nest build, and `git diff --check`. No migration is needed; PR CI and production release remain the gate.

## Release confirmation: shift refund accounting

- PR #275 was squash-merged as `9193fee58e592c3bcf8271f1e29953fbda00ddc5`; main CI and production Deploy #309 succeeded. The `production` tag points to that commit.
- Read-only production checks returned HTTP 200 for API health, POS history, and the customer site.

## Release confirmation: dashboard partial-refund revenue

- PR #276 was squash-merged as `2a698a7755c3c9fbf24adb68dc3ff38f2ac476a0`; main CI and production Deploy #310 succeeded. The `production` tag points to that commit.
- Read-only production checks returned HTTP 200 for API health, POS history, and the customer site. The server checkout is clean on `main` at the deployed commit.

## Audit continuation: POS payment screens and partial refunds

- The backend and kitchen/courier paths already subtract refund rows from the amount collected, but the cashier payment queue still counted only `PAID` and `SUCCESS` rows and ignored `PARTIALLY_REFUNDED`. A 74,000 so'm tender with a 24,000 so'm refund could therefore display 74,000 due instead of 24,000. The order-list API includes refund rows, so the POS can calculate this accurately without a schema change or new endpoint.
- Cashier balance now uses validated integer minor units, subtracts every recorded refund, and excludes pending, failed, and fully refunded tenders. Missing refund details for a partial-refund tender, malformed amounts, or refunds larger than their original tender fail closed: the UI shows a warning and disables payment until the cashier refreshes.
- Admin payment-page totals now include partially refunded tenders as collected gross amounts and show returned money in a separate summary. This retains consistency with sales reports, where gross collections and refunds are distinct ledger facts. The five summary values reflow responsively.
- Regression tests cover partial and multiple tenders, excluded failed/fully-refunded tenders, missing or invalid refund details, and the admin ledger summary. Local validation passed: POS tests 56/56, focused ESLint, POS TypeScript, and optimized Next.js production build. `git diff --check` passed. CI and production release remain the release gate; no migration is required.

## Audit continuation: courier balance after a partial refund

- Courier delivery lists and completion logic counted only `PAID`/`SUCCESS` payment rows and did not load refund details. A partially refunded order could show too much due and ask the courier to collect more than its net outstanding balance.
- The same net-collected payment calculation is now shared across cashier collection, kitchen handoff, and courier list/completion paths; courier queries load refund amounts. Regression coverage verifies the displayed 24,000 so'm balance, the exact amount collected on courier completion, and common net calculations for partial, full, and failed tenders. Local validation passed: backend tests 567/567, transient retry tests 3/3, focused courier/refund tests 10/10, ESLint, backend app/script TypeScript checks, Nest build, and `git diff --check`. No migration is needed; PR CI and production release remain the gate.

## Release confirmation: refund-aware collection screens

- PR #277 was squash-merged as `0510fe35001dcbcf2502876af4ba287e17b5f222`; production Deploy #311 succeeded and the `production` tag points to that commit.
- PR #278 was squash-merged as `ba18c6ded12214f4b5f727405d4e05c4650f0a26`; Main CI run #38059218697 and production Deploy run #38059483669 succeeded, including production smoke. The `production` tag was verified at that commit.

## Audit continuation: customer payment status labels

- The customer order-detail page uses a localized payment-status label. A partially refunded tender was missing from both Uzbek and Russian label maps, so it appeared as an unknown status instead of explaining what happened.
- The label now says `Qisman qaytarilgan` in Uzbek and `Частичный возврат` in Russian. Existing unknown-status fallbacks remain unchanged.
- Regression tests cover both locales and unknown statuses. Local validation passed: customer-web tests 20/20, focused ESLint, TypeScript, and optimized Next.js production build. No schema migration is required; PR CI and production deployment remain the release gate.

## Audit continuation: pending cash transfer and recipient shift closure

- A cashier could close a shift that had an incoming cash transfer still awaiting acceptance. The transfer remained pinned to the closed shift, so the intended cashier could no longer accept or reject it. A forced close also left that inbound transfer stranded.
- Ordinary close now blocks while an incoming transfer is pending. Forced close unassigns pending inbound transfers while preserving their `PENDING` status, so another authorized cashier in the same branch can accept or reject them through the existing queue. The force-close audit entry records how many incoming transfers were unassigned.
- Normal and administrator-forced transfer creation now lock source and recipient shifts in deterministic ID order. The normal path re-reads and validates both under lock before checking cash and creating ledger rows. This closes the recipient-close race and avoids lock-order deadlocks between normal and forced transfers.
- Regression tests cover both transfer lock orders/idempotent replay, target shift closure during transfer creation, incoming-transfer close blocking, and force-close recovery. Validation passed: backend tests 571/571, transient HTTP retry tests 3/3, changed-file ESLint, backend app and scripts TypeScript checks, Nest build, and `git diff --check`. No schema change or migration is required.

## Release confirmation: pending cash transfers and shift closure

- PR #281 was squash-merged as `7963936e1357a06706dbc69e47285aac05be5182`; Main CI #792 and production Deploy #315 succeeded, including production smoke. The `production` tag points to the merge commit.
- Read-only checks returned HTTP 200 for the customer site, `www` site, POS dashboard, and backend health endpoint. The server checkout was synchronized to clean `main` after deploy.

## Audit continuation: cash transfer rejection lock order

- Rejection locked the cash-transfer row first, then the source shift. Forced shift close locks the source shift first and then updates pending transfer rows. Concurrent rejection and forced close could therefore wait on each other's locks and trigger a database deadlock/retry failure.
- Rejection now reads the branch-scoped transfer to identify its immutable source shift, locks that source shift first, then locks and re-reads the transfer before applying any refund or status changes. Its lock order now agrees with forced close; if the source or transfer disappears during the sequence, the operation fails as not found without ledger writes.
- Added regression coverage asserting source-shift-before-transfer lock order while preserving the existing exactly-once rejection/refund behavior. Validation passed: backend tests 571/571, transient HTTP retry tests 3/3, changed-file ESLint, backend app and scripts TypeScript checks, Nest build, and `git diff --check`. No schema change or migration is required; PR CI and production release remain the gate.

## Release confirmation: cash transfer rejection lock order

- PR #282 was squash-merged as `0e2dd774cfbc56876040e1a70dd98969aced8fdb`; Main CI #794 and production Deploy #316 succeeded, including production smoke. The `production` tag points to the merge commit.
- Read-only checks again returned HTTP 200 for the customer site, `www` site, POS dashboard, and backend health endpoint.

## Audit continuation: PostgreSQL cash-transfer recovery coverage

- Unit coverage verifies that forced close unassigns a pending incoming transfer, but the disposable PostgreSQL integration smoke did not yet prove a replacement cashier can see and accept that transfer through the production query/transaction behavior.
- Expanded only the isolated `cash_qa` integration scenario: create a pending transfer, force-close its recipient shift, verify it remains pending and unassigned, open the replacement cashier shift, verify the branch queue returns it, accept it, and assert exactly one incoming cash ledger row and the resulting balances. No production data or schema is involved.
- The existing backend suite remains green at 571/571. This integration-script change passes focused ESLint and backend scripts TypeScript checks; PR CI must additionally pass the disposable PostgreSQL scenario before merge. No schema change or migration is required.

## Audit continuation: manual cash entries and shift closure

- Manual cashier cash-in/out entries checked that a shift was open but did not lock the shift row. A shift close or cash transfer could therefore race the manual ledger write, leaving its cash movement outside the closing snapshot or transfer balance calculation.
- Manual cash entries now conditionally update the still-open shift row after validating the request and before writing the ledger entry. This serializes the entry with close, POS payment, refund, and transfer operations; if closure wins, the write is rejected instead of being attached to a closed shift.
- The same endpoint also accepted system-owned `SALE`, `REFUND`, transfer, opening, and closing ledger types. Those could forge cash or shift totals outside their real workflows. Manual requests now accept only `INCOME`, `EXPENSE`, and `WITHDRAW`; sales, refunds, transfers, and shift lifecycle entries remain owned by their corresponding operations.
- The disposable PostgreSQL integration smoke now holds a shift row in one transaction and verifies that a manual cash entry waits for that lock. Cash transaction idempotency and tenant-link regression tests were updated. Desktop now rejects system-owned types while offline instead of queuing impossible ledger writes; its gateway projects only the same three manual types. Local validation: backend tests 572/572, Desktop gateway tests 45/45, changed-file ESLint, backend app/scripts and Desktop TypeScript checks, and Nest build passed. The real PostgreSQL check remains gated by PR CI; no schema migration is required.

## Release confirmation: manual cash entries and shift closure

- PR #284 was squash-merged as `05b7a0a70f66870d0e88fa9c5a17bf04582f172f`; Main CI #801 and production Deploy #318 succeeded, including production smoke. The `production` tag was advanced to the merge commit.
- Desktop 0.1.113 was published with the matching offline cash-entry validation. It still needs to be installed on the restaurant workstation.
- A separate read-only production smoke passed 27/27 checks for the API/database, customer site, `www`, POS, owner login, media, and public catalogue assets.

## Audit continuation: unpaid hall orders in shift-close counts

- POS `DINE_IN` orders intentionally enter the kitchen before payment and are directly assigned to the cashier's open shift. Because they have no payment/revenue row yet, shift-close `orderCount` previously counted only revenue-linked orders and omitted these unpaid hall orders.
- Shift-close count now includes orders directly linked through `Order.shiftId` plus legacy revenue-linked orders. Prisma's `OR` count includes each matching order once. Regression coverage verifies the query and closing snapshot; the disposable PostgreSQL cash smoke also checks that an unpaid hall order appears in the closed shift's order list and that the saved count matches that list.
- Local validation passed: backend tests 572/572, changed-file ESLint, backend app/script TypeScript checks, Nest build, and `git diff --check`. The PostgreSQL integration check remains for PR CI; no schema change is needed.

## Release confirmation: unpaid hall orders in shift-close counts

- PR #285 was squash-merged as `620bf9fe3a2a70c152f9ef88287ce57011e53a60`; Main CI run `38069498849` and production Deploy run `38069793764` succeeded, including production smoke. The `production` tag points to the merge commit.
- A separate read-only production smoke passed 27/27 checks. The server checkout is clean on `main` at the deployed commit.

## Audit continuation: cashier payment-method disable enforcement

- The settings registry exposes independent cashier payment-method switches, and backend enforcement already filters both the cashier method list and new POS checkout. The collection endpoint for payment on an existing online/hall order also checks the tenant's enabled methods, but had no dedicated regression test.
- Added a service-level test proving a disabled Click method is rejected before payment or revenue ledger writes when a cashier tries to collect an existing order. This complements the existing cashier catalog and new-POS-order coverage. The customer website remains cash-only until a provider settlement/reconciliation integration is available.
- Local validation passed: backend tests 573/573, focused payment tests 6/6, changed-file ESLint, and `git diff --check`. The production code is unchanged; GitHub CI remains the merge gate. No schema change is needed.

## Audit continuation: cash transaction history pagination

- Shift-detail history returned only the newest 200 cash transactions, with no total count or paging controls. A busy shift could therefore hide older ledger rows from the administrator's review.
- The endpoint now returns a tenant- and branch-checked page plus the exact total, capped at 100 rows per request and ordered by timestamp then ID for stable paging. The admin shift detail shows 50 rows per page. Shared pagination now uses the total count to disable `Keyingi` on an exact full last page. The cashier's live shift summary is explicitly labelled as showing the latest 50 entries, not the complete ledger.
- Added coverage for stable ordering, total count, page-size cap, and unknown-shift isolation. Focused tests passed 10/10; the full backend suite passed 575/575. Changed-file ESLint, backend and POS TypeScript checks, Nest and POS production builds, and `git diff --check` passed. CI and production deployment remain release gates; no schema migration is needed.

## Release confirmation: cash transaction history pagination

- PR #287 was squash-merged as `8b220d0063aa51e6ee8a13d326f3e1be91747b8d`; main CI run #807 and production Deploy #321 completed successfully. The `production` tag points to the merge commit.
- Dokploy's first attempts hit a transient GitHub HTTP/2 fetch cancellation (`early EOF`); retry succeeded. Independent production smoke passed 27/27, and backend, customer web, POS, platform admin, and Telegram services are running the released build. The print agent remains workstation-managed and is not deployed by Dokploy.

## Audit continuation: cash transaction API rollout compatibility

- Backend-first deployment exposed a version-compatibility risk: older POS clients call the cash-transaction endpoint without pagination parameters and expect an array, while the new paginated client expects `{ items, total }`.
- Keep the original array response and 200-row cap when no page parameters are supplied; requests with page parameters receive the bounded page envelope and exact total. This allows backend and POS to roll out independently.
- Regression coverage verifies both response contracts. Validation passed: backend tests 576/576, changed-file ESLint, backend app/scripts TypeScript checks, Nest build, and `git diff --check`. CI and production deployment remain release gates; no schema change is required.

## Release confirmation: cash transaction API rollout compatibility

- PR #288 was squash-merged as `cf8f4936fabd3c47e99eda222daf407c475e3d16`; main CI #809 and production Deploy #322 succeeded. The `production` tag matches the merge commit.
- Independent read-only production smoke passed 27/27 checks. This release changed only the backend and did not require a database migration.

## Audit continuation: cashier payment settings and offline terminals

- Verified the payment-method switches are tenant-scoped, validated against the shared setting registry, cached in Redis with invalidation on save, filtered from the cashier payment list and Desktop bootstrap, and rechecked by the backend before recording new cashier payments. Disabling a method does not prevent refunds for earlier recorded payments, which is necessary for returns.
- Found an offline operational edge: a disconnected Desktop terminal can keep its last downloaded payment-method list. If an administrator disables a method while that terminal has a queued payment in that method, replay is rejected by the current server policy and the queue enters conflict; the shift remains blocked from closing until the conflict is resolved. The payment is not silently added to the ledger.
- The settings page now asks for confirmation specifically before disabling CASH and explains to synchronize every Desktop terminal first. Click/Payme/card toggles remain immediate because those methods cannot be queued offline. If a CASH conflict occurs, the operator can re-enable CASH and retry the queued action from Desktop. This is an operator safeguard, not a change to payment authorization or offline policy.
- PR #289 was squash-merged as `c2e3040089cc4fa0119947c60e501682cf3a88a8`; main CI #811 and production Deploy #323 succeeded. The `production` tag matches the merge commit, only POS web was deployed, and read-only smoke passed 27/27.

## Audit continuation: printed payment method labels

- Desktop's shared receipt renderer printed raw payment codes such as `CASH` and `UZCARD`, while the POS receipt screen showed human-readable names. Online and offline Desktop receipts shared the same renderer, so both printed the raw codes.
- Desktop receipt output now localizes the supported methods to `Naqd pul`, `Bank kartasi`, `Uzcard`, `Humo`, `Click`, `Payme`, and `Onlayn to'lov`; unknown method names are preserved as entered. Both online and offline Desktop print jobs use this renderer.
- Focused renderer tests cover all supported payment codes and unknown labels. Desktop was bumped to 0.1.114 so the fix can be installed on the restaurant workstation. PR #290 merged as `4eae81eb8fed3c2dc125219a2bfcead02b642fb7`; Desktop Release #171 published the Windows installer. The asset was verified at 141,234,385 bytes with SHA-256 `49a7e20f59c4dd8279b4b199b8647d26801e6c745dca41b7c2a275cda1a987c1`.

## Release confirmation: printed payment method labels

- Main CI #813 passed. Deploy #324 succeeded as a workflow, but its release gate selected no server applications because this change is Desktop-only; it skipped production smoke and did not redeploy POS/backend services. The `production` tag points to `4eae81e`.
- Server checkout is clean on `main` at `4eae81e`, and the independent read-only production smoke passed 27/27 checks. Installing Desktop 0.1.114 on the restaurant workstation and physically checking a receipt remain operator acceptance steps.

## Audit continuation: cashier current-shift summary query size

- The active-shift endpoint returned only the latest 50 cash transactions, but loaded every shift transaction and every revenue record (including nested payment and method objects) before calculating balance, cash sales, and order count. Long-running shifts therefore caused unnecessary database transfer, Node memory use, and a large response/cache payload.
- Cash balance is now calculated from database sums grouped by transaction type; cash sales use a `CASH`-filtered database aggregate; paid-order count uses distinct non-null order IDs. The shift row and all aggregates are read in one `Repeatable Read` transaction so a payment cannot appear in only part of the summary. The response still provides the latest 50 transaction rows and the `revenueRecords` order-ID shape used by Desktop's offline replay reconciliation, now deduplicated and compact. No schema or API consumer change is needed.
- Regression tests cover opening-float legacy behavior, opening-ledger handling, cash/reversal totals, split payments, non-cash methods, unpaid orders, aggregation query scopes, and the bounded response. The disposable PostgreSQL scenario also asserts actual cash sales, distinct paid-order count, 50-row history, and compact unique offline-replay IDs after 250 ledger entries. Local validation passed: backend tests 577/577, focused tenant/history tests 12/12, changed-file ESLint, backend app and scripts typechecks, Nest build, and `git diff --check`. No migration is required.

## Release confirmation: cashier current-shift summary query size

- PR #291 was squash-merged as `ba6b0cfa0edcc1200bac29362f3b2152baf4aaf1`; main CI #817, production Deploy #325, Dokploy deploy, production smoke, and release-tag advancement all succeeded.
- An independent read-only production smoke passed 27/27 checks. No migration or Desktop client update was required.

## Audit continuation: open-shift order count consistency

- Open-shift summaries counted only orders with a paid revenue record. Unpaid dine-in orders are assigned directly to the shift before the cashier collects payment, so the active shift understated its order count compared with its own order list and the final close snapshot.
- The active summary now counts the union of directly assigned shift orders and orders with a paid revenue record for that shift. Database selection returns only unique order IDs. The compact `revenueRecords` compatibility field carries that full set so Desktop offline replay does not increment the order count a second time when an already-listed unpaid order is paid.
- Unit and disposable PostgreSQL integration coverage assert that an unpaid hall order appears in the active summary exactly once before payment, alongside paid orders. No schema change was required.

## Release confirmation: open-shift order count consistency

- PR #292 merged as `6f8592f9fa205f26807d36257df5b2df1e0903ce`; its CI, main-branch CI, production Deploy, Dokploy rollout, production smoke, and release-tag advancement all succeeded.
- Independent read-only production smoke passed 27/27 checks. The server checkout is clean on `main`, and the `production` tag points to the merge commit.

## Audit continuation: older cashier shifts unreachable from the history picker

- The cashier shift-history page requested only the first 100 shifts and offered no way to fetch older pages, even though both backend list endpoints accept `limit` and `offset`. Shifts beyond the initial page could not be selected from the UI.
- The history header now loads subsequent 100-shift pages, deduplicates by shift ID, preserves already-selected or deep-linked shifts, and tracks the backend offset independently from any injected deep link. The control disappears after a short page and is disabled during loading.
- POS unit tests (56/56), changed-file ESLint, TypeScript check, production build, and `git diff --check` passed locally. PR #293 was merged as `77c86eba37b98d6e778e569fcf14722e547b2401`; the remote `production` tag points to that commit. The production smoke passed 27/27; there is no backend or database change.

## Audit continuation: repository-wide lint coverage (2026-10-11)

- The root `lint` command previously ran workspace lint tasks but omitted repository-level operational and browser QA scripts. ESLint also lacked Node/browser runtime globals for those files, so invoking it directly at the repository root produced false `no-undef` errors instead of a useful audit.
- Root lint now includes `scripts/` and `apps/media/scripts/`, uses the existing locked `globals` package for Node and browser QA files, and permits `require()` in intentional CommonJS QA scripts. Four unused bindings and redundant global declarations were removed; customer/POS module comments were narrowed to the browser global they actually need.
- Repository-wide ESLint passed across `apps`, `packages`, and `scripts`. Tests passed: backend 577, root retry helper 3, Desktop 144, POS 56, customer web 20, Telegram 5, print-agent 7 (812 total). Typechecks, application builds, operational validators (33/33), and read-only production smoke (27/27) passed during this audit.
- Follow-up review found the documented legacy `jobs` print-agent omitted printer routing from claim requests, so the backend correctly returned no work. The agent now sends explicit printer/route targets and refuses to claim work without a target. TCP output uncertainty is marked `AMBIGUOUS` rather than retried; if that state cannot be saved because the backend is unreachable, the agent halts polling and stays visibly degraded. Polling API errors no longer silently end the worker loop, and the local health page defaults to loopback.
- Added seven print-agent runner tests and updated the backend print-agent contract regression to check the extracted runner. Backend suite passed 577/577 after updating the source-contract test; POS, customer, Telegram, Desktop, root retry helper, and print-agent suites passed. The print-agent typecheck/build and repository-wide ESLint passed. The agent is a disabled legacy fallback; MAZETTO Desktop remains the production printing owner. No printer was physically attached for this code audit, so USB/driver and paper-output acceptance is still a separate device test.
- The server has Node 22 while the project pins pnpm 11, which requires Node 24; therefore the canonical `pnpm run ci` command was not run on the server. GitHub CI on the consolidated audit PR remains the required verification gate. No production deploy has been made for this audit batch.

## Audit continuation: browser QA fixture fidelity (2026-10-11)

- The waiter responsive-flow test used a placeholder staff token but did not isolate the realtime catch-up and device-heartbeat requests. The real API rejected the placeholder session and redirected the test to login, which made product controls appear to disappear. The test now supplies deterministic empty realtime and accepted-heartbeat responses.
- The supplemental-order fixture also omitted the backend's `parentOrderId` and `supplementNumber` fields. It now models those fields, and the order selector assertion matches the displayed supplemental number.
- The waiter flow passed at 1600, 768, 360 and 320 px. ESLint for the changed QA script and `git diff --check` passed. These were test-fixture corrections, not waiter-product behavior changes.
- The current audit branch remains uncommitted and has not been separately deployed. A read-only remote-ref check confirmed that `main` and the `production` tag both point to `e0bfb48bc197cdfdb1ba20f1e9509de2a42986af` before this continuation.

## Audit continuation: generated-number collision handling (2026-10-11)

- Rechecked order/display-order, kitchen-ticket, shift, receipt, and refund-receipt number allocation. POS, table, and customer order creation retry unique conflicts; display order numbers use a transaction advisory lock; kitchen tickets retry unique conflicts; shift opening serializes number allocation per branch.
- Receipt number allocation was the remaining check-then-insert race: concurrent transactions could both observe a candidate as unused before inserting it. Each candidate now takes a PostgreSQL transaction advisory lock before its uniqueness lookup, so the normal read-committed path serializes identical candidates and retries an already-used candidate. No schema or API change is required.
- Added regression coverage for lock-before-lookup and retrying an occupied candidate. The backend suite passed 578/578, HTTP retry helper tests passed 3/3, backend typechecks and focused ESLint passed, and `git diff --check` passed.
- This is part of the current uncommitted audit batch; it has not been pushed or deployed. Physical printer validation and production-only acceptance gates remain separate.

## Audit continuation: customer order realtime scope (2026-10-11)

- The customer orders dashboard filtered realtime events to the first active order. If the same customer had multiple active orders, status changes for the other orders were ignored until polling or focus refresh.
- The backend already authenticates customer sockets into a customer-specific room and resolves event ownership from the persisted order, not caller-supplied payload scope. The existing gateway regression test verifies customer-room and branch-room routing. The dashboard now listens to that authenticated customer room without the overly narrow single-order filter; the order-detail page remains filtered to its displayed order.
- Verification passed: customer-web TypeScript, ESLint, 20/20 unit tests, production build, backend gateway scope tests 3/3, and `git diff --check`. The audit batch remains local and unpushed/undeployed.

## Audit continuation: order-tracking browser fixture (2026-10-11)

- The order tracking browser test seeded an access token in local storage, but the current app deliberately strips tokens from browser storage and restores access through `/customer/auth/refresh`. The test did not mock refresh, so it rendered the unauthenticated state and timed out before exercising order tracking.
- The fixture now models the refresh response and includes the operational order ID returned by the backend. The API mock is scoped to customer endpoints instead of relying on a same-origin `/api/v1` prefix, so the fixture works with the production-built app's configured API base URL.
- The localized customer routes returned successfully in the built app. The browser flow passed at 320, 390, and 1440 px: eight statuses, delivery/pickup indicators, focus refresh, polling refresh, zero horizontal overflow, and zero browser exceptions. ESLint passed for the script. This is QA reliability work, not a production runtime change.

## Audit continuation: Desktop offline mutation boundaries (2026-10-11)

- Reviewed the Desktop mutation registry, durable outbox, replay path, and restart recovery. Supported writes preserve idempotency keys, serialize per aggregate, rebase versioned edits after server acknowledgement, and recover interrupted `sending` entries on app restart. Conflicts and unsupported writes are not silently applied.
- Desktop regression suite passed 145/145; TypeScript and ESLint passed. Coverage includes disconnect/reconnect, one-time replay, interrupted-send recovery, stale/cross-branch snapshots, offline cash and shift accounting, order/kitchen/courier queues, conflicts, local print routing, and duplicate-paper safeguards.
- Offline is reliable for the explicitly supported operations, not full feature parity. Admin/master-data changes, refunds, transfer accept/reject, force-close, and other sensitive or unregistered operations require connectivity by design. Expanding those queues generically could corrupt authorization, money, or inventory state; each operation needs its own offline snapshot and reconciliation rules. A controlled restaurant-workstation offline/restore test and physical printer paper test remain outstanding.
- No Desktop runtime code change was needed in this audit pass. This report entry and the other current fixes remain local on the audit branch; no push or deploy was made.

## Consolidated verification update (2026-10-11)

- Customer web: typecheck, ESLint, 20/20 tests, production build, and order-tracking browser flow at 320/390/1440 px passed.
- Desktop: 145/145 tests, typecheck, and ESLint passed. Backend realtime-scope regression passed 3/3. Repository operations validators passed 33/33. Direct repository-wide ESLint passed across `apps/`, `packages/`, and `scripts/`; `git diff --check` passed.
- The root `pnpm lint` wrapper could not start Turbo because the server is on Node 22 with pnpm 10.28 while the repository pins pnpm 11, and Turbo could not resolve that pinned binary. Running the same ESLint coverage directly passed. GitHub CI on the project's supported toolchain remains the canonical integrated gate.
- Backend's full suite was rerun after the current audit changes and passed 578/578. Backend app/scripts typechecks, Nest build, and backend ESLint passed. The receipt collision regression and customer realtime-scope regression both pass.

## Audit continuation: printer result persistence failure (2026-10-11)

- A Windows driver could finish printing while SQLite failed to persist that individual printer target as printed. The old path classified the persistence error as an ordinary retryable failure, risking duplicate paper on the next attempt.
- After a successful driver call, failure to save the per-printer result is now wrapped as `PRINT_OUTCOME_UNKNOWN`; the worker records an ambiguous target when possible and marks the whole job ambiguous even if that secondary write also fails. Operators are told to inspect the paper before manually retrying.
- Added a regression that simulates a successful print followed by SQLite write failure and verifies one physical submission, ambiguous/dead-letter handling, and no automatic second submission. The full Desktop suite now passes 146/146, including target ambiguity, operator retry, and preserving already-printed targets.
- A second-order retry path was also fixed: when the server lease expires and the job is claimed again, a persisted ambiguous printer target now fails closed instead of printing again. The server manual-retry action issues a one-use marker only after an ambiguous attempt; the claim consumes it, retries only unresolved ambiguous targets, and still skips printers already confirmed successful. Local explicit retry clears only ambiguous local target markers.
- Verification for this grouped audit state: backend tests 580/580 plus HTTP retry tests 3/3; Desktop tests 146/146; backend typecheck, ESLint and Nest build; Desktop typecheck, ESLint and distributive build; `git diff --check` passed. The source changes remain uncommitted and are not in published Desktop 0.1.114. No push or deploy has been made for this batch.

## Audit continuation: courier transition coverage and browser QA (2026-10-11)

- The removed `qa-order-status.mjs` depended on the retired in-memory kitchen event emitter, so it was not a valid current regression test. Its meaningful transition checks are now represented by backend unit tests: READY-to-SERVED kitchen completion, READY-to-CANCELLED synchronization, terminal/illegal status rejection, delivery-only and tenant-branch ownership guards, foreign courier ownership, idempotent same-status handling, and delivery-specific status labels.
- Backend suite now passes 585/585, plus HTTP retry helper 3/3. Backend typecheck, ESLint and Nest build passed; repository-wide ESLint passed.
- All 15 changed browser QA scripts passed against their intended applications, including admin pages, role matrix, POS, kitchen, waiter, courier, tracking, and owner console. Customer order tracking passed on the production build at 320/390/1440 px; owner console passed at 1600/768/360 px. The first tracking attempt against `next dev` was invalid because its HMR WebSocket was rejected; the production-mode rerun passed.
- The customer and platform production builds succeeded. Test servers on ports 3115-3119 were stopped after the QA run. No printer was physically attached. This batch remains local; no push or deployment has been made.

## Audit continuation: cash handover QA reliability (2026-10-11)

- `qa-cash-handover.cjs` previously extracted declarations from another test script by source substring offsets and executed them with `new Function`. This was brittle test coupling; the script now uses an explicit fixture module.
- The QA counter also treated every API POST as a cash transfer, so the legitimate device-heartbeat write falsely failed the “confirmation required” assertion. It now checks transfer-create/accept endpoints specifically, acknowledges the test heartbeat, and fails on unexpected mutations.
- POS source already opened the confirmation dialog before sending the transfer; no cash handover product bypass was found. The corrected QA passed all 9 role/viewport combinations (Kitchen, Courier, Cashier at 320, 390, 1440 px), and both QA files passed ESLint. POS production build and typecheck passed.
- Local test server was stopped after use. No push/deploy; physical printer and restaurant-device acceptance remain outstanding.

## Audit continuation: local print queue storage failure (2026-10-11)

- The Desktop timer discarded the worker promise, while local SQLite queue operations (`claim`, attempt recording, and failure persistence) could throw outside the server-poll error boundary. A database lock/corruption during local printing could therefore become an unhandled rejection; after uncertain paper output, failed dead-letter persistence could also leave the worker polling again immediately.
- Local queue exceptions now stop the current tick, emit a visible Desktop log, and back off local/server polling from 1 to 30 seconds until local storage recovers. The timer also catches any unexpected worker rejection as a final guard.
- Regressions cover a queue read/claim failure and the harder case where paper may have printed but both target and dead-letter writes fail. They prove one physical submission, no follow-up claim/server poll during backoff, and no escaping worker rejection. Full Desktop suite passed 148/148; Desktop typecheck, ESLint, and build passed.
- Desktop package remains version 0.1.114, which does not contain these audit fixes. A new version/package is still required before the application can receive this code. No push or deployment was made.

## Workspace regression inventory (2026-10-11)

- All workspace packages that define a test command were rerun: backend 591, HTTP retry helper 3, Desktop 148, customer web 20, POS web 58, print-agent 7, and Telegram bot 5. Total: 832 tests passed, zero failed.
- Repository ESLint passed again after the audit changes; operations/Docker validators passed 33/33 in this verification. Backend and Desktop typechecks/builds passed; customer, platform, and POS production builds passed; customer and POS typechecks passed. POS tests/typecheck/production build were rerun after the shared retry-intent helper. The root Turbo wrapper remains unavailable on this server's Node 22/pnpm 10 versus the repository's pinned Node 24/pnpm 11; direct package and repository checks were run instead.
- These are source/test verification results, not a claim of physical-device acceptance. The real Godex/printer USB chain and restaurant workstation offline/restore exercise still require on-device checks. This audit branch remains unpushed and undeployed.

## Audit continuation: customer design browser contract (2026-10-11)

- The design-contract browser QA depended on a live public catalog and expected 74 products and five slides. In an isolated local run, an unavailable/empty upstream catalog made it wait indefinitely; startup also issued the normal unauthenticated customer refresh request, which the generic mutation guard incorrectly treated as a product write.
- The QA now supplies deterministic read-only category, 74-product, and five-slide fixtures, and answers the expected no-session refresh with 401. All other non-read-only browser requests remain blocked and recorded.
- Production-mode browser QA passed at 390, 430, 768, and 1440 px: slide image/title/CTA geometry, no horizontal overflow, hero tokens and controls, 74 menu cards, hover stability, sticky navigation, and mobile fixed-nav position. There were zero browser exceptions and zero unexpected mutations. Screenshots were visually inspected at mobile home/menu sizes.
- Customer-web tests passed 20/20, TypeScript, ESLint for the QA script, production build, and `git diff --check` passed. The local test server was stopped. No push or deployment has been made.

## Audit continuation: legacy opening cash double count (2026-10-11)

- Current shift balances treated `OPENING_BALANCE` as the opening ledger row but overlooked the still-supported legacy `OPENING` enum. If an older shift held both a non-zero `openingBalance` and an `OPENING` row, the cashier balance and transfer availability added the float twice; the cash-register summary had the same issue.
- Both shift calculations now recognize either opening-ledger type before deciding whether to seed from the legacy `openingBalance` column. Regression tests cover the legacy row in cashier summary and shift cash calculation.
- Full backend tests passed 588/588 plus HTTP retry tests 3/3; backend TypeScript checks, focused ESLint, and `git diff --check` passed. No schema change, push, or deployment.

## Audit continuation: refund and courier cash-transfer retries (2026-10-11)

- POS refunds, courier-to-cashier transfers, and cashier-to-cashier handovers now share one tested intent-key helper. An unchanged request reuses its key after an uncertain response; a changed fingerprint obtains a new key. Refund fingerprints include payment, shift, amount, and reason; cash transfer fingerprints include source shift, receiver, and amount.
- Payment-operation replay now revalidates the order branch and active employee before returning a prior result, including the unique-key race fallback. This closes same-tenant cross-branch replay exposure. Regression tests cover direct replay, inactive employee, and race fallback.
- The backend rejects reusing a refund key with changed content. Backend tests passed 591/591 plus HTTP retry tests 3/3; POS tests passed 58/58. Backend and POS typechecks/builds, repository ESLint, POS focused ESLint, 33/33 operations validators, and `git diff --check` passed. These checks cover retry-key behavior and backend invariants; they do not simulate a real network interruption against a live restaurant account.
- This remains an in-progress source audit on the server checkout. No push or deployment has been made.

## Audit continuation: settings audit scope and Telegram keyboard routing (2026-10-11)

- Settings already expose independently configurable cashier methods (Cash, Card, Uzcard, Humo, Click, Payme, Online); the backend validates the allowlist, tenant-scopes and caches the values, filters the POS catalog, and rejects disabled methods before recording new payments. Customer checkout intentionally remains cash-only until provider settlement exists. The admin settings browser QA passed at 1600, 768, 360, and 320 px, including Click/Payme enable-disable and the last-active-method guard.
- Filled in missing Uzbek display labels for Uzcard, Humo, and Online; the settings panel no longer exposes those enum codes to admins.
- Found that a legacy super-admin without a tenant membership can resolve the only active restaurant for a settings write, but the audit row used the actor's missing `tenantId` and became unscoped. Audit writes now use the already-resolved tenant ID; the regression test verifies the legacy-account path.
- Telegram's persistent `Buyurtmalarim` and `Profil` keyboard labels were intercepted by old handlers in the auth service. The history label bypassed the dedicated interactive order-history service, hiding order detail/repeat actions. Keyboard actions now route through the ordering service, reuse the shared profile renderer, and show the link-required screen for unlinked accounts. Removed the now-unreachable duplicate category/history/profile implementations. Three service tests cover linked history, profile, and unlinked-account behavior.
- Validation passed: backend 595/595 and shared HTTP retry 3/3; Desktop 148, customer web 20, POS web 58, print-agent 7, and Telegram bot 5 remained green from the prior full workspace run, for 836 verified tests total. Backend app/scripts typecheck, Nest build, repository-wide ESLint, POS production build, admin-settings browser QA at four viewport widths, and `git diff --check` also passed. These are automated/source checks; they do not replace live Telegram or payment-provider acceptance.
- The full active branch remains local and unpushed/undeployed. No production service was changed.

## Audit continuation: inventory readiness and customer realtime efficiency (2026-10-11)

- Ingredient and warehouse audit entries now use the resolved restaurant tenant instead of a possibly absent legacy user tenant field. The last active warehouse cannot be archived while recipe-backed products still require inventory; the check and stock guard run under a branch-row lock inside the write transaction.
- Customer realtime events now recognize nested order IDs and kitchen-ticket IDs. Detail pages no longer miss status changes, and an event for an already-listed order refreshes only that order instead of refetching dashboard, favorites, bonus balance, and the entire history. New-order and reconnect/focus refreshes retain the full-load recovery path.
- Backend tests passed 599/599 plus HTTP retry 3/3; customer web 22/22; POS 58/58; Desktop 148/148; Telegram bot 5/5; print-agent 7/7. Total 842/842. Backend app/scripts typecheck and build, customer/POS typecheck and production build, repository ESLint, focused lint, and `git diff --check` passed.
- These remain local source changes. No push or deploy was performed. Live payment-provider verification, physical printer/USB testing, and final restaurant workstation acceptance remain unverified.

## Audit continuation: release-guide and generated-output hygiene (2026-10-11)

- Rechecked the old unique-number warning: cashier/POS orders retry bounded unique conflicts, kitchen ticket creation retries collisions, shift numbers serialize with a branch-scoped advisory transaction lock, and receipts allocate random candidates under an advisory lock. The blanket warning was stale and is closed against current code/tests.
- Customer auth tokens are already excluded from localStorage; current code uses the refresh-cookie flow and the prior table entry was stale. `print-agent` and `telegram-bot` contain executable polling/monitoring services, not placeholders.
- `docs/PRODUCTION_DEPLOYMENT.md` incorrectly said HTTP CORS was disabled and WebSocket CORS was wildcard, contradicting current code. It now documents the shared exact-origin allowlist, credentials, and wildcard rejection.
- Backend typecheck now explicitly uses no-emit mode for both source and scripts. Removed 438 verified transpiled sidecars created during validation; repeat typechecks generated none. Source files and ignored build output were preserved.
- Two stale operational validators were updated for the targeted customer-order refresh callback and the Telegram service-size guard. The complete set passed 33/33; focused ESLint and `git diff --check` passed.
- This documentation/config hygiene batch passed backend app/scripts typecheck and repository ESLint. No production configuration was modified and no push/deploy was made.

## Audit continuation: offline cashier payment-method changes (2026-10-11)

- Settings review found that removing a cashier payment method prompted for confirmation only when disabling Cash. An offline Desktop terminal can retain any previously downloaded method list, so disabling Card, Click, Payme, Uzcard, Humo, or Online can also leave queued sales using a method the server now rejects.
- The confirmation now applies to every removed cashier method, names the affected methods, and instructs operators to reconnect terminals and synchronize queued work first. Backend POS checkout and payment collection already enforce the tenant's current allowlist; no payment provider is activated by these toggles.
- POS settings browser QA passed at 1600, 768, 360, and 320 px, covering Click/Payme enable-disable, no save before confirmation, and the final-enabled-method guard. POS tests passed 58/58, customer web 22/22, Desktop 150/150, and backend 601/601 (831 tests across those four packages). Backend, Desktop, POS, and customer-web typechecks/builds passed; repository ESLint and `git diff --check` passed.
- An initial browser attempt against the pre-existing 3001 service showed stale labels; it was not counted as a source verification. The rerun used an isolated server from this checkout on 3010, which was stopped afterward.
- This source audit remains uncommitted and undeployed. Real NBU settlement, a physical printer, and offline recovery on the restaurant workstation remain operational acceptance checks.

## Audit continuation: Desktop server-printer polling diagnostics (2026-10-11)

- A backend printer-registry or claim failure already triggered exponential backoff, but the server-poll catch discarded the error. The worker could keep recovering silently, leaving operators without a useful diagnostic.
- Server polling failures now go through the Desktop error logger while preserving the bounded retry backoff. A regression verifies one error is reported and a second immediate tick does not hammer the server.
- Desktop tests passed 151/151; Desktop typecheck, ESLint, build/preload, and `git diff --check` passed. Alongside the same-turn backend (601), POS (58), and customer-web (22) suites, 832 tests passed across those packages.
- This is source-only verification. The printer path has not been validated on a live restaurant workstation, and no push or deployment was made.

## Audit continuation: tenant-owned audit records (2026-10-11)

- A review of audit writers found several writes storing `user.tenantId` even though the request had already resolved its tenant from a trusted branch or the single-active-tenant legacy path. This could leave payment/refund, order, branch, device, printer, receipt, shift, or expense audit entries without tenant ownership.
- Audit entries now use the resolved tenant for payments and cash refunds, order-item refunds and bulk order deletion, branch deletion, device creation/update/deletion, printer deactivation, receipt deletion/retry, forced cash handover/shift close, and expense-category changes.
- Added a payment retry regression proving a completed Click payment can be safely replayed after Click is disabled without creating another payment. Refund and legacy global-owner bulk-delete tests assert the resolved tenant is written to the audit log.
- Backend tests passed 605/605; backend application and scripts typechecks, changed-file ESLint, and `git diff --check` passed. Existing same-audit package results remain Desktop 151/151, POS 58/58, and customer web 22/22.
- This remains source-only work in the server checkout. No commit, push, or deployment was made; physical printer/offline acceptance and live production checks remain separate.

## Audit continuation: background Telegram failure containment (2026-10-11)

- POS order creation dispatched its staff Telegram notification without awaiting or containing a rejection. A Telegram failure combined with a failed dead-letter write could escape as an unhandled rejection after the order had already committed.
- The background task now logs and contains failures without changing the committed POS order result. A regression covers the notification/dead-letter failure path.
- Backend tests passed 606/606 plus HTTP retry tests 3/3; backend typechecks, focused ESLint, Nest build, and git diff check passed. No push or deployment was made.

## Production read-only baseline (2026-10-11)

- GET-only production smoke passed 27/27 across API/database health, public catalog, customer-web, POS pages, owner login, media, and unauthenticated access guards. It made no orders or data changes.
- The production tag is at 77c86eb; audit checkout HEAD e0bfb48 is one commit ahead, with the current audit edits still uncommitted. The smoke proves the existing deployed baseline only, not these local changes.

## Audit continuation: Desktop lifecycle promise handling (2026-10-11)

- macOS window recreation and external-link launching discarded rejected promises. Failures are now logged and contained instead of becoming unhandled rejections.

- Desktop tests passed 151/151; typecheck, ESLint, and build passed after the change.

## Consolidated verification (2026-10-11)

- All selected app workspace test scripts passed in one serial run: backend 606, HTTP retry helper 3, Desktop 151, customer web 22, POS web 58, Telegram 5, and print-agent 7.
- Repository-wide ESLint passed; operational validators passed 33/33; the read-only production baseline smoke passed 27/27. Production smoke is not evidence for local uncommitted changes.

## Audit continuation: shift history and offline identity safety (2026-10-11)

- Cashier and owner shift lists counted only direct `orders.shiftId` links, while legacy history also includes `RevenueRecord.shiftId`. A shared branch-checked, deduplicated count now keeps list, detail, and order-history totals consistent. Owner shift lists aggregate cash totals only for open shifts instead of loading each closed shift's transaction ledger.
- Desktop cache identity now includes the authenticated employee. A repeated offline idempotency key preserves its original order payload and print jobs; it cannot rewrite the first order or enqueue duplicate receipts. Queued writes also retain their creator employee ID and move to the conflict inbox rather than replaying under a different employee.
- Regression coverage: backend 610 tests plus HTTP retry 3; Desktop 153; POS web 58. Backend/Desktop/POS typechecks, ESLint, and backend/Desktop/POS production builds passed.
- Source-only audit changes; production was not changed. Live printer, offline workstation, and payment-settlement acceptance remain separate.

## Audit continuation: per-printer replay and consolidated verification (2026-10-11)

- Desktop server replay previously suppressed an entire receipt route after one Windows printer had printed the offline copy. Replay now suppresses only the already-confirmed printer target, so other configured printers still receive their copy. Explicit manual reprints continue to bypass replay suppression.
- Shift counts retain both direct shift links and legacy revenue links, deduplicated with branch ownership checks. Owner shift summaries aggregate cash transactions only for open shifts.
- Current verification: backend 610 plus HTTP retry 3, Desktop 154, POS 58, customer web 22, Telegram 5, and print-agent 7 tests passed (859 total). Backend/Desktop/POS/customer/platform typechecks and builds passed; Telegram/print-agent typechecks and builds passed; repository ESLint passed; operational validators passed 33/33; media validation passed with 0 unresolved assets; `git diff --check` passed.
- This is source-only work in the server checkout. No production service was changed. Physical printer output, workstation offline recovery, and NBU settlement still require real-world acceptance; automated builds cannot certify those conditions.

## Audit continuation: disposable database acceptance (2026-10-11)

- The shift/kassa database validator had stale English expectations for two Uzbek backend errors. Updated those assertions to the actual cashier-no-shift and forbidden-other-branch responses; no production behavior was changed.
- Applied all 59 migrations to temporary databases on the isolated `mazetto-dev-postgres` service. Both the shift/kassa database validator (including concurrent open/close and sale-vs-close races) and the order-to-cash-to-stock-to-print end-to-end validator passed. Seed ran for the latter; both temporary databases were confirmed dropped afterward.
- The concurrency run emits a non-fatal deprecation warning from the pinned Prisma PostgreSQL adapter/`pg` 8.23 query queue path. The tests completed successfully; revisit before upgrading to `pg` 9. This does not indicate a failed transaction or production database change.

## Audit continuation: isolated unified cash acceptance (2026-10-11)

- Ran the unified cash flow validator against a separate ephemeral PostgreSQL 18 container named `cash_qa`, after applying all 59 migrations. Verified POS idempotency, unpaid dine-in behavior, pickup payment gating, courier completion and rollback, concurrent completion, cash transfers/recovery, disabled payment-method rejection, full-ledger balance, shift close totals, waiter-to-cashier settlement, and idempotent permission migration.
- The validator passed. The temporary container had no persistent volume and was removed after the run; the existing shared `cash_qa` database was not touched. The same pinned adapter/`pg` deprecation warning appeared during successful concurrency coverage.

## Audit continuation: admin catalog and sales-report database validators (2026-10-11)

- A clean PostgreSQL 18 database received all 59 migrations. The admin catalog and sales-report DB validators passed; the 205-order shift-close print/browser QA also passed at narrow receipt, A4, and mobile/desktop widths.
- The integration checks exposed stale test expectations, not runtime regressions: custom catalog items correctly return `CUSTOM` rather than `INTERNAL`; sales reports now expose refund handling; and cross-branch authorization returns the current Uzbek error. Updated only the validators, with the report fixture asserting a supported zero-refund amount.

- Backend application/script typecheck and backend tests passed (610 plus 3 retry tests). Temporary databases, browser service, and print-report QA output were isolated; no shared or production data changed.

## Audit continuation: staging tenant A/B isolation proof (2026-10-11)

- The guarded staging-only A/B proof passed for tenant membership/cache separation, verified and pending host/domain behavior, live order delivery/reconnect, customer logout revocation, reports/audit, OTP sessions, and tenant media isolation.
- The script verified its empty staging baseline before writes and asserted all synthetic records/media were removed afterward. No second live restaurant was activated and production was not touched.

## Audit continuation: Desktop package runtime and role smoke (2026-10-11)

- GitHub already publishes Desktop 0.1.115; current offline identity and multi-printer fixes need 0.1.116 for Windows workstations to receive them. The package version and active acceptance instructions now target 0.1.116.
- Desktop `build:ui` initially failed because `prepare-ui.mjs` invoked the server's standalone pnpm binary through Node as if it were JavaScript. The launcher now handles JS/CJS scripts, executable binaries, and Windows command shims; the versioned POS runtime built successfully and its runtime manifest reports 0.1.116.
- Desktop tests passed 154/154; typecheck, lint, shell build, and the embedded POS production build passed. In the actual packaged runtime, all seven staff roles passed desktop/mobile route and access checks; 205-order close-report, offline fallback, and reprint browser QA passed.
- These remain uncommitted source changes. No push or production deployment was made.

## Audit continuation: production media coverage and live smoke (2026-10-11)

- The release smoke previously checked product image URLs but missed category image references. It now checks image URLs returned by both public customer category and product APIs using read-only HEAD requests.
- Repository ESLint passed for the updated smoke script, and the production read-only smoke passed 27/27.
- The local media manifest validates 11 category assets, 74 product assets, 0 unresolved product assets, and 85 release files. Direct production HEAD checks passed 84/85 URLs; `/categories/blyudalar.webp` returned 404 on three attempts. The production category API currently references `/categories/doner.webp` for `Blyudalar`, so the 404 asset is not used by the live catalog. It was neither removed nor copied.
- `drinks.webp` timed out once but returned HTTP 200 on three retries. No production media volume or service was modified.
- Telegram webhook status remains unverified because the noninteractive server shell had no bot credential in its environment. The smoke stopped without reading or logging tokens, and no webhook was changed.
- All changes remain local; no push or production deploy was made.

## Audit continuation: isolated backup restoration and release preflight (2026-10-11)

- Created fresh production backup `/mnt/storage/backups/mazetto/postgres/mazetto-20261011-090128252.dump` (539,693 bytes; 703 archive entries). `latest-verified.json` records successful `pg_restore --list` verification at 2026-10-11 09:01:28 UTC.
- SHA-256: `782b03a035259bbf45194c783582f6001bd5a80299ac99be360bfc33fb18dbc9`. The dump then restored with `--exit-on-error` into a disposable PostgreSQL 18 container with `--network none`, no mounted volumes, and a temporary database; all 76 public tables restored successfully.
- The temporary container was removed after verification. No production database was restored into or modified; the older 2026-09-29 dump is historical only. The grouped source changes remain uncommitted and undeployed.
- No schema migration exists between production and the current main commit. The grouped audit changes remain uncommitted and undeployed.

## Audit continuation: Desktop credential save prompt

- Desktop login had encrypted credential storage and a pre-login checkbox, but did not offer the browser-like choice after successful authentication. The checkbox was easy to miss, so users could log in successfully without ever saving their credentials.
- Successful Desktop login now offers "Eslab qolish" or "Hozir emas" from the main process. Existing identical credentials do not prompt again; a changed password prompts to update. Credentials are encrypted through Electron safeStorage. If encryption is unavailable or writing fails, the app explains that the login succeeded but the password was not stored. The unused renderer save IPC was removed.
- Verification: Desktop 155/155 tests, TypeScript and build; POS web 58/58 tests, TypeScript, ESLint and production build. Full backend, Desktop and POS test suites also passed together earlier in this continuation. No schema migration is involved.
- Not yet verified: the native prompt and Windows DPAPI persistence need an interactive Windows workstation check. Desktop 0.1.116 is not published, so the current installed app does not include this change.
- Changes remain local on the server audit branch. No push, PR, merge, or production deploy was made.

## Audit continuation: Desktop saved credential bridge hardening (2026-10-11)

- The saved-account selector previously requested the decrypted password over a renderer IPC method. Although Electron context isolation and sandboxing were enabled, that unnecessarily exposed the stored secret to UI JavaScript.
- The renderer now receives only saved login identifiers. On submit, the main process resolves the selected password from Electron safeStorage and sends the authentication request; the plaintext saved password no longer crosses the bridge. Typing a password switches back to normal login. Browser username and current-password autocomplete semantics remain intact.
- Added regression coverage for case-insensitive email lookup, formatted phone lookup, typed-password pass-through, and unknown saved identities. Desktop tests passed 156/156; Desktop typecheck/build/lint passed. POS tests passed 58/58; typecheck, lint, and production build passed. Production dependency audit reported no known vulnerabilities; git diff check passed.
- The native save prompt, saved-account selection, and Windows DPAPI persistence still require a real Windows workstation acceptance test. No release or deployment was made.

## Audit continuation: consolidated review and printer replay edge case (2026-10-11)

- Per-printer replay now consults each confirmed target even if another target left the shared local job in retry state. This prevents duplicate paper on the printer that succeeded while allowing an unprinted printer to retry. Added a regression test for partial multi-printer success.
- Corrected the root README, which still described the repository as a foundation-only project and listed package directories that no longer exist.
- Final local verification: all 8 workspace packages passed typecheck/lint/build and all 33 operational validators; the full test run passed (backend 610, HTTP retry 3, Desktop 157, POS 58, customer web 22, Telegram 5, print-agent 7).
- The current branch remains uncommitted and undeployed. Production backup freshness, Windows/DPAPI behavior, real printer acceptance, Telegram secret-authorized status, and NBU payment reconciliation remain separate gates.

## Refreshed verification after offline idempotency review (2026-10-11)

- Re-ran the complete workspace test command: backend 611, shared HTTP retry 3, Desktop 160, POS web 58, customer web 22, Telegram 5, print-agent 7, and media URL smoke helper 4; 870 tests passed, none failed.
- Re-ran repository verification: all workspace typechecks, lint, and builds succeeded; all 33 repository/operations validators passed. Desktop's full regression suite also passed independently at 160/160. git diff --check is clean.
- Reviewed cashier payment-method settings through admin UI, tenant-scoped settings storage, POS catalog, payment validation, and Desktop bootstrap. Disabled methods are hidden from new cashier flows and rejected by the backend; old queued offline commands still require synchronization before changing methods. Customer checkout remains cash-only until provider settlement is implemented.
- Re-reviewed offline request fingerprinting, employee/branch binding, duplicate payment retry, and per-printer replay/ambiguous-print handling. No further source defect was found in these focused paths.
- This verifies the current source branch, not production. Production was not deployed, no push was made, and the existing production smoke result is only a read-only baseline. Remaining acceptance gates are Windows safeStorage/login prompt, real printer paper output, restaurant workstation offline/reconnect behavior, Telegram credential-authorized status, and NBU settlement reconciliation.
- Fresh production baseline: the production tag and main both point to 9d9c3b7; read-only production smoke passed 27/27 at 2026-10-11 10:47 UTC. These checks exercise the deployed baseline, not uncommitted source changes. Before any release, create a new verified database backup; the current evidence file is from 09:01 UTC.

## Audit continuation: table and hall concurrency (2026-10-11)

- A focused race review found hall/table checks happening before concurrent writes could commit. A table could become occupied after a status check, a table order could use a stale pre-lock status, or hall/table deletion could race with new table/order creation.
- Hall and table row locks now serialize create, archive, status changes, permanent deletes, table-order creation, and the release-after-close check; checks are repeated after locking through tenant/branch-scoped queries. New table codes use a random 48-bit suffix rather than a millisecond timestamp to avoid same-number collisions across halls.
- Regression coverage verifies lock order, stale state rechecks, guarded archive/status changes, and stable random-code format. Full workspace tests passed (876 total), typecheck/lint/build passed across all 8 packages, and 33/33 operations validators passed.
- Browser QA passed POS layout with 73 products at 320/1024/1530 px; staff workspaces and role navigation at 320/390/768/1024/1440 px; kitchen/courier/POS/shift flows; and 205-order shift report print/offline scenarios. No production state was changed; no push or deploy was made.

## Audit continuation: narrow-screen kitchen ticket layout (2026-10-11)

- Browser inspection showed that mobile/tablet kitchen tickets occupied only half the selected status lane, leaving a large blank area and forcing product names to wrap unnecessarily. The ticket lanes now use one full-width column through 1199 px.
- Added an E2E width assertion for the ticket card. Staff browser QA passed at 320/390/768/1024/1440 px; visually inspected the 320 px kitchen order with all items, note, timer, and actions visible. POS build and 58 POS tests passed; workspace verification remained green.
- No production service was changed, and no push or deployment was made.

## Audit continuation: tenant-scoped mutations and staff deletion invariants (2026-10-11)

- A write-scope pass found several operations that authorized a tenant-scoped read, then updated or deleted by ID alone. Branch updates, device enrollment/update/deactivate/delete/heartbeat, printer update/deactivate/bulk delete, expense-category update/archive, and receipt print confirmation now retain the authorized tenant and branch predicates in the database write itself.
- Device, printer, and staff bulk deletion now validate every selected record before mutation and execute the set with its audit rows in one transaction, so a later invalid target cannot leave earlier records partially deleted.
- Staff removal now protects the final active SUPER_ADMIN across demotion, blocking, termination, single deletion, and bulk deletion. A database row lock serializes destructive changes; membership is recounted inside the transaction after the lock, including the selected bulk targets. If the required system role row is missing, the operation fails closed.
- Added regression tests for tenant-scoped final writes, atomic bulk device/printer/staff removal, stale SUPER_ADMIN membership during bulk deletion, missing-role fail-closed handling, and receipt print-state writes.
- Verification after this grouped change: full backend suite 626/626 plus HTTP retry 3/3; full workspace test command passed, including the media URL checks; all eight workspace packages passed typecheck/lint/build; all 33 operational validators passed. The backend RBAC validator was updated to cover the added cache-invalidation call site. git diff --check is clean.
- No schema migration was added and no production data or service was changed. These source changes are still on the server audit branch. Production deployment remains gated on the separate live-workstation, printer, offline/reconnect, Telegram credential, payment reconciliation, fresh-backup, and CI acceptance requirements above.

## Audit follow-up: staff RBAC database smoke host (2026-10-11)

- The isolated PostgreSQL run applied all 59 migrations and seed successfully, then exposed that the staff RBAC database validator logged in without a registered host. Production authentication correctly rejected that request; this was a stale test fixture, not an application defect.
- The validator now creates a synthetic verified hostname in its isolated database and supplies it to every login attempt. The database-backed RBAC smoke passed end to end, including role/permission checks, password reset, blocking/reactivation, and last-SUPER_ADMIN protection.
- The disposable PostgreSQL container was removed automatically after the run. No shared staging or production database was used or changed.

## Audit continuation: refund employee status enforcement (2026-10-11)

- A cross-check of payment and refund authorization found that new payments and payment replays verify the cashier is still an active employee in the order branch, while cash refunds only checked that the session contained an employee ID. A stale or otherwise inactive employee session could therefore reach the refund transaction.
- Cash refund creation and idempotent replay now perform the same active-employee/branch check before reading a prior refund result or writing a new refund. Regression coverage verifies inactive employees are rejected both before the first refund and when replaying a completed refund, without extra ledger writes.
- Verification passed: `pnpm verify` and `pnpm test` completed successfully across all eight workspace packages, including 33 operational validators; backend tests passed 627/627 plus HTTP retry tests 3/3. The focused ESLint, backend application/scripts typechecks, and Nest production build also passed. The read-only production smoke separately passed 27/27 against the currently deployed baseline, which does not include this source change.
- This source-only continuation has not been pushed, merged, or deployed. No production service or database has been changed.

## Audit continuation: parallel refund and idempotency verification (2026-10-11)

- The disposable PostgreSQL unified-cash validator now races two different 7,000 so'm refund requests against one 9,000 so'm cash payment. Exactly one consumes the balance; the total refund is 7,000, shift cash remains 2,000, and the order returns to PENDING.
- A same-key concurrent retry exposed a second defect: PostgreSQL rejected the losing SERIALIZABLE transaction with SQLSTATE 40001, surfaced by Prisma as a P2010 raw-query error. Refund requests now retry bounded P2034 and PostgreSQL serialization/deadlock errors; the retry sees the committed idempotency record and returns that same refund rather than an internal error or second ledger write.
- Regression coverage checks P2010/40001 classification and irrelevant raw-query errors. The disposable PostgreSQL 18 validator passes both different-key over-refund protection and identical-key replay, with one refund row and the correct remaining cash.
- Full `pnpm verify` and `pnpm test` passed across all eight workspace packages, including 33 operational validators. Backend tests passed 627/627 plus HTTP retry tests 3/3. The standalone disposable database received all 59 migrations and was removed after the run.
- This refund/idempotency batch was committed as c47bed3, pushed to PR #296, and its GitHub verify plus Windows Desktop package checks passed. No production service or database was changed.

## Audit continuation: refund shift ownership (2026-10-11)

- The payment-refund endpoint previously allowed a user with refund permission to post a refund against another cashier's open shift without requiring branch-shift access. The order-item cancellation path already enforced this owner-or-branch-manager rule; idempotent payment-refund replay also bypassed the missing check.
- New refunds now require the active cashier to own the selected shift, unless the actor has SHIFT_VIEW_BRANCH. The guard is repeated after locking the shift, and completed-refund replay checks the original branch-scoped shift before returning its result.
- Unit regression verifies cashier rejection without ledger writes, branch-manager success, and denial of the same replay to the cashier. The isolated PostgreSQL validator verifies the same access boundary against a real migrated database and checks the recorded shift balance.
- Verification passed after this change: full pnpm verify and pnpm test across all eight workspace packages, 33 operational validators, backend 628/628 plus HTTP retry tests 3/3, and the isolated PostgreSQL 18 run after all 59 migrations. The temporary database was removed. Read-only production smoke passed 27/27 against deployed baseline only.
- This follow-up remains local and has not yet been pushed; no production service or database was changed.

## Audit continuation: grouped cross-flow verification (2026-10-11)

- A checkout retry path still used a two-minute age threshold after reservation, so an old-but-unexpired attempt could be deleted before the tenant-configured TTL. Stale detection now uses the persisted expiry for both retry and scheduled cleanup.
- The shift-close report warning previously used any cached response in the current panel; unrelated cached catalog data or another endpoint could label fresh order data as provisional. It now checks only the exact shift-order page, panel path, and current user's scope.
- Added regression tests for both cases. Full workspace pnpm verify passed: 14/14 typecheck/lint tasks, 7/7 builds, and 33/33 validators. Full pnpm test passed: backend 632, HTTP retry 3, Desktop 165, POS 62, customer web 22, Telegram 5, print-agent 7, and root tests 11; 907 passed, zero failed. git diff --check passed.
- Read-only production health checks passed for backend/POS/customer web/PostgreSQL/Redis; production smoke passed 27/27. This proves the current deployed baseline only, not these uncommitted fixes.
- No push, PR, merge, production deploy, migration, or production data write occurred in this grouped audit pass. The working branch remains uncommitted.
- Remaining external acceptance: verify the installed Windows Desktop build and native credential prompt/DPAPI, print a real multi-page shift report through the restaurant printer, exercise offline close/reconnect on the restaurant workstation, confirm Telegram webhook with authorized credentials, and obtain NBU transaction-reconciliation API/export evidence before automating QR payment matching.

## Audit continuation: hall/table data integrity (2026-10-11)

- Table reactivation could reintroduce a number already used by another active table in the hall. Reactivation now checks the same hall/number invariant as number edits; regression tests cover both conflict and successful reactivation when free.
- Hall and table create/update paths now reject whitespace-only names after normalization. Hall codes use random suffixes instead of millisecond timestamps, preventing simultaneous same-name hall creation from colliding on the branch-scoped unique code.
- Focused table suite passed 21/21; backend suite passed 636/636 plus HTTP retry 3/3. Full workspace tests passed; all eight package typecheck/lint/build tasks and 33/33 validators passed.
- Disposable PostgreSQL 18 acceptance passed after all 59 migrations and seed; the customer order-to-cash-to-stock-to-print validator passed. The temporary database and container were removed. No schema migration, production write, push, merge, or deploy occurred in this follow-up.
- The remaining external hardware and provider acceptance items above are still open; these tests verify source logic, not the restaurant workstation or printer.

## Audit follow-up: customer media URL configuration (2026-10-12)

- The customer-web image optimizer still allowed only the old hardcoded production media host, which rejected the documented local/custom media origin. It now builds a strict HTTP(S) Next image remote pattern from `NEXT_PUBLIC_MEDIA_URL`, retaining the production domain as the default and rejecting credentials/query/hash values.
- Added focused tests for production default, local port/path, malformed schemes, and credential/query/hash rejection.
- This changes image-host configuration only; development bypasses Next optimization so localhost media can load directly, while production remains optimized. The current production host behavior is unchanged. Customer-web tests passed 27/27; typecheck, lint, and production build passed with the production default. A separate build passed with `NEXT_PUBLIC_MEDIA_URL=http://localhost:8080/media`. Final full workspace `pnpm verify` passed across all 8 packages and 33/33 validators; `pnpm test` passed across all packages and root checks. No production service or database was changed.

## Audit continuation: grouped acceptance and domain-boundary correction (2026-10-12)

- Extended the disposable unified-cash PostgreSQL validator with parallel shift-open cases: different cashiers must receive distinct sequential branch numbers; concurrent duplicate opens for one employee must resolve to exactly one open shift. Both passed on a fresh PostgreSQL 18 database after all 59 migrations; the temporary container was removed.
- The full workspace verification passed on the grouped worktree: all typecheck/lint tasks, all builds, and 33/33 validators. Full `pnpm test` passed across workspaces, including backend 636/636, HTTP retry 3/3, customer-web 27/27, and 11 root smoke/unit tests.
- Repository docs had incorrectly described `mazetto.uz` as a public demo and stated that tenant authorization was not implemented. Updated the active roadmap/architecture to reflect the requested BestTeam owner-panel domain, the currently deployed `admin.mazetto.uz` route, Mazetto Food's separate brand/system, PR #296's unreleased tenant code, and the still-closed second-tenant gate. No DNS, Dokploy, production service, or data was changed.
- The Prisma migration run emitted a node-postgres deprecation warning from `@prisma/adapter-pg` transaction I/O. Migrations and acceptance still passed; the warning is recorded for dependency/tooling follow-up and was not treated as a business-logic failure.
- No per-file release was made. PR #296 remains open and undeployed; the current worktree is grouped and uncommitted pending the remaining audit and final release gate.
- Remaining external acceptance is unchanged: tenant A/B staging across all flows, backup/restore rehearsal, real Windows offline recovery and printer output, authorized Telegram lifecycle, and NBU settlement reconciliation.

## Audit continuation: live cashier payment-method setting (2026-10-12)

- A stale Redis value could keep a disabled cashier payment option available if cache invalidation failed after a settings update. This conflicted with the UI's immediate-toggle behavior.
- `cashier_payment_methods` now bypasses Redis for operational reads and the settings list, so new POS orders and payment collection consult the current tenant-scoped database value. Order creation and desktop snapshots reuse their existing transaction client, avoiding an extra connection; other low-churn settings retain the short Redis cache.
- Regression tests cover stale cached `CLICK` being rejected after the database changes to `CASH`, and fail-closed behavior if the live database read itself errors. The focused settings tests passed 3/3; the full workspace test command, typecheck/lint/build/33 validators, and the disposable PostgreSQL cash-flow validator passed. The PostgreSQL test applied all 59 migrations and was removed after completion.
- Offline POS payment options were extracted into a tested rule: offline mode exposes only `CASH`, while online mode retains all enabled methods; if `CASH` is disabled, the offline payment option list stays empty and submission is blocked. The focused regression passed 3/3 and the full POS suite passed 65/65 with lint and typecheck.
- New payment acceptance reads the live toggle inside the same tenant-scoped database transaction as the payment; completed idempotent replays do not re-check or re-create a disabled method.
- No production database, service, push, or deploy was changed in this pass.

## Audit continuation: shifts crossing midnight (2026-10-12)

- The current cashier shift-order endpoint additionally filtered by today's Tashkent date. If a cashier's shift remained open past midnight, orders already attached to that same shift from the previous date disappeared from its current-shift order list.
- Removed the redundant date range and its now-unused helper; the open shift ID and tenant/branch scope define the correct order set. Added a stable ID tie-breaker for paginated results and updated the regression.
- Backend suite passed 639/639; the focused shift regression passed 5/5; grouped verification passed 14/14 lint/typecheck, 7/7 builds, and 33/33 validators.
- No production service or database was changed.

## Audit continuation: offline cashier and receipt parity (2026-10-12)

- Offline Desktop receipt construction used a different payload shape from the online receipt writer. Existing tenders could lose their method code and print as CASH; cached web-order receipts could omit customer details; and amount/item fields were not normalized to the online receipt contract. Desktop now maps tender aliases, item/modifier snapshots, quantities, totals, and customer contact/address fields into the same canonical shape and formats monetary values consistently.
- POS marked the catalog offline only when a separate bootstrap fallback was used. Desktop's local gateway can instead return a cached catalog with HTTP 200 and an `X-Mazetto-Desktop: offline-cache` header; that path previously left all cached payment methods visible even though offline submission only permits cash. POS now combines the exact catalog cache freshness marker with the bootstrap fallback flag before filtering methods, so offline terminals expose CASH only (and block checkout if CASH is disabled).
- Added regressions for online/offline receipt method and customer data parity, and for cached HTTP-200 catalog detection and the resulting offline payment-method policy.
- Another fail-open UI edge was closed: if no valid POS catalog snapshot can be loaded, the temporary CASH fallback no longer enables the checkout button. Deferred-payment dine-in still needs a catalog, but does not require a tender until collection.
- Verification in this batch: backend tests 639/639, POS tests 70/70, Desktop tests 165/165, customer-web tests 27/27, Telegram agent 5/5, print-agent 7/7, and root smoke tests 11/11; HTTP retry tests 3/3 and 33/33 operational validators passed. App/script typechecks, ESLint, backend Nest build, POS/customer/BestTeam production builds, and Desktop main/preload builds passed. POS production build passed again after the latest checkout guard.
- `git diff --check` passed. Existing uncommitted work was preserved; no commit, push, merge, database migration, production write, or deployment was performed.
- Remaining proof is operational: exercise the new offline selector on the installed restaurant Desktop after an actual network cut/reconnect, verify a multi-tender cached order receipt on paper, and continue auditing the remaining application and UX domains. This entry does not claim that every repository file or line has been reviewed.
- Mocked Playwright role UI passed all 14 combinations: ADMIN, BRANCH_MANAGER, ACCOUNTANT, CASHIER, WAITER, KITCHEN, and COURIER at 1440px and 390px; route redirects and restricted admin access matched the role matrix, with no horizontal overflow.
- Customer-web browser QA loaded 42 route/viewport combinations (375–1440px): zero page errors, zero tiny-text findings, and no document-level horizontal scroll. Its heuristic emitted image/gradient contrast warnings and clipped `object-contain` image-width notices; these are documented false-positive cases in that script and remain visual/manual checks, not confirmed defects.

## Audit continuation: zero-balance semantics and cashier settings copy (2026-10-12)

- Checked zero-balance cancellation against cashier payment UI: PAID represents no balance due and removes a zero-sum order from the waiting list; it does not mean money was received. A regression test locks this invariant and verifies no payment, revenue, cash, or refund ledger entry is created when the final unpaid item is cancelled.
- The cashier payment settings still claimed offline terminals use the last downloaded full method list. Updated the admin hint and disable-confirmation copy to reflect the actual policy: offline POS permits CASH only; disabling CASH blocks offline sales, and pending offline actions must be synced before changing their payment method.
- Reviewed shift-close printing: the pre-close modal preview can be stale during concurrent activity, but the auto-print component reloads all paginated orders after the server confirms closure. No code change was needed for the printed snapshot.
- Focused cancellation/refund tests passed 17/17; full backend suite passed 640/640. Backend app/scripts typechecks, touched-file lint, and Nest build passed. POS tests passed 70/70; admin-settings typecheck/lint and the production build passed.
- This grouped audit change remains in the server worktree; no commit, push, merge, production write, or deploy was performed.

## Audit continuation: offline outbox error clarity (2026-10-12)

- When the server rejected a queued Desktop payment with a JSON 4xx response, the whole JSON body was stored and rendered as the error. The gateway now extracts readable nested/top-level messages (including validation message arrays), keeps plain-text fallbacks, and caps the stored text.
- Added a regression for CASH disabled after an offline payment was queued: the conflict stays in the outbox with a readable reason, then is retried successfully after CASH is re-enabled; the payment is sent exactly once on retry.
- Desktop tests passed 166/166; Desktop TypeScript and ESLint checks passed. No commit, push, merge, production write, or deployment was performed.

## Audit continuation: full local verification and live host smoke (2026-10-12)

- Re-ran all repository application suites: backend 640, HTTP retry 3, Desktop 167, POS 70, customer web 27, Telegram 5, print agent 7, and root health/release/media tests 20; 939 tests passed with zero failures.
- ESLint passed across all application packages. TypeScript passed for each application project and backend scripts. Backend Nest, Desktop main/preload, Telegram, print agent, customer web, POS web, and BestTeam platform production builds passed.
- The read-only production smoke passed 27/27, including backend/database health, public customer APIs, customer root and www checkout-auth routes, POS login/admin dashboard/settings routes, BestTeam login, and media assets. Direct root/www/pos API-origin checks also returned tenant-scoped public data with the expected CORS origin. The previously reported internal error was not reproduced in this live check.
- No production state was written. Changes remain uncommitted on the audit branch; no push, merge, migration, or deploy was performed. If the 500 recurs, capture its request ID so the exact failing endpoint can be matched to backend logs.

## Audit continuation: saved receipt branding migration (2026-10-12)

- Existing saved receipt profiles at schema versions 2 or 3 bypassed the new customer-receipt branding defaults, so the saved MAZETTO FOOD logo and name could remain visible after the renderer update.
- Schema version 4 now applies the requested one-time default only to the standard MAZETTO FOOD customer receipt when both brand controls were still enabled. Kitchen/other document profiles and custom business names remain unchanged; users can explicitly re-enable both controls and that choice persists.
- Receipt-renderer tests passed 22/22; the full Desktop suite passed 167/167. Desktop typecheck, ESLint, main/preload build passed.
- This fix remains in the local audit branch; production was not changed.

## Audit continuation: archived hall/table reactivation consistency (2026-10-12)

- Table update could reactivate a table while its parent hall remained archived, although creating a table already requires an active hall. Reactivation now requires the active hall row to be found after taking its lock; a missing hall lock also fails closed.
- Added a regression verifying an archived hall blocks table reactivation without writing the table. The complete backend suite passed 641/641; backend application and script typechecks, touched-file ESLint, and the Nest production build passed.
- No production service, database, push, or deployment was changed.

## Audit continuation: disposable cash acceptance and production smoke (2026-10-12)

- A no-volume PostgreSQL 18 container, bound to loopback only, received all 59 migrations before the unified-cash database validator ran. It passed POS, pickup, delivery, waiter collection, shift ownership, concurrent shift numbering, one-open-shift-per-employee, refund race/idempotency, transfer, disabled-provider, ledger, closeout, and permission-migration checks.
- The temporary database container was removed after the run; no production database or business data was touched.
- Production read-only smoke passed 27/27 against the deployed baseline. This does not verify source changes that remain local or in a pull request.
- `pg@8.23.0` emitted a non-failing deprecation warning from Prisma's PostgreSQL adapter during the intentional concurrent database workload. The acceptance passed; reassess adapter compatibility before adopting `pg@9`.
- No commit, push, production migration, production write, or deployment occurred.

## Audit continuation: production tenant-login diagnosis (2026-10-12)

- A read-only production aggregate found one active tenant, zero active employee accounts missing tenant membership, zero active branch-scoped memberships without a matching active employee, zero active memberships without an active restaurant role, and zero pending memberships.
- For the account shown in the earlier login screenshot, metadata-only lookup found an active account with a password hash, active employee, active tenant membership, and valid branch binding. Credentials/hash contents were not read or returned; no user identifier was recorded in this audit note.
- This rules out a broad membership-backfill or inactive-account cause for that login report, but does not prove the password the app submitted or the precise request path. If the same account still rejects after its owner/admin resets the password, capture the request ID and trace that attempt. No password, session, or other production data was changed.

## Audit continuation: repository inventory and validation-error detail (2026-10-12)

- `git ls-files` reports 1,259 tracked repository files. The previous `251` figure in the historical audit is not a current complete-audit count. A scoped `src`/`app`/`test` query returned 535 files; this is an inventory count, not a claim that every line has been manually reviewed.
- The Desktop outbox previously preferred NestJS's generic `error: "Bad Request"` over its detailed `message` array. It now prioritizes the actionable message, with a regression test using that framework response shape.
- Current batch verification: backend full tests 641 passed; Desktop full tests 167 passed; focused Desktop TypeScript and ESLint checks passed; `git diff --check` is clean.
- This fix remains in the grouped audit worktree. It has not been pushed or deployed.

## Audit continuation: IPv6 target range validation (2026-10-12)

- BestTeam's public HTTPS monitor accepted some reserved/documentation IPv6 addresses inside the broad global-unicast range, including 2001::/23 and 3fff::/20. This weakened the SSRF boundary and could report non-public targets as eligible.
- The probe now rejects those special-purpose prefixes, plus the documentation and 6to4 ranges, using parsed hextets so expanded IPv6 forms are checked too. IANA marks the cited special-purpose ranges as not globally reachable: https://www.iana.org/assignments/iana-ipv6-special-registry.
- Regression tests cover compressed and expanded forms and the 2001::/23 boundary. Focused test passed; full backend tests passed 641/641 plus HTTP retry 3/3; app/scripts TypeScript, touched-file ESLint, and Nest build passed.
- No production service or data was changed.

## Audit continuation: POS modifier retry fingerprint (2026-10-12)

- POS checkout retry identity previously included modifier IDs but not their selected quantities. If a modifier quantity changed while the same order was being retried, the UI could reuse a key for a different request body.
- The fingerprint now includes modifier IDs and quantities, sorted by ID so equivalent modifier ordering stays stable. A regression test proves quantity changes produce a new fingerprint and reordering does not.
- Reorder now restores modifier quantities from the current catalog: newly required minimums are inserted, removed modifiers are ignored, saved quantities are clamped to new limits, legacy selections without a quantity default to one, and invalid current constraints skip that line instead of submitting a rejected order.
- Final grouped verification passed 14 typecheck/lint tasks, 7 builds, and 33/33 operational validators. The full test run passed 945 tests: backend 649, HTTP retry 3, Desktop 167, POS 72, customer web 31, Telegram 5, print agent 7, and root smoke tests 11.
- git diff --check passed; no commit, push, production write, migration, or deployment occurred.
- Remaining external acceptance is unchanged: test real printer/driver output and offline disconnect/reconnect on the restaurant Desktop; verify Telegram webhook/provider credentials and NBU reconciliation with authorized production evidence.

## Audit continuation: Telegram product modifiers and resilient add flow (2026-10-12)

- Telegram product cards with variants or modifier choices now open a customer/chat-bound configurator; it shows selected modifiers and recalculated price, then revalidates the product options before adding the item.
- Configurator state expires after 30 minutes. A Redis `SET PX NX` claim prevents duplicate add callbacks; Redis command errors fail closed. The in-memory fallback remains atomic within a single process.
- Regression coverage includes required and optional modifiers, callback-size limits, chat/customer binding, option revalidation, concurrent duplicate callbacks, Redis argument/response semantics, and failure handling.
- Corrected the staff-workspace Playwright check: it expected obsolete checkbox controls while the POS presents quantity steppers. The actual variant, required modifier, optional modifier, payment retry/lock and shift flows now pass; kitchen/courier role flows and viewport checks also pass.
- Final local verification passed 14 typecheck/lint tasks, 7 builds, 33 operational validators, and 953 tests across all workspaces (backend 657, HTTP retry 3, Desktop 167, POS 72, customer web 31, Telegram 5, print agent 7, root smoke 11).
- The work remains uncommitted on the audit branch; no production state, database migration, push, merge, or deployment was performed.
- Still outstanding: physical printer/driver acceptance, restaurant Desktop offline disconnect/reconnect, authorized Telegram webhook/provider testing, NBU reconciliation evidence, tenant A/B staging and restore rehearsal, and the broader file-by-file audit. Passing CI/browser mocks is not proof of those external workflows.

## Audit continuation: modifier quantity integrity (2026-10-12)

- The order API accepted fractional modifier quantities even though modifier choice controls and product min/max constraints use whole units. With an unlimited maximum, a crafted request could be priced at a fraction of an add-on.
- `OrderItemModifierDto` now requires a positive integer quantity; omitted quantity continues to default to one. A regression test covers whole, default, and fractional values.
- Reorder now floors legacy fractional modifier snapshots before applying current min/max, so saved historical quantities do not produce a request rejected by the integer-only order API.
- Latest verification passed 14 lint/typecheck tasks, 7 builds, 33 validators, and 955 tests (backend 658, HTTP retry 3, Desktop 167, POS 72, customer web 32, Telegram 5, print agent 7, root smoke 11). `git diff --check` is clean.
- No commit, push, merge, production write, database migration, or deployment occurred.
- One-shot Knip flagged 119 files, including runtime-discovered validators and the Prisma seed configured in `prisma.config.ts`; those are not confirmed dead code. It reported no unused package dependencies; `pg`/`tsx` warnings matched the scripts' intentional backend-workspace resolution. No file or dependency was deleted; remaining flags need individual reference review.

## Audit continuation: tenant forwarded-host boundary (2026-10-12)

- Internal service requests use X-Forwarded-Host to retain the restaurant domain across Next.js rewrites. Next.js preserves a pre-existing forwarded-host header, so trusting it without explicitly setting it at the app boundary depended on reverse-proxy sanitization.
- Customer web and POS now overwrite X-Forwarded-Host from the incoming Host for /api/v1 requests, and remove the forwarded value if no direct host is present. This is defense in depth; production exploitability was not established because the edge proxy may already sanitize headers.
- Regression tests cover forged-header overwrite and missing-host removal in both apps. Customer/POS typechecks and lint passed; customer tests 32/32, POS tests 72/72, backend tenant/login tests 19/19, and both app production builds passed.
- No production request, migration, commit, push, or deployment was performed. This remains part of the broader audit; the release decision is intentionally deferred until meaningful changes are grouped and reviewed.

## Audit continuation: delivery coordinate validation (2026-10-12)

- Historical JSON coordinates could coerce null/blank values to zero, and out-of-range coordinates were accepted by the shared distance helper. It now rejects malformed and geographically impossible coordinates and clamps floating-point rounding before Haversine square roots.
- Regression coverage includes null, blank, numeric-string, out-of-range and invalid coordinates; delivery-distance tests passed 9/9, backend typecheck/lint passed, and related delivery-fee/audit-integrity tests passed 19/19.
- No production data, migration, push, or deployment was touched.

## Audit continuation: customer standalone routing and mobile header (2026-10-12)

- Reproduced a locale rewrite loop in the customer-web standalone runtime. The standalone server uses its configured container origin, while next-intl generated a rewrite against localhost; the issue happened before the page reached its normal route.
- Locale rewrites now re-anchor only safe HTTP(S) paths to the standalone HOSTNAME/PORT. The API host-forwarding branch remains separate. Forwarded protocol parsing accepts only the first exact http or https value; malformed headers fall back to the request protocol.
- The mobile restaurant logo was visibly clipped by a scale transform. The transform was removed, the image now crops transparent source padding inside its fixed box, and header widths are constrained to 200px on phones and 170px below 390px.
- Browser QA covered /, /menu, /cart, /checkout, /orders, /profile at 375, 390, 430, 768, 1024, 1366, and 1440px: 42/42 HTTP 200, no page-level horizontal overflow, stylesheet failures, navigation exceptions, or browser page errors. The 390px logo was visually inspected.
- The customer contrast QA now treats HTTP/navigation/style-load failures as hard failures. Its color contrast analyzer remains advisory for gradient/transparent backgrounds and is not claimed as a complete automated contrast proof.
- Uncached workspace tests passed 950/950 across six package tasks; the root smoke/unit tests passed 11/11. Customer web specifically passed 37/37 tests, lint, typecheck, and production build.
- Full lint, typecheck, and production build passed across all seven applicable workspace tasks; 33/33 safe operational validators passed; read-only production smoke passed 27/27.
- The mocked role matrix passed all 14 role/viewport combinations (seven roles at 1440px and 390px), including restricted admin routes.
- Standalone browser QA had no local backend connected, so the hydrated home page showed the expected disconnected-backend state. Production backend reachability is separately covered by the read-only smoke; this local run is not an offline acceptance test.
- Full release acceptance then passed, including the DB-backed order-to-cash-to-stock-to-print E2E against a newly created volume-free PostgreSQL container. The disposable container and test database were removed afterward.
- No push or deployment was made; the local code remains one grouped audit batch.
- NODE_OPTIONS=--trace-deprecation traced one non-blocking query-queue warning to Prisma's PostgreSQL adapter; the disposable E2E still passed. Track before a pg@9/adapter upgrade.
- Staff UI scenario QA passed: 73 product cards at 320/1024/1530px; Kitchen, Courier, POS, and Shift at 320/390/768/1024/1440px; no overflow or runtime errors. Mocked kitchen, courier, cashier retry/payment, shift-open/close, and read-only role workflows all passed.
