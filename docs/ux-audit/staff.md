# Staff Workspace UX/UI Audit — Mazetto Food `apps/pos-web`

Scope: cashier POS, payment, receipt, shift/cash handover, kitchen display, courier, waiter, login, workspace routing, access-denied, shared staff shell/CSS. All findings are from static code review of the files listed in the brief (plus `components/erp/erp-ui.tsx`, `components/admin-ui/button.tsx`, `app/admin-theme.css`, `lib/auth.ts`, `lib/order-display.ts`, `lib/api.ts`, which those files import). Contrast ratios were computed from the literal hex values in `staff.module.css`/`admin-theme.css`. No files were modified.

Paths below are relative to `D:\projects\Java here\Mazetto-Food\apps\pos-web\`.

---

## 0. Cross-cutting observation on the design rules

`docs/DESIGN_RULES.md` says the identity is white/green/blue and that orange/yellow is for warnings only. The implemented staff palette is dark teal + **gold as the primary CTA** (`components/staff/staff.module.css:306-311`, `:47`), and `app/admin-theme.css:5` cites a separate "brand lock: teal / gold / ivory". The two documents conflict; I have not flagged every gold CTA as a violation, but I do flag where gold's dual role (primary action *and* pending/warning) damages meaning (finding CC-1).

---

## 1. Cashier POS — `app/(fullscreen)/pos/page.tsx`

**P-1 — Critical — No order type selection.**
Location: `pos/page.tsx:310-340` (submit payload), whole file.
Problem: `POS_SPEC.md` requires DINE_IN_TABLE / DINE_IN_HALL / PICKUP / DELIVERY. The POS has no order-type control anywhere; the payload sends only `items`, `cashReceived`, `idempotencyKey`. The kitchen then labels every POS ticket as "Olib ketish" unless a table exists (`kitchen/page.tsx:559-563`), so a dine-in or delivery order created at the till is mis-routed operationally.
Recommendation: Add a persistent order-type segmented control at the top of the receipt panel (dine-in/table, takeaway, delivery), default to the branch's most common type, include `type`/`tableId`/customer for delivery in the POST, and show the chosen type in the cart header.

**P-2 — Critical — Cash-only checkout; no card/terminal/Click/Payme and no split.**
Location: `pos/page.tsx:597-655` (only "Qabul qilingan naqd pul"), `:317-320` (`validCash` gate).
Problem: The primary "Buyurtmani tasdiqlash" button is blocked until a cash amount ≥ total is typed. Card/terminal customers cannot be served from this screen. The separate `/pos/payment` page is not linked from the POS at all (no `router.push("/pos/payment")` anywhere in this file), so in practice the cashier has no discoverable non-cash path.
Recommendation: Replace the cash field with a payment-method row (Cash / Terminal / Click / Payme …) in the checkout block; show the cash-received keypad only when Cash is chosen; support split via "add tender". Fold the `/pos/payment` logic into the POS or link it prominently.

**P-3 — High — Touch POS has no on-screen numeric keypad.**
Location: `pos/page.tsx:599-609` (`<input type="number" inputMode="numeric">`), `:611-635` (quick cash: only "Aniq summa", +50 000, +100 000).
Problem: On a touchscreen till without a physical keyboard, the cashier depends on the OS soft keyboard appearing over a `type="number"` field (which also accepts `e`, `-`, and changes value on scroll-wheel). Only two quick-add denominations exist; common UZS notes (5 000, 10 000, 20 000, 200 000) are missing.
Recommendation: Add a large in-app keypad (0–9, 000, backspace, clear) with 56 px keys under the total, and a denomination row (5k/10k/20k/50k/100k/200k + exact). Keep `inputMode="numeric"` on the field as a fallback and block `e/+/-` keys.

**P-4 — High — Cart is lost on any navigation or reload; no warning.**
Location: `pos/page.tsx:126` (`cart` in component state only), `:372-386` (header "Smena" button does `router.push("/shift")`), no `beforeunload` anywhere (grep of `app/(fullscreen)`, `components/staff`, `components/courier` returned nothing).
Problem: A cashier who taps "Smena" mid-order, hits browser back, or whose tablet reloads loses the whole basket silently — direct revenue/time loss during rush.
Recommendation: Persist the cart (and `checkoutKey`) in `sessionStorage` keyed by shift id; on unmount/`beforeunload` with items present, prompt; disable/confirm the "Smena" and panel links while `cart.length > 0`.

**P-5 — High — No discount, hold/park, order notes, product notes, service/delivery fee.**
Location: `pos/page.tsx:592-656` (checkout block has only total/cash/change); `:759-836` (item dialog has variants/modifiers only).
Problem: All are required by `POS_SPEC.md` ("discount", "product notes", "order notes", "hold/save open order", "service fee", "delivery fee"). Without hold, a cashier cannot serve a second customer while the first fetches money; without notes the kitchen gets no "no onions" instruction from POS orders (KDS *does* render `item.notes` — `kitchen/page.tsx:600` — so the data path exists but the POS never sends it).
Recommendation: Add a note field in the item dialog and an "Izoh" row in checkout; add a "Kutib turish" (park) action storing the cart server-side or locally with a numbered chip row above the cart; add discount (amount/%) behind a permission.

**P-6 — Medium — Sub-44 px targets in the cart.**
Location: `staff.module.css:1063-1069` (`.quantity button` 40×40), `:1035-1042` (`.cartLineHeader .iconButton` 36×36, delete), `:1103-1105` (`.quickCash button` `min-height: 36px`, `font-size: 12px`).
Problem: Design rules forbid tiny buttons; these are the most-tapped controls on a till. The 36 px trash sits 12 px above the +/− row, inviting accidental line deletion.
Recommendation: Raise `.quantity button` to 48×48, delete to 44×44 and move it to the right of the price row (or use swipe-to-delete on mobile), quick-cash to ≥44 px with 14 px text.

**P-7 — Medium — After a sale there is no next-step CTA (receipt, new order).**
Location: `pos/page.tsx:527-537` (success banner inside `cartLines`), `:65-72` (`PosOrderResult` contains no receipt id).
Problem: The success banner shows number and change, then nothing: no "Chek chop etish", no "Yangi buyurtma", no link to `/pos/receipt/[id]` (the receipt page exists but nothing navigates to it). On mobile the view stays on the empty "Buyurtma" tab so the cashier must tap "Menyu" to continue.
Recommendation: Render a success dialog/sheet with big change amount, "Chekni chop etish" and "Yangi buyurtma" (auto-switches to menu). Return `receiptId` from the API and wire the receipt/print route.

**P-8 — Medium — Landscape phone / short-height layouts collapse the cart.**
Location: `staff.module.css:843-849` (`.terminal { height: 100dvh; overflow: hidden }`), `:1204` (mobile mode only `max-width: 767px`), `:1079-1084` (`.checkout` fixed block).
Problem: At 844×390 (phone landscape) or 1024×600 the desktop mode applies; header (~55 px) + receipt header (~60 px) + checkout block (~280 px) leave the scrollable `cartLines` almost no height, so lines are hidden.
Recommendation: Switch to the stacked mobile layout with `@media (max-width: 767px), (max-height: 520px)`, or make `.checkout` collapsible to a single total row until "Pay" is tapped.

**P-9 — Medium — Global disable/opacity flash on submit.**
Location: `pos/page.tsx:486` (`disabled={isSubmitting}` on every product), `staff.module.css:70-74` (`button:disabled { opacity: .5 }`).
Problem: Every product tile dims for the duration of the POST; visually noisy on a 20-tile grid and prevents starting the next basket while the previous one is saved.
Recommendation: Lock only the checkout block; keep the catalog interactive (the `submissionLock` ref already prevents cart mutation — `pos/page.tsx:241, 268, 296`).

**P-10 — Low — No keyboard shortcuts and search-only text entry.**
Location: no `onKeyDown` handler in any staff file (grep).
Problem: On desktop tills, F-keys/Enter-to-pay/Esc-to-clear are standard speed-ups; absent.
Recommendation: Add Enter → pay when valid, Esc → close dialog/clear search, `/` → focus search, numeric keys → keypad.

**P-11 — Low — Product tiles don't fill grid rows.**
Location: `staff.module.css:903` (`grid-auto-rows: minmax(250px, auto)`), `:915` (`.product { align-self: start }`).
Problem: Rows reserve 250 px but cards align to start, leaving ragged whitespace under short names; also `minmax(200px,…)` on a 1366 px screen with a 360 px cart yields 4 columns of ~230 px — good density, but the 16:9 image band consumes ~130 px per tile, so only ~2 rows are visible at 768×1024 portrait.
Recommendation: Use `align-self: stretch`; offer a compact "no image / list" density toggle for busy branches.

**P-12 — Low — No favourites / frequent products.** Location: `pos/page.tsx:225-232` (filter only by category/query). Spec requires it. Recommendation: A "Tez-tez" pseudo-category from shift sales stats.

---

## 2. Payment screen — `app/(fullscreen)/pos/payment/page.tsx`

**PM-1 — High — Cannot accept over-payment; no change calculation.**
Location: `payment/page.tsx:211` (`disabled={… tenderTotal !== outstanding …}`), `:71-72`.
Problem: The pay button is enabled only when tenders sum to *exactly* the outstanding amount. A customer handing 100 000 for a 73 000 order cannot be processed; there is no change display. This contradicts the POS page, which does compute change.
Recommendation: Allow `tenderTotal >= outstanding` when a CASH tender is present, show "Qaytim" prominently, and send `cashReceived`.

**PM-2 — High — No error handling, loading, or double-submit protection.**
Location: `payment/page.tsx:46-51` (`loadOrders` no try/catch), `:83-101` (`submitPayment` no try/catch, no lock, no busy state), `:209-216` (button never shows a pending state).
Problem: A failed `/payments/process` throws an unhandled rejection; the cashier sees nothing and may tap again, creating a second payment (a fresh `crypto.randomUUID()` is generated each call — `:92` — so idempotency does not protect against the retap). A failed `/orders` load shows "No payable orders.", which is false.
Recommendation: Reuse the POS pattern (`submissionLock` ref, `isSubmitting`, stable idempotency key per attempt, inline `role="alert"` error, retry button on load failure).

**PM-3 — High — No confirmation, no receipt step, no way back to POS.**
Location: `payment/page.tsx:99-100` (sets a text message and reloads list), `:31` (`AuthShell` — admin-style header, no link to `/pos`).
Problem: Money is taken with a single tap and no confirmation; afterwards only a green line of text appears; the receipt page exists but is not linked; the header is the admin `AuthShell`, so the cashier lands in a visually different application with no path back to the till.
Recommendation: Wrap in `StaffShell`, add "Kassaga qaytish", show a completion dialog with change + "Chekni chop etish", and link `/pos/receipt/[id]`.

**PM-4 — Medium — Language and terminology mix; raw payment codes.**
Location: `payment/page.tsx:31` ("Cash register", "Payment terminal"), `:106` ("Payable orders"), `:161` ("Aralash"), `:195` ("Remove"), `:201-203` ("Total/Paid/Remaining"), `:206` (English error), `:215` ("TO'LOV"), `:179` (`<option>{code}</option>` → "UZCARD", "ONLINE"), `:232` ("UZS" vs "so'm" elsewhere).
Problem: The rest of the staff UI is Uzbek with "so'm"; this page is English with Uzbek fragments and shows enum codes instead of names. Slows and confuses cashiers.
Recommendation: Localise all strings; fetch payment methods from the backend (spec: "configurable") and display `name`; unify currency formatting via `lib/order-display.ts:formatMoney`.

**PM-5 — Medium — Tender row controls are small and the remove action is text-only red.**
Location: `payment/page.tsx:166-197` (select/input `py-3 text-sm`, remove button `px-4 py-3 text-sm` red text, no icon, no confirm).
Recommendation: Use `StaffShell` button classes (44 px), an icon + label for remove, and disable removal of the last tender rather than allowing an empty list.

---

## 3. Receipt — `app/(fullscreen)/pos/receipt/[id]/page.tsx`

**R-1 — Medium — No printing, no print stylesheet, no error state.**
Location: `receipt/[id]/page.tsx:41-47` (load without try/catch → stuck on "Receipt is loading." forever on failure), `:49-51` (`markPrinted` only PATCHes a flag, never calls `window.print()`), `:101` ("Mark printed").
Problem: Staff can't actually print or reprint from this screen; a network error leaves an indefinite "loading" message.
Recommendation: Add `@media print` styles for the receipt article, a "Chop etish" button that calls `window.print()` (or the future print agent) and then marks printed; add error + retry; localise ("Receipt preview", "Print status", "Not printed yet" are English).

**R-2 — Low — Dates without timezone; small buttons.**
Location: `receipt/[id]/page.tsx:69, 98` (`toLocaleString()` with no `timeZone`), `components/admin-ui/button.tsx:29` (`md` = `px-4 py-2 text-sm` ≈ 36 px).
Recommendation: Use `formatDateTime` from `lib/order-display.ts` (or Asia/Tashkent as elsewhere), and a 44 px button.

---

## 4. Kitchen display — `app/(fullscreen)/kitchen/page.tsx`

**K-1 — High — Ticket typography is too small for a wall/kitchen display.**
Location: `staff.module.css:643-647` (`.ticketNumber` 18 px), `:691-696` (`.itemName` 13 px), `:679-690` (`.itemQuantity` 12 px, 26 px chip), `:697-703` (variant/modifier `small` 11 px), `:704-712` (`.note` 12 px), `:655-663` (`.ticketTime` 12 px), `kitchen/page.tsx:648` (branch line inline `fontSize: 11`).
Problem: KDS screens are read from 1–2 m; 11–13 px item text and a 12 px timer are unreadable at that distance. Mobile overrides only reach 14 px (`:1289-1294`).
Recommendation: On the board, use ≥ 22 px item names, ≥ 28 px quantity chips, ≥ 20 px timer, 16 px modifiers/notes; hide the branch line unless the user has multi-branch scope; offer a "TV" density toggle.

**K-2 — High — Urgency is a single red timer at a hard-coded 25 min; no card-level colour, no per-stage thresholds.**
Location: `kitchen/page.tsx:568` (`data-late={elapsed >= 25}`), `staff.module.css:664-666` (only text colour changes).
Problem: A fast-food kitchen needs escalating cues (e.g. 5/10/15 min) visible from the card border/background, and different limits for NEW vs COOKING. A 12 px red timestamp is not noticeable. The `priority` field is received (`:45`) but never rendered.
Recommendation: Add `data-age="warn|late"` on `.ticket` with a coloured left border/background band, configurable thresholds per column, and a "priority" badge; sort tickets by age within columns.

**K-3 — Medium — Notification tone is too quiet/short and depends on autoplay policy.**
Location: `kitchen/page.tsx:688-708` (880 Hz sine, gain 0.08, 180 ms, new `AudioContext` per play, silent `catch`), `:120, 144` (sound defaults on, but no user gesture is required before first play).
Problem: A 0.18 s beep at 8 % gain is inaudible over a fryer; on Chrome the first play is blocked until an interaction, and the user gets no hint the sound is muted.
Recommendation: Create one `AudioContext` on the first click (e.g. when the user presses the "Ovoz" toggle) and show a "Ovozni yoqish uchun bosing" prompt until unlocked; play a 2–3 note chime ≥ 1 s at higher gain; repeat every N seconds while unacknowledged NEW tickets exist; add a visual flash on the NEW column.

**K-4 — Medium — Action errors surface at the top of the page, far from the ticket.**
Location: `kitchen/page.tsx:365-369` (`actionError` rendered above the board), `:274-279`.
Problem: On a 4-column board the failing card may be 800 px below; the cook sees the button return to normal and does not know the bump failed.
Recommendation: Show the error inline in the ticket's `ticketActions` area (and keep the top banner for load errors).

**K-5 — Medium — One global action lock disables every ticket's buttons.**
Location: `kitchen/page.tsx:412` (`disabled={!!busyTicketId}`), `:142, 251-252`.
Problem: While one bump is in flight (up to 12 s timeout, `:260`), all other tickets are non-interactive; in rush, cooks bump several tickets in quick succession.
Recommendation: Lock per ticket (`busyTicketIds` set) and let the refresh merge results.

**K-6 — Medium — No per-column scrolling; the whole page scrolls.**
Location: `staff.module.css:574-583` (comment "board follows the page scroll"), `.column` has no `max-height`/`overflow`.
Problem: On a fixed KDS, 12 NEW tickets push the READY column header off-screen; the stats/toolbar block (`kitchen/page.tsx:319-364`) also consumes ~150 px of vertical space permanently.
Recommendation: On `min-width: 1200px` make `.board` `height: calc(100dvh - header)` and each `.ticketList` `overflow-y: auto`; collapse stats into the column headers.

**K-7 — Low — No station filtering.**
Location: `kitchen/page.tsx:76-105, 232-248` (grouping only by status/search).
Problem: Spec routes products to kitchen/bar printers; a bar screen currently sees every ticket.
Recommendation: Filter tickets by station derived from product routing; persist choice per device.

**K-8 — Low — Ambiguous labels and semantic colour use.**
Location: `kitchen/page.tsx:663` (COOKING action "Tayyor" identical to column title "Tayyor"), `:324` (stat "Tayyorlanmoqda" uses `data-tone="waiting"` → yellow warning border), `staff.module.css:590` (NEW column bottom border is brand gold, same hue as the "waiting" badge).
Recommendation: Use verb labels ("Tayyor bo'ldi"), give "in progress" a blue/info tone as the rules state, and keep yellow strictly for late/attention.

---

## 5. Courier — `components/courier/courier-orders.tsx` (used by `app/(fullscreen)/courier/page.tsx`)

**C-1 — High — Every delivery is recorded as CASH on completion, regardless of how the customer paid.**
Location: `courier-orders.tsx:279-281` (`paymentMethodCode: "CASH"` hard-coded), `:817-831` (single "Yetkazildi" button), no display of the order's payment status anywhere on the card.
Problem: Online/card-paid orders (WEB/TELEGRAM sources) will inflate the courier's cash balance and the cashier handover; the courier also can't see whether to collect money at the door.
Recommendation: Show "To'lov: naqd / to'langan" on the card; on completion ask "Naqd oldingizmi?" only when payment is pending and send the actual method; block "Yetkazildi" for cash orders when no courier shift is open (`shiftId` may be `undefined` at `:280`).

**C-2 — Medium — Cash transfer to cashier has no confirmation, unlike the shift screen.**
Location: `courier-orders.tsx:327-348, 386-403` (typed amount → immediate POST), versus `components/staff/cash-handover.tsx:215-246` (confirmation dialog).
Problem: A mistyped amount (e.g. extra zero) is submitted instantly; inconsistent with the cashier's handover flow.
Recommendation: Reuse `CashHandover` or at least open `StaffDialog` with the amount and receiver before posting; add "Barcha naqd" quick-fill.

**C-3 — Medium — Couriers can cancel any order with one confirm.**
Location: `courier-orders.tsx:832-841` (cancel icon on every card when `canUpdate`), `:626, 647`.
Problem: Cancellation is a financial/audit event (spec requires reason, actor); the courier UI offers no reason field and no gating beyond `COURIER_DELIVERY_UPDATE`.
Recommendation: Require a reason (select + text), gate behind a separate permission, or replace with "Muammo" that flags the order for the cashier instead of cancelling.

**C-4 — Medium — No offline awareness on a phone-first screen.**
Location: `courier-orders.tsx:212-227` (12 s polling; error only when a request fails), no `navigator.onLine` usage (grep).
Problem: In stairwells/basements the courier taps "Yetkazildi", waits 12 s for the timeout, gets a generic error, and may forget to retry; delivered orders stay open.
Recommendation: Listen to `online/offline`, show a persistent "Oflayn" banner, and queue status updates in `localStorage` for automatic replay (idempotent PATCH).

**C-5 — Medium — Cards are not prioritised.**
Location: `courier-orders.tsx:230-246` (filter only; no sort), `:66` (`distanceKm` available).
Problem: Ready orders and nearest orders are mixed with waiting ones; the courier scans the whole list.
Recommendation: Sort READY/SERVED first, then by `createdAt` age or `distanceKm`; pin the order currently "Kuryer yo'lda" at the top.

**C-6 — Low — Transfer input lacks numeric constraints and a label.**
Location: `courier-orders.tsx:386-394` (`inputMode="decimal"`, `min="0"` on a text input, placeholder "Summa" only).
Recommendation: `type="number" step="1000" min="1000"` with a visible label and current cash pre-fill.

**C-7 — Low — Header logo transform can overlap the title on phones.**
Location: `staff.module.css:1-3` (`.shell .brand img { transform: scale(1.85) }`), `:113-117` (layout box 164×40), `:1211-1214` (112×30 on mobile), `:107-112` (`gap: 12px`).
Problem: `transform` does not reserve layout space; the rendered logo is ~1.85× its box, so it visually extends ~47 px past its box on mobile, into the 12 px gap and the `h1`. Whether it collides depends on the transparent padding inside `header-logo.webp`; verify at 320/375 px.
Recommendation: Size the image with `width/height` instead of `transform`, or increase the box and gap accordingly.

---

## 6. Waiter — `app/(fullscreen)/waiter/page.tsx`

**W-1 — Critical — No error handling, loading, or submit protection anywhere.**
Location: `waiter/page.tsx:56-64` (`load` no try/catch), `:99-109` (`openTable`), `:111-127` (`addProduct`), `:129-139` (`updateOrderStatus`) — all fire-and-forget; `:154-167` and `:202` buttons never disable.
Problem: A failed "Send kitchen" is invisible; tapping "Open table" twice creates two orders; tapping a product twice adds it twice with no feedback in between.
Recommendation: Port the POS pattern (busy ref, inline error, disabled while pending, confirmation for "Send kitchen").

**W-2 — High — Order entry is unusable for real service.**
Location: `waiter/page.tsx:200-206` (flat, unsearchable product list in a `max-h-64` box, `text-sm`), `:116` (always first variant, `modifiers: []`), `:190-195` (items shown with raw `quantity · totalPrice`, no remove, no qty).
Problem: No categories, search, variants, modifiers, quantity, notes, or removal; product buttons are ~40 px tall. A waiter cannot correct a mistake.
Recommendation: Reuse the POS catalog + item dialog components inside a bottom sheet on mobile; add per-line +/−/delete and notes; send only new lines to the kitchen.

**W-3 — High — No confirmation on "Send kitchen" / "Request pay"; buttons undersized.**
Location: `waiter/page.tsx:207-210` (`PrimaryButton` → `admin-ui/button.tsx:29` `md` ≈ 36 px tall, identical style for both actions), `:136` (hard-coded English `reason`).
Recommendation: 48 px buttons, distinct secondary style for "Request pay", confirm dialog listing unsent items.

**W-4 — Medium — Table map is a plain grid with raw enum labels and non-semantic colours.**
Location: `waiter/page.tsx:145-148` (legend: "Occupied" is red `#c8352f`), `:165` (`{table.status}` raw uppercase in an 11 px pill), `:239-247`.
Problem: Design rules reserve red for destructive/cancelled; "occupied" is the normal state of a busy restaurant and now reads as an error. 11 px status text violates "no tiny text". No hall grouping, no floor plan (spec: "table layout/floor plan in a future stage" — acceptable, but grouping by hall is cheap).
Recommendation: Blue/info for occupied, green for free, yellow for reserved, grey for cleaning; localised 13–14 px labels; group by `hall.name` with section headers.

