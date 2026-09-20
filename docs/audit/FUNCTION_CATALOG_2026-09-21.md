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
| Customer login | Request and verify phone OTP; refresh/logout session | Verified in code; tokens are stored in localStorage and need hardening |
| Checkout | Create one idempotent order and recover from retry | Verified in code; only CASH is operational |
| Order success | Show created order and next action | Verified in code |
| Order history/detail | List orders, show status/items/address/payment, cancel when allowed, reorder | Verified in code |
| Live order updates | Receive realtime events and refresh order state | Partial; websocket plus 15-second polling refreshes more broadly than necessary |
| Profile | View customer identity and manage addresses | Verified in code |
| Online payment | Click/Payme/Card authorization, callback, refund, reconciliation | Missing; UI types exist but backend exposes CASH only |
| Installable/offline web | PWA install and offline browsing/cart | Missing; Desktop is the supported offline operations client |

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
| Login/workspace selector | Authenticate by email/phone, keep session, route by role | Verified; browser tokens need HttpOnly hardening |
| POS terminal | Open shift, browse catalog, build order, select table/type, take payment, generate receipt | Verified for CASH paths; provider payments/refunds missing |
| Waiter | View halls/tables, create/edit orders, send to kitchen | Verified in code |
| Kitchen display | View queue/history, accept/start/ready/complete/cancel with elapsed-time UI | Verified online; Desktop offline registry currently does not queue PATCH kitchen actions |
| Courier | Open courier shift, view assigned deliveries, change delivery state, hand over cash | Verified online; real route/navigation optimization is not present |
| Cash shift | Open/close shift, view orders/transactions, cash in/out, transfer and accept/reject | Verified online; some transfer actions are absent from Desktop offline registry |
| Receipt view | Display printable receipt and mark/reprint it | Partial; list/view exist, durable print pipeline has confirmed defects |
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
| Cash/report | Payments | `/admin/payments` | Payment list and successful payment detail | Partial; refund action/provider reconciliation absent |
| Cash/report | Receipts | `/admin/receipts` | Receipt list/detail, print status, queue, retry/reprint | Partial; queue and cancellation receipt defects remain |
| Cash/report | Expenses | `/admin/expenses` | Categories, list and create expense | Partial; category lifecycle/editing is limited |
| Cash/report | Reports | `/admin/reports` | Sales, product, employee, expense and Z reports | Verified for recorded data; refunds/COGS are explicitly excluded where unsupported |
| Cash/report | Printers | `/admin/printers` | Create and configure branch printers and print roles | Partial; route exists but sidebar link and delete/deactivate workflow are incomplete |
| Menu/marketing | Products | `/admin/products` | List, create, edit, variants, availability, image upload | Verified after media configuration fix |
| Menu/marketing | Categories | `/admin/categories` | Create, edit, order and delete categories | Verified in code |
| Menu/marketing | Modifiers | `/admin/modifiers` | Create/edit groups and options, include inactive | Partial; no explicit delete/archive API contract |
| Menu/marketing | Home/promotions | `/admin/homepage` | Hero slide and promotion CRUD with images/order/active state | Verified; upload permission is coupled to `MENU_EDIT` |
| Inventory | Stock | `/admin/inventory` | Stock, movement, cost, ingredients and warehouses | Partial; ingredient/warehouse edit/deactivate lifecycle missing |
| Inventory | Recipes | `/admin/recipes` | View and upsert variant ingredient recipes | Verified; active warehouse is a hard runtime prerequisite |
| Inventory | Suppliers | `/admin/suppliers` | Supplier CRUD | Verified in code |
| Branches | Branches | `/admin/branches` | Branch CRUD-like editing, hours, product availability, halls/tables/devices | Verified in code |
| Branches | Devices | `/admin/devices` | Create, edit, disable/delete, issue one-time enrollment code, inspect heartbeat/version | Verified online; Desktop enforcement can be bypassed by omitting its header |
| Team | Staff | `/admin/staff` | Create/edit, branch/role, status, terminate/rehire/delete, password reset | Verified in code |
| System | Roles/permissions | `/admin/roles` | Read matrix; super admin manages custom roles | Verified in code; frontend role metadata is not enforced consistently |
| System | Business settings | `/admin/settings` | Public/business settings with validation | Verified in code |
| System | Audit journal | `/admin/audit` | Filter audit records/facets | Verified in code |
| System | Health | `/admin/system-health` | Operational metrics | Verified in code |

