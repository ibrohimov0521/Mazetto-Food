# MAZETTO FOOD Full Code Audit

Date: 2026-08-29

Starting HEAD: `9003b1458483394a72822dd66b15125642e323f1`

> Historical snapshot only. The finding details and `Fixed: NO` rows below describe
> the state observed on 2026-08-29; they are not a current backlog. Later fixes,
> releases, and remaining acceptance gates are tracked in
> [`MAZETTO_AUDIT_2026-10-10.md`](./MAZETTO_AUDIT_2026-10-10.md).

Production baseline during the original audit was `d3ba37de2e458a473af73d543049f097ce2ebdb4`. Step 14 later deployed the approved local remediation chain through `568b6ac121e953cea6a06c108e9b3f43949849d8` after backup and preflight.

## Executive Summary

The MAZETTO FOOD repository contains a working production MVP with a NestJS backend, customer web, POS web, media nginx service, Prisma/PostgreSQL schema, production migrations, seed structure, customer Telegram auth/order code in the backend, and validation scripts.

The first-pass release blockers were a customer-facing delivery-fee mismatch and public online payment options shown before real provider settlement existed. Both were fixed and production-smoke-verified: checkout quote/order creation share the backend pricing policy, and customer checkout exposes only `CASH` until provider settlement is integrated. Current audit-branch changes are separate and remain unreleased.

No committed secrets were found in the repository by the current scan. Customer ownership checks for customer order history/detail are scoped by `customerId`. The proven order engine uses server-side product, variant, and modifier pricing, not client-supplied item totals.

## Repository Inventory

| Area                  | Classification      | Evidence                                                                                                                  |
| --------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `apps/backend`        | ACTIVE              | NestJS modules, Prisma 7 adapter, production Dockerfile, migrations, seed, validation scripts.                            |
| `apps/customer-web`   | ACTIVE              | Next.js customer app with menu, cart, checkout, profile, orders, media resolver.                                          |
| `apps/pos-web`        | PARTIAL             | Real routes and API client exist, but offline/print/production POS completeness is not proven.                            |
| `apps/media`          | ACTIVE INFRA        | nginx static service exists; production media manifest was checked read-only, with one unused category URL returning 404. |
| `apps/print-agent`    | PLACEHOLDER         | Startup log only.                                                                                                         |
| `apps/telegram-bot`   | PLACEHOLDER         | Startup log only; current customer Telegram bot lives inside backend.                                                     |
| `packages/api-client` | PARTIAL             | Shared API client package exists, limited usage.                                                                          |
| `packages/config`     | PLACEHOLDER/PARTIAL | Minimal shared config package.                                                                                            |
| `packages/types`      | PARTIAL             | Shared type package exists.                                                                                               |
| `packages/ui`         | PLACEHOLDER/PARTIAL | Minimal UI export exists.                                                                                                 |
| `docs`                | ACTIVE BUT DRIFTING | Work status is useful but contains stale top-level rows and production deployment notes.                                  |

Tracked files inventoried: 1,259. This inventory is not evidence that every line in every file received manual review.

## Architecture Map

Customer web and Telegram both create customer orders through the backend customer order architecture. Customer web keeps a local cart and sends an authenticated checkout request. Telegram keeps persistent cart rows and checkout session rows, then calls `CustomerOrderEngineService`.

`CustomerOrderEngineService` creates the operational `Order`, snapshots items with authoritative database prices, writes `OrderStatusHistory`, confirms the order for preparation through `OrdersService`, creates the customer-facing `CustomerOrder`, completes `CustomerOrderAttempt`, and creates a `KitchenTicket`.

The media architecture is split: database rows store relative paths such as `/products/lavash-big.webp`; customer-web resolves those to `NEXT_PUBLIC_MEDIA_URL`, then falls back to packaged authentic media, then branded fallback. Read-only production checks passed for 84 of 85 manifest URLs; the remaining 404 was `/categories/blyudalar.webp`, which the live category API does not reference. Media content completeness still requires an approved inventory and direct verification.

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

Backend `CustomerOrderEngineService` exposes an authenticated checkout quote and applies the same policy during final order creation. Current code reads the tenant's delivery fee and free-delivery radius settings; defaults are 20,000 so'm and 1,000 m, while pickup is always free. The actual saved production values were not inspected, so the restaurant must confirm its intended fee/radius before enabling delivery. `Order.deliveryFeeTotal` and `Order.total` are persisted from the backend calculation.

Fixed: YES, deployed and smoke-verified in Step 14.

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

Fixed: YES, deployed and smoke-verified in Step 14.

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

Fixed: YES, deployed and smoke-verified in Step 14.

### AUD-004: Pending customer order attempts can block retry after an interruption

Severity: P2 MEDIUM

File: `apps/backend/src/modules/customers/customer-order-engine.service.ts`

Original evidence:

The idempotency attempt TTL is 24 hours. A duplicate request waits for 15 seconds; if the original attempt remains `PENDING`, the service returns "Checkout is already being processed." A process crash or hard interruption after attempt reservation can leave the same key blocked until expiry.

Production impact:

A customer may be unable to retry the same checkout payload with the same stored idempotency key after an infrastructure interruption.

Step 12 fix:

Customer order idempotency now distinguishes completed/recoverable attempts from active pending attempts. If a same-key attempt already has a `customerOrderId`, the engine reuses the existing order and repairs the attempt status to `COMPLETED` if needed. If a same-key `PENDING` attempt has no order and is older than the named stale threshold, it is removed and the retry reserves a fresh attempt. Active `PENDING` attempts still wait and then reject without creating duplicate order graph rows.

Fixed: YES, deployed and smoke-verified in Step 14.

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

Re-review (2026-10-11): POS checkout and normal order creation retry bounded unique conflicts; kitchen ticket creation retries collisions; shift numbering takes a branch-scoped transaction advisory lock; receipt IDs are allocated under a per-candidate lock. The blanket finding is stale and closed against current code/tests.

### AUD-006: Telegram category product listing is capped without pagination

Severity: P2 MEDIUM

File: `apps/backend/src/modules/telegram/telegram-customer-ordering.service.ts`

Evidence:

Category product list uses `take: 8`. No "next page" flow is visible.

Production impact:

If a category has more than 8 active products, Telegram customers cannot reach the rest through that category screen.

Step 13 fix:

Telegram category screens now use a named `TELEGRAM_MENU_PAGE_SIZE` constant and fetch one extra product to detect whether a next page exists. Callback data supports `cust:cat:<categoryId>:<page>` with invalid page values falling back safely to page 1. Navigation remains edit-in-place and shows compact previous/next controls without exposing inactive products or changing the Step 10 virtual Lavash/Burger family grouping.

Fixed: YES, deployed and smoke-verified in Step 14.

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

Fixed: YES, deployed and smoke-verified in Step 14.

### AUD-008: Customer orders page reacts to every order websocket event

Severity: P2 MEDIUM

File: `apps/customer-web/app/orders/page.tsx`

Evidence:

The orders page opens a websocket and reloads history on order status events. The client-side reload is not scoped to the authenticated customer's order id.

Production impact:

As traffic grows, unrelated order updates can trigger excessive customer history refetches.

Recommended fix:

Scope websocket updates by relevant order/customer where possible, or filter event payloads before refetching.

Re-review (2026-10-11): Event IDs are now extracted from top-level, nested order, and kitchen-ticket payloads. Existing orders refresh through the single-order endpoint; new orders and reconnect/focus recovery retain the full refresh. Regression tests cover payload matching. Fixed locally; pending release.

### AUD-018: Telegram checkout errors can be reported as phone-linking failures

Severity: P2 MEDIUM

File: `apps/backend/src/modules/telegram/telegram-customer-auth.service.ts`

Evidence:

Step 14B human production smoke showed a linked Telegram customer entered a delivery address and pressed `O'tkazib yuborish` for courier note. Production logs showed the real underlying error was `Branch is not accepting orders now`, because the smoke was performed before MAZETTO Sergeli opening time. The webhook catch block still sent the generic phone-linking failure message.

Production impact:

Customers can be told to relink Telegram even when their account is already linked and the real problem is branch/order availability. This blocks clear recovery during Telegram checkout.

Step 14C fix:

Auth/contact errors still use the phone-linking message, but non-contact customer interactions now receive operation-specific Uzbek errors for branch closed, delivery disabled, pickup disabled, missing branch, or a generic interaction failure.

Fixed: YES, deployed and verified in Step 14D.

### AUD-019: Telegram post-success cart reuse can collide with the previous idempotency key

Severity: P2 MEDIUM

File: `apps/backend/src/modules/telegram/telegram-customer-ordering.service.ts`

Evidence:

Step 15 isolated PostgreSQL reproduction showed that a successful Telegram order clears the submitted cart items and checkout session. If the customer adds a new item afterward, the existing `Cart` row can be reused while `Cart.updatedAt` remains unchanged. The Telegram confirmation idempotency key previously used `customerId + cartId + cart.updatedAt`, so the second checkout could reuse the first order's key with a different payload.

Production impact:

A valid second Telegram order after a successful order can fail with `Idempotency key was already used with a different checkout request`. This is not duplicate order creation, but it is a post-order checkout recovery bug.

Step 15 fix:

Telegram confirmation idempotency keys now use a SHA-256 fingerprint of the actual checkout state: customer, cart id, branch, order type, address, note, cart item ids, product/variant ids, quantity, modifiers, item notes, and item timestamps when present. Same-payload retry/concurrent confirms remain stable, while new post-success cart contents get a new key.

### AUD-020: Staff Telegram callbacks could skip lifecycle authorization and status sequencing

Severity: P2 MEDIUM

Area:

- `apps/backend/src/modules/telegram/telegram-order-notification.service.ts`

Finding:

The staff Telegram order notification service previously accepted status-like callback payloads and applied the requested order status directly after webhook secret validation. It did not verify that the callback came from the configured staff chat, showed all status buttons on every order notification, sent a new staff message for each status change, and allowed stale/out-of-order actions such as jumping from a new kitchen ticket directly to ready.

