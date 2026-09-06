# Customer Experience Audit and Local Fixes

Date: 2026-09-06. Scope: customer-web only. Production inspected at
https://mazettofood.uz, the deployed domain associated with the supplied screenshot.
The original local audit below performed no production order, auth code, database
write, deployment or push. Subsequent owner-authorized release: `13533a7` deployed
on 2026-09-06 with the restored original teal carousel, not the intermediate pale
hero described below. See the latest release checkpoint in MAZETTO_WORK_STATUS.md
for production smoke evidence and remaining admin permission limitations.

## Findings and Fixes

| Finding | Evidence | Local correction |
| --- | --- | --- |
| Oversized home hero and CTA | Desktop media minimum height was 448px; grid stretched CTA to branch selector height; branch/address repeated below selector | Hero now about 322px at 1440px, separate 44px CTA, single branch/address display, no empty subtitle margin |
| Unwanted hero movement | Hero inherited card hover tilt/scale and image infinite floating animation | Removed both from the primary hero; food content remains unchanged |
| Blank decorative strip behind food | Desktop `est. 2025` strip was occluded by image | Removed redundant strip |
| Category/header gap | Production header bottom 57px, category bar top 96px | Sticky bar top 57px on desktop, safe area on mobile; category jump offset derived from actual bar geometry. Owner subsequently rejected the dark blurred backing; it and the external strip shadow were removed |
| Navigation absent between 640 and 767px | Desktop links start at md; bottom navigation ended at sm | Bottom navigation and shell bottom spacing now use the same md breakpoint |
| Repeated catalog requests | Menu -> cart -> menu made two extra public GETs | Branch/query-keyed 30-second in-memory browsing cache with in-flight deduplication, bounded entries, failure retry |
| Unnecessary public GET header | All GETs sent application/json Content-Type | JSON header only when body exists; private authorization remains unchanged |
| Scroll/interaction overhead | Cards and whole sections initially invisible until viewport motion; duplicate product layout IDs on Home; automatic hero rotation continued offscreen | Content immediately visible; removed duplicate image layout IDs and permanent transform promotion; retained cart flight and touch feedback; slides use manual navigation |
| Slow price feedback | Totals animated from zero for 700ms | Initial total starts at actual value; updates animate for 180ms |
| Media loading race | Effect reset loaded state after source changes, potentially after cached image onLoad | Source-keyed component resets atomically; optimized logo, bounded responsive card image sizes, async native decoding |
| Branch picker layered behind homepage promo | Reproduced in mobile screenshot | Portal at document body, anchored desktop overlay/mobile sheet, close control, Escape and keyboard focus handling |
| Profile request rejection unhandled | Profile load had no catch | Visible error and retry; tested simulated 503 then recovery |

## Validation Evidence

- customer-web typecheck, lint and build passed.
- Catalog-cache validator passed: concurrent deduplication, expiry, branch isolation,
  failed-request retry, fresh branches, auth, order history, checkout quotes and writes.
- Browser matrix: 390, 430, 640, 768, 1024 and 1440px.
- 90 screenshots cover Home, branch picker, Menu, sticky Menu, Product, Cart,
  checkout auth gate, profile/history/detail/success auth gates and authenticated
  profile/history/detail/success using synthetic local browser responses.
- Two additional authenticated checkout screenshots at 390/1440px; switching
  delivery/pickup preserves entered address. No order request submitted.
- Public fixtures were copied in memory from read-only production catalog GETs.
  Authenticated QA uses fabricated browser fixtures, not production credentials.
- No page runtime exceptions, no horizontal overflow, navigation present at every
  tested width. Hero bounding box unchanged after hover. All 74 menu cards present.
- All 74 product image paths have a local packaged source file. Existing canonical
  assets and the media -> local source -> branded fallback chain are preserved.
- Forced media failure passed: remote 404 falls back to local source; remote and
  local 404 render the branded fallback, two attempts per image with no retry loop.
- Desktop sticky header gap changed from 39px to 0px; category heading remains
  below the sticky bar after category selection.
- git diff --check passes; repository CRLF/LF conversion warnings remain.
- Artifacts are in `.qa-screenshots/customer-ux-*`, `customer-checkout-results.json`
  and `customer-performance-results.json`; temporary QA scripts in `tmp/`.

## Performance Evidence and Limits

One browser run measured production Home data/image visibility at 5111/5143ms,
and local optimized build at 3303/3322ms. Menu revisit requests were 2 versus 0.
Recorded long tasks during the complete navigation/scroll run were 2 (130ms)
versus 1 (68ms). A 8400px scripted scroll completed in both runs without snapback.

These are development measurements, not a controlled production speed benchmark:
the local frontend and public API forwarding have different network paths and
cache state. An earlier production sample was 2821/3001ms, illustrating variability.
Do not claim a guaranteed speed percentage, mobile 60 FPS, Lighthouse score or
field Core Web Vitals from these samples. DevTools trace tooling was unavailable;
browser request counts, PerformanceObserver and screenshots were used instead.

## Boundaries and Next Step

Public catalog browsing may display data up to 30 seconds old. Quotes, branch
availability, orders, auth and personal information are never cached by this change;
server-authoritative checkout remains intact. No persistent offline catalog introduced.

Real OTP delivery, real customer history authorization, live order submission,
payment and production rollout are not validated by browser fixtures. The existing
backend was not modified. Server/image-CDN latency still needs a production
measurement after an explicitly approved deployment.

Review local customer-web, then run the established customer-web-only release gate.
Local preview is at http://localhost:3107; its temporary localhost:4107 proxy allows
only public catalog GETs. This preview build does not submit real auth or orders.
No commit/push/deploy is included in this task. Pre-existing media-source deletions,
untracked images and POS instruction files were left intact.

## Owner Follow-up: Reference Comparison

All five approved reference compositions were opened on 2026-09-06 and compared
with the current browser screenshots. Functional QA is not evidence of pixel-lock.
The current implementation is NOT reference-matched.

| Area | Reference | Current mismatch |
| --- | --- | --- |
| Home | Unified ivory content surface, curved teal hero accent, integrated food composition and foliage | Separate rectangular hero/feature sections and large teal gaps; no equivalent foliage composition |
| Header | Prominent lavender/gold brand with balanced surrounding controls | Desktop logo visually much smaller; control arrangement and proportions differ |
| Menu | Food integrated into teal cards, clear type hierarchy and rounded square controls | Dark rectangular image backgrounds, different density and control geometry; owner-requested image-corner add button must remain |
| Product | Single ivory configuration area with closely related media and options | Current hero/configuration hierarchy differs from the approved image |
| Cart/checkout | Compact light rows and clear staged visual hierarchy | Current panels, spacing and button proportions differ; existing single-page checkout and real payment support remain authoritative |
| Profile/orders | Dense light account rows and compact history cards | Current oversized status/summary surfaces differ |

Immediate follow-up fixes: removed category backing blur/dark rectangle and strip
drop-shadow; restored dark, legible slider arrows on ivory buttons. A full visual
alignment pass remains pending and must preserve newer owner decisions, including
the fixed brand theme, authentic 74-image catalog and existing navigation/business logic.
