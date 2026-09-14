# Target domain model

## Design position

**MEASOFT FACT:** CourierExe separates shipment, courier issue/acceptance, mobile report, final delivery information, money acts, warehouse movements and manifests. Source synthesis: [Статусная модель](https://wiki.courierexe.ru/index.php/Статусная_модель), [Выдача корреспонденции курьерам](https://wiki.courierexe.ru/index.php/Выдача_корреспонденции_курьерам), [Акты передачи денег и корреспонденции](https://wiki.courierexe.ru/index.php/Акты_передачи_денег_и_корреспонденции), [Модуль складского учета](https://wiki.courierexe.ru/index.php/Модуль_складского_учета).

**OUR RECOMMENDATION:** Mavjud Mazetto schema rewrite qilinmaydi. Quyidagi entitylar xavf va qiymat tartibida incremental qo'shiladi; mavjud `Order`, `OrderItem`, `KitchenTicket`, `Payment`, `Shift`, `CashTransaction`, `Receipt`, `User/Role/Permission`, `Branch` imkon qadar evolyutsiya qilinadi.

## Organization and access

| Entity | Purpose and important fields | Relationships / constraints / indexes |
| --- | --- | --- |
| `Platform` | Global service identity and feature catalog | Logical root; tenant data bilan FK shart emas |
| `Tenant` | SaaS customer; `id`, `slug`, `name`, `status`, locale/timezone | unique `slug`; all business rows tenant-scoped |
| `Restaurant` | Brand/legal operating unit; tax/payment settings | belongs tenant; unique `(tenantId, code)` |
| `Branch` | Physical operation and routing boundary; timezone, address, status | belongs restaurant/tenant; existing modelga tenant FK qo'shiladi |
| `User` | Login identity; email/phone, auth status, credential version | global identity bo'lishi mumkin, membership orqali scope |
| `Membership` | User-to-tenant employment/access | unique `(tenantId,userId)`; disabled/terminated lifecycle |
| `Role` | Named permission bundle, system/custom flag | tenant/system scope; role delete only when unassigned |
| `Permission` | Stable action code (`delivery.finalize`) | immutable code; role mappings |
| `RoleAssignment` | Membership role plus restaurant/branch scope | no cross-tenant references; scope index |
| `Employee` | Operational profile, role-independent staff data | tenant membership; branch assignments/history |

## Customer and order

| Entity | Purpose and important fields | Relationships / constraints / indexes |
| --- | --- | --- |
| `Customer` | Tenant customer profile; contact and consent refs | tenant-scoped normalized phone index |
| `Address` | Structured address, geo, instructions, validation state | customer or order snapshot; geo index later |
| `Order` | Commercial aggregate; number, source, branch, customer, totals, `OrderState`, version | unique `(tenantId,orderNumber)`; index branch/state/createdAt |
| `OrderRevision` | Immutable accepted snapshot version and change reason | unique `(orderId,revision)`; parent revision |
| `OrderItem` | Product snapshot, quantity, unit/tax/discount totals | belongs revision/order; no mutable catalog dependence |
| `OrderItemModifier` | Modifier snapshot and price | belongs item; deterministic total |
| `OrderEvent` | Immutable action/state/audit fact | unique aggregate version and idempotency keys |
| `OrderStatusHistory` | Existing compatibility projection | derived/backfilled from events; eventually read-only |
| `Attachment` | Evidence/document metadata, object key, checksum, retention class | tenant-scoped; signed access; malware state |

Order constraints: monetary amounts integer minor units or exact decimal; totals server-calculated; accepted revision immutable; transitions use optimistic version; cancellation never deletes financial/custody history.

## Kitchen and print

| Entity | Purpose and important fields | Relationships / constraints / indexes |
| --- | --- | --- |
| `KitchenTicket` | One kitchen fulfillment unit per order revision/station; state/version/timers | unique `(orderId,revision,stationKey)` |
| `KitchenTicketItem` | Snapshot item/quantity/state/fire course | quantities bounded by order revision |
| `KitchenTicketEvent` | Item/ticket action audit and timing | append-only; branch/time index |
| `Printer` | Branch printer target, protocol, purpose, active/config version | unique `(branchId,code)` |
| `PrintAgent` | Outbound local agent identity, lastSeen, version, capabilities | scoped API credential; no user JWT |
| `PrintJob` | Durable logical print; purpose, payload snapshot/hash, state, route/version | unique `(tenantId,idempotencyKey)`; state/nextAttempt index |
| `PrintAttempt` | Every lease/attempt result, error class and evidence | unique `(jobId,agentAttemptId)`; append-only |

Accepted orderdan keyingi item addition mavjud ticketni jim o'zgartirmaydi: `OrderRevision` yoki `SupplementalOrder` -> delta `KitchenTicket` -> distinct `PrintJob`. UI original va supplementni bog'liq ko'rsatadi.

## Courier and delivery

| Entity | Purpose and important fields | Relationships / constraints / indexes |
| --- | --- | --- |
| `Courier` | Employee delivery capability and current availability | employee one-to-one per tenant; status projection |
| `CourierShift` | Branch/time work session, opening/closing and settlement gate | partial unique active shift per courier |
| `DeliveryTask` | Delivery lifecycle independent of order/payment | order/fulfillment, address snapshot, slot, state/version |
| `CourierAssignment` | Offered/accepted/released assignment history | only one active accepted assignment per task |
| `CourierHandoff` | Explicit A-to-B custody transfer | from/to, reason, offer/accept/expire; A != B |
| `DeliveryAttempt` | One visit/report; outcome, time, geo, evidence, reason | unique device event/idempotency; sequence per task |
| `DeliveryAttemptItem` | Accepted/returned/damaged item quantities | quantity conservation check |
| `DeliveryFailureReason` | Typed reason behavior and required metadata | unique tenant code; deactivate, do not delete if used |
| `CustodyEvent` | Physical holder transitions for order/package/cash | append-only; holder/time indexes |

`Order.servedById` migration: old value initial accepted `CourierAssignment` sifatida backfill qilinadi; dual-read periodda new task primary, old field compatibility projection bo'ladi.

## Payment and cash

| Entity | Purpose and important fields | Relationships / constraints / indexes |
| --- | --- | --- |
| `Payment` | Order payment intent/current summary; method/state/amount | order may have multiple payments; no delivery status coupling |
| `PaymentTransaction` | Provider/ledger operation: auth/capture/void/refund | unique provider operation/idempotency; append-only |
| `Refund` | Business approval and item/amount reason | sum refunds <= captured; transaction references |
| `CashCollection` | Cash physically collected and current holder | order/attempt/courier shift; expected/submitted/verified |
| `CashLedgerEntry` | Immutable debit/credit transfer between holders/accounts | balanced transaction group; no update/delete |
| `CourierSettlement` | Aggregates collections submitted in one handoff | unique receipt number; verifier and mismatch state |
| `SettlementItem` | Collection included/excluded and amount | collection cannot be closed twice |

Admin “pulni topshirtirish” actioni `CashSubmissionRequested` va due time yaratadi; unresolved debt courier shift close/new assignment policyga ta'sir qiladi. Forced financial correction only compensating ledger entry + permission + reason + second approval threshold bilan.

## Reliability and operations

| Entity | Purpose and important fields | Relationships / constraints / indexes |
| --- | --- | --- |
| `OutboxEvent` | Durable event pending publish | unique event/idempotency; status/availableAt index |
| `InboxEvent` | Consumer dedupe and processing outcome | unique `(consumer,eventId)` |
| `Notification` | Business intent/template/recipient | unique purpose/entity/version |
| `NotificationAttempt` | Provider/channel attempts and receipts | append-only, nextRetry index |
| `AutomationRule` | Versioned typed trigger/condition/action | tenant/branch scope; allowlisted actions only |
| `AutomationExecution` | Event-rule execution, attempts and outputs | unique `(ruleVersion,eventId)` |
| `Task` | Internal actionable exception with assignee/SLA/status | fingerprint de-dupes open system tasks |
| `Ticket` | Longer support conversation/case | links tasks/orders/customers; audit participants |
| `AuditEvent` | Security/admin read or mutation not owned by order event | append-only tenant/actor/action/resource index |

## Tenant isolation invariants

1. Every tenant-owned table has non-null `tenantId`; denormalized `restaurantId/branchId` where query and policy need it.
2. Composite foreign keys or service checks ensure child and parent tenant match.
3. Repository/service queries require `TenantContext`; unscoped find helpers are banned outside platform admin modules.
4. Unique constraints include tenant unless identity is deliberately global.
5. Object storage keys start `tenant/{tenantId}/...`; signed URL authorization checks linked row scope.
6. Redis keys, WebSocket rooms, queue names and metrics labels include tenant/branch scope without leaking PII.
7. Background jobs carry scope and re-authorize target rows; caller-provided tenant IDs are never trusted alone.

## Incremental migration order

1. Add event/outbox/inbox and typed action facade around current transitions.
2. Add `PrintJob/Attempt`, preserving existing receipt polling as compatibility producer.
3. Add `DeliveryTask/Assignment/Attempt/Reason`, backfill from orders.
4. Add `CashCollection/Settlement` beside existing shift/cash transaction model.
5. Introduce `Tenant/Restaurant` only after scope inventory and backfill rehearsal; keep current single-tenant behavior through one default tenant.
6. Retire overloaded fields only after dual-write, reconciliation query and rollback window pass.
