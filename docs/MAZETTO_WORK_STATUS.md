# MAZETTO FOOD Work Status

Last updated: 2026-08-26

This file is the persistent working checklist for the existing MAZETTO FOOD production project. Read this before continuing any Mazetto task.

## Core Rule

MAZETTO FOOD is not a new project. Do not restart the architecture, rewrite the backend/frontend, reset the database, or recreate deployments unless the user explicitly asks.

Current state is best described as:

> Production MVP is deployed; we are stabilizing it and turning it into a complete restaurant business system.

## Current Production Architecture

```text
Cloudflare Tunnel
  |
  |-- mazettofood.uz / www.mazettofood.uz -> customer-web
  |-- api.mazettofood.uz -> NestJS backend
  |-- media.mazettofood.uz -> nginx media service

Backend API
  |
  |-- PostgreSQL
  |-- TelegramModule for staff order notifications
  |-- Customer Web integration
  |-- Kitchen/order/payment modules

Media Service
  |
  |-- Docker volume: mazetto-media
  |-- Mounted at: /media
  |-- Expected folders: /media/categories and /media/products
```

## Production Services

| Area | Status | Notes |
| --- | --- | --- |
| Backend | Done | NestJS backend is deployed and health endpoint works. |
| Database | Done | PostgreSQL is deployed, migrations and seed were applied. |
| Customer Web | In progress | Main routes, cart, checkout, profile, orders, premium mobile UI exist. |
| Media Service | In progress | nginx service and volume work, but real image files are missing. |
| Telegram Staff Notifications | In progress | Backend code exists; production ENV and Telegram webhook setup remain. |
| Customer Telegram Bot | Not started | Separate customer-facing bot is not implemented. |
| MAZETTO Desktop | Not started | Will contain POS, Desktop Admin, offline SQLite, sync engine, and printer engine. |
| Admin Panel | Not started | Planned for later. |
| Payment Integrations | Not started | Click/Payme real integrations are later-stage work. |

## Completed Work

- Monorepo exists and must be preserved.
- Backend foundation exists.
- Prisma/PostgreSQL schema exists.
- Production migrations were applied successfully.
- Seed was applied successfully.
- Backend health works in production.
- Customer menu APIs return products/categories.
- Customer Web exists with:
  - home
  - menu
  - product detail
  - cart
  - checkout
  - order success
  - orders
  - profile
- Customer Web media URL resolver exists:
  - `NEXT_PUBLIC_MEDIA_URL + imageUrl`
- Media service exists:
  - `apps/media/Dockerfile`
  - `apps/media/nginx.conf`
  - Docker volume `mazetto-media`
- Media audit completed:
  - service works
  - folders exist
  - files are missing
- Media inventory mapping completed:
  - 10 category images required
  - 35 product images required
- Telegram backend audit completed:
  - `TelegramModule` exists
  - `TelegramController` exists
  - `TelegramOrderNotificationService` exists
  - webhook route exists: `POST /api/v1/telegram/webhook/:secret`
  - separate Mazetto Telegram bot service does not exist
- Customer Web premium mobile UI polish was implemented:
  - mobile header corrected
  - bottom nav added
  - Uzbek customer-facing text improved
  - Framer Motion interactions added
  - cart/product animations added
  - dark/light token support added
- Customer Web header/theme stability was completed:
  - top bar scrollbar fixed
  - route-change header jitter fixed
  - stable scrollbar gutter added
  - user-facing day/night toggle added
  - real browser QA passed for 360, 375, 390, 430, 768, 1024, 1280, 1440, and 1920px widths
- Customer Web bottom navigation and Liquid Glass polish was completed:
  - fixed mobile bottom navigation stabilized
  - bottom nav active route mapping corrected for product, checkout, and order success pages
  - cart badge added without layout shift
  - cart and checkout mobile action bars moved above bottom navigation
  - reusable liquid/glass surface, button, chip, nav, and active-state classes added
  - real browser QA passed for 360, 375, 390, 430, 768, 1024, and 1440px widths
