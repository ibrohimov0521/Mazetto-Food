# MAZETTO FOOD Full Code Audit

Date: 2026-08-29

Starting HEAD: `9003b1458483394a72822dd66b15125642e323f1`

Production baseline during this audit remains `d3ba37de2e458a473af73d543049f097ce2ebdb4`; no production writes, deploys, pushes, webhook changes, Cloudflare changes, or production orders were performed.

## Executive Summary

The MAZETTO FOOD repository contains a working production MVP with a NestJS backend, customer web, POS web, media nginx service, Prisma/PostgreSQL schema, production migrations, seed structure, customer Telegram auth/order code in the backend, and validation scripts.

The highest release blockers found during the first pass were a customer-facing delivery-fee mismatch and public online payment options that were visible before real provider settlement existed. Step 11 remediated both locally: backend checkout quote/order creation now share the same customer pricing policy, and customer checkout exposes only operational `CASH` payment for now.

No committed secrets were found in the repository by the current scan. Customer ownership checks for customer order history/detail are scoped by `customerId`. The proven order engine uses server-side product, variant, and modifier pricing, not client-supplied item totals.

## Repository Inventory

| Area | Classification | Evidence |
| --- | --- | --- |
| `apps/backend` | ACTIVE | NestJS modules, Prisma 7 adapter, production Dockerfile, migrations, seed, validation scripts. |
| `apps/customer-web` | ACTIVE | Next.js customer app with menu, cart, checkout, profile, orders, media resolver. |
| `apps/pos-web` | PARTIAL | Real routes and API client exist, but offline/print/production POS completeness is not proven. |
| `apps/media` | ACTIVE INFRA | nginx static service exists; production 404 is caused by empty media volume, not nginx code. |
| `apps/print-agent` | PLACEHOLDER | Startup log only. |
| `apps/telegram-bot` | PLACEHOLDER | Startup log only; current customer Telegram bot lives inside backend. |
| `packages/api-client` | PARTIAL | Shared API client package exists, limited usage. |
| `packages/config` | PLACEHOLDER/PARTIAL | Minimal shared config package. |
| `packages/types` | PARTIAL | Shared type package exists. |
| `packages/ui` | PLACEHOLDER/PARTIAL | Minimal UI export exists. |
| `docs` | ACTIVE BUT DRIFTING | Work status is useful but contains stale top-level rows and production deployment notes. |

Reviewable files inventoried: 251.

## Architecture Map

Customer web and Telegram both create customer orders through the backend customer order architecture. Customer web keeps a local cart and sends an authenticated checkout request. Telegram keeps persistent cart rows and checkout session rows, then calls `CustomerOrderEngineService`.

`CustomerOrderEngineService` creates the operational `Order`, snapshots items with authoritative database prices, writes `OrderStatusHistory`, confirms the order for preparation through `OrdersService`, creates the customer-facing `CustomerOrder`, completes `CustomerOrderAttempt`, and creates a `KitchenTicket`.

The media architecture is split: database rows store relative paths such as `/products/lavash-big.webp`; customer-web resolves those to `NEXT_PUBLIC_MEDIA_URL`, then falls back to local extracted source media, then branded fallback. Production direct media URLs still 404 because the `mazetto-media` volume is empty.

## P0 Findings

No confirmed P0 issue was found in this audit.

## P1 Findings

### AUD-001: Customer delivery fee is displayed but not persisted authoritatively

Severity: P1 HIGH

Files:

- `apps/customer-web/app/cart/page.tsx`
- `apps/customer-web/app/checkout/page.tsx`
- `apps/backend/src/modules/customers/customer-order-engine.service.ts`

Original evidence:

Customer web calculates and displays `deliveryFee = 12000` for delivery orders and displays `total = subtotal + deliveryFee`. The checkout request does not send an authoritative delivery fee field. The backend recalculates online order totals from order items and writes `data: { subtotal, total: subtotal }`, leaving `deliveryFeeTotal` at the schema default of `0`.

Production impact:

The amount seen by a delivery customer can differ from the stored order total used by operations, history, reports, and staff workflows. This is a release blocker for paid delivery operations.

Step 11 fix:

Backend `CustomerOrderEngineService` now exposes an authenticated customer checkout quote and uses the same pricing policy during final order creation. Since no trustworthy branch/settings delivery-fee value exists yet, the current authoritative delivery fee is `0.00` for both `DELIVERY` and `PICKUP`; this preserves the already verified production behavior and avoids inventing a new charge. `Order.deliveryFeeTotal` is persisted from the backend policy and `Order.total = subtotal + deliveryFeeTotal`.

Fixed: YES locally, not deployed.

### AUD-002: Online payment choices are visible before real provider completion

Severity: P1 HIGH

Files:

- `apps/customer-web/app/checkout/page.tsx`
- `apps/backend/src/modules/customers/dto/customer.dto.ts`
- `apps/backend/src/modules/customers/customer-order-engine.service.ts`

Original evidence:

Customer checkout allows `CLICK`, `PAYME`, `CARD`, and `CASH`. Online customer order creation records `paymentMethod`, but no Click/Payme provider confirmation path is active and no successful online `Payment` row is created for customer checkout.

Production impact:

Customers can select a method that looks like an online payment option while the system only records a pending payment method. This can cause operational confusion and incorrect expectations.

Step 11 fix:

Customer checkout now exposes only `CASH` as an available customer payment method. Backend customer order creation rejects unsupported customer payment methods, so stale clients cannot submit `CLICK`, `PAYME`, or `CARD` as if they were operational online payments.

Fixed: YES locally, not deployed.

## P2 Findings

### AUD-003: Phone normalization can create duplicate customer identities

Severity: P2 MEDIUM

Files:

- `apps/backend/src/modules/customers/customers.service.ts`
- `apps/backend/src/modules/telegram/telegram-customer-auth.service.ts`

Original evidence:

Normalization strips formatting and prefixes `+` only when the normalized value starts with `998`. A local Uzbek input like `901234567` remains distinct from `+998901234567`.

Production impact:

The same human can accidentally create multiple customer rows depending on input format or Telegram contact format.

Step 12 fix:

Backend customer identity paths now use one shared normalizer. Canonical persisted customer phone format is `+998XXXXXXXXX`. Accepted equivalent inputs include `+998901234567`, `998901234567`, `90 123 45 67`, `+998 (90) 123-45-67`, and `00998901234567`. Invalid short/long/non-Uzbek values are rejected through the existing validation/error path. Telegram contact ownership validation remains unchanged.

Fixed: YES locally, not deployed.

### AUD-004: Pending customer order attempts can block retry after an interruption

Severity: P2 MEDIUM

File: `apps/backend/src/modules/customers/customer-order-engine.service.ts`

Original evidence:

The idempotency attempt TTL is 24 hours. A duplicate request waits for 15 seconds; if the original attempt remains `PENDING`, the service returns "Checkout is already being processed." A process crash or hard interruption after attempt reservation can leave the same key blocked until expiry.

Production impact:

A customer may be unable to retry the same checkout payload with the same stored idempotency key after an infrastructure interruption.

Step 12 fix:

Customer order idempotency now distinguishes completed/recoverable attempts from active pending attempts. If a same-key attempt already has a `customerOrderId`, the engine reuses the existing order and repairs the attempt status to `COMPLETED` if needed. If a same-key `PENDING` attempt has no order and is older than the named stale threshold, it is removed and the retry reserves a fresh attempt. Active `PENDING` attempts still wait and then reject without creating duplicate order graph rows.

Fixed: YES locally, not deployed.

### AUD-005: Random/derived business numbers have no collision retry

Severity: P2 MEDIUM

Files:

- `apps/backend/src/modules/customers/customer-order-engine.service.ts`
- `apps/backend/src/modules/orders/orders.service.ts`
- `apps/backend/src/modules/kitchen/kitchen.service.ts`
- `apps/backend/src/modules/payments/payments.service.ts`
- `apps/backend/src/modules/shifts/shifts.service.ts`

Evidence:

Order numbers, ticket numbers, receipt numbers, and branch shift numbers rely on timestamp/random/latest-plus-one generation. Unique constraints exist for several values, but no retry loop or locking strategy is visible.

Production impact:

Rare collisions or concurrent shift opens can fail otherwise valid operations.

Recommended fix:

Wrap number creation in bounded retries on unique-conflict errors. For shift numbers, use a branch-scoped counter or transaction-safe locking.

Fixed: NO.

### AUD-006: Telegram category product listing is capped without pagination

Severity: P2 MEDIUM

