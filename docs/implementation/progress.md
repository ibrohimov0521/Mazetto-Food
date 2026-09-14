# Order-management implementation progress

## Research checkpoint

- **STATUS:** COMPLETE
- **FILES CHANGED:** `docs/measoft-research/`
- **MIGRATIONS:** None
- **TESTS:** 236/236 official wiki pages read; documentation integrity checks passed
- **KNOWN ISSUES:** 78 unresolved official internal-link targets are inventoried
- **NEXT STEP:** Phase 0 foundation

## Phase 0 - Safety and foundation

- **STATUS:** COMPLETE
- **FILES CHANGED:** common correlation/idempotency/authorization infrastructure, API error envelope, Prisma schema, tests, baseline and ADRs
- **MIGRATIONS:** `20260914090000_order_foundation` (additive: order version, audit correlation/reason, idempotency requests)
- **TESTS:** Prisma schema valid; workspace compile/lint/build 15/15; backend 181/181; validators 27/27
- **KNOWN ISSUES:** A running local `pos-web` dev server can keep the Turbo wrapper alive after its 15/15 summary because both use `.next`; package builds and validators themselves pass. No local DB credential was available for applying the migration.
- **NEXT STEP:** Phase 1 - order aggregate, immutable events, action service, outbox and timeline API

## Phase 1 - Order aggregate and audit events

- **STATUS:** COMPLETE (local code gate; staging database rollout remains pending)
- **FILES CHANGED:** order event/action services, legacy writer integrations across orders/kitchen/courier/customer/payments/tables, admin order detail, tests and rollout notes
- **MIGRATIONS:** `20260914103000_order_events` (additive `OrderState`, `OrderEvent`, `OutboxEvent`; historical `OrderImported` backfill)
- **TESTS:** Prisma schema valid and client generated; backend typecheck/lint/build; admin typecheck/lint/build; backend 192/192; validators 27/27; isolated PostgreSQL 18 preview applied 29/29 migrations and passed API/browser smoke; `git diff --check` clean
- **KNOWN ISSUES:** Existing-data backfill and real transaction/rollback rehearsal still require staging before release. Outbox publisher is intentionally absent. Legacy PATCH transition tightening and kitchen supplement delta tickets are Phase 2. No push/deploy performed.
- **NEXT STEP:** Finish the remaining Phase 2 concurrency, cancellation and staging rollout gates

## Phase 2 - kitchen supplements and operational controls

- **STATUS:** IN PROGRESS (local operational core complete)
- **FILES CHANGED:** kitchen ticket snapshots/events, parent-linked supplemental orders, cash transfer allocations/detail UI, staff termination guards, compact profile layout, and customer delivery-address validation/autofill UX
- **MIGRATIONS:** `20260914130000_cash_transfer_allocations`, `20260914133000_kitchen_ticket_revisions` (both additive and applied only to isolated `mazetto_preview`)
- **TESTS:** backend 199/199; backend/customer/POS typecheck, lint and production builds; real API and browser smoke for supplement tickets, transition regression, two-hop cash provenance and staff termination guard; 390x844 browser regression for visible/focused house-number validation
- **KNOWN ISSUES:** production-like staging rehearsal is pending; kitchen station routing, item-level void events and explicit endpoint idempotency/two-device race coverage remain; old transfers have no historical composition and are never estimated
- **NEXT STEP:** close the remaining Phase 2 gates, then start Phase 3 reliable printing

## Later phases

| Phase                                | Status              |
| ------------------------------------ | ------------------- |
| 1 - Order aggregate and audit events | COMPLETE (LOCAL)    |
| 2 - State machines and actions       | IN PROGRESS (LOCAL) |
| 3 - Kitchen lifecycle                | NOT STARTED         |
| 4 - Reliable printing                | NOT STARTED         |
| 5 - Delivery / courier               | NOT STARTED         |
| 6 - Payment reconciliation           | NOT STARTED         |
| 7 - Notifications + automation       | NOT STARTED         |
| 8 - Reports + monitoring             | NOT STARTED         |
| 9 - Multi-tenant hardening           | NOT STARTED         |
