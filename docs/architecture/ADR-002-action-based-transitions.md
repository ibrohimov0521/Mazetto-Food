# ADR-002: Action-based transitions

## Context

Generic status updates cannot consistently enforce actor, current state, prerequisites, concurrency, side effects or idempotency.

## Decision

Critical transitions use named commands such as accept, cancel, start preparation, report delivery and finalize delivery. A compatibility adapter may call the same command service during migration.

## Consequences

Controllers stay thin and invalid transitions fail consistently. More endpoints/DTOs are required, but they express business intent.

## Alternatives

A generic transition endpoint with a status body was rejected for primary workflows.
