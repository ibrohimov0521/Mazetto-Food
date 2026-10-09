# Mazetto Food: 2026-10-10 code and workflow audit

This is the current release audit, scoped to the live server checkout. Earlier audit files are historical snapshots and are not proof of the current production state.

## Scope and evidence

- Inspected the current checkout and 688 tracked application source files across backend, POS, customer web, Desktop, Telegram and BestTeam platform directories through repository search, tests, and focused reviews of the active money, print, offline and shift workflows.
- Ran all workspace tests: 748 passed in the latest full run (backend 546, Desktop 136, POS 44, customer 17, Telegram 5). Typecheck and lint passed for all workspace projects. The repository's 33 operations validators passed. All workspace builds passed. The read-only production smoke passed 27/27 before this release.
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

## Reviewed with no code changes

- Checkout/order/payment authority remains in the backend. Cash balance and shift sales records remain distinct.
- Shift history access continues to enforce tenant, branch, own/branch permission checks. The report only uses that authorized endpoint.
- Existing Desktop printer routing and deduplication tests pass; the shift report currently uses the operating system's browser print dialog.
- Customer web, Telegram bot, BestTeam platform and media files were not changed by this release. BestTeam Control is a separate product from the restaurant POS/admin interface.

## Remaining operational and product gaps

- A browser print invocation is not proof that a printer fed paper. The shift report has not been physically tested on the restaurant's eventual receipt printer. Select its driver/paper in the print dialog and check a real multi-page shift. Godex G500 90 x 80 mm label printing was previously confirmed for receipts, not this long shift report.
- Offline close can queue a pending command. The printed provisional report may be incomplete; after sync, reopen the closed shift and print the server-confirmed version. No automatic replacement print is asserted.
- A web/waiter order may be paid into this shift while `Order.shiftId` remains null. Such an order now appears in the shift report, but the existing item-cancellation/refund path still requires an order-owned open shift. The cashier UI intentionally does not offer that refund action for this case. This needs a separate transactionally safe payment-shift refund design and end-to-end tests before enabling it.
- Existing shift list counters count orders created directly in the shift. Their labels now say "Smenada yaratilgan"; the printed report lists the wider set, including orders whose revenue was recorded in the shift.
- The shared NBU QR's SMS contains no order ID. Same-amount payments cannot be assigned automatically or marked paid from an SMS alone. Bank API/reconciliation evidence is needed; see `docs/NBU_QR_RECONCILIATION.md`.
- The Desktop app must update to 0.1.106 on each workstation for the whitespace-only item-note correction. Browser/POS updates do not replace an installed executable automatically until the release is published and installed.
- Production smoke is read-only and cannot prove a real customer checkout, a bank settlement, a shift with 205 real orders, Telegram delivery, or hardware spooler behavior. Those require controlled acceptance checks with the restaurant.

## Follow-up acceptance order

1. Confirm the release and Desktop installer are deployed; repeat production smoke and verify the running commit/version.
2. Close a controlled low-value test shift with multiple statuses on the restaurant workstation; inspect all printed pages and compare count, cancelled rows, payment entries, expected cash and closing cash with admin history.
3. Test restricted cashier/branch-manager roles, offline close and sync, and a paid online order in the same shift without using a real customer payment.
4. Obtain NBU's merchant transaction API/export contract before implementing QR auto-reconciliation.
