# Mazetto Food – Customer Web UX/UI Audit

Scope: `D:/projects/Java here/Mazetto-Food/apps/customer-web` (all listed pages, components, `app/globals.css`, `app/checkout/checkout.css`, module CSS) plus `docs/DESIGN_RULES.md`, `docs/design/MAZETTO_DESIGN_LOCK.md`, `docs/CUSTOMER_WEB_SPEC.md`. All paths below are relative to that `apps/customer-web` directory (prefix it to get the absolute path). Contrast ratios are computed from the literal hex/rgba values in CSS using WCAG relative luminance; alpha colours are composited on the surface they sit on. No files were modified.

---

## 0. Executive summary

The app is structurally solid: a single fixed bottom nav with cart in the centre, a native `<dialog>` for fulfilment, real skeletons, idempotent order submission, live order tracking via socket, and consistent safe-area handling. The biggest customer-facing problems are (1) **the first "add to cart" tap is intercepted by a full branch + map-address dialog**, and a dismissed dialog silently drops the item; (2) **many secondary-text colours fall below 4.5:1** (especially `#17314A` at ≤ 64 % opacity and yellow prices on the teal card gradient); (3) **yellow is used for everything** (CTA, prices, active tabs, active nav, badges, every non-cancelled order status), which flattens hierarchy and contradicts the semantic colour rules; (4) **tiny text** (9–12 px) in nav labels, card descriptions, badges and the mobile primary CTA; (5) a **broken support phone number**; and (6) several **checkout correctness gaps** (summary always says "cash", stale payment method can be submitted, cart bar says "Jami" without delivery fee).

Counts: 4 Critical/High-impact, ~20 Medium, ~25 Low. 8 things done well are listed at the end.

---

## 1. Navigation & information architecture

**1.1 — High** · `lib/cart.tsx:93-101, 110-137` (addItem / FulfillmentDialog mount) · `components/product-card.tsx:44-66`
**Problem:** `addItem()` returns `false` and opens the fulfilment dialog whenever branch + address are not yet confirmed. The very first "+" tap on any product card (home or menu) throws the customer into a modal that requires choosing a branch **and** placing a pin on a map / typing street + house. If they close the dialog (`onClose` at `lib/cart.tsx:114-118`), `pendingItem` is discarded: no toast, no cart flight, no item. Customers will believe the "+" button is broken. This is the single largest conversion risk in the flow.
**Recommendation:** Let items go into the cart immediately; ask for fulfilment at cart/checkout time (or at most a lightweight "Delivery / Pickup + branch" chooser without the map). If gating must stay, at least (a) keep the pending item and show a toast "Manzil tanlangach savatga qo'shiladi" on close, and (b) default to pickup at the nearest/only branch so no map is required for a first add.

**1.2 — Medium** · `app/product/[id]/product-client.tsx:150-158`
**Problem:** The back control is a hard `<Link href="/menu">` labelled "Menyu". Coming from Home, Cart upsell, Orders → Favourites, or a `/menu?category=…` deep link, "back" drops the user on the top of the full menu and loses scroll/search/category context.
**Recommendation:** Use `router.back()` when `history.length > 1` (fallback `/menu`), or carry `?from=` and restore the category anchor.

**1.3 — Medium** · `app/orders/[id]/page.tsx:177-253`
**Problem:** Order detail has no in-page way back to the list; only the bottom-nav "Buyurtma" (mobile) or top-nav (desktop). On desktop the header is `fixed` and the nav link is small; on mobile the user has to know the nav tab re-opens the list.
**Recommendation:** Add a "← Buyurtmalarim" back link in the page header, matching the pattern already used on checkout (`mf-checkout-back`).

**1.4 — Medium** · `app/checkout/page.tsx:438-461`
**Problem:** Unauthenticated users on `/checkout` see only the auth panel; the item list, totals and delivery/pickup choice are hidden. They are asked for a phone number before seeing what they are committing to.
**Recommendation:** Render the order summary (items, subtotal) beside/above the auth panel; keep the auth step inline and let quote/submit unlock afterwards.

**1.5 — Medium** · `app/order-success/[id]/page.tsx:169-171`
**Problem:** "Holatni kuzatish" links to `/orders` (the list), not `/orders/${order.id}`. The customer has to find their order again.
**Recommendation:** Link directly to the order detail page.

**1.6 — Low** · `app/cart/page.tsx:172`
**Problem:** The checkout CTA builds `/checkout?auth=1` for guests, but nothing in the checkout page reads `auth` (grep found no consumer). Dead parameter.
**Recommendation:** Remove it, or use it to autofocus the phone field.

**1.7 — Low** · `app/order-success/[id]/page.tsx:88-99`
**Problem:** If the session is gone on the success page, the only action is "Bosh sahifa". The user was just told to verify their phone but is sent home instead of to the auth panel.
**Recommendation:** Link to `/profile` (auth panel) or render `CustomerAuthPanel` inline like the other protected pages do.

**1.8 — Low** · `components/site-shell.tsx:62`
**Problem:** In the bottom nav the cart tab's text label is replaced with the raw subtotal (`72 000`) when the cart is non-empty — the "Savat" label disappears and the number has no unit. Combined with the count badge (line 63-67) the tab shows two numbers.
**Recommendation:** Keep the label "Savat" and show only the count badge; show the amount in the cart page / action bar.

