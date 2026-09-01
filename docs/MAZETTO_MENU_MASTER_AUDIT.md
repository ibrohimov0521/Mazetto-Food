# MAZETTO FOOD — Master Menu Inventory & Catalog Audit

Date: 2026-09-01

Repository HEAD at audit: `7c84a7cb7dd35090ea7886b114790d035e597d7b`

Audit mode: read-only analysis. No database, production, deployment, seed, product, price, or image mutations were performed.

## Executive Summary

The authoritative supplied menu source is `docs/design/source-media/menu mazetto.pdf`. The CDR file exists at `docs/design/source-media/menu mazetto.cdr`, but it is treated only as a visual/source asset for a later controlled extraction pass.

The PDF contains **56 standalone menu items** and **18 set/combo items**, for **74 total catalog items**. The current repository seed contains **35 products**, including **31 standalone products** and **4 combos/sets**. Production reconciliation on 2026-09-01 confirmed the live production DB and public customer menu API currently expose the same **35 products**, **44 variants**, **4 combos/sets**, and **10 categories**. Therefore the current production database/web catalog is not a full representation of the PDF menu.

The biggest mismatch is structural: many PDF items are modeled as separate sellable products, while the current DB contains a smaller normalized/renamed catalog with some variants and some products that do not appear in the PDF. Telegram also currently groups Lavash and Burger into virtual quick-add families, which conflicts with the latest owner direction that all lavash/burger products should be visible as individual menu products.

Production media direct URLs remain an operational issue: the frontend supports media fallback, but the production media volume previously had missing files. This audit did not upload, generate, or modify media.

## Production Reconciliation — 2026-09-01

This section supersedes the earlier offline/API-unavailable note. The previous audit was completed while production API returned Cloudflare `1033`. After the production server was started, the same catalog comparison was repeated against live production services in read-only mode.

### Production Service Status

| Service | Status |
| --- | --- |
| Backend service | `1/1` |
| PostgreSQL service | `1/1` |
| Customer-web service | `1/1` |
| Media service | `1/1` |
| Backend health | `200`, database status `ok` |

Observed production images at reconciliation time:

| Service | Image |
| --- | --- |
| Backend | `mazetto-food-backend-pdslpm:4e7075a` |
| Customer-web | `mazetto-food-customerweb-yvb3d0:a285732` |
| PostgreSQL | `postgres:18` |
| Media | `mazetto-food-media-btinws:latest` |

### Confirmed Production DB Counts

Read-only queries against the live `mazetto` PostgreSQL database confirmed:

| Area | Production count |
| --- | ---: |
| Categories | 10 |
| Products total | 35 |
| Standalone products | 31 |
| Combos/sets | 4 |
| Variants | 44 |
| Unavailable products returned by customer API | 0 |

### Production API Counts

Read-only public API calls confirmed the customer-facing API currently returns:

| Endpoint | Production result |
| --- | ---: |
| `/api/v1/customer/menu/categories` | 10 categories |
| `/api/v1/customer/menu/products` | 35 products |
| Product variants included in API response | 44 variants |
| Combos/sets included in API response | 4 |

### Previous Offline/Seed Result vs Confirmed Production Result

| Metric | Previous offline/seed result | Confirmed production result | Difference |
| --- | ---: | ---: | --- |
| Categories | 10 | 10 | none |
| Products total | 35 | 35 | none |
| Standalone products | 31 | 31 | none |
| Combos/sets | 4 | 4 | none |
| Variants | 44 | 44 | none |
| PDF missing from DB | 56 | 56 | none |
| DB-only products | 17 | 17 | none |
| Price mismatches | 12 | 12 | none |
| Name mismatches | 13 | 13 | none |
| Web missing vs PDF | 56 | 56 | none |
| Telegram missing vs PDF | 62 | 62 | none |
| Wrong Telegram flows | 2 | 2 | none |

Conclusion: the earlier seed/local counts were accurate for the current production catalog. The only audit difference is that production API is now reachable and confirms the same mismatch.

### Confirmed Production Product Snapshot

