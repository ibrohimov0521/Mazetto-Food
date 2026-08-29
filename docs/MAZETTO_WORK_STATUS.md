# MAZETTO FOOD Work Status

Last updated: 2026-08-27

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
- Phase 6B controlled production release was completed:
  - release commit `f6650b92a13a011b1bdbf7eac1d975e04a0c97e8` was pushed to `origin/main`
  - backend auto-deploy was disabled before push and restored after smoke tests
  - production migrations were applied successfully; production now has 14 applied Prisma migrations and 0 failed migrations
  - production seed was run once successfully after migration
  - backend service was manually updated to release image tag `f6650b9`
  - customer-web service was manually updated to release image tag `f6650b9`
  - backend smoke tests passed for health, customer branches, customer menu categories, customer home, and unauthenticated admin rejection
  - customer-web production smoke checks passed for 360, 430, 768, and 1440px widths with no horizontal overflow and no broken image icons
- Phase 6C real production branch configuration was completed:
  - production branch `MAZETTO Sergeli` was created with code `SERGELI`
  - address is `Sergeli 7/3`
  - phone is intentionally empty because the owner has not provided a number and the schema allows null
  - coordinates were resolved from the supplied Google Maps link as `41.1970731, 69.2038921`
  - timezone is `Asia/Tashkent`
  - working hours are 10:00-23:00 every day, Monday through Sunday
  - branch is active, accepts orders, is not temporarily closed, and supports delivery and pickup
  - production customer branch API returns the branch once with `isOpen: true` during the verified Tashkent business-hours check
  - no orders, customer orders, product prices, seed data, migrations, deployments, Telegram, or Cloudflare settings were changed
- Phase 6C.1 customer-web production build-time environment fix was completed:
  - root cause was that the deployed Next.js bundle was built without `NEXT_PUBLIC_API_BASE_URL` and `NEXT_PUBLIC_MEDIA_URL`, so customer-web used the local development fallback `http://localhost:4000/api/v1`
  - customer-web Dockerfile now passes the public API and media values into the builder stage before `next build`
  - Dokploy customer-web build arguments were configured for the same public values
  - release commit `b479a78fb0f96155f28fcfb0e556c391240f9028` was pushed to `origin/main`
  - backend and media auto-deploy were temporarily disabled before push and restored after verification
  - customer-web service was manually updated to image tag `b479a78`
  - actual served production JavaScript no longer contains `localhost:4000` and contains `api.mazettofood.uz` and `media.mazettofood.uz`
  - real browser QA verified `MAZETTO Sergeli` appears in the production branch selector and menu loads with the selected branch
  - no backend code, database data, migrations, seed, Cloudflare, Telegram, or media files were changed
- Phase 6D authenticated production checkout E2E was blocked before order creation:
  - production health, migration status, Sergeli branch state, menu, cart, upsell, media fallback, and responsive customer-web smoke checks passed
  - production auth flow requires `POST /api/v1/customer/auth/request-code` then `verify-code`
  - request-code currently returns `delivery.status: PENDING_INTEGRATION` because verification code delivery is reserved for Telegram integration
  - production Telegram ENV values are intentionally missing, so there is no supported way to receive the customer verification code
  - no customer, order, customer order, kitchen ticket, or customer order attempt was created
  - one clearly marked test verification challenge was created for phone `+998000006666` while confirming the blocker; it remains unconsumed and expires automatically
  - browser cart-only QA used `Big Lavash` plus one upsell item and did not submit checkout
  - hero fallback audit confirmed `/customer/home` returns product-based fallback slides when DB hero slides are empty; promotions remain empty
  - no migrations, seed, deploy, Cloudflare, Telegram, media, product price, branch config, or backend/frontend code changes were made