**1.9 — Low** · `components/branch-picker.tsx` (whole file)
**Problem:** `BranchPicker` is not imported anywhere (grep) — dead component with its own keyboard-trap and portal logic. Adds maintenance surface and confusion about which branch UI is canonical.
**Recommendation:** Delete it or wire it into the fulfilment dialog if a compact picker is wanted.

---

## 2. Button placement & hierarchy

**2.1 — Medium** · `app/product/[id]/product-detail.module.css:162-166`, `app/globals.css:1674`
**Problem:** On mobile the primary "Savatchaga qo'shish" CTA is forced to `font-size: 12px; padding: 8px` (module) / `12px` (globals). The most important button on the page has the smallest text on the page, and the price inside it (`formatMoney(total)`) also shrinks to 12 px.
**Recommendation:** Keep ≥ 14 px, min-height 48 px; if space is tight at 375 px, stack label over price rather than shrinking.

**2.2 — Medium** · `app/product/[id]/product-client.tsx:290-337`
**Problem:** The add-to-cart row sits after variants, modifiers and an optional notes `<textarea>`, and the full menu (`CustomerMenuSections`) continues below it. On a phone the CTA ends up mid-page and scrolls away; there is no sticky action bar as on cart/checkout.
**Recommendation:** Reuse `OrderActionBar` (or a compact sticky bar) on product detail showing qty + total + "Savatchaga qo'shish".

**2.3 — Medium** · `components/order-action-bar.css:1-17,100-108` + `components/site-shell.tsx:46`
**Problem:** On cart and checkout two fixed bars stack: the bottom nav (`3.75rem`) plus the action bar (~70 px incl. notice). On a 375×667 viewport ~130 px (20 %) is permanently occupied, and `mf-checkout-page` needs `padding-bottom: 150px + nav-space` to compensate (`checkout.css:882-883`).
**Recommendation:** Hide the bottom nav while an `OrderActionBar` is mounted (checkout is a focused flow; the bar already has a back link), or merge the total into the nav's cart slot.

**2.4 — Medium** · `app/cart/page.tsx:116,118`, `components/cart-upsell.tsx:149,173`, `app/globals.css:1645-1648`
**Problem:** Cart quantity buttons are `h-9 w-9` (36 px; globals raise to 40 px on mobile), upsell add buttons are `h-9 w-9` (36 px). Both are below the 44 px target the design lock asks for and below the 48 px used elsewhere.
**Recommendation:** Use 44 px minimum for all quantity / add controls (`--mf-control-height` already exists).

**2.5 — Medium** · `components/product-card.tsx:39-42`, `app/globals.css:649-655`
**Problem:** When a product needs configuration, the "+" control is a `<Link>` to the product page styled identically to the add button. A "+" that navigates instead of adding violates expectations; the compact card never shows "Tanlash".
**Recommendation:** Use a distinct glyph/label (e.g. "→" or "Tanlash" in a pill) for configure-first products.

**2.6 — Medium** · `app/cart/page.tsx:172`, `components/order-action-bar.tsx:28`
**Problem:** The cart action bar shows `totalLabel="Jami"` with `total = subtotal` while the summary above says delivery is "Rasmiylashtirishda". The bar labels an incomplete number as the grand total; checkout then shows a larger figure.
**Recommendation:** Pass `totalLabel="Mahsulotlar"` on the cart page, or show "Jami (yetkazishsiz)".

**2.7 — Low** · `components/product-card.tsx:142-173`
**Problem:** After 2 s the stepper collapses to a count-only pill; +/- are hidden and must be re-expanded by tapping the number. Discoverability suffers, and the collapse can race with a user's second tap.
**Recommendation:** Keep the stepper expanded while the card is in view, or collapse only on scroll/blur.

**2.8 — Low** · `app/checkout/checkout.css:375-388`, `app/checkout/page.tsx:687-689, 771-777`
**Problem:** "Tahrirlash", "Qayta hisoblash", "Qayta urinish" are 12 px text buttons (`mf-text-command`) — hard to hit and to read for retry actions that matter.
**Recommendation:** Promote retry actions to the secondary button style (≥ 14 px, 44 px).

**2.9 — Low** · `app/globals.css:1523-1527`
**Problem:** Hero CTA on mobile is `font-size: 11px`; the price pill next to it is 11 px. The home page's main call-to-action is barely legible.
**Recommendation:** ≥ 14 px; drop the price pill on narrow screens if needed.

Positive: double-submit protection is correct (`submitLock` ref + `submitting` state + persisted idempotency key, `app/checkout/page.tsx:352-436, 806-840`); disabled/loading states are explicit (`OrderActionBar busy/disabled`, `checkout.css:747-750`).

---

## 3. Colour & contrast

Base luminances used: `--mf-bg #004f55` ≈ 0.063, `--mf-ivory #f5f5ef` ≈ 0.909, `#07373a` ≈ 0.031, `#17314A` ≈ 0.029, `#f5cf00` ≈ 0.640, card gradient `#258e88` ≈ 0.215 / `#096b70` ≈ 0.117, `#08686a` ≈ 0.110.