### Navigation placement findings

- Printers belong in `Kassa va hisobot`, immediately after Receipts. The page and
  permission exist, but no sidebar item currently exposes it.
- Devices correctly have a global page under Branches and a branch-specific page
  under a branch detail. Both should use the same edit/delete/code component.
- Halls and tables are branch configuration and are intentionally reached from a
  branch, while `/admin/tables` is an operational aggregate page.
- Product create/detail and order detail routes are child pages, so they should
  not have independent sidebar entries.
- Manager and Accountant landing pages are role-specific. Their access rules and
  sidebar filtering currently use different role/permission logic and need one
  documented contract.

## 5. Backend and data platform

| Domain | Implemented functions | State |
| --- | --- | --- |
| Authentication | Staff login/refresh/logout/me, password hashing, throttling, active-user recheck | Verified |
| Authorization | Roles, 60+ permissions, branch scope, permission guards, audit | Verified with contract drift risk in frontend |
| Branches | List/detail/create/update, hours, availability | Verified |
| Devices | CRUD, enrollment code, enrollment, heartbeat/version | Partial enforcement |
| Orders | Create/list/detail, timeline/actions, item changes, status transitions, idempotency | Verified online; identifier collision coverage incomplete for some generated IDs |
| Kitchen | Ticket queue/history and lifecycle | Verified online |
| Payments | Record/process tenders and idempotent operations | Verified for configured local methods; external providers/refunds missing |
| Receipts | Generate/list/detail/ESC-POS/reprint and durable jobs | Partial; schema, immutable snapshot and queue targeting defects |
| Inventory | Stock, cost, movements, recipes, auto deduction | Partial; master-data lifecycle and warehouse readiness gaps |
| Realtime | Authenticated Socket.IO plus event replay endpoint | Verified; customer refetch scope is inefficient |
| Media | Validated image upload to MinIO with folder whitelist | Verified live health; permission model is too narrow for homepage-only roles |
| Geocoding | Search and reverse lookup | Verified in code; external provider health not independently monitored |
| Reports | Sales/products/employees/expenses/Z | Verified within stated accounting limitations |
| Notifications | Durable delivery and dead-letter retry | Verified in code; alerting/dashboard ownership incomplete |
| Health | API/database and admin metrics | Verified live |

## 6. Desktop application

| Function | Expected behavior | Current state |
| --- | --- | --- |
| Bundled UI | Run POS/Admin/Kitchen/Courier UI locally | Verified in packaged design |
| Device identity | Stable local ID, one-time admin enrollment, heartbeat/version | Partial; official client sends ID but server trusts header presence |
| Remember login | Persist staff refresh session on the device | Verified through bundled web storage; OS credential vault is not used |
| Local database | SQLite cache, settings, outbox, conflicts, print state | Verified in code |
| Offline reads | Serve cached GET responses while backend is unavailable | Verified in code |
| Offline writes | Typed command registry, idempotent outbox replay, conflicts/dead letters | Partial; kitchen, item cancel and transfer action route definitions mismatch backend |
| Connectivity UI | Show online/offline, pending/conflict status and controls | Verified in code |
| Auto update | Check, download, install, periodic/manual controls | Verified; release `desktop-v0.1.28` is published |
| Printer setup | Configure and test printer address | Partial; only one fallback host/port in Desktop UI |
| Automatic printing | Claim durable job, build ESC/POS, send TCP 9100, complete/fail with lease | Partial; worker can claim jobs before a usable printer is known |
| Multi-printer routing | Multiple printers and receipt/cancellation/kitchen roles | Backend partial, Desktop UI missing |
| Diagnostics/recovery | Local status, outbox recovery, database recovery | Implemented in code; an operator export/support bundle is missing |

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
2. Correct append-only sale/cancellation/refund document model and fiscal rules.
3. Multi-printer discovery, routing, readiness and per-printer test print.
4. Strict server-issued Desktop device session bound to branch and physical device.
5. Fully contract-tested offline command coverage for all branch operations.
6. Ingredient, warehouse and modifier archive/edit lifecycle.
7. Production migration baseline plus tested backup restore drill.
8. Secure HttpOnly browser refresh sessions and OS-protected Desktop credentials.
9. Central operational alerts for backend, database, Telegram, print dead letters and offline branches.
10. Automated authenticated browser journeys and physical printer acceptance suite.

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
