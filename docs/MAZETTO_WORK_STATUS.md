# MAZETTO FOOD Work Status

Last updated: 2026-08-31

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
| Customer Web | 🟡 PARTIAL / RISK | Main routes, cart, checkout, profile, orders, premium mobile UI, payment honesty, and visual contrast fixes are deployed; remaining work is broader product completeness and future payment UX. |
| Media Service | 🟡 PARTIAL / RISK | nginx service, volume, and approved uploaded media work; several authentic product assets remain unresolved. |
| Telegram Staff Notifications | 🟡 PARTIAL / RISK | Backend notification reliability hotfix is deployed; human Telegram lifecycle and web-order staff smoke remain pending. |
| Customer Telegram Bot | 🟡 PARTIAL / RISK | Customer Telegram auth/order UX is deployed and real Telegram orders were verified; staff-side lifecycle activation remains separate. |
| MAZETTO Desktop | ❌ NOT IMPLEMENTED | Will contain POS, Desktop Admin, offline SQLite, sync engine, and printer engine. |
| Admin Panel | 🟡 PARTIAL / RISK | POS-web local Admin Core now has protected dashboard, products, categories, and branch-status screens; full admin business coverage and production release are still pending. |
| Payment Integrations | ❌ NOT IMPLEMENTED | Click/Payme real provider integrations are later-stage work. |

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

### Full Repository Code Audit - 2026-08-29

Status: Completed locally, production untouched

Evidence document:

```text
docs/MAZETTO_FULL_CODE_AUDIT.md
```

Audit result:

- ✅ VERIFIED: production MVP architecture is preserved; backend/customer-web/media infrastructure are active.
- ✅ VERIFIED: customer order item pricing is calculated from backend database state, not client-supplied line totals.
- ✅ VERIFIED: customer order history/detail routes are scoped by authenticated `customerId`.
- ✅ VERIFIED: Telegram contact linking validates Telegram contact ownership.
- 🟡 PARTIAL / RISK: customer-web displays a 12 000 so'm delivery fee, but backend customer order totals currently persist item subtotal only.
- 🟡 PARTIAL / RISK: customer checkout shows Click, Payme, and Card options before real provider settlement exists.
- ✅ VERIFIED LOCALLY: Uzbek phone normalization now uses one canonical backend helper and stores customer phones as `+998XXXXXXXXX`.
- 🟡 PARTIAL / RISK: Telegram category product listing is capped at 8 products without pagination.
- 🟡 PARTIAL / RISK: Telegram cart quick-add creates separate identical cart rows instead of merging quantity.
- 🟡 PARTIAL / RISK: production direct media URLs still 404 until real media files are uploaded into the `mazetto-media` volume.

Recommended next fix phase:

```text
Fix delivery-fee source of truth and public checkout payment honesty before the next production release.
```

### Step 11 - Audit P1 Remediation

Status: Local implementation complete, not deployed

Scope:

- AUD-001 delivery-fee source of truth.
- AUD-002 customer payment UX honesty.

Evidence:

- ✅ VERIFIED: no schema migration was required because `Order.deliveryFeeTotal` already exists.
- ✅ VERIFIED: backend `CustomerOrderEngineService` now owns customer checkout quote and final order pricing.
- ✅ VERIFIED: because no branch/settings delivery-fee value exists yet, the current authoritative customer delivery fee remains `0.00`; this preserves the verified production DELIVERY + CASH order behavior and avoids inventing a new fee amount.
- ✅ VERIFIED: new orders persist `deliveryFeeTotal` from the backend policy and calculate `total = subtotal + deliveryFeeTotal`.
- ✅ VERIFIED: customer-web checkout no longer uses the old hardcoded `12000` delivery fee.
- ✅ VERIFIED: customer-web checkout shows only the operational `CASH` payment option.
- ✅ VERIFIED: backend rejects unsupported customer checkout methods such as `CLICK`, `PAYME`, and `CARD` until real provider/terminal settlement is implemented.
- ✅ VERIFIED: Telegram checkout summary uses the same backend quote path as web checkout.

Remaining:

- Production still runs the previous deployed release until Step 11 is explicitly pushed and deployed.
- A real non-zero delivery fee still requires an owner-approved backend/branch setting in a later phase.

### Step 12 - Data Integrity P2 Remediation

Status: Local implementation complete, not deployed

Scope:

- AUD-003 customer phone normalization.
- AUD-004 stale pending customer order attempt recovery.

Evidence:

- ✅ VERIFIED: customer phone identity now uses one shared backend normalizer.
- ✅ VERIFIED: canonical persisted customer phone format is `+998XXXXXXXXX`.
- ✅ VERIFIED: equivalent inputs such as `+998901234567`, `998901234567`, `90 123 45 67`, `+998 (90) 123-45-67`, and `00998901234567` normalize to the same identity.
- ✅ VERIFIED: Telegram contact linking uses the same normalizer and still validates `contact.user_id === message.from.id`.
- ✅ VERIFIED: isolated DB validation proves equivalent phone formats do not create duplicate customer rows.
- ✅ VERIFIED: isolated DB validation proves concurrent equivalent Telegram contact linking leaves one customer row.
- ✅ VERIFIED: completed idempotency retry still returns the existing logical order.
- ✅ VERIFIED: `PENDING` attempt with an existing `CustomerOrder` is repaired/reused and does not create a duplicate order.
- ✅ VERIFIED: stale `PENDING` attempt without an order can be retried safely.
- ✅ VERIFIED: active `PENDING` attempt still rejects without creating duplicate `Order`, `CustomerOrder`, or `KitchenTicket` rows.

Remaining:

- Production still runs the previous deployed release until Step 11 and Step 12 are explicitly pushed and deployed.
- Legacy production duplicate-phone preflight should be run read-only before deployment if production contains customer rows.

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
products/chicken-burger-canonical.webp
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
products/set-lavash-canonical.webp
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
6. Customer order E2E. Status: Production release and one real Telegram DELIVERY + CASH customer order verified.
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
23. Customer Telegram Bot. Status: Production auth/order path verified with one real Telegram DELIVERY + CASH order; Step 10 UX polish is local only until the next controlled release.
24. Click / Payme. Status: Not started; no fake success flow exposed in Telegram.
25. Security. Status: Not started.
26. Backup / Monitoring. Status: Not started.
27. Full E2E / Production QA. Status: Not started.

## Step 8 - Isolated PostgreSQL Order Engine E2E Proof

Status: Completed locally against isolated PostgreSQL; no production changes

Date: 2026-08-29

Safety boundary:

- No push, deployment, production database access, production Telegram webhook change, production customer, or production order was performed.
- The E2E database was a temporary local Docker PostgreSQL 18 container exposed only on localhost.
- The DB-backed validator refuses to run unless `MAZETTO_E2E_ISOLATED_DB=1` is set and `DATABASE_URL` points to a localhost database whose name includes `step8`.

Completed:

- Started temporary PostgreSQL 18.6 container `mazetto-step8-postgres-temp` with database `mazetto_step8_e2e`.
- Applied the full Prisma migration chain from zero using `prisma migrate deploy`.
- Verified 16 applied migrations and 0 rolled-back migrations with `prisma migrate status` reporting the schema is up to date.
- Ran the normal repository seed against the temporary database only.
- Seeded counts after seed: 0 branches, 10 categories, 35 products, 44 variants, 8 modifiers, 6 roles, 39 permissions, and 7 payment methods.
- Added `apps/backend/scripts/validate-customer-order-e2e-db.ts` as a guarded DB-backed integration validator.
- The validator created synthetic local-only customers and a synthetic local-only branch/warehouse fixture.
- Proved WEB order creation through `CustomerOrderEngineService` using real seeded product, variant, modifier, server-side pricing, customer order attempt idempotency, order item snapshot, order history, and KitchenTicket creation.
- Proved WEB idempotent retry returns without creating a duplicate order graph.
- Proved Telegram persistent cart and modifier/quantity state using real `Cart` and `CartItem` rows.
- Proved Telegram checkout state persistence using `TelegramCheckoutSession`.
- Proved Telegram order creation through `TelegramCustomerOrderingService` and the shared `CustomerOrderEngineService` with `OrderSource.TELEGRAM`.
- Proved stale Telegram confirm does not create a duplicate order.
- Proved near-simultaneous Telegram double confirm creates one logical order and one KitchenTicket.
- Proved successful Telegram order clears cart items and checkout session.
- Proved invalid modifier rollback leaves no partial order graph.
- Proved web and Telegram orders appear in the same customer order history model, and another customer cannot read the order detail.

Isolated DB proof counts after validator:

```text
orders_total=3
web_orders=1
telegram_orders=2
customer_orders=3
customer_order_attempts=3
order_items=3
order_status_history=6
kitchen_tickets=3
cart_items_remaining=0
telegram_checkout_sessions_remaining=0
```

Validation:

- `pnpm --dir apps/backend exec prisma migrate deploy`: passed against isolated PostgreSQL 18.
- `pnpm --dir apps/backend exec prisma migrate status`: passed, schema up to date.
- `pnpm --dir apps/backend exec prisma db seed`: passed against isolated PostgreSQL 18.
- `pnpm --dir apps/backend exec tsx scripts/validate-customer-order-e2e-db.ts`: passed.

Notes:

- The first PostgreSQL 18 container attempt failed because PostgreSQL 18 Docker images require mounting at `/var/lib/postgresql`, not `/var/lib/postgresql/data`; the failed temporary container and volume were removed and recreated correctly.
- During the concurrent-confirm validation, `pg` printed a deprecation warning about overlapping client queries. The validation still passed and did not create duplicate order graphs. This warning is limited to the stress-style validator path and should be watched if similar concurrency appears in application-level tests.
- Production order E2E was later performed and verified in Step 9B with one real human Telegram DELIVERY + CASH order.

## Step 9B - Production Single Order Read-Only Verification

Status: Completed; production release and one real customer order verified

Date: 2026-08-29

Safety boundary:

- Verification was read-only against production data.
- No production order, customer, status, migration, seed, deploy, webhook, Cloudflare, Click/Payme, or staff Telegram change was performed.
- No sensitive customer phone, Telegram ID, token, webhook secret, JWT, or database URL was recorded.

Verified production release:

- Local HEAD and `origin/main`: `d3ba37de2e458a473af73d543049f097ce2ebdb4`.
- Backend image: `mazetto-food-backend-pdslpm:d3ba37d`.
- Customer-web image: `mazetto-food-customerweb-yvb3d0:d3ba37d`.
- Backend health returned 200.
- Customer-web returned 200.
- Production services were `1/1`.
- Production migrations remained at 16 applied and 0 failed.

Verified real order:

- Order number: `TG-20260829-171504-2213`.
- Channel/source: `TELEGRAM`.
- Order type: `DELIVERY`.
- Payment: `CASH`.
- Payment status: `PENDING`; no Click/Payme successful payment was recorded.
- Branch: `MAZETTO Sergeli`.
- Status history: `NEW` then `CONFIRMED`.
- Total: `68 000 so'm`, matching the persisted item subtotal and authoritative order total.
- Item snapshot: `2 x Mol go'shtli lavash`, variant `Standart`, unit price `34 000`, line total `68 000`, no modifiers.

DB proof:

- `orders = 1`.
- `customer_orders = 1`.
- `customer_order_attempts = 1`, completed.
- `kitchen_tickets = 1`.
- Duplicate logical orders: 0.
- The order remained attached to the same customer identity; no duplicate customer row was created for the linked person.
- Cart cleanup succeeded for the ordering customer: 0 remaining cart items.
- Customer-web and Telegram use the same shared `customer_orders`/`orders` history model.

Operational proof:

- Telegram webhook remained healthy: host `api.mazettofood.uz`, pending updates 0, last error absent.
- Backend log review around the order time found no 500, Prisma error, duplicate-order error, transaction failure, or Telegram callback failure.
- Customer-web read-only smoke passed for `/`, `/menu`, `/orders`, and `/profile`.

Remaining:

- Click/Payme are not complete and must not be presented as real successful online payments.
- Staff Telegram activation remains separate.
- Authentic production media files remain incomplete and direct media URLs still need a separate media-volume fix.

## Step 10 - Telegram Customer Ordering UX Polish

Status: Deployed and smoke-verified in production

Date: 2026-08-29

Scope:

- Telegram customer presentation and navigation polish only.
- No production deployment, production DB write, migration, webhook change, Click/Payme integration, or staff Telegram activation.

Completed locally:

- Telegram menu groups `Lavash` and `Tovuqli lavash` into one virtual `Lavash` family.
- Telegram menu groups `Burgerlar` and `Tovuqli burgerlar` into one virtual `Burger` family.
- Family selection uses real catalog targets only: size -> meat -> qty 1 cart add.
- Unsupported combinations are not shown.
- Quick-add success uses callback notification instead of a new chat bubble.
- After quick-add, the bot returns to the main interactive menu.
- The main Telegram customer screens now prefer editing the existing interactive message and fall back to one replacement message if editing is impossible.
- Branch screen uses real branch coordinates for the map button when coordinates exist.
- The existing persistent cart, checkout session, CASH payment, DELIVERY/PICKUP, shared order engine, and customer history architecture were preserved.

Catalog mapping:

- `Lavash / Mini / Mol go'shti` -> `Mini lavash` / `Standart`.
- `Lavash / Original / Mol go'shti` -> `Mol go'shtli lavash` / `Standart`.
- `Lavash / Original / Tovuq` -> `Tovuqli lavash` / `Standart`.
- `Lavash / Max / Mol go'shti` -> `Katta lavash` / `Standart`.
- `Burger / Original / Mol go'shti` -> `Klassik burger` / `Standart`.
- `Burger / Original / Tovuq` -> `Tovuqli burger` / `Standart`.
- `Burger / Max / Mol go'shti` -> `Katta burger` / `Standart`.
- `Burger / Max / Tovuq` -> `Qarsildoq tovuqli burger` / `Standart`.

Unsupported combinations intentionally hidden:

- `Lavash / Mini / Tovuq`.
- `Burger / Mini / Mol go'shti`.
- `Burger / Mini / Tovuq`.

Validation:

- `pnpm --dir apps/backend exec tsx scripts/validate-telegram-catalog-mapping.ts`: passed.
- `pnpm --dir apps/backend exec tsx scripts/validate-telegram-customer-ordering.ts`: passed.
- `pnpm --dir apps/backend exec tsx scripts/validate-telegram-customer-auth.ts`: passed.
- `pnpm --dir apps/backend exec tsx scripts/validate-customer-order-history.ts`: passed.
- Prisma format, validate, and generate passed locally with a safe placeholder database URL.
- Backend typecheck, lint, and build passed.
- Workspace typecheck and lint passed.
- Workspace build completed all app tasks successfully; the shell session was stopped after the known post-success hang.

## Step 13 - Remaining P2 Release Readiness Remediation

Status: Completed locally; not deployed

Date: 2026-08-30

Scope:

- Resolved only AUD-006, AUD-007, AUD-009 readiness, and AUD-010.
- No production deployment, production database write, production media volume write, Telegram webhook change, Cloudflare change, Click/Payme activation, staff Telegram activation, or push was performed.

Completed locally:

- Telegram category product listing now supports compact pagination for categories with more than the Telegram page-size products.
- Telegram menu page size is a named constant: `TELEGRAM_MENU_PAGE_SIZE = 8`.
- Pagination callback data uses `cust:cat:<categoryId>:<page>` and invalid page values fall back safely to page 1.
- Stable ordering remains `sortOrder asc, name asc`.
- Step 10 virtual `Lavash` and `Burger` family grouping remains unchanged and is not paginated as normal duplicated categories.
- Telegram quick-add now merges equivalent plain cart lines instead of creating duplicate equivalent `CartItem` rows.
- Cart-line equivalence for this merge is: same cart, same product, same variant, no notes, and no selected modifiers.
- Different products, variants, or modified cart lines remain separate.
- The quick-add merge uses a PostgreSQL advisory transaction lock and did not require a schema migration.
- Media release readiness now has a deterministic local asset manifest, validator, and dry-run-first copy script for the future controlled production media-volume population.
- Media nginx root remains `/media`; expected public paths map to `/media/categories/*` and `/media/products/*`.
- Available local media for release: 10 category assets and 27 product assets.
- Unresolved product media remains 8 assets: `chicken-strips`, `coca-cola`, `fanta`, `sprite`, `water`, `house-sauce`, `spicy-sauce`, and `set-kids`.
- `prisma:migrate` is now production-safe and runs `prisma migrate deploy`.
- Explicit migration scripts now separate release and development usage: `prisma:migrate:deploy` and `prisma:migrate:dev`.

Validation added/updated:

- `validate-telegram-customer-ordering.ts` now proves category pagination, next/previous navigation, invalid page fallback, no product omissions/duplicates, quick-add merge, quick-add callback toast, main-menu return, and cart quantity controls preserved.
- `validate-customer-order-e2e-db.ts` now proves Telegram quick-add merge against a real PostgreSQL transaction path, including concurrent equivalent quick-adds, modified-line separation, and different product separation.
- `media:validate` verifies nginx root, all available local media sources, filename/path shape, 10 category assets, 27 product assets, 8 known unresolved assets, and release file count.
- `media:prepare` defaults to dry-run and reports every source/destination path without copying files.

Release note:

- Production still runs the older released revision until the full local release chain is pushed and deployed through a controlled release.
- The production media volume is still expected to be empty until the controlled media population step is executed.

## Step 14 - Controlled Production Release

Status: Completed and verified in production

Date: 2026-08-30

Released revision:

- Commit: `568b6ac121e953cea6a06c108e9b3f43949849d8`
- Backend image: `mazetto-food-backend-pdslpm:568b6ac`
- Customer-web image: `mazetto-food-customerweb-yvb3d0:568b6ac`
- Media service image remained `mazetto-food-media-btinws:latest`; media content was populated through the persistent `mazetto-media` Docker volume.

Backup:

- PostgreSQL backup path: `/home/javohir/backups/mazetto/postgres/mazetto-step14-pre-release-20260830-040100.dump`
- Backup was non-empty and verified with `pg_restore --list`.
- Media volume pre-population backup path: `/home/javohir/backups/mazetto/media/mazetto-media-step14-pre-populate-20260830-040606.tar.gz`

Preflight:

- Backend, customer-web, media, and PostgreSQL services were `1/1`.
- Public backend health returned 200.
- Customer-web home and menu returned 200.
- Customer API smoke returned 1 branch, 10 categories, and 35 products.
- Production migrations were `16 applied / 0 failed`.
- Production phone-normalization collision detector found 0 canonical collision groups.
- Required backend ENV names were present without printing values.

Release actions:

- Approved local chain was pushed to `origin/main`.
- Backend was updated to `mazetto-food-backend-pdslpm:568b6ac`.
- Customer-web was updated to `mazetto-food-customerweb-yvb3d0:568b6ac`.
- No production migration was executed because repository and production migration counts were already both 16.
- Media volume was populated with the deterministic Step 13 script through Docker volume mount.

Post-release verification:

- Backend service converged to `1/1` and health returned 200.
- Backend customer API smoke returned 1 branch, 10 categories, and 35 products.
- Customer-web service converged to `1/1`.
- Customer-web routes `/`, `/menu`, `/cart`, `/checkout`, `/orders`, and `/profile` returned 200.
- Media service remained `1/1`.
- Media public checks:
  - `/categories/lavash.webp` returned 200.
  - `/products/lavash-big.webp` returned 200.
  - `/products/cheese-fries.webp` returned 200.
  - known unresolved `/products/chicken-strips.webp` remained 404 as expected and should use the customer-web fallback.
- Telegram webhook health was verified after release: host `api.mazettofood.uz`, pending updates 0, last error absent.
- Release-window backend/customer-web logs showed no startup error, Prisma error, unique constraint failure, or Telegram callback failure.

Important limitation:

- Automated Telegram interactive UX smoke was not forced against a real customer chat, because sending synthetic callbacks to an existing user could spam a real Telegram chat and creating a new production customer/cart solely for smoke would be an unnecessary production DB write. Webhook health and deployed code evidence are verified; human Telegram UX smoke remains the next safe manual check.

Deployed local fixes:

- Step 10 Telegram customer UX polish is now deployed.
- Step 11 authoritative delivery pricing and CASH-only customer payment honesty are now deployed.
- Step 12 customer phone normalization and idempotency recovery are now deployed.
- Step 13 Telegram pagination, Telegram cart merge, media release readiness, and safe Prisma migration script are now deployed.

Still not complete:

- Click/Payme provider integrations.
- Staff Telegram production activation.
- Eight unresolved authentic media assets.
- AUD-005 number collision retry.
- AUD-008 websocket refetch scope.
- AUD-011 warehouse readiness.
- AUD-012 httpOnly refresh-token hardening.

## Step 14C - Production Telegram Checkout Regression Root Cause

Status: Fixed locally; deployed and verified in Step 14D

Date: 2026-08-30

Scope:

- Focused only on the Telegram checkout regression discovered during human production smoke.
- No production deployment, production database write, production order, migration, seed, webhook change, Cloudflare change, Click/Payme activation, staff Telegram activation, or push was performed.

Observed production behavior:

- A linked Telegram customer reached DELIVERY checkout.
- After entering an address and pressing `O'tkazib yuborish` for courier note, the bot sent:
  `Telefon raqamni bog'lashda xatolik bo'ldi. Iltimos, /start bosib qayta urinib ko'ring.`

Root cause:

- Production logs showed the underlying application error was `Branch is not accepting orders now`.
- The smoke happened before MAZETTO Sergeli opening time; the branch API also reported `isOpen: false` and `acceptsOrders: false`.
- The order engine correctly blocked checkout while the branch was closed.
- The regression was in `TelegramCustomerAuthService.handleWebhookUpdate`: every caught customer callback/message error was converted into the generic phone-linking auth error unless it came from a contact message.

Local fix:

- Telegram contact-link errors still use the existing phone-linking error path.
- Non-contact customer interactions, including Telegram ordering callbacks such as `cust:note:skip`, now send operation-specific Uzbek error messages.
- `Branch is not accepting orders now` now becomes:
  `Filial hozir buyurtma qabul qilmayapti. Iltimos, ish vaqtida qayta urinib ko'ring.`
- Delivery-disabled, pickup-disabled, and missing-branch cases also receive order-specific messages.

Validation:

- `pnpm --dir apps/backend exec tsx scripts/validate-telegram-customer-auth.ts`: passed and now covers ordering callback errors not being converted into auth errors.
- `pnpm --dir apps/backend exec tsx scripts/validate-telegram-customer-ordering.ts`: passed and still covers delivery address, note skip, checkout summary, pickup, quick-add, pagination, and cart behavior.

Production note:

- Production now runs backend release `73d7407`; the Step 14C fix was deployed and verified in Step 14D.

## Step 14D - Focused Telegram Error Message Fix Deploy

Status: Completed; backend fix deployed and accidental real Telegram order verified

Date: 2026-08-30

Released backend revision:

- Commit: `73d74073f5bf595eb6f0c6eb3bc4d2b52078be44`
- Backend image: `mazetto-food-backend-pdslpm:73d7407`
- Customer-web image remained `mazetto-food-customerweb-yvb3d0:568b6ac`

Scope:

- Focused backend-only release for Telegram checkout error-message handling.
- No customer-web deploy, database migration, seed, Cloudflare change, webhook reset, Click/Payme activation, staff Telegram activation, order deletion, cancellation, or status mutation was performed.

Local validation before deploy:

- `validate-telegram-customer-auth.ts`: passed.
- `validate-telegram-customer-ordering.ts`: passed.
- `validate-telegram-catalog-mapping.ts`: passed.
- `prisma validate`: passed.
- Backend typecheck, lint, and build: passed.
- `git diff --check`: passed.

Production deploy verification:

- Backend service converged to `1/1`.
- Backend health returned 200.
- Telegram webhook remained healthy: host `api.mazettofood.uz`, pending updates 0, last error absent.
- Production branch `MAZETTO Sergeli` was open and accepting orders at smoke time.

Human smoke result:

- The linked Telegram customer flow reached checkout successfully after the fix.
- The previous wrong phone-linking error was not reproduced.
- The human tester accidentally pressed final confirmation, creating one real production Telegram order.
- The order was not deleted, cancelled, or mutated; it was treated as a valid production E2E proof.

Verified accidental order:

- Order number: `TG-20260830-053906-3786`.
- Source: `TELEGRAM`.
- Operational order type: `TAKEAWAY`.
- Customer order type: `PICKUP`.
- Payment method: `CASH`.
- Payment status: `PENDING`.
- Payment rows for the order: 0; no Click/Payme/Card provider success was recorded.
- Branch: `MAZETTO Sergeli`.
- Total: `97 000 so'm`, matching persisted item subtotal.

Order item proof:

- `1 x Katta lavash`, variant `Standart`, unit `36 000`, line total `36 000`, no modifiers.
- `1 x Klassik burger`, variant `Standart`, unit `29 000`, line total `29 000`, no modifiers.
- `1 x Doner lavash`, variant `Standart`, unit `32 000`, line total `32 000`, no modifiers.

DB graph proof:

- For order `TG-20260830-053906-3786`: `Order = 1`, `CustomerOrder = 1`, `CustomerOrderAttempt = 1 COMPLETED`, `OrderItem = 3`, `OrderStatusHistory = 2`, `KitchenTicket = 1`.
- Duplicate logical order count for the order number: 1.
- Status history: `NEW`, then `CONFIRMED`.
- Kitchen ticket: one ticket, status `NEW`.
- Customer duplicate check for the ordering phone: 1 customer row.

Production counts after accidental order:

- Customers: 2.
- Orders: 2.
- Customer orders: 2.
- Customer order attempts: 2.
- Kitchen tickets: 2.

Cart/session state:

- Checkout session count for the ordering customer after order: 1.
- Cart items created before the order time for the ordering customer: 0.
- One cart item existed after the order time, created 16 seconds after the order; this is post-order cart activity, not evidence that the submitted cart failed to clear.

Backend log review:

- Release and order-window logs showed no 500, Prisma error, Telegram callback failure, duplicate-order error, or transaction failure.
- Only a non-blocking Node deprecation warning was visible.

Remaining:

- Click/Payme provider integrations remain incomplete and must not be treated as successful online payments.
- Staff Telegram production activation remains separate.
- Eight authentic product media assets remain unresolved.
- AUD-005, AUD-008, AUD-011, and AUD-012 remain open.

## Step 15 - Post-Order State Cleanup Audit

Status: Cleanup bug fixed and deployed

Date: 2026-08-30

Scope:

- Audited the post-order Telegram cart/session state after accidental production order `TG-20260830-053906-3786`.
- Production inspection was read-only.
- No production order, customer, cart, checkout session, database row, migration, seed, deployment, webhook, Cloudflare, Click/Payme, or staff Telegram change was performed.

Production observation:

- The submitted cart for `TG-20260830-053906-3786` was cleared before/at order creation time.
- A cart item appeared 16 seconds after the order was created.
- A Telegram checkout session was also created/updated after the order was created.
- The remaining cart/session state therefore came from post-order user interaction, not from failed cleanup of the submitted order.

Code lifecycle evidence:

- Successful Telegram confirmation calls `CustomerOrderEngineService.createOnlineOrder`.
- After success, Telegram ordering deletes all cart items for the submitted cart and clears the `TelegramCheckoutSession` for the same customer/chat.
- `/start` and inline main-menu navigation do not create orders.
- `startCheckout` resets branch/order type/address/note before a new checkout flow.

Bug found during isolated DB reproduction:

- Telegram order idempotency key used `customerId + cartId + cart.updatedAt`.
- PostgreSQL/Prisma did not update the parent `Cart.updatedAt` when a new `CartItem` was inserted into the existing cart after a successful order.
- A second post-success checkout could therefore reuse the previous idempotency key with a different payload and fail with `Idempotency key was already used with a different checkout request`.

Local fix:

- Telegram confirmation idempotency keys now include a stable SHA-256 fingerprint of the actual checkout state:
  customer, cart id, branch, order type, address, note, cart item ids, product/variant ids, quantity, modifiers, item notes, and item timestamps when available.
- Same-payload concurrent/retry confirms still share the same key.
- New cart contents after a successful order produce a new key even when the same empty cart row is reused.
- No `CustomerOrderEngineService` pricing/order persistence logic was changed.

Validation:

- Fresh isolated local PostgreSQL database `mazetto_step8_step15_e2e` was created, migrated through all 16 migrations, seeded, and used for DB-backed E2E validation.
- DB-backed validation proved cart cleanup, checkout session cleanup, stale confirm no-duplicate behavior, post-success second-order behavior, no stale address/note leakage, and no duplicate KitchenTicket.
- `validate-customer-order-e2e-db.ts`: passed.
- `validate-telegram-customer-ordering.ts`: passed.
- `validate-telegram-customer-auth.ts`: passed.
- `validate-customer-order-history.ts`: passed.
- Prisma format, validate, and generate passed.
- Backend typecheck, lint, and build passed.
- Customer-web typecheck, lint, and build passed.
- Workspace typecheck and lint passed.
- Workspace build reported all 9 tasks successful; the known Turbo post-success non-exit required manually stopping the runner.

Production note:

- Controlled backend-only production release completed after local validation.
- Backend service now runs image `mazetto-food-backend-pdslpm:b875f54`.
- Customer-web remained unchanged on image `mazetto-food-customerweb-yvb3d0:568b6ac`.
- Production health remained 200 after deploy; Telegram webhook remained healthy with no pending updates or last error.
- Order graph counts remained unchanged during the deploy verification at `orders=3`, `customer_orders=3`, `customer_order_attempts=3`, `kitchen_tickets=3`.
- No migration, seed, frontend deploy, Cloudflare change, webhook reset, Click/Payme activation, staff Telegram activation, or production order creation was performed.

## Customer Web Visual QA - Contrast and Branch Selector Fix

Status: Completed locally; not deployed

Date: 2026-08-30

Scope:

- Fixed customer-web visual contrast regressions only.
- Backend, database, API contracts, order engine, Telegram, Cloudflare, Dokploy, production data, and production services were not changed.
- Production customer-web was deployed separately from the approved frontend-only visual fix commit.
- Backend, database, Telegram, Cloudflare, Click/Payme, staff Telegram, and production order data were not changed.

Root cause:

- Several ivory/light customer surfaces reused dark-theme utility classes such as `text-white`, `text-white/60`, and bright cyan accent text.
- The branch picker trigger reused the shared input/glass styling while its inner text remained white, causing unreadable text on light surfaces.
- The desktop top navigation relied on translucent glass buttons whose inactive state could lose contrast against the locked MAZETTO shell.
- Product detail media used the same Framer Motion `layoutId` as product cards in the full menu continuation, so duplicate layout ids on the same page could make the hero product image animate away and remain invisible.

Local fixes:

- Added scoped light-surface contrast hardening for `mf-card`, `mf-card-soft`, and checkout card content.
- Reworked the customer branch picker visual layer into a dedicated premium light selector and menu while preserving existing branch logic.
- Added a high-contrast desktop top-navigation button state.
- Recolored customer auth, cart, checkout, orders, order detail, profile, and menu microcopy where text sat on ivory/light surfaces.
- Fixed product detail image visibility by giving the detail hero a unique layout id and using contain-fit media presentation.

Local QA evidence:

- Browser visual QA screenshots were captured under `.qa-screenshots/` for home, menu, cart, checkout auth state, profile, and orders at 390, 768, and 1440px.
- Branch picker open state was visually checked at 390px.
- Product detail media visibility was checked for `Katta lavash` and `Pishloqli sous` at 390px.
- Checked document-level horizontal overflow on tested customer routes; no page-level horizontal overflow was found.
- The remaining horizontal overflow candidates were contained category/product scrollers, not body/header overflow.

Validation:

- `pnpm --filter customer-web typecheck`: passed.
- `pnpm --filter customer-web lint`: passed.
- `pnpm --filter customer-web build`: passed.
- `pnpm typecheck`: passed.
- `pnpm lint`: passed.
- `pnpm build`: all 9 Turbo build tasks reported successful; the known post-success Turbo session hang required manually stopping the runner after success was printed.
- `git diff --check`: passed with existing CRLF/LF working-copy warnings only; no whitespace errors.

Production deployment:

- Previous customer-web image: `mazetto-food-customerweb-yvb3d0:568b6ac`.
- New customer-web image: `mazetto-food-customerweb-yvb3d0:48375b2`.
- Backend remained unchanged on `mazetto-food-backend-pdslpm:b875f54`.
- Production services after deploy: backend `1/1`, customer-web `1/1`, media `1/1`, PostgreSQL `1/1`.
- Public checks after deploy returned 200 for `/`, `/menu`, `/cart`, `/checkout`, `/orders`, and `/profile`.
- Backend health remained 200.

Production visual smoke:

- Home, Menu, Cart, Checkout, Orders, Profile, Katta lavash product detail, and Pishloqli sous product detail were checked at 390, 768, and 1440px.
- Desktop header links `Menyu`, `Buyurtmalar`, `Profil`, and cart amount were readable.
- Menu hero heading, subtitle, search input, and category pills were readable.
- Auth/profile/checkout input text and buttons were readable on light surfaces.
- Branch picker was verified as a custom premium selector, not native select, with `MAZETTO Sergeli` and `Sergeli 7/3` visible.
- Product detail variant buttons, quantity controls, and `Savatchaga qo'shish` CTA were readable.
- Katta lavash and Pishloqli sous product images rendered visibly; the Framer Motion duplicate-layout-id disappearance was not reproduced.
- No page-level horizontal overflow was found on tested routes after the UI settled.
- Search, category navigation, product detail opening, variant/quantity controls, add-to-cart, cart display, branch picker opening, auth inputs, and Orders/Profile navigation were smoke-tested without creating a production order.
- Representative media URLs returned 200: `/categories/lavash.webp`, `/products/lavash-big.webp`, and `/products/cheese-fries.webp`.

## Step 16 - Staff Telegram + Kitchen Order Lifecycle

Status: Completed locally; not deployed

Date: 2026-08-30

Scope:

- Implemented local backend-only staff Telegram lifecycle hardening.
- No production deploy, production database write, production webhook change, Cloudflare change, Click/Payme activation, customer media change, push, or production order creation was performed.
- No Prisma schema or migration change was required.

Local implementation:

- Staff order callback payloads now use action-based commands: `accept`, `start_preparing`, `mark_ready`, and `cancel`.
- Legacy staff callback statuses such as `CONFIRMED`, `PREPARING`, `READY`, and `CANCELLED` are still accepted and translated safely for old messages.
- Staff callbacks are accepted only from `TELEGRAM_STAFF_CHAT_ID`.
- Staff order lifecycle is server-authoritative:
  - `NEW` or already-confirmed order with new kitchen ticket -> `CONFIRMED` / `ACCEPTED`
  - `CONFIRMED` / `ACCEPTED` -> `PREPARING` / `COOKING`
  - `PREPARING` / `COOKING` -> `READY` / `READY`
  - valid pre-ready cancellation -> `CANCELLED` / `CANCELLED`
- Invalid, stale, duplicate, unauthorized, and terminal-state callbacks do not mutate order state.
- `OrderStatusHistory` is written only when the operational order status actually changes.
- Staff Telegram messages are edited in place when possible; harmless edit failures fall back to one replacement staff message.
- Staff buttons are reduced to the next valid actions for the current order/ticket state.
- Linked customers receive Telegram status notifications for accepted, preparing, ready, and cancelled states.
- Customer status notification failure is non-blocking and does not roll back the staff status transition.
- Kitchen websocket status emission still occurs after successful state changes.

Local validation:

- Fresh isolated local PostgreSQL database `mazetto_step16_staff_20260830232546` was created.
- All 16 migrations were applied from zero.
- Seed completed successfully with 35 products and 4 combo sets; no demo users were created.
- `validate-telegram-staff-lifecycle.ts`: passed.
- The staff lifecycle validator proved new order notification buttons, staff chat authorization, accept/preparing/ready flow, cancellation flow, duplicate callback no-op behavior, invalid transition rejection, legacy callback compatibility, concurrent accept idempotency, staff edit fallback, customer notification, and customer-notification failure safety.
- `validate-telegram-customer-auth-db.ts`: passed against the same isolated local database.
- Separate isolated local PostgreSQL database `mazetto_step8_step16_20260830232755` was created for the existing customer order engine validator.
- All 16 migrations and seed were applied to that database.
- `validate-customer-order-e2e-db.ts`: passed.
- `validate-telegram-customer-auth.ts`: passed.
- `validate-telegram-customer-ordering.ts`: passed.
- `validate-telegram-catalog-mapping.ts`: passed.
- `validate-customer-order-history.ts`: passed.
- Prisma format, validate, and generate passed.
- Backend typecheck, lint, and build passed.

Validation warnings:

- DB-backed validators emitted a non-blocking Node/pg deprecation warning during simulated concurrent Prisma activity: `Calling client.query() when the client is already executing a query is deprecated and will be removed in pg@9.0`.
- This did not fail validation, but should be watched before a future pg major-version upgrade.

Remaining:

- Production staff Telegram activation and human staff lifecycle smoke are still pending.
- Click/Payme provider integrations remain incomplete.
- Staff Telegram customer/order notifications are backend-local changes until this commit is released.