**3.1 — High** · `components/product-card.tsx:118, 122`, `app/globals.css:535-544`
**Problem:** On menu cards (teal gradient `#258e88 → #096b70`): price `#F5CF00` = **2.6:1 – 4.1:1** (fails AA at 14–15 px bold); description `text-white/64` = **≈2.5:1** at **10 px**. Both key pieces of purchase information fail.
**Recommendation:** Use a solid dark card surface (`#004f55`, yellow → 6.1:1) or put the price on an ivory chip with `#07373a`; raise description to ≥ 12 px and ≥ 80 % white.

**3.2 — High** · many, e.g. `app/cart/page.tsx:106` (`/52`), `app/orders/page.tsx:203` (`/52`), `app/orders/[id]/page.tsx:298,308` (`/48`, `/45`), `app/orders/page.tsx:181,247` (`/56`), `app/profile/page.tsx:122` (`/60`), `app/globals.css:875,989` (global remap to `rgba(23,49,74,0.62)`)
**Problem:** `#17314A` at 52 % on white ≈ **3.1:1**, at 56 % ≈ 3.5:1, at 60 % ≈ 3.9:1, at 62 % ≈ 4.0:1, at 48 % ≈ 2.8:1, at 45 % ≈ 2.6:1. On ivory `#f5f5ef` the ratios are slightly lower. These carry variant names, order dates/statuses, empty-state copy, timestamps and cancellation reasons.
**Recommendation:** Define one muted token that passes (e.g. `rgba(23,49,74,0.72)` ≈ 5.1:1 or solid `#4a5d6e`) and remove the `/45–/62` variants. `--mf-muted` (0.72) already passes (≈ 5.2:1) — use it.

**3.3 — Medium** · `app/globals.css:12` `--mf-text-soft rgba(7,55,58,0.58)`; used at `checkout.css:86`
**Problem:** ≈ **3.5:1** on ivory — fails for 12 px progress text.
**Recommendation:** Raise to ≥ 0.7 alpha or drop the token.

**3.4 — Medium** · `app/globals.css:1034-1040`
**Problem:** Focus ring for every primary/secondary button, slider arrow and category tab is `#b9b8f0` (lavender) — **≈1.7:1** against ivory and ≈ 2.1:1 against the yellow button itself. Keyboard users cannot see focus on the main CTAs. WCAG 2.2 asks ≥ 3:1 for focus indicators.
**Recommendation:** Use the global `--mf-aqua`/teal outline or a 2-tone ring (white + `#004f55`).

**3.5 — Medium** · `app/globals.css:1154-1158` vs `app/checkout/checkout.css:811-814`
**Problem:** `.mf-input:focus` = yellow border + yellow glow (yellow vs ivory ≈ **1.4:1**) — near-invisible focus on menu search, auth panel and product notes. Checkout overrides it with a green outline. Two focus languages.
**Recommendation:** One accessible input focus style app-wide (teal/green 2 px outline).

**3.6 — Medium** · `app/orders/page.tsx:262-269`, `app/order-success/[id]/page.tsx:136`
**Problem:** Every non-cancelled order status uses the same yellow chip (`bg-[#F5CF00]/28`); "Yangi" and "Yetkazildi" look identical. Rules say green = success/completed, yellow = pending/attention. The success page even uses a yellow circle for a cancelled "×".
**Recommendation:** Map status → colour: NEW/CONFIRMED yellow (pending), PREPARING/READY/SERVED teal (info), COMPLETED green, CANCELLED red. Use `#3f9f68` (already `--mf-green`).

**3.7 — Medium** · yellow usage across: CTA (`globals.css:1000`), prices (`product-card.tsx:122`), active category tab (`customer-menu-sections.tsx:343`), active bottom-nav icon/label (`site-shell.tsx:59,62`), top-nav active (`globals.css:230-235`), combo "Set" badge (`product-card.tsx:101`), favourite active (`globals.css:583`), section heading rule (`home-client.tsx:157`), status chips, checkout progress current step (`checkout.css:45-58`).
**Problem:** Yellow is the CTA colour *and* the "selected/active" colour *and* the price colour. On a menu screen ten yellow prices, a yellow tab and yellow "+" buttons compete; the CTA loses salience. `DESIGN_RULES.md` says blue/teal should carry "selected states, navigation" and yellow should be "sparing". `MAZETTO_DESIGN_LOCK.md` legitimately makes yellow the primary CTA, but it does not license it for every active state.
**Recommendation:** Reserve yellow for primary actions (and, per the lock, prices). Move active tab / active nav / selected radio to teal/aqua (`#23958d`) or ivory-on-teal. Reconcile the two docs explicitly (the lock overrides the rules for CTA colour only).

**3.8 — Low** · `app/globals.css:13-17`
**Problem:** Token names lie: `--mf-orange` is `#f5cf00` (yellow); `--mf-blue` and `--mf-aqua` are both the same teal `#23958d`. Developers reaching for "blue" per the rules get teal.
**Recommendation:** Rename to `--mf-yellow`, drop the duplicate, or give `--mf-blue` a real informational blue.

**3.9 — Low** · off-palette one-offs: `globals.css:1382` skeleton shimmer `rgba(14,165,233)` (sky blue), `globals.css:1136` quantity-button shadow `rgba(34,197,94)` (Tailwind green-500), `profile/page.tsx:158` `hover:border-[#22C55E]/36` (neon green — explicitly forbidden by the lock), `homepage-sliders.tsx:106,114` and `globals.css:316,342,375` cyan `#67e8f9`.
**Recommendation:** Replace with palette tokens.

---

