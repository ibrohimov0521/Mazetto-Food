# MAZETTO FOOD function catalog

Snapshot: 2026-09-21. Status values: `Verified`, `Partial`, `Missing`, and
`Needs live proof`.

## 1. Customer web

Production entry: `https://mazettofood.uz` and `https://www.mazettofood.uz`.

| Function | Expected behavior | Current state |
| --- | --- | --- |
| Home page | Show active hero slides, promotions, categories, popular products, and branch availability | Verified in code; content is managed from Admin > Home page and promotions |
| Menu | Browse by category, search products, and respect active/available items | Verified in code |
| Product detail | Select variant and modifiers, see calculated price, add to favorites/cart | Verified in code |
| Favorites | Persist favorites on the current browser | Verified; browser-local storage |
| Cart | Add, remove, change quantity, retain a cart per browser | Verified; cart is browser-local until order creation |
| Fulfillment | Choose delivery or pickup, branch, and delivery location | Verified in code; quote is recalculated by backend |
| Location | GPS/manual map pin, reverse geocoding, saved/guest addresses | Verified in code; provider availability still needs live human smoke |
| Address validation | Keep the main action visible and explain missing address fields near it | Implemented in current UI; mobile human regression test remains required |
| Quote | Validate branch, distance/zone, subtotal, delivery fee, and accepted payment methods | Verified; backend is source of truth |
| Customer login | Request and verify phone OTP; refresh/logout session | Verified in code; rotating refresh secret uses Secure HttpOnly SameSite cookie and legacy browser storage is migrated |
| Checkout | Create one idempotent order and recover from retry | Verified in code; only CASH is operational |
| Order success | Show created order and next action | Verified in code |
| Order history/detail | List orders, show status/items/address/payment, cancel when allowed, reorder | Verified in code |
| Live order updates | Receive realtime events and refresh order state | Verified; scoped authenticated realtime uses slow fallback polling while healthy |
| Profile | View customer identity and manage addresses | Verified in code |
| Online payment | Click/Payme/Card authorization, callback, refund, reconciliation | Missing; UI types exist but backend exposes CASH only |
| Installable/offline web | Explicit online-only customer ordering | Decided: checkout visibly blocks offline submission and never queues customer orders locally; Desktop remains the supported offline operations client |

## 2. Telegram customer bot and staff group

| Function | Expected behavior | Current state |
| --- | --- | --- |
| Webhook ownership | Telegram sends updates to one secret backend webhook | Verified in code; separate `telegram-bot` service manages/monitors the webhook |
| Customer identity | Link Telegram chat to customer and collect phone confirmation | Verified in backend code |
| Catalog browsing | Categories, products, variants, modifiers, pagination | Verified in backend code; human visual smoke pending |
| Telegram cart | Add/edit/remove items and show totals | Verified in backend code; human end-to-end smoke pending |
| Telegram checkout | Select fulfillment/address/branch and create idempotent CASH order | Verified in backend code; live order creation was intentionally not performed by audit |
| Customer notifications | Send order lifecycle messages back to customer | Verified in code; runtime delivery needs legitimate order smoke |
| Staff group notifications | Publish new order and lifecycle controls to configured staff chat | Partial; depends on `TELEGRAM_STAFF_CHAT_ID` and bot token, and needs a human group smoke |
| Retry/dead letters | Retain failed notification messages and allow an authorized retry | Verified in backend/Admin API; operational alerting is incomplete |
| Agent status | Report backend reachability, webhook URL, pending updates, Telegram errors | Verified in `telegram-bot`; not publicly probed during this audit |

## 3. Staff workspaces

| Workspace/function | Expected behavior | Current state |
| --- | --- | --- |
| Login/workspace selector | Authenticate by email/phone, keep session, route by role | Verified; browser refresh uses HttpOnly cookie and Desktop uses Windows-protected storage |
| POS terminal | Open shift, browse catalog, build order, select table/type, take payment, generate receipt | Verified for CASH paths including permissioned full CASH refund; provider payments/refunds remain disabled |
| Waiter | View halls/tables, create/edit orders, send to kitchen | Verified in code |
| Kitchen display | View queue/history, accept/start/ready/complete/cancel with elapsed-time UI | Verified online and covered by typed Desktop offline PATCH commands |
| Courier | Open courier shift, view assigned deliveries, change delivery state, hand over cash | Verified online; real route/navigation optimization is not present |
| Cash shift | Open/close shift, view orders/transactions, cash in/out, transfer and accept/reject | Verified online; nested transfer actions are covered by typed offline commands |
| Receipt view | Display printable receipt and mark/reprint it | Verified in code and virtual-printer tests; physical 58/80 mm proof remains a release gate |
| Manager dashboard | Branch operational summary and shortcuts | Verified in code |
| Accountant workspace | Financial shortcuts for payments, receipts, expenses, reports | Verified in code; role/navigation contract should be simplified |

## 4. Admin panel navigation and modules