Impact:

An old or unauthorized Telegram callback could create confusing order/kitchen state changes, duplicate staff chat noise, or status history drift. The risk is lower than a public API auth bypass because webhook secret validation still existed, but staff lifecycle transitions were not server-authoritative enough for production kitchen operations.

Fix status:

Fixed locally in Step 16. Staff callbacks now require `TELEGRAM_STAFF_CHAT_ID`, use action-based transitions, enforce `NEW/CONFIRMED -> PREPARING -> READY` sequencing, support valid pre-ready cancellation, keep legacy status callbacks as safe aliases, edit staff messages in place when possible, write `OrderStatusHistory` only on real order-status changes, notify linked customers non-blockingly, and validate duplicate/stale/concurrent callbacks with an isolated PostgreSQL lifecycle script. Production activation remains pending.

Fixed: YES, deployed and smoke-verified in Step 15.

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

Fixed: YES for the 37 approved available assets, deployed and smoke-verified in Step 14. Eight unresolved product assets remain fallback-only.

### AUD-010: Production-dangerous Prisma script name

Severity: P2 MEDIUM

File: `apps/backend/package.json`

Evidence:

`prisma:migrate` runs `prisma migrate dev`. Production instructions correctly use `prisma migrate deploy`, but the script name is easy to misuse on a server.

Production impact:

A future operator could accidentally run a development migration command against production.

Step 13 fix:

`apps/backend/package.json` now makes `prisma:migrate` production-safe by pointing it to `prisma migrate deploy`. Explicit scripts separate the two workflows: `prisma:migrate:deploy` for release/prod-like use and `prisma:migrate:dev` for local development.

Fixed: YES, deployed in Step 14.

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

Re-review (2026-10-11): Warehouse archival now checks nonzero stock and recipe-backed products in a transaction while locking the branch row. It refuses archiving the last active warehouse when recipes need inventory. Readiness regressions pass. Fixed locally; pending release.

### AUD-012: Customer tokens are stored in localStorage

Severity: P2 MEDIUM

File: `apps/customer-web/lib/cart.tsx`

Evidence:

Customer access and refresh tokens are persisted in browser localStorage.

Production impact:

An XSS bug would expose tokens. This is common in MVPs, but it should be hardened before broader production use.

Recommended fix:

Move refresh-token persistence to secure, httpOnly, same-site cookies or a backend session flow.

Fixed: YES. Access/refresh tokens are excluded from localStorage; refresh is cookie-backed. Regression coverage exists in `apps/customer-web/test/customer-session-storage.test.mjs`.

## P3 Findings

### AUD-013: Documentation drift in production deployment notes

Severity: P3 LOW

File: `docs/PRODUCTION_DEPLOYMENT.md`

Evidence:

Some deployment notes still describe earlier CORS/WebSocket behavior, while code now has restricted production origins.

Production impact:

Operator confusion.

Re-review (2026-10-11): Updated the contradictory deployment notes. HTTP and websocket CORS use one exact-origin allowlist; credentials are enabled and wildcard origins are rejected. Fixed locally; pending release.

### AUD-014: Obsolete Telegram helper methods remain in auth service

Severity: P3 LOW

File: `apps/backend/src/modules/telegram/telegram-customer-auth.service.ts`

Evidence:

Old private menu/cart/profile helpers remain even though the active ordering flow is handled by `TelegramCustomerOrderingService`.

Production impact:

Future maintainers can accidentally reconnect stale behavior.

Re-review (2026-10-11): Removed the duplicate category/history/profile handlers; the active customer ordering service owns those actions. Fixed locally; pending release.

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

Re-review (2026-10-11): Both apps have operational code: print-agent polls/routes print jobs, and telegram-bot checks webhook/backend health and queue status. The placeholder classification was inaccurate and is closed after source review.

### AUD-017: Media host is hardcoded in Next image config

Severity: P3 LOW

File: `apps/customer-web/next.config.ts`

Evidence:

`NEXT_PUBLIC_MEDIA_URL` now determines the Next remote image pattern. It supports the configured HTTP(S) origin, optional port and path prefix, while rejecting credentials, query strings, fragments, and non-HTTP schemes. The existing production host remains the fallback.

Production impact:

Changing the media host no longer requires editing Next config.

Fixed locally on the audit branch; unit tests and customer-web builds passed with both the production default and a local HTTP media URL.

## Backend Audit

Backend structure is active and module-based. `PrismaService` uses Prisma 7 with `@prisma/adapter-pg` and `pg Pool`, and fails clearly when `DATABASE_URL` is absent. Global validation and response wrapping are enabled.

Customer endpoints use `CustomerAuthGuard` plus `@Public()` to bypass staff JWT while still requiring customer JWT on protected customer routes. Customer order list/detail scope by `customerId`, which protects order ownership.

Admin and POS routes use permission decorators and branch scope helpers. This audit did not prove every POS/admin workflow production-complete; they should be treated as partial except where separately validated.

## Customer Web Audit