## 4. Forms

**4.1 — Medium** · `components/customer-auth-panel.tsx:137-222`
**Problem:** No `<form>` element, so Enter does not submit; after "Kod olish" the OTP field is not focused; `challenge.expiresAt` is returned by the API (line 42) but never shown (no countdown / resend cooldown). Users on desktop and screen readers have to hunt for the code field.
**Recommendation:** Wrap in `<form onSubmit>`, `autoFocus` the code input once `pendingVerification` is true, show "Kod N soniya amal qiladi" and disable resend for ~30 s.

**4.2 — Medium** · `app/checkout/page.tsx:609-623` vs `components/phone-input.tsx`
**Problem:** Checkout re-implements the phone field as a plain `<input type="tel" maxLength={40}>` with a text placeholder, while auth uses the polished `PhoneInput` (+998 prefix, paste sanitising, `tel-national`). Two different phone UIs in the same flow, and the checkout one accepts free text until submit.
**Recommendation:** Reuse `PhoneInput` (with `nationalPhoneValue`) in checkout.

**4.3 — Low** · `app/checkout/page.tsx:597-623`, `components/delivery-address-picker.tsx:540-618`
**Problem:** `aria-invalid` is set but the error `<p>` is not linked via `aria-describedby`; screen readers announce "invalid" without the reason. Address fields (`floor`, `entrance`, `apartment`) lack `inputMode` hints; `house` has `autoComplete="address-line2"` which browsers fill with the *second* address line, not a house number.
**Recommendation:** Add ids + `aria-describedby`; `inputMode="numeric"` for floor/entrance; drop or correct the autocomplete token on house.

**4.4 — Low** · `components/phone-input.tsx:43-44`
**Problem:** `required` and `pattern="[0-9]{9}"` have no effect outside a `<form>` and can trigger native validation styling inconsistently.
**Recommendation:** Remove or use inside a form.

**4.5 — Low** · `app/product/[id]/product-client.tsx:283-287`
**Problem:** Kitchen notes `<textarea>` has no `maxLength`; checkout's comment has `1000`. Notes are sent per item and could be rejected server-side after the fact.
**Recommendation:** Add `maxLength` and a small counter.

**4.6 — Low** · `components/customer-auth-panel.tsx:145-153`
**Problem:** Name is optional in the UI but `verifyCode` sends it; there is no hint whether it is required or what happens if empty.
**Recommendation:** Mark "(ixtiyoriy)" or validate.

**4.7 — Low** · `components/customer-menu-sections.tsx:309-320`
**Problem:** Search icon "⌕" and clear icon "x" are text glyphs; `⌕` is not guaranteed in the system font stack (`Arial, Helvetica, sans-serif`) and can render as a box on Android.
**Recommendation:** Use lucide `Search` / `X` (already a dependency).

---

## 5. Feedback (toasts, empty states, loading, errors)

**5.1 — Medium** · `components/site-shell.tsx:74-81` + `components/order-action-bar.css:100-104`
**Problem:** Toast is fixed at `bottom: nav-space + 0.5rem`; on cart/checkout the `OrderActionBar` is fixed at `nav-space + 8px` and ~70 px tall. The toast (z-50) is drawn over the action bar, hiding the total/CTA exactly when the checkout error toast fires (`app/checkout/page.tsx:431`).
**Recommendation:** Offset the toast by the action-bar height when it is mounted (CSS var set by the bar), or show the toast at the top on those pages.

**5.2 — Medium** · `components/site-shell.tsx:74-81`, `app/globals.css:584`
**Problem:** One toast style for success ("savatga qo'shildi") and errors ("Buyurtmani yuborib bo'lmadi"); no icon, no dismiss, 2.4 s fixed. Errors auto-vanish before they can be read; screen readers get `role="status"` (polite) even for failures.
**Recommendation:** Add `variant: "success" | "error"` with colour/icon, `role="alert"` for errors, longer/persistent duration with a close button.

**5.3 — Low** · `app/product/[id]/product-client.tsx:57-86`
**Problem:** The page always refetches the product on mount even though `initialProduct` is SSR-provided, and resets `variantId`/`modifierIds` from the response (lines 67-74) — a user who already changed variant in the first 300 ms gets their selection reverted.
**Recommendation:** Only reset selections when the product id changed or the current selection is no longer valid.

**5.4 — Low** · `app/orders/page.tsx:180`
**Problem:** While loading, the active-order slot shows a 28 px skeleton but the history section shows three 24 px skeletons — fine — yet on error the active-order area collapses to nothing (`: null`), so the page looks like "no active order" while the error is only visible further down.
**Recommendation:** Show the error state in the active-order card as well.

**5.5 — Low** · `components/motion-primitives.tsx:17-48`
**Problem:** `AnimatedNumber` ignores `prefers-reduced-motion` and the global reduced-motion CSS cannot stop a JS rAF count-up.
**Recommendation:** Check `matchMedia("(prefers-reduced-motion: reduce)")` and set the value directly.

Positive: network timeouts and offline messages exist (`lib/api.ts:77-78`); the menu keeps stale data with a retry banner (`customer-menu-sections.tsx:242-247`); empty cart/orders/favourites all have branded copy and a primary action.

---

## 6. Checkout flow