**W-5 — Medium — Language and formatting.**
Location: `waiter/page.tsx:145-148, 162-165, 170, 178, 197, 208-209, 215, 218, 223` (English), `:186, 193` (unformatted `total`/`totalPrice` strings, raw `status`).
Recommendation: Uzbek copy; `formatMoney` and `orderStatusLabels` from `lib/order-display.ts`.

**W-6 — Low — Only the first open order per table is handled.** Location: `waiter/page.tsx:97` (`orders[0]`). Recommendation: List all open orders for the table or block opening a second one.

---

## 7. Shifts & cash handover — `app/(fullscreen)/shift/page.tsx`, `components/staff/cash-handover.tsx`

**S-1 — Medium — Cash shortage is rendered in green.**
Location: `shift/page.tsx:469-476` (difference in `.change`), `staff.module.css:1117-1124` (`.change { color: #347555 }` unconditionally), `shift/page.tsx:647-651` (`differenceText` returns text only).
Problem: "Kamomad: 50 000 so'm" appears in the success colour; the closing summary at `:499-512` and the dialog at `:585-598` also have no tone.
Recommendation: Add `data-tone="short|over|match"` and colour red/yellow/green; make the value ≥ 20 px in the confirmation dialog.

**S-2 — Medium — Opening balance defaults to "0" and is accepted without a second look.**
Location: `shift/page.tsx:98` (`useState("0")`), `:120-126` (valid when ≥ 0), `:557-571` (single tap opens).
Problem: Cashiers routinely open with a float; a default of 0 is silently accepted and skews `expectedCash` for the whole shift.
Recommendation: Start empty, show last shift's closing balance as a suggestion, and confirm when 0 is submitted.

