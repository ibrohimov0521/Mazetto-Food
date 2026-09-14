# Incremental implementation plan

## Delivery principles

- Every phase is independently deployable and reversible at the application level.
- Expand -> backfill -> dual-write/read -> reconcile -> switch -> contract. Destructive schema contraction is a later release.
- No production order/payment/cash row is rewritten without backup, count/checksum reconciliation and rollback procedure.
- Feature flags are tenant/branch aware; default off for risky paths.
- Every command has RBAC, scope, state precondition, concurrency and idempotency tests.

## PHASE 0 - Architectural cleanup and safety rails (P0)

**DB migrations:** Add append-only `OrderEvent`, `OutboxEvent`, `InboxEvent`; aggregate version where missing; idempotency and scope indexes. Initially nullable/backfillable tenant fields are not introduced yet.

**Backend:** Create typed order command facade around current service methods; central transition policy; transaction helper that writes domain change + event + outbox. Inventory all direct `Order.status` writes and prohibit new ones with lint/test guard.

**Frontend/API:** Replace status dropdown calls with action endpoints while keeping compatibility routes behind internal adapter. Return `409 STATE_CONFLICT` with current state/version; expose order timeline read API.

**Tests:** Migration/backfill, event atomicity, outbox crash/replay, idempotent command, stale version, forbidden role/branch, old-client compatibility.

**Risk/rollout:** High blast radius. Dual-write events first, compare status history nightly, then move each endpoint. Rollback disables outbox publisher and uses existing service path; inserted events remain harmless audit.

## PHASE 1 - Order aggregate and immutable history (P0)

**DB migrations:** `OrderRevision`; revision links on item/ticket; event correlation/causation; reason codes. Backfill revision 1 from accepted order snapshots.

**Backend:** Accepted revision immutability, supplement/revision command, cancellation policy and completion policy across domain summaries.

**Frontend/API:** Timeline, change reason, revision badge, original/supplement relationship. Accepted-order item additions use explicit “Qo'shimcha yuborish” flow.

**Tests:** Totals snapshot, duplicate supplement, concurrent edit/accept, cancelled order, item delta and backward-compatible reads.

**Risk/rollout:** Item snapshot reconciliation report before enabling writes. Existing `isSupplemental` maps to revision/supplement without deleting parent relation.

## PHASE 2 - Kitchen state machine and supplement delivery (P0)

**DB migrations:** `KitchenTicketItem`, ticket version/events, `sourceOrderRevision`, station/routing snapshot; unique ticket-per-revision/station.

**Backend:** Make kitchen command state machine authoritative; delta ticket for added products; cancellation/void action; no regression of already ready ticket. Emit `KitchenTicketCreated`, `OrderReady`, `OrderHandedOff`.

**Frontend/API:** Kitchen sees original and “Qo'shimcha #n” together but as distinct actionable tickets; audible/new badge until accepted; dense responsive columns with no horizontal scroll; supplement acknowledge action.

**Tests:** Existing workflow, late item addition, duplicate event, two kitchen devices, cancellation race, item-level readiness, mobile layout/browser smoke.

**Risk/rollout:** Enable one branch; compare new projection to current ticket/order status sync. Compatibility sync remains read-only fallback during rollout.

## PHASE 3 - Reliable Print Agent (P0)

**DB migrations:** `Printer`, `PrintAgent`, `PrintJob`, `PrintAttempt`; unique logical print key; lease/retry indexes.

**Backend:** Transactional print creation, atomic lease claim, token-scoped ACK, retry/backoff/dead letter, explicit reprint child job, agent heartbeat and route resolution.

**Agent/frontend/API:** Durable local spool, stable attempt ID across restart, payload checksum, claim/start/ack protocol. Admin queue with failure class, last seen, retry/reroute/reprint and audit reason.

**Tests:** Lost ACK, duplicate poll, lease expiry, server/agent restart, printer offline, timeout unknown result, branch routing, manual reprint authorization.

**Risk/rollout:** Shadow-create jobs while old receipt polling prints; compare only, then enable new printing for one printer. Never let both paths print the same logical ticket.

## PHASE 4 - Courier delivery workflow (P0/P1)

**DB migrations:** `Courier`, `CourierShift`, `DeliveryTask`, `CourierAssignment`, `CourierHandoff`, `DeliveryAttempt`, `DeliveryAttemptItem`, `DeliveryFailureReason`, `CustodyEvent`.

**Backend:** Offer/accept/self-claim policy, unique active assignment, physical pickup, A-to-B handoff, offline device event dedupe, reported vs final delivery, retry/return/failure reason validation.

**Frontend/API:** Dispatcher queue/map-ready data; courier compact task list and offline pending indicator; manager “Kuryerdan qabul qilish” view for docs/items/money; customer sees report vs final wording correctly.

**Tests:** Concurrent claim, cross-branch denial, transfer target decline/accept, replayed mobile event, full/partial/failed/reschedule/return, manager finalization permission.

**Risk/rollout:** Backfill current `servedById`; dual-write assignment projection. Start with report/final split before enabling partial delivery.

