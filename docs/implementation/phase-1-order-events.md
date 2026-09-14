# Phase 1: order aggregate and immutable events

## Scope

- `Order.orderState` is a projection distinct from the legacy `Order.status` used by existing POS, kitchen and courier clients. `DRAFT` and `REJECTED` are reserved for later action policies; current new orders start at `PLACED`. `PREPARING`, `READY` and `SERVED` project to `ACCEPTED` until independent kitchen/delivery states are introduced.
- `Order.version` is monotonic for the order mutations covered here. Accepted orders continue to use the existing item snapshot fields (product/variant name, unit price, modifiers); this phase does not introduce immutable revisions or change the existing supplement workflow. Late kitchen delivery is Phase 2.
- All order creation paths write `OrderPlaced`; confirmation writes `OrderAccepted`. Item changes, legacy status transitions, payment-driven POS completion, kitchen transitions, customer cancellation and courier transitions write `OrderEvent` and matching unpublished `OutboxEvent` in the same transaction. Non-lifecycle metadata/payment-only writes do not increment the order version.
- Existing order status APIs remain compatible. `POST /orders/:id/actions/accept` and `/cancel` require an `Idempotency-Key`, expected version, branch/employee scope and permissions. The admin detail uses these two commands; other status controls still use the legacy route. The timeline and allowed-actions APIs require `ORDER_VIEW`.
- Existing orders receive one `OrderImported` event at their current version. No historical event or downstream notification is fabricated by the migration. There is no outbox worker in this phase; it must not be enabled before consumer deduplication and replay are implemented.

## Deployment gate

1. Take a verified database backup. In staging, apply foundation migration `20260914090000_order_foundation` before `20260914103000_order_events`; check `prisma migrate status` and review row counts. Do not point a local command at production by accident.
2. Check `SELECT COUNT(*) FROM orders`, then after migration compare with `SELECT COUNT(*) FROM order_events WHERE "eventType" = 'OrderImported'`. For each existing order there must be exactly one imported event with the same `version` and mapped `orderState`. Newly created orders will have `OrderPlaced` instead.
3. Deploy app after schema expansion. Verify POS, online and table checkout; kitchen accept/ready; courier handoff; customer cancel; payment-driven completion; and admin accept/cancel + timeline in a staging branch. Check that every new event has exactly one corresponding outbox row, no tenant/branch crossover, and version equals the latest event version.
4. Monitor unique-version violations, status/state drift, action 409s and outbox growth. Do not publish outbox messages yet. Canary by branch once operational smoke is available.

## Reconciliation queries

```sql
SELECT o.id, o."branchId", o.status, o."orderState", o.version,
       e."aggregateVersion" AS last_event_version
FROM orders o
LEFT JOIN LATERAL (
  SELECT "aggregateVersion" FROM order_events e
  WHERE e."orderId" = o.id ORDER BY "aggregateVersion" DESC LIMIT 1
) e ON true
WHERE e."aggregateVersion" IS DISTINCT FROM o.version
   OR o."orderState" IS DISTINCT FROM CASE
        WHEN o.status = 'COMPLETED' THEN 'COMPLETED'::"OrderState"
        WHEN o.status = 'CANCELLED' THEN 'CANCELLED'::"OrderState"
        WHEN o.status = 'NEW' THEN 'PLACED'::"OrderState"
        ELSE 'ACCEPTED'::"OrderState" END;

SELECT e.id, e."orderId" FROM order_events e
LEFT JOIN outbox_events b ON b."sourceEventId" = e.id
WHERE e."eventType" <> 'OrderImported' AND b.id IS NULL;
```

## Rollback

- Roll back the application image, not the expanded tables. Prior code ignores new columns/tables and continues using `Order.status` and `OrderStatusHistory`; no order/payment/cash rows are removed.
- Disable any future outbox publisher before rollback. The Phase 1 writer has no publisher. Preserve events for investigation; do not DROP tables or revert migration on live data.
- If the old image wrote orders during rollback, the new projection and event/version counter will be stale. Before re-enabling Phase 1 action endpoints, identify the drift with the query above and reconcile each affected order under a row lock with a new explicit `OrderReconciled` audit entry and matching outbox record. Do not replay old outbox rows as if they were live deliveries. Back up and verify the reconciliation on a clone first.

## Verification and limits

- Prisma validation/generation, typecheck, lint, backend tests and workspace validators/build are required at this gate.
- Local PostgreSQL credentials are not available here: migration execution, DB transaction rollback and production-like integration tests must run in staging before rollout. Mock tests verify call order and compatibility; they do not substitute for a live DB test.
- Phase 2 owns kitchen ticket versioning, delta tickets for supplements and separate kitchen actions. Phase 3 owns durable printing; Phase 4 owns reported versus finalized courier delivery. Do not interpret `COMPLETED` from the legacy courier endpoint as verified handover yet.
- The legacy `PATCH /orders/:id/status` still accepts some non-forward transitions from already accepted orders. The Phase 2 transition policy must remove these paths after clients move to action endpoints; Phase 1 does not silently tighten older clients.