Customer web has active production routes for home, menu, product detail, cart, checkout, success, orders, order detail, and profile. It uses Uzbek UI, media fallback handling, local cart state, customer auth panel, and authenticated order history.

Backend checkout quotes and persists the authoritative total using tenant-configured delivery fee/radius; source defaults are 20,000 so'm and 1,000 m, and pickup is free. The live saved values were not read. Customer checkout exposes CASH only. Customer order ownership, phone canonicalization, modifiers, reorder reconstruction, media URL handling, and realtime targeted refresh have regression coverage. Latest audit-branch changes are not yet released.

## Telegram Audit

The active customer Telegram bot implementation is inside backend `TelegramModule`, not `apps/telegram-bot`.

Customer Telegram ordering groups supported virtual menu families, paginates categories, merges equivalent quick-add lines, and has a chat-bound product modifier configurator with server-side revalidation and duplicate-callback protection. Staff callbacks enforce chat binding and order lifecycle transitions in local code. Production webhook/provider verification was not completed because credentials were unavailable to the read-only audit shell; do not infer that latest local Telegram changes are active in production.

## Order Engine Audit

The customer order engine is the correct central authority for web and Telegram customer orders. It snapshots item names, variants, modifiers, quantities, unit prices, and line totals from database state. It does not trust client-supplied item totals.

Idempotency is customer-scoped with unique `(customerId, idempotencyKey)` and request-hash comparison. Completed retries return the original order; the same key with a different payload is rejected. Pending-attempt recovery uses each persisted expiry and tenant TTL, with regression and database-backed acceptance coverage.

## Prisma / Migration Audit

The schema has appropriate core relations and indexes for the MVP. The final schema includes customer Telegram linkage, carts, checkout sessions, order attempts, kitchen tickets, payments, shifts, inventory, recipes, branches, and media path fields.

The original 2026-08-29 snapshot had 16 migration folders; later isolated acceptance applied the current chain of 59 migrations. Historical migration `20260824233000_domain_model_consolidation` contains destructive drops of obsolete domain tables/columns. Do not edit historical migrations; ensure backups exist before production migration deploys.

## Seed Audit

Seed uses Prisma 7 adapter initialization, requires `DATABASE_URL`, upserts system roles/permissions/payment methods, reconciles role permissions, and runs menu seed idempotently. It does not create demo users.

Known seed behavior from prior verification: categories/products/variants/modifiers are idempotent. Branch creation is intentionally operational/admin controlled rather than fake-seeded.

## Payments Audit

Cashier payment flow uses transaction boundaries, active payment methods, idempotency operations, revenue records, receipts, shift cash transactions, and order completion. Online customer checkout does not yet represent real provider confirmation for Click/Payme.

## Cash Register Audit

Shift and cash transaction modules are permission-protected. The original shift-number concurrency risk was addressed with branch-level serialization; disposable PostgreSQL acceptance covers simultaneous opens by different cashiers and duplicate opens by one cashier. This does not replace production-load monitoring.

## POS / Print Audit

POS and print-agent flows have automated coverage for offline replay, receipt parity, shift reports, and multi-printer routing. Physical acceptance on the restaurant workstation, including its installed drivers and actual receipt printer, remains required before calling hardware behavior verified.

## Media Audit

Media nginx config serves static assets with caching. The local manifest contains 11 category and 74 product assets. Read-only production HEAD checks passed 84/85 URLs; the only failed path, /categories/blyudalar.webp, is not referenced by the live category API. Verify the approved manifest and fallback coverage before claiming complete production media acceptance.

## Deployment Audit

Dockerfiles use multi-stage builds and do not bake real database credentials. Backend image generation uses a build-only placeholder `DATABASE_URL` for Prisma generate. Runtime still requires real `DATABASE_URL`.

Customer-web Dockerfile supports build-time public API/media arguments. POS-web supports public API argument.

Read-only production health smoke passed 27/27 in the audit sequence. No production database mutation, migration, source deployment, or media-volume change was performed for the current local audit branch. Production release remains gated by the checklist and explicit approval.

## Security Audit

No committed real secrets were found by the repository scan performed in this audit. Placeholder tokens in validation scripts are clearly synthetic.

Webhook secret checking exists for Telegram webhook route. Customer Telegram contact linking validates `contact.user_id` against `message.from.id`.

Customer auth tokens are no longer persisted in browser localStorage; customer phone identity paths share canonical Uzbek-number normalization. Tenant forwarding headers are overwritten from the direct request Host at both Next.js app boundaries for API paths. This is defense in depth; edge-proxy behavior still belongs in production acceptance. Avoid logging raw business/customer data.

## Testing Gaps

Covered by existing validators:

- Telegram customer auth
- Telegram customer ordering presentation
- Telegram catalog mapping
- Customer order history
- Isolated customer order E2E DB validation

Remaining evidence gaps:

- Real Click/Payme/NBU settlement and SMS-to-order reconciliation are not integrated or verified; CASH-only customer checkout remains intentional. Cashier-selected non-cash methods are manual acceptance, not provider confirmation.
- Production tenant delivery-fee and free-radius values were not inspected; confirm them with the restaurant owner before enabling delivery. The source defaults are 20,000 so'm and 1,000 m.
- Concurrent POS checkout/payment behavior has unit/idempotency and isolated database coverage, but no production-load acceptance.
- Physical acceptance on the restaurant's intended receipt printer and installed driver is not independently evidenced by automated tests. The user reported a printer test as successful; the actual checkout receipt-printer model still needs explicit confirmation.
- Telegram webhook status and live provider callbacks were not checked because production credentials were not available to the audit shell.
- Production media URL coverage is 84/85; the failed category URL is unused by the live catalog, but manifest completeness remains an operational check.
- Latest audit-branch code has not been merged/released. Production readiness must be re-evaluated after grouped CI and release preflight.

## Documentation Drift

`docs/MAZETTO_WORK_STATUS.md` and this audit contained older summary rows that contradicted later verification (including delivery totals, phone normalization, payment-method settings, shift concurrency, and Telegram cart/pagination). Treat date-stamped follow-up entries as the evidence trail; keep the current summary synchronized before release.

## Production Risks

1. Current audit-branch code is unmerged and undeployed; production still runs its existing release.
2. NBU/Click/Payme settlement has no automatic provider confirmation or SMS reconciliation; cashier confirmation remains manual.
3. Real Telegram webhook/provider state and the intended receipt printer/driver require authorized operational acceptance.
4. Production media URL coverage is 84/85; the failed category URL is unused by the live catalog, but manifest completeness remains an operational check.

## Recommended Fix Order

1. Continue the code audit by subsystem and review automated dead-code flags against dynamic routes, validators, config, and seed usage before deleting anything.
2. Resolve the documented external acceptance gaps: receipt printer/driver, bank/payment reconciliation, authorized Telegram webhook, and production media manifest.
3. Group verified code fixes into a reviewed PR; run the complete release gate, fresh backup/restore evidence check, and read-only smoke before any approved production release.

## Verified Safe Areas

- Prisma 7 adapter initialization in app and seed.
- Customer order item pricing uses backend database values.
- Customer order detail/history are scoped by authenticated customer.
- Telegram contact ownership check exists.
- Staff notification failure is not coupled to customer order success.
- Backend Docker build does not require real production DB credentials.

## Unverified Areas

- Live POS payment/shift behavior under actual production traffic; isolated database and browser regression tests pass.
- Actual restaurant checkout receipt printer and installed driver; the user reported a printer test as successful, but the checkout receipt-printer model is not documented.
- Click/Payme/NBU provider confirmation and SMS-to-order reconciliation.
- Authorized Telegram webhook and production callback status; latest local Telegram changes are not presumed active.
- Production media asset inventory and live URL verification (84/85 manifest URLs passed).

## Validation Results

- The latest full workspace verification before the forwarded-host fix passed 14 typecheck/lint tasks, 7 builds, 33 operational validators, and 955 tests.
- After that fix, customer web (32), POS (72), backend tenant/login (19), forwarded-host regression (4), and focused payment/settings tests (33) all passed; both Next production builds passed.
- `git diff --check` passes for the current working tree.
- Read-only production smoke previously passed 27/27; isolated acceptance applied all 59 migrations and restored the database into a disposable container.
- Automated checks do not prove the external printer, payment-provider, Telegram webhook, or production-load acceptance listed above.

## Final Finding Table

