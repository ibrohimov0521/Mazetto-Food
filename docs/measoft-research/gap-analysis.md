# MeaSoft to Mazetto gap analysis

Baseline evidence is documented in [current-project-analysis.md](./current-project-analysis.md). MeaSoft facts come from the official pages linked per row; recommendations are independent Mazetto designs.

| Capability | MeaSoft pattern | Mazetto now | Gap | Recommended implementation | Priority |
| --- | --- | --- | --- | --- | --- |
| Status model | Separate courier report, manager acceptance, tracking, manifest and finance domains ([source](https://wiki.courierexe.ru/index.php/Статусная_модель)) | `OrderStatus` carries order/kitchen/delivery meanings; kitchen ticket partly separate | Coupled transitions and unclear finality | Separate Order/Kitchen/Delivery/Payment/Print/Settlement states | P0 |
| Business actions | Issue, accept work, delivered/partial/failed, return and reschedule actions ([source](https://wiki.courierexe.ru/index.php/Выдача_корреспонденции_курьерам)) | Generic `updateStatus` remains alongside kitchen action API | Arbitrary mutations can bypass prerequisites | Command endpoints with actor, reason, preconditions and event | P0 |
| Order event history | Delivery info, status and operational records retained | `OrderStatusHistory` exists but is not complete domain event log | Side effects/correlation not reconstructable | Append-only `OrderEvent` + compatibility projection | P0 |
| Accepted-order additions | Mobile courier receives order-change notice ([source](https://wiki.courierexe.ru/index.php/Мобильное_приложение_курьера_для_Android)) | Supplemental order exists but cross-panel contract needs hardening | Kitchen may miss or confuse delta | Revision/supplement ticket, distinct print and acknowledgement | P0 |
| Kitchen workflow | Physical actions and scan-based custody inform pattern | `KitchenTicket` with action transitions and row lock is good | Order/ticket sync still derived/coupled; item lifecycle limited | Preserve service, make ticket authoritative for kitchen and add item/revision events | P0 |
| Print reliability | Local service, diagnostics and explicit fiscal errors ([source](https://wiki.courierexe.ru/index.php/Настройка_модуля_печати_кассовых_чеков)) | Agent polls unprinted receipts then marks printed | No durable claim/lease/attempt; ambiguous timeout/duplicate risk | `PrintJob`, `PrintAttempt`, agent lease, durable spool, reprint audit | P0 |
| Courier assignment | Explicit issuance and mobile acceptance | `servedById` is current owner; self-claim row lock | No offer/accept/release history or unique active assignment entity | `DeliveryTask` + `CourierAssignment` | P0 |
| Courier finality | Courier reports preliminary; manager accepts work ([source](https://wiki.courierexe.ru/index.php/Статусная_модель)) | Courier may move order to `COMPLETED` | Separation of duty missing | `REPORTED_*` then manager `FINAL_*` | P0 |
| Chain of custody | Scan issue/return, manifests and explicit acceptance | Assignee field and status history only | Cannot reconstruct holder transitions | Append-only custody/handoff records | P1 |
| Failed delivery | Directory reasons drive visited/retry/return behavior | Limited reason handling | Free-form/implicit behavior | Typed `DeliveryFailureReason` with required metadata/policy | P1 |
| Partial delivery | Courier quantities, manager scan confirmation, money recalc ([source](https://wiki.courierexe.ru/index.php/Выдача_корреспонденции_курьерам)) | No complete item-level delivery attempt | Refund/cash/inventory cannot reconcile safely | Attempt items + quantity conservation + manager verification | P1 |
| Cash collection | Courier hands money to manager; cash documents/acts ([source](https://wiki.courierexe.ru/index.php/Акты_передачи_денег_и_корреспонденции)) | Shift/cash transaction/transfer exist; courier collection can be created | No first-class expected-vs-actual courier debt and settlement | Cash collection ledger + settlement + mismatch task | P0 |
| Payment separation | Delivery, payment, acts and billing separate | Payment model reasonably separate but service can combine completion/cash | Operational and financial completion still coupled in paths | Explicit payment/cash policies and independent projections | P0 |
| API reliability | Changed-only status pull + explicit commit; documented limits ([source](https://wiki.courierexe.ru/index.php/API)) | REST, WebSocket invalidation, some idempotency | No generic outbox/inbox | Transactional outbox, consumer inbox, cursor/ACK contracts | P0 |
| Notification reliability | SMS/Webhook modules and configurable delivery ([source](https://wiki.courierexe.ru/index.php/Webhook)) | Notification dead letters bounded in Redis/memory | Jobs can be lost/evicted and not replayed durably | DB notification + attempts + DLQ/admin retry | P1 |
| Automation | Configured jobs/triggers/actions ([source](https://wiki.courierexe.ru/index.php/Настройка_модуля_автоматизации)) | Maintenance cron and direct side effects | No observable business rule execution | Code-defined handlers first; typed rule engine later | P1 |
| Reports/KPI | Delivery %, debt, courier cash, employee and client reports ([source](https://wiki.courierexe.ru/index.php/Отчеты)) | Operational/admin reporting exists but lifecycle timestamps incomplete | Cannot reliably calculate stage duration and failure cohorts | Event-based metrics and materialized projections | P1 |
| Tasks/tickets | Internal ticket threads and searchable support cases ([source](https://wiki.courierexe.ru/index.php/Тикеты)) | No unified operational exception inbox | Print/payment/stuck-order failures scattered | Auto-created deduped operational tasks; full support tickets later | P1 |
| Permissions | Configurable users/status permissions | DB RBAC, global guards, branch scope already strong | Critical action permissions and dual control incomplete | Stable action permissions; financial override/audit policy | P0 |
| Employee lifecycle | User directory and configurable access ([source](https://wiki.courierexe.ru/index.php/Пользователи)) | Employee block/reset/roles; delete limitations | Termination, ownership transfer and safe delete UX incomplete | Disable/terminate/archive; dependency preview; never delete audit actor | P1 |
| Multi-tenant | Client, branch, warehouse and configurable separation | Branch-aware, not complete tenant/restaurant hierarchy | Cross-customer SaaS isolation not structural | Default tenant backfill then scoped FKs/query context | P2 |
| Warehouse | Reservation, receipt/write-off/transfer/inventory ([source](https://wiki.courierexe.ru/index.php/Модуль_складского_учета)) | Inventory entities exist | Reservation/consumption/return audit may not align with order revisions | Immutable inventory events tied to ticket/revision | P1 |
| Manifest/routing | Explicit grouped handoff, planning and transit lifecycle ([source](https://wiki.courierexe.ru/index.php/Манифесты)) | Fast-food courier queue; no manifest need for local orders | Full linehaul model is excessive | Use route batch only when multi-stop dispatch demands it | P3 |
| Custom fields | User-defined metadata ([source](https://wiki.courierexe.ru/index.php/Пользовательские_поля)) | Some JSON/config flexibility | Risk of hidden invariants if generalized early | Metadata only; typed core business fields | P2 |
| Mobile/offline courier | Mobile lists, retry/troubleshooting, logs and order change notice | Courier panel exists; offline command queue not durable | Weak-network actions may duplicate or disappear | Device event IDs, local outbox, sync receipts, conflict UI | P1 |
| Security/tenant storage | Role-driven access and account separation | Auth/RBAC strong baseline | Print agent/customer/staff token boundaries need continuous tests | Distinct token audiences, scope tests, secret rotation, object ACL | P0 |

## Preserve, improve, defer

### Preserve

- Existing NestJS module structure, Prisma schema discipline and global auth/branch guards.
- Serializable POS checkout and payment idempotency operations.
- Kitchen action service with row locking.
- Lightweight WebSocket event invalidation with REST as source of truth.
- Supplemental order concept and existing shift/cash entities.

### Improve first

1. Close direct arbitrary order transitions behind command policies.
2. Add immutable event/outbox foundation.
3. Make accepted-order supplement a reliable kitchen revision flow.
4. Add durable print jobs before adding more printer features.
5. Split courier report from manager finalization and first-class cash debt.

### Defer

- Full customs/linehaul manifest, complex warehouse serials and courier-agency payroll.
- Generic interpreted automation scripts.
- Highly customizable report builder before canonical events/timestamps exist.
- Broad custom-field-driven workflows.