- Customer Web Step 3 shell/home/product pixel-lock pass was completed locally:
  - shared customer shell remained fixed-brand only; theme switching was not reintroduced
  - Home primary hero now uses real customer-home/product/menu API data with the approved petrol-teal, ivory, yellow CTA, real logo, and compact branch selector language
  - Home category navigation now uses compact image-backed category cards fed by real category data
  - Product Detail now has a tighter teal media panel, ivory configuration surface, compact variants/modifiers, stable quantity control, yellow `Savatchaga qo'shish` CTA, and the required full menu continuation
  - Menu regression QA still showed 35 real product cards, sticky category navigation, no horizontal overflow, and stable bottom navigation at 390, 430, 768, and 1440px
  - Screenshot evidence is stored under `.qa-screenshots/step3-*`; those QA files are local artifacts and are not intended for commit
  - No backend, API, database, Telegram, order, payment, Dokploy, Cloudflare, production deploy, push, or media upload changes were made
- Customer Web Step 5 final visual and functional regression gate was completed locally:
  - route matrix covered `/`, `/menu`, `/product/[id]`, `/cart`, `/checkout`, `/orders`, `/orders/[id]`, `/profile`, and `/order-success/[id]`
  - real production customer menu APIs returned 35 products and 10 categories during QA
  - cart add, increment, decrement, remove, page total, and header total stayed synchronized
  - menu search filtered and cleared correctly, from 35 products to 10 matching results and back to 35
  - configurable product QA confirmed variants and modifiers are rendered without auto-selecting paid additions
  - checkout authentication remained inside the checkout route and did not redirect the customer to Home
  - sticky menu navigation, fixed bottom navigation, Uzbek language scan, and no-horizontal-overflow checks passed across the final matrix
  - one safe accessibility fix was added for cart quantity buttons
  - no backend, API, database, Telegram, payment, Dokploy, Cloudflare, production deploy, push, or media upload changes were made
- Customer Web Step 6 authentic media recovery was improved locally:
  - CDR direct extraction remains unavailable because no trustworthy local CDR/CorelDRAW conversion tool is installed
  - the MAZETTO PDF was re-audited through page renders and 159 embedded image objects
  - `Pishloqli fri` was recovered as an authentic composite from existing MAZETTO fries and actual pishloqli sous source material
  - `Pishloqli sous` media was corrected from the nearby garlic sauce object to the actual yellow cheese sauce object
  - product source-media coverage improved from 26/35 to 27/35 local deliberate assets
  - category source-media coverage remains 10/10
  - direct authentic 35/35 product coverage is not complete; 8 products still need authentic/official source material
  - media production readiness is still pending because assets were not uploaded to the production media volume and no deployment was performed
- Customer Telegram phone verification flow was implemented locally:
  - `Customer` now supports optional Telegram link fields: `telegramUserId`, `telegramChatId`, and `telegramLinkedAt`
  - `request-code` keeps the existing response shape and now returns Telegram delivery status: `SENT`, `TELEGRAM_LINK_REQUIRED`, or `PENDING_INTEGRATION`
  - linked customers receive the 6 digit code through Telegram
  - unlinked customers are told to open the MAZETTO Telegram bot, press `/start`, and share their phone contact
  - Telegram contact sharing binds `phone ↔ telegramUserId` and sends a fresh verification code
  - `verify-code` remains the canonical JWT login step
  - implementation is local only; production migration, ENV, webhook setup, and deploy are still pending approval
- Phase 7A.1 Telegram customer auth validation gate was completed locally except isolated database migration apply:
  - Telegram contact ownership is validated by requiring `contact.user_id` to match `message.from.id`
  - `telegramUserId` is unique and cannot be linked to multiple customers
  - phone normalization reuses the existing MAZETTO customer auth normalization path
  - verification codes are stored only as bcrypt hashes and are not logged
  - resend now expires previous active challenges so old codes cannot be reused after rotation
  - request-code now has a local DB-backed short-window rate limit
  - focused automated validation covers missing bot token, unlinked request-code, `/start`, foreign contact rejection, self contact linking, code delivery, verify-code, wrong code, expired code, reused code, old code after resend, excessive verify attempts, request-code rate limit, wrong webhook secret, and staff callback routing regression
  - Prisma format, validate, generate, backend/customer-web typecheck, lint, build, and root typecheck/lint/build passed
  - isolated fresh PostgreSQL migration apply is still pending because local Docker was unavailable and local PostgreSQL required credentials; production database was not touched
