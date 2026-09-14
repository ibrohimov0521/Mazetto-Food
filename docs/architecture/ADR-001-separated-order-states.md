# ADR-001: Separate lifecycle states

## Context

The current `OrderStatus` represents commercial order, kitchen and delivery progress. Research shows preliminary courier reports, final office acceptance and finance are independent.

## Decision

Evolve incrementally toward separate Order, Kitchen, Delivery, Payment and Print lifecycles. Existing status remains a compatibility projection until every caller migrates.

## Consequences

Transitions become clearer and metrics reliable, but temporary dual-read/write and reconciliation are required.

## Alternatives

Extending one enum was rejected because it permits invalid cross-domain combinations and unclear ownership.