| Sidebar group | Module | Route | Main functions | State |
| --- | --- | --- | --- | --- |
| Home | Dashboard | `/admin/dashboard` | Period/branch KPIs, revenue, orders, average check, open orders, top products, payment split, catalog counts | Verified; KPI cards link to filtered data |
| Operations | Orders | `/admin/orders` | Search/filter, retained URL state, detail, timeline, allowed actions, bulk status | Verified in code |
| Operations | Online orders | `/admin/online-orders` | Review web/Telegram orders, assign courier, update lifecycle | Verified in code |
| Operations | Kitchen monitor | `/admin/kitchen-monitor` | Read kitchen queue and status | Verified in code |
| Operations | Couriers | `/admin/couriers` | Courier list, assignment and delivery history/status | Verified in code |
| Operations | Customers | `/admin/customers` | Customer list and statistics | Verified in code |
| Cash/report | Shifts | `/admin/shifts` | Branch shifts, detail, forced handover, totals | Verified in code |
| Cash/report | Payments | `/admin/payments` | Payment list/detail and permissioned full CASH refund with reason/open shift | Verified for CASH; provider reconciliation and partial-item returns remain disabled |
| Cash/report | Receipts | `/admin/receipts` | Receipt list/detail, aggregate print status, durable queue, retry/reprint | Verified in code for sale/cancellation/refund documents; physical printer proof pending |
| Cash/report | Expenses | `/admin/expenses` | Branch-scoped category create/edit/archive, list and create immutable expense | Verified in code; archived categories preserve historical expense snapshots |
| Cash/report | Reports | `/admin/reports` | Sales, product, employee, expense and Z reports | Verified for recorded data; CASH refunds are reconciled, provider refunds and COGS retain explicit limitations |
| Cash/report | Printers | `/admin/printers` | Create/configure/deactivate branch printers, roles and diagnostics | Verified in code; physical devices remain unavailable for acceptance |
| Menu/marketing | Products | `/admin/products` | List, create, edit, variants, availability, image upload | Verified after media configuration fix |
| Menu/marketing | Categories | `/admin/categories` | Create, edit, order and delete categories | Verified in code |
| Menu/marketing | Modifiers | `/admin/modifiers` | Create/edit and reversible archive lifecycle | Verified in code |
| Menu/marketing | Home/promotions | `/admin/homepage` | Hero slide and promotion CRUD with images/order/active state | Verified; upload authorization is purpose-aware |
| Inventory | Stock | `/admin/inventory` | Stock, movement, cost, ingredient/warehouse edit and archive | Verified with reference and stock protection |
| Inventory | Recipes | `/admin/recipes` | View and upsert variant ingredient recipes | Verified; branch readiness exposes missing active warehouse configuration |
| Inventory | Suppliers | `/admin/suppliers` | Supplier CRUD | Verified in code |
| Branches | Branches | `/admin/branches` | Branch CRUD-like editing, hours, product availability, halls/tables/devices | Verified in code |
| Branches | Devices | `/admin/devices` | Create, edit, disable/delete, issue one-time enrollment code, inspect heartbeat/version | Verified; operational Desktop routes require a revocable hardware-bound credential |
| Team | Staff | `/admin/staff` | Create/edit, branch/role, status, terminate/rehire/delete, password reset | Verified in code |
| System | Roles/permissions | `/admin/roles` | Read matrix; super admin manages custom roles | Verified with permission-first route contract and explicit route intent validator |
| System | Business settings | `/admin/settings` | Public/business settings with validation | Verified in code |
| System | Audit journal | `/admin/audit` | Filter audit records/facets | Verified in code |
| System | Health | `/admin/system-health` | Operational metrics | Verified in code |

### Navigation placement findings

- Printers is exposed in `Kassa va hisobot` with permission-gated navigation.
- Devices correctly have a global page under Branches and a branch-specific page
  under a branch detail. Both should use the same edit/delete/code component.
- Halls and tables are branch configuration and are intentionally reached from a
  branch, while `/admin/tables` is an operational aggregate page.
- Product create/detail and order detail routes are child pages, so they should
  not have independent sidebar entries.
- Manager and Accountant landing pages are role-specific; permission-first route
  access and explicit page intent are enforced by repository validators.

## 5. Backend and data platform

| Domain | Implemented functions | State |
| --- | --- | --- |
| Authentication | Staff login/refresh/logout/me, password hashing, throttling, active-user recheck | Verified |
| Authorization | Roles, 60+ permissions, branch scope, permission guards, audit | Verified with contract drift risk in frontend |
| Branches | List/detail/create/update, hours, availability | Verified |
| Devices | CRUD, enrollment code, credential enrollment, heartbeat/version | Verified for official Desktop operational boundary |
| Orders | Create/list/detail, timeline/actions, item changes, status transitions, idempotency | Verified online; identifier collision coverage incomplete for some generated IDs |
| Kitchen | Ticket queue/history and lifecycle | Verified online |
| Payments | Record/process tenders, idempotent operations and full CASH refund reversal | Verified for CASH; external signed providers remain disabled |
| Receipts | Immutable sale/cancellation/refund documents, ESC/POS, reprint and durable per-printer jobs | Verified in code and virtual printer tests |
| Inventory | Stock, cost, movements, recipes, auto deduction and protected master-data lifecycle | Verified in isolated E2E and code tests |
| Realtime | Authenticated Socket.IO plus event replay endpoint | Verified with scoped customer refresh and fallback polling |
| Media | Purpose-authorized validated image upload to MinIO | Verified in code and dependency health probe |
| Geocoding | Search and reverse lookup | Verified in code; timeout-bounded dependency readiness is included in protected system health |
| Reports | Sales/products/employees/expenses/Z | Verified within stated accounting limitations |
| Notifications | Durable delivery and dead-letter retry | Verified in code; alerting/dashboard ownership incomplete |
| Health | API/database, external dependencies, dead print jobs, stale devices and CORS fingerprint | Verified in code; alert routing requires production evidence |