File: `apps/backend/src/modules/telegram/telegram-customer-ordering.service.ts`

Evidence:

Category product list uses `take: 8`. No "next page" flow is visible.

Production impact:

If a category has more than 8 active products, Telegram customers cannot reach the rest through that category screen.

Step 13 fix:

Telegram category screens now use a named `TELEGRAM_MENU_PAGE_SIZE` constant and fetch one extra product to detect whether a next page exists. Callback data supports `cust:cat:<categoryId>:<page>` with invalid page values falling back safely to page 1. Navigation remains edit-in-place and shows compact previous/next controls without exposing inactive products or changing the Step 10 virtual Lavash/Burger family grouping.

Fixed: YES locally, not deployed.

### AUD-007: Telegram cart does not merge identical quick-add items

Severity: P2 MEDIUM

Files:

- `apps/backend/src/modules/telegram/telegram-customer-ordering.service.ts`
- `apps/backend/prisma/schema.prisma`

Evidence:

Telegram `addCartItem` always creates a new `CartItem` row with quantity `1`. Customer-web merges identical configured items in local cart. The schema has no uniqueness constraint for identical cart line identity.

Production impact:

Repeated taps create multiple identical lines instead of increasing quantity. This is not duplicate order creation, but it is a cart UX and data consistency issue.

Step 13 fix:

Telegram add-to-cart now merges equivalent plain cart lines by `cartId + productId + variantId + empty modifier selection + no notes`. Lines with modifiers or different product/variant choices remain separate. The merge runs in a transaction and uses a PostgreSQL advisory transaction lock derived from the cart line identity, avoiding a schema migration while closing the concurrent quick-add race for this path.

Fixed: YES locally, not deployed.

### AUD-008: Customer orders page reacts to every order websocket event

Severity: P2 MEDIUM

File: `apps/customer-web/app/orders/page.tsx`

Evidence:

The orders page opens a websocket and reloads history on order status events. The client-side reload is not scoped to the authenticated customer's order id.

Production impact:

As traffic grows, unrelated order updates can trigger excessive customer history refetches.

Recommended fix:

Scope websocket updates by relevant order/customer where possible, or filter event payloads before refetching.

Fixed: NO.

### AUD-009: Production media volume is empty

Severity: P2 MEDIUM

Files:

- `apps/media/nginx.conf`
- `apps/media/Dockerfile`
- `apps/customer-web/lib/cart.tsx`
- `apps/customer-web/components/media-image.tsx`

Evidence:

Media service is configured to serve `/media/products` and `/media/categories`. Prior production inspection showed those folders exist but contain no files. Customer-web falls back to local extracted source media where available, but direct production media URLs still return 404.

Production impact:

Direct image URLs such as `https://media.mazettofood.uz/categories/lavash.webp` return 404 until files are uploaded.

Step 13 readiness fix:

Repository-side media delivery preparation now includes a deterministic manifest and validator for the approved local source assets. The media service still expects nginx root `/media`, with `/media/categories` and `/media/products` matching the database URL paths. The release copy script is dry-run by default and copies only approved existing assets into the target media volume path when an explicit `--target` is supplied during a later controlled release.

Fixed: LOCAL READINESS YES; production media volume was not modified.

### AUD-010: Production-dangerous Prisma script name

Severity: P2 MEDIUM

File: `apps/backend/package.json`

Evidence:

`prisma:migrate` runs `prisma migrate dev`. Production instructions correctly use `prisma migrate deploy`, but the script name is easy to misuse on a server.

Production impact:

A future operator could accidentally run a development migration command against production.

Step 13 fix:

`apps/backend/package.json` now makes `prisma:migrate` production-safe by pointing it to `prisma migrate deploy`. Explicit scripts separate the two workflows: `prisma:migrate:deploy` for release/prod-like use and `prisma:migrate:dev` for local development.

Fixed: YES locally, not deployed.

### AUD-011: Inventory deduction depends on branch warehouse readiness

Severity: P2 MEDIUM

Files:

- `apps/backend/src/modules/orders/orders.service.ts`
- `apps/backend/src/modules/inventory/inventory.service.ts`

Evidence:

Confirmed orders deduct recipe stock through the branch's first active warehouse. If recipe items exist and no active warehouse exists, order confirmation can fail.

Production impact:

Once real recipes are configured, customer/POS orders can fail until warehouses and stock are operationally prepared.

Recommended fix:

Before enabling recipe-based deduction in production, create branch warehouse readiness checks and a clear admin warning.

Fixed: NO.

### AUD-012: Customer tokens are stored in localStorage

Severity: P2 MEDIUM

File: `apps/customer-web/lib/cart.tsx`

Evidence:

Customer access and refresh tokens are persisted in browser localStorage.

Production impact:

An XSS bug would expose tokens. This is common in MVPs, but it should be hardened before broader production use.

Recommended fix:

Move refresh-token persistence to secure, httpOnly, same-site cookies or a backend session flow.

Fixed: NO.

## P3 Findings

### AUD-013: Documentation drift in production deployment notes

Severity: P3 LOW

File: `docs/PRODUCTION_DEPLOYMENT.md`

Evidence:

Some deployment notes still describe earlier CORS/WebSocket behavior, while code now has restricted production origins.

Production impact:

Operator confusion.

Fixed: NO.

### AUD-014: Obsolete Telegram helper methods remain in auth service

Severity: P3 LOW

File: `apps/backend/src/modules/telegram/telegram-customer-auth.service.ts`

Evidence:

Old private menu/cart/profile helpers remain even though the active ordering flow is handled by `TelegramCustomerOrderingService`.

Production impact:

Future maintainers can accidentally reconnect stale behavior.

Fixed: NO.

### AUD-015: CRLF/LF warnings continue

Severity: P3 LOW

Repository-wide.

Evidence:

Previous `git diff --check` runs passed whitespace checks but warned that LF will be replaced by CRLF on Windows.

Production impact:

No direct runtime impact, but noisy diffs and review churn.

Fixed: NO.

### AUD-016: Standalone print-agent and telegram-bot apps are placeholders

Severity: P3 LOW

Files:

- `apps/print-agent/src/main.ts`
- `apps/telegram-bot/src/main.ts`

Evidence:

Both apps only start/log and do not implement production behavior.

Production impact:

They should not be deployed as if they are active MAZETTO services.

Fixed: NO.

### AUD-017: Media host is hardcoded in Next image config

Severity: P3 LOW

File: `apps/customer-web/next.config.ts`

Evidence:

`media.mazettofood.uz` is the configured remote image host. The runtime resolver can point elsewhere, but Next image optimization will only apply to the configured host.

Production impact:

Changing CDN/media domain later requires code/config update.

Fixed: NO.

## Backend Audit

Backend structure is active and module-based. `PrismaService` uses Prisma 7 with `@prisma/adapter-pg` and `pg Pool`, and fails clearly when `DATABASE_URL` is absent. Global validation and response wrapping are enabled.

Customer endpoints use `CustomerAuthGuard` plus `@Public()` to bypass staff JWT while still requiring customer JWT on protected customer routes. Customer order list/detail scope by `customerId`, which protects order ownership.

Admin and POS routes use permission decorators and branch scope helpers. This audit did not prove every POS/admin workflow production-complete; they should be treated as partial except where separately validated.

## Customer Web Audit

Customer web has active production routes for home, menu, product detail, cart, checkout, success, orders, order detail, and profile. It uses Uzbek UI, media fallback handling, local cart state, customer auth panel, and authenticated order history.

The main customer-web blocker is visible delivery-fee calculation that is not mirrored by backend persisted totals. The second major UX risk is visible Click/Payme/Card choices without active provider settlement.

## Telegram Audit

The active customer Telegram bot implementation is inside backend `TelegramModule`, not `apps/telegram-bot`.

Step 10 implementation groups Lavash and Burger as Telegram-only virtual families, maps to product codes rather than DB IDs, hides unsupported combinations, uses callback toast on quick add, and prefers editing the same interactive message. Branch map links are generated from database latitude/longitude.

Remaining risks are service-level cart merge behavior, product pagination, stale old helper code, and the need to complete production activation/deploy of the local Step 10 commit.

## Order Engine Audit

The customer order engine is the correct central authority for web and Telegram customer orders. It snapshots item names, variants, modifiers, quantities, unit prices, and line totals from database state. It does not trust client-supplied item totals.

Idempotency is customer-scoped with unique `(customerId, idempotencyKey)` and request hash comparison. Completed retries return the original order. Same key with different payload is rejected. The remaining issue is stale `PENDING` attempt recovery.