- Phase 7A.2 Telegram auth final migration gate and responsive QA was completed:
  - an isolated temporary PostgreSQL 18 container was created on the Ubuntu server with a separate temporary volume and localhost-only port binding
  - the production PostgreSQL service and production database were not used
  - the complete migration chain from zero applied successfully, including `20260826120000_customer_telegram_auth`
  - 15 migrations were applied and Prisma reported the database schema as up to date
  - the seed ran successfully against the temporary database: 0 users, 0 customers, 6 roles, 39 permissions, 66 role-permission links, 7 payment methods, 10 categories, 35 products, 44 variants, and 8 modifiers
  - DB-backed Telegram auth integration tests passed for unlinked request-code, self contact linking, real unique `telegramUserId` enforcement, duplicate Telegram identity prevention, linked request-code, resend invalidation, verify-code, reused code rejection, expired code rejection, excessive attempt rejection, persisted request-code rate limit, wrong webhook secret, `/start`, and staff callback routing regression
  - production migration safety was confirmed read-only: production currently has `customers = 0`, and the new migration is additive with nullable columns plus a safe unique index
  - customer-web responsive QA passed for Telegram auth states at 360, 390, 430, 768, and 1440px
  - `TELEGRAM_LINK_REQUIRED` shows the Telegram bot CTA, `PENDING_INTEGRATION` stays graceful, and verification-code input state works
  - no bot token reaches the DOM/client UI; only the public bot URL is surfaced
  - a sticky-header issue discovered during QA was fixed by making the customer header fixed with a matching spacer; no horizontal overflow was observed and mobile bottom nav stayed fixed
  - the temporary PostgreSQL container and temporary volume were removed after validation
  - Prisma format, validate, generate, backend/customer-web typecheck, lint, build, and root typecheck/lint/build passed
  - Telegram customer auth local implementation is READY FOR PRODUCTION ACTIVATION, but production activation itself is not complete
- Phase 7B Telegram customer auth production activation was started but stopped before production migration/deploy:
  - release commit `1a92a01d6d929cdd45f1cd626efca3cb7dd9a52a` was pushed to `origin/main`
  - production services were healthy before activation: backend, customer-web, PostgreSQL, and media were all `1/1`
  - `GET /api/v1/health` returned 200
  - production pre-activation counts were recorded: 0 customers, 1 verification challenge, 0 orders, and 0 customer orders
  - a fresh pre-Telegram-auth PostgreSQL backup was created and verified with `pg_restore --list`:
    `/home/javohir/backups/mazetto/postgres/mazetto-pre-telegram-auth-20260826-194808.dump`
  - backend auto-deploy was already disabled before push; customer-web auto-deploy was disabled; media auto-deploy remained enabled
  - final local validation passed before commit and push
  - backend release image `mazetto-food-backend-pdslpm:1a92a01` was built successfully on the server, but not deployed
  - activation stopped because Dokploy backend application ENV and MAZETTO project environment did not contain `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, or `TELEGRAM_CUSTOMER_BOT_URL`
  - no production migration, backend deploy, customer-web deploy, Telegram webhook setup, or real customer login test was performed
- Phase 7B was resumed from production migration and stopped after backend ENV verification:
  - production migration `20260826120000_customer_telegram_auth` was applied successfully
  - production now has 15 applied Prisma migrations and 0 failed migrations
  - `Customer.telegramUserId`, `Customer.telegramChatId`, `Customer.telegramLinkedAt`, `customers_telegramUserId_key`, and `customers_telegramChatId_idx` were verified in production
  - backend service was manually updated to image `mazetto-food-backend-pdslpm:1a92a01`
  - backend converged to `1/1` and health returned 200
  - an earlier check suggested the new backend container did not contain `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, or `TELEGRAM_CUSTOMER_BOT_URL`
  - a later read-only service/container inspection found those ENV names present in the backend service and current backend container; secret values were not printed
  - customer-web was not redeployed, Telegram webhook was not configured, and no real customer login or order test was performed