**S-3 — Medium — Transfer dialogs lack a cancel button and duplicate the page error.**
Location: `shift/page.tsx:625-630` (only "Tasdiqlash", no `dialogActions`/"Ortga"), `cash-handover.tsx:236-245` (same), `shift/page.tsx:329-333` + `:599-603`/`:628` (same `error` state rendered on the page *and* inside the open dialog).
Recommendation: Use the `dialogActions` pattern from the close-shift dialog (`:604-622`) everywhere; scope errors to the dialog while it is open.

**S-4 — Low — Warning colour used for neutral stats.**
Location: `shift/page.tsx:347` (`data-tone="waiting"` on order count), `courier-orders.tsx:430` (order sum), `kitchen/page.tsx:324`.
Recommendation: Neutral or info tone for counts; reserve yellow for pending/attention.

**S-5 — Low — Kitchen/courier roles are routed into the cashier shift console.**
Location: `shift/page.tsx:74-81` (roles include KITCHEN, COURIER), `:516-572` ("Smenani ochish" visible for them).
Problem: A cook could open a cash shift; copy says "Xodim kassasi" but the screen is the cashier's ledger.
Recommendation: Hide open/close for roles without `POS_USE`/`CASH_TRANSACTION_CREATE`; show only their own handover section.

---

## 8. Login / workspace / access-denied