| Code | Production name | Price | Combo? | Available? | Category | Image |
| --- | --- | ---: | --- | --- | --- | --- |
| `BIG_LAVASH` | Katta lavash | 36 000 | no | yes | `LAVASH` | `/products/lavash-big.webp` |
| `CLASSIC_LAVASH` | Klassik lavash | 31 000 | no | yes | `LAVASH` | `/products/lavash-classic.webp` |
| `MINI_LAVASH` | Mini lavash | 24 000 | no | yes | `LAVASH` | `/products/lavash-mini.webp` |
| `BEEF_LAVASH` | Mol go'shtli lavash | 34 000 | no | yes | `LAVASH` | `/products/lavash-beef.webp` |
| `CHICKEN_LAVASH` | Tovuqli lavash | 30 000 | no | yes | `CHICKEN_LAVASH` | `/products/chicken-lavash.webp` |
| `CHICKEN_CHEESE_LAVASH` | Tovuqli pishloqli lavash | 35 000 | no | yes | `CHICKEN_LAVASH` | `/products/chicken-cheese-lavash.webp` |
| `CHICKEN_SPICY_LAVASH` | Tovuqli achchiq lavash | 33 000 | no | yes | `CHICKEN_LAVASH` | `/products/chicken-spicy-lavash.webp` |
| `CLASSIC_BURGER` | Klassik burger | 29 000 | no | yes | `BURGER` | `/products/burger-classic.webp` |
| `BIG_BURGER` | Katta burger | 39 000 | no | yes | `BURGER` | `/products/burger-big.webp` |
| `CHEESEBURGER` | Chizburger | 32 000 | no | yes | `BURGER` | `/products/cheeseburger.webp` |
| `DOUBLE_BURGER` | Double burger | 45 000 | no | yes | `BURGER` | `/products/burger-double.webp` |
| `CHICKEN_BURGER` | Tovuqli burger | 28 000 | no | yes | `CHICKEN_BURGER` | `/products/chicken-burger.webp` |
| `CRISPY_CHICKEN_BURGER` | Qarsildoq tovuqli burger | 33 000 | no | yes | `CHICKEN_BURGER` | `/products/crispy-chicken-burger.webp` |
| `CHICKEN_CHEESEBURGER` | Tovuqli chizburger | 31 000 | no | yes | `CHICKEN_BURGER` | `/products/chicken-cheeseburger.webp` |
| `CLASSIC_HOT_DOG` | Klassik hot-dog | 19 000 | no | yes | `HOT_DOG` | `/products/hot-dog-classic.webp` |
| `CHEESE_HOT_DOG` | Pishloqli hot-dog | 23 000 | no | yes | `HOT_DOG` | `/products/hot-dog-cheese.webp` |
| `DOUBLE_HOT_DOG` | Double hot-dog | 27 000 | no | yes | `HOT_DOG` | `/products/hot-dog-double.webp` |
| `DONER_WRAP` | Doner lavash | 32 000 | no | yes | `DONER` | `/products/doner-wrap.webp` |
| `DONER_PLATE` | Doner tarelka | 42 000 | no | yes | `DONER` | `/products/doner-plate.webp` |
| `CHICKEN_DONER` | Tovuqli doner | 30 000 | no | yes | `DONER` | `/products/chicken-doner.webp` |
| `FRIES` | Fri kartoshka | 15 000 | no | yes | `FAST_FOOD` | `/products/fries.webp` |
| `CHEESE_FRIES` | Pishloqli fri | 22 000 | no | yes | `FAST_FOOD` | `/products/cheese-fries.webp` |
| `CHICKEN_STRIPS` | Tovuqli strips | 28 000 | no | yes | `FAST_FOOD` | `/products/chicken-strips.webp` |
| `NUGGETS` | Naggets | 24 000 | no | yes | `FAST_FOOD` | `/products/nuggets.webp` |
| `COCA_COLA` | Coca-Cola | 9 000 | no | yes | `DRINKS` | `/products/coca-cola.webp` |
| `FANTA` | Fanta | 9 000 | no | yes | `DRINKS` | `/products/fanta.webp` |
| `SPRITE` | Sprite | 9 000 | no | yes | `DRINKS` | `/products/sprite.webp` |
| `WATER` | Suv | 5 000 | no | yes | `DRINKS` | `/products/water.webp` |
| `HOUSE_SAUCE` | Maxsus sous | 3 000 | no | yes | `SAUCES` | `/products/house-sauce.webp` |
| `CHEESE_SAUCE` | Pishloqli sous | 4 000 | no | yes | `SAUCES` | `/products/cheese-sauce.webp` |
| `SPICY_SAUCE` | Achchiq sous | 3 000 | no | yes | `SAUCES` | `/products/spicy-sauce.webp` |
| `FAMILY_SET` | Oilaviy set | 119 000 | yes | yes | `SETS` | `/products/set-family.webp` |
| `LAVASH_SET` | Lavash set | 54 000 | yes | yes | `SETS` | `/products/set-lavash.webp` |
| `BURGER_SET` | Burger set | 49 000 | yes | yes | `SETS` | `/products/set-burger.webp` |
| `KIDS_SET` | Bolalar seti | 39 000 | yes | yes | `SETS` | `/products/set-kids.webp` |

## Source Files Inspected

- `docs/design/source-media/menu mazetto.pdf`
- `docs/design/source-media/menu mazetto.cdr`
- `docs/design/MAZETTO_SOURCE_MEDIA_MAPPING.json`
- `docs/design/MAZETTO_MEDIA_GENERATION_QUEUE.json`
- `docs/MAZETTO_WORK_STATUS.md`
- `docs/design/MAZETTO_DESIGN_LOCK.md`
- `docs/MAZETTO_FULL_CODE_AUDIT.md`
- `apps/backend/prisma/schema.prisma`
- `apps/backend/prisma/seeds/menu/categories.ts`
- `apps/backend/prisma/seeds/menu/products.ts`
- `apps/backend/prisma/seeds/menu/variants.ts`
- `apps/backend/prisma/seeds/menu/combos.ts`
- `apps/backend/prisma/seeds/menu/modifiers.ts`
- `apps/backend/prisma/seeds/menu/index.ts`
- `apps/customer-web/components/customer-menu-sections.tsx`
- `apps/customer-web/components/media-image.tsx`
- `apps/customer-web/lib/cart.tsx`
- `apps/customer-web/lib/types.ts`
- `apps/customer-web/next.config.ts`
- `apps/backend/src/modules/telegram/telegram-customer-ordering.service.ts`