**6.1 — High** · `app/checkout/page.tsx:780-782`
**Problem:** The summary footer is hard-coded: "Buyurtmani olganda naqd to'lov" regardless of the selected payment method. A customer choosing "Karta" sees the summary insist they will pay cash.
**Recommendation:** Derive the sentence from `paymentMethod` (and hide it for online methods until they are real).

**6.2 — Medium** · `app/checkout/page.tsx:142-159, 643-680`
**Problem:** Before the quote arrives, all four methods are rendered as selectable (`available: true`). If the user picks "Click" and the quote then marks it unavailable, the radio disappears but `paymentMethod` state stays `"CLICK"`, so the order is submitted with an unsupported method and fails only after submit (or worse, is accepted).
**Recommendation:** In an effect, reset `paymentMethod` to the first available code whenever `paymentAvailability` changes; render options as disabled (not selectable) until the quote is known.

**6.3 — Medium** · `lib/cart.tsx:31-56`
**Problem:** Address restoration silently selects "first branch with `deliveryEnabled`" for the customer's last saved address. There is no nearest-branch logic (spec: "nearest branch suggestion") and no distance shown in the dialog (`fulfillment-dialog.tsx:190-219`). Customers can be routed to the wrong branch without noticing; the checkout card shows the branch name only as a small third line (`page.tsx:544`).
**Recommendation:** Pick the branch by distance from the address (or ask the backend), show distance/ETA per branch in the dialog, and make the branch line prominent in the fulfilment card.

**6.4 — Medium** · `app/checkout/page.tsx:643-680`
**Problem:** All payment methods use the same `Banknote` icon (cash, card, Click, Payme). Visual scanning gives no help.
**Recommendation:** Distinct icons (CreditCard, Smartphone, brand marks).

**6.5 — Medium** · `app/checkout/page.tsx:691-724`
**Problem:** Checkout item rows show quantity and variant but not modifiers, while the line price includes modifier cost. Customers cannot verify why a lavash costs more than the menu price.
**Recommendation:** List modifier names (as the cart does at `app/cart/page.tsx:112`).

**6.6 — Medium** · whole checkout
**Problem:** No minimum-order or delivery-zone fee information is surfaced before the quote; if the backend enforces a minimum, the customer learns at submit time via a generic error toast. Delivery fee appears as "Hisoblanmagan" until auth + branch exist.
**Recommendation:** Surface min-order and fee rules from the quote endpoint (or config) on the cart page and in the fulfilment dialog.

**6.7 — Low** · `components/fulfillment-dialog.tsx:227-249`
**Problem:** In delivery mode the dialog auto-confirms and closes the moment an address is chosen; the "Shu manzilga" button inside `DeliveryAddressPicker` is the only confirm and it lives inside a scrolling body with a sticky footer (`fulfillment-dialog.css:134-148`) that has `bottom: -22px` — the sticky bar can sit partly clipped at the bottom edge of the scroll area.
**Recommendation:** Give the dialog a real footer for delivery too (like pickup) and remove the negative sticky offset.

**6.8 — Low** · `app/checkout/page.tsx:497-510`
**Problem:** The 3-step progress ("Savatcha → Rasmiylashtirish → Tayyor") is decorative: step 1 is not a link back to cart and step 3 is never reached in this component (success is a different route with no progress).
**Recommendation:** Make step 1 a link, and show the same progress (step 3 active) on the success page.

Positive: idempotency key persisted in `localStorage` (`page.tsx:806-830`); session refresh on 401 for quote and submit; `placed` ref prevents the "empty cart" flash after submit (`page.tsx:116-125, 469`).

---

## 7. Product & menu

**7.1 — Medium** · `components/product-card.tsx:118` (`text-[10px] leading-4`), `:114-116` (`text-[10px]` badge), `:101` (`text-[10px]` "Set")
**Problem:** Compact cards use 10 px body text — explicitly "tiny text" per the rules — on a low-contrast gradient (see 3.1).
**Recommendation:** ≥ 12 px, or drop the description on compact cards (the lock asks for "compact", not "unreadable").

**7.2 — Medium** · `lib/types.ts` (no availability field), `components/product-card.tsx`, `product-client.tsx`
**Problem:** There is no out-of-stock / unavailable handling anywhere in the UI (no `isAvailable`, `stock`, or similar is read). A product the branch has disabled is fully addable and fails only at quote/submit.
**Recommendation:** Expose availability per branch from the API and render a disabled card state ("Hozircha yo'q") with the add control removed.

**7.3 — Low** · `components/customer-menu-sections.tsx:194-211, 286-323`
**Problem:** Search lives in the intro block above the sticky tabs, so it scrolls away; when a query is active the sticky tab strip still shows all categories that survived the filter but there is no "N results / clear" affordance near the tabs.
**Recommendation:** Move search into (or beneath) the sticky strip, or add a compact search icon in the strip that expands.

**7.4 — Low** · `components/product-card.tsx:76-86, 111-113`
**Problem:** Both the image and the title are separate links to the same product — duplicate tab stops and duplicated screen-reader announcements per card (74 items → 148 links).
**Recommendation:** Make the whole card one link (or `tabIndex=-1` on the image link).

**7.5 — Low** · `components/product-card.tsx:98` vs `product-client.tsx:175-179`
**Problem:** Favourite icon is a "♥" text glyph on cards but a lucide `Heart` on the detail page; the card's glyph size/weight depends on the system font.
**Recommendation:** Use lucide `Heart` in both.

