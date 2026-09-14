# ADR-005: Transactional outbox and consumer inbox

## Context

A committed order change can be followed by a process crash before print/notification publication. Direct synchronous effects do not close this gap.

## Decision

Write publishable events to a database outbox in the domain transaction. Workers deliver at least once; consumers deduplicate by event ID in an inbox and acknowledge only after durable processing.

## Consequences

Lost effects become retryable and observable. Consumers must be idempotent, and outbox retention/monitoring is operational work.

## Alternatives

Best-effort post-commit calls and in-memory queues were rejected for critical side effects.
