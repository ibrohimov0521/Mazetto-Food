# Admin / Manager Panel UX-UI Audit — Mazetto Food (`apps/pos-web`)

Scope read in full: `app/(shell)/layout.tsx`, all of `components/admin-shell/*`, all of `components/admin-ui/*`, `components/erp/erp-ui.tsx`, `app/admin-theme.css`, `app/globals.css`, `lib/admin-nav.ts`, `lib/order-display.ts`, all 24 `components/admin/*.tsx` screens, the `manager/dashboard`, `accounting`, `tables`, `printers`, `recipes` pages and the `page.tsx` wrappers. Contrast ratios below were computed from the hex tokens in `admin-theme.css` (WCAG relative-luminance formula). All paths are relative to `apps/pos-web/`.

---

## 1. Navigation / Information Architecture

**1.1 — High — `lib/admin-nav.ts:48-306`**
Problem: 25 items across 8 flat groups. Ordering is not task-driven: "Kassa va moliya" (shifts, receipts, payments, expenses) is the *last* group, after "Sozlamalar", while "Hisobotlar" is a one-item group. Finance-adjacent items are split across three groups (Xarajatlar in Kassa, Savdo hisoboti in Hisobotlar, Buxgalteriya in Boshqaruv).
Recommendation: Order groups by frequency of use (Boshqaruv → Operatsiya → Kassa va moliya → Katalog → Ombor → Odamlar → Sozlamalar) and merge "Hisobotlar" into "Kassa va moliya" (the reports page already has 5 tabs). Consider collapsible groups so 25 rows don't require scrolling at 768px height.

**1.2 — Medium — `lib/admin-nav.ts:55/255, 109/185, 74/239, 81/299`**
Problem: Duplicate icons for different destinations: `gauge` (Dashboard *and* Biznes sozlamalari), `truck` (Kuryerlar *and* Yetkazib beruvchilar), `building` (Filial boshqaruvi *and* Filiallar), `banknote` (Buxgalteriya *and* Xarajatlar). In the collapsed 60px rail (`admin-sidebar.tsx:44-50`) the icon is the only cue, so the rail is ambiguous — the exact problem the icon system was introduced to fix (`components/admin-ui/icon.tsx:9-13`).
Recommendation: Give each item a unique icon (`settings`/`sliders`, `package`, `calculator`, `receipt-minus`, etc.).

**1.3 — Medium — `components/admin-shell/admin-sidebar.tsx:95`, `app/admin-theme.css:184-188`**
Problem: Active-state styling is defined twice with different intent: the component sets `bg-mz-shell-deep font-semibold text-mz-white`, then the theme CSS overrides `#admin-sidebar a[aria-current="page"]` to gold text on `#ffffff0d` with an inset ring. A reader of the component cannot tell what renders; two sources of truth.
Recommendation: Remove the CSS override and express the final design in the component classes (or vice-versa).

**1.4 — Medium — `admin-sidebar.tsx:92-99`, `admin-navbar.tsx:305, 315, 340`**
Problem: Sidebar rows are `py-1.5 text-[13px]` (~30px tall); header hamburger/collapse buttons are `h-8 w-8` (32px); user-menu trigger `h-8`. DESIGN_RULES ("optimized for touchscreens", "no tiny buttons") and the 44px minimum are not met on the two most-used controls.
Recommendation: `min-h-11` on nav links (≥44px), `h-10 w-10` minimum for header icon buttons.

**1.5 — Medium — `admin-sidebar.tsx:76`, `admin-navbar.tsx:148, 156`**
Problem: `text-[10px]` used for group headings, role label and avatar initials. "Tiny text" is explicitly banned in DESIGN_RULES.
Recommendation: Minimum 11px for uppercase labels, 12px for readable text.

**1.6 — Medium — `components/admin-shell/branch-scope-badge.tsx:639, 650`**
Problem: The branch-scope indicator is `hidden … sm:inline-flex` (invisible on phones) and for branch-scoped roles it renders the literal word "Filial" rather than the branch name, so a manager never sees *which* branch they are scoped to.
Recommendation: Show the resolved branch name (from `user.branchId` → branches), and keep a compact variant (dot + short name) visible at all widths.