| ID      | Severity | Area                           | File                                                                                                                                                                                                                   | Issue                                                                                                   | Production Impact                                          | Fixed?                                                    | Commit                        |
| ------- | -------- | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | --------------------------------------------------------- | ----------------------------- |
| AUD-001 | P1       | Customer checkout/order engine | `apps/customer-web/app/checkout/page.tsx`; `apps/backend/src/modules/customers/customer-order-engine.service.ts`                                                                                                       | Delivery fee displayed but backend total excludes it                                                    | Customer/staff total mismatch                              | Yes, deployed                                             | `6a19124`, released `568b6ac` |
| AUD-002 | P1       | Customer checkout/payment      | `apps/customer-web/app/checkout/page.tsx`; `apps/backend/src/modules/customers/dto/customer.dto.ts`                                                                                                                    | Click/Payme/Card visible without provider settlement                                                    | Payment expectation mismatch                               | Yes, deployed                                             | `6a19124`, released `568b6ac` |
| AUD-003 | P2       | Customer identity              | `apps/backend/src/modules/customers/customers.service.ts`                                                                                                                                                              | Local phone formats can duplicate customers                                                             | Duplicate customer identity                                | Yes, deployed                                             | `dd8a920`, released `568b6ac` |
| AUD-004 | P2       | Idempotency                    | `apps/backend/src/modules/customers/customer-order-engine.service.ts`                                                                                                                                                  | Stale pending attempts block retry                                                                      | Checkout retry friction                                    | Yes, deployed                                             | `dd8a920`, released `568b6ac` |
| AUD-005 | P2       | Numbering                      | `apps/backend/src/modules/orders/orders.service.ts`; `apps/backend/src/modules/kitchen/kitchen.service.ts`; `apps/backend/src/modules/shifts/shifts.service.ts`; `apps/backend/src/modules/receipts/receipt-writer.ts` | Number collisions could fail valid creates                                                              | Rare failed valid operations                               | Yes, current safeguards verified                          | existing                      |
| AUD-006 | P2       | Telegram menu                  | `apps/backend/src/modules/telegram/telegram-customer-ordering.service.ts`                                                                                                                                              | Product list capped at 8 without pagination                                                             | Hidden products in Telegram                                | Yes, deployed                                             | `568b6ac`                     |
| AUD-007 | P2       | Telegram cart                  | `apps/backend/src/modules/telegram/telegram-customer-ordering.service.ts`                                                                                                                                              | Identical Telegram items do not merge                                                                   | Cart clutter and drift from web behavior                   | Yes, deployed                                             | `568b6ac`                     |
| AUD-008 | P2       | Customer web orders            | `apps/customer-web/app/[locale]/orders/page.tsx`; `apps/customer-web/lib/use-order-updates.ts`                                                                                                                         | Realtime payload IDs were read from the wrong field and every event reloaded the full dashboard/history | Delayed status display and unnecessary requests            | Yes, local only                                           | pending                       |
| AUD-009 | P2       | Media                          | `apps/media/nginx.conf`; media volume                                                                                                                                                                                  | Production volume had no image files                                                                    | Direct media URLs 404                                      | Yes for approved assets, deployed                         | `568b6ac`                     |
| AUD-010 | P2       | Deployment scripts             | `apps/backend/package.json`                                                                                                                                                                                            | `prisma:migrate` uses `migrate dev`                                                                     | Operator mistake risk                                      | Yes, deployed                                             | `568b6ac`                     |
| AUD-011 | P2       | Inventory/order                | `apps/backend/src/modules/inventory/inventory.service.ts`; `apps/backend/src/modules/orders/orders.service.ts`                                                                                                         | Last active warehouse could be archived despite recipe-backed products                                  | Future order failures when recipes enabled                 | Yes, local only                                           | pending                       |
| AUD-012 | P2       | Frontend auth                  | `apps/customer-web/lib/cart.tsx`                                                                                                                                                                                       | Tokens stored in localStorage                                                                           | XSS token exposure risk                                    | Yes, HttpOnly refresh cookie and token-free local profile | `f320fd3`                     |
| AUD-013 | P3       | Docs                           | `docs/PRODUCTION_DEPLOYMENT.md`                                                                                                                                                                                        | CORS/WebSocket instructions contradicted current source                                                 | Operator confusion                                         | Yes, local only                                           | pending                       |
| AUD-014 | P3       | Telegram                       | `apps/backend/src/modules/telegram/telegram-customer-auth.service.ts`                                                                                                                                                  | Old duplicate category/history/profile handlers remained                                                | Maintenance drift and keyboard routing ambiguity           | Yes, local only                                           | pending                       |
| AUD-015 | P3       | Git hygiene                    | repository                                                                                                                                                                                                             | LF/CRLF warnings on Windows                                                                             | Review noise                                               | No                                                        | n/a                           |
| AUD-016 | P3       | Operations apps                | `apps/print-agent`; `apps/telegram-bot`                                                                                                                                                                                | Earlier report mislabeled these executable printer/monitoring agents as placeholders                    | Deployment confusion                                       | Closed after source re-review                             | n/a                           |
| AUD-017 | P3       | Media config                   | `apps/customer-web/next.config.ts`                                                                                                                                                                                     | Media remote host hardcoded                                                                             | Custom/local media URLs rejected by Next image optimizer   | Fixed locally                                             | pending                       |
| AUD-018 | P2       | Telegram checkout              | `apps/backend/src/modules/telegram/telegram-customer-auth.service.ts`                                                                                                                                                  | Ordering callback errors can be reported as phone-linking failures                                      | Misleading recovery path during checkout                   | Yes, deployed                                             | `73d7407`                     |
| AUD-019 | P2       | Telegram checkout              | `apps/backend/src/modules/telegram/telegram-customer-ordering.service.ts`                                                                                                                                              | Post-success cart reuse can collide with previous idempotency key                                       | Valid next Telegram checkout can fail                      | Yes, deployed                                             | `b875f54`                     |
| AUD-020 | P2       | Staff Telegram                 | `apps/backend/src/modules/telegram/telegram-order-notification.service.ts`                                                                                                                                             | Staff callbacks were status-based, not staff-chat scoped, and could skip lifecycle sequencing           | Kitchen/order lifecycle drift and staff chat noise         | Yes, local only                                           | pending                       |
| AUD-021 | P2       | Operations health/backup       | `scripts/ops-health.mjs`; `scripts/ops-backup-db.mjs`                                                                                                                                                                  | Static Docker names did not match Dokploy task containers                                               | False database/Redis-down status and backup lookup failure | Yes, local only                                           | pending                       |
| AUD-022 | P2       | Shift-close printing           | `apps/pos-web/components/staff/shift-close-print-report.tsx`; `apps/pos-web/lib/offline-freshness.mjs`                                                                                                                 | Any cached resource in the cashier panel could mark a freshly fetched shift report as pending/offline   | Misleading printed close report                            | Fixed locally                                             | pending                       |
| AUD-023 | P2       | Customer checkout idempotency  | `apps/backend/src/modules/customers/customer-order-engine.service.ts`                                                                                                                                                  | A fixed two-minute age threshold could delete an attempt before its configured tenant TTL expired       | Duplicate checkout risk under a slow in-flight request     | Fixed locally                                             | pending                       |
| AUD-024 | P2       | Table lifecycle                | `apps/backend/src/modules/tables/tables.service.ts`                                                                                                                                                                    | Reactivating an archived table skipped active hall/number collision checks                              | Duplicate active table numbers                             | Fixed locally                                             | pending                       |
| AUD-025 | P2       | Table/hall validation          | `apps/backend/src/modules/tables/tables.service.ts`                                                                                                                                                                    | Whitespace-only names passed DTO minimum length and were stored blank after trimming                    | Unusable hall/table labels                                 | Fixed locally                                             | pending                       |
| AUD-026 | P3       | Hall code generation           | `apps/backend/src/modules/tables/tables.service.ts`                                                                                                                                                                    | Millisecond-based suffix could collide on concurrent same-name hall creation                            | Rare failed hall creation                                  | Fixed locally                                             | pending                       |
| AUD-027 | P3       | Desktop offline outbox         | `apps/desktop/src/gateway.ts`; `apps/pos-web/components/auth/desktop-status.tsx`                                                                                                                                       | JSON replay errors were shown raw in the cashier conflict list                                          | Cashier cannot identify why offline sync was rejected      | Fixed locally                                             | pending                       |