## Step 16B - Telegram Customer Order To Staff Notification Release

Status: Backend deployed; human Telegram order smoke pending

Date: 2026-08-31

Scope:

- Released the backend-only fix that triggers staff Telegram notification after a successful Telegram customer order commit.
- No customer-web deployment, database schema change, migration, seed, Cloudflare change, webhook reset, Click/Payme activation, staff callback lifecycle smoke mutation, or artificial production order was performed.
- The temporary `/staffid` diagnostic remains present until the full production staff lifecycle smoke is completed.

Root cause:

- Web customer orders already triggered `TelegramOrderNotificationService.notifyNewOrder(...)`.
- Telegram customer orders used `CustomerOrderEngineService.createOnlineOrder(...)` directly and did not call the staff notification service after success.
- Production environment and Telegram permissions were not the root cause: `TELEGRAM_STAFF_CHAT_ID` was present in the running backend and matched the intended staff group.

Release evidence:

- Released backend revision: `791d7977762bfe93dc6f06dd976aea3271ddcf2c`.
- Previous backend image before the controlled release was recorded as `mazetto-food-backend-pdslpm:latest` with image id `sha256:0eb70c2441136c7b5cc4c8833b0186cdf2edb4770a6592754396aef277bf02a3`.
- New backend service image: `mazetto-food-backend-pdslpm:791d797`.
- Customer-web remained unchanged on `mazetto-food-customerweb-yvb3d0:48375b2`.
- Production services after release: backend `1/1`, customer-web `1/1`, media `1/1`, PostgreSQL `1/1`.
- Backend health returned 200 after release.
- Customer-web health returned 200 after release.
- Telegram webhook remained healthy with `pending_update_count = 0` and no last error.
- Production migrations remained `16 applied / 0 failed`; no migration was executed.
- Order graph counts remained unchanged across deployment at `orders=5`, `customer_orders=5`, `customer_order_attempts=5`, `kitchen_tickets=5`.
- Running backend contains the notification call in both web and Telegram customer order paths.

Local validation:

- Prisma format, validate, and generate passed using a safe placeholder `DATABASE_URL`.
- Backend typecheck, lint, and build passed.
- `validate-telegram-customer-ordering.ts` passed and now proves Telegram checkout triggers exactly one staff notification attempt after successful order creation, while stale duplicate confirmation does not trigger another attempt.
- `validate-telegram-customer-auth.ts` passed.
- `validate-telegram-catalog-mapping.ts` passed.
- `validate-customer-order-history.ts` passed.
- Workspace typecheck and lint passed.
- `git diff --check` passed with the existing LF/CRLF warning only.

Pending human smoke:

- The next legitimate Telegram customer order should produce exactly one staff group notification in `MAZETTO food / MAZETTO Staff / Kitchen`.
- The staff message should include the order number, branch, order type, items, variants/modifiers when present, payment method, total, and delivery address only for delivery orders.
- Initial staff buttons should expose only the valid next actions such as `Qabul qilish` and `Bekor qilish`.
- After the next real order, verify accept, preparing, and ready transitions in production without cancelling the order merely for testing.

## Step 16 Notification Reliability Hotfix

Status: Backend deployed; human smoke pending

Date: 2026-08-31

Scope:

- Released backend-only notification reliability hotfix `df87d0067ce5a0473f33259405d9ece163da0edd`.
- No customer-web deployment, database schema change, migration, seed, manual DB write, Telegram ENV change, webhook reset, Cloudflare change, media change, Click/Payme activation, `/staffid` removal, or production order creation was performed.
- The temporary `/staffid` diagnostic remains present until the staff lifecycle smoke is fully verified.

Root cause:

- Staff lifecycle transitions updated the authoritative order/kitchen state successfully, but a transient Telegram `fetch failed` during callback acknowledgement or staff message edit could stop execution before the linked customer status notification was attempted.
- Web-created customer orders already invoked the staff notification path after successful order creation, but a transient Telegram `fetch failed` caused the single outbound staff notification attempt to fail.

Fix:

- Telegram transport now uses a bounded retry for transient failures only: network fetch failure, `ECONNRESET`, `ETIMEDOUT`, Telegram `429`, and Telegram `5xx`.
- Permanent Telegram errors such as malformed request, unauthorized, forbidden, invalid chat, and invalid callback data are not blindly retried.
- Staff callback acknowledgement and staff message edit/render failures are logged with safe order/action correlation and do not prevent the customer status notification attempt after a successful DB transition.
- Retry is transport-level only and cannot rerun order creation or staff lifecycle business transitions.

Release evidence:

- Previous backend service image: `mazetto-food-backend-pdslpm:791d797`.
- New backend service image: `mazetto-food-backend-pdslpm:df87d00`.
- Customer-web remained unchanged on `mazetto-food-customerweb-yvb3d0:2376ed2`.
- Production services after release: backend `1/1`, customer-web `1/1`, media `1/1`, PostgreSQL `1/1`.
- Backend health returned 200 after release.
- Customer-web health returned 200 after release.
- Production order graph counts remained unchanged across deployment at `orders=9`, `customer_orders=9`, `customer_order_attempts=9`, `kitchen_tickets=9`.
- Deployment itself created zero orders, customer orders, attempts, or kitchen tickets.
- Immediate backend logs showed successful Nest startup, Prisma connection, and no startup, dependency injection, retry-loop, or Prisma errors.

Validation:

- Backend typecheck, lint, and build passed.
- `validate-telegram-customer-ordering.ts`: passed.
- `validate-telegram-customer-auth.ts`: passed.
- `validate-customer-order-history.ts`: passed.
- `validate-telegram-catalog-mapping.ts`: passed.
- Workspace typecheck and lint passed.
- `git diff --check` passed.
- Prisma validate and generate passed locally with a safe placeholder `DATABASE_URL`.
- Fresh isolated DB lifecycle rerun was not performed in this release gate because local Docker/PostgreSQL was unavailable; production DB was not used for E2E validation.

Production warning:

- Preflight and post-deploy Telegram `getWebhookInfo` reported `pending_update_count = 0`; `last_error_message` still contained a prior `Wrong response from the webhook: 500 Internal Server Error` entry from before this hotfix. No new order or callback smoke has occurred yet to replace that historical Telegram error state.

Pending human smoke:

- On the next legitimate Telegram customer order, verify exactly one staff new-order message, then press `Qabul qilish`, `Tayyorlanmoqda`, and `Tayyor`; confirm the linked customer receives accepted, preparing, and ready Telegram status notifications.
- On the next legitimate web order, verify exactly one staff Telegram new-order notification.
- Do not mark Step 16 notification reliability fully verified until the human Telegram-visible smoke and read-only DB/log correlation pass.

## Gate A - Mobile Orders UI Customer-Web Release

Status: Customer-web deployed and production smoke-verified

Date: 2026-08-31

Scope:

- Released the customer-web-only mobile orders layout/navigation polish.
- Release commit: `2376ed26bb5507104f4ca8fc25de9940c92b904f`.
- Backend, database, migrations, Telegram ENV/webhook, `TELEGRAM_STAFF_CHAT_ID`, `/staffid`, media assets, Cloudflare, and order/payment logic were not changed.
- No production order was created for this release.

Local validation before release:

- `pnpm --filter customer-web typecheck`: passed.
- `pnpm --filter customer-web lint`: passed.
- `pnpm --filter customer-web build`: passed.
- `pnpm typecheck`: passed.
- `pnpm lint`: passed.
- `git diff --check`: passed.

Production deployment:

- Previous customer-web image: `mazetto-food-customerweb-yvb3d0:48375b2`.
- New customer-web image: `mazetto-food-customerweb-yvb3d0:2376ed2`.
- Backend remained unchanged on `mazetto-food-backend-pdslpm:791d797`.
- Production services after deploy: backend `1/1`, customer-web `1/1`, media `1/1`, PostgreSQL `1/1`.
- Public checks returned 200 for `/`, `/menu`, `/orders`, `/cart`, `/profile`, and backend health.

Production visual smoke:

- `/orders` was checked at 360, 390, 430, 768, and 1440px.
- No page-level horizontal overflow was found on `/orders`.
- Mobile logo used the existing real `BrandLogo`, was not distorted, and was geometrically centered at 360/390/430px.
- Mobile bottom navigation was verified at 58px height, with readable labels and clear active `Buyurtma` state.
- Production browser was not authenticated as a customer during this smoke; therefore active/history order cards were not opened with production customer data to avoid creating verification challenges or mutating production state.
- The same deployed commit had already passed local authenticated `/orders` QA with an active order card, status tracker, item prices, history card, and bottom navigation at 360, 390, 430, 768, and 1440px.

Remaining:

- Step 16 Staff Telegram lifecycle human smoke remains pending.
- Eight authentic product media assets remain unresolved.
- Click/Payme remain inactive.

## Customer Ordering UX Controlled Release

Status: Backend and customer-web deployed; production smoke partially verified

Date: 2026-09-01

Scope:

- Released local customer ordering UX commits through `4e7075ad88e683e36bb8a39c06d7ce013305f9d6`.
- Backend release includes Telegram customer ordering UX polish only: compact Telegram menu presentation, simple-item direct add, cart count display, redundant menu-level cleanup, and edit-in-place navigation behavior.
- Customer-web release includes horizontal cart upsell, compact recommendation treatment, mobile checkout/bottom navigation contrast improvements, profile contrast fixes, and EVOS-style quantity control behavior.
- No database migration, seed, manual database write, Cloudflare change, media asset change, Telegram ENV change, Telegram webhook reset, Click/Payme activation, staff lifecycle redesign, or production order creation was performed.

Production deployment:

- Previous backend image: `mazetto-food-backend-pdslpm:df87d00`.
- New backend image: `mazetto-food-backend-pdslpm:4e7075a`.
- Previous customer-web image: `mazetto-food-customerweb-yvb3d0:2376ed2`.
- New customer-web image: `mazetto-food-customerweb-yvb3d0:4e7075a`.
- Production services after release: backend `1/1`, customer-web `1/1`, media `1/1`, PostgreSQL `1/1`.
- Public checks returned 200 for backend health, customer-web health, `/`, `/menu`, `/cart`, `/profile`, and `/orders`.
- Production order graph counts remained unchanged across deployment at `orders=12`, `customer_orders=12`, `customer_order_attempts=12`, `kitchen_tickets=12`.

Validation:

- Backend typecheck, lint, and build passed locally.
- Customer-web typecheck, lint, and build passed locally.
- Workspace typecheck and lint passed locally.
- `validate-telegram-customer-ordering.ts`, `validate-telegram-customer-auth.ts`, `validate-customer-order-history.ts`, and `validate-telegram-catalog-mapping.ts` passed locally.
- `validate-telegram-staff-lifecycle.ts` was not run in this release gate because it requires an isolated database guard; production DB was not used for E2E validation.
- `git diff --check` passed.

Production warnings:

- Telegram `getWebhookInfo` returned `pending_update_count = 0`; `last_error_message` still contains the historical `Wrong response from the webhook: 500 Internal Server Error` timestamp from before this release. No new backend log error appeared during the release window.
- Automated browser screenshot tooling was unavailable in the current Codex environment, so route/health/API smoke was completed and visual screenshot QA remains a manual follow-up for this production release.
- Telegram interactive human UX smoke was not forced from automation to avoid messaging a real customer or creating production state. The next safe step is a human bot navigation smoke without confirming an order.

Remaining:

- Human Telegram UX smoke for compact menu, simple item direct add, cart count, edit-in-place behavior, and staff lifecycle visibility remains pending.
- Eight authentic product media assets remain unresolved.
- Production media direct URLs still depend on the media volume containing the required files.
- Click/Payme remain inactive.

## Web Checkout Auth Regression Fix

Status: Customer-web deployed; authenticated human checkout smoke pending

Date: 2026-09-01

Scope:

- Investigated the customer-web checkout regression where a visibly logged-in customer could reach checkout but see `Invalid or expired customer token` and could not complete the order.
- Root cause: checkout quote loading used the stored customer access token directly. If the short-lived access token had expired, `/customer/checkout/quote` returned a customer-token 401, `quoteError` was set, and the submit button stayed disabled before the existing submit-time refresh/retry path could run.
- The regression was introduced with the checkout quote flow added in `6a191248`; profile and orders already had refresh/retry behavior, but checkout quote did not.

Fix:

- Customer-web API error mapping now treats backend customer token failures as the existing Uzbek session-expired message instead of exposing raw backend text.
- Checkout quote loading now refreshes the customer session once and retries the quote with the fresh access token when the failure is session-related.
- If refresh fails, the invalid session is cleared through the existing auth state and checkout shows the in-place phone verification panel.