- Customer Web dynamic homepage and upsell foundation was completed:
  - admin-controlled homepage hero slider database/API foundation added
  - admin-controlled promotions database/API foundation added
  - customer home API added for hero slides and promotions
  - homepage hero slider now reads API data
  - promotion slider hides automatically when no active promotions exist
  - mobile category ordering now puts Sets first
  - cart page now has pre-checkout "Hech narsa qolib ketmadimi?" upsell recommendations
  - upsell quick-add uses the existing cart flow without changing checkout logic
- Branch readiness for Customer Web and checkout was completed:
  - Branch remains the central operational location model
  - branch coordinates, order acceptance, delivery/pickup flags, temporary closure, and timezone fields were added
  - weekly working-hours model was added
  - per-branch product availability model was added
  - customer-safe branch API now returns open/order acceptance and delivery/pickup state
  - online checkout validates branch availability server-side
  - Customer Web preserves selected branch into menu and checkout
  - branch-related responsive browser QA passed for 360, 375, 390, 430, 768, 1024, and 1440px widths
- Customer order engine production-readiness hardening was completed locally:
  - customer checkout now sends a stable idempotency key per unchanged submission
  - backend stores customer order attempts and prevents duplicate orders from repeated submits
  - repeated successful attempts return the original order without duplicate kitchen or Telegram notifications
  - changed checkout payloads with the same key are rejected instead of silently creating inconsistent duplicates
  - customer order success/history responses include branch context
  - Prisma schema validation, Prisma client generation, lint, typecheck, backend build, and customer-web build passed locally
- Phase 5B production validation gate was completed locally against an isolated PostgreSQL database:
  - a fresh migration chain applied successfully from zero application tables
  - seed completed successfully without demo users
  - customer order API E2E covered valid order creation, retry idempotency, same-key/different-payload rejection, 10-way concurrent retry, rollback on invalid modifier, branch availability validation, and server-authoritative pricing
  - Telegram side effects stayed safe when Telegram ENV values were missing and did not create duplicate notifications on idempotent retries
  - Customer Web responsive smoke checks passed for 360, 375, 390, 430, 768, 1024, and 1440px widths with no horizontal overflow
  - authenticated browser checkout remains a manual QA item because the local browser session could not safely inject a customer auth token

## Current Blockers

### 0. Production Release Backup

Phase 6A read-only release audit found no reliable MAZETTO PostgreSQL backup configured or verified before applying the pending production migrations.

Phase 6A.1 created and verified a fresh pre-release PostgreSQL backup outside the PostgreSQL Docker volume:

```text
/home/javohir/backups/mazetto/postgres/mazetto-pre-release-20260826-135932.dump
```

Verification:

- file exists and size is greater than zero
- `pg_restore --list` succeeds from the PostgreSQL container
- dump contains expected MAZETTO tables and table data entries
- restore test into a temporary isolated database succeeded
- restored counts matched current production baseline: 10 categories, 35 products, 0 branches, 0 orders, 0 customer orders
- temporary restore database was removed afterward

Production currently has 11 applied Prisma migrations. The local codebase has 14 migrations, so these are pending in production:

```text
20260826090000_homepage_promotions
20260826100000_branch_readiness
20260826110000_customer_order_idempotency
```

Required next action:

Before pushing the release, control backend auto-deploy so new backend code cannot start before the pending migrations are applied.

### 1. Media Files Missing

Database expects paths such as:

```text
/categories/lavash.webp
/products/lavash-big.webp
```

Production media volume folders exist:

```text
/media/categories
/media/products
```

But they are empty. No real Mazetto image files were found locally, on the server, in Docker volumes, or in git history.

Required next action:

Upload real `.webp` images with exact filenames into the `mazetto-media` volume.

### 2. Telegram Staff Notification Not Enabled

Backend code is ready, but production ENV is missing:

```text
TELEGRAM_BOT_TOKEN
TELEGRAM_STAFF_CHAT_ID
TELEGRAM_WEBHOOK_SECRET
```

Required next action:

Add these ENV values in Dokploy, redeploy/restart only the backend after user confirmation, then set Telegram webhook.

### 3. Production Branch Data Missing

Branch schema/API readiness is implemented, but production branch records still need to be created deliberately.