**L-1 — Medium — Password-only login; no PIN or fast re-auth for shared tills.**
Location: `app/login/page.tsx:118-128` (single password field), `:97-116` (phone/email switch).
Problem: Shift changes on a shared terminal require typing a phone + password each time; no employee-code + PIN path, no "switch user" from `StaffShell` (logout only, `staff-shell.tsx:46-54`).
Recommendation: Add a PIN pad mode (employee code + 4–6 digit PIN) for terminal devices; keep password for admin/manager.

**L-2 — Medium — Blank white screens during routing and guard checks.**
Location: `app/workspace/page.tsx:25` (`<main className="min-h-screen bg-white" />`), `components/auth/permission-guard.tsx:34`, `components/auth/role-guard.tsx:35`.
Problem: Every workspace load and every redirect flashes a blank page with no logo or spinner; on a slow tablet this looks like a crash.
Recommendation: Render a branded loading shell (logo + "Yuklanmoqda…") with `role="status"`.

**L-3 — Low — Technical jargon and mixed language on staff-facing screens.**
Location: `app/login/page.tsx:52-54` ("permission", "JWT va refresh session xavfsizligi"), `app/access-denied/page.tsx:16-17` ("Account", "permission").
Recommendation: Plain Uzbek ("Ruxsat", "Xavfsiz sessiya"); drop the JWT line.

