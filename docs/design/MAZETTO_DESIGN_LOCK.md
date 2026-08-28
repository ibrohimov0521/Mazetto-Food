# MAZETTO FOOD Design Lock

Last updated: 2026-08-27

This document is the permanent visual source of truth for the MAZETTO FOOD customer experience. It supersedes the earlier generic green, mint, and liquid-glass direction where those choices conflict with the approved MAZETTO brand references.

## Approved Direction

MAZETTO FOOD should feel like a premium Uzbek fast-food ordering product: compact, warm, branded, mobile-first, and operationally fast. The customer web must preserve working cart, checkout, authentication, order history, branch, media, and backend integrations while changing only the visual layer and interaction quality.

## Reference Status

The approved reference pack is present in `docs/design/references/` and is now the visual source of truth for customer-web work.

Verified reference assets:

- `00_mazetto-food-logo-4k-transparent.png` - 4096x1791 RGBA master logo.
- `00_mazetto-food-logo-web-2048.webp` - 2048x895 RGBA practical website logo.
- `00_mazetto-food-logo-web-1024.webp` - 1024x448 RGBA small website logo.
- `01_home-reference.png` - 941x1672 home visual reference.
- `02_menu-reference.png` - 941x1672 menu visual reference.
- `03_product-detail-reference.png` - 941x1672 product detail visual reference.
- `04_cart-checkout-reference.png` - 941x1672 cart/checkout/success visual reference.
- `05_profile-orders-telegram-reference.png` - 941x1672 profile/orders/Telegram concept reference.

The website uses the practical logo copy at `apps/customer-web/public/brand/mazetto-food-logo.webp`. Do not recreate the brand as plain HTML text where the actual logo should appear.

## Palette

Use semantic tokens rather than scattered one-off colors.

| Token | Purpose | Target |
| --- | --- | --- |
| `brand-teal-dark` | main shell, headers, deep backgrounds | deep petrol teal |
| `brand-teal` | primary brand surfaces | rich teal |
| `brand-teal-mid` | cards, secondary surfaces | medium teal |
| `brand-aqua` | secondary highlights and focus states | aqua turquoise |
| `brand-yellow` | primary CTA, prices, active actions | warm golden yellow |
| `brand-lavender` | logo support and subtle brand detail | light violet/periwinkle |
| `brand-ivory` | main content surfaces | warm ivory |
| `text-dark` | text on ivory/yellow surfaces | deep teal/charcoal |

Avoid generic neon green, blue gradients, purple-heavy themes, sterile pure white, and large mint empty panels.

## Typography

Use bold, clear, compact display typography for headings and small strong labels for operational controls. Customer-facing text must remain Uzbek Latin. Product and order text should prioritize readability on 360-430px mobile screens.

## Cards

Cards should be compact by default. Use larger feature cards only for hero or promotion content. Product cards must show multiple useful items in one mobile viewport. Avoid huge blank media boxes and oversized empty containers.

## CTAs

Primary ordering actions use golden yellow with high-contrast deep text. Secondary actions use teal or ivory surfaces. Buttons must have touch-friendly hit targets and stable dimensions, but should not make layouts taller than needed.

## Navigation

Mobile bottom navigation order is locked:

1. Home
2. Menu
3. Cart
4. Orders
5. Profile

Cart stays exactly in the center. Bottom navigation must be fixed to the viewport, safe-area aware, and must not jitter while scrolling. Desktop header should be compact and branded.

## Category Navigation

Menu category navigation must be sticky using CSS sticky where possible. The brand header may scroll away on mobile, then category tabs stay at the top. Scrollspy should use IntersectionObserver and must not fight programmatic tab clicks.

## Decorative Foliage

Fresh green leaves and subtle botanical patterns are allowed when they support the MAZETTO identity. They must be decorative, non-interactive, `aria-hidden`, and must not force extra vertical space or obscure product controls.

## Page Mapping

| Page | Locked visual intent |
| --- | --- |
| Home | deep teal branded top, compact branch selector, ivory hero content, yellow CTA, actual data, no fake promotions |
| Menu | teal branded surface, sticky category tabs, compact two-column mobile product grid, yellow add controls |
| Product detail | teal shell with ivory product surface, compact options, yellow add-to-cart CTA, full menu continues below |
| Cart | compact ivory cart surface, stable item rows, real totals, Uzbek actions |
| Checkout | step-like compact flow, in-context Telegram auth, branch/order/payment choices, no stuck loading |
| Success | teal success shell, ivory summary card, real order data |
| Orders | compact real order cards and detail pages, no fake status tabs |
| Profile | compact customer data, readable actions, no giant bonus card |

## Current Pixel-Lock Pass

The first local pass integrated the approved logo and moved Home, Menu, Product Detail, Cart, Checkout, Success, Profile, and Orders toward the locked teal/yellow/ivory visual system while preserving existing customer-web routes, API integration, cart state, auth flow, checkout submission, and order history behavior.

Local screenshot QA evidence is stored under `.qa-screenshots/` with `pixel-lock-*` filenames. The QA pass confirmed:

- 390px Menu has 35 real product cards, sticky category navigation, fixed bottom nav, and no document/body horizontal overflow after the category-strip fix.
- 390px Product Detail loads a real product from the production customer API and keeps full menu continuation below the product configuration.
- 390px Cart, Checkout, and Orders have no horizontal overflow and keep the bottom nav stable.
- 1440px Home, Menu, Cart, and Profile have no horizontal overflow.

Known visual limitation: real product/category media files are still missing from `media.mazettofood.uz`, so product imagery currently uses the branded fallback instead of real food photos.

## Step 3 Shell/Home/Product Rules

The Step 3 local pass tightened only the shared customer shell, Home, and Product Detail. The locked implementation rules are:

- Home uses one primary hero composition fed by real customer-home/product/menu API data. If extra hero slides exist, they may continue below as a secondary real-data feature section.
- Home category navigation is compact, horizontal, image-backed, and does not reserve empty promotion space when active promotions are absent.
- Product Detail keeps the teal shell, an ivory configuration surface, compact variants/modifiers, a stable `- 1 +` quantity control, and the yellow `Savatchaga qo'shish` CTA.
- Product Detail must continue into the full `CustomerMenuSections` menu below the configuration block; do not replace it with recommendation-only cards.
- The shared header and bottom nav are outside page transition animation wrappers. Page transitions apply only to route content.
- Product/category images keep the centralized resolver chain: production media URL, then local extracted source media when known, then branded fallback.

Step 3 screenshot evidence uses `.qa-screenshots/step3-*` filenames for Home, Product Detail, and Menu regression at 390, 430, 768, and 1440px.

## Forbidden Drift

Do not introduce:

- huge generic glass cards
- large empty mint panels
- oversized 40px radius everywhere
- random neon gradients
- blue text everywhere
- one product per mobile viewport
- massive desktop topbar
- floating bottom bar movement
- native branch select
- fake product, promotion, payment, or branch data

## Functional Boundaries

The visual redesign must not duplicate or replace:

- customer identity
- customer authentication
- cart/order/history state
- branch architecture
- central order engine
- CustomerOrder / Order / KitchenTicket flow
- payment architecture
- PostgreSQL schema unless an additive migration is explicitly needed