## Prisma / Migration Audit

The schema has appropriate core relations and indexes for the MVP. The final schema includes customer Telegram linkage, carts, checkout sessions, order attempts, kitchen tickets, payments, shifts, inventory, recipes, branches, and media path fields.

Migration chain count: 16 migration folders. Historical migration `20260824233000_domain_model_consolidation` contains destructive drops of obsolete domain tables/columns. Do not edit historical migrations; ensure backups exist before production migration deploys.

## Seed Audit

Seed uses Prisma 7 adapter initialization, requires `DATABASE_URL`, upserts system roles/permissions/payment methods, reconciles role permissions, and runs menu seed idempotently. It does not create demo users.

Known seed behavior from prior verification: categories/products/variants/modifiers are idempotent. Branch creation is intentionally operational/admin controlled rather than fake-seeded.

## Payments Audit

Cashier payment flow uses transaction boundaries, active payment methods, idempotency operations, revenue records, receipts, shift cash transactions, and order completion. Online customer checkout does not yet represent real provider confirmation for Click/Payme.

## Cash Register Audit

Shift and cash transaction modules exist and are permission-protected. Shift number generation has a concurrency risk under simultaneous opens. Treat this as a hardening item before heavy cashier use.

## POS / Print Audit

`apps/pos-web` is partial and should not be treated as final POS. It has auth shell, admin pages, waiter/kitchen/POS pages, payment/shift/receipt screens, and a real API client, but offline mode and print-agent integration are not production-proven.

`apps/print-agent` is placeholder-only.

## Media Audit

Media nginx config is correct for static serving and caching. The missing production images are an operational content issue: the persistent volume is empty. Customer-web has a fallback chain for many local authentic assets, but direct media URLs remain 404.

Current authenticity state must remain: product coverage is not 35/35 authentic in production media. Known unresolved/fallback assets are drinks, sauces, chicken strips, and kids set assets documented in the work status.

## Deployment Audit

Dockerfiles use multi-stage builds and do not bake real database credentials. Backend image generation uses a build-only placeholder `DATABASE_URL` for Prisma generate. Runtime still requires real `DATABASE_URL`.

Customer-web Dockerfile supports build-time public API/media arguments. POS-web supports public API argument.

No production inspection or mutation was performed during this audit.

## Security Audit

No committed real secrets were found by the repository scan performed in this audit. Placeholder tokens in validation scripts are clearly synthetic.

Webhook secret checking exists for Telegram webhook route. Customer Telegram contact linking validates `contact.user_id` against `message.from.id`.

Main hardening items: browser localStorage token storage, phone normalization consistency, and avoiding raw business/debug data in future logs.

## Testing Gaps

Covered by existing validators:

- Telegram customer auth
- Telegram customer ordering presentation
- Telegram catalog mapping
- Customer order history
- Isolated customer order E2E DB validation

Remaining gaps:

- Delivery fee authoritative total.
- Real Click/Payme provider flow.
- POS cashier/payment E2E under concurrent submits.
- Shift open concurrency.
- Media volume content deployment verification.
- Production activation of Step 10 local Telegram UX.

## Documentation Drift

`docs/MAZETTO_WORK_STATUS.md` has useful detail but stale top summary rows around Customer Telegram Bot and staff Telegram state. This audit updates the status document with an evidence-based full-audit checkpoint.

## Production Risks

1. Empty media volume continues to cause direct production media URL 404s.
2. Step 10 and Step 11 changes are local-only until explicitly released.
3. POS/print-agent should not be treated as final production desktop/POS stack.

## Recommended Fix Order

1. Upload approved production media files to `mazetto-media`.
2. Add Telegram category pagination and cart merge.
3. Add number-collision retry for order/ticket/receipt/shift numbers.
4. Clean docs drift and placeholder app warnings.

## Verified Safe Areas

- Prisma 7 adapter initialization in app and seed.
- Customer order item pricing uses backend database values.
- Customer order detail/history are scoped by authenticated customer.
- Telegram contact ownership check exists.
- Staff notification failure is not coupled to customer order success.
- Backend Docker build does not require real production DB credentials.

## Unverified Areas

- Full production POS cashier/payment operations.
- Real receipt printing through a desktop/agent flow.
- Real Click/Payme provider settlement.
- Production media content upload.
- Production deployment of local Step 10 Telegram UX.

