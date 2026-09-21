# MAZETTO FOOD remediation plan

This is the ordered backlog produced by the 2026-09-21 product audit. Complete
one gate at a time. `P0` blocks safe release, `P1` blocks a core workflow, `P2`
is important completeness/security, and `P3` is improvement or cleanup.

## Execution order

### Gate A - data and release safety

| ID | Priority | Confirmed gap | Required result and acceptance test |
| --- | --- | --- | --- |
| AUD-101 | P0 | Production DB migration history is not reconciled with the restored schema; generic migration caused an outage | Create verified backup; restore into isolated DB; baseline `_prisma_migrations`; run all migrations twice; deploy and rollback rehearsal; document checksums |
| AUD-102 | P1 | No single release acceptance suite covers customer, staff, Desktop, Telegram and printing | Add read-only smoke plus disposable isolated write E2E; production human checklist records actor/time/result without fake live orders |
| AUD-103 | P2 | Historical status document mixes deployed, local-only and obsolete claims | Keep this audit directory current and archive/supersede stale status sections |

### Gate B - receipts and printing

| ID | Priority | Confirmed gap | Required result and acceptance test |
| --- | --- | --- | --- |
| AUD-110 | P1 | `Receipt` is unique by `orderId`, but cancellation code tries to create a second document | Model append-only sale/cancellation/refund documents; migrate data; test paid order then cancellation and repeated cancellation idempotency |
| AUD-111 | P1 | Desktop claims a job before confirming a usable printer; untargeted jobs can be exhausted with no printer | Claim only declared ready printer IDs/routes; leave unprintable jobs pending with `WAITING_FOR_PRINTER`; test no-printer state causes zero attempts |
| AUD-112 | P1 | Printer page exists but is absent from sidebar | Add Printers after Receipts with `RECEIPT_PRINT`; route/nav/access validator must fail on future drift |
| AUD-113 | P1 | Printer records cannot be deleted and deactivation workflow is incomplete | Add audited deactivate/delete with reference safety; expose in Admin; test active jobs cannot lose target silently |
| AUD-114 | P1 | Desktop UI supports one fallback host/port while product requires multiple printers | Add discovery/manual multiple printers, roles, readiness, per-printer test and branch assignment |
| AUD-115 | P1 | Receipt queue shows server errors without an operator-safe recovery explanation | Normalize error responses, job state labels, retry/reassign controls and dead-letter reason; test stale lease recovery |
| AUD-116 | P2 | Standalone print-agent and Desktop overlap; print-agent defaults to dry run | Make Desktop canonical and deprecate/remove agent, or define exclusive deployment ownership and health |
| AUD-117 | P1 | No physical printer acceptance has been performed | Test 58/80mm ESC/POS, Uzbek text, long items, cut, duplicate prevention, offline recovery, cancellation and reprint |
| AUD-118 | P1 | Receipt detail/reprint builds ESC/POS from current order items/payments instead of the immutable `Receipt.content` snapshot | Version the document payload and render only from it; edit an order after issue and prove reprint remains byte-equivalent |
| AUD-119 | P2 | Completing one of several printer jobs marks the whole receipt `printed=true` | Derive document print state from required route/job outcomes or store per-route status; test one success plus one failure |

### Gate C - Desktop identity and offline completeness

| ID | Priority | Confirmed gap | Required result and acceptance test |
| --- | --- | --- | --- |
| AUD-120 | P1 | Kitchen actions are PATCH in backend but Desktop registry allows POST only | Generate/validate registry from route contract; offline accept/start/ready/complete/cancel each replay once |
| AUD-121 | P1 | Item cancel and cash transfer accept/reject paths do not match Desktop registry | Add exact typed commands and tests for nested action routes |
| AUD-122 | P1 | Device guard validates only when client supplies `x-mazetto-device-id` | Enrollment issues a revocable device credential bound to device and branch; protected Desktop endpoints require it |
| AUD-123 | P2 | Remembered Desktop login uses bundled browser storage, not OS credential protection | Store refresh secret with Windows secure credential mechanism; migrate/logout safely |
| AUD-124 | P2 | No complete support bundle for branch troubleshooting | Export redacted version/device/connectivity/outbox/conflict/print diagnostics without tokens/customer secrets |
| AUD-125 | P2 | Offline coverage is manually maintained and can drift again | Contract test every mutating staff route, explicitly classify online-only vs queueable, and fail CI on mismatch |

### Gate D - money, inventory and business correctness

