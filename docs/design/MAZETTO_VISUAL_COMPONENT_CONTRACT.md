# MAZETTO Reference Component Contract

Date: 2026-09-06. Scope: customer-web, local only.

This contract separates observed reference elements from responsive implementation
decisions. The references are raster concepts, not a measured Figma specification.
Token values below are the implementation baseline, not invented claims of exact
pixel samples. Changes to this baseline require a documented owner decision and
responsive regression evidence. Existing business behavior always takes priority.

## Sources And Precedence

All five 941x1672 images in `references/` were opened and visually inspected.
`01` and `02` show full compositions; `04` and `05` contain multiple phone mockups,
not literal page layouts. Do not reproduce phone bezels, OS status bars or the
surrounding presentation text as application UI.

1. Owner corrections: no black sticky backdrop/blur, no moving hero food, add
   control at the image's lower corner, real canonical 74 media preserved.
2. Real features/data: current branches, catalog, session, cart and order history.
3. Reference visuals, adapted to actual screen width and readable touch targets.
4. This component contract; older provisional Liquid Glass styling is subordinate.

## Element Inventory

| Element | Observed reference | Locked implementation rule |
| --- | --- | --- |
| Outer background | Deep petrol/teal, natural foliage at edges | `--mf-bg: #004f55`; no animated gradients, dark blur strips or decorative orbs |
| Header | Teal with lavender/gold 3D logo | Actual optimized BrandLogo, one header logo; fixed desktop 56px plus 1px border, mobile 60px plus border; never inside page-motion wrapper |
| Botanical edges | Hanging fresh leaves, not round colored blobs | Static decorative sprig, bounded edge placement, `aria-hidden`, pointer-events none, no scroll handler |
| Home content | Continuous warm light background | `--mf-ivory: #f5f5ef`, constrained 1152px content, page sections not individual glass panels |
| Home hero | Light copy, organic teal food area | ONE compact manual carousel contains all actual home slides, with price/copy beside food even on mobile; no duplicate full-height hero below; canonical photos remain intact |
| Branch selection | A compact row below hero | Existing BranchPicker in separate full-width row; modal/popover does not expand document layout |
| Promo | Teal feature with food, optional badge, arrows/dots | Separate promotions only for actual active promotion records; 44px ivory/dark carousel arrows, no fake discount or empty banner |
| Categories | Small round food thumbnails on pale strip | Existing category media, horizontal touch scroll, no new category records |
| Menu categories | Teal pills, yellow selected pill | CSS sticky immediately below actual desktop header, transparent unblurred wrapper; scrollspy preserved |
| Home product card | Light body, teal text/price | Same ProductCard, contextual light surface; not a new cart implementation |
| Menu product card | Teal face, white names, yellow prices | Same ProductCard, two columns mobile, 16px radius, short local shadow, long name gets full width |
| Add control | Yellow rounded square | 12px corner baseline; stays at lower image corner per owner correction; quantity geometry independent of text |
| Primary CTA | Gold/yellow, shallow depth, botanical print | Warm `#ffdf42 -> #ffd015`, dark `#07373a` label; static low-opacity leaf mask at right, never black oval splotches |
| Icon-only controls | Simple rounded square or circle | No decorative leaf print on small add/stepper/category controls; named accessible actions |
| Slider arrows | Round ivory discs, dark chevrons | 44x44, dark ink, visible on mobile too, no white-on-ivory glyph |
| Quantity | Compact single segmented control | Existing behavior/merge semantics; fixed slot; expanded controls must not shift name/price |
| Product configuration | One light configuration area with teal media | Warm surface, compact actual variants/modifiers, real price; full CustomerMenuSections continues below |
| Cart rows | Thumbnail and text separated by fine rules | No nested floating card per item; existing remove/quantity controls and exact totals preserved |
| Cart upsell | Compact sauces/drinks | Bounded 340px vertical grid; wheel, native touch and keyboard scroll; no visible scrollbar, no horizontal clipping or full-cart scroll container |
| Checkout | Readable light sections in teal identity | Existing single-page flow, branch/auth/address preserved; no mockup-only wizard, SMS or payment provider |
| Success | Teal, success icon, compact order facts | Real response/snapshot only, no invented ETA or payment success |
| Profile/history | Compact light rows and restrained status chips | Supported fields/actions only; no fake balance, avatar identity or dead menu rows |
| Bottom nav | Five controls, emphasized central cart | Existing Home/Menu/Cart/Orders/Profile order, fixed viewport and safe areas; no scroll drift |

