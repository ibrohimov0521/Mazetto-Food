# Mazetto Food: 2026-10-10 code and workflow audit

This is the current release audit, scoped to the live server checkout. Earlier audit files are historical snapshots and are not proof of the current production state.

## Scope and evidence

- Inspected the current checkout and 688 tracked application source files across backend, POS, customer web, Desktop, Telegram and BestTeam platform directories through repository search, tests, and focused reviews of the active money, print, offline and shift workflows.
- The previous full workspace run passed 748 tests (backend 546, Desktop 136, POS 44, customer 17, Telegram 5). Typecheck and lint passed for all workspace projects. The repository's 33 operations validators passed. All workspace builds passed. After deployment #290 (a6707ab), the independent read-only production smoke passed 27/27.
- Follow-up local verification: backend source and script typechecks passed, all 548 backend tests passed, the changed Telegram service passed ESLint and the Nest production build. Customer web passed TypeScript, ESLint, 17 tests and production build in its separate release check.
- Ran an isolated browser flow with 205 mocked orders, 80 mm and A4 report rendering, 375/768/1366 px UI, automatic print invocation, reprint without a second close, and an offline post-close fetch failure. No production order or payment was created.
- A verified production database backup was written before release: `/mnt/storage/backups/mazetto/postgres/mazetto-20261009-190500773.dump` (532,612 bytes; 703 archive entries). No database migration is part of this change.
- These checks are broad regression coverage, not a claim that every path in 688 files or every physical device has been exercised.

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
- Existing shift list counters count orders created directly in the shift. Their labels now say "Smenada yaratilgan"; the printed report lists the wider set, including orders whose revenue was recorded in the shift.
- The shared NBU QR's SMS contains no order ID. Same-amount payments cannot be assigned automatically or marked paid from an SMS alone. Bank API/reconciliation evidence is needed; see `docs/NBU_QR_RECONCILIATION.md`.
- The Desktop app must update to 0.1.111 on each workstation for the manual receipt reprint fix and earlier offline cash queue safeguards, including pending cash transactions and guarded offline collection of existing orders with a local receipt job. It also includes the 0.1.110 cash-payment guard, 0.1.109 cash-balance projection, 0.1.108 shift-close guard, 0.1.107 payment projection and 0.1.106 item-note correction. Browser/POS updates do not replace an installed executable automatically; install the published release on each workstation.
- Production smoke is read-only and cannot prove a real customer checkout, a bank settlement, a shift with 205 real orders, Telegram delivery, or hardware spooler behavior. Those require controlled acceptance checks with the restaurant.

## Follow-up acceptance order

1. [x] Confirm production deploy #297 at `e3cb9c7` and read-only smoke 27/27. Desktop 0.1.110 is published; workstation installation remains separate acceptance.
2. Install Desktop 0.1.111, then test an already-cached unpaid order offline: exact cash, same employee/branch open shift, immediate local receipt, reconnect sync and no duplicate server receipt. Also reprint that receipt from history and confirm it produces exactly the requested paper copy.
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
- Human acceptance still needed: install Desktop 0.1.111 on workstations, test real receipt/shift paper on the chosen printer, verify offline close after sync, and obtain NBU merchant API/export details before automating QR reconciliation.
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

## Audit continuation: legacy shift opening balance

- The live cashier summary rebuilt the current drawer balance from cash ledger rows starting at zero. For an older/open shift whose stored `openingBalance` had no `OPENING_BALANCE` ledger row, the UI omitted the opening float even though shift-close and transfer calculations already had a legacy fallback.
- Current shift balance now uses `openingBalance` only when the opening ledger entry is absent, matching the established shift calculation and avoiding double-counting when the ledger entry exists.
- Regression tests cover both legacy and ledger-backed shifts. Backend suite passed 555/555; the new focused history suite passed 7/7; ESLint, backend app/script TypeScript checks, Nest build, and `git diff --check` all passed. Full CI and production release remain the gate for this continuation.

## Release confirmation: cashier item-cancellation permissions

- PR #270 was squash-merged as `cc6d708d2c1ece09ad3c878c9a315d39f8162d19`; Deploy #304 succeeded, production smoke passed, and the `production` tag was verified at that commit.
- POS history returned HTTP 200 in a read-only production request. No migration or Desktop release was needed.

## Audit continuation: item-cancellation payment status

- A service-level transaction regression exposed a financial status bug: after cancelling an item, order totals were recalculated and the code then subtracted that item's price a second time when deciding whether the remaining order was paid. An underpaid remainder could therefore be marked `PAID` incorrectly.
- The remaining total is computed once from the pre-cancellation order and reused for refund calculation and post-cancellation payment status. A follow-up check found that order-level status must represent whether the *new* total is still owed, while the payment row retains its own `PARTIALLY_REFUNDED` audit status. The order is now `PAID` when net payments cover the reduced total, `PENDING` when a balance remains, and `REFUNDED` only when the zero-total order's funds have been fully returned. This prevents a fully covered pickup order from reappearing in the cashier queue while keeping underpaid orders payable.
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