Safety:

- Backend authentication guard remains unchanged.
- Checkout remains authenticated; no anonymous checkout or expired-JWT acceptance was added.
- No backend, database, migration, seed, webhook, Cloudflare, payment, or order-engine change was made.

Validation:

- `pnpm --filter customer-web typecheck`: passed.
- `pnpm --filter customer-web lint`: passed.
- `pnpm --filter customer-web build`: passed.
- `pnpm typecheck`: passed.
- `pnpm lint`: passed.
- `pnpm build`: passed.
- `validate-customer-order-history.ts`: passed.
- `validate-telegram-customer-auth.ts`: passed.
- `validate-telegram-customer-ordering.ts`: passed.
- `git diff --check`: passed.

Production release:

- Approved hotfix commit `a2857321fb83bb7d47b54f76960643c4e65357a5` was pushed to `origin/main`.
- Previous customer-web image: `mazetto-food-customerweb-yvb3d0:4e7075a`.
- New customer-web image: `mazetto-food-customerweb-yvb3d0:a285732`.
- Backend remained unchanged on `mazetto-food-backend-pdslpm:4e7075a`.
- Production services after release: backend `1/1`, customer-web `1/1`, media `1/1`, PostgreSQL `1/1`.
- Public checks returned 200 for backend health, `/`, `/menu`, `/cart`, `/checkout`, `/profile`, and `/orders`.
- Production order graph counts remained unchanged across deployment at `orders=13`, `customer_orders=13`, `customer_order_attempts=13`, `kitchen_tickets=13`.
- Release-window backend and customer-web logs showed no new token, startup, Prisma, or server errors.

Pending human smoke:

- Verify with an existing legitimate logged-in customer session that stale access token recovery refreshes once, quote reloads, and checkout remains usable.
- If refresh cannot recover the session, verify the stale session clears and the in-place phone verification UI appears instead of the raw backend token error.

## Canonical Menu Catalog Production Release

Status: ✅ VERIFIED — 74/74 canonical catalog and bundle composition are deployed in production

Date: 2026-09-01

Scope:

- Production menu audit was reconciled after the server came back online.
- Production before this release exposed 35 products, 44 variants, 4 sets, and 10 categories.
- PDF canonical menu remains 56 standalone products and 18 sets, 74 total customer-visible items.
- Production now includes the additive `ProductBundleItem` metadata for persisted set composition and quantities.
- Production migration applied: `20260901120000_product_bundle_items`.
- Production seed/catalog now includes all 56 standalone PDF-backed products and all 18 PDF-backed sets.
- Owner resolved the final two price decisions: Doner Blyuda = 52 000 UZS and Katlet podamashni = 52 000 UZS.
- The confirmed 17 DB-only legacy products/sets were preserved and not deleted, disabled, renamed, or repurposed.
- Telegram customer menu was flattened so Lavashlar and Burgerlar open direct product lists instead of Mol/Tovuq intermediate family screens.
- Stale DB-backed E2E coverage was updated from removed `cust:qadd:*` callbacks to the current flattened `cust:qprod` and `cust:addv` callback flow.
- Customer-web now trusts backend API product names/descriptions instead of overriding them with older hardcoded labels.
- Production services now run backend image `mazetto-food-backend-pdslpm:acae4bd` and customer-web image `mazetto-food-customerweb-yvb3d0:acae4bd`.
- Production DB now reports 17 applied Prisma migrations and 0 failed migrations.
- Production DB/API now expose 11 categories, 91 total products, 100 variants, 20 combo products, and 75 persisted product bundle rows.
- The production customer API returns 91 products because it intentionally preserves the 17 legacy DB-only products/sets alongside the 74 canonical PDF items.
- Production order graph counts remained unchanged during catalog release verification at `orders=13`, `customer_orders=13`, `customer_order_attempts=13`, and `kitchen_tickets=13`.

Validation:

- `prisma format`, `prisma validate`, and `prisma generate` passed locally with a safe placeholder `DATABASE_URL`.
- Backend typecheck, lint, and build passed.
- Customer-web typecheck, lint, and build passed.
- `validate-canonical-catalog.ts` passed and reports 74 resolved canonical items with 0 owner-price decisions pending.
- `validate-telegram-catalog-mapping.ts` passed for flattened Lavash/Burger category mapping.
- `validate-telegram-customer-ordering.ts` passed.
- `validate-customer-order-e2e-db.ts` passed against isolated localhost PostgreSQL after applying all 17 migrations and running the seed.
- Workspace typecheck and lint passed.
- Workspace build reported all 9 tasks successful, then Turbo remained open and was interrupted after successful task output.
- A fresh production backup was created before the DB mutation: `/home/javohir/backups/mazetto/postgres/mazetto-canonical74-pre-release-20260901-122233.dump`.
- Production migration deploy applied `20260901120000_product_bundle_items` successfully.
- Production seed ran once successfully and reported 91 products including 20 combo sets.
- Production bundle integrity checks passed for duplicate product codes, duplicate bundle rows, invalid bundle quantities, products without categories, and combo products without components.
- Bundle-only components such as `Pepsi 0.25`, `Sok 1L`, generic `Sous`, and `Big Doner` intentionally remain preserved by `componentCode`/`componentName` without invented standalone product rows.
- Public backend health returned 200 with database status `ok`.
- Public customer-web routes `/`, `/menu`, `/cart`, `/checkout`, `/profile`, and `/orders` returned 200.
- Served customer-web assets contain `api.mazettofood.uz` and `media.mazettofood.uz`, with no `localhost:4000` fallback found in the served bundle.

Not performed:

- No order/customer/payment/kitchen lifecycle mutation was performed during this catalog release.
- No production order was created.
- No Telegram webhook change.
- No Cloudflare change.
- No media generation/upload.

Pending:

- Human Telegram catalog smoke is still pending after release; do not create a production order for this smoke.
- Click/Payme provider integrations remain not implemented.
- Production media direct URLs still depend on the media volume containing the required files.

## Customer UX Hotfix Release - Telegram One-Tap, Category Ordering, Web Contrast

Status: Deployed; human Telegram smoke pending

Date: 2026-09-01

Scope:

- Released hotfix commit `b787116a8c827440fd480039c63c0626f6e5df0a`.
- Backend image deployed: `mazetto-food-backend-pdslpm:b787116`.
- Customer-web image deployed: `mazetto-food-customerweb-yvb3d0:b787116`.
- Customer-facing menu/category descriptions no longer expose internal PDF/source-menu copy.
- Telegram customer menu keeps direct Lavashlar and Burgerlar category listing without the old Mol/Tovuq intermediate split.
- Simple one-variant products use the streamlined Telegram add flow instead of an unnecessary `Standart` selection screen.
- Customer-web home/profile contrast fixes are included in the deployed customer-web image.

Production safety:

- A fresh pre-release PostgreSQL backup was created and verified:
  `/home/javohir/backups/mazetto/postgres/mazetto-ux-hotfix-pre-release-20260901-131520.dump`.
- No Prisma migration was executed.
- Production seed/catalog apply was run once to reconcile idempotent menu/category text and existing catalog records.
- No order, customer, payment, kitchen lifecycle, Cloudflare, Telegram webhook, media asset, or environment change was performed.
- Production order graph counts remained unchanged during the release at `orders=15`, `customer_orders=15`, `customer_order_attempts=15`, and `kitchen_tickets=15`.

Post-release verification:

- Production services after release: backend `1/1`, customer-web `1/1`, media `1/1`, PostgreSQL `1/1`.
- Backend health returned 200.
- Customer-web routes `/`, `/menu`, `/cart`, `/checkout`, `/profile`, and `/orders` returned 200.
- Production customer API returned 11 categories and 91 products.
- Product and category PDF/source-menu description matches returned 0 through the production API and direct production DB checks.
- Production DB integrity checks returned 0 duplicate product codes, 0 duplicate bundle rows, 0 invalid bundle links, 0 products without categories, and 0 combo products without components.
- Customer-web runtime ENV points to `https://api.mazettofood.uz/api/v1` and `https://media.mazettofood.uz`.
- Customer-web runtime files showed no `localhost:4000` fallback.
- Telegram webhook remained configured and had `pending_update_count = 0`; Telegram still reports a historical `Wrong response from the webhook: 500 Internal Server Error` from 2026-08-31 20:33:36 Asia/Tashkent, before this release window.
- Backend and customer-web release-window logs showed no startup, Prisma, duplicate, or server errors.

Pending:

- Human Telegram smoke is still required for the streamlined one-tap/simple-product flow and Lavashlar/Burgerlar category navigation in the real `@mazettofoodbot` chat.
- No production order should be created for that smoke unless explicitly approved.
- Production media direct URLs still depend on the media volume containing the required files.

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

## Local Customer Catalog Visibility Gate - 2026-09-01

Status: Ready locally; not pushed or deployed

Scope:

- Customer-facing catalog visibility is now centralized by stable `Product.code` allowlists.
- Customer menu/category APIs, customer product detail lookup, homepage product-backed surfaces, Telegram customer catalog navigation, and customer checkout product snapshot lookup now expose/select only the 74 canonical PDF catalog items.
- The canonical customer-facing catalog is verified locally as 56 standalone products plus 18 sets, 74 total.
- The 17 legacy DB-only products/sets remain preserved and are not deleted, disabled, renamed, or customer-visible.
- `Saseska podomashniy` (`SAUSAGE_HOME_STYLE`) was moved from `DONER` to `BLYUDALAR`, correcting category membership to Doner/Klab/Xaggi = 5 and Blyudalar = 3.
- Telegram catalog validation confirms all customer categories fit on one screen without `Keyingi`/`Oldingi` pagination controls for the current 74-item catalog.
- Telegram stale legacy product callbacks are rejected safely and do not create cart items.
- Customer cart quantity controls remain preserved; quick-add legacy paths are blocked by customer visibility checks.

Validation:

- `prisma format`, `prisma validate`, and `prisma generate` passed locally with a safe placeholder `DATABASE_URL`.
- Backend typecheck, lint, and build passed.
- Customer-web typecheck, lint, and build passed.
- `validate-canonical-catalog.ts` passed and reports 74 customer-visible items and 0 owner decisions pending.
- `validate-telegram-catalog-mapping.ts` passed with expected category counts.
- `validate-telegram-customer-ordering.ts` passed, including legacy-hidden stale callback checks.
- `validate-telegram-customer-auth.ts` passed.
- `validate-customer-order-history.ts` passed.
- Workspace typecheck and lint passed.
- `git diff --check` passed with only existing CRLF conversion warnings.

Not performed:

- No production DB mutation.
- No production migration.
- No production seed.
- No deploy.
- No push.
- No Telegram webhook or Cloudflare change.
- No media upload or generation.

Pending:

- Isolated local PostgreSQL E2E validation is pending because Docker Desktop was not available locally.
- Combined controlled release is the next step after owner approval.

## Combined Customer Experience Release - Telegram UX, Web Redesigns, Exact 74 Customer Catalog

Status: Deployed; human Telegram/cart visual smoke partially pending

Date: 2026-09-01

Release revision:

- Application commit: `92a313dc1c1bd6aa1bc8dfef503919c788c829ac`
- Backend image: `mazetto-food-backend-pdslpm:92a313d`
- Customer-web image: `mazetto-food-customerweb-yvb3d0:92a313d`

Scope released:

- Telegram customer catalog keeps flattened food category navigation.
- Customer-facing catalog visibility is exactly 74 canonical PDF items.
- The 17 legacy DB-only products/sets remain preserved internally and hidden from customer-facing catalog surfaces.
- Customer product detail hero redesign is deployed.
- Active order card redesign is deployed.
- No auth, payment, order lifecycle, staff Telegram, Cloudflare, media, or webhook behavior was intentionally changed.

Production safety:

- Pre-release backup was created and restore-list readability was verified:
  `/home/javohir/backups/mazetto/postgres/mazetto-combined-customer-experience-pre-release-20260901-172922.dump`
- No Prisma migration was executed.
- Production seed/catalog apply was run once to reconcile the approved `SAUSAGE_HOME_STYLE` category mapping.
- No production order/customer/payment/kitchen lifecycle mutation was performed by the release verification.

Production DB/API verification:

- Internal DB remains 91 total products, 100 variants, 20 combo products, and 75 product bundle rows.
- Order graph counts remained unchanged during release verification:
  `orders=16`, `customer_orders=16`, `customer_order_attempts=16`, `kitchen_tickets=16`.