Required next action:

Create real MAZETTO branch records with address, phone, delivery/pickup status, and working hours after user confirmation.

## Roadmap

### Phase 0 - Infra And Existing System Audit

Status: Done

- Ubuntu server checked.
- Docker/Dokploy checked.
- Cloudflare Tunnel checked.
- Mazetto services checked.

### Phase 1 - Production Stabilization

Status: In progress

- Media service: infrastructure done, image files missing.
- Telegram staff notifications: backend code done, production activation pending.

### Phase 2 - Customer Web Completion

Status: In progress

- Mobile-first UI exists.
- Checkout exists.
- Header/theme stability is done.
- Bottom navigation and Liquid Glass navigation polish are done.
- Dynamic homepage and pre-checkout upsell foundation are done.
- Needs real media files for final visual quality.
- Remaining: admin UI for homepage/promotion management, real promotion content, real media files, full E2E test.

### Phase 3 - Customer Homepage

Status: Done

- Hero food slider foundation is controlled by backend/admin-protected APIs.
- Discount/promotion slider foundation is controlled by backend/admin-protected APIs.
- Discount section hides automatically when no active promotion exists.
- Mobile category order puts Sets first.
- Customer home reads `/api/v1/customer/home`.
- Remaining future work: admin visual management UI and real promotion campaign content.

### Phase 4 - Media Completion

Status: In progress

- Media service is done.
- Frontend media hardening is done.
- Required filename inventory is done.
- Remaining: compare catalog with original Mazetto menu, create/collect 45 real images, convert to WebP, upload to production volume, visual QA.

### Phase 5 - Customer Cart / Upsell

Status: Done

- Pre-checkout "Hech narsa qolib ketmadimi?" upsell section added.
- Suggests sauces, drinks, fast food/fries, and additions from existing menu API data.
- One-tap add to cart works through the existing cart system.
- Future admin-managed recommendations.

### Phase 6 - Customer Checkout / Order E2E

Status: Done locally, production smoke pending

- Basic checkout implementation exists.
- Branch readiness and delivery/pickup validation are implemented.
- Customer order idempotency and duplicate-submit protection are implemented.
- Local isolated database/API validation passed for fresh migrations, seed, valid orders, retry idempotency, concurrent idempotency, rollback behavior, branch validation, and server-authoritative pricing.
- Remaining: real production branch data, real address/delivery operations, payment confirmation flow, authenticated browser checkout QA, deployed production smoke test, and full production E2E test.

### Phase 7 - Branch System

Status: Partially done

- Branch name, code, address, phone, GPS coordinates, working hours, active status, temporary closure, order acceptance, delivery/pickup status, and product availability foundation exist.
- Branch is already related to orders, employees, devices, printers, warehouses, shifts, reports, and customer orders.
- Remaining: real production branch records, full admin UI, delivery zone/routing, future Desktop/POS device assignment workflows.

### Phase 8 - Telegram Staff Integration

Status: In progress