**7.6 — Low** · `app/globals.css:581, 1596`
**Problem:** Card copy uses fixed `grid-template-rows: 2.4rem 2rem 1.9rem` (mobile `2.3rem 2rem 1.75rem`). With `text-[13px]`/`line-height 1.25` two title lines ≈ 2.03 rem fit, but any font substitution (Arial → Roboto on Android has taller metrics) can clip descenders of the second line.
**Recommendation:** Use `minmax(…, auto)` rows with `line-clamp`, not fixed heights.

Positive: sticky category tabs with IntersectionObserver scroll-spy and manual-click suppression (`customer-menu-sections.tsx:100-132, 173-189`); variants/modifiers with required-locked checkboxes; stable 44×48 quantity stepper on detail.

---

## 8. Responsiveness

**8.1 — Medium** · `components/site-shell.tsx:53` (`text-[9px]`), `app/globals.css:1482-1486` (`font-size: 10px`)
**Problem:** Bottom-nav labels are 9–10 px. Primary navigation text below 11 px is unreadable for many users and violates "no tiny text".
**Recommendation:** 11–12 px labels; the nav is 60 px tall and has room.

**8.2 — Medium** · `app/globals.css:66`
**Problem:** `font-family: Arial, Helvetica, sans-serif` with `font-black` (900) everywhere. Arial has no 900 weight (browsers synthesise it), Android lacks Arial entirely (falls back to Roboto), so metrics differ per platform and every fixed-height row (cards, nav, stepper) is tuned for one platform.
**Recommendation:** Ship a webfont with real 700/800 weights (via `next/font`) and reduce reliance on 900.

**8.3 — Low** · `components/homepage-sliders.tsx:33-64`, `app/globals.css:1493-1533`
**Problem:** Mobile hero puts copy and image side-by-side in a `0.92fr / 1.08fr` grid at 375 px: the copy column is ~150 px wide with a 22 px title, an 11 px pill and an 11 px CTA squeezed in.
**Recommendation:** Stack the hero (image above copy) below 480 px.

**8.4 — Low** · `app/checkout/checkout.css:9`
**Problem:** `min-height: calc(100dvh - 80px)` on the checkout page plus 150 px bottom padding creates a large empty ivory area on short content (pickup, one item).
**Recommendation:** Remove the min-height; let the action bar padding define the end.

**8.5 — Low** · `components/order-progress.module.css:65-70`
**Problem:** Good container-query fallback to 3 columns, but the second row's first tile still draws a connector (`::before`) only suppressed for `nth-child(4)`; if the step list ever changes length the visual breaks silently.
**Recommendation:** Compute connectors with `:not(:first-child)` inside each row via `grid-auto-flow` or draw them with a pseudo-element on the container.

Positive: `viewportFit: "cover"` and `env(safe-area-inset-*)` are applied to header, bottom nav, action bar, toast and dialog footer; `html/body { overflow-x: clip }`; inputs are 16 px on mobile (no iOS zoom); all long strings have `overflow-wrap: anywhere` / `break-words`.

---

## 9. Accessibility

**9.1 — Medium** · see 3.4 / 3.5 — focus indicators on primary buttons and inputs are below 3:1.

**9.2 — Medium** · text glyphs used as icons: `×` (`cart/page.tsx:109`, `branch-picker.tsx:126`), `♥` (`product-card.tsx:98`), `⌕`/`x` (`customer-menu-sections.tsx:310,319`), `⌖`/`⌄` (`branch-picker.tsx:104,110`), `‹ ›` (`homepage-sliders.tsx:77-78`), `→` (`cart-upsell.tsx:176`), `✓` (`order-success:136`).
**Problem:** Rendering depends on the fallback font; several (⌕, ⌖) are outside common glyph coverage on Android. Aria-labels are present, so this is a visual reliability issue more than SR.
**Recommendation:** lucide icons.

**9.3 — Low** · `components/customer-menu-sections.tsx:214-229`
**Problem:** Category strip uses buttons with `aria-pressed`, which reads as toggle buttons; a `tablist`/`tab` pattern with `aria-selected` and arrow-key navigation would match the interaction (one active at a time).
**Recommendation:** `role="tablist"` + roving tabindex, or keep buttons but use `aria-current="true"`.

**9.4 — Low** · `components/delivery-map.tsx:281-285`
**Problem:** The map container has `aria-label` but no role; arrow-key panning is wired (`:143-151`) but there is no visible hint that keyboard users can move the pin, and the canvas is not focusable unless Leaflet sets `tabindex`.
**Recommendation:** `role="application"`, `tabIndex={0}`, and a one-line hint "Strelka tugmalari bilan suring".

**9.5 — Low** · `components/product-card.tsx:87-99`
**Problem:** Favourite toggle sits absolutely over the image link; tab order becomes image-link → favourite → title-link → add, which is fine, but the button is 40 px and the "+" add button overlaps the image bottom-right — at 375 px with 2 columns the two overlay targets are ~110 px apart on a 160 px image, acceptable, but the 10 px "Set" badge overlaps the favourite zone at top-left/right.
**Recommendation:** Move the badge below the image or into the copy block.

**9.6 — Low** · `app/orders/[id]/page.tsx:246`
**Problem:** Payment status is rendered raw (`{payment.status}` → e.g. "PENDING") — untranslated enum in customer UI (also a copy issue).
**Recommendation:** Map to Uzbek labels.