## Token Baseline

Source: `apps/customer-web/app/globals.css`.

- Background `#004f55`; branded surface `#08686a`.
- Ink `#07373a`; light content `#f5f5ef`; logo support `#b9b8f0`.
- Repeated item radius: 16px. Form/icon control: 12px. Page/modal surface: 24px.
- Pills: 999px only for category chips, true segmented controls and selected CTAs.
- Practical main action target: 44px; secondary dense cart controls retain their
  existing sizing until a separately verified accessibility pass.
- Local surface shadow: `0 3px 10px rgba(0,55,59,.12)`.
- CTA depth: light inset highlight and 3px golden lower edge; no large yellow glow.
- Typography: existing Arial/Helvetica stack, zero tracking for new elements;
  section title 1.35rem, weight 800, line-height 1.3. Raster font cannot be
  reliably identified, so exact typeface equivalence is NOT claimed.
- Desktop header height variable also controls category sticky offset.
- No viewport-driven font-size scaling and no per-frame scroll state.
- Product-card hover lifts by 5px only. No whole-card scale, rotateX/rotateY or
  nested image zoom: these resample the text/image layers and soften their appearance.

## Geometry And Layering

Decorative SVG has its own fixed viewBox and is used only as foliage or a button
mask. It is a stylized local vector approximation, not extracted photorealistic
reference foliage. It has no script, external resource or animation. No food or
logo asset was generated, cut out, recolored or replaced.

The header, bottom navigation and branch dialog retain independent positioning.
No blanket overflow-hidden is allowed on route content: sticky navigation must
continue to work. Only real scrollers (category/upsell strips and normal page
scrolling) may overflow. Content receives safe-area bottom spacing.

Owner density correction: Home order is now one hero, branch row, actual promotions
if present, recommended products, category navigation, then remaining product
sections. At 390/430/768/1440, first recommended cards must begin above y=800 in a
900px viewport. Do not restore two consecutive oversized hero banners. Navigation
through all real slides and their original secondary target links remains available.

## Evidence And Open Work

Implemented: shared tokens, button botanical mask, bounded decorative foliage,
stable header/logo treatment, Home light surface/card variant, branch row,
category presentation, cart separators and core surface cleanup.

Not complete: exact Home hero/cutout composition, photorealistic foliage,
Product configuration layout, full Checkout/Profile/Orders spacing pass and
reference-level typography. Do not call this entire site pixel-perfect.

Browser contract script: `scripts/qa-customer-design-contract.mjs`. Requires an
already running local customer-web/public preview API and Playwright available to
Node. It refuses non-local QA_BASE, blocks browser mutations, checks tokens,
button geometry, sticky/no-blur, header/nav stability, and writes only local QA
artifacts to `.qa-screenshots/`. Existing 90-screen functional QA remains separate.

## Change Gate

Owner clarification (2026-09-06): rejected the pale, letterboxed carousel.
Restore the original teal split carousel: white large heading, optional real
subtitle, gold CTA beside a compact price chip, edge-to-edge rectangular media,
28px outer corners and navigation below the text. No organic image mask, image
zoom or hover effect. Preserve manual arrows, dots and touch navigation.

For future visual changes: inspect the matching reference, change the existing
component/token, run the browser contract and relevant functional tests, inspect
actual screenshots at 390/430/768/1440, then record deviations honestly. Do not
restore removed theme switching, scroll snapback, hidden first-paint content,
black sticky blur, floating hero animation or duplicate pricing logic.