**L-4 — Low — Access-denied offers only "back to login" while the user is still signed in.**
Location: `app/access-denied/page.tsx:19-25`.
Recommendation: Offer "Mening ish joyimga" (`getPrimaryRedirect`) and "Chiqish".

**L-5 — Low — Silent submit on incomplete phone.**
Location: `app/login/page.tsx:19` (`return` with no message when `phone.length !== 9`); browser validation exists via `pattern` (`components/phone-input.tsx:44`) but the guard fires first if the form is submitted programmatically.
Recommendation: Set an inline error "9 raqam kiriting".

**L-6 — Low — Login mode tabs are ~36 px.** Location: `app/login/page.tsx:90` (`py-2 text-sm`). Recommendation: `py-3` / 44 px.

---

## 9. Colour & contrast (computed)

| Pair | Ratio | Verdict |
|---|---|---|
| Ink `#07373a` on white | 12.99 | Pass |
| Muted `#53706e` on `#f0f5f4` / white | 4.88 / 5.37 | Pass |
| Primary text `#07373a` on gold `#ffd83d` | 9.37 | Pass |
| White on `#004f55` (secondary, header, paybar) | 9.34 | Pass |
| Error `#a52230` on `#fff0ed`; danger `#ae2a32` on `#fff3f2` | 6.60 / 6.09 | Pass |
| Badges (ready/waiting/cooking/late) | 5.55–5.99 | Pass |
| Note `#745900` on `#fffae6`; qty chip `#685100` on `#fff0a6` | 6.33 / 6.60 | Pass |
| **Empty-state text `#69847a` on `#f0f5f4`** (`staff.module.css:358-367`) | **3.68** | **Fail (text < 4.5)** |
| **Input border `#b4ccc0` on white** (`:519-530`) | **1.70** | **Fail (UI component < 3:1)** |
| **Control borders `#d5e2dd` on white** (`.button`, `.quantity`, `.categoryNav button`, `.choice`) | **1.33** | **Fail (< 3:1)** — buttons are identified by text so this is Low, but unpressed category chips (`:880-891`, white on `#f0f5f4` = 1.09) have effectively no boundary |
| Focus ring `#128780` on white / `#f0f5f4` | 4.37 / 3.97 | Pass (≥ 3:1) |
| Neutral-500 `#737373` on white (payment/receipt pages) | 4.74 | Pass (barely) |
| Connection dot `#23845b` on `#f0f5f4` (7 px, `:263-268`) | 4.22 | Pass, but 7 px is too small to perceive; pair with text (already does) |