Positive: native `<dialog>` + `showModal()` gives focus trapping and Esc; opener focus is restored (`fulfillment-dialog.tsx:89-103`); live regions on order status (`order-progress.tsx:32`) and quantity (`product-client.tsx:301`); reduced-motion respected for CSS, cart flight and smooth scroll; every icon-only control audited has an `aria-label`; `lang="uz"` on `<html>`.

---

## 10. Consistency

**10.1 — Medium** · button systems: `.mf-button-primary` (`globals.css:1000-1009`, yellow gradient, r=12), `.mf-location-button.is-primary` (`checkout.css:344-348`, teal, r=10, 13 px), `.mf-checkout-submit` (`checkout.css:717-737`, gold `#ffd83d`, r=12, 14 px), `.mf-order-action-button` (`order-action-bar.css:49-68`, `#ffdd29`, r=10, 15 px), `.backButton` (`product-detail.module.css:13-35`, `#00585c`, r=8), footer `.link` (`contact-footer.module.css:41-63`, r=8), `.mf-icon-control` (r=8).
**Problem:** Four different yellows (`#f5cf00`, `#ffd83d`, `#ffdd29`, `#ffdf42→#ffd015`), three teal button fills, radii 8/10/12/16/20/24/1.25rem/1.7rem, and font sizes 12–15 px for the same "primary" role. The product page's teal "Menyu" back button looks like a primary action while the actual primary is yellow.
**Recommendation:** Consolidate to three button components (primary/secondary/text) with one radius token and one yellow.

**10.2 — Medium** · dark-text tokens: `#07373a` (`--mf-text`), `#17314A` (cart/orders/profile), `#004f55` (headings in cart/profile), `#0A4F55` (chips), `#173d37` (`checkout.css:728`), `#063f3e` (order-progress).
**Problem:** Six "dark text" colours, navy vs teal, used interchangeably across pages; cart h1 is navy `#17314A` but styled `color: #004f55` by CSS (`checkout.css:836-841`) — Tailwind class and CSS fight.
**Recommendation:** One `--mf-text` and one `--mf-heading` token.

**10.3 — Medium** · greens: `#087d78`, `#0B7F75`, `#0B8F83`, `#137652`, `#08744e`, `#23958d`, `#3f9f68`, `#419b75`, `#00665d`, `#008579`.
**Problem:** Ten near-identical teals/greens; accent colour is unpredictable from screen to screen.
**Recommendation:** Two tokens (`--mf-teal`, `--mf-green`).

**10.4 — Medium** · status labels duplicated: `app/order-success/[id]/page.tsx:26-34`, `app/profile/page.tsx:31-39` vs `lib/order-tracking.ts:12-22`.
**Problem:** Same status → different words: NEW = "Yangi" vs "Yangi buyurtma"; COMPLETED (delivery) = "Yakunlandi" vs "Yetkazildi"; SERVED and ACCEPTED are unmapped in profile/success and render raw ("SERVED"). A customer sees three vocabularies for one order.
**Recommendation:** Delete the local maps; use `trackingLabel(trackingStatus(order), order.type)` everywhere.

**10.5 — Medium** · `components/contact-footer.tsx:22-23`
**Problem:** Support phone is `tel:+99895855406` / displayed "+99895855406" — that is `+998` + 8 digits; Uzbek numbers have 9. The link almost certainly dials nothing and the display has no spacing (`formatPhone` in `lib/phone.ts:53-58` exists and is unused here).
**Recommendation:** Verify the number, store it in one config constant, render with `formatPhone`.

**10.6 — Low** · copy: "Savat" (nav), "Savatcha" (cart h1, checkout back), "Savatchaga qo'shish" (CTA), "savatga qo'shildi" (toast); "Buyurtma" (mobile nav) vs "Buyurtmalar" (desktop nav) vs "Buyurtmalarim" (buttons/links); "Bosh" (nav) vs "Bosh sahifa". Raw enum leaks: payment status (`orders/[id]:246`), unmapped order statuses (10.4).
**Recommendation:** A small copy glossary; pick "Savat" or "Savatcha" and use it everywhere.

**10.7 — Low** · dead CSS in `app/globals.css`: `.mf-home-branch-row` (403-451), `.mf-mobile-action-bar` (249-261, 1247-1252, 1650-1655), `.mf-checkout-step` (793-832), `.mf-payment-option` (834-846), `.mf-hero-shell` (283), `.mf-profile-bonus-panel` (933-938), `.mf-card-light` (992-998), `.mazetto-glass-button` (1209-1222), `.mf-product-media-panel` (765-771); in `checkout.css`: `.mf-checkout-mobile-bar` (754-756, 899-930, 982-992), `.mf-desktop-submit` (751-753, 896-898), `.mf-delivery-segment` is used only inside the dialog. Also the 40-line `.text-white\/NN` remap blocks (856-885, 947-990) exist only because components use white-opacity classes on ivory cards.
**Recommendation:** Purge; replace the remap hack with proper muted tokens (fixes 3.2 at the same time).

**10.8 — Low** · typography: `font-black` (900) is used for headings, nav labels, chips, prices, section eyebrows, button text and even 9 px badges. With everything at 900 nothing is emphasised.
**Recommendation:** Scale: 800 for h1/h2, 700 for buttons/prices, 600 for labels, 400–500 body.