## Current Repository Catalog

### Seed Categories

| Code | DB name | Image |
| --- | --- | --- |
| `LAVASH` | Lavash | `/categories/lavash.webp` |
| `CHICKEN_LAVASH` | Tovuqli lavash | `/categories/chicken-lavash.webp` |
| `BURGER` | Burgerlar | `/categories/burger.webp` |
| `CHICKEN_BURGER` | Tovuqli burgerlar | `/categories/chicken-burger.webp` |
| `HOT_DOG` | Hot Dog | `/categories/hot-dog.webp` |
| `DONER` | Doner | `/categories/doner.webp` |
| `FAST_FOOD` | Gazaklar | `/categories/fast-food.webp` |
| `DRINKS` | Ichimliklar | `/categories/drinks.webp` |
| `SAUCES` | Souslar | `/categories/sauces.webp` |
| `SETS` | Setlar | `/categories/sets.webp` |

### Seed Counts

| Area | Count |
| --- | ---: |
| Categories | 10 |
| Products total | 35 |
| Standalone products | 31 |
| Combos/sets | 4 |
| Variants | 44 |
| Modifiers | 8 |

## PDF Canonical Catalog

### Lavash

| PDF item | PDF price | Current DB status |
| --- | ---: | --- |
| Lavash | 32 000 | Needs DB review/update; closest current `CLASSIC_LAVASH` is 31 000 and named "Klassik lavash" |
| Big Lavash | 36 000 | Present as `BIG_LAVASH`; DB name is "Katta lavash" |
| Lavash Pishloqli | 35 000 | Missing as standalone PDF item |
| Big Lavash Pishloqli | 39 000 | Missing as standalone PDF item; current `BIG_LAVASH` has variant "Pishloqli" at 41 000 |
| Achchiq Lavash | 34 000 | Missing as standalone PDF item |
| Achchiq Big Lavash | 39 000 | Missing as standalone PDF item; current `BIG_LAVASH` has variant "Achchiq" at 38 000 |
| Tandir Lavash | 43 000 | Missing |
| Tandir Lavash Pishloqli | 45 000 | Missing |
| Kurinniy Lavash | 28 000 | Needs DB review/update; closest current `CHICKEN_LAVASH` is 30 000 |
| Kurinniy Big Lavash | 32 000 | Missing |
| Kurinniy Lavash Pishloqli | 31 000 | Needs DB review/update; closest current `CHICKEN_CHEESE_LAVASH` is 35 000 |
| Kurinniy Big Lavash Pishloqli | 35 000 | Missing |
| Achchiq Kurinniy Lavash | 31 000 | Needs DB review/update; closest current `CHICKEN_SPICY_LAVASH` is 33 000 |
| Achchiq Kurinniy Big Lavash | 35 000 | Missing |

### Burger

| PDF item | PDF price | Current DB status |
| --- | ---: | --- |
| Burger | 29 000 | Present as `CLASSIC_BURGER`; DB name is "Klassik burger" |
| Chizburger | 32 000 | Present as `CHEESEBURGER` |
| Double Burger | 42 000 | Needs DB price update; current `DOUBLE_BURGER` is 45 000 |
| Double Chizburger | 46 000 | Missing |
| Chicken Burger | 26 000 | Needs DB price update; current `CHICKEN_BURGER` is 28 000 |
| Chicken Chizburger | 29 000 | Needs DB price update; current `CHICKEN_CHEESEBURGER` is 31 000 |
| Double Chicken Burger | 37 000 | Missing |
| Double Chicken Chizburger | 41 000 | Missing |

### Hot Dog

| PDF item | PDF price | Current DB status |
| --- | ---: | --- |
| Chicken hot dog mini | 25 000 | Missing |
| Chicken hot dog katta | 35 000 | Missing |
| Salatli hot dog kichik | 15 000 | Missing |
| Salatli hot dog katta | 20 000 | Missing |
| Salatli mega hot dog | 25 000 | Missing |
| Fresh Hod Dog | 12 000 | Missing |
| Karaleyiski Hot Dog | 28 000 | Missing |
| Kichkina qazili Hod Dog | 15 000 | Missing |
| O'rtacha qazili Hod Dog | 20 000 | Missing |
| Katta qazili Hod Dog | 25 000 | Missing |
| Ultra qazili Hod Dog | 35 000 | Missing |
| Shashlikli Hod Dog | 25 000 | Missing |
| Shashlik+katletli Hod Dog | 35 000 | Missing |

### Doner / Klab / Xaggi

| PDF item | PDF price | Current DB status |
| --- | ---: | --- |
| Xaggi | 40 000 | Missing |
| Doner | 38 000 | Needs DB review/update; closest current `DONER_WRAP` is 32 000 and named "Doner lavash" |
| Kurinniy Doner | 34 000 | Needs DB review/update; closest current `CHICKEN_DONER` is 30 000 |
| Klab senvich frisiz | 34 000 | Missing |
| Klab senvich | 38 000 | Missing |
| Saseska podomashniy | 35 000 | Missing |