- Phase 7B customer-web release continuation was completed through deployment but stopped before Telegram webhook activation:
  - customer-web was manually deployed from commit `fb2f847`
  - backend remained healthy and the current backend container was verified to contain the required Telegram ENV names without printing values
  - customer-web production bundle was verified to contain `api.mazettofood.uz`, `media.mazettofood.uz`, and customer order-history routes, with no `localhost:4000` fallback in the served bundle
  - Telegram webhook setup was intentionally left pending until the customer-web experience is stable
  - no production order was created
- Customer Web autonomous UI/menu-scroll redesign is in local implementation:
  - day mode now defaults to the primary customer theme
  - light theme was softened from plain white into a mint/green/blue MAZETTO visual system
  - dark leftover surfaces in day mode were reduced through shared tokens and light-mode overrides
  - mobile header now shows only `MAZETTO FOOD` and the day/night toggle, and is not fixed on mobile
  - mobile bottom navigation is thinner and ordered: Home, Menu, Cart, Orders, Profile
  - cart remains centered in the mobile bottom navigation
  - menu now renders continuous category sections instead of a single filtered category view
  - category tabs scroll to sections and scrollspy updates the active tab
  - mobile product cards render in a compact two-column layout
  - local customer-web typecheck, lint, and build passed
  - local browser QA over 360, 375, 390, 430, 768, 1024, and 1440px found no horizontal overflow after fixes
  - root/backend validation passed after implementation
  - release commits `e8e3a2d`, `2c6072b`, and `366dc5b` were pushed to `origin/main`
  - customer-web was manually deployed to production from image tag `366dc5b`
  - production health checks passed for backend and customer-web after deployment
  - production bundle contains `api.mazettofood.uz` and `media.mazettofood.uz`, and does not contain the `localhost:4000` fallback
  - production browser smoke checks over 360, 390, 430, 768, and 1440px found no horizontal overflow
  - Telegram webhook was configured for `api.mazettofood.uz` and `getWebhookInfo` shows pending updates `0` with no current Telegram error
  - no production order was created; production counts remain `customers = 0`, `orders = 0`, and `customer_orders = 0`
  - remaining: real `@mazettofoodbot` `/start -> contact -> request-code -> verify-code` login test requires the user/customer to perform the Telegram contact step

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

Production now has 14 applied Prisma migrations:

```text
20260826090000_homepage_promotions
20260826100000_branch_readiness
20260826110000_customer_order_idempotency
```

These release migrations were applied successfully during Phase 6B.

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

Backend code is ready. Production backend was later verified read-only to contain these ENV names:

```text
TELEGRAM_BOT_TOKEN
TELEGRAM_STAFF_CHAT_ID
TELEGRAM_WEBHOOK_SECRET
```

Required next action:

Confirm the values in Dokploy UI if needed, configure Telegram webhook after approval, then complete real bot login testing.

### 3. Customer Verification Delivery

Customer verification delivery has been implemented and validated locally, including fresh migration and DB-backed integration tests. Backend image `1a92a01` is running in production, and customer-web was later deployed from commit `fb2f847`.

Required next action:

Telegram webhook is configured and healthy. Complete real `@mazettofoodbot` login verification with an authorized customer phone/contact. Telegram auth is not considered fully activated until real login verification passes.

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
- Day-mode customer redesign and continuous menu scroll system are deployed to production.
- Needs real media files for final visual quality.
- Remaining: Telegram login E2E, admin UI for homepage/promotion management, real promotion content, real media files, full E2E test.

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

Status: Production release deployed, real Sergeli branch configured