## 6. Desktop application

| Function | Expected behavior | Current state |
| --- | --- | --- |
| Bundled UI | Run POS/Admin/Kitchen/Courier UI locally | Verified in packaged design |
| Device identity | Stable hardware ID, one-time enrollment, revocable credential, heartbeat/version | Verified in code and tests |
| Remember login | Persist staff refresh session on the device | Verified with Electron `safeStorage` / Windows DPAPI |
| Local database | SQLite cache, settings, outbox, conflicts, print state | Verified in code |
| Offline reads | Serve cached GET responses while backend is unavailable | Verified in code |
| Offline writes | Typed command registry, idempotent outbox replay, conflict/dead-letter recovery | Verified by backend mutation contract and Desktop tests |
| Connectivity UI | Show online/offline, pending/conflict status and controls | Verified in code |
| Auto update | Check, download, install, periodic/manual controls | Verified; release `desktop-v0.1.28` is published |
| Printer setup | Discover/configure/test multiple managed printers and fallback | Verified in code and virtual TCP tests |
| Automatic printing | Claim only ready-printer jobs, build snapshot ESC/POS, send TCP 9100, complete/fail with lease | Verified in code and virtual printer tests |
| Multi-printer routing | Multiple printers and receipt/cancellation/refund/kitchen roles | Verified in code; physical routing proof pending |
| Diagnostics/recovery | Local status, outbox recovery, database recovery and redacted support bundle | Verified in code |

## 7. Deployment and operations

| Function | Current state |
| --- | --- |
| CI | Typecheck, lint, test, build, validators; latest main run passed |
| Deploy | Change detection, service deployment, health smoke; latest main deploy passed |
| Desktop release | Signed-by-workflow installer artifacts and generic updater metadata; v0.1.28 live |
| Database backup | Script exists, but production restore/migration baseline is not fully reconciled |
| Database migrations | Prisma migrations exist; restored production DB previously failed `migrate deploy`, targeted bootstrap is a workaround |
| Observability | Health endpoints, system metrics, audit and dead letters exist; centralized alerts/SLOs are missing |
| Secrets | Environment-driven; rotation/runbook evidence not included in repo audit |

## 8. Expected but not yet complete

1. External payment provider authorization, webhook verification, refunds and reconciliation.
2. Provider and partial-item refund/fiscal allocation policy beyond full CASH reversal.
3. Courier proof-of-delivery policy, including photo/signature consent and retention.
4. Production migration baseline plus tested backup restore drill.
5. Central operational alert routing evidence for backend, database, Telegram, print dead letters and offline branches.
6. Complete customer-media browser regression and live Telegram staff-group journey.
7. Physical 58/80 mm printer acceptance across configured printer roles.

## 9. Code evidence map

The following source files are the primary evidence behind the open findings:

- Admin navigation: `apps/pos-web/lib/admin-nav.ts`; printer route:
  `apps/pos-web/app/(shell)/admin/printers/page.tsx`.
- Frontend access contract: `apps/pos-web/lib/route-access.ts`; backend permissions:
  `apps/backend/src/common/auth/permissions.ts` and Prisma seed files.
- Desktop offline contract: `apps/desktop/src/commands.ts`; backend mutating routes:
  `apps/backend/src/modules/*/*.controller.ts`.
- Device enforcement: `apps/backend/src/common/guards/jwt-auth.guard.ts` and
  `apps/backend/src/modules/devices/devices.service.ts`.
- Receipt schema and generation: `apps/backend/prisma/schema.prisma`,
  `apps/backend/src/modules/receipts/receipt-writer.ts`, and
  `apps/backend/src/modules/receipts/receipts.service.ts`.
- Desktop print claiming: `apps/desktop/src/print-worker.ts`.
- Browser session storage: `apps/customer-web/lib/cart.tsx` and
  `apps/pos-web/lib/session.ts`.
- Upload authorization: `apps/backend/src/modules/uploads/uploads.controller.ts`.
- Customer payment availability:
  `apps/backend/src/modules/customers/customer-order-engine.service.ts`.
- CORS/realtime origin policy: `apps/backend/src/config/cors.config.ts` and
  `apps/backend/src/modules/kitchen/kitchen.gateway.ts`.
- Telegram service ownership: `apps/telegram-bot/src/main.ts` and
  `apps/backend/src/modules/telegram/*`.