### Plate Meals

| PDF item | PDF price | Current DB status |
| --- | ---: | --- |
| Doner Blyuda | 52 000 / 55 000 | Ambiguous PDF price; closest current `DONER_PLATE` is 42 000 |
| Katlet podamashni | 52 000 / 55 000 | Ambiguous PDF price; missing |

### Sides / Snacks

| PDF item | PDF price | Current DB status |
| --- | ---: | --- |
| Kurinniy Sharik 3 dona | 12 000 | Missing |
| Kurinniy Sharik 5 dona | 18 000 | Missing |
| Naggets 5 dona | 18 000 | Needs DB review/update; current `NUGGETS` is 24 000 with no portion in name |
| Kurinniy Lukavoy kalso 8 ta | 20 000 | Missing |
| Kartoshka fri kichik (100gr) | 12 000 | Missing as separate size |
| Kartoshka fri katta (120gr) | 15 000 | Present conceptually as `FRIES`; DB name is generic "Fri kartoshka" |
| Jaydari kartoshka (120gr) | 15 000 | Missing |
| Jaydari kartoshka (150gr) | 18 000 | Missing |

### Sauces

| PDF item | PDF price | Current DB status |
| --- | ---: | --- |
| Ketchup | 4 000 | Missing |
| Pishloqli sous | 4 000 | Present as `CHEESE_SAUCE` |
| Chesnochniy sous | 4 000 | Missing |

### Drinks

| PDF item | PDF price | Current DB status |
| --- | ---: | --- |
| Kampot | 15 000 | Missing |
| Moxito | 15 000 | Missing |

### Sets / Combos

| PDF set | PDF price | Current DB status |
| --- | ---: | --- |
| Lavashlar uchligi | 141 000 | Missing |
| Tandir lavash juftligi | 117 000 | Missing |
| Donerda baraka | 207 000 | Missing |
| Katlet podamashni juftligi | 124 000 | Missing |
| Oilaviy set | 143 000 | Needs DB price/content update; current `FAMILY_SET` is 119 000 |
| Klab Senvich juftligi | 97 000 | Missing |
| Xaggi uchligi | 168 000 | Missing |
| Klab senvich seti | 44 000 | Missing |
| Lavashlar juftligi | 99 000 | Missing |
| Double Chizburger juftligi | 119 000 | Missing |
| Doner Blyuda juftligi | 132 000 | Missing |
| Salatli Hod Dog seti | 37 000 | Missing |
| Lavash seti | 51 000 | Needs DB price/content update; current `LAVASH_SET` is 54 000 |
| Xaggi seti | 55 000 | Missing |
| Qazili Hod Dog seti | 57 000 | Missing |
| Chizburger seti | 46 000 | Missing |
| Doner seti | 62 000 | Missing |
| Double Chizburger seti | 61 000 | Missing |

## Current DB-Only Products

These current seed products do not have a clear standalone equivalent in the PDF source and require owner decision before keeping, renaming, replacing, or hiding:

| Code | DB name | Price | Classification | Reason |
| --- | --- | ---: | --- | --- |
| `MINI_LAVASH` | Mini lavash | 24 000 | `OWNER_REVIEW` | No PDF standalone Mini lavash |
| `BEEF_LAVASH` | Mol go'shtli lavash | 34 000 | `POSSIBLE_RENAME` | PDF uses generic Lavash/Big Lavash naming, not explicit beef product |
| `BIG_BURGER` | Katta burger | 39 000 | `OWNER_REVIEW` | No PDF standalone Katta burger |
| `CRISPY_CHICKEN_BURGER` | Qarsildoq tovuqli burger | 33 000 | `OWNER_REVIEW` | No PDF equivalent |
| `CLASSIC_HOT_DOG` | Klassik hot-dog | 19 000 | `POSSIBLE_RENAME` | PDF hot dog names are salatli/qazili/chicken/etc. |
| `CHEESE_HOT_DOG` | Pishloqli hot-dog | 23 000 | `OWNER_REVIEW` | No PDF equivalent |
| `DOUBLE_HOT_DOG` | Double hot-dog | 27 000 | `OWNER_REVIEW` | No PDF equivalent |
| `CHEESE_FRIES` | Pishloqli fri | 22 000 | `OWNER_REVIEW` | No PDF equivalent |
| `CHICKEN_STRIPS` | Tovuqli strips | 28 000 | `OWNER_REVIEW` | No PDF equivalent |
| `COCA_COLA` | Coca-Cola | 9 000 | `POSSIBLE_COMPONENT` | PDF shows Kampot/Moxito and Pepsi references in sets, not Coca-Cola |
| `FANTA` | Fanta | 9 000 | `OWNER_REVIEW` | No PDF equivalent |
| `SPRITE` | Sprite | 9 000 | `OWNER_REVIEW` | No PDF equivalent |
| `WATER` | Suv | 5 000 | `POSSIBLE_COMPONENT` | No PDF equivalent, but current kids set uses water |
| `HOUSE_SAUCE` | Maxsus sous | 3 000 | `POSSIBLE_COMPONENT` | PDF has generic `Sous` in set compositions |
| `SPICY_SAUCE` | Achchiq sous | 3 000 | `OWNER_REVIEW` | No PDF equivalent |
| `BURGER_SET` | Burger set | 49 000 | `OWNER_REVIEW` | PDF has Chizburger/Double Chizburger sets, not generic Burger set |
| `KIDS_SET` | Bolalar seti | 39 000 | `OWNER_REVIEW` | No PDF equivalent |