## Audit Continuation (2026-10-11)

- Inventory lifecycle review found that a global owner without an explicit tenant membership could write ingredient/warehouse audit rows with a null tenant even while the service had already resolved the sole active tenant. Those write paths now use the resolved tenant ID.
- Archiving a branch's last active warehouse now locks the branch row, rechecks current state and nonzero stock inside the transaction, and refuses the archive when recipe-backed products still require a warehouse. Archiving remains available when there are no recipe-backed products or another active warehouse remains. Four targeted regressions cover the deny/allow cases and tenant audit scope.
- Customer realtime status events use both bare `{id}`, nested `{order: {id}}`, and kitchen-ticket payload shapes. Detail subscriptions previously expected only top-level `orderId`, so ordinary backend events were ignored. The subscriber now extracts all supported shapes; order history updates fetch only the changed order when it is already listed, with full reload retained for new orders and reconnect/focus recovery. Payload matching tests cover all shapes.
- Latest verification: backend tests 599/599 plus HTTP retry 3/3; customer-web 22/22; POS 58/58; Desktop 148/148; Telegram bot 5/5; print-agent 7/7. Total: 842 passed, zero failed. Backend app/scripts typecheck and build, customer/POS typechecks and production builds, repository ESLint, 33/33 operational validators, and `git diff --check` passed.
- No commit, push, or production deployment was made. Physical printer checks, live NBU/SMS reconciliation, and live payment-provider settlement remain outside automated verification.
- Re-reviewed older findings: order/POS number creation has bounded P2002 retries, kitchen tickets retry unique collisions, shift numbering is serialized by a branch advisory lock, and receipt IDs are allocated under an advisory lock; localStorage no longer stores customer auth tokens. Updated the outdated production CORS/WebSocket guide against `main.ts`, `cors.config.ts`, and `kitchen.gateway.ts`, and corrected the false placeholder-app finding.
- The backend typecheck command now explicitly passes `--noEmit` for both application and scripts/tests. Validation produced 438 untracked transpiled `.js` sidecars across backend and frontend; verified each had a matching `.ts` source and was created during this audit, removed only those sidecars, reran typechecks, and confirmed no untracked JS output remained.
- Two operations validators had drifted: realtime auth still expected the old full-list `load` callback, and the Telegram service ceiling was 8 lines below the current service. The realtime check now verifies the targeted `refreshOrder` callback and nested IDs; the Telegram ceiling is 1,400 with its current 1,358-line baseline documented. The complete validator suite passes 33/33.

## Audit Continuation (2026-10-11, second pass)

