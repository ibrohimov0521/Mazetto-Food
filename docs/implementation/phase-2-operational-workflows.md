# Phase 2: kitchen supplements, cash provenance and staff lifecycle

## Status

`RELEASE READY; DEPLOY PENDING`. The original operational core is deployed.
Kitchen action hardening described below is implemented locally and its
additive migration passed a production-backup restore/backfill/rollback
rehearsal.

## Database changes

- `20260914130000_cash_transfer_allocations` adds immutable source allocations
  to every new cash handover. An allocation can retain its source ledger entry,
  order and payment when cash moves through more than one employee.
- `20260914133000_kitchen_ticket_revisions` links supplemental orders to their
  parent, numbers supplements, versions kitchen tickets and snapshots the exact
  active items sent to the kitchen. Existing tickets and items are backfilled;
  no order, payment, ticket or staff history is deleted.
- `20260914150000_kitchen_action_hardening` snapshots each ticket item's current
  `KITCHEN/BAR/RECEIPT/NONE` route and printer identity, and adds correlation,
  idempotency and item references to immutable kitchen events.

The first two migrations were applied to `mazetto_preview` on
`127.0.0.1:55432`. The third passed both a fresh 32-migration install and an
isolated restore/backfill rehearsal using the 2026-09-14 production backup.

## Implemented behavior

### Kitchen and late additions

- A late item is sent as a separate supplemental order linked by
  `parentOrderId` and `supplementNumber`; the accepted main order is not edited.
- Each main or supplemental order creates a distinct ticket with immutable
  `KitchenTicketItem` snapshots.
- Ticket transitions append a versioned `KitchenTicketEvent`. Ticket state is
  authoritative in kitchen reads and cannot regress through the legacy order
  status projection.
- Waiter and kitchen views show `Qo'shimcha #N`; the kitchen card reads ticket
  snapshots rather than the current mutable menu/order projection.
- Every HTTP kitchen action now requires the ticket version and an
  `Idempotency-Key`. Concurrent device actions serialize on the order row;
  duplicate equivalent actions are no-ops and conflicting stale transitions
  return `KITCHEN_VERSION_CONFLICT`.
- Item cancellation has a dedicated idempotent order action. It marks the
  linked kitchen snapshot cancelled and appends `KitchenItemCancelled` with the
  actor, reason, reason code, correlation and request identity.
- Legacy item PATCH cannot cancel a line without the versioned action context;
  an empty ticket snapshot never falls back to unrelated live order items.
- Station and printer routing are snapshots. Later menu changes therefore do
  not rewrite the routing history of an already-created ticket.

### Cash handover composition

- Before `CASH_OUT`, the service reconstructs available source buckets in FIFO
  order and stores the exact amount consumed from each source.
- A source can be an opening balance, order sale, other income or previous cash
  handover. Accepted and rejected handovers preserve original order/payment
  provenance when the money is transferred again.
- `GET /cash-register/transfers/:id` is branch and employee scoped.
- Cashier, shift and admin transaction views expose a compact `Tarkib` dialog
  with sender, receiver, total, source orders and a sum mismatch warning.
- Historical transfers created before this migration are explicitly labelled as
  having no stored composition; the UI does not invent an estimated breakdown.

### Staff lifecycle

- Blocking an account is temporary suspension and no longer writes a false
  termination date.
- `POST /staff/:id/terminate` disables login, records `TERMINATED`, revokes
  sessions and writes a reasoned audit event while preserving all history.
- Termination and deletion are blocked while the employee has an open shift or
  pending incoming/outgoing cash handover. Self-removal and last-super-admin
  protections remain active.
- Hard login deletion is available only after the linked employee is terminated.
- A terminated employee cannot be silently reactivated by ordinary profile,
  role or status edits. `POST /staff/:id/rehire` is the explicit reasoned action
  that starts a new employment period and writes `STAFF_REHIRED` to audit.
- The profile form uses a denser layout: identity and branch/status controls are
  aligned first, roles use the full available width, and dangerous actions stay
  in a separate compact section.

## Verification evidence

- Backend tests: `208/208` passed after action hardening.
- Backend and POS typecheck, lint and production builds passed.
- API smoke created a main table order and `Qo'shimcha #1`; two distinct kitchen
  tickets contained one immutable item each and the supplement emitted
  `KitchenSupplementCreated`.
- The supplement moved `NEW -> ACCEPTED -> COOKING -> READY`; a later attempt to
  regress it to cooking returned HTTP `400`. Ticket version/event count reached
  `4/4`.
- A two-hop `45,000 -> 30,000 -> 20,000` cash test retained the original
  `SALE`, order ID and public order number in the second transfer. Allocation sum
  equalled the transfer total.
- Staff termination returned HTTP `400` with an open shift, then succeeded after
  the remaining cash was handed over and the shift was closed.
- Browser smoke confirmed the compact staff profile, `Tarkib` dialog and visible
  supplemental kitchen ticket without horizontal scrolling.
- Service-level concurrency tests cover duplicate accept, stale cross-action
  updates and cancel-versus-ready races from two devices.
- A disposable PostgreSQL 18 cluster applied all `32/32` migrations from an
  empty database and seeded 91 products successfully. The cluster was stopped
  after verification.
- The 2026-09-14 production backup restored into an isolated PostgreSQL 18
  database with 90 orders, 227 order items, 90 kitchen tickets and 227 kitchen
  item snapshots. Applying the hardening migration preserved every measured
  row count, backfilled all 227 routes and produced zero orphan references or
  duplicate ticket event versions.
- A rollback compatibility transaction proved that the previous application
  write shape can omit every new field; defaults/nulls remain valid and the
  probe rolled back without residue.
- A clone API canary advanced a ticket from version 1 to 2, replayed the same
  idempotency key without a second event, rejected a stale action with HTTP 409
  and propagated an item cancellation into one kitchen event and the active
  ticket snapshot.

## Rollout and rollback

1. Back up and restore-test a staging clone before applying the new migration.
2. Apply all additive migrations, deploy backend, then deploy POS. Old read
   clients
   continue to read the existing order and ticket fields.
3. Create one main plus supplemental order and one partial cash handover in a
   canary branch. Reconcile ticket/event and transfer/allocation sums.
4. If application rollback is required, deploy the previous image and leave the
   additive tables/columns in place. Do not drop them on a live database.

## Remaining Phase 2 release gates

- Agree the real grill/fryer/drinks ownership and map products/printers in admin.
  Until then `NONE` and the current single-kitchen board remain valid defaults.
- Commit and deploy the migration/backend/POS release, then execute the same
  canary against production and monitor errors before enabling station splits.

After this gate, reliable print jobs are implemented backend-first. The final
local print engine belongs inside MAZETTO Desktop; the existing Node print
agent is retained only for compatibility and shadow/canary verification.
