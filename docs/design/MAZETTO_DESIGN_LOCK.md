# MAZETTO FOOD Design Lock

Last updated: 2026-08-27

This document is the permanent visual source of truth for the MAZETTO FOOD customer experience. It supersedes the earlier generic green, mint, and liquid-glass direction where those choices conflict with the approved MAZETTO brand references.

## Approved Direction

MAZETTO FOOD should feel like a premium Uzbek fast-food ordering product: compact, warm, branded, mobile-first, and operationally fast. The customer web must preserve working cart, checkout, authentication, order history, branch, media, and backend integrations while changing only the visual layer and interaction quality.

## Reference Status

The current master prompt describes approved reference images, but no actual image or logo asset files were present in the task attachment or repository during this audit. Until those files are supplied, implementation must follow the written reference description and clearly report that pixel-locked logo integration is blocked by the missing approved asset.

Expected production logo asset:

- Transparent high-resolution MAZETTO FOOD logo.
- "MAZETTO" in 3D lavender, light violet, or periwinkle letters.
- "FOOD" in 3D bright golden yellow letters.
- Small "est. 2025" text.

Do not rebuild the logo in HTML text and call it final. A text fallback may only be temporary while the real logo asset is missing.

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