## Missing-In-DB Products

Strict PDF item coverage:

- PDF catalog items: 74
- Current DB products/combos: 35
- PDF items with clear or partial current DB equivalent: 18
- PDF items missing as distinct DB catalog items: 56
- Current DB-only products requiring owner decision: 17

Important: the recommendation is not to blindly create 56 products in one pass. First approve the canonical modeling strategy: which PDF items become separate products, which become variants, and which existing DB-only products are kept or replaced.

## Stable Code Mapping Plan

Recommended stable-code rules for the approved canonical catalog:

- keep existing codes where the existing product clearly maps to the PDF item;
- create deterministic English-style uppercase codes for missing PDF items;
- do not include database IDs in codes;
- do not encode current price into codes;
- do not encode temporary owner-review state into customer-visible names.

Examples:

| PDF item | Recommended stable code | Existing code reused? |
| --- | --- | --- |
| Lavash | `CLASSIC_LAVASH` or `LAVASH` after owner decision | current `CLASSIC_LAVASH` possible |
| Big Lavash | `BIG_LAVASH` | yes |
| Lavash Pishloqli | `LAVASH_CHEESE` | no |
| Big Lavash Pishloqli | `BIG_LAVASH_CHEESE` | no |
| Achchiq Lavash | `LAVASH_SPICY` | no |
| Achchiq Big Lavash | `BIG_LAVASH_SPICY` | no |
| Tandir Lavash | `TANDIR_LAVASH` | no |
| Tandir Lavash Pishloqli | `TANDIR_LAVASH_CHEESE` | no |
| Kurinniy Lavash | `CHICKEN_LAVASH` after owner decision | current `CHICKEN_LAVASH` possible |
| Kurinniy Big Lavash | `BIG_CHICKEN_LAVASH` | no |
| Kurinniy Lavash Pishloqli | `CHICKEN_LAVASH_CHEESE` after owner decision | current `CHICKEN_CHEESE_LAVASH` possible |
| Kurinniy Big Lavash Pishloqli | `BIG_CHICKEN_LAVASH_CHEESE` | no |
| Achchiq Kurinniy Lavash | `CHICKEN_LAVASH_SPICY` after owner decision | current `CHICKEN_SPICY_LAVASH` possible |
| Achchiq Kurinniy Big Lavash | `BIG_CHICKEN_LAVASH_SPICY` | no |
| Double Chizburger | `DOUBLE_CHEESEBURGER` | no |
| Double Chicken Burger | `DOUBLE_CHICKEN_BURGER` | no |
| Double Chicken Chizburger | `DOUBLE_CHICKEN_CHEESEBURGER` | no |
| Xaggi | `XAGGI` | no |
| Klab senvich frisiz | `CLUB_SANDWICH_NO_FRIES` | no |
| Klab senvich | `CLUB_SANDWICH` | no |
| Saseska podomashniy | `SAUSAGE_HOME_STYLE` | no |
| Katlet podamashni | `CUTLET_HOME_STYLE` | blocked by ambiguous price |
| Ketchup | `KETCHUP` | no |
| Chesnochniy sous | `GARLIC_SAUCE` | no |
| Kampot | `KOMPOT` | no |
| Moxito | `MOJITO` | no |

Full code creation should happen in the implementation phase after the two blockers are approved.

## Telegram Flattening Plan

Current Telegram code should be changed in the next implementation phase as follows:

1. Remove `telegramFamilySkus` as a customer-facing Lavash/Burger navigation source.
2. Remove callback branches for `cust:fam`, `cust:fsize`, and `cust:qadd` after tests are updated.
3. Do not filter out `LAVASH`, `CHICKEN_LAVASH`, `BURGER`, or `CHICKEN_BURGER` categories from `sendCategoryMenuToTarget`.
4. Show category buttons directly, using compact two-column layout:
   - Lavashlar
   - Burgerlar
   - Doner / Klab / Xaggi
   - Hot Doglar
   - Blyudalar
   - Setlar
   - Gazaklar
   - Souslar
   - Ichimliklar
   - Savat
5. Inside Lavash/Burger categories, show real products directly from DB/API.
6. For products with one default variant and no modifiers, one tap can add directly to cart.
7. For configurable products, open the existing product configurator without artificial meat-selection screens.
8. Preserve edit-in-place navigation, cart count, stale callback handling, and cart merge behavior.

This Telegram change should be local-only first and validated with updated tests before any production deploy.

## Products To Update

These current products have a likely PDF equivalent but require owner-approved name, price, category, or modeling updates:

| Current code | Current DB name | Current price | PDF equivalent | PDF price | Required decision |
| --- | --- | ---: | --- | ---: | --- |
| `CLASSIC_LAVASH` | Klassik lavash | 31 000 | Lavash | 32 000 | Rename/price update or keep current branding |
| `BIG_LAVASH` | Katta lavash | 36 000 | Big Lavash | 36 000 | Name alignment only |
| `CHICKEN_LAVASH` | Tovuqli lavash | 30 000 | Kurinniy Lavash | 28 000 | Name/price alignment |
| `CHICKEN_CHEESE_LAVASH` | Tovuqli pishloqli lavash | 35 000 | Kurinniy Lavash Pishloqli | 31 000 | Price alignment |
| `CHICKEN_SPICY_LAVASH` | Tovuqli achchiq lavash | 33 000 | Achchiq Kurinniy Lavash | 31 000 | Price alignment |
| `DOUBLE_BURGER` | Double burger | 45 000 | Double Burger | 42 000 | Price alignment |
| `CHICKEN_BURGER` | Tovuqli burger | 28 000 | Chicken Burger | 26 000 | Price alignment |
| `CHICKEN_CHEESEBURGER` | Tovuqli chizburger | 31 000 | Chicken Chizburger | 29 000 | Price alignment |
| `DONER_WRAP` | Doner lavash | 32 000 | Doner | 38 000 | Name/category/price alignment |
| `DONER_PLATE` | Doner tarelka | 42 000 | Doner Blyuda | 52 000 / 55 000 | Ambiguous price; owner review needed |
| `CHICKEN_DONER` | Tovuqli doner | 30 000 | Kurinniy Doner | 34 000 | Price alignment |
| `NUGGETS` | Naggets | 24 000 | Naggets 5 dona | 18 000 | Portion/price alignment |
| `FAMILY_SET` | Oilaviy set | 119 000 | Oilaviy set | 143 000 | Content/price alignment |
| `LAVASH_SET` | Lavash set | 54 000 | Lavash seti | 51 000 | Content/price alignment |

## Name / Price / Category Mismatch Counts

| Mismatch type | Count | Notes |
| --- | ---: | --- |
| Price mismatch | 12 | Counted only likely PDF-equivalent current DB products with differing price. Ambiguous 52/55 plate price counted as mismatch needing owner review. |
| Name mismatch | 13 | Counted likely equivalents where current DB display name differs materially from PDF label. |
| Category mismatch | 0 | No definite wrong category was proven; several modeling/category choices need owner review but are not marked wrong without approval. |

## Web Catalog Coverage

Customer-web consumes the customer menu API and renders all products returned by the backend. It does not independently hide PDF items. Therefore:

- Web visible catalog = current DB/API catalog.
- Web missing count vs PDF = 56 catalog items.
- Web DB-only count vs PDF = 17 catalog items.

Confirmed production API verification against `https://api.mazettofood.uz/api/v1/customer/menu/categories` and `https://api.mazettofood.uz/api/v1/customer/menu/products` returned the same 10 categories and 35 products as the live production database.

## Telegram Catalog Coverage

Current Telegram customer menu uses presentation-only virtual families:

- `🌯 Lavash`
- `🍔 Burger`

The code excludes categories `LAVASH`, `CHICKEN_LAVASH`, `BURGER`, and `CHICKEN_BURGER` from the ordinary category list and maps family selections through `telegramFamilySkus`.

Current Telegram family mappings:

| Family | Size | Meat | Product code |
| --- | --- | --- | --- |
| Lavash | Mini | Mol go'shti | `MINI_LAVASH` |
| Lavash | Original | Mol go'shti | `BEEF_LAVASH` |
| Lavash | Original | Tovuq | `CHICKEN_LAVASH` |
| Lavash | Max | Mol go'shti | `BIG_LAVASH` |
| Burger | Original | Mol go'shti | `CLASSIC_BURGER` |
| Burger | Original | Tovuq | `CHICKEN_BURGER` |
| Burger | Max | Mol go'shti | `BIG_BURGER` |
| Burger | Max | Tovuq | `CRISPY_CHICKEN_BURGER` |

This conflicts with the current owner direction for the next Telegram UX correction:

- Lavash category should show all lavash products directly.
- Tovuqli lavash should not be hidden behind meat selection.
- Burger category should show all burger products directly.
- Customer should tap a product and add it to cart; no forced intermediate meat step for items that are already distinct products.

Telegram missing count vs PDF is **62** because the current Telegram menu exposes only a small subset of PDF-equivalent items through the virtual family mappings and ordinary non-lavash/non-burger categories.

Wrong Telegram flow count is **2**:

1. Lavash virtual family flow.
2. Burger virtual family flow.

## Media Inventory

Current source media mapping:

| Area | Count |
| --- | ---: |
| Category mappings | 10 |
| Category GOOD | 9 |
| Category ACCEPTABLE | 1 |
| Product mappings | 35 |
| Product GOOD | 18 |
| Product ACCEPTABLE / manual review | 9 |
| Product fallback-only / no authentic source | 8 |

Known fallback-only media items:

- `CHICKEN_STRIPS`
- `COCA_COLA`
- `FANTA`
- `SPRITE`
- `WATER`
- `HOUSE_SAUCE`
- `SPICY_SAUCE`
- `KIDS_SET`

