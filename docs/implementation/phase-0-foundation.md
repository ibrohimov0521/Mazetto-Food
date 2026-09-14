# Phase 0 - Safety and foundation

## Scope

This phase adds infrastructure only. It does not change current order/kitchen/delivery behavior or enable a new lifecycle.

## Domain naming and IDs

- Existing entity IDs remain Prisma `cuid()` strings for backward compatibility.
- Every HTTP request receives a correlation UUID unless a safe caller-provided `X-Correlation-ID` is present; the response echoes the ID.
- API errors include `requestId`, allowing support logs and future domain events to be joined without exposing stack traces.
- Event IDs and aggregate naming are reserved by the research event catalog; event tables arrive in Phase 1.

## Concurrency

- `orders.version` starts at `1` for every existing and new row. Phase 1 action updates will use `WHERE id = ? AND version = ?` or row locks where side effects require a transaction.
- This additive column does not change current writes or reads.

## Idempotency

- `Idempotency-Key` syntax is centralized: 8-128 safe ASCII characters.
- Canonical JSON hashing ignores object-key order while preserving array order.
- `idempotency_requests` uniquely owns `(scope,key)`, stores request hash, correlation, outcome/resource and expiry.
- Same key + different hash is a conflict. Completed/failed records are replayable outcomes. An in-progress duplicate is rejected rather than run twice.
- Existing specialized POS/payment/customer checkout idempotency remains unchanged until migrated action by action.

## Authorization

- Permission wildcard and “all required permissions” checks now use one helper shared by guards and future domain commands.
- Branch scope continues through the existing `resolveBranchScope` helpers. Action services must perform both permission and object-scope validation inside the service, not rely only on UI visibility.

## Transaction convention

Phase 1 commands will run state mutation, version increment, immutable event and outbox insert in one Prisma transaction. External I/O is never performed while holding that transaction; workers consume the committed outbox afterward.

## Migration and rollback

Migration `20260914090000_order_foundation` only adds columns, enum, table and indexes. Application rollback is safe because old code ignores them. Database rollback should not drop the idempotency table after action traffic begins; disable new paths and retain records until a controlled cleanup release.

## Frontend

No visible frontend change is appropriate in this foundation phase. Correlation is exposed via response header/error payload for later support UI.