## Validation Results

Commands completed successfully:

- Prisma format
- Prisma validate
- Prisma generate
- Backend typecheck
- Backend lint
- Backend build
- Customer-web typecheck
- Customer-web lint
- Customer-web build
- Telegram catalog mapping validator
- Telegram customer ordering validator
- Telegram customer auth validator
- Customer order history validator
- Workspace typecheck
- Workspace lint
- `git diff --check`

Workspace build result:

- Turbo reported `9 successful, 9 total`.
- After success, the Turbo runner did not exit within the follow-up wait window and had to be interrupted.
- This matches the previously observed build-runner hang. The application build tasks themselves completed successfully, but the root build command exit behavior remains a tooling issue to investigate.

Whitespace result:

- `git diff --check` returned exit code 0.
- Windows reported LF-to-CRLF warnings for modified markdown files.

## Final Finding Table

| ID | Severity | Area | File | Issue | Production Impact | Fixed? | Commit |
| --- | --- | --- | --- | --- | --- | --- | --- |
| AUD-001 | P1 | Customer checkout/order engine | `apps/customer-web/app/checkout/page.tsx`; `apps/backend/src/modules/customers/customer-order-engine.service.ts` | Delivery fee displayed but backend total excludes it | Customer/staff total mismatch | Yes locally | pending commit |
| AUD-002 | P1 | Customer checkout/payment | `apps/customer-web/app/checkout/page.tsx`; `apps/backend/src/modules/customers/dto/customer.dto.ts` | Click/Payme/Card visible without provider settlement | Payment expectation mismatch | Yes locally | pending commit |
| AUD-003 | P2 | Customer identity | `apps/backend/src/modules/customers/customers.service.ts` | Local phone formats can duplicate customers | Duplicate customer identity | Yes locally | pending commit |
| AUD-004 | P2 | Idempotency | `apps/backend/src/modules/customers/customer-order-engine.service.ts` | Stale pending attempts block retry | Checkout retry friction | Yes locally | pending commit |
| AUD-005 | P2 | Numbering | Backend order/kitchen/payment/shift services | No retry on unique number collision | Rare failed valid operations | No | n/a |
| AUD-006 | P2 | Telegram menu | `apps/backend/src/modules/telegram/telegram-customer-ordering.service.ts` | Product list capped at 8 without pagination | Hidden products in Telegram | Yes locally | pending commit |
| AUD-007 | P2 | Telegram cart | `apps/backend/src/modules/telegram/telegram-customer-ordering.service.ts` | Identical Telegram items do not merge | Cart clutter and drift from web behavior | Yes locally | pending commit |
| AUD-008 | P2 | Customer web orders | `apps/customer-web/app/orders/page.tsx` | Order status events refetch all history | Scaling/performance noise | No | n/a |
| AUD-009 | P2 | Media | `apps/media/nginx.conf`; media volume | Production volume has no image files | Direct media URLs 404 | Local readiness only | pending commit |
| AUD-010 | P2 | Deployment scripts | `apps/backend/package.json` | `prisma:migrate` uses `migrate dev` | Operator mistake risk | Yes locally | pending commit |
| AUD-011 | P2 | Inventory/order | `apps/backend/src/modules/orders/orders.service.ts` | Recipe deduction needs active warehouse | Future order failures when recipes enabled | No | n/a |
| AUD-012 | P2 | Frontend auth | `apps/customer-web/lib/cart.tsx` | Tokens stored in localStorage | XSS token exposure risk | No | n/a |
| AUD-013 | P3 | Docs | `docs/PRODUCTION_DEPLOYMENT.md` | CORS/WebSocket docs stale | Operator confusion | No | n/a |
| AUD-014 | P3 | Telegram | `apps/backend/src/modules/telegram/telegram-customer-auth.service.ts` | Old helper methods remain | Maintenance drift | No | n/a |
| AUD-015 | P3 | Git hygiene | repository | LF/CRLF warnings on Windows | Review noise | No | n/a |
| AUD-016 | P3 | Placeholder apps | `apps/print-agent`; `apps/telegram-bot` | Placeholder services | Deployment confusion | No | n/a |
| AUD-017 | P3 | Media config | `apps/customer-web/next.config.ts` | Media remote host hardcoded | Future CDN change friction | No | n/a |