- Customer API returns 9 categories and 74 products.
- Customer-visible standalone products: 56.
- Customer-visible sets: 18.
- Customer-visible legacy products: 0.
- Exact customer category counts were verified:
  Lavashlar 14, Burgerlar 8, Doner / Klab / Xaggi 5, Hot Doglar 13, Blyudalar 3, Gazaklar 8, Souslar 3, Ichimliklar 2, Setlar 18.
- `SAUSAGE_HOME_STYLE` is now persisted under `BLYUDALAR`.
- Bundle integrity checks passed for duplicate product codes, duplicate bundle rows, orphan bundle rows, invalid bundle quantities, products without categories, and combo products without composition.
- Homepage customer response had 0 legacy product leaks.

Production web verification:

- Backend health returned 200 with database status `ok`.
- Customer-web routes `/`, `/menu`, `/cart`, `/checkout`, `/profile`, `/orders`, and a real `/product/[id]` route returned 200.
- Served customer-web bundle contains `api.mazettofood.uz` and `media.mazettofood.uz`.
- Served customer-web bundle contains no `localhost:4000` fallback.

Telegram verification:

- Telegram webhook remained configured with `pending_update_count = 0`.
- No new backend Telegram/startup/Prisma/callback errors were found in the release window logs.
- Historical Telegram webhook error metadata may still be present from an older pre-release timestamp.
- Human all-category Telegram pagination/cart smoke remains pending because it requires the owner/customer Telegram account and must not create a production order.

Pending:

- Human Telegram all-category smoke:
  no `Keyingi`, no `Oldingi`, no page indicator, no legacy products, and expected counts by category.
- Human Telegram cart smoke:
  cart rows show only minus/plus, simple products one-tap add, qty 1 minus removes item, no `cust:qadd`.
- Human active-order visual smoke for `/orders` if an authenticated session with active order is available.
- Production media direct URLs still depend on the media volume containing the required files.

## Kitchen UI Local Phase - Staff Order Board

Status: Ready locally; not pushed or deployed

Date: 2026-09-02

Scope:

- Kitchen staff board remains in the existing `apps/pos-web` staff/POS web app at `/kitchen`; no new web app was created.
- The route is protected by the existing staff auth/RBAC layer:
  `KITCHEN` or `SUPER_ADMIN` role plus `KITCHEN_VIEW` permission.
- Active tickets are loaded from the existing authenticated backend endpoint:
  `GET /api/v1/kitchen/orders`.
- Existing ticket mutation endpoints are reused for accept/start/ready/complete, and a minimal authenticated cancel endpoint was added:
  `PATCH /api/v1/kitchen/orders/:id/cancel`.
- Kitchen UI actions and Telegram staff callbacks now use the same `KitchenService.applyOrderAction` transition path instead of separate transition logic.
- The board shows active statuses only:
  `NEW`, `ACCEPTED`, `COOKING`, and `READY`.
- Completed and cancelled tickets leave the active board because the existing active-ticket query excludes closed statuses.
- Refresh strategy is controlled polling every 5 seconds, immediate refetch after an action, and refetch when the tab becomes visible again.
- No Redis and no new websocket implementation were added.
- Kitchen cards show order number, source, order type, elapsed minutes, branch, table/pickup/delivery context, item quantities, variants, selected modifiers, notes, and item count.
- Customer PII is intentionally not shown on kitchen cards.
- Kitchen UI does not depend on catalog seed data; the unrelated `products.ts` recommendation cleanup was split into a separate catalog hygiene commit.
- The two exact legacy recommendation rows were `BIG_BURGER` / `Katta burger` and `CRISPY_CHICKEN_BURGER` / `Qarsildoq tovuqli burger`; both remain preserved legacy products but are no longer recommendation-eligible.

Validation:

- `prisma format`, `prisma validate`, and `prisma generate` passed locally with a safe placeholder `DATABASE_URL`.
- Backend typecheck, lint, and build passed.
- `pos-web` typecheck, lint, and build passed; `/kitchen` is present in the Next.js build route output.
- `validate-kitchen-order-board.ts` passed.
- `validate-canonical-catalog.ts` passed after the separate catalog hygiene fix and reports 56 standalone products, 18 sets, 74 customer-visible items, 17 preserved legacy products, and 0 legacy recommendation leaks.
- `validate-telegram-catalog-mapping.ts` passed.
- `validate-telegram-customer-ordering.ts` passed.
- `validate-customer-order-history.ts` passed.
- Workspace typecheck and lint passed.
- Workspace build reported all 9 tasks successful, then Turbo remained open and was interrupted after successful task output.
- `git diff --check` passed with only existing CRLF conversion warnings.

Not performed:

- No production change.
- No push.
- No deploy.
- No production DB mutation.
- No migration.
- No Telegram webhook or Cloudflare change.
- No payment flow change.
- No customer-web/media-generation work.

Pending:

- Fresh isolated PostgreSQL database `mazetto_kitchen_isolated_20260902` was created in a disposable local Docker container, migrated through all 17 migrations, and used for DB-backed KitchenTicket transition smoke.
- DB-backed Kitchen smoke passed for `NEW -> ACCEPTED`, `ACCEPTED -> COOKING`, `COOKING -> READY`, `READY -> COMPLETED`, valid cancellation, invalid `NEW -> READY` rejection, repeated accept/double-click behavior, stale concurrent accept, completed/cancelled active-board removal, branch scoping, and no duplicate `Order`/`CustomerOrder`/`KitchenTicket` rows.
- The isolated DB test emitted the existing non-blocking Node/pg deprecation warning during simulated concurrent Prisma activity: `Calling client.query() when the client is already executing a query is deprecated and will be removed in pg@9.0`.
- Automated screenshot QA is pending because Playwright is not installed in the local workspace; the route was build-verified and opened in the Codex browser panel for manual inspection.
- Owner review is required before any production release.

## Overnight Work Session - POS Public Route and Admin Core

Status: Local Admin Core prepared; POS public route still blocked by Cloudflare remote-managed routing

Date: 2026-09-02

Kitchen/POS production route state:

- Production POS web service exists internally as `mazetto-food-posweb` and was verified on the shared `dokploy-network`.
- Traefik has an internal Host route for `pos.mazettofood.uz` to `http://mazetto-food-posweb:3000`.
- The internal Traefik route returns the POS `/login` page correctly.
- The Cloudflare tunnel is remote-managed and the running cloudflared container has no local mounted ingress config.
- Current remote-managed Cloudflare ingress includes `api.mazettofood.uz`, `mazettofood.uz`, `www.mazettofood.uz`, and `media.mazettofood.uz`; it does not include `pos.mazettofood.uz`.
- No Cloudflare API token or safe local Cloudflare credential was available on the server, so the public DNS/tunnel route was not changed.
- Required owner/Cloudflare action remains: add `pos.mazettofood.uz -> http://mazetto-food-posweb:3000` to the existing Cloudflare Tunnel routing.

Admin Core local scope:

- POS web now includes protected admin routes:
  `/admin`, `/admin/dashboard`, `/admin/products`, `/admin/products/new`,
  `/admin/products/[id]`, `/admin/categories`, and `/admin/branches`.
- Admin Core uses the existing POS staff auth/RBAC guards, not customer auth.
- Product/category routes are protected by `MENU_VIEW`, `MENU_CREATE`, or `MENU_EDIT`.
- Branch status route is protected by `BRANCH_VIEW`.
- Admin product listing can request inactive/internal catalog rows with `includeInactive=true`.
- Admin product detail uses `GET /api/v1/menu/products/:id`.
- Admin product create/edit preserves the existing menu models and updates only safe fields: name, description, category, image path, default price, preparation time, recommended flag, active flag, and sort order.
- Product deletion is intentionally not exposed in the UI.
- Media upload remains intentionally disabled and documented as a future media phase.
- New admin-created products are not automatically part of the canonical 74-item customer catalog; customer visibility remains controlled separately.

Validation:

- Backend and POS web typecheck passed during implementation.
- Full backend/POS/workspace validation must be completed before a production Admin release.

Not performed:

- No production database mutation.
- No migration.
- No production deploy for Admin Core.
- No customer-web change.
- No Cloudflare route change.
- No Telegram, payment, media, or customer checkout change.

## Admin Core + POS/Kitchen Production Release - 2026-09-02

Status: Deployed; authorized human write/live-order smoke pending

Release revision:

- Backend image: `mazetto-food-backend-pdslpm:ac20b4c`
- POS web image: `mazetto-food-posweb:ac20b4c`
- Customer web image remained unchanged: `mazetto-food-customerweb-yvb3d0:1c0e497`

Public route:

- `https://pos.mazettofood.uz/login` is live and returns 200.
- `https://pos.mazettofood.uz/admin` and `https://pos.mazettofood.uz/kitchen` are publicly reachable as POS web shells, but protected data is not exposed without staff authentication.
- Backend protected APIs remained guarded: unauthenticated kitchen and admin menu requests returned 401.

Production backup:

- Fresh PostgreSQL backup before release:
  `/home/javohir/backups/mazetto/postgres/mazetto-admin-core-pre-release-20260902-102808.dump`
- Backup size was verified as non-zero: 214K.

Admin routes deployed:

- `/admin`
- `/admin/dashboard`
- `/admin/products`
- `/admin/products/new`
- `/admin/products/[id]`
- `/admin/categories`
- `/admin/branches`

Release verification:

- Backend service reached `1/1` and public health returned database `ok`.
- POS web service reached `1/1` and public `/login` returned 200 after deployment.
- Customer web routes `/`, `/menu`, `/cart`, `/checkout`, `/profile`, and `/orders` remained healthy.
- Customer catalog regression passed: 56 standalone products, 18 sets, 74 total customer-visible products, and 0 legacy customer-visible leaks.
- Internal production catalog counts remained unchanged during release verification:
  products 91, variants 100, categories 11, product bundle rows 75.
- Order graph counts remained unchanged during release verification:
  orders 17, customer_orders 17, customer_order_attempts 17, kitchen_tickets 17.
- Telegram webhook remained configured with pending updates 0. Telegram still reports the historical 2026-08-31 webhook 500 metadata; no new release-window backend or POS web errors were found in service logs.

Not performed:

- No migration.
- No seed/catalog apply.
- No fake production product/category/order was created.
- No production product, category, branch, order, payment, Telegram webhook, Cloudflare, media, or customer-web mutation was performed.

Pending:

- Authorized Admin human smoke with a legitimate `SUPER_ADMIN` or `BRANCH_MANAGER` account:
  dashboard, product list/detail, product-new form without submitting fake data, categories, and branches.
- Authorized Kitchen human smoke with a legitimate `KITCHEN` or `SUPER_ADMIN` account.
- Live Kitchen lifecycle smoke remains pending until the next legitimate order arrives; do not create fake production orders for this.

## Staff Accounts and RBAC Foundation - Local

Status: Ready locally; not pushed or deployed

Date: 2026-09-02

Scope:

- Staff management now uses the existing staff `User`, `Role`, `Permission`, `UserRole`, `Employee`, `Session`, and `AuditLog` architecture.
- No customer authentication, customer checkout, payment, Telegram webhook, Cloudflare, or production configuration behavior was changed.
- The missing `ADMIN` role is added through the existing seed role reconciliation path without renaming or removing existing roles.
- New staff/RBAC permissions are added through the existing permission seed path:
  `ADMIN_ACCESS`, `STAFF_VIEW`, `STAFF_CREATE`, `STAFF_UPDATE`, `STAFF_PASSWORD_RESET`,
  `STAFF_STATUS_CHANGE`, `STAFF_ROLE_ASSIGN`, `POS_USE`, and `SHIFT_VIEW_OWN`.
- `SUPER_ADMIN` keeps full access through the existing `ALL` permission.
- `ADMIN` receives admin/catalog/staff/report capabilities, remains branch-scoped by default, and does not receive automatic Kitchen access unless `KITCHEN_VIEW` is explicitly assigned.
- `CASHIER` receives only future POS and own-shift permissions. Cashier access to `/admin`, `/admin/printers`, and `/kitchen` remains blocked by role/permission gates.
- `KITCHEN` remains restricted to Kitchen permissions and does not receive admin, POS, catalog, staff, or financial-report permissions.
- Protected backend staff endpoints were added:
  `GET /api/v1/staff`,
  `GET /api/v1/staff/:id`,
  `POST /api/v1/staff`,
  `PATCH /api/v1/staff/:id`,
  `PATCH /api/v1/staff/:id/role`,
  `PATCH /api/v1/staff/:id/status`,
  `POST /api/v1/staff/:id/password-reset`,
  and `POST /api/v1/staff/me/password`.