For the strict PDF catalog, any item missing from DB is also missing a confirmed product media assignment until owner-approved product creation/mapping is performed.

## Ambiguous PDF Items

| Item | Ambiguity |
| --- | --- |
| Doner Blyuda | PDF shows `52 000 / 55 000`; options/portion difference unclear |
| Katlet podamashni | PDF shows `52 000 / 55 000`; options/portion difference unclear |
| Big Doner | Appears in set composition text, but standalone PDF item appears as `Doner`; owner must confirm naming |
| 0.25 Pepsi | Appears in set composition, but drinks section lists Kampot/Moxito; standalone selling status unclear |
| Sok 1L | Appears in `Oilaviy set`; standalone selling status unclear |
| Sous | Appears in set compositions; exact sauce type unclear |

## Exact Fix Plan For Owner Approval

### Step A — Approve Canonical Modeling

Decide whether PDF items become:

1. Separate products, matching the printed menu item-by-item.
2. Product variants under fewer parent products.
3. A hybrid model where printed-menu sellable labels still appear as separate customer-facing products.

Recommended for this project: use separate customer-facing products for every printed PDF sellable item unless there is a clear same-product variant family already approved by the restaurant owner.

## Canonical Alignment Blockers Before Local Seed Changes

The follow-up alignment phase was started after production reconciliation, but full local implementation is blocked by two owner/schema decisions that must be resolved before changing seed data safely.

### Blocker 1 — Set Composition Is Not Persisted

The current Prisma schema can mark a product as a combo through `Product.isCombo`, but it does not have a persisted relation for combo/set components and quantities.

Current code evidence:

- `apps/backend/prisma/schema.prisma` has `Product.isCombo`.
- `apps/backend/prisma/seeds/menu/combos.ts` has a TypeScript-only `bundle: string[]`.
- `apps/backend/prisma/seeds/menu/index.ts` uses `menuCombos` to create normal `Product` rows and variants, but does not persist the `bundle` array into any table.

Production impact if we continued without a schema decision:

- The 18 PDF sets could be visible as products, but their exact composition and quantities would not be queryable or enforceable from DB.
- Future kitchen, receipt, inventory, analytics, and Telegram display could drift from the printed set composition.
- This would violate the alignment requirement: "Each set needs composition and quantities" and "If current schema cannot represent exact composition safely: STOP and report required smallest schema extension."

Smallest recommended schema extension:

```prisma
model ProductBundleItem {
  id              String   @id @default(cuid())
  bundleProductId String
  componentCode   String
  componentName   String
  componentProductId String?
  quantity        Decimal  @db.Decimal(10, 3)
  unitLabel        String?
  sortOrder       Int      @default(0)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  bundleProduct    Product  @relation("BundleProduct", fields: [bundleProductId], references: [id], onDelete: Cascade)
  componentProduct Product? @relation("BundleComponent", fields: [componentProductId], references: [id], onDelete: SetNull)

  @@unique([bundleProductId, componentCode])
  @@index([bundleProductId])
  @@index([componentProductId])
  @@map("product_bundle_items")
}
```

Notes:

- `componentProductId` is nullable so set-only components such as `0.25 Pepsi`, `Sok 1L`, or generic `Sous` do not require invented standalone product prices.
- `componentCode` and `componentName` preserve the PDF-backed composition even when a component is not a customer-visible product.
- This avoids deleting or rewriting existing products and preserves historical order IDs.

### Blocker 2 — Two Standalone PDF Items Have Ambiguous Prices

The PDF rendering shows two prices for each of these items:

| PDF item | Visible prices | Required owner decision |
| --- | ---: | --- |
| Doner Blyuda | 52 000 / 55 000 | Confirm whether these are size/portion variants, meat variants, or one corrected price |
| Katlet podamashni | 52 000 / 55 000 | Confirm whether these are size/portion variants, meat variants, or one corrected price |

Until this is resolved, these items should not be inserted into the seed with a guessed single price.

### Safe Implementation Boundary

Until the two blockers above are approved, the safe local work is:

- document canonical code mapping;
- classify legacy DB-only products;
- prepare a non-destructive upsert plan;
- update Telegram plan to flatten Lavash/Burger categories conceptually;
- avoid seed/schema edits that would produce incomplete or misleading production catalog state.

### Step B — Resolve DB-Only Products

For each DB-only product, choose one:

- keep as extra non-PDF product
- rename/reprice into a PDF item
- deactivate from customer-facing channels
- replace after backup and controlled migration/seed update

No deletion should be performed without approval.

### Step C — Update Seed In A Controlled Phase

After approval:

- update `apps/backend/prisma/seeds/menu/products.ts`
- update `apps/backend/prisma/seeds/menu/variants.ts`
- update `apps/backend/prisma/seeds/menu/combos.ts`
- preserve idempotency
- do not create duplicates
- do not mutate production until local fresh DB validation passes

### Step D — Telegram Menu Correction

Remove Telegram virtual Lavash/Burger family grouping and show real products from categories. Keep cart quantity controls only in the cart. Product selection should use actual current DB products and prices.

### Step E — Media Completion

