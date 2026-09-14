# ADR-004: Immutable order event log

## Context

Status history alone cannot reconstruct action intent, side effects, reason, correlation or cross-domain causality.

## Decision

Every critical order-related command appends a versioned immutable domain event in the same transaction as state mutation.

## Consequences

Timeline, audit and reporting become reconstructable. PII retention must redact protected payload fields without deleting financial/custody facts.

## Alternatives

Expanding mutable audit metadata and deriving all history from current rows were rejected.