**1.7 — Medium — `app/admin-theme.css:189-195`, `components/admin-shell/access-denied-panel.tsx:684, 718`**
Problem: `.mz-admin main h1 { border-left: 4px solid #ffd83d; padding-left: 12px }` applies to *every* `h1` in main, including the centered `h1` inside `AccessDeniedPanel`/`UnknownRoutePanel`, producing a gold bar on a centered headline.
Recommendation: Scope the decoration to the page-header component (a class on `AdminPageHeader`'s `h1`), not to the element selector.

**1.8 — Low — `app/(shell)/admin/orders/page.tsx:64-77` and all wrappers**
Problem: Middle breadcrumbs ("Operatsiya", "Katalog", "Kassa va moliya") have no `href`, so a 3-level trail has one dead link in the middle. The order detail crumb is the generic "Detal" and the `h1` is "Buyurtma" — the order number is only visible inside a card below.
Recommendation: Drop the non-navigable group crumb (or link it to the first item of the group). Let detail pages pass the entity identifier up to `AdminPageHeader` once loaded.

**1.9 — Low — `admin-navbar.tsx:210` vs `admin-theme.css:130`**
Problem: Comment says header is 60px; token is 52px. Cosmetic but misleading.

**1.10 — Low — `admin-navbar.tsx:218-219`**
Global search intentionally omitted because no backend endpoint. Reasonable, but there is no order-number / phone search on the orders list either (see 9.1), so the admin has no way to find a specific order at all.

---

## 2. Dashboard

**2.1 — High — `components/admin/admin-dashboard.tsx:99-145`**
Problem: The dashboard has four "today" KPIs, a catalog-count card and a link grid. No time-range control, no trend/compare, no chart, no top products, no open-order count, no branch breakdown. The catalog counts (products/categories/active branches) are not operational KPIs. `QuickLinks` duplicates the sidebar.
Recommendation: Add period control (today / yesterday / 7d) using the existing `/reports/sales` presets, a compact time-series, "open orders now" and "kitchen tickets waiting" (both endpoints exist), and replace QuickLinks with an "attention needed" list (unassigned deliveries, low stock, shifts with cash difference).

**2.2 — Medium — `admin-dashboard.tsx:92`**
Problem: Loading state is `SkeletonRows rows={6}` (six list bars) although the loaded layout is a 4-column KPI grid + card. Layout shift on every load. `ShellContentSkeleton` (`shell-content-skeleton.tsx:753-762`) already models the correct shape but is not reused.
Recommendation: Reuse `ShellContentSkeleton` or a KPI-grid skeleton.

**2.3 — Medium — `app/(shell)/accounting/page.tsx:40-50`, `app/(shell)/manager/dashboard/page.tsx:13-24`**
Problem: Both role landing pages render the identical `AdminDashboard`. The accountant page description promises "financial indicators for all branches" but shows the same four KPIs + "Ochiq smenalar" and catalog counts. No primary path to Reports, which the file comment itself identifies as the accountant's main job.
Recommendation: Give each landing a role-specific composition (accountant: revenue by branch, payments breakdown, expenses, link to Z-report; manager: kitchen queue, couriers, shift status).

**2.4 — Medium — `components/admin/admin-reports.tsx:419-429, 686-709`**
Problem: The "chart" is a vertical list of `ChartRow` cards (label, value, bar, detail), ~70px each. A 30-day custom range renders ~2,100px of rows; "year" with day grain would be worse. Bars are gold on a white track (contrast 1.39:1, see 8.5) and inherit the 2px bevel shadow from `.mz-admin .bg-mz-primary` (`admin-theme.css:202-204`). Labels are raw ISO dates (`row.date`).
Recommendation: Render an actual bar/line chart (SVG) with formatted axis labels; keep the row list as an accessible fallback table.

**2.5 — Low — `admin-reports.tsx:301-312` + `362-367`**
Problem: The date preset exists twice on the same screen — a `<select>` in the filter form and a `ChipGroup` below it. Choosing a chip reloads immediately; choosing the same value in the select requires "Ko'rish". Two controls, two behaviors, one value.
Recommendation: Keep the chips (+ a "Maxsus" chip revealing date inputs), remove the select.

---

## 3. Tables (`components/admin-ui/data-table.tsx`)

**3.1 — High — `data-table.tsx:145-192`; no `sticky` anywhere in scope (grep)**
Problem: No sticky header. Customers, online orders, audit and expenses use 50 rows per page; the column meaning is lost after the first screen.
Recommendation: `thead th { position: sticky; top: 0 }` inside the scroll container, or `top: var(--mz-header-h)` for page-level scroll.

**3.2 — High — `app/(shell)/admin/printers/page.tsx:96-121`, `components/admin/admin-reports.tsx:718-794`**
Problem: Two tables bypass the shared `DataTable`. The printers table is a raw `<table>` inside `overflow-hidden` with no mobile transformation — at 375px it clips (violates "no clipped cards" / "no horizontal overflow"). The reports `DataTable` copy has no numeric alignment (money columns are left-aligned), uses `font-black`, and duplicates the mobile-card logic.
Recommendation: Migrate both to `admin-ui/DataTable` with `align: "right"` on numeric columns.

**3.3 — Medium — `data-table.tsx:39, 231-283`; every screen in scope**
Problem: Sorting is implemented (`sortable`, `onSort`, `aria-sort`) but no audited screen passes `sortable`/`onSort`. Users cannot sort orders by total/date, customers by orders, stock by quantity, etc.
Recommendation: Enable client-side sorting where data is fully loaded (products, categories, modifiers, stock, roles) and server sort params where paginated.

**3.4 — Medium — `admin-online-orders.tsx:108-128, 294-301`; `admin-customers.tsx:78-93, 238-245`; `admin-receipts.tsx:197-205, 382-389`**
Problem: Search/status/printed filters run on the current page only, but `Pagination count` is the unfiltered `orders.length`, so the footer says "1–50-buyurtma" while the table shows, say, 3 rows. Online-orders and customers label the search "Shu sahifada:"; receipts' printed filter has no such hint.
Recommendation: Pass the filtered count (or show "X of 50 on this page"), and add the "shu sahifada" hint to the receipts filter — or better, push these filters to the server.

**3.5 — Medium — `admin-orders.tsx:261-276, 440-482`**
Problem: Bulk selection is modeled as a normal column (`key: "select"`, header "Tanlash"). On mobile the card view renders a `dt`/`dd` row literally labelled "Tanlash" with a checkbox on the right. The bulk action bar (select + button) is permanently visible even with zero selection, and the select-all checkbox is a bare native `<input>` inconsistent with the styled checkboxes elsewhere.
Recommendation: Add first-class `selectable`/`onSelectionChange` support to `DataTable` (checkbox cell with no header text on mobile), and show the bulk bar only when `selectedOrderIds.size > 0`.

**3.6 — Medium — `data-table.tsx:48-87` vs inline "actions" columns (`admin-orders.tsx:341-355`, `admin-catalog.tsx:173-187`, `admin-modifiers.tsx:212-231`, `admin-homepage.tsx:289-314`, `admin-suppliers.tsx:201-220`, `admin-payments.tsx:186-201`)**
Problem: Two competing row-action patterns: the `rowActions` slot with 36px icon `RowAction` (categories, receipts) versus an ad-hoc last column with `size="sm"` text buttons (everything else). Modifiers/homepage/suppliers put a red "danger" button on every row.
Recommendation: Standardize on `rowActions`; primary row action = text ghost button, secondary/destructive = icon `RowAction` or an overflow menu.

**3.7 — Medium — `data-table.tsx:210-215`**
Problem: In the mobile card view both `dt` and `dd` are `text-xs` (12px) — smaller than the desktop cell (`text-sm`). Mobile is where text should get larger, not smaller.
Recommendation: `text-sm` for `dd`, `text-xs` only for `dt`.

**3.8 — Medium — `data-table.tsx:37, 138-140`; e.g. `admin-shifts.tsx:149-154`, `admin-inventory.tsx:363-379`**
Problem: `hideOnMobile` silently drops columns with no way to reveal them (expected cash on shifts, minimum/value on stock, unit price on order items). No "show more" on the card.
Recommendation: Render hidden columns in a collapsed "Batafsil" section of the card instead of dropping them.

**3.9 — Low — `data-table.tsx:145`**
Problem: The desktop `<table>` switches on at `md` (768px). Orders has 8 columns (checkbox + 6 + action) and shifts 7; at 768–1023 they scroll horizontally inside the card. Card view would serve tablets better for the widest tables.
Recommendation: Allow a per-table breakpoint (`desktopFrom: "lg"`).

**3.10 — Low — `components/admin-ui/pagination.tsx:322-325`**
Problem: `isLastPage = count < pageSize` — when the last page has exactly `pageSize` rows, "Keyingi" leads to an empty page with only "Oldingi". Documented, but user-visible.
Recommendation: Request `pageSize + 1` and use the extra row as a "has more" flag until the backend returns totals.

---

## 4. Forms

**4.1 — High — `components/admin-ui/form.tsx:335-382` vs all callers**
Problem: `FormField` supports an inline `error` prop, but no screen ever passes it. All validation failures go to a 5-second toast (`admin-product-editor.tsx:258-276`, `admin-modifiers.tsx:112-115`, `admin-inventory.tsx:305-308`, `admin-expenses.tsx:143-146`, `admin-branches.tsx:182-185`, `admin-categories.tsx:114-117`). The offending field is never marked or focused; the message disappears.
Recommendation: Map validation to field-level `error` and focus the first invalid control; keep toasts for server-side outcomes.

**4.2 — High — `admin-product-editor.tsx:314-316, 107-108, 654`**
Problem: After creating a product, the code does `window.history.replaceState` to `/admin/products/:id`, but the `productId` prop from `useParams` does not change, so `isNew` stays `true`: the header still reads "Yangi", the branch-availability card stays hidden, and a second "Saqlash" issues another `POST` → duplicate product.
Recommendation: `router.replace()` so the route (and `productId`) updates, or hold the created id in state and switch to `PATCH`.

**4.3 — High — `admin-product-editor.tsx:741-748`, `admin-staff.tsx:603-611`; no `beforeunload`/route guard anywhere**
Problem: The Save/Cancel row sits at the bottom of a long page (product editor = 4 cards + aside) and is not sticky. There is no dirty-state indicator and no unsaved-changes guard; "Bekor qilish" is a plain link that discards silently.
Recommendation: Sticky action footer within the shell (`sticky bottom-0`), disable Save until dirty, and prompt on navigation when dirty.

**4.4 — Medium — `admin-product-editor.tsx:509-573`**
Problem: Variant row grid `md:grid-cols-[1fr_140px_140px_auto]` inside a `lg:grid-cols-[1fr_340px]` layout. At 1024px the left column is ≈394px; inner padding leaves ≈338px, but the fixed columns + two buttons need ≈500px → the row overflows its card between 1024 and 1279px (one of the mandated validation widths).
Recommendation: Stack the price/cost fields (`sm:grid-cols-2`) and move the buttons to a second line until `xl`.

**4.5 — Medium — `admin-product-editor.tsx:448-474`, `admin-categories.tsx:355-368`, `admin-homepage.tsx:407-420`**
Problem: Product editor binds two controls (dropzone + text input) to the same `form.image`; the `FormField` label is wired to the text input, not the dropzone. Categories and homepage still use a bare "image path" text field although `ImageDropzone` already accepts `folder="categories" | "homepage"` (`image-dropzone.tsx:393`).
Recommendation: Use `ImageDropzone` in all three, with the raw path exposed as a secondary "Advanced" field.

**4.6 — Medium — `admin-staff.tsx:722-789` (local `Field`, `Check`, `Select`, `Notice`), `admin-catalog.tsx:248-255` (local `Select`), `admin-product-editor.tsx:753-773` (local `CheckBox`)**
Problem: Screens re-implement primitives with different metrics: local `Select` is `px-4 py-3 font-bold` while `admin-ui/Select` is `px-3 py-2 text-sm`; in the products FilterBar a `py-2` `TextInput` sits next to a `py-3` local `Select` (misaligned heights). Staff labels are `font-black`, `FormField` labels are `text-xs font-semibold`.
Recommendation: Delete the local copies; extend `admin-ui/form.tsx` with `Checkbox` and use `Toggle` for boolean flags consistently.

**4.7 — Medium — `admin-staff.tsx:482-519`**
Problem: `Field` wraps its children in a `<label>`, and the "Rollar" field places multiple `<label><input type=checkbox>` inside it → nested labels (invalid HTML); clicking the outer label toggles the first checkbox.
Recommendation: Use `<fieldset><legend>` for the role group.

**4.8 — Medium — `admin-staff.tsx:264-300, 610`**
Problem: The staff editor has no loading state — the empty form renders and can be submitted while data is loading; Save has no `disabled`/busy state (the only feedback is a "Saqlanmoqda..." info notice at the top), so double submit is possible.
Recommendation: Reuse `useApiResource` + `SkeletonRows`, disable Save while saving.

**4.9 — Medium — `admin-staff.tsx:237, 617-690`**
Problem: "Change my own password" is placed at the bottom of the *staff list* page, with placeholder-only inputs (no labels).
Recommendation: Move to a profile/account page (user menu → "Profil"), and give the inputs `FormField` labels.

**4.10 — Medium — `admin-settings.tsx:278-290`**
Problem: Boolean settings (including `customer_delivery_enabled`, described in the file as a kill switch) autosave on a single toggle tap with no confirmation.
Recommendation: For `isPublic` toggles, require confirmation (modal) since the change is live for customers.

**4.11 — Low — `admin-product-editor.tsx:593-619`**
Problem: Modifier attach chips are `text-xs` `py-1.5` (~28px), no search; the list is flat (no groups, min/max, required) — fine for the current data model but will not scale.
Recommendation: `py-2 text-sm`, add a filter input when > 12 modifiers.

**4.12 — Low — `admin-branches.tsx:516-587`**
Problem: The working-hours modal has 7 rows × (2 time inputs + toggle); the modal panel scrolls as a whole (`modal.tsx:108`), so the Save footer scrolls out of view on phones.
Recommendation: Make the modal footer sticky (`sticky bottom-0`) inside the panel.

---

## 5. Buttons (`components/admin-ui/button.tsx`)

**5.1 — High — `button.tsx:27-30`**
Problem: `sm` = `py-1.5 text-xs` (≈28px, 12px text) and `md` = `py-2 text-sm` (≈36px). No size reaches 44px; there is no `lg`. `sm` is the default for every row action and many modal buttons — this is the "tiny buttons" pattern DESIGN_RULES forbids.
Recommendation: `md` → `min-h-10`, add `lg` (`min-h-11`) for primary/touch contexts; keep `sm` for dense desktop rows only and never below 13px text.

**5.2 — Medium — `button.tsx:42-59`; e.g. `admin-product-editor.tsx:746` ("Saqlanmoqda...") vs `admin-categories.tsx:316` ("Saqlanmoqda…")**
Problem: No `loading` prop; every screen hand-writes busy labels (mixed ASCII "..." and "…"), no spinner, no `aria-busy`. Some destructive confirms have no busy state at all (`admin-homepage.tsx:492`, `admin-suppliers.tsx:323`) → double-click sends two `DELETE`s.
Recommendation: Add `isLoading` (spinner + `aria-busy` + disabled) to `Button` and use it everywhere.

**5.3 — Medium — `admin-modifiers.tsx:221-228`**
Problem: "Nofaol qilish" (reversible deactivate) uses `variant="danger"`. DESIGN_RULES: red only for destructive actions / cancelled / serious errors.
Recommendation: `ghost` (or `secondary`) with a confirm; reserve `danger` for archive/delete/cancel.

**5.4 — Medium — `admin-branches.tsx:306-313` vs `admin-categories.tsx:279`, `admin-catalog.tsx:178-185`**
Problem: "Edit" is `secondary` (teal) on branches, `ghost` on products/categories/modifiers; "Standart" variant marker uses `secondary` as a disabled state (`admin-product-editor.tsx:555-562`). Gold `primary` appears on every modal Save, the reports "Ko'rish", and "Parolni yangilash" — often 2–3 gold buttons in one viewport.
Recommendation: Write a usage rule: one `primary` per view (the page's main CTA), `secondary` for modal confirms, `ghost` for navigation/edit.

**5.5 — Low — `button.tsx:61-79`**
Problem: `ButtonLink` drops all other anchor props (no `aria-label`, `target`, `onClick`).
Recommendation: Spread `...props` like `Button`.

**5.6 — Low — `components/admin-ui/modal.tsx:130-137`, `toast.tsx:225-232`**
Problem: Close buttons are a text "✕" glyph at 28px (modal) / unsized (toast); the `close` icon exists in `icon.tsx:302`.
Recommendation: Use `<Icon name="close" />` at ≥36px.

---

## 6. Modals (`components/admin-ui/modal.tsx`)

**6.1 — Medium — `modal.tsx:85-92, 101`**
Problem: Backdrop click closes any modal, including forms with typed data (category, branch, inventory, homepage editors) — no "discard changes?" guard.
Recommendation: Add `dismissOnBackdrop={false}` for form modals, or confirm when the form is dirty.

**6.2 — Medium — Missing confirmations for consequential immediate actions**
- Courier reassignment: `admin-couriers.tsx:305-325` — `<select onChange>` reassigns instantly, no confirm, no undo.
- Product branch availability: `admin-product-editor.tsx:677-694` — same pattern; the card even says it is visible to customers immediately.
- Modifier deactivate: `admin-modifiers.tsx:156-177` — no confirm.
- Staff block: `admin-staff.tsx:538-543` — blocking (kills all sessions) is a checkbox saved with the form, no confirm.
- Password reset: `admin-staff.tsx:377-401, 582-589` — invalidates sessions, no confirm.
- Table status: `app/(shell)/admin/tables/page.tsx` (`setStatus` buttons) — no confirm on OCCUPIED→AVAILABLE.
Recommendation: Use the existing `Modal` confirm pattern (as categories/homepage/suppliers do) for all session-killing or customer-visible actions; for low-risk toggles, an undo toast.

**6.3 — Low — `modal.tsx:36-37`**
Problem: Focus lands on the panel (`tabIndex=-1`) rather than the first field, adding one Tab press on every form modal.
Recommendation: Focus the first focusable element, falling back to the panel.

**6.4 — Low — Inconsistent modal footers: `footer` prop (`admin-categories.tsx:310-319`, `admin-branches.tsx:374-383`, `admin-inventory.tsx:676-688`) vs hand-rolled `<div className="mt-4 flex … justify-end">` inside the body (`admin-modifiers.tsx:328-335`, `admin-inventory.tsx:665-672`, `admin-homepage.tsx:475-482`, `admin-expenses.tsx:420-427`, `admin-suppliers.tsx:306-313`)**
Problem: Half the modals have the sunken bordered footer, half have plain buttons inside the body.
Recommendation: Always use `footer`; forms can submit via `form="id"` as they already do.

---

## 7. Feedback

**7.1 — Medium — `components/admin-ui/toast.tsx:197-206, 213-235`**
Problem: All toasts, including `danger`, auto-dismiss after 5s; there is no pause-on-hover, no action slot (Undo/Retry), and no cap on stacking.
Recommendation: Persist `danger` toasts until dismissed (or ≥10s), pause timer on hover/focus, cap to 3, support an action button.

**7.2 — Medium — `admin-categories.tsx:238-244`, `admin-branches.tsx:273-279`, `admin-modifiers.tsx:166`, `admin-product-editor.tsx:360-366`**
Problem: No optimistic updates; every mutation awaits a full `load()`, which flips `isLoading` and replaces the whole page/table with a skeleton (categories and branches replace the *entire page*) for a single toggle or save.
Recommendation: Keep the previous data visible during refetch (`isRefreshing` vs `isLoading`), or patch local state and reconcile.

**7.3 — Medium — Inconsistent error surfaces**
Load errors replace the page in some screens (`admin-dashboard.tsx:95-97`, `admin-settings.tsx:176-178`) and render above content in others (`admin-orders.tsx:359-361`); mutation errors go to toast in most screens but to a top `ErrorState` in couriers (`admin-couriers.tsx:179-183, 333-335`) and to a top `Notice` in staff (`admin-staff.tsx:435`).
Recommendation: Load error → inline `ErrorState` above content (keep filters usable); mutation error → toast + field error.

**7.4 — Low — `admin-kitchen-monitor.tsx:106-116`**
Problem: 15s polling with no "last updated / refreshing" indicator; the "Kutish" minutes column is computed at render and only refreshes with the poll.
Recommendation: Show "Yangilandi: hh:mm:ss" and a manual refresh button; tick the minutes column every 30s.

---

## 8. Color & Contrast (`app/admin-theme.css`)

Computed ratios (text needs ≥4.5:1, UI/graphics ≥3:1):

| Pair | Ratio | Where used | Verdict |
|---|---|---|---|
| `--color-mz-text-muted #5c7b7e` on white | 4.58 | body muted text | pass (barely) |
| `text-muted` on `surface-sunken #eef4f3` | **4.11** | table `th` (`data-table.tsx:149-159`), `FilterBar`, `CardFooter`, neutral `Badge` (`badge.tsx:193`), inactive `Tabs` (`tabs.tsx:307`), reports `BreakdownRow`/`ChartRow` detail | **fail** |
| `text-muted` on `canvas #f0f5f4` | **4.16** | page description under `h1` (`admin-page-header.tsx:601`), breadcrumbs | **fail** |
| `text-faint #9db0b2` on white | **2.26** | status-history reason (`admin-orders.tsx:835`), `InfoBox` description (`stat-box.tsx:465`), `RowAction` icons (`data-table.tsx:64-65`), placeholders (`form.tsx:333`) | **fail** (text and UI) |
| `accent #23958d` on white | **3.65** | sorted header text (`data-table.tsx:254`), link hover, empty-state icon | fail for text |
| white on `accent` (secondary button) | **3.65** | `button.tsx:21` | **fail** |
| white on `danger-accent #e0524c` (danger hover) | **3.83** | `button.tsx:24` | fail on hover |
| `success #2f7d50` on `success-bg` | **4.49** | success badge | borderline fail |
| gold `#ffd83d` on white | **1.39** | primary button edge, chart bars (`admin-reports.tsx:704`) | fail (UI boundary) |
| input border `#dde7e6` on white | **1.26** | all inputs (`form.tsx:333`) | fail (UI boundary) |
| toggle-off `#b8ccca` on white | **1.68** | `toggle.tsx:456` | fail |
| `shell-fg-muted #a9c6c5` on sidebar `#003e43` | 6.54 | sidebar inactive | pass |
| gold on `#003e43` | 8.55 | sidebar active | pass |
| `primary-fg #07373a` on gold | 9.37 | primary button label | pass |

**8.1 — High — `text-faint` used as content color** (`admin-orders.tsx:835`, `stat-box.tsx:465`, `data-table.tsx:64-65`)
Recommendation: Reserve `text-faint` for decorative separators; use `text-muted` for secondary text and give `RowAction` icons `text-mz-text-muted` at rest.

**8.2 — High — `secondary` button and `sorted` header below 4.5:1**
Recommendation: Secondary bg → `--color-mz-teal-700 #06616a` (white on it ≈ 6.6:1); sorted header text → `--color-mz-info #157069` (5.9:1).

**8.3 — Medium — `text-muted` on sunken surfaces (table headers, badges, tabs, filter bar) at 4.11–4.16**
Recommendation: Darken `--color-mz-text-muted` to ≈`#4f6d70` (≥4.6 on `#eef4f3`) or use `--color-mz-ink-700 #245055` for text on sunken backgrounds.

**8.4 — Medium — Input border 1.26:1 and toggle-off 1.68:1**
Recommendation: `--color-mz-border` for inputs → `#b8ccca` at minimum (still <3:1); WCAG 1.4.11 needs ≈`#8fa6a5` for the control boundary. Alternatively rely on a visible sunken fill.

**8.5 — Medium — Semantic-color rule conflicts with DESIGN_RULES**
- Primary CTA is yellow/gold (`--color-mz-primary #ffd83d`) while DESIGN_RULES reserves orange/yellow for "warning, sparingly" and says green = primary positive actions. The redesign docs acknowledge the teal/gold lock (`docs/admin-redesign/README.md`), so this is a documented decision — but it means warning badges (`#9a5b0c`/`#fdf3e3`) and the CTA share a hue family, and gold is also used as a *data* color in the chart.
- `info` (#157069 teal) and `success` (#2f7d50 green) are adjacent hues; "Tayyorlanmoqda" (info) vs "Yakunlangan" (success) badges are hard to tell apart at 12px.
- Red for non-destructive states: product "Yopiq" (`admin-catalog.tsx:139-141`), branch "Yopiq" (`admin-branches.tsx:322`), OCCUPIED table (`tables/page.tsx` `StatusBadge`).
- Warning tone for non-warnings: "Tavsiya" (`admin-catalog.tsx:143`), SUPER_ADMIN role (`admin-staff.tsx:152`), "Tizim roli" (`admin-roles.tsx:156`), LEGACY visibility, ADJUSTMENT movement.
Recommendation: Publish a tone map (state → tone) in `lib/order-display.ts`-style modules and lint against it; use `neutral` for "unavailable/closed/occupied", `info` for "recommended/system", keep `warning` for pending/attention only.

**8.6 — Medium — Legacy "AdminLTE" cues — `admin-theme.css:156-160, 177-180, 189-204`, `stat-box.tsx:450-456`**
Problem: Hard 2px bevel shadows (`box-shadow: 0 2px 0 #b6951b`) on *every* `.bg-mz-primary` element (including the avatar circle, the sidebar logo square, chart bars, panel-switcher tabs), a 2px gold header underline, a left gold bar on `h1`, and the `InfoBox` 64px solid icon block are literal AdminLTE `small-box`/`info-box`/Bootstrap-3 patterns, contradicting "modern, clean, not legacy".
Recommendation: Remove the global bevel/underline rules; move the `InfoBox` icon into a 36–40px tinted chip like `StatBox`; keep decoration local to components.

**8.7 — Low — `admin-theme.css:152-155`**
Problem: `.mz-admin * { letter-spacing: 0 }` is loaded after Tailwind and neutralises every `tracking-wide/wider/widest` utility used in headers, badges, sidebar labels and `AccessDeniedPanel`. Dead utilities across the codebase.
Recommendation: Delete the rule or scope it to the panel nav only.

**8.8 — Low — `admin-theme.css:156-207`**
Problem: Hard-coded hexes (`#003e43`, `#ffd83d`, `#a78b17`, `#b6951b`, `#004f55`, `#ffffff0d`) in component overrides despite the file's own three-layer rule ("components reference only layer 2/3").
Recommendation: Replace with tokens.

**8.9 — Low — `app/globals.css:315-338`**
Problem: `.report-select` uses Tailwind emerald hexes (`#10b981`, `#d1fae5`), 1rem radius and 700 weight — a foreign visual language next to `TextInput` in the same form (`admin-reports.tsx:301-358`).
Recommendation: Use `admin-ui/Select`.

---

## 9. Orders Management

**9.1 — High — `admin-orders.tsx:364-438`**
Problem: The orders list has no free-text search (order number, phone, customer) and no date range filter; only status/type/payment/branch selects. Finding a specific order means paging through 25 at a time.
Recommendation: Add a search box (order number / phone) and a date range; the online-orders page already has client search — the orders endpoint needs `q`/`from`/`to`.

**9.2 — Medium — `admin-orders.tsx:786-797`**
Problem: Status change shows all six targets as a flat button row regardless of the current state (NEW → SERVED/COMPLETED are offered). Cancel is red and confirmed with a reason ✓, but the reason is optional even for CANCELLED.
Recommendation: Offer only valid transitions (next state prominent, others under "Boshqa"), require a reason for CANCELLED.

**9.3 — Medium — `admin-orders.tsx:891-917`; no refund action anywhere**
Problem: Payments are listed read-only; there is no refund/void flow, and cancelling an order does not address a PAID payment. `REFUNDED` exists in `paymentStatusLabels` but nothing in admin can produce it.
Recommendation: If the backend supports it, add a guarded "Qaytarish" action with confirm + reason; if not, show an explicit note on cancelled-but-paid orders so the operator knows to act in POS.

**9.4 — Medium — `admin-orders.tsx:745-957`**
Problem: No print/receipt action from the order detail (receipts page links *to* the order, not back), and no link to the kitchen ticket. Printing is only "mark as printed" on receipts (`admin-receipts.tsx:398-402`, documented).
Recommendation: Add a "Chek" link/button on order detail to the receipt (and a real print once `PrintJob` exists).

**9.5 — Low — `admin-orders.tsx:237, 571-582`**
Problem: Bulk reason is hard-coded English ("Admin bulk action: CANCELLED from orders list") and is persisted into status history; `statusActor` prefixes "employee:"/"user:"/"system" appear verbatim in the Uzbek UI.
Recommendation: Uzbek copy ("Ommaviy amal: …"), and render actor as name + role badge.

**9.6 — Low — `admin-orders.tsx:266-274, 442-447`**
Problem: Native unstyled checkboxes (16px) for selection in a 44px row.
Recommendation: Styled 20–24px checkbox component with `accent-mz-accent`.

---

## 10. Responsiveness

**10.1 — Medium — `admin-layout.tsx:158`, `admin-theme.css:244-256`**
Problem: Between 768 and 1023px the sidebar is fully off-canvas — tablets (the POS form factor) get no persistent navigation and no mini-rail; every navigation is hamburger → drawer.
Recommendation: Show the 60px mini rail from `md`, full sidebar from `xl`.

**10.2 — Medium — `admin-layout.tsx:158` (`overflow-x-hidden` on the root)**
Problem: Root-level `overflow-x-hidden` masks overflow defects (they clip instead of scroll), so "no clipped cards" violations like 4.4 and 10.3 are hidden rather than prevented.
Recommendation: Keep it as a safety net but add a dev-only overflow detector, and fix the concrete grids.

**10.3 — Medium — `app/(shell)/admin/recipes/page.tsx:93, 111`**
Problem: `lg:grid-cols-[1fr_420px]` leaves ≈314px for the form at 1024px, while the inner row `md:grid-cols-[1fr_120px_140px_auto]` needs ≈366px → overflow at 1024–1279px.
Recommendation: `xl:` for the two-column split; stack the row fields below `xl`.

**10.4 — Medium — `admin-product-editor.tsx:400, 448-474`; `image-dropzone.tsx:468-540`**
Problem: The image dropzone (56px thumb + text + "Fayl tanlash" button in a non-wrapping flex row) is placed in a half-width `md:grid-cols-2` cell; at 768–1023 the cell is ≈330px and the button is pushed against/over the edge.
Recommendation: `flex-wrap` in the dropzone; put the image field full-width.

**10.5 — Low — `admin-navbar.tsx:322-332`**
Problem: Below `sm` the brand word, panel switcher and branch badge are all hidden; the header shows only hamburger + avatar. Acceptable, but the user loses branch context (see 1.6).

**10.6 — Low — `admin-reports.tsx:298`**
Problem: Filter form is `xl:grid-cols-[150px_150px_130px_1fr_150px_auto]`; below 1280px six controls stack vertically in one column (≈300px tall) before any data.
Recommendation: `md:grid-cols-3`, `xl:` as is.

---

## 11. Accessibility

**11.1 — High — Placeholder-only inputs / unlabeled selects**
`admin-staff.tsx:654-676` (own-password panel), `app/(shell)/admin/printers/page.tsx:79-84` ("Branch ID", "Printer name"), `recipes/page.tsx` ("Ingredient ID", "Qty"), `admin-reports.tsx:301-358` (five `<select>` + two date inputs with no label/`aria-label`).
Recommendation: Wrap in `FormField` or add `aria-label`.

**11.2 — Medium — `admin-layout.tsx:119-140, 159-174`**
Problem: Opening the mobile drawer does not move focus into it, does not trap focus, and does not lock body scroll; the sidebar precedes the header in DOM order, so Tab from the hamburger goes into the page, not the drawer.
Recommendation: On open, focus the first nav link; trap Tab within the drawer; `overflow:hidden` on body; return focus to the hamburger on close.

**11.3 — Medium — `components/admin-ui/tabs.tsx:291-320`**
Problem: `role="tablist"/"tab"` without the expected keyboard model: every tab is a Tab stop and there is no Arrow-key navigation / roving `tabindex`, and no `aria-selected` change on keyboard.
Recommendation: Implement roving tabindex + ←/→/Home/End, or drop the `tab` roles and use buttons with `aria-pressed`.

**11.4 — Medium — `admin-sidebar.tsx:89-115`**
Problem: In collapsed mode the link's only content is an icon; the accessible name falls back to `title` (last-resort in the AccName algorithm) and there is no `aria-label`.
Recommendation: Keep the label in the DOM as `sr-only` when collapsed.

**11.5 — Medium — `admin-inventory.tsx:493-503`**
Problem: The disabled "Harakat qo'shish" button explains *why* only via `title` on a disabled element (tooltips do not appear on disabled buttons in most browsers, and never for keyboard/AT). The codebase already has `GuardedButton` for exactly this.
Recommendation: Use `GuardedButton blockedReason=…`.

**11.6 — Low — `admin-product-editor.tsx:766`, `admin-staff.tsx:495, 756`, `admin-modifiers.tsx:312`, `admin-homepage.tsx:465`**
Problem: 16px native checkboxes as touch targets.
Recommendation: 20–24px, or `Toggle`.

**11.7 — Low — `app/(shell)/admin/tables/page.tsx` (`h4` inside cards after `h2`)**
Problem: Heading level skips (h2 → h4).

---

## 12. Consistency

**12.1 — Medium — Duplicated primitives**
- `components/erp/erp-ui.tsx` is no longer imported by any `(shell)` page (only `app/(fullscreen)/pos/*` and `waiter`), yet it re-exports a differently-shaped `EmptyState`/`TextInput`. Dead for admin; delete or move under `pos`.
- Reports re-implements `Metric`, `Panel`, `BreakdownRow`, `DataTable`, `Readiness` (`admin-reports.tsx:619-819`) instead of `StatBox`/`InfoBox`/`Card`/`DataTable`.
- Local `Select`/`Field`/`Check`/`Notice`/`CheckBox` (see 4.6); identical checkbox-label markup copy-pasted in three files (`admin-modifiers.tsx:309-319`, `admin-homepage.tsx:462-472`, `admin-product-editor.tsx:763-772`).
- The branch-list `useEffect` is duplicated in seven screens (`admin-orders.tsx:143-153`, `admin-online-orders.tsx:73-83`, `admin-shifts.tsx:66-76`, `admin-payments.tsx:70-80`, `admin-receipts.tsx:108-118`, `admin-expenses.tsx:83-88`).
Recommendation: A `useBranches()` hook, and migrate reports/staff/catalog to `admin-ui`.

**12.2 — Medium — Typography drift**
KPI values: `StatBox` `text-3xl font-bold`, `InfoBox` `text-xl font-bold`, `CatalogCount` `text-2xl font-bold`, reports `Metric` `text-2xl font-black`. Card titles: `CardHeader` `text-base font-semibold` vs reports `Panel` `text-sm font-black` vs staff aside `text-sm font-black`. `font-black` (900) appears in staff, reports, panel-switcher, navbar; `admin-ui` never goes above 700.
Recommendation: Two KPI sizes (`StatBox` hero, `InfoBox` compact) and cap weight at 700.

**12.3 — Medium — Copy language mix**
- Entire pages in English: `printers/page.tsx` ("Add printer", "Create printer", "Configured printers", "ESC/POS ready", "No printers configured yet.", headers Name/Branch/Type/Status), `recipes/page.tsx` ("Product variant", "Ingredient ID", "Qty", "Add", "Save recipe", "Add ingredients to build this recipe.", "No recipes configured yet.").
- Raw enum values shown to users: `CANONICAL/LEGACY/INTERNAL` badges (`admin-catalog.tsx:136`) and "Canonical/Legacy/Internal" options (`:226-228`); role codes as badges (`admin-staff.tsx:154`); printer types/statuses; payment-method codes in settings chips (`admin-settings.tsx:339`).
- "N/A" in reports (`admin-reports.tsx:592-601, 567`) vs "—" elsewhere; "employee:/user:/system" (9.5).
No Russian strings were found in scope.
Recommendation: Localize the two English pages; add label maps for catalog visibility, roles, printer enums; use "—" consistently.

**12.4 — Medium — Formatting drift**
- Money: shared `formatMoney` (`lib/order-display.ts:100-104`) but private copies in `admin-dashboard.tsx:221-229`, `admin-catalog.tsx:257-259`, `admin-reports.tsx:591-601` (returns "N/A" for null), `admin-report-views.tsx:27-33`.
- Dates: `formatDateTime` (short) in most screens; staff uses `dateStyle: "medium"` (`admin-staff.tsx:71-74`) with "Mavjud emas" for null; expense report uses `toLocaleDateString` (`admin-report-views.tsx:353`); chart labels are raw ISO (`admin-reports.tsx:423`).
Recommendation: One `formatMoney`/`formatDate`/`formatDateTime` in `lib`, delete the copies.

**12.5 — Low — Spacing tokens**
Page containers use `gap-5` (most), `gap-4` (categories, branches), `space-y-4` (settings), `gap-6` (printers, recipes); cards use `p-4` via `CardBody` but `p-5` in staff/reports/tables.
Recommendation: Standardize on `gap-5` / `CardBody`.

**12.6 — Low — `admin-catalog.tsx:65-98` etc.**
Several screens (catalog, categories, modifiers, staff, roles, branches, homepage, suppliers, inventory, kitchen) still use the hand-written load/`try`/`catch` block that `lib/use-api-resource.ts:9-28` was created to replace, so they lack the race guard it provides when filters change quickly.
Recommendation: Migrate to `useApiResource`.

---

## Things done well

1. **Shell architecture** — one persistent layout with skeleton during session restore and access-denied rendered *inside* the shell (`app/(shell)/layout.tsx:56-80`, `access-denied-panel.tsx`), so a forbidden route never strands the user.
2. **`DataTable` mobile transformation** — genuine card view below `md` with primary column, `sr-only` caption, `scope="col"`, `aria-sort`, controlled sorting API and consistent empty/loading states (`data-table.tsx`).
3. **Modal accessibility** — focus trap, Escape, backdrop close, scroll lock, focus restore, bottom-sheet on mobile, `aria-modal`/`labelledby`/`describedby` (`modal.tsx:31-83, 100-112`).
4. **Honest destructive copy** — archive vs delete distinctions with product counts (`admin-categories.tsx:406, 427-433`), "marks printed, does not print" (`admin-receipts.tsx:499-504`), bulk confirm listing affected orders (`admin-orders.tsx:508-554`).
5. **`GuardedButton` + pre-computed block reasons** — RBAC constraints explained before the 403 (`button.tsx:88-109`, `admin-orders.tsx:584-605`, `admin-staff.tsx:407-431`).
6. **Race-safe data hook** — `useApiResource` sequences responses so a slow earlier filter cannot overwrite a newer one (`lib/use-api-resource.ts`).
7. **PII discipline** — phone masking in lists with explicit "Ko'rsatish" reveal, full number only on detail (`lib/order-display.ts:122-134`, `admin-customers.tsx:115-135`).
8. **Token layering, focus ring, reduced motion** — three-layer token file, global `:focus-visible` ring with a shell-specific colour, `prefers-reduced-motion` respected (`admin-theme.css:16-117, 218-226, 279-283`); `Toggle` is a real `role="switch"`; per-field dirty-state saving in Settings (`admin-settings.tsx:274, 384-393`).

---

## Priority summary

| Severity | Count | Top items |
|---|---|---|
| High | 10 | 1.1 IA ordering · 2.1 dashboard content · 3.1 sticky header · 3.2 rogue tables · 4.1 no inline errors · 4.2 duplicate-POST after create · 4.3 no sticky footer / unsaved guard · 5.1 button sizes · 8.1/8.2 contrast failures · 9.1 no order search · 11.1 unlabeled inputs |
| Medium | 34 | confirmations for immediate actions (6.2), optimistic/refetch flash (7.2), colour-semantic conflicts (8.5), legacy bevel styling (8.6), tablet sidebar (10.1), 1024px overflows (4.4, 10.3), duplicated primitives (12.1) |
| Low | 14 | copy/format drift, pagination edge, spacing tokens |

No files were modified.
