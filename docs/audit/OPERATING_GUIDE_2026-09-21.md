# MAZETTO FOOD operating guide

This guide describes the intended production behavior. Where the implementation
is incomplete, the warning links conceptually to the remediation plan.

## Customer order

1. The customer opens the website or Telegram bot and selects delivery or pickup.
2. For delivery, location and address are captured. Backend quote decides the
   branch, delivery eligibility, fee, minimum order and available payment methods.
3. The customer selects product variant/modifiers and reviews the final cart.
4. Phone verification identifies the customer. A retry must reuse the same
   idempotency attempt and must never create a duplicate order.
5. The backend creates the order, emits realtime events, sends Telegram staff
   notification, and makes it visible in Online orders/Kitchen.
6. Staff accepts, prepares and completes or assigns/delivers it. Customer history
   and Telegram messages follow the same backend status.
7. A cancellation is allowed only when the backend returns that action. It must
   create a cancellation document and print it on the configured route.

Current limitation: customer payment is CASH only. Click, Payme and Card must not
be advertised as available until provider settlement and refund are implemented.

## POS sale

1. Cashier signs in on an enrolled Desktop and opens a shift.
2. Cashier chooses products, variants and modifiers, then the order type/table.
3. Sending to kitchen creates/updates a kitchen ticket exactly once.
4. Payment is processed with an idempotency key. Only configured operational
   methods may be selected.
5. Successful payment creates a receipt and durable print jobs.
6. Desktop claims only jobs it can print, prints them, then acknowledges the
   lease. A failure stays retryable and is visible in Admin > Receipts.
7. Cashier closes the shift only after cash movements and transfers are resolved.

Offline behavior: cached reads remain available. Supported writes enter the local
outbox and replay in order when connectivity returns. Conflicts must be shown to
the operator; they must never be silently overwritten.

## Kitchen

1. `NEW/CONFIRMED` tickets appear in the appropriate queue.
2. Kitchen accepts, starts, marks ready and completes according to order type.
3. Every command is idempotent and records actor/time/correlation data.
4. A cancelled order leaves the active queue and generates a cancellation print
   route where configured.

Warning: online kitchen works, but Desktop offline replay of kitchen PATCH actions
is currently not registered correctly. Treat offline kitchen changes as unsafe
until remediation D1 is complete.

## Courier and cash handover

1. Courier opens the courier shift and sees only branch-scoped assignments.
2. Delivery status follows allowed backend actions; cash delivery cannot be
   completed without the required shift context.
3. Courier creates a cash transfer to an authorized receiver.
4. Receiver accepts or rejects it. Both sides retain an audit trail.
5. Shift totals derive from payments and cash transactions, not UI calculations.

Warning: transfer accept/reject is not fully covered by Desktop offline replay.

## Admin panel

- Use Dashboard for read-only operational overview. Clicking KPI cards should
  open the relevant pre-filtered register.
- Use Orders/Online orders for lifecycle exceptions. Filters are encoded in the
  URL and must survive detail/back navigation.
- Use Products/Categories/Modifiers for catalog; Homepage for hero/promotions.
- Use Inventory/Recipes/Suppliers for stock and cost ownership. Create an active
  warehouse before enabling recipe-based automatic deduction.
- Use Branches for branch hours, availability, halls, tables and branch devices.
- Use Devices to create a device slot, issue a 15-minute one-time code, enroll the
  actual Desktop, inspect heartbeat/version, disable/edit/delete it.
- Use Staff and Roles for least-privilege access. Frontend hiding is convenience;
  backend permission checks are authoritative.
- Use Receipts for document history, queue failures and reprints. Printer setup
  should be available next to Receipts after remediation.
- Use Audit and System health for investigation, not as replacements for alerts.

## Desktop enrollment and update

1. Administrator creates a device for the correct branch and obtains a one-time
   enrollment code.
2. On that physical Desktop, open the enrollment dialog and enter the code within
   15 minutes. The admin list must then show enrolled time, heartbeat and version.
3. A disabled or unenrolled Desktop must not perform branch operations.
4. Staff logs in once; refresh session keeps the device signed in until logout,
   password/session revocation or expiry.
5. Update status is available in the Desktop top bar/settings. Manual check fetches
   `latest.yml`; after download, Install and restart applies the new version.

Current security limitation: enforcement happens only when the client supplies
the Desktop device header. A server-issued device-bound credential is required
before enrollment can be considered a strict security boundary.

## Printers and receipts

Target design:

1. Admin creates one or more printers for a branch, gives each a route such as
   `RECEIPT`, `CANCELLATION` or kitchen station, and activates it only after test.
2. Desktop discovers assigned printers and confirms connectivity without consuming
   a real print job.
3. Each business document creates one durable job per matching active printer.
4. Jobs are claimed only by an agent that declares that printer ready.
5. Retry uses exponential backoff; exhausted jobs become dead letters with a clear
   admin action. Reprint creates a new auditable job, not a new sale.
6. Cancelling a paid/printed order creates a separate cancellation document and
   prints `BUYURTMA BEKOR QILINDI` automatically.
7. Reprint renders the immutable document snapshot captured at issue time. Later
   order edits must never change the contents of an already issued receipt.

Current limitation: Desktop exposes one fallback host, printer deletion is absent,
untargeted jobs can be claimed without readiness, the receipt schema allows only
one document row per order, and current ESC/POS rendering reads live order rows.
Do not certify physical printing until these are fixed and tested with a real
ESC/POS printer.

## Incident checklist

1. Check public web/API/media health and Admin > System health.
2. Check Desktop online state, enrolled state, version and pending/conflict counts.
3. For order issues, inspect order timeline and audit correlation ID.
4. For Telegram, inspect agent webhook status, pending update count and dead letters.
5. For printing, inspect receipt, print job, last attempt/error and printer status.
6. Do not delete evidence or manually mutate production tables. Use audited retry,
   reprint, disable or recovery actions.
7. Before schema repair, create and verify a database backup and rehearse restore.
   Run `pnpm db:rehearse-restore -- --archive=<verified .dump, .sql or .sql.gz>`
   against local PostgreSQL. The command refuses remote hosts, applies migrations
   twice, restores the archive again as rollback proof, compares core row counts,
   writes `.release-evidence/database-restore-rehearsal.json`, and destroys both
   temporary databases.
