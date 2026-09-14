# MeaSoft research: executive summary

## Scope and result

This research first inspected the Mazetto repository, then enumerated and read the complete main namespace of the official [MeaSoft / CourierExe wiki](https://wiki.courierexe.ru/). Crawl time and every page/revision/link are recorded in [wiki-page-inventory.md](./wiki-page-inventory.md); page-specific lessons are in [page-by-page-lessons.md](./page-by-page-lessons.md). Production code was not modified during research.

Coverage: **236 discovered, 236 read, 108 high/medium pages deeply synthesized, 0 unread, 0 fetch failures**. The 78 unresolved internal targets are recorded; they are absent from the current official main-namespace inventory and include renamed, uncreated or legacy references rather than silently skipped pages.

## 1. Why MeaSoft is strong at order management

**MEASOFT FACT:** The system treats delivery as a network of related operational records: correspondence, enclosures, courier issuance, mobile result, office acceptance, money acts, manifests, warehouse movements and integration statuses. It provides scan-first workflows, role-aware actions, preliminary versus final outcomes, configurable reasons and changed-status synchronization with acknowledgement. Sources: [Карточка корреспонденции](https://wiki.courierexe.ru/index.php/Карточка_корреспонденции), [Статусная модель](https://wiki.courierexe.ru/index.php/Статусная_модель), [Выдача корреспонденции курьерам](https://wiki.courierexe.ru/index.php/Выдача_корреспонденции_курьерам), [API](https://wiki.courierexe.ru/index.php/API).

**OUR INTERPRETATION:** Its strength is not a long status list. It is controlled actions, explicit custody, separate financial finality, operator reconciliation and recoverable integration.

## 2. The 20 most useful patterns

1. Separate operational status domains instead of one giant status.
2. Business actions with preconditions rather than arbitrary status assignment.
3. Courier-reported result separated from manager-confirmed final result.
4. Scan-supported issue, return and item verification.
5. Explicit chain of custody and courier-to-courier handoff.
6. Typed non-delivery reasons that change retry/return behavior.
7. Item-level partial delivery and manager confirmation.
8. Delivery state independent from payment and money settlement.
9. Expected courier cash, physical submission and verification as separate steps.
10. Lifecycle-aware cancel/disable rather than unsafe delete.
11. Changed-only integration feed with explicit commit/ack.
12. At-least-once delivery plus consumer deduplication.
13. Mobile offline/retry diagnostics and order-change notification.
14. Durable local printing with observable errors and operator recovery.
15. Explicit manifests/batches for grouped physical handoff when needed.
16. Warehouse movement/reservation/reconciliation audit.
17. Permission-driven context actions and mass operations.
18. Exception tasks/tickets for failures that automation cannot resolve.
19. Configurable notifications and automation built on events.
20. Reports tied to operational durations, debts, failures and staff performance.

## 3. Mazetto's ten largest architectural gaps

1. `OrderStatus` still overloads order, kitchen and delivery meaning.
2. Generic order status mutation can bypass domain preconditions.
3. `OrderStatusHistory` is not a complete immutable domain event stream.
4. Accepted-order additions need a guaranteed revision/delta ticket contract.
5. Receipt polling lacks durable print claim, lease, attempts and ambiguous-result handling.
6. `servedById` cannot represent assignment offers, history or handoffs.
7. Courier can currently collapse reported delivery into final completion.
8. Courier cash due/submitted/verified/mismatch is not a first-class settlement aggregate.
9. Notifications/dead letters are not durable enough for guaranteed replay.
10. Branch scoping exists, but unrelated-tenant isolation is not yet structural.

Repository evidence and exact paths: [current-project-analysis.md](./current-project-analysis.md). Comparison: [gap-analysis.md](./gap-analysis.md).

## 4. Patterns to adopt immediately

P0: typed commands, aggregate version checks, immutable `OrderEvent`, transactional outbox/inbox, kitchen supplement revision, durable `PrintJob`, courier report/final split, delivery assignment entity and courier cash settlement. These address correctness, customer truth, device/network failure and financial accountability.

## 5. Patterns not to adopt now

Do not build full customs/linehaul manifests, complex serialized warehouse logistics, courier-agency payroll, interpreted tenant scripts or a generic report builder now. They add surface area without solving current restaurant operations. Custom fields may hold optional metadata, never core status/payment/permission rules.

## 6. Ideal order lifecycle

`DRAFT -> PLACED -> ACCEPTED -> FULFILLING -> FULFILLED -> COMPLETED`, with `REJECTED/CANCELLED` policy paths. Completion is a cross-domain policy result, not a cashier/courier dropdown. Accepted snapshots are immutable; later items become a revision/supplement with their own kitchen ticket and print job.

## 7. Ideal kitchen lifecycle

`QUEUED -> ACCEPTED -> PREPARING -> READY -> PACKED -> HANDED_OFF`. Kitchen owns only this lifecycle. Item-level progress and all actions are audited. An already-ready ticket does not regress when a supplement arrives.

## 8. Ideal delivery lifecycle

`UNASSIGNED -> ASSIGNED -> ACCEPTED -> PICKED_UP -> EN_ROUTE -> ARRIVED -> REPORTED_* -> FINAL_*`. Courier reports; manager/cashier verifies physical items/documents/money and finalizes. Retry and return are explicit; A-to-B transfer preserves custody until B accepts.

## 9. Ideal payment lifecycle

Payment uses `UNPAID/PENDING/AUTHORIZED/CAPTURED/REFUNDED/FAILED`; cash uses `COLLECTED/SUBMITTED/VERIFIED/MISMATCH`. Delivery finality never silently means paid or reconciled. Every provider and cash operation is idempotent and append-only.

## 10. Reliable printer architecture

Create a durable print job in the same transaction/outbox chain as kitchen acceptance. A local agent makes outbound authenticated claims with expiring leases, stores a durable local spool, reports stable attempt IDs and only ACKs after printer success evidence. Lost ACK is deduped; printer/notebook/network outage retries with backoff; ambiguous timeout is operator-visible; reprint creates a child job with reason and audit. Cloudflare Tunnel remains app routing, not an inbound printer-control dependency.

## 11. Scaling to 10, 100 and 1,000 restaurants

- **10:** One deployment and database are acceptable; branch-scoped indexes, queues, WebSocket rooms, printer routing and event/outbox observability are mandatory.
- **100:** Introduce explicit tenant/restaurant hierarchy, worker partitioning by tenant/branch, read projections, object-storage scope, per-tenant quotas and noisy-neighbor monitoring.
- **1,000:** Partition high-volume append-only events by time/tenant, independently scale workers and realtime gateways, use regional routing where required, automate tenant provisioning/key rotation and test restore/isolation continuously. Do not shard before metrics show a bottleneck; design stable tenant keys now.

## Document map

- [current-project-analysis.md](./current-project-analysis.md): current codebase, models, panels and risks with code references.
- [wiki-page-inventory.md](./wiki-page-inventory.md): complete crawl audit and unresolved links.
- [page-by-page-lessons.md](./page-by-page-lessons.md): all 236 pages, business/data/UX/technical lesson and priority.
- [status-model.md](./status-model.md): MeaSoft status domains/codes and Mazetto separation.
- [business-workflows.md](./business-workflows.md): action catalog, courier, partial/failed delivery, cash, API, print, automation, roles and UX.
- [event-catalog.md](./event-catalog.md): event contracts, producers/consumers, idempotency and audit.
- [gap-analysis.md](./gap-analysis.md): current-vs-target capability matrix.
- [target-domain-model.md](./target-domain-model.md): entities, fields, relations, constraints and migration order.
- [state-machines.md](./state-machines.md): six Mermaid state machines and transition tables.
- [implementation-plan.md](./implementation-plan.md): phased DB/backend/frontend/API/test/rollout plan.

## Completion checklist

- [x] Repository architecture and transition points analyzed
- [x] Wiki home, main menu and all current main-namespace articles inventoried
- [x] Relevant internal links audited; unresolved targets listed
- [x] `UNREAD = 0`; fetch failures = 0
- [x] Order/status/courier/partial/failed delivery reconstructed
- [x] Payment, cash reconciliation, warehouse, manifests and mobile app analyzed
- [x] API changed-status/commit, automation, Webhook/SMS/replication analyzed
- [x] Security/users, reports, tasks/tickets, custom fields, PVZ, MeaShip and urgent orders covered
- [x] Gap analysis, target model, state machines, event catalog and implementation plan completed

## Source integrity

MeaSoft facts are labeled and linked to official wiki pages. Interpretations and recommendations are explicitly separate. No proprietary implementation is assumed or copied; only documented concepts, workflows and reliability patterns are adapted. The crawl cache is ignored from Git; reproducible scripts remain in this directory.