## PHASE 5 - Payment and courier cash reconciliation (P0/P1)

**DB migrations:** Extend payment operations; add `CashCollection`, immutable `CashLedgerEntry`, `CourierSettlement`, `SettlementItem`, mismatch reason/evidence.

**Backend:** Independent payment state policy; COD creates expected collection; submit/verify/mismatch commands; shift-close gate; compensating financial correction with privileged reason.

**Frontend/API:** Super admin/manager dashboard by courier: expected, submitted, overdue, mismatch, linked orders; request submission action. Cashier settlement wizard with scan/select, expected/actual and receipt.

**Tests:** Double collection/reconciliation prevention, partial delivery recalculation, refund after cash, mismatch, unauthorized override, shift close with debt, balanced ledger invariant.

**Risk/rollout:** Read-only expected-balance projection first and reconcile against current cash transactions; financial writes feature-flagged and monitored.

## PHASE 6 - Notifications, automation and exception tasks (P1)

**DB migrations:** Durable `Notification/Attempt`, `AutomationRule/Execution`, `Task`; unique business notification and incident fingerprint.

**Backend:** Outbox consumers, channel retry/dead-letter, code-defined rules, stuck-order/print/payment/cash monitors, operator retry/resolve actions.

**Frontend/API:** Unified operational inbox; notification attempt timeline; safe enable/disable/version of rules.

**Tests:** Provider timeout/callback duplication, backoff, dead letter, repeated source event, rule versioning, task dedupe and SLA escalation.

**Risk/rollout:** Mirror current notification send into durable records, then switch workers. Generic user scripts remain out of scope.

## PHASE 7 - Reporting and observability (P1)

**DB migrations:** Read models/materialized aggregates for lifecycle durations, print health, courier cash aging and branch KPI; no transactional source duplication.

**Backend:** Event projector with rebuild checkpoint; timezone-aware metric definitions and late-event correction.

**Frontend/API:** Filterable branch/date/channel dashboards; drill-down from metric to event timeline; CSV export with permission and audit.

**Tests:** Metric fixtures, timezone/day boundary, cancelled/partial orders, replay/rebuild equality and tenant scope.

**Risk/rollout:** Run new and legacy reports side-by-side; publish metric definitions next to dashboard.

## PHASE 8 - Multi-tenant hardening (P2)

**DB migrations:** `Tenant`, `Restaurant`, membership/scope; add nullable tenant keys, default-tenant backfill, validate then non-null; composite scoped indexes/FKs.

**Backend:** Mandatory `TenantContext`, scoped repositories, tenant-aware jobs/cache/WebSocket/storage, platform-admin boundary and per-tenant configuration.

**Frontend/API:** Tenant/restaurant switcher only for authorized membership; clear scope indicator; tenant management and safe ownership transfer.

**Tests:** Cross-tenant matrix for every API/job/socket/object, guessed IDs, cache isolation, background replay and storage signed URLs.

**Risk/rollout:** Highest data-isolation risk. Rehearse on production clone, run orphan/cross-scope detectors, canary one tenant. No table contraction in same release.

## PHASE 9 - Hardening, deprecation and scale gates (P1/P2)

**DB/backend:** Remove legacy writes only after zero-drift window; partition/archive append-only tables when measured; rate limits, retention and encryption policy.

**Frontend/operations:** Runbooks for print/payment/cash/delivery incidents, disaster restore drill, SLO dashboards and feature-flag cleanup.

**Tests:** Load/concurrency, restore rehearsal, failover, permission snapshot, zero-downtime migration and rollback drill.

## Priority matrix

| Pattern | Priority | Why |
| --- | --- | --- |
| Typed action transitions, immutable events, outbox | P0 | Prevents silent invalid state and lost side effects |
| Kitchen supplement revision | P0 | Current operational correctness issue |
| Reliable print job/ACK/idempotency | P0 | Local device/network failure is normal and order-critical |
| Courier report vs manager final | P0 | Fixes false customer “Yakun” and custody ambiguity |
| Courier cash balance/settlement | P0 | Direct financial control and audit requirement |
| Delivery assignments/failure reasons | P1 | Needed for safe scaling and support |
| Durable notifications/tasks | P1 | Makes exceptions operable |
| Event-based KPI | P1 | Enables performance management after event foundation |
| Inventory reservation/returns | P1 | Food cost and supplement correctness |
| Full tenant hierarchy | P2 | Necessary before selling to unrelated restaurants, risky too early |
| Custom fields/report builder | P2 | Useful after canonical model stabilizes |
| Manifest/customs/serial logistics | P3 | Does not fit normal local fast-food fulfillment |
| Interpreted automation scripting | P3 | High safety/complexity; code-defined rules sufficient now |

## Phase gates

Every phase must pass: schema review; backup/restore rehearsal if data-changing; unit/integration/e2e; RBAC and scope matrix; concurrency/idempotency tests; production-like smoke; observable canary; rollback instruction; docs and migration reconciliation query. Push/deploy only at a phase boundary unless an urgent isolated fix is required.