- Basic checkout implementation exists.
- Branch readiness and delivery/pickup validation are implemented.
- Customer order idempotency and duplicate-submit protection are implemented.
- Local isolated database/API validation passed for fresh migrations, seed, valid orders, retry idempotency, concurrent idempotency, rollback behavior, branch validation, and server-authoritative pricing.
- Controlled production release, migrations, seed, backend deploy, customer-web deploy, and smoke tests passed.
- Remaining: customer verification delivery, real media files, real delivery operations, payment confirmation flow, authenticated production checkout QA, and full production E2E test.

### Phase 7 - Branch System

Status: Real Sergeli branch configured, admin UI still pending

- Branch name, code, address, phone, GPS coordinates, working hours, active status, temporary closure, order acceptance, delivery/pickup status, and product availability foundation exist.
- Production now has one real branch: `MAZETTO Sergeli`.
- Branch is already related to orders, employees, devices, printers, warehouses, shifts, reports, and customer orders.
- Remaining: phone number from owner, full admin UI, delivery zone/routing, future Desktop/POS device assignment workflows.

### Phase 8 - Telegram Staff Integration

Status: In progress

- Backend code exists.
- Remaining production ENV: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_STAFF_CHAT_ID`, `TELEGRAM_WEBHOOK_SECRET`.
- Remaining: webhook setup and production verification.

### Phase 9 - Customer Telegram Bot

Status: Production activation pending real login

- `/start`, Telegram auth contact request, phone binding, and web login code delivery are implemented locally in the backend Telegram webhook.
- Fresh migration and DB-backed integration validation passed.
- Production migration is applied, backend is deployed, and required Telegram ENV names are present in the running backend container.
- Telegram webhook is configured to the production backend and reports no current Telegram delivery error.
- Remaining production work: real production `@mazettofoodbot` login E2E with an authorized user contact.
- Remaining future bot features: Menu, Cart, Orders, Addresses, and status notifications.
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

## Customer Experience Stabilization - Telegram Auth, Mobile API, Uzbek Menu

Status: Production data updated, customer-web code ready for controlled deploy

Date: 2026-08-27

Completed in this pass:

- Telegram webhook was restored after bot token/webhook secret rotation without exposing secret values.
- Production backend runtime was verified to contain Telegram ENV names.
- Mobile User-Agent API checks for customer branches, menu categories, menu products, and homepage returned 200 with MAZETTO CORS.
- Customer-web API fallback was hardened so production browsers use `https://api.mazettofood.uz/api/v1` when build-time public API ENV is missing.
- Customer localStorage reads were hardened so corrupted cart/session/favorites storage cannot break page load.
- Checkout, cart, orders, order detail, and profile no longer force customers to go to the home page for phone verification; the Telegram auth panel works in context.
- Customer cart navigation now shows a cart icon plus `Savat` when empty and cart icon plus the current total when non-empty, while keeping stable width.
- Customer-facing money display now uses `so'm`.
- Customer-facing menu names, descriptions, variants, modifiers, and combos were localized to Uzbek in the seed source.
- Production PostgreSQL customer-visible menu text was updated by a targeted transaction after a verified backup; no seed was run in production.
- A modern customer branch picker replaced the native branch select on home and checkout.
- Local validation passed for Prisma validate/format, backend/customer-web typecheck, lint, build, existing customer order history validation, existing Telegram customer auth validation, root typecheck, root lint, and diff check.

Production backup before menu text update:

```text
/home/javohir/backups/mazetto/postgres/mazetto-pre-menu-uzbek-20260827-201814.dump
```

Remaining:

- Commit and push the customer-web/seed source changes.
- Controlled customer-web deploy from the new commit.
- Production visual/mobile QA after customer-web deploy.
- Real `@mazettofoodbot` `/start -> contact -> request-code -> verify-code` test with the user/customer.
- Real 45 media assets are still missing from the media volume.
- First authenticated production order E2E remains pending; do not create it without explicit approval.

## Autonomous Night Shift - Customer Experience, Auth, History

Status: Completed locally, ready for controlled deployment review

Date: 2026-08-27

Safety boundary:

- No production deployment was performed.
- No production database write, migration, seed, or real order was performed.
- No production ENV, Cloudflare, Dokploy, BotFather, or Telegram webhook mutation was performed during this local-first night-shift pass.
- No secrets were printed or committed.
- No push to `origin/main` was performed.

Completed locally:

- Customer-web horizontal overflow pass across home, menu, product detail, cart, checkout, orders, order detail, and profile.
- Cart, checkout, menu, home, profile, product cards, homepage sliders, and upsell layouts were tightened with `minmax(0, 1fr)`, `min-w-0`, bounded carousel widths, and safer mobile grids.
- Light theme readability was strengthened without redesigning the dark premium theme.
- Telegram request-code UI now handles loading, invalid/error responses, rate limits, `TELEGRAM_LINK_REQUIRED`, `PENDING_INTEGRATION`, bot CTA, resend, and logged-in states more clearly in Uzbek.
- Customer session refresh was added to the shared cart/customer context so private pages can retry once on an expired access token.
- Customer order history now loads from the authenticated `/customer/me/orders` endpoint and opens individual order details.
- A new authenticated order detail route was added at `/orders/[id]`.
- Backend customer order detail endpoint was added as `/api/v1/customer/me/orders/:id`, scoped by authenticated `customer.id`.
- Backend customer order/dashboard responses were narrowed to customer-safe selected fields instead of exposing full related records.
- Profile now links to order history, supports logout, and shows a real empty state for no orders.
- API fetch parsing now handles network and non-JSON backend errors with Uzbek customer-friendly messages.
- Media fallback path remains centralized and image layouts keep stable aspect boxes.

Focused validation:

- `pnpm --filter customer-web typecheck`: passed.
- `pnpm --filter customer-web lint`: passed.
- `pnpm --filter customer-web build`: passed.
- `pnpm --filter backend typecheck`: passed.
- `pnpm --filter backend lint`: passed.
- `pnpm --filter backend build`: passed.
- `pnpm --dir apps/backend exec tsx scripts/validate-customer-order-history.ts`: passed.
- `pnpm --dir apps/backend exec tsx scripts/validate-telegram-customer-auth.ts`: passed.
- Prisma `format`, `validate`, and `generate` passed locally with a safe placeholder `DATABASE_URL`.

Browser QA:

- Local production build was checked against a mock customer API at widths: 360, 375, 390, 430, 768, 1024, 1280, 1440, and 1920.
- Paths checked: `/`, `/menu`, `/product/prod-lavash`, `/cart`, `/checkout`, `/orders`, `/orders/order-a`, and `/profile`.
- Dark theme matrix: 72 checks passed with no document horizontal overflow and no offscreen controls.
- Light theme sample matrix: 20 checks passed with no document horizontal overflow and no offscreen controls.
- Header and bottom navigation remained fixed in the checked mobile states.

Production notes:

- Current production backend image was previously verified at commit `1a92a01`.
- Current production customer-web was previously known to still be older than `1a92a01`.
- Remaining production validation is required after a controlled customer-web deploy.
- Real media files are still missing from the media volume; customer-web falls back safely, but final food images must still be uploaded.

Remaining blockers:

- Real customer Telegram login must be tested end-to-end in production by a human using `@mazettofoodbot`.
- Production customer-web must be deployed from the approved commit after review.
- 45 real media assets are still missing.
- No production order E2E was created during this night-shift pass.

## Master Implementation Phase - Pixel-Locked Brand + Telegram Ordering

Status: Started locally, partially blocked by missing approved visual assets

Date: 2026-08-27

Preserved from Phase 8:

- reusable CustomerMenuSections
- product detail followed by full menu
- compact product cards
- inline + to - 1 + cart controls
- search clear X
- compact profile/home/topbar/branch UI
- checkout retry/error handling
- menu scroll jump mitigation
- linked Telegram /start main menu
- Telegram categories/products/orders/profile/branches skeleton
- Telegram auth validation changes

Completed in this pass:

- Created `docs/design/MAZETTO_DESIGN_LOCK.md` as the permanent visual source of truth for the approved petrol-teal, warm-yellow, ivory, lavender-logo MAZETTO direction.
- Audited the task attachment and repository for approved logo/reference assets.
- Confirmed no actual logo image, approved screenshots, PNG, SVG, WebP, JPG, or JPEG brand asset exists in the current attachment or repository.
- Updated customer-web global design tokens away from the old generic green/cyan mint direction toward the approved deep teal, warm yellow, ivory, aqua, and lavender brand system.
- Updated the shared media fallback to use the new petrol/yellow brand direction while preserving the existing media resolver and missing-image resilience.

Current blockers:

- Pixel-locked logo integration is blocked until the approved transparent MAZETTO FOOD logo asset is supplied.
- Pixel-locked screenshot comparison QA is blocked until the approved reference screenshots are attached as actual image files.
- Complete Telegram customer ordering must be implemented through a small shared order application layer or facade. Directly injecting `CustomersService` into `TelegramModule` would create a module dependency cycle because `CustomersModule` already imports `TelegramModule` for verification-code delivery.

## Master Pixel-Lock Customer-Web Pass

Status: In progress locally, Pass 2 visual and Telegram ordering code validated locally

Date: 2026-08-28

Completed in this pass:

- Verified the approved reference pack now exists in `docs/design/references/`.
- Verified reference dimensions:
  - logo master: 4096x1791 RGBA
  - logo web 2048: 2048x895 RGBA
  - logo web 1024: 1024x448 RGBA
  - Home/Menu/Product/Cart-Checkout/Profile-Orders references: 941x1672 RGB each
- Copied the approved web logo into `apps/customer-web/public/brand/mazetto-food-logo.webp`.
- Added a reusable customer-web `BrandLogo` component using the real transparent logo asset.
- Replaced customer header and first-visit splash plain text branding with the approved logo image.
- Moved Home toward the reference structure: ivory hero panel, petrol-teal visual shell, yellow CTA, compact branch block, and real-data sections.
- Moved Menu/product cards toward the reference structure: teal compact cards, yellow price/action emphasis, 2-column mobile grid, sticky category strip, and real product data.
- Moved Product Detail toward the reference structure: branded top, ivory configuration surface, compact variants/modifiers, yellow add-to-cart CTA, and full menu continuation.
- Moved Cart/Checkout/Success toward the reference structure: ivory cart/checkout cards, compact rows, teal/yellow accents, and branded success surface.
- Moved Profile/Orders toward the reference structure: compact ivory profile/order cards with teal status and real customer/order API data.
- Fixed a 390px menu horizontal overflow regression caused by category-strip sizing.
- Completed Pass 2 interaction hardening for sticky category navigation, inline cart controls, search clear behavior, and fixed bottom navigation stability.
- Extracted the authoritative customer order creation path into `CustomerOrderEngineService`.
- Added Telegram customer ordering support using persistent `Cart`/`CartItem` storage and the shared order engine.
- Telegram customer ordering now supports category/product browsing, variant add, modifier toggle, quantity changes, cart view, checkout summary, CASH pickup confirmation, idempotent stale-confirm protection, and shared website/Telegram order history identity.
- Added `scripts/validate-telegram-customer-ordering.ts` for the Telegram cart/order regression path.
- Completed the Telegram delivery/address checkout gap locally:
  - added durable `TelegramCheckoutSession` storage for order type, branch, address, note, and checkout step
  - Telegram checkout now supports branch-aware PICKUP and DELIVERY selection
  - delivery checkout collects and validates Telegram-native address text
  - optional courier note is supported through the existing order notes field
  - final Telegram confirmation reuses `CustomerOrderEngineService` with `OrderSource.TELEGRAM`
  - confirmed Telegram pickup remains cash-only and does not expose fake Click/Payme success
  - duplicate/stale confirm remains idempotent and does not create a second order

Local validation:

- `pnpm --filter customer-web typecheck`: passed.
- `pnpm --filter customer-web lint`: passed.
- `pnpm --filter customer-web build`: passed repeatedly after each section pass.
- `pnpm --filter backend typecheck`: passed.
- `pnpm --filter backend lint`: passed.
- `pnpm --filter backend build`: passed.
- `pnpm --dir apps/backend exec tsx scripts/validate-telegram-customer-auth.ts`: passed.
- `pnpm --dir apps/backend exec tsx scripts/validate-customer-order-history.ts`: passed.
- `pnpm --dir apps/backend exec tsx scripts/validate-telegram-customer-ordering.ts`: passed, including delivery address, pickup regression, duplicate confirm, and delivery-disabled branch coverage.
- `pnpm --dir apps/backend exec prisma format`: passed with safe placeholder `DATABASE_URL`.
- `pnpm --dir apps/backend exec prisma validate`: passed with safe placeholder `DATABASE_URL`.
- `pnpm --dir apps/backend exec prisma generate`: passed with safe placeholder `DATABASE_URL`.
- `pnpm typecheck`: passed.
- `pnpm lint`: passed.
- `pnpm build`: app tasks completed successfully (`9 successful, 9 total`); the shell session did not exit cleanly and was stopped after successful task output.
- `git diff --check`: passed with line-ending warnings only.

Local browser QA:

- 390px Menu: 35 product cards, sticky category nav present, fixed bottom nav stable, no document horizontal overflow; actual horizontal page scroll stays at 0.
- 390px Product Detail: real production product route loaded, no horizontal overflow, full menu continuation present with 35 product cards.
- 390px Cart, Checkout, Orders: no horizontal overflow, bottom nav stable.
- 1440px Home, Menu, Cart, Profile: no horizontal overflow.
- Screenshot evidence is stored under `.qa-screenshots/pixel-lock-*` and `.qa-screenshots/pass2-*`.
- Completed Step 4 local customer-flow pixel-lock:
  - Cart now uses compact ivory rows, stable quantity controls, real totals, and a golden checkout CTA.
  - Cart upsell uses real menu products only, with no fake recommendations.
  - Checkout keeps the existing order logic, branch state, Telegram auth-in-checkout flow, idempotency key, and Uzbek error handling while adding a compact step visual hierarchy.
  - Order success, Profile, Orders, and Order Detail now use the locked teal/yellow/ivory visual system and real customer/order API shapes.
  - Order success no longer invents an estimated preparation time; it shows real order status, item count, total, branch, and item snapshot data.
  - Step 4 browser QA covered Cart, Checkout, Profile, Orders, Order Detail, and Success at 390, 430, 768, and 1440px.

Known limitations:

- Real product/category media assets are still missing from the media service, so food images render through the branded fallback.
- The customer core flow is visually aligned through Step 4, but final pixel-level refinements may continue in later controlled visual passes.
- Telegram delivery/address checkout is implemented locally with durable conversation state, but it has not been migrated, deployed, or verified in production yet.
- Staff Telegram notification activation remains separate and was not configured in this pass.

Still remaining in this master phase:

- Continue side-by-side polish against actual reference images where visual deviations remain.
- Apply and verify the new Telegram checkout-session migration only during an approved controlled production release.
- Add real Click/Payme Telegram payment flows only after provider integration is implemented; do not fake online payment success.
- Prove checkout and order E2E with exactly one controlled production test order after deployment approval.
- Update production only after local visual QA, validation, backup, commit, and controlled deploy.

1. Customer Web header/theme buglarini tugatish. Status: Done.
2. Bottom nav + Liquid Glass UI. Status: Done.
3. Hero slider / Discount slider / Upsell UI. Status: Done.
4. Real menu and 45 media images. Status: In progress, files missing.
5. Branch system. Status: Sergeli production branch configured, admin UI pending.
6. Customer order E2E. Status: Blocked until validated Telegram verification implementation is deployed and configured.
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
23. Customer Telegram Bot. Status: Partial locally, auth/history/menu/cart/pickup and delivery cash checkout implemented; production migration/deploy/verification pending.
24. Click / Payme. Status: Not started; no fake success flow exposed in Telegram.
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