---

## 11. Order tracking & profile

**11.1 — Medium** · `app/orders/page.tsx`, `app/orders/[id]/page.tsx`
**Problem:** No "Qayta buyurtma" (reorder) on history or detail, even though the snapshot has product ids/variants; repeat customers must rebuild the cart.
**Recommendation:** Add reorder that re-adds snapshot items (skipping unavailable ones with a toast).

**11.2 — Medium** · same files
**Problem:** No cancel action for a NEW order and no support contact on any order page (`ContactFooter` is only on home, menu, profile). If something is wrong the customer has no path except leaving the page.
**Recommendation:** Show branch phone / Telegram on active-order and detail pages; allow cancel while status is NEW (backend permitting).

**11.3 — Medium** · `app/profile/page.tsx:88-95, 195-201`
**Problem:** "Saqlangan manzillar" is derived from past orders' `deliveryAddress` strings (max 3, plain chips, not editable), while the real saved-address store (`/customer/me/addresses`, editable in the fulfilment dialog) is not shown. Customers cannot manage addresses from the profile and see a different list than at checkout.
**Recommendation:** Load `/customer/me/addresses` in profile and reuse `DeliveryAddressPicker` (or a read-only list with edit/delete).

**11.4 — Low** · `app/profile/page.tsx:139-148`
**Problem:** "Chiqish" logs out instantly with no confirmation; it sits directly under "Buyurtmalarim" with the same size.
**Recommendation:** Confirm, or visually demote (text button).

**11.5 — Low** · `app/orders/page.tsx:226-229`, `app/profile/page.tsx:130`
**Problem:** Bonus balance is shown in two places but never explained or usable in checkout (no "use bonus" toggle).
**Recommendation:** Add a one-line explanation or hide until redeemable.

**11.6 — Low** · `app/orders/page.tsx:204`, `app/orders/[id]/page.tsx:185, 301`
**Problem:** `toLocaleString("uz-UZ")` prints seconds ("12.09.2026, 14:03:22"); noisy for customers.
**Recommendation:** `toLocaleString("uz-UZ", { dateStyle: "medium", timeStyle: "short" })`.

**11.7 — Low** · `app/orders/[id]/page.tsx:236-249`
**Problem:** "To'lov holati" section shows raw `payment.status`, and for cash orders before pickup it says "To'lov ma'lumoti hali biriktirilmagan" — sounds like a problem.
**Recommendation:** Map statuses; for cash show "Olganda to'lanadi".

Positive: `OrderProgress` gives a clear current-state card with a plain-language description and a 6-step rail that adapts to delivery vs pickup; live updates via socket + 15 s poll + focus/visibility refresh (`lib/use-order-updates.ts`); order detail uses immutable snapshot prices as the lock requires.

---

## Done well

1. **Bottom navigation** — fixed, safe-area aware, cart exactly in the centre with a count badge, `aria-current` on the active tab, and a header/nav placed outside route transition wrappers (`site-shell.tsx:26-72`).
2. **Checkout robustness** — persisted idempotency key, submit lock, session-refresh retry, and the `placed` ref that prevents the empty-cart flash (`checkout/page.tsx:104-125, 352-436, 806-840`).
3. **Fulfilment dialog** — native `<dialog>`/`showModal()`, Esc handling, body scroll lock, opener focus restore, bottom-sheet on ≤ 599 px (`fulfillment-dialog.tsx:89-124`, `fulfillment-dialog.css:230-261`).
4. **Address UX** — reverse-geocode autofill that never overwrites user edits, Tashkent zone guard applied to click/drag/GPS uniformly, GPS timeout and permission messaging, fail-open manual entry (`delivery-address-picker.tsx:133-189`, `delivery-map.tsx:36-51, 212-276`).
5. **Sticky category tabs** — CSS sticky, IntersectionObserver scroll-spy, manual-click suppression window, active tab auto-scrolled into view, reduced-motion respected (`customer-menu-sections.tsx:100-150, 173-189`).
6. **Loading & error states** — skeletons on every async surface, stale-data banner with retry on the menu, API timeout/offline messages in Uzbek, retry buttons everywhere.
7. **Phone input** — `+998` prefix, `inputMode="tel"`, `autoComplete="tel-national"`, paste sanitising, and a client normaliser that mirrors the backend rules (`phone-input.tsx`, `lib/phone.ts`).
8. **Order tracking** — descriptive status card with live region, delivery/pickup-aware labels, socket + polling refresh, and a status history timeline with actor and reason (`order-progress.tsx`, `orders/[id]/page.tsx:255-322`).

---

## Suggested fix order

1. Stop gating the first add-to-cart on the fulfilment dialog (1.1); fix the summary "cash" line and stale payment method (6.1, 6.2); fix the support phone (10.5).
2. Contrast pass: one muted token ≥ 4.5:1, card price/description surface, focus rings (3.1–3.5).
3. Semantic colour: status chips green/yellow/red, yellow reserved for CTA + price (3.6, 3.7).
4. Tiny text: nav labels, card descriptions, mobile CTA ≥ 12–14 px (2.1, 7.1, 8.1).
5. Consolidate buttons/tokens and delete dead CSS/components (10.1–10.3, 10.7, 1.9).
6. Reorder / cancel / support on order pages; real saved addresses in profile (11.1–11.3).
