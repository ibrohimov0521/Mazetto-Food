# Mazetto event catalog derived from MeaSoft workflow patterns

## Contract rules

**MEASOFT FACT:** MeaSoft changed-status API requires a consumer to fetch only changed records and commit successful receipt; courier/office actions and money acts preserve distinct operational checkpoints. Sources: [API](https://wiki.courierexe.ru/index.php/API), [Выдача корреспонденции курьерам](https://wiki.courierexe.ru/index.php/Выдача_корреспонденции_курьерам), [Акты передачи денег и корреспонденции](https://wiki.courierexe.ru/index.php/Акты_передачи_денег_и_корреспонденции).

**OUR RECOMMENDATION:** Har event envelope'i `eventId`, `eventType`, `schemaVersion`, `tenantId`, `restaurantId`, `branchId`, `aggregateType`, `aggregateId`, `aggregateVersion`, `occurredAt`, `actor`, `correlationId`, `causationId`, `idempotencyKey`, `payload`ga ega. Domain transaction va outbox insert bitta DB transactionda bajariladi. Consumer `(consumerName,eventId)` unique inbox bilan dedupe qiladi.

## Events

| Event | Producer | Primary consumers | Payload highlights | Idempotency key | Retry / audit |
| --- | --- | --- | --- | --- | --- |
| `OrderDraftCreated` | Order | Admin/POS projection | order, source, customer | command key | Audit; no external retry |
| `OrderPlaced` | Order | Payment, kitchen policy, notification | totals, items snapshot, fulfillment | `place:{order}:{version}` | Outbox until consumed; immutable |
| `OrderAccepted` | Order | Kitchen, print, customer | order, acceptedBy, revision | `accept:{order}:{version}` | P0; exactly-once effect via inbox |
| `OrderRejected` | Order | Payment void, customer | reason code, actor | `reject:{order}:{version}` | Immutable reason |
| `OrderRevisionCreated` | Order | Kitchen delta, print, courier | changed fields/items, base revision | `revision:{order}:{revision}` | Never silently coalesce |
| `SupplementalOrderCreated` | Order | Kitchen, payment, POS | parent order, delta items | command key | Parent + supplement audited |
| `OrderCancellationRequested` | Order | Policy/manager | requester, reason | command key | Retry command validation |
| `OrderCancelled` | Order | Kitchen, delivery, payment, notify | reason, affected lifecycles | `cancel:{order}:{version}` | Compensating consumers |
| `OrderCompleted` | Order | Reports, loyalty | final domain states | `complete:{order}:{version}` | Final immutable event |
| `PaymentAuthorizationRequested` | Payment | Provider adapter | amount, method, attempt | payment operation key | Provider-safe retry |
| `PaymentAuthorized` | Payment | Order/POS | provider reference, amount | provider operation id | Immutable financial audit |
| `PaymentCaptured` | Payment | Receipt, order, ledger | captured amount, transaction | provider operation id | No duplicate ledger posting |
| `PaymentFailed` | Payment | POS/customer/task | stable reason, retryable | attempt id | Retry only when classified |
| `RefundRequested` | Payment | Provider/approval | amount, items, reason | command key | Permission + approval audit |
| `RefundCompleted` | Payment | Ledger, customer, inventory | provider ref, amount | provider operation id | Immutable |
| `CashCollected` | Settlement | Cash ledger, courier UI | order, courier, expected amount | `cash:{order}:{attempt}` | Never delete |
| `CashSubmissionRequested` | Settlement | Courier/manager notification | holder, amount, dueAt | request id | Escalating reminders |
| `CashSubmitted` | Settlement | Cashier/accountant | expected, declared, shift | submission id | Physical handoff evidence |
| `CashReconciled` | Settlement | Ledger, shift closing, reports | actual, verifier, receipt | reconciliation id | Never delete |
| `CashMismatchDetected` | Settlement | Task, manager, audit | expected/actual/delta | reconciliation id | Manual resolution required |
| `KitchenTicketCreated` | Kitchen | Kitchen UI, print | order revision, item snapshots | `ticket:{order}:{revision}` | Unique DB constraint |
| `KitchenTicketAccepted` | Kitchen | Metrics, POS | ticket, station, actor | command key | Immutable transition |
| `PreparationStarted` | Kitchen | Timer, customer projection | ticket, startedAt | command key | Duplicate action no-op |
| `KitchenItemStateChanged` | Kitchen | Ticket aggregate | item, qty, state | command key | Validate quantity/version |
| `OrderReady` | Kitchen | Dispatcher/cashier/customer | ticket, readyAt | `ready:{ticket}:{version}` | Notify with inbox dedupe |
| `OrderPacked` | Kitchen | Handoff | package/evidence | command key | Optional by branch config |
| `OrderHandedOff` | Kitchen/Delivery | Delivery, chain of custody | from/to, ticket, time | handoff id | Two-party custody audit |
| `PrintRequested` | Print | Print dispatcher | template, payload hash, route | `print:{ticket}:{purpose}:{revision}` | Unique logical print |
| `PrintClaimed` | Print | Agent monitor | agent, lease token/expiry | claim id | Lease is replaceable audit |
| `PrintSucceeded` | Print agent API | Kitchen/POS/metrics | printer, attempt, evidence | agent attempt id | ACK replay returns same result |
| `PrintFailed` | Print agent API | Retry/task/metrics | classified error, attempt | agent attempt id | Backoff or dead letter |
| `PrintDeadLettered` | Print | Task/manager | attempts, last error | job id | Operator resolution |
| `PrintReprintRequested` | Print | Agent/audit | original job, actor, reason | command key | Child job; COPY marker |
| `CourierShiftOpened` | Delivery | Assignment, settlement | courier, branch, opening cash | command key | One active shift constraint |
| `CourierAssigned` | Delivery | Courier app, dispatcher | task, courier, assignment | assignment id | Active assignment unique |
| `CourierAssignmentAccepted` | Delivery | Dispatcher/metrics | assignment, acceptedAt | command key | Version checked |
| `CourierHandoffOffered` | Delivery | Target courier | from/to, task, reason | handoff id | Retry notification |
| `CourierHandoffAccepted` | Delivery | Both couriers, audit | handoff, custody time | command key | Atomic assignment swap |
| `CourierDeparted` | Delivery | Tracking/customer | task, location/time | device event id | Offline replay safe |
| `CourierArrived` | Delivery | Wait timer/customer | location/time | device event id | Geo policy validated |
| `DeliveryReported` | Delivery | Manager, customer projection | result, evidence, attempt | device event id | Preliminary, immutable |
| `DeliveryFailed` | Delivery | Dispatcher/task/customer | reason code, metadata | device event id | Reason drives next actions |
| `DeliveryRescheduled` | Delivery | Assignment/customer | old/new slot, reason | command key | Capacity revalidated |
| `DeliveryReturnStarted` | Delivery | Warehouse/manager | custody, returned items | command key | Chain of custody |
| `DeliveryFinalized` | Delivery | Order, payment, reports | final result, verifier | command key | Manager-only; immutable |
| `CourierCashDueChanged` | Settlement | Admin/courier dashboards | courier, expected balance | ledger entry id | Projection rebuildable |
| `CourierShiftCloseRequested` | Delivery | Settlement policy | shift, unresolved counts | command key | May be rejected visibly |
| `CourierShiftClosed` | Delivery | Reports | totals, verifier | command key | Only after policy passes |
| `NotificationRequested` | Notification | Channel worker | template, recipient, locale | business notification key | Unique per purpose/version |
| `NotificationDelivered` | Channel adapter | Audit/metrics | provider id, channel | provider callback id | Final delivery receipt |
| `NotificationFailed` | Channel adapter | Retry/task | stable error/retryable | attempt id | Backoff/dead letter |
| `InventoryReserved` | Inventory | Kitchen/order | ingredients, quantities | `reserve:{order}:{revision}` | Serializable/atomic |
| `InventoryConsumed` | Inventory | Cost/reporting | ticket/items/batches | kitchen completion key | Immutable stock event |
| `InventoryReleased` | Inventory | Stock projection | reservation, reason | release command key | Idempotent compensation |
| `OperationalTaskCreated` | Task | Admin/role inbox | type, severity, SLA, link | incident fingerprint | De-duplicate open incidents |
| `OperationalTaskResolved` | Task | Audit/metrics | resolver, resolution | command key | Cannot erase source failure |

## Immutable `order_events`

```text
id, tenant_id, restaurant_id, branch_id,
order_id, aggregate_type, aggregate_id, aggregate_version,
event_type, schema_version, actor_type, actor_id, source,
before_state, after_state, payload, reason_code,
idempotency_key, correlation_id, causation_id, created_at
```

Indexes/constraints:

- unique `(tenant_id, id)` and `(tenant_id, aggregate_type, aggregate_id, aggregate_version)`;
- unique non-null `(tenant_id, idempotency_key, event_type)`;
- index `(tenant_id, order_id, created_at, id)`;
- index `(tenant_id, event_type, created_at)`;
- FK scopes must not permit cross-tenant references.

Never delete: placement/acceptance/cancellation, all payment/refund/cash events, custody/handoff/delivery reports and finalization, print attempts/reprints, permission/override actions, inventory financial movements. PII retention can redact encrypted payload fields under policy while preserving event identity, actor, reason and monetary totals.

## Delivery semantics

Events are facts in past tense, not commands. A failed consumer does not undo the fact; it retries its own effect. Cross-domain compensation emits a new fact (`PaymentVoided`, `InventoryReleased`) instead of mutating history. WebSocket is a projection invalidation/notification channel, not durable delivery.
