# Phase 2: kitchen supplements, cash provenance and staff lifecycle

## Status

`IN PROGRESS (LOCAL)`. The operational core described below is implemented and
verified against an isolated PostgreSQL database. Production rollout, station
routing and the remaining race/rollback scenarios are not complete phase gates.

## Database changes

- `20260914130000_cash_transfer_allocations` adds immutable source allocations
  to every new cash handover. An allocation can retain its source ledger entry,
  order and payment when cash moves through more than one employee.
- `20260914133000_kitchen_ticket_revisions` links supplemental orders to their
  parent, numbers supplements, versions kitchen tickets and snapshots the exact
  active items sent to the kitchen. Existing tickets and items are backfilled;
  no order, payment, ticket or staff history is deleted.

Both migrations were applied to `mazetto_preview` on `127.0.0.1:55432`. Prisma
reports 31 migrations and an up-to-date schema.

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

## Local verification evidence

- Backend tests: `196/196` passed.
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

## Rollout and rollback

1. Back up and restore-test a staging clone before applying either migration.
2. Apply both additive migrations, deploy backend, then deploy POS. Old clients
   continue to read the existing order and ticket fields.
3. Create one main plus supplemental order and one partial cash handover in a
   canary branch. Reconcile ticket/event and transfer/allocation sums.
4. If application rollback is required, deploy the previous image and leave the
   additive tables/columns in place. Do not drop them on a live database.

## Remaining Phase 2 gates

- Add station/routing snapshots only after real grill/fryer/drinks ownership is
  agreed; the current single-kitchen workflow must remain the default.
- Add explicit kitchen endpoint idempotency keys and a two-device concurrency
  integration test, including cancel-versus-ready races.
- Add item-level kitchen void/cancellation events instead of mutating ticket
  snapshots.
- Run migration/backfill and rollback rehearsal on a production-like staging
  clone. No production push or deploy is part of this local work.