After product list approval, create a new exact media filename inventory for the full canonical catalog. Do not generate or substitute images until the exact product list is approved.

## Final Audit Counts

| Metric | Count / status |
| --- | --- |
| PDF standalone products | 56 |
| PDF sets/combos | 18 |
| PDF total catalog items | 74 |
| DB products total | 35 |
| DB variants total | 44 |
| DB sets/combos | 4 |
| Missing in DB | 56 |
| DB-only | 17 |
| Price mismatches | 12 |
| Name mismatches | 13 |
| Category mismatches | 0 proven |
| Web missing vs PDF | 56 |
| Telegram missing vs PDF | 62 |
| Wrong Telegram flows | 2 |
| Product media GOOD | 18 |
| Product media LOW_RES | 0 explicitly classified |
| Product media BAD_CROP | 0 explicitly classified |
| Product media WRONG_PRODUCT | 0 explicitly classified |
| Product media MISSING / fallback-only | 8 current DB products; 56 additional PDF-only items need future media mapping |
| Product media FALLBACK_ONLY | 8 |

## Changes Made During Audit

Only this documentation file was created:

- `docs/MAZETTO_MENU_MASTER_AUDIT.md`

No code, database, production service, deployment, seed data, media file, Cloudflare, Dokploy, or Telegram webhook changes were made.

## Local Canonical Catalog Implementation — 2026-09-01

Status: local implementation completed for all unambiguous PDF-backed catalog items; production remains unchanged.

### Schema Implementation

The approved minimal bundle relation was added locally as `ProductBundleItem`.

Implemented fields:

- `id`
- `bundleProductId`
- `componentCode`
- `componentName`
- `componentProductId`
- `quantity`
- `unitLabel`
- `sortOrder`
- `createdAt`
- `updatedAt`

Implemented constraints/indexes:

- primary key on `id`
- unique `bundleProductId + componentCode`
- index on `bundleProductId`
- index on `componentProductId`
- index on `sortOrder`
- cascade delete from bundle product
- set-null delete from optional component product

Migration file:

- `apps/backend/prisma/migrations/20260901120000_product_bundle_items/migration.sql`

This migration is additive only. It does not change historical `OrderItem` snapshots or order pricing semantics.

### Local Catalog Implementation Counts

| Metric | Count |
| --- | ---: |
| PDF standalone target | 56 |
| PDF set target | 18 |
| PDF total target | 74 |
| Resolved standalone products implemented locally | 54 |
| Resolved sets implemented locally | 18 |
| Resolved canonical items implemented locally | 72 |
| Owner price decisions pending | 2 |
| Legacy DB-only products/sets preserved | 17 |

Pending owner price decisions:

- Doner Blyuda: PDF shows `52 000 / 55 000`.
- Katlet podamashni: PDF shows `52 000 / 55 000`.

### Bundle Composition

All 18 resolved PDF sets now have local bundle composition metadata in seed definitions. Components such as `Pepsi 0.25`, `Sok 1L`, generic `Sous`, and `Big Doner` are represented as bundle component rows without invented standalone product prices.

No internal bundle-only customer-visible product records were created.

### Legacy Product Policy

The confirmed DB-only 17 products/sets were preserved in local seed definitions and marked as legacy metadata. They were not deleted, disabled, renamed, or repurposed as canonical PDF items in this phase unless already clearly reused by existing non-legacy codes.

### Telegram Flattening

The local Telegram customer menu no longer uses the virtual `Lavash -> size -> meat` or `Burger -> size -> meat` family flow.

Local intended behavior:

- `Lavashlar` opens real Lavash products directly.
- `Burgerlar` opens real Burger products directly.
- No Mol/Tovuq intermediate screen is used.
- Simple one-variant/no-modifier products still use one-tap add.
- Cart merge, cart count, edit-in-place rendering, and existing Cart/CartItem persistence remain in place.

### Web Catalog Behavior

Customer-web was adjusted to trust backend API product names/descriptions instead of overriding them with older hardcoded product labels. It still does not hardcode canonical products in the frontend; catalog visibility remains API-driven.

### Validation Evidence

Passed locally:

- `prisma format`
- `prisma validate`
- `prisma generate`
- `pnpm --filter backend typecheck`
- `pnpm --filter backend lint`
- `pnpm --filter backend build`
- `pnpm --filter customer-web typecheck`
- `pnpm --filter customer-web lint`
- `pnpm --filter customer-web build`
- `pnpm --dir apps/backend exec tsx scripts/validate-canonical-catalog.ts`
- `pnpm --dir apps/backend exec tsx scripts/validate-telegram-catalog-mapping.ts`
- `pnpm --dir apps/backend exec tsx scripts/validate-telegram-customer-ordering.ts`
- `pnpm typecheck`
- `pnpm lint`

Workspace `pnpm build` reported all 9 tasks successful, then the Turbo process remained open and was interrupted after success output.

Isolated local PostgreSQL test was attempted but blocked because Docker Desktop daemon was not running on the local machine. Production DB was not used.

### Production Safety

No production migration was applied. No production seed was run. No production DB rows were changed. No deploy, push, Cloudflare change, Telegram webhook change, media upload, or production order was performed.