| ID | Priority | Confirmed gap | Required result and acceptance test |
| --- | --- | --- | --- |
| AUD-130 | P1 | Click/Payme/Card providers, callbacks and reconciliation are absent | Implement provider-signed initiation/callback/idempotency, payment state, reconciliation and failure UX before enabling method |
| AUD-131 | P1 | Refund/void is not implemented although schema/report concepts exist | Add permissioned refund workflow, provider/cash ledger entry, receipt document, audit and report treatment |
| AUD-132 | P2 | Ingredient and warehouse master data lacks edit/deactivate lifecycle | Add branch-safe update/archive with reference protection and history |
| AUD-133 | P2 | Automatic recipe deduction fails if no active warehouse exists | Add readiness check/dashboard and prevent enabling recipe deduction until warehouse mapping is valid |
| AUD-134 | P2 | Modifier lifecycle has create/update but no explicit archive/delete action | Define archive policy, expose action and preserve historical orders |
| AUD-135 | P2 | Some human-readable ticket/order/receipt identifiers use bounded random allocation | Add database-backed sequence or robust retry for every unique identifier; concurrency test collisions |

### Gate E - navigation, permissions and security

| ID | Priority | Confirmed gap | Required result and acceptance test |
| --- | --- | --- | --- |
| AUD-140 | P1 | Admin route metadata contains roles, but filtering/enforcement semantics differ by route group | Define permission-first contract, remove misleading metadata or enforce it consistently; test every seeded role against every page |
| AUD-141 | P2 | Customer and staff refresh tokens are in localStorage | Move browser refresh sessions to Secure HttpOnly SameSite cookies with rotation/revocation and CSRF design |
| AUD-142 | P2 | Homepage image upload requires `MENU_EDIT`, blocking a homepage-only custom role | Add purpose-aware upload permission and strict folder mapping; test homepage manager without menu edit |
| AUD-143 | P2 | Navigation validation checks listed links but not reachable pages omitted accidentally | Maintain route manifest with `sidebar`, `child`, `workspace` or `hidden` intent; CI verifies all pages |
| AUD-144 | P3 | Kitchen seeded role includes shift/cash permissions that may violate responsibility separation | Confirm business policy; remove permissions unless kitchen staff owns cash operations |

### Gate F - realtime, Telegram and operations

| ID | Priority | Confirmed gap | Required result and acceptance test |
| --- | --- | --- | --- |
| AUD-150 | P2 | Customer order hook refreshes broadly on realtime events and also polls every 15 seconds | Scope events to customer/order, back off polling while socket healthy, load-test fan-out |
| AUD-151 | P2 | Telegram code is split between monitoring agent and backend business handler with implicit ownership | Document backend as update handler and agent as webhook controller/health monitor; enforce one webhook owner |
| AUD-152 | P2 | Telegram staff group flow lacks current human acceptance evidence | Test one legitimate lifecycle with group buttons, customer updates, retry and no duplicate messages |
| AUD-153 | P2 | Health/audit/dead letters exist without centralized alert ownership | Define SLOs and alerts for API/DB, Telegram errors, print dead letters, offline device and queue age |
| AUD-154 | P2 | External geocoding and object storage dependency failures are not represented in one readiness view | Add dependency probes with safe timeout and degraded status, without leaking credentials |
| AUD-155 | P3 | CORS is code-correct but runtime origin configuration can drift | Expose redacted configured-origin check in deployment validation and test HTTP plus Socket.IO |

### Gate G - product completeness and QA

| ID | Priority | Confirmed gap | Required result and acceptance test |
| --- | --- | --- | --- |
| AUD-160 | P2 | No automated authenticated browser matrix across roles and responsive sizes | Add Playwright journeys for customer, admin, manager, accountant, cashier, waiter, kitchen and courier |
| AUD-161 | P2 | Current tests do not include a full isolated order-to-cash-to-print journey | Seed disposable branch/device/printer, execute lifecycle, assert ledger/stock/receipt/jobs/audit, then destroy isolated DB |
| AUD-162 | P3 | Customer web is not installable/offline | Decided online-only: browsing may use its short in-memory cache, but checkout blocks offline submission with a visible reason and never queues an order locally |
| AUD-163 | P3 | Courier flow has status/assignment but no routing optimization/proof-of-delivery | Add only after core accounting/printing gates; define photo/signature/privacy retention first |

## Definition of done for every item

1. Business behavior and permissions are written before implementation.
2. API, UI, Desktop/offline and audit effects are covered together where relevant.
3. Automated tests reproduce the defect before the fix and prevent regression.
4. Typecheck, lint, tests, build and repository validators pass.
5. Database changes are rehearsed against a restored backup.
6. Deployment health passes and the exact human smoke result is recorded.
7. Documentation and operator recovery steps are updated in the same change.

## Recommended first implementation batch

Start with `AUD-101`, then `AUD-110` through `AUD-115`, then `AUD-120` through
`AUD-122`. This order protects data first, makes receipts/printing truthful, and
only then expands offline operation. Payment providers and wider feature work
must wait until those foundations pass their acceptance tests.