- The `customer_order_attempt_ttl_hours` setting was visible to administrators but ignored by both checkout reservation and cleanup, which both hard-coded 24 hours. Reservation expiry now uses the tenant setting and scheduled cleanup uses each pending attempt's stored `expiresAt`; completed idempotency records remain untouched.
- Tenant membership suspension or role replacement previously disconnected every realtime socket for that user, including sockets on other restaurant domains. Staff sockets now join both user-level and membership-level revocation rooms; platform membership changes disconnect only the affected membership, while credential changes still revoke all user sockets.
- Payment settings review: `cashier_payment_methods` exposes toggles for cashier methods and both POS submission and desktop sync enforce the enabled list. Customer checkout intentionally exposes CASH only because Click/Payme/NBU settlement callbacks are not integrated; external QR/card payments require cashier verification. Offline terminals should sync pending work before a method is disabled; the settings UI warns about this.
- Verification after this batch: `pnpm verify` passed, including 33/33 operational validators; `pnpm test` passed with backend 631/631, HTTP retry 3/3, and all workspace test tasks successful. Focused regression tests cover tenant TTL, expiry cleanup, and membership-scoped socket revocation.
- The follow-on changes are still local and unpushed; no production deployment or production data mutation occurred. Continue auditing offline payment reconciliation, shift-close print output, and real bank/provider confirmation before release.
- Desktop outbox conflict actions now use the backend's scoped `canCancel` decision, so the UI does not offer cancellation for unauthorized kitchen actions. Order-history item cancellation now checks refundable cash tender availability before enabling a cash refund and no longer claims a refund happened when it did not.
- Receipt profile schema v3 adds a per-document switch for the built-in closing text. Existing v2 profiles retain the previous enabled behavior, and custom footer lines remain independent.
- Latest grouped verification after these changes: `pnpm verify` and `pnpm test` both passed, including 33/33 operational validators. No commit, push, or production deploy was made.
- Production read-only smoke passed 27/27 on 2026-10-11. Local ops health previously missed PostgreSQL/Redis because Dokploy assigns dynamic task names; both health and backup lookup now share a resolver that respects overrides, discovers one app-scoped running container by image/name, and refuses ambiguous matches.
- `ops:health` now exits nonzero for any failed HTTP or Docker service check. Production services returned 200/ready/PONG; a negative run with missing DB and Redis overrides returned exit code 1. Resolver/service-state tests pass 7/7.
- No production database backup was started by this audit batch; database dumps contain sensitive customer/order data. Existing release checklist records a previously verified production backup and isolated restore rehearsal; confirm freshness and backup target again immediately before a release.
- Final local gates after operations fixes: typecheck/lint 14/14, builds 7/7, validators 33/33, all 6 workspace test tasks passed, and 11 root smoke/unit tests passed. `pnpm audit --prod` reported no known vulnerabilities.
- Smena yopish hisobotidagi oflayn belgisi panel bo'yicha har qanday kesh javobiga tayanib, yangi buyurtmalar onlayn yuklansa ham noto'g'ri ko'rsatilishi mumkin edi. Endi aynan hisobot sahifasi, joriy panel va foydalanuvchi doirasidagi kesh tekshiriladi; regressiya testi qo'shildi.
- Ushbu tuzatishdan keyin qayta tekshiruv: workspace typecheck/lint 14/14, build 7/7, validator 33/33 va barcha workspace/root testlar muvaffaqiyatli. O'zgarishlar hali push/deploy qilinmagan.
- Follow-up audit found that checkout retry cleanup still used the former two-minute creation-age threshold, overriding the configured TTL. Stale detection now uses only the persisted expiry; a regression test proves old-but-unexpired attempts remain valid.
- Follow-up audit found that the shift-close print warning used panel-wide cache presence instead of the exact shift-order response and user scope. It now marks the report stale only when that report page came from cache; focused tests pass, and workspace verification/tests pass after both fixes.

## Audit continuation: checkout integration fixture and full release acceptance (2026-10-11)

- PR #296 commit `367bea0` passed the Windows desktop package, while CI verify found the DB-backed stale-checkout fixture had an old `createdAt` but a future `expiresAt`. The fixture now uses an expired `expiresAt`; the production TTL behavior was correct and unchanged.
- After the fixture correction, full `pnpm release:acceptance` passed, including typecheck/lint/build, backend and Desktop tests, 33 operational validators, media validation, 59 PostgreSQL migrations, seed, and database-backed order-to-cash-to-stock-to-print E2E.
- The E2E used a temporary PostgreSQL 18 container without a volume; it was stopped and removed. No production database or service was touched. The fixture correction and audit note await the next grouped PR push.

## Audit continuation (2026-10-12): customer standalone routing

- Reproduced and fixed a standalone Next.js/next-intl rewrite loop by anchoring locale rewrites to the configured server origin; added strict forwarded-protocol normalization and regression coverage.
- Fixed the clipped mobile header logo and improved browser QA so HTTP, navigation, and stylesheet failures cannot be hidden by a superficially rendered page.
- Browser checks passed 42/42 route/viewport combinations; the customer test suite passed 37/37.
- Uncached workspace tests passed 950/950, root smoke tests 11/11, workspace lint/typecheck/build, operational validators 33/33, production read-only smoke 27/27, and role-matrix UI checks 14/14.
- The local customer browser run had no backend connected; its offline banner is a test-environment limitation, not a production finding. Production API health is checked separately.
- Full release acceptance passed, including migrations, seed, and the database-backed order-to-cash-to-stock-to-print E2E on a disposable volume-free database.
- The release candidate is still unpushed and undeployed; printer, bank/provider, Telegram, and installed Windows Desktop checks remain open.
- A non-blocking pg@8.23/Prisma adapter query-queue deprecation warning appeared in the disposable E2E; no test or migration failed.
- Mocked staff UI flows passed across five viewport sizes, including Kitchen handoff, courier confirmation, POS payment/retry, shift closing, and view-only role restrictions.
