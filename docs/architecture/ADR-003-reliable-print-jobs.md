# ADR-003: Durable print jobs

## Context

The local print agent currently polls receipts. Network, process and printer failures can make success ambiguous or cause duplicate work.

## Decision

Introduce durable logical print jobs, expiring leases, append-only attempts, stable agent attempt IDs, retry/dead-letter and explicit audited reprint. The agent connects outbound.

## Consequences

Printing survives restarts and is observable. Rollout must ensure the legacy and new path never print the same logical ticket.

## Alternatives

Longer polling timeouts and direct inbound printer access were rejected because neither solves acknowledgement ambiguity.