**CC-1 — Medium — Gold carries three meanings at once.**
Location: `staff.module.css:306-311` (primary CTA), `:458-461` (`waiting` badge `#fff2bc`), `:704-712` (note), `:679-690` (quantity chip), `:590` and `:616` (NEW column border and count badge), `:1113-1116` (quick-cash hover), `:190-196` (heading accent), `:86` (header rule).
Problem: The rules say yellow is for warning/pending "sparingly"; here yellow is the brand accent, the primary action, the pending state and the kitchen-note highlight. The eye can't use colour to find "what needs attention" on the KDS.
Recommendation: Keep gold for primary CTAs only; move pending/late to an orange-red band with an icon; use blue/info for in-progress, green for ready.

**CC-2 — Low — Fix the two failing pairs.** Darken empty text to ≥ `#557267`; raise input/control borders to ≥ `#8fa8a0` (≈ 3:1) or add a 1 px inner shadow.

**CC-3 — Low — Palette drift across screens.** `login` and `payment`/`receipt` use Tailwind `emerald-*` (`login/page.tsx:41, 63, 107`; `payment/page.tsx:112, 134, 157, 210`); `waiter` uses hard-coded `#008a84/#29996a/#c8352f`; staff shell uses `#004f55/#128780`. Consolidate on `admin-theme.css` tokens.