- Backend code exists.
- Remaining production ENV: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_STAFF_CHAT_ID`, `TELEGRAM_WEBHOOK_SECRET`.
- Remaining: webhook setup and production verification.

### Phase 9 - Customer Telegram Bot

Status: Not started

- `/start`, Telegram auth, phone binding, web login code, Menu, Cart, Orders, Addresses, status notifications.
- It should use Mazetto API and PostgreSQL, not a separate menu database.

### Phase 10 - MAZETTO Desktop

Status: Not started

This replaces the old separate Print Agent plan. Desktop will include POS, Admin, Print Engine, offline-first local database, local auth cache, and sync engine.

Recommended stack:

```text
Electron
TypeScript
React
SQLite
Prisma/Drizzle SQLite
Node printer layer
WebSocket + REST Sync
```

### Phase 10.1 - Desktop Login

Status: Not started

- Employee login, PIN/password, role, branch, device registration, offline cached login.

Roles:

```text
SUPER_ADMIN
ADMIN
MANAGER
CASHIER
KITCHEN
```

### Phase 10.2 - Desktop Kassa / POS

Status: Not started

- Offline categories, products, search, product modifiers, quantity, cart, customer, discount, payment, order create, receipt, reprint.
- Cashier should be able to create an order in 5-10 seconds.

### Phase 10.3 - Desktop Admin

Status: Not started

- Dashboard, Orders, Menu, Products, Categories, Branches, Employees, Customers, Payments, Stock, Expenses, Reports, Shifts, Daily closing, Promotions, Homepage slider, Discounts, Printers, Telegram settings, Audit logs, Settings.
- Restricted by role permissions.

### Phase 11 - Desktop Local Database

Status: Not started

- `mazetto-local.db` with branch-scoped subsets: products, categories, branches, employees, orders, order items, payments, shifts, expenses, inventory, promotions, settings, print jobs, sync queue, sync state.

### Phase 12 - Offline Sync Engine

Status: Not started

- Every local change must have `eventId`, `entityId`, `deviceId`, `branchId`, timestamps, version, and sync status.
- Statuses: `LOCAL`, `PENDING`, `SYNCING`, `SYNCED`, `CONFLICT`, `FAILED`.
- Must be idempotent so repeated sync retries do not create duplicate orders.

### Phase 13 - Conflict Resolution

Status: Not started

- Order transaction snapshots never change.
- Menu/product: server newest/version wins.
- Employee: server wins.
- Inventory movements: merge as events.
- Cash transactions: immutable synced transactions.

### Phase 14 - Desktop Printer Engine

Status: Not started

- Print jobs live inside Desktop, not a separate Print Agent.
- Supports USB, LAN, ESC/POS, retry, reprint, duplicate protection, printer status, and last error.

### Phase 15 - Web/Bot Orders To Desktop

Status: Not started

- Customer Web or Telegram order goes to Backend, then WebSocket to Desktop, then local DB, then printer.
- Desktop prints only after the order is saved locally.

### Phase 16 - Offline Branch Operation

Status: Not started

- Desktop must continue POS, product lookup, cash order, printer, shift, and expenses without internet.
- Site/bot orders wait until internet returns.

### Phase 17 - Central Server Outage Recovery

Status: Not started

- Desktop local POS and printer continue.
- Pending queue syncs to Backend/PostgreSQL when server returns.

### Phase 18 - Printer Reliability

Status: Not started

- `PENDING`, `PRINTING`, `PRINTED`, `FAILED`, retry, reprint, duplicate protection, offline queue, online/offline detection, last error.

### Phase 19 - Kitchen Display

Status: Not started

- Desktop or separate screen: NEW, CONFIRMED, COOKING, READY, timer, sound, order items, modifiers, ready button, realtime updates.

### Phase 20 - Cash Register / Shift

Status: Not started

- Shift open, opening cash, cash in/out, withdrawal, close shift, reconciliation, Z-report, discrepancy.
- Must work offline.

### Phase 21 - Inventory

Status: Not started

- Ingredients, recipes, stock, supplier, stock in/out, write-off, low stock, branch stock.
- Offline events sync later.

### Phase 22 - Kirim / Chiqim

Status: Not started

- Income, expense, category, employee, branch, time, comment, attachment.

### Phase 23 - Daily Closing

Status: Not started

- Daily snapshot: cash, terminal, Click, Payme, expenses, income, orders, total.
- Offline closing must sync later.

### Phase 24 - Reports

Status: Not started

- Daily, weekly, monthly, custom, branch, cashier, payment, product, category, expense, profit, average order, canceled orders, Excel/PDF.

### Phase 25 - Admin Web

Status: Not started

- Remote management web app using the same backend and same central database.
- No separate admin database.

### Phase 26 - Homepage Management

Status: Not started

- Admin/Desktop-managed hero slider, discount slider, and upsell configuration.

### Phase 27 - Click / Payme

Status: Not started

- Merchant setup, Click, Payme, webhook, signature, idempotency, refund, reconciliation.
- Offline mode must not fake `PAID` confirmation.

### Phase 28 - Security

Status: Not started

- RBAC, JWT, offline employee credential security, local DB encryption, device authorization, sync authentication, rate limits, webhook verification, audit log, secret handling.

### Phase 29 - Backup / Recovery

Status: Not started

- Server PostgreSQL backup, media backup, restore test.
- Desktop local DB backup, corrupt DB recovery, pending sync queue recovery.

### Phase 30 - Monitoring

Status: Not started

- Admin should see Desktop online/offline status, last sync, pending changes, printer status.

### Phase 31 - Final E2E Tests

Status: Not started

- Test internet outage, server outage, Desktop restart, printer outage/restart, sync retry, conflict, two devices same branch, offline shift, offline daily closing.

### Phase 32 - Order Engine Consolidation

Status: Partially done

- Web orders create real backend orders.
- Kitchen flow integration exists.
- Future work: ensure WEB, POS, Telegram orders all use one canonical order flow.

## Media Required Files

Categories:

```text
categories/lavash.webp
categories/chicken-lavash.webp
categories/burger.webp
categories/chicken-burger.webp
categories/hot-dog.webp
categories/doner.webp
categories/fast-food.webp
categories/drinks.webp
categories/sauces.webp
categories/sets.webp
```

Products:

```text
products/lavash-big.webp
products/lavash-classic.webp
products/lavash-mini.webp
products/lavash-beef.webp
products/chicken-lavash.webp
products/chicken-cheese-lavash.webp
products/chicken-spicy-lavash.webp
products/burger-classic.webp
products/burger-big.webp
products/cheeseburger.webp
products/burger-double.webp
products/chicken-burger.webp
products/crispy-chicken-burger.webp
products/chicken-cheeseburger.webp
products/hot-dog-classic.webp
products/hot-dog-cheese.webp
products/hot-dog-double.webp
products/doner-wrap.webp
products/doner-plate.webp
products/chicken-doner.webp
products/fries.webp
products/cheese-fries.webp
products/chicken-strips.webp
products/nuggets.webp
products/coca-cola.webp
products/fanta.webp
products/sprite.webp
products/water.webp
products/house-sauce.webp
products/cheese-sauce.webp
products/spicy-sauce.webp
products/set-family.webp
products/set-lavash.webp
products/set-burger.webp
products/set-kids.webp
```

## Preferred Next Order

1. Customer Web header/theme buglarini tugatish. Status: Done.
2. Bottom nav + Liquid Glass UI. Status: Done.
3. Hero slider / Discount slider / Upsell UI. Status: Done.
4. Real menu and 45 media images. Status: In progress, files missing.
5. Branch system. Status: Partially done, customer/checkout readiness complete.
6. Customer order E2E. Status: Done locally, production smoke pending.
7. Telegram Staff production. Status: In progress.
8. MAZETTO Desktop architecture. Status: Not started.
9. Desktop Local DB. Status: Not started.
10. Offline Sync Engine. Status: Not started.
11. Desktop POS. Status: Not started.
12. Desktop Printer Engine. Status: Not started.
13. Web/Bot to Desktop realtime orders. Status: Not started.
14. Offline/online recovery. Status: Not started.
15. Desktop Admin. Status: Not started.
16. Kitchen. Status: Not started.
17. Cash Register / Shift. Status: Not started.
18. Admin Web. Status: Not started.
19. Inventory. Status: Not started.
20. Kirim / Chiqim. Status: Not started.
21. Daily Closing. Status: Not started.
22. Reports. Status: Not started.
23. Customer Telegram Bot. Status: Not started.
24. Click / Payme. Status: Not started.
25. Security. Status: Not started.
26. Backup / Monitoring. Status: Not started.
27. Full E2E / Production QA. Status: Not started.

## Architecture Decision Log

### Print Agent Replaced By MAZETTO Desktop

Status: Accepted

The separate Print Agent plan is removed from the master roadmap. Printer, offline DB, sync, POS, cash register, and Desktop Admin features will be implemented inside MAZETTO Desktop.

Target Desktop architecture:

```text
MAZETTO Desktop
  |-- Local SQLite DB
  |-- Sync Engine
  |-- Print Engine
  |-- Local Auth Cache
  |-- POS / Kassa
  |-- Desktop Admin
```

The central server database remains the source of truth. Desktop stores only local operational/cache data and syncs safely when connectivity returns.