- Staff password creation/reset/change reuses bcrypt hashing and never returns password hashes.
- Staff account block/deactivation sets the user inactive, suspends the linked employee where present, and revokes active sessions.
- Protected staff requests now re-resolve the current user, active roles, branch scope, employee state, and permissions from the database instead of trusting stale JWT payload claims.
- Final active `SUPER_ADMIN` protection prevents blocking or downgrading the last active owner account.
- Branch-scoped staff accounts require an assigned branch. Branch-scoped managers cannot manage global staff, cross-branch staff, or assign global staff roles.
- A safe bootstrap script was added for owner account creation/reset from environment variables:
  `pnpm --dir apps/backend staff:bootstrap`.
- Bootstrap uses only environment-supplied credentials, never hardcodes or logs plaintext passwords, and prints only safe masked account metadata.
- POS web now includes protected staff-management routes:
  `/admin/staff`, `/admin/staff/new`, and `/admin/staff/[id]`.
- POS web now includes a protected reports foundation route:
  `/admin/reports`.
- The reports foundation currently shows only metrics that can be calculated from existing order/payment data. POS/shift/provider-specific metrics remain clearly blocked for later phases.
- Existing `/pos` is protected by `POS_USE`; full Desktop POS/kassa implementation is intentionally not part of this phase.
- Existing `Shift` and `CashTransaction` models were found and can be reused by the next shift/kassa handover phase. Full shift handover was not implemented here.
- Staff management actions write existing `AuditLog` records for create, update, role change, status change, password reset, own password change, and bootstrap.

Validation:

- `prisma format`, `prisma validate`, and `prisma generate` passed locally with a safe placeholder `DATABASE_URL`.
- Backend typecheck, lint, and build passed locally.
- POS web typecheck, lint, and build passed locally.
- `validate-staff-rbac.ts` passed.
- `validate-admin-catalog-core.ts` passed.
- `validate-kitchen-order-board.ts` passed after aligning the validator with the permission-gated Kitchen route.
- `validate-canonical-catalog.ts` passed and still reports 56 standalone products, 18 sets, 74 customer-visible items, and 0 legacy customer-visible items.
- `validate-telegram-catalog-mapping.ts` passed.
- `validate-telegram-customer-ordering.ts` passed.
- `validate-telegram-customer-auth.ts` passed.
- `validate-customer-order-history.ts` passed.
- Workspace typecheck and lint passed.
- Workspace build reported all 9 tasks successful, then Turbo remained open and was interrupted after successful task output.
- Isolated DB-backed staff smoke script exists at `apps/backend/scripts/validate-staff-rbac-db.ts`, but could not be run in this local session because Docker Desktop daemon and local PostgreSQL client were unavailable.
- Automated screenshot QA for `/login`, `/admin`, `/admin/staff`, `/admin/staff/new`, `/admin/staff/[id]`, `/admin/reports`, `/admin/products`, `/admin/categories`, and `/kitchen` is pending because Playwright is not installed in the local workspace. The POS web production build verified all new routes.

Not performed:

- No production DB mutation.
- No production staff account creation.
- No production migration or seed.
- No push.
- No deploy.
- No Telegram webhook or Cloudflare change.
- No customer-web, customer order, payment, or media logic change.

Pending:

- Run the isolated DB-backed staff smoke when local Docker/PostgreSQL is available.
- Owner review before push/deploy.
- Next roadmap phase:
  `DESKTOP POS / KASSA -> SHIFT / KASSA TOPSHIRISH -> ADMIN SALES REPORTS HARDENING -> PRINTER / RECEIPT`.

## Canonical 74 Product Media Replacement - Local

Status: Ready locally; not pushed or deployed

Date: 2026-09-02

Scope:

- Owner-provided numbered product/set media in `media-source/final/1.png` through `media-source/final/74.png` was mapped to the canonical 74-item menu order.
- The old customer-web product media files under `apps/customer-web/public/menu-media/source/products/` were removed and replaced with 74 optimized WebP product/set assets.
- Category media under `apps/customer-web/public/menu-media/source/categories/` was preserved because the owner-provided 74-image batch covers product/set items, not category tiles.
- Canonical seed image paths were updated for all 56 standalone products and all 18 set products.
- Product image filenames now match the customer-visible canonical menu rather than the older partial 27-asset mapping.
- The media service release manifest now contains 10 category assets plus 74 product assets, 84 release files total.
- The unresolved product media backlog is now 0 for the local customer-visible 74-item catalog.
- The customer-web local source media fallback list now includes all 74 canonical product/set image paths plus existing category paths.

Validation:

- `pnpm media:validate` passed with 10 category assets, 74 product assets, 0 unresolved assets, and 84 release files.
- Canonical seed/file mapping passed: 74 canonical items, 74 unique image URLs, and every canonical image path has a local source file.
- `validate-canonical-catalog.ts` passed and still reports 56 standalone products, 18 sets, 74 customer-visible items, and 0 owner decisions pending.

Not performed:

- No production media volume upload.
- No production DB mutation.
- No production seed/catalog apply.
- No push.
- No deploy.

## Canonical 74 Product Media - Production Release

Status: Deployed and verified in production

Date: 2026-09-02

Revisions:

- Initial media replacement commit: `dcfd14e4dd02eb9e10305c03038b4c6666878e66`
- Final production revision after targeted cache-busting path fix: `f245aa39b612c03ac5388420f80dfffab7f70dae`
- Customer-web production image: `mazetto-food-customerweb-yvb3d0:f245aa3`
- Backend production image remained unchanged: `mazetto-food-backend-pdslpm:ac20b4c`
- POS web production image remained unchanged: `mazetto-food-posweb:ac20b4c`
- Media nginx service image remained unchanged; only the persistent `mazetto-media` volume was synchronized.

Backups:

- PostgreSQL backup: `/home/javohir/backups/mazetto/postgres/mazetto-canonical-media-pre-release-20260902-170642.dump` (`218762` bytes)
- Media volume backup: `/home/javohir/backups/mazetto/media/mazetto-media-pre-canonical-20260902-170715` (`37` files, `1988588` bytes)

Production media result:

- Release manifest: 84 files total.
- Category media: 10/10 present.
- Product/set media: 74/74 present.
- Public media exact-size verification: 84/84 passed.
- Canonical customer API image verification: 74/74 passed.
- Set image verification: 18/18 passed.
- Canonical placeholder count: 0.

Production DB result:

- Migration: not run.
- Seed: not run.
- Catalog media path apply: run with a focused transaction that updated only canonical product/set `imageUrl` paths.
- Products: 91.
- Product variants: 100.
- Categories: 11.
- ProductBundleItem: 75.
- Canonical product/set rows: 74.
- Canonical media paths populated: 74/74.
- Legacy canonical media assignment: 0.
- Product prices, categories, variants, bundle composition, branches, staff, auth, and orders were not intentionally changed.

Order graph safety:

- Orders remained 17.
- CustomerOrders remained 17.
- CustomerOrderAttempts remained 17.
- KitchenTickets remained 17.
- No fake production order was created.

Customer-web smoke:

- `/`, `/menu`, `/cart`, `/checkout`, `/profile`, `/orders` returned HTTP 200.
- `https://pos.mazettofood.uz/login` returned HTTP 200.
- Backend health returned HTTP 200.
- Telegram webhook remained reachable with pending updates 0. The stored Telegram `last_error` timestamp was old (`2026-08-31`) and no release-window backend errors were found.

Visual smoke:

- 390, 768, and 1440 checks found no broken images and no horizontal overflow on `/menu` or representative product detail.
- Product/detail media loaded without stretching in the inspected screenshot.
- Home still contains a hero fallback text (`Rasm tayyorlanmoqda`) from homepage hero/recommendation data, not from canonical product media. This remains a separate UX/data follow-up and did not block the 74/74 catalog media release.

Cache handling:

- Cloudflare immutable cache initially held stale content for two reused filenames: `/products/chicken-burger.webp` and `/products/set-lavash.webp`.
- Because no purge credential was available, those two canonical paths were changed to cache-busting filenames:
  `/products/chicken-burger-canonical.webp` and `/products/set-lavash-canonical.webp`.
- Final public media exact-size verification passed with stale count 0.

## Staff/RBAC Release Gate - Local Isolated DB

Status: Passed locally; ready for controlled production release

Date: 2026-09-03

Scope:

- Verified the current HEAD with the existing Staff/RBAC implementation commit in history.
- Created a local isolated PostgreSQL 18 database on localhost port `55438`.
- Applied the full Prisma migration chain from zero: 17 migrations applied, 0 failed.
- Ran the existing role/permission/menu seed twice against the isolated DB and verified idempotent behavior.
- Ran the real staff owner bootstrap command twice with isolated test credentials only.
- Verified bootstrap did not create duplicate owner rows and did not print plaintext password, password hash, JWT, refresh token, or secrets.
- Fixed the DB-backed Staff/RBAC smoke validator so its test branch `sortOrder` stays inside PostgreSQL integer range.

RBAC proof:

- SUPER_ADMIN login, admin APIs, reports, and kitchen access passed.
- ADMIN login, staff/admin/report/menu-management permission gates passed.
- CASHIER login passed; staff/admin/report/kitchen/menu mutation APIs were denied.
- KITCHEN login passed; kitchen API access passed while admin/staff/report/menu mutation APIs were denied.
- CASHIER and KITCHEN self-escalation attempts were denied by API guards.
- ADMIN to SUPER_ADMIN escalation was denied.
- Blocking a staff account invalidated the old access token through current DB-state resolution.
- Changing an ADMIN to CASHIER caused the old ADMIN access token to resolve with CASHIER permissions and lose admin access.
- Duplicate staff email and duplicate staff phone were rejected.
- Password reset/change flows were verified; old passwords failed and new passwords succeeded.
- Audit log metadata was inspected for representative staff actions and did not contain plaintext passwords, password hashes, JWTs, refresh tokens, or secrets.

Regression:

- `validate-staff-rbac.ts` passed.
- `validate-admin-catalog-core.ts` passed.
- `validate-kitchen-order-board.ts` passed.
- `validate-canonical-catalog.ts` passed with 56 standalone products, 18 sets, 74 customer-visible canonical items, and 0 customer-visible legacy items.
- `validate-telegram-catalog-mapping.ts` passed.
- `validate-telegram-customer-ordering.ts` passed.
- `validate-telegram-customer-auth.ts` passed.
- `validate-customer-order-history.ts` passed.
- Backend typecheck, lint, and build passed.
- POS web typecheck, lint, and build passed.
- Workspace typecheck and lint passed.
- `git diff --check` passed with only existing LF/CRLF warnings.

Notes:

- CASHIER can access the backend `/printers` API because the endpoint is guarded by `RECEIPT_PRINT`, which CASHIER intentionally has for receipt operations. The POS `/admin/printers` UI remains role-gated to admin roles. This should be accepted as POS printer foundation behavior or tightened in a future focused printer-admin permission task.
- No production DB, production account, production service, Cloudflare route, Telegram webhook, media volume, customer-web deploy, backend deploy, POS deploy, push, or production order was touched.

## Staff/RBAC Production Release

Status: Deployed; owner SUPER_ADMIN bootstrap pending secure credential input

Date: 2026-09-03

Release revision:

- Application revision: `d75b56e4055c4840244ebafed5cbb31ccb067b4a`
- Previous backend image: `mazetto-food-backend-pdslpm:ac20b4c`
- Released backend image: `mazetto-food-backend-pdslpm:d75b56e`
- Previous POS web image: `mazetto-food-posweb:ac20b4c`
- Released POS web image: `mazetto-food-posweb:d75b56e`
- Customer web remained unchanged: `mazetto-food-customerweb-yvb3d0:0004277`
- Media service remained unchanged.

Backup:

- PostgreSQL backup: `/home/javohir/backups/mazetto/postgres/mazetto-staff-rbac-pre-release-20260903-111119.dump` (`219600` bytes)

Database release:

- Migration required: no.
- Production migration state before release: 17 applied, 0 failed.
- Prisma migration command was not run.
- Full menu seed was not run.
- Role/permission data was updated with a focused idempotent RBAC-only transaction based on the approved seed definitions.
- Roles after release: 7.
- Permissions after release: 48.
- Role-permission links after release: 101.
- Required roles present: `SUPER_ADMIN`, `ADMIN`, `CASHIER`, `KITCHEN`.

Regression:

- Backend service converged at 1/1.
- Backend health returned 200 with database status `ok`.
- POS web service converged at 1/1.
- POS `/login` returned 200.
- Customer web public routes `/`, `/menu`, `/cart`, `/checkout`, `/profile`, and `/orders` returned 200 from external smoke and remained on the previous customer-web revision.
- Internal customer-web and POS container smoke checks returned 200 for representative routes.
- Unauthenticated protected backend APIs returned 401 for staff, kitchen, reports, and catalog mutation/list management routes.
- Telegram webhook remained healthy with pending updates 0. A stored Telegram `last_error` remained present from before the release window; no new backend release-window Telegram errors were found.

Catalog and order safety:

- Products remained 91.
- Product variants remained 100.
- Categories remained 11.
- ProductBundleItem remained 75.
- Orders remained 18.
- CustomerOrders remained 18.
- CustomerOrderAttempts remained 18.
- KitchenTickets remained 18.
- No fake production order was created.
- No customer media, Cloudflare route, Telegram webhook, product price, category, variant, bundle composition, branch, customer, or order data was intentionally changed.

Owner bootstrap:

- Real owner credentials were not supplied to Codex and were not invented.
- Owner bootstrap was not executed.
- Required secure one-process environment variable names: `MAZETTO_BOOTSTRAP_ADMIN_EMAIL`, `MAZETTO_BOOTSTRAP_ADMIN_PHONE`, `MAZETTO_BOOTSTRAP_ADMIN_NAME`, `MAZETTO_BOOTSTRAP_ADMIN_PASSWORD`, `MAZETTO_BOOTSTRAP_ADMIN_BRANCH`, `MAZETTO_BOOTSTRAP_ADMIN_ACTIVATE`.
- Next required action: owner must supply real credentials securely and run the existing `pnpm --dir apps/backend staff:bootstrap` command in a backend-capable production terminal.

Rollback:

- Rollback was not required.
- Backend rollback image remains `mazetto-food-backend-pdslpm:ac20b4c`.
- POS web rollback image remains `mazetto-food-posweb:ac20b4c`.

## Staff Bootstrap - Owner and Cashier

Status: Owner SUPER_ADMIN and Sergeli cashier created and verified in production

Date: 2026-09-03

Credential storage:

- Credential file exists on the production host at `/home/javohir/mazetto-secrets/mazetto-staff-credentials-20260903-130322.txt`.
- File mode verified: `600`.
- Credential directory is outside the repository and public application paths.
- Passwords are not documented here.

Bootstrap execution:

- Runtime source script `apps/backend/scripts/bootstrap-staff-admin.ts` is not present in the minimized production backend image.
- A temporary script was executed inside the already-running backend container and called the compiled production `StaffService` and `AuthService`.
- No source-code change or backend redeploy was required.
- Temporary runtime script/input files were removed after verification.

Accounts:

- Owner login: `owner@mazettofood.uz`.
- Owner existed before bootstrap: no.
- Owner duplicate count after bootstrap: 1.
- Owner active: yes.
- Owner role: `SUPER_ADMIN`.
- Owner branch: `SERGELI`.
- Owner login verified through production auth: yes.
- Owner API access verified for staff, reports, catalog administration, branch administration, and kitchen.
- Cashier login: `cashier.sergeli@mazettofood.uz`.
- Cashier existed before creation: no.
- Cashier duplicate count after creation: 1.
- Cashier active: yes.
- Cashier role: `CASHIER`.
- Cashier branch: `SERGELI`.
- Cashier login verified through production auth: yes.

Cashier isolation:

- Staff API denied: yes.
- Reports API denied: yes.
- Kitchen API denied: yes.
- Product mutation denied: yes.
- Category mutation denied: yes.
- Staff mutation denied: yes.
- Cashier retained `POS_USE`, own shift, payment, receipt, and cash transaction foundation permissions.
- Backend `/printers` remained reachable for CASHIER because it is guarded by `RECEIPT_PRINT`; POS `/admin/printers` remains admin-role gated in the frontend source.

Production safety:

- Products remained 91.
- Product variants remained 100.
- ProductBundleItem remained 75.
- Customer-visible catalog remained 74.
- Missing canonical product images remained 0.
- Orders remained 18.
- CustomerOrders remained 18.
- CustomerOrderAttempts remained 18.
- KitchenTickets remained 18.
- No fake production order was created.
- Backend health remained 200.
- POS login remained 200.
- Customer routes `/`, `/menu`, `/cart`, `/checkout`, `/profile`, and `/orders` returned 200.
- Telegram webhook remained healthy with pending updates 0. The stored Telegram `last_error` remained an older pre-existing value.
- No password, password hash, JWT, refresh token, token, or secret was found in representative backend release-window logs or staff audit metadata.

Next:

- Staff/RBAC foundation is ready for the next roadmap step: Desktop POS / Kassa.

## Desktop POS / Kassa - Local Implementation

Status: LOCAL RELEASE READINESS VALIDATED, production release pending explicit approval.

Date: 2026-09-04

Implemented locally:

- POS web `/pos` placeholder was replaced with a real cashier workspace.
- `/pos` remains protected by frontend `RoleGuard` and `PermissionGuard permission="POS_USE"`.
- Cashier catalog loads from a new backend staff-only POS catalog endpoint.
- POS catalog is filtered to the canonical customer-visible product code set.
- Legacy products are not intentionally exposed in the POS catalog endpoint.
- POS cart supports add, quantity increase/decrease, remove, subtotal/total preview, cash received input, and change preview.
- Simple products can be added directly.
- Products with variants or modifiers open a compact selection dialog.
- Sets remain sellable as their real product rows; bundle composition is not mutated.
- New backend POS order endpoint creates operational POS orders with server-side branch, cashier, source, item snapshot, pricing, payment record, order history, and KitchenTicket logic.
- Frontend POS checkout uses a stable per-cart idempotency key: unchanged failed submissions retry with the same key, and cart edits rotate the key.
- `OrderSource.POS` already existed; no Prisma enum migration was required.
- POS counter sale does not require a customer account, customer phone, Telegram account, or address.
- Click, Payme, Card, receipt printing, and shift handover were not implemented in this step.

Validation completed:

- `pnpm --dir apps/backend exec tsx scripts/validate-pos-kassa.ts`: passed.
- `pnpm --filter backend typecheck`: passed.
- `pnpm --filter pos-web typecheck`: passed.
- `pnpm --filter backend lint`: passed.
- `pnpm --filter pos-web lint`: passed.
- `pnpm --filter backend build`: passed.
- `pnpm --filter pos-web build`: passed.
- Fresh isolated local PostgreSQL 17 container `mazetto_pos_isolated_20260904` was started on `127.0.0.1:55440`.
- `prisma migrate deploy` applied all 17 migrations successfully to the isolated database.
- `pnpm --dir apps/backend exec tsx scripts/validate-pos-kassa-db.ts`: passed.
- POS DB smoke proved: simple sale, variant sale, modifier sale, set sale, authoritative cash payment, PAID order persistence, CONFIRMED history, KitchenTicket creation, same-key idempotency, concurrent idempotency, invalid cash rejection, invalid variant rejection, invalid modifier rejection, blocked staff rejection, cross-branch rejection, and server-side quantity guard.
- `pnpm typecheck`: passed.
- `pnpm lint`: passed.
- Existing static/regression validators passed: staff RBAC, admin catalog, kitchen board, canonical catalog, Telegram catalog mapping, Telegram customer ordering, Telegram customer auth, customer order history.
- `pnpm build`: all 9 workspace build tasks reported successful; Turbo session stayed open after success and was manually stopped.
- `prisma validate`: passed with safe local placeholder `DATABASE_URL`.
- `prisma generate`: passed with safe local placeholder `DATABASE_URL`.
- `git diff --check`: passed.

Still required before production release:

- Owner review of the local POS/Kassa UI and release scope.
- Production backup, push, backend/POS-web deploy, and read-only production smoke in a separate controlled release phase.
- Live browser visual QA at 768, 1024, 1280, 1440, and 1920 remains recommended before production release; no production browser or order was used in this local validation.

Known limitations:

- Controller-level `POS_USE` authorization is validated statically by guards and source wiring; the DB validator exercises service-level staff/branch safety directly.
- The DB validator emitted a non-fatal pg deprecation warning during the concurrent idempotency proof; the validator completed successfully.

Production safety:

- No production DB change.
- No production order created.
- No push.
- No deploy.

Next:

- Prepare a controlled production release plan for POS/Kassa after owner approval.

## Desktop POS / Kassa - Production Release

Status: DEPLOYED AND VERIFIED, ready for Shift / Kassa topshirish.

Date: 2026-09-05

Release revisions:

- Backend release revision: `ea250a9d66549048c30ca2d2beedaada85d7b82f`.
- POS web release revision: `4cf2241b3d0d75bcfaa4049490fe4aa2a1625ed4`.
- POS web includes the production media build fix for `NEXT_PUBLIC_MEDIA_URL`.
- Customer web remained unchanged on `mazetto-food-customerweb-yvb3d0:0004277`.
- Media service remained unchanged on `mazetto-food-media-btinws:latest`.

Backup:

- PostgreSQL backup before release: `/home/javohir/backups/mazetto/postgres/mazetto-pos-pre-release-20260904-190313.dump` (`221233` bytes).

Database and migration:

- Prisma schema changed: no.
- New migration required: no.
- Production migration command was not run.
- Production seed was not run.
- Products before/after: 91 -> 91.
- Product variants before/after: 100 -> 100.
- ProductBundleItem before/after: 75 -> 75.
- Canonical customer-visible products after release: 74.
- Canonical standalone after release: 56.
- Canonical sets after release: 18.
- Legacy customer-visible products after release: 0.
- Missing canonical image paths after release: 0.
- Orders before/after: 18 -> 18.
- CustomerOrders before/after: 18 -> 18.
- CustomerOrderAttempts before/after: 18 -> 18.
- KitchenTickets before/after: 18 -> 18.
- No fake production POS order was created.

Production smoke:

- Backend service converged at 1/1 on `mazetto-food-backend-pdslpm:ea250a9`.
- Backend health returned 200 with database status `ok`.
- POS web service converged at 1/1 on `mazetto-food-posweb:4cf2241`.
- POS `/login` returned 200.
- POS `/pos` route returned 200.
- Cashier login verified through the production backend API.
- Cashier primary redirect policy remained `/pos`.
- Cashier has `POS_USE` and a branch scope.
- POS catalog endpoint returned 200 for cashier.
- POS catalog returned 74 products: 56 standalone and 18 sets.
- POS catalog legacy-visible count: 0.
- POS catalog media paths resolved to `https://media.mazettofood.uz/...` after the POS media build fix.
- Unauthenticated POS catalog returned 401.
- Unauthenticated POS order create returned 401.
- Authenticated invalid POS order request returned 400 and did not create an order.

RBAC smoke:

- Cashier `/pos` access: allowed.
- Cashier staff API: denied with 403.
- Cashier reports API: denied with 403.
- Cashier kitchen API: denied with 403.
- Cashier product mutation: denied with 403.
- Cashier category mutation: denied with 403.
- Owner SUPER_ADMIN staff API: allowed.
- Owner SUPER_ADMIN reports API: allowed.
- Owner SUPER_ADMIN menu catalog API: allowed.
- Owner SUPER_ADMIN kitchen API: allowed.
- Owner SUPER_ADMIN POS catalog policy: denied with 403 because POS catalog requires branch-scoped POS access.

Regression:

- Customer public routes `/`, `/menu`, `/cart`, `/checkout`, `/profile`, and `/orders` returned 200.
- Telegram webhook remained healthy with pending updates 0 and no last error.
- Backend and POS-web release-window logs showed no new error/exception output.
- Kitchen API remained healthy for SUPER_ADMIN.
- Click and Payme were not activated.
- Card payment success was not introduced.
- Shift handover and physical receipt printing remain future phases.

Visual smoke:

- Authenticated production POS browser smoke loaded `/pos` as the real cashier.
- Product grid showed 74 products.
- Cart section and disabled confirm button were visible before adding items.
- One local browser cart interaction was performed without submitting an order.
- Viewport QA at 768, 1024, 1280, 1440, and 1920 showed no horizontal overflow.
- Representative product media rendered from `media.mazettofood.uz`; the first 12 images at 768 loaded successfully.

Rollback:

- Rollback was not required.
- Backend rollback image before release: `mazetto-food-backend-pdslpm:d75b56e`.
- POS-web rollback image before release: `mazetto-food-posweb:d75b56e`.
- Normal rollback path remains application-image-only because no migration and no release-created order occurred.

Next:

- Build the Shift / Kassa topshirish workflow.
