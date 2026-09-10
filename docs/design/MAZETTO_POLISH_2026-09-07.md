# Customer Design And Interaction Polish

Date: 2026-09-07. Project: `/home/javohir/dev/mazetto-food`.
Scope: customer-web home, menu, product, cart, checkout, profile, orders,
order detail and success. Applied to the server development checkout.

## Verified Problems And Changes

- First-visit splash stayed on screen under development Strict Mode after its
  cleanup cancelled the timer. Removed the blocking overlay from the site shell.
- Cart and favorites persistence ran before hydration and wrote empty values
  back to storage. Persistence now starts after the stored state is restored.
- Product configuration put the photo below the entire form on mobile and
  squeezed long names beside a price badge. One ivory surface now contains
  side-by-side photo/copy, real variants, optional modifiers, notes and actions.
  Changing product routes resets the form. Required modifiers are selected and
  included in the displayed price. Empty modifier sections are omitted.
- Public and authenticated API requests now have a 15-second limit. Catalog
  cache sharing, branch isolation and retry behavior are retained.
- Late home/checkout responses can no longer overwrite newer selections.
  Branch and quote failures show retry actions; submission waits for a quote.
- Order read failures only refresh authentication for expired sessions, avoiding
  repeated refreshes on network, missing-order and server errors.
- The selected favorite uses brand colors and exposes its state. Profile lists
  local saved favorites alongside server favorites and reads delivery addresses.
- Quantity badges count units, not cart rows. Focused quantity controls stay
  available. Cart names wrap and empty carts omit inactive checkout summaries.
- Mobile logo, 44px ordering controls, card typography, active order spacing,
  account metrics and navigation were aligned to the supplied references.
  Branch text and toast contrast were corrected. Success no longer claims a
  kitchen transition that is not established by the response.
- Removed blanket `will-change` promotion, persistent blur on shared surfaces,
  product-image floating/zoom and page-wide transition orchestration. Reduced
  motion is respected. Initial menu images are loaded eagerly.

## Reference Decisions

All five reference images were inspected. The later owner-approved manual teal
carousel is retained, including all five slides, original targets, unmasked media
and white heading. Mobile media uses contain; desktop uses cover. Product add
controls stay at the lower image corner. The canonical 74 product images and
catalog are preserved. No food or logo assets were replaced or generated.

This is responsive reference alignment, not a claim of pixel-perfect reproduction.
Reference-only promotions, payment providers, balances and delivery promises are
not introduced. Existing single-page checkout and backend order processing remain.

## Verification

- `pnpm --filter customer-web lint`
- `pnpm --filter customer-web build` (includes TypeScript checks)
- `pnpm --filter backend exec tsx ../customer-web/scripts/validate-catalog-cache.ts`
- Existing `scripts/qa-customer-design-contract.mjs`: 390, 430, 768 and 1440px,
  carousel slides, controls, media fit, card geometry, 74 products, sticky tabs,
  stationary navigation and no forbidden category blur.
- New `scripts/qa-customer-polish.mjs`: first visit, dialog focus/layout, search,
  favorites/cart after reload, units/stepper geometry, product route resets,
  failed requests, quote response ordering and authentication refresh behavior.
- Public page screenshots at 360, 390, 430, 768 and 1440px.
- Authenticated checkout, profile, history, order detail and success screenshots
  at the same five widths using browser-only fixtures, with no real orders or
  authentication messages submitted. 26 additional screenshots; no page errors,
  broken images or horizontal document overflow in the tested states.

Browser scripts require Playwright and a running local preview/API. For the
current forwarded development environment use `QA_BASE=http://127.0.0.1:3100`
and `QA_API=http://127.0.0.1:4100/api/v1`. Browser fixture data is restricted to
the QA script and is never part of the application bundle or database.

Evidence: `.qa-screenshots/polish/results.json` and viewport PNGs, plus the
existing design-contract results. POS/admin, real Telegram delivery and real
payment/order submission are outside this verification. No production service
or database deployment was performed.