---

## 10. Feedback & states (summary of gaps not already listed)

**F-1 — Medium — No toast/auto-dismissing feedback; success banners persist.** POS success stays until the next add (`pos/page.tsx:291, 307`); kitchen/courier have no success feedback at all (card just moves). Recommendation: a shared `StaffToast` with `role="status"`, 3–4 s auto-dismiss.

**F-2 — Medium — No offline state anywhere** (see C-4; also applies to POS and KDS). Recommendation: shared `useOnline()` banner in `StaffShell`.

**F-3 — Low — Disabled CTAs at 50 % opacity look broken for first-time cashiers.** `staff.module.css:70-74`; the main pay button is disabled until cash is entered (`pos/page.tsx:649`). Recommendation: keep enabled and validate on tap with an inline hint, or show why it's disabled ("Naqd summani kiriting").

---

## 11. Responsiveness (summary)

- Handled well: POS stacked mode with fixed pay bar (`staff.module.css:1318-1418`), KDS 4→2→1 columns (`:575-580, 1181-1185, 1277-1282`), courier 2→1 (`:741-745, 1295-1298`), shift 2→1 (`:1422-1431`), dialog width `min(520px, 100% - 24px)` (`:479`).
- **RS-1 — Medium** — landscape phones / 600 px-tall tablets in POS (P-8).
- **RS-2 — Medium** — `payment`, `receipt`, `waiter` use Tailwind grids with `xl:` breakpoints (`payment/page.tsx:104`, `waiter/page.tsx:142`), so at 768–1279 the order list stacks *above* the tender form, pushing the pay button below the fold.
- **RS-3 — Low** — `.stats` stays 3-up at 320 px (`:201-208`, `:1244-1259`); money values wrap mid-number ("1 234 / 567 so'm") because of `overflow-wrap: anywhere` (`:234`). Recommendation: 1-column stats below 400 px or a horizontal scroll strip.
- **RS-4 — Low** — kitchen mobile filters at 320 px: 4 columns with `padding: 8px 4px` and 12 px labels (`:17-27`, `:1267-1272`) — "Qabul 12" fits but is at the "tiny text" limit.

---

## 12. Accessibility

- Good: `aria-pressed` on segments/categories, `aria-label` on every icon button, `role="alert"` on errors, `<nav aria-label>`, native `<dialog>` with focus restore (`staff-shell.tsx:138-150`), `prefers-reduced-motion` honoured (`staff.module.css:1432-1439`), `focus-visible` ring (`:75-79`).
- **A-1 — Medium** — `<select>` elements are excluded from the custom focus ring (`:75-76` list only `button, a, input, summary`) and `.historySelect`/`.input` selects have no `:focus` style (`:500-1508`, `:519-530`). Native ring remains (no `outline: none`), but it is inconsistent.
- **A-2 — Medium** — KDS/courier live updates are not announced: no `aria-live` region for new tickets or sync status (`staff-shell.tsx:78-93`, `kitchen/page.tsx:162-168`). Add `aria-live="polite"` to `StaffSync` text and an offscreen announcer for "N ta yangi buyurtma".
- **A-3 — Low** — Header panel links are 12 px / 32 px tall on desktop (`panel-switcher.tsx:54` `text-xs py-1.5`; `staff.module.css:1468-1473`) and the logout icon is 34 px (`:143-153`); on a touch till these are the hardest targets on the page.
- **A-4 — Low** — All `StaffDialog`s share the static id `staff-dialog-title` (`staff-shell.tsx:155, 173`); safe today because dialogs are mutually exclusive, but fragile.

