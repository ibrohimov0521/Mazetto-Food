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

- **STATUS:** COMPLETE (production deployed and verified)
- **FILES CHANGED:** kitchen ticket/routing snapshots and immutable events, idempotent versioned kitchen actions, parent-linked supplemental orders, item cancellation actions, cash transfer allocations/detail UI, staff termination guards, compact profile layout, and customer delivery-address validation/autofill UX
- **MIGRATIONS:** `20260914130000_cash_transfer_allocations`, `20260914133000_kitchen_ticket_revisions`, `20260914150000_kitchen_action_hardening` (all deployed)
- **TESTS:** backend 208/208; backend/POS typecheck, lint and production builds; validators 27/27; production-backup rehearsal passed without count drift or orphans; production migration applied; post-deploy smoke 22/22; protected item-cancel route registered
- **KNOWN ISSUES:** real grill/fryer/drinks ownership still needs business mapping; historical transfers without stored composition remain explicitly unknown and are never estimated; pg 8.23 emitted a non-blocking nested-query deprecation warning during clone shutdown and must be removed before a future pg 9 upgrade
- **NEXT STEP:** Phase 3 MAZETTO Desktop and durable print jobs

## Phase 3 - MAZETTO Desktop and reliable printing

- **STATUS:** D0 COMPLETE; D1 foundation IN PROGRESS
- **FILES CHANGED:** desktop master plan, Electron shell, loopback API gateway, SQLite projection/outbox/print schema, safe Electron updater/preload bridge, POS desktop API routing/status/update badges, device heartbeat API and coverage
- **MIGRATIONS:** no production migration in D0/D1 foundation; the local SQLite schema and stable device identity are created atomically on first run
- **TESTS:** desktop cache, JWT scope and stable device identity tests; gateway snapshot and device-header tests; backend device heartbeat tests; backend 210/210; six-workspace typecheck/lint; native Electron process; bundled UI without port 3001; packaged unpacked Windows runtime; updater IPC/typecheck; loopback status and production API snapshot verified locally
- **KNOWN ISSUES:** update feed provisioning/signing, admin enrollment code, OS-protected credential storage, session lock/staff switch, authenticated WebSocket proxy, typed mutation replay and durable server-side print jobs are intentionally scheduled after the D1 foundation
- **NEXT STEP:** D1 admin enrollment and revocable device credential

## Later phases

| Phase                                         | Status      |
| --------------------------------------------- | ----------- |
| 0 - Foundation and safety rails               | COMPLETE    |
| 1 - Order aggregate and immutable history     | COMPLETE    |
| 2 - Kitchen lifecycle and supplements         | COMPLETE    |
| 3 - MAZETTO Desktop and reliable printing     | IN PROGRESS |
| 4 - Delivery / courier                        | NOT STARTED |
| 5 - Payment and courier reconciliation        | PARTIAL     |
| 6 - Notifications and exception automation    | NOT STARTED |
| 7 - Reporting and observability               | NOT STARTED |
| 8 - Multi-tenant hardening                    | NOT STARTED |
| 9 - Deprecation, scale and disaster hardening | NOT STARTED |