---

## 13. Consistency

**X-1 — High — Three different design systems across the staff surface.** `StaffShell` + `staff.module.css` (POS, shift, kitchen, courier); `AuthShell` + Tailwind emerald (payment, receipt: `payment/page.tsx:31`, `receipt/[id]/page.tsx:30`); `StaffShell` + hard-coded Tailwind hex (waiter: `waiter/page.tsx:155-165`). Headers, buttons, radii (`rounded-3xl` vs 8 px), shadows and copy language all differ within one cashier session (POS → payment → receipt).
Recommendation: Move payment/receipt/waiter onto `StaffShell` and the `staff.module.css` primitives (or the `admin-ui` tokens), and delete the `erp-ui` transition layer for staff screens.

**X-2 — Medium — Duplicated helpers with divergent behaviour.** `money()` in `pos/page.tsx:859` and `shift/page.tsx:635` (rounded, "so'm"); `cash-handover.tsx:31` (not rounded); `payment/page.tsx:231` and `receipt/[id]/page.tsx:108` ("UZS"); canonical `formatMoney` in `lib/order-display.ts:100`. `historyActor` duplicated in `pos/page.tsx:193` and `courier-orders.tsx:89`. The history dialog markup (search + status select + list) is copy-pasted in `pos/page.tsx:692-758`, `kitchen/page.tsx:432-480`, `courier-orders.tsx:515-618`.
Recommendation: One `formatMoney`, one `<StaffHistoryDialog>` component, one `dateTime` helper.

**X-3 — Low — Payment method list hard-coded and diverges from spec.** `payment/page.tsx:22-25` (CASH, CARD, CLICK, PAYME, UZCARD, HUMO, ONLINE) vs `POS_SPEC.md` (TERMINAL, RAHMAT, CORPORATE_CARD, OTHER; "must be configurable").

---

## Things done well

1. **Robust submission safety in POS** — idempotency key regenerated on every cart change, a ref-based lock, and cart edits blocked in flight (`pos/page.tsx:107-108, 136, 290, 306, 321-352`).
2. **Shift gating and close confirmation** — the POS refuses to run without an OPEN shift (`pos/page.tsx:165-168`), and closing shows expected/actual/difference in a modal before committing (`shift/page.tsx:576-623`).
3. **Accessible native dialogs** — `<dialog>` with `showModal`, Escape/backdrop guarded while busy, body scroll lock and focus restoration (`staff-shell.tsx:127-188`).
4. **Mobile POS pattern** — Menu/Order segment, fixed bottom pay bar with `env(safe-area-inset-bottom)` and a two-step "Buyurtma → Tasdiqlash" flow (`pos/page.tsx:390-411, 660-691`; `staff.module.css:1386-1418`).
5. **Courier navigation and contact** — `tel:` links, Google/Yandex deep links, strict coordinate validation so bad data never produces a broken route, and an honest "straight-line distance" comment (`courier-orders.tsx:61-66, 757-789, 849-877`).
6. **Kitchen polling hygiene** — request versioning + abort, paused in hidden tabs, new-ticket detection for the tone, permission-aware actions, confirm-before-cancel (`kitchen/page.tsx:146-187, 213-230, 250-284, 481-520`).
7. **Baseline touch sizing and motion respect** — 44 px minimum on shared buttons, 48 px inputs and choice rows, 46 px search, `prefers-reduced-motion` global override, hover effects only under `(hover: hover)` (`staff.module.css:272-300, 519-545, 1432-1439, 1453-1467`).
8. **Timeouts and retry on every staff fetch** — `AbortSignal.timeout` everywhere in the StaffShell screens, session-expiry detection that logs out cleanly, and a visible "Qayta urinish" for catalog failures (`pos/page.tsx:156-185, 412-426`; `shift/page.tsx:128-180`).

---

**Totals:** 51 findings — Critical 3 (P-1, P-2, W-1), High 12, Medium 25, Low 11 — across POS (12), payment (5), receipt (2), kitchen (8), courier (7), waiter (6), shift (5), login/routing (6), colour/contrast (3), feedback/responsive/a11y/consistency (remaining). The three highest-impact fixes for the business are: add order type + non-cash tenders to the POS (P-1/P-2), put the payment/receipt/waiter pages on the same shell with real error handling (X-1, PM-2, W-1), and make the KDS legible from a distance with real urgency cues (K-1/K-2).
