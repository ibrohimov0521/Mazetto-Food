# MAZETTO FOOD — Admin Panel Redizayn Rejasi

Tuzilgan sana: 2026-09-06
Asos: `malumot/admin_roles/mazetto_admin_roles_rbac_plan.json` + [`README.md`](./README.md) dagi tadqiqot
Boshlang'ich HEAD: `a72a73d`

---

## Bajarilish holati

| Bosqich | Holat | Izoh |
|---|---|---|
| 1.1 Token qatlami | ✅ | `apps/pos-web/app/admin-theme.css` |
| 1.2 Shell komponentlari | ✅ | `components/admin-shell/` — 4 fayl |
| 1.3 Navigatsiya konfiguratsiyasi | ✅ | `lib/admin-nav.ts` — 7 guruh, 10 element |
| 1.4 UI primitivlari | ✅ | `components/admin-ui/` — 9 fayl |
| 1.5 Kritik tuzatishlar | ✅ | `lib/session.ts` + `lib/api.ts` token yangilash |
| **2-bosqich — qobiq va tokenlar** | ✅ | 17/17 admin route + 2 ta rol landing sahifasi |
| **2-bosqich — struktura** | ✅ | 3 ta katta komponent `admin-ui` ga o'tkazildi |
| **3-bosqich** | ✅ 10/11 | Bloklangan 3 modul 4-bosqichda ochildi |
| **4-bosqich** | 🟡 | Operatsion ro'yxat endpointlari tayyor |

### 4-bosqich — bajarilgan (backend + frontend)

**Backend o'zgarishlari** (schema/migratsiya YO'Q — faqat o'qish endpointlari):

| Endpoint | Permission | Izoh |
|---|---|---|
| `GET /shifts` | `SHIFT_VIEW_BRANCH` 🆕 | Filial smenalari; status/xodim/sana filtri, pagination |
| `GET /receipts` | `RECEIPT_VIEW` | Chek ro'yxati; `content` va ESC/POS **qaytarilmaydi** |
| `GET /payments` | `PAYMENT_VIEW` 🆕 | To'lov tarixi; branch scope buyurtma orqali |

Ikkita yangi permission qo'shildi va rol matritsasiga kiritildi:

| Permission | SUPER_ADMIN | BRANCH_MANAGER | ACCOUNTANT | CASHIER/WAITER/KITCHEN |
|---|---|---|---|---|
| `SHIFT_VIEW_BRANCH` | ✅ (`*`) | ✅ | ❌ | ❌ |
| `PAYMENT_VIEW` | ✅ (`*`) | ✅ | ✅ | ❌ |

`CASHIER` ga ataylab berilmadi — RBAC `operational_contracts.cashier`:
*"Cashier faqat o'z shiftini boshqarishi kerak."*

**Frontend modullari:**

| # | Modul | Route | Izoh |
|---|---|---|---|
| 8 | Smenalar | `/admin/shifts` | Kassa solishtiruvi — `cashDifference` ajratib ko'rsatiladi |
| 9 | Cheklar | `/admin/receipts` | Chop etilgan/etilmagan filtri |
| 10 | To'lovlar | `/admin/payments` | Holat filtri, buyurtmaga havola |

**Yangi validator:** `apps/backend/scripts/validate-operational-listings.ts` —
permission mavjudligi, rol matritsasi (berilishi **va berilmasligi** kerak
bo'lganlar), controller himoyasi, branch scope va pagination chegarasini tekshiradi.

**RBAC JSON spetsifikatsiyasi yangilandi** (`feature_coding_checklist` talabi):
permission katalogi 48 → 50, `current_operational_listing_api` bo'limi qo'shildi,
`module_status` yangilandi, `ACCOUNTANT_SHIFT_VISIBILITY` ochiq qarori qo'shildi.

### 4-bosqichda qolgan

Audit log (`AUDIT_VIEW`) · Rol/permission boshqaruvi (`ROLE_MANAGE`) ·
Moliya (`FINANCE_*`) · Katalog 2-bosqich · Printer/print job · Ombor kengaytmasi ·
To'lov provayderlari

### 3-bosqichda bajarilgan modullar

| # | Modul | Route | Permission | Izoh |
|---|---|---|---|---|
| 1 | Buyurtmalar | `/admin/orders` + `/[id]` | `ORDER_VIEW` | POS+sayt+Telegram bir ro'yxatda, filtr, pagination, detal (tarkib, to'lovlar, holat tarixi) |
| 2 | Online buyurtmalar | `/admin/online-orders` | `ONLINE_ORDER_VIEW` | KPI + qidiruv + filtr |
| 3 | Mijozlar | `/admin/customers` | `CUSTOMER_VIEW` | KPI + qidiruv, telefon PII himoyasi bilan |
| 4 | Bosh sahifa va aksiyalar | `/admin/homepage` | `HOMEPAGE_MANAGE` | To'liq CRUD, tasdiqlash oynasi bilan |
| 5 | Oshxona monitoringi | `/admin/kitchen-monitor` | `KITCHEN_VIEW` | **Faqat o'qish**, mijoz PII ko'rsatilmaydi, 15s polling, kechikish indikatori |
| 6 | Yetkazib beruvchilar | `/admin/suppliers` | `INVENTORY_VIEW` | To'liq CRUD, tasdiqlash oynasi bilan |
| 7 | Rollar va permissionlar | `/admin/roles` | `ROLE_VIEW` | **Faqat o'qish** — rol matritsasi + 48 permission katalogi |

Yangi umumiy fayllar: `lib/order-display.ts` (status/tur/to'lov yorliqlari, rang
semantikasi, pul va sana formatlash, telefon maskalash).

### ✅ 3-bosqichdagi backend bo'shliqlari — 4-bosqichda yopildi

3-bosqichda 3 modul backend endpoint yo'qligi sababli qurilmagan edi.
4-bosqichda uchala endpoint ham qo'shildi (yuqoriga qarang), modullar ochildi.

### Qurilmagan, lekin ataylab

| Modul | Sabab |
|---|---|
| Foydalanuvchilar (`/users`) | `/users` amalda `/staff` bilan bir xil ma'lumot qaytaradi. `/admin/staff` allaqachon shu ma'lumotni **boshqarish imkoni bilan** ko'rsatadi — takroriy ekran chalkashlik keltiradi. |

### Boshqa backend cheklovlari

| Bo'shliq | Ta'sir |
|---|---|
| `/online-orders` pagination'siz | Barcha yozuvlarni qaytaradi; filtr/qidiruv brauzerda bajarilmoqda |
| `/customers` pagination'siz | ⟵ shu muammo |
| `/kitchen/orders` real-time'siz | WebSocket autentifikatsiyasiz global broadcast qilgani uchun (loyiha tahlilidagi ochiq masala) monitoring ekrani 15 soniyalik polling ishlatadi |

### 2-bosqichda bajarilgan

- 13 ta admin route wrapper: `AuthShell` → `AdminLayout` + `AdminPageHeader` (breadcrumb bilan)
- `/accounting` va `/manager/dashboard` ham qobiqqa o'tkazildi — ilgari ular
  ACCOUNTANT va BRANCH_MANAGER uchun **navigatsiyasiz tupik** edi
- `erp-ui.tsx` → `admin-ui` ga delegatsiya qiladi (printers/tables/inventory/recipes darhol tokenlarga o'tdi)
- `ErpPageShell` ning ikkilanuvchi sarlavhasi olib tashlandi
- Nav elementlariga `roles` qo'shildi — menyu route'ning `RoleGuard` i bilan aynan mos
- **Qattiq yozilgan hex: 47 → 0**
- **Eski palitra klasslari (emerald/neutral/slate/...): 296 → 0**

### 2-bosqich strukturasida bajarilgan

- `admin-staff`: ro'yxat → `DataTable` (mobil kartochka bilan), `FilterBar`, `Card`,
  `Skeleton`, retry'li `ErrorState`
- `admin-staff`: **RBAC `staff_security_contract` UI'ga ulandi** — `lib/staff-guards.ts`
  orqali rol/holat/parol amallari sababi bilan bloklanadi, sessiya bekor qilinishi
  haqida ogohlantirish qo'shildi
- `admin-catalog`: mahsulotlar ro'yxati → `DataTable` + `FilterBar` + `Skeleton` + `ErrorState`
- `admin-catalog`: o'lik `AdminDashboard`/`Metric`/`QuickLink` olib tashlandi
  (endi `admin-dashboard.tsx` da)
- `admin-reports`: `Skeleton`, retry'li `ErrorState`, jadvallarga mobil transformatsiya
  (**hisobot mantig'i tegilmadi**)
- Admin fayllaridan `erp-ui` bog'liqligi butunlay olib tashlandi

### Qolgan ish

| Ish | Izoh |
|---|---|
| Responsive QA (768–1920 + 1024×600, 1366×768) | Brauzer avtomatizatsiyasi kerak — bajarilmadi |
| `erp-ui.tsx` ni butunlay o'chirish | Hali `/pos/payment`, `/pos/receipt`, `/waiter` ishlatadi — **reja doirasidan tashqarida** |

**Deploy qilinmagan.** Barcha ish lokal.

Validatsiya (2026-09-06):
`pnpm typecheck` 12/12 · `pnpm lint` 12/12 · `pnpm --filter pos-web build` ✅ ·
`git diff --check` ✅ · dev smoke: 27 route (barcha admin, POS, kassa, oshxona, ofitsiant) — hammasi 200,
dev log'da xato 0.

---

## 0. Tasdiqlangan qarorlar

| # | Qaror | Tanlov |
|---|---|---|
| 1 | **Stack** | AdminLTE 4 — **referens**, kod mavjud Next.js 16 + React 19 + **Tailwind 4** da. Bootstrap o'rnatilmaydi. |
| 2 | **Vizual ohang** | Sidebar va header **to'q teal**, kontent **ivory/oq**, CTA **oltin** |
| 3 | **Navbat** | Dizayn tizimi + shell birinchi → mavjud sahifalar → yangi modullar |
| 4 | `cashier_shift_controls_ux` | 3-bosqichdan **keyinga** suriladi |

### O'zgarmas cheklovlar

- `apps/pos-web` **saqlanadi** — yangi workspace yaratilmaydi
- Mavjud 17 admin route **o'chirilmaydi** — bosqichma-bosqich ko'chiriladi
- **Backend o'zgartirilmaydi** (1–3 bosqichlarda) — migratsiya, seed, schema tegilmaydi
- POS, oshxona, kassa, waiter ekranlari **tegilmaydi**
- `customer-web` **tegilmaydi**
- Production'ga deploy faqat har bosqich to'liq validatsiyadan o'tgach

---

## 1-BOSQICH — Token qatlami + Shell + UI primitivlar

**Maqsad:** Dizayn tizimini yaratish. Hech qanday biznes sahifa o'zgarmaydi.
**Taxminiy hajm:** ~1 hafta

### 1.1 Token qatlami

**Yangi fayl:** `apps/pos-web/app/admin-theme.css`

Uch qatlamli model ([`04-design-system/MAZETTO_ADMIN_TOKENS.md`](./04-design-system/MAZETTO_ADMIN_TOKENS.md) dagi taklif asosida).
Qiymatlar `apps/customer-web/app/globals.css` dagi qulflangan brenddan olinadi:

```
1-QATLAM — PRIMITIV
  --mz-teal-900   #003b40      --mz-gold-600   #f5cf00
  --mz-teal-800   #004f55  ←   --mz-gold-500   #ffd83d  ←  brend
  --mz-teal-700   #06616a      --mz-gold-400   #ffe86b
  --mz-teal-600   #08686a      --mz-gold-100   #fff7e8
  --mz-teal-500   #23958d
  --mz-teal-100   #d8e5df      --mz-ivory      #f5f5ef
  --mz-teal-50    #eef4f3      --mz-white      #ffffff

  --mz-ink-900    #07373a      --mz-success    #3f9f68
  --mz-ink-600    rgba(7,55,58,.72)
  --mz-ink-400    rgba(7,55,58,.58)

2-QATLAM — SEMANTIK
  --mz-shell-bg          teal-800     sidebar + header foni
  --mz-shell-fg          ivory        sidebar matni
  --mz-shell-fg-muted    rgba(...)
  --mz-shell-active-bg   teal-600     faol menyu elementi
  --mz-shell-active-bar  gold-500     faol indikator chizig'i

  --mz-canvas            ivory        sahifa foni
  --mz-surface           white        kartochka foni
  --mz-surface-sunken    teal-50      jadval sarlavhasi, input foni
  --mz-text              ink-900      (kontrast ~12:1)
  --mz-text-muted        ink-600
  --mz-border            rgba(0,79,85,.14)
  --mz-border-strong     rgba(0,79,85,.28)

  --mz-primary           gold-500     asosiy CTA
  --mz-primary-hover     gold-600
  --mz-primary-fg        ink-900      oltin ustidagi matn
  --mz-accent            teal-500     ikkilamchi, tanlangan holat
  --mz-focus             teal-500     fokus halqasi

  --mz-success / --mz-danger / --mz-warning / --mz-info

3-QATLAM — KOMPONENT
  --mz-sidebar-w        264px        AdminLTE 250 va Lezato 328 orasida
  --mz-sidebar-mini-w    72px
  --mz-header-h          60px
  --mz-radius-card       14px
  --mz-radius-control    10px
  --mz-radius-pill      999px
  --mz-shadow-card      0 4px 16px rgba(0,79,85,.08)
  --mz-shadow-overlay   0 12px 32px rgba(0,79,85,.16)
  --mz-z-header         1034         ← AdminLTE'dan
  --mz-z-sidebar        1038         ← AdminLTE'dan
  --mz-z-overlay        1037         ← AdminLTE'dan
  --mz-transition       .3s ease-in-out
```

**Bazaviy font:** 14px (Lezato'dan olingan operatsion zichlik).
**Animatsiya:** `min-width`/`max-width` bo'yicha, `width` emas (AdminLTE naqshi — reflow kamayadi).

### 1.2 Shell komponentlari

**Yangi papka:** `apps/pos-web/components/admin-shell/`

| Fayl | Vazifasi | AdminLTE manbasi |
|---|---|---|
| `admin-layout.tsx` | Grid, sidebar holati, overlay | `layout.ts`, `_app-wrapper.scss` |
| `admin-sidebar.tsx` | To'q teal menyu, collapse, mini rejim | `push-menu.ts`, `_app-sidebar.scss` |
| `admin-sidebar-nav.tsx` | Permission bo'yicha filtrlangan menyu, ichma-ich guruh | `treeview.ts` |
| `admin-navbar.tsx` | Teal header, foydalanuvchi, chiqish, filial belgisi | `_app-header.scss` |
| `admin-breadcrumb.tsx` | Yo'l ko'rsatkichi (mavjud "Orqaga" tugmasi o'rniga) | — |
| `admin-page-header.tsx` | Sahifa sarlavhasi + harakat tugmalari | — |
| `branch-scope-badge.tsx` | Branch-scoped rol uchun **faqat o'qish** filial belgisi | — |

**Kritik qoida (RBAC JSON `developer_rules.frontend`):**
`branch-scope-badge` — branch-scoped rollar (`ADMIN`, `BRANCH_MANAGER`) uchun filialni
**faqat ko'rsatadi**, tanlagich bermaydi. Filial tanlagich **faqat** `SUPER_ADMIN`
va `ACCOUNTANT` (global scope) uchun.

### 1.3 Navigatsiya konfiguratsiyasi

**Yangi fayl:** `apps/pos-web/lib/admin-nav.ts`

[`05-rbac/RBAC_UI_MATRIX.md`](./05-rbac/RBAC_UI_MATRIX.md) §5 dagi 8 guruh / 24 element
deklarativ ro'yxat sifatida. Har bir element `permission` maydoniga ega;
`hasPermission(user, item.permission)` `false` bo'lsa — element **render qilinmaydi**.

Guruhlar: Boshqaruv · Operatsiya · Katalog · Kassa va Moliya · Ombor · Odamlar · Hisobotlar · Sozlamalar

Bo'sh guruh (birorta ham elementga ruxsat yo'q) — butunlay yashiriladi.

### 1.4 UI primitivlari

**Yangi papka:** `apps/pos-web/components/admin-ui/`

| Komponent | Manba |
|---|---|
| `card.tsx` | AdminLTE `_cards.scss` anatomiyasi |
| `stat-box.tsx` | AdminLTE `_small-box.scss` (responsive font: 2.2rem → 1.6rem `lg` da) |
| `info-box.tsx` | AdminLTE `_info-box.scss` (min-height 80px, ikonka 70px) |
| `data-table.tsx` | Saralash, bo'sh holat, `overflow-x` konteyner, mobil kartochka transformatsiyasi |
| `badge.tsx` | Lezato naqshi: kichik font + weight 700 |
| `button.tsx` | Variantlar: primary (oltin), secondary (teal), ghost, danger |
| `modal.tsx` | `--mz-z-overlay` bilan |
| `form-field.tsx` | Label + input + xato matni |
| `select.tsx`, `toggle.tsx`, `date-range.tsx` | Forma elementlari |
| `empty-state.tsx` | `erp-ui.tsx` dagisini almashtiradi |
| `skeleton.tsx` | Yuklanish holati (**hozir yo'q**) |
| `toast.tsx` | Xato/muvaffaqiyat bildirishnomasi (**hozir yo'q**) |
| `pagination.tsx`, `tabs.tsx`, `filter-bar.tsx` | — |

`components/erp/erp-ui.tsx` (64 qator) **1-bosqichda o'chirilmaydi** —
2-bosqichda sahifalar ko'chirilgach olib tashlanadi.

### 1.5 Kritik texnik tuzatishlar

Bular admin panelning ishlashi uchun majburiy ([`03-current-state/CURRENT_ADMIN_INVENTORY.md`](./03-current-state/CURRENT_ADMIN_INVENTORY.md) §6):

| # | Tuzatish | Fayl | Sabab |
|---|---|---|---|
| 1 | **Token yangilash (401 → refresh → qayta yuborish)** | `lib/api.ts` | `refreshToken` saqlanadi lekin ishlatilmaydi → **15 daqiqada login'ga chiqarib yuboradi**. Admin uchun yaroqsiz. Parallel so'rovlar uchun bitta refresh promise'i. |
| 2 | `JSON.parse` try/catch | `lib/api.ts:13`, `components/auth/auth-provider.tsx:41` | Buzilgan localStorage oq ekran beradi |
| 3 | Sessiya bekor qilinganini to'g'ri qayta ishlash | `lib/api.ts` | RBAC: rol/blok/parol o'zgarishi sessiyani bekor qiladi → aniq xabar + login'ga yo'naltirish |

⚠️ **1-tuzatish `cashier_shift_controls_ux` ga ham foyda beradi** — kassirlar ham
o'sha 15 daqiqalik muammodan aziyat chekmoqda.

### 1-bosqich tugallanish mezoni

- [ ] `admin-theme.css` — 3 qatlam to'liq, qattiq yozilgan hex **qolmagan**
- [ ] Shell 8 kenglikda overflow'siz: 768, 1024, 1366, 1440, 1920, 1024×600
- [ ] Sidebar `lg` (1024px) dan pastda overlay rejimiga o'tadi
- [ ] Navigatsiya 4 rol uchun to'g'ri filtrlanadi (SUPER_ADMIN, ADMIN, BRANCH_MANAGER, ACCOUNTANT)
- [ ] Branch-scoped rolga filial **tanlagichi ko'rinmaydi**
- [ ] Token yangilash ishlaydi: 15 daqiqadan keyin sessiya uzilmaydi
- [ ] `pnpm --filter pos-web typecheck` · `lint` · `build` — o'tadi
- [ ] Matn kontrasti WCAG AA (≥4.5:1) — `--mz-text` on `--mz-surface`

---

## 2-BOSQICH — Mavjud 17 sahifani yangi shellga ko'chirish

**Maqsad:** Bir ham funksiyani buzmasdan vizual qatlamni almashtirish.
**Taxminiy hajm:** ~1–2 hafta

### Ko'chirish tartibi (riskdan kelib chiqib)

| Navbat | Sahifa | Qator | Risk | Izoh |
|---|---|---|---|---|
| 1 | `/admin/dashboard` | 18 | Past | Shell'ni sinash uchun eng oson |
| 2 | `/admin/categories` | 18 | Past | Kichik CRUD |
| 3 | `/admin/branches` | 18 | Past | |
| 4 | `/admin/printers` | 124 | O'rta | O'z mantig'i bor |
| 5 | `/admin/tables` | 174 | O'rta | O'z mantig'i bor |
| 6 | `/admin/inventory` | 142 | O'rta | O'z mantig'i bor |
| 7 | `/admin/recipes` | 167 | O'rta | O'z mantig'i bor |
| 8 | `/admin/products` (+`new`, `[id]`) | 579 | **Yuqori** | `admin-catalog.tsx` |
| 9 | `/admin/staff` (+`new`, `[id]`) | 492 | **Yuqori** | `admin-staff.tsx` + SUPER_ADMIN himoyasi |
| 10 | `/admin/reports` | 563 | **Yuqori** | Yaqinda hardened — ehtiyot bo'ling |

**Sabab:** oson sahifalar shell'dagi kamchiliklarni ochadi; katta komponentlar
shell barqarorlashgandan keyin ko'chiriladi. `/admin/reports` oxirida —
u eng yaqinda production'ga chiqqan va eng ko'p mantiqqa ega.

### Har bir sahifa uchun ish

1. `AuthShell` → `AdminLayout` + `AdminPageHeader` ga almashtirish
2. Qo'lda yozilgan jadval/kartochka/tugmalarni `admin-ui` primitivlariga almashtirish
3. Qattiq yozilgan hex → semantik token
4. Yuklanish holatiga `Skeleton`, xatolarga `Toast` qo'shish
5. 8 kenglikda overflow tekshiruvi
6. **Funksional regressiya:** har bir CRUD amali oldingidek ishlashi

### Maxsus talablar

**`/admin/staff`** — RBAC `staff_security_contract` ni UI darajasida ifodalash:

```
Oxirgi aktiv SUPER_ADMIN        → deactivate/demote tugmalari disabled + sabab
SUPER_ADMIN ni SUPER_ADMIN emas → boshqarish tugmalari disabled + sabab
Rol o'zgartirish                → "sessiyalar bekor qilinadi" ogohlantirishi
Parol reset                     → "sessiyalar bekor qilinadi" ogohlantirishi
```

Hozir bu holatlar server xatosi orqali bilinadi — UI oldindan ko'rsatishi kerak.

**`/admin/reports`** — mavjud preset/filtr/Asia/Tashkent mantig'i **o'zgarmaydi**,
faqat vizual qatlam almashtiriladi. `validate-admin-sales-reports.ts` o'tishi shart.

### 2-bosqich tugallanish mezoni

- [ ] 17 route'ning hammasi yangi shellda
- [ ] `components/erp/erp-ui.tsx` **o'chirilgan**
- [ ] `components/auth/auth-shell.tsx` admin uchun ishlatilmaydi (POS/oshxona uchun qoladi)
- [ ] Qattiq yozilgan hex qiymatlar **0 ta** (`grep -E "#[0-9a-fA-F]{6}"` toza)
- [ ] Barcha mavjud validator skriptlari o'tadi
- [ ] 8 kenglikda gorizontal overflow **yo'q**
- [ ] RBAC vizual tekshiruvi: CASHIER/KITCHEN → `/access-denied`

---

## 3-BOSQICH — Backend tayyor, ekrani yo'q 11 modul

**Maqsad:** Backend qamrovini 12% dan ~70% ga ko'tarish.
**Taxminiy hajm:** ~2–3 hafta
**Backend o'zgarishi:** yo'q — barcha endpointlar tayyor

### Navbat (biznes qiymati bo'yicha)

| Navbat | Modul | Endpoint | Permission | Nega shu navbatda |
|---|---|---|---|---|
| 1 | **Buyurtmalar** | `/orders`, `/orders/:id` | `ORDER_VIEW/UPDATE` | POS+WEB+TELEGRAM birlashgan ko'rinish — hozir umuman yo'q |
| 2 | **Online buyurtmalar** | `/online-orders` | `ONLINE_ORDER_VIEW` | Web/Telegram buyurtmalari ko'rinmayapti |
| 3 | **Smenalar / Kassa** | `/cash-register/shift/*`, `/shifts/*` | `SHIFT_*` | Admin kassir smenalarini nazorat qila olmaydi |
| 4 | **Mijozlar** | `/customers`, `/customers/statistics` | `CUSTOMER_VIEW` | Baza bor, ko'rish imkoni yo'q |
| 5 | **Bosh sahifa / Aksiyalar** | `/homepage/hero-slides`, `/homepage/promotions` | `HOMEPAGE_MANAGE` | Hozir faqat DB orqali boshqariladi |
| 6 | **Cheklar** | `/receipts/*` | `RECEIPT_VIEW` | |
| 7 | **Oshxona monitoringi** | `/kitchen/orders` | `KITCHEN_VIEW` | Admin uchun **read-only** board |
| 8 | **To'lovlar** | `/payments/*` | `PAYMENT_CREATE` | |
| 9 | **Yetkazib beruvchilar** | `/suppliers/*` | `INVENTORY_*` | |
| 10 | **Rollar / Permissionlar** | `/roles`, `/permissions` | `ROLE_VIEW`, `PERMISSION_VIEW` | **Faqat ko'rish** — boshqaruv 4-bosqichda |
| 11 | **Foydalanuvchilar** | `/users` | `USER_VIEW` | |

### Har bir modul uchun standart shakl

RBAC JSON `feature_coding_checklist` ga muvofiq:

```
1. Route yaratish            app/admin/<modul>/page.tsx
2. RoleGuard + PermissionGuard qo'shish
3. Sidebar elementini admin-nav.ts ga qo'shish (permission bilan)
4. Ro'yxat ekrani            FilterBar + DataTable + Pagination + EmptyState
5. Detal ekrani              (kerak bo'lsa) Card + StatBox
6. Branch scope              branch-scoped rolga filial tanlagichi YO'Q
7. 401/403 holatlari         aniq xabar
8. 8 kenglikda QA
```

### Maxsus eslatmalar

**Buyurtmalar (1-modul)** — `/orders` `query.limit` ni qo'llab-quvvatlaydi.
Pagination majburiy, cheksiz ro'yxat yuklamang.

**Oshxona monitoringi (7-modul)** — admin uchun **faqat o'qish**.
Status o'zgartirish tugmalari **yo'q** — u KITCHEN rolining ishi.
RBAC JSON: *"Customer PII minimal ko'rsatiladi"* — mijoz telefoni/manzili
oshxona ko'rinishida ko'rsatilmasin.

**Mijozlar (4-modul)** — PII ekrani. Telefon raqamlarini ro'yxatda
qisman maskalash (`+998 90 *** ** 45`), to'liq ko'rinish faqat detal sahifasida.

### 3-bosqich tugallanish mezoni

- [ ] 11 modulning hammasi ishlaydi va sidebar'da ko'rinadi
- [ ] Backend qamrovi: 14 → ~80 endpoint
- [ ] Har bir modul 4 rol uchun to'g'ri filtrlangan
- [ ] Cross-branch tekshiruvi: branch-scoped rol boshqa filialni ko'ra olmaydi
- [ ] Barcha validator skriptlari o'tadi

---

## 4-BOSQICH — Yangi backend talab qiladigan modullar

**Taxminiy hajm:** alohida rejalashtiriladi
**Backend o'zgarishi:** ✅ ha — shuning uchun alohida bosqich

| Modul | Kerakli permission | Backend holati |
|---|---|---|
| Audit log | `AUDIT_VIEW` 🆕 | `AuditLog` modeli bor, endpoint yo'q |
| Rol/permission boshqaruvi | `ROLE_MANAGE`, `PERMISSION_MANAGE` 🆕 | Yo'q |
| Moliya (P&L, xarajat tasdiqlash) | `FINANCE_*` 🆕 (7 ta) | Yo'q |
| Katalog 2-bosqich (variant, modifier, bundle) | `VARIANT_MANAGE` va h.k. 🆕 (5 ta) | Qisman |
| Printer / print job | `PRINTER_*`, `PRINT_JOB_*` 🆕 (4 ta) | Qisman |
| Ombor kengaytmasi | `WAREHOUSE_*`, `STOCK_*` 🆕 (7 ta) | Qisman |
| To'lov provayderlari | `PAYMENT_PROVIDER_MANAGE` 🆕 | Yo'q |

**Jami 30 ta yangi permission.** Har biri qo'shilganda RBAC JSON, seed va validator
ham yangilanishi shart (`feature_coding_checklist`).

---

## Validatsiya strategiyasi

### Har bir bosqichda

```
pnpm --filter pos-web typecheck
pnpm --filter pos-web lint
pnpm --filter pos-web build
git diff --check
```

### Mavjud validator skriptlari (regressiya uchun)

```
validate-staff-rbac.ts              validate-admin-catalog-core.ts
validate-admin-sales-reports.ts     validate-canonical-catalog.ts
validate-pos-kassa.ts               validate-shift-kassa.ts
validate-kitchen-order-board.ts     validate-customer-order-history.ts
```

### Yangi validator (3-bosqichda qo'shiladi)

`apps/backend/scripts/validate-admin-nav-rbac.ts` — har bir sidebar elementi
uchun `permission` mavjudligini va rol matritsasiga mosligini tekshiradi.

### Responsive QA (majburiy)

```
768   1024   1366   1440   1920   1024×600
```

`DESIGN_RULES.md` majburiy sifat qoidalari: gorizontal overflow yo'q,
kesilgan kartochka yo'q, yetib bo'lmaydigan tugma yo'q, faqat-desktop kritik funksiya yo'q.

### RBAC vizual tekshiruvi (har bosqichda)

```
Unauthenticated          → 401 / login
CASHIER, KITCHEN         → /access-denied
ADMIN                    → filial tanlagichi YO'Q
BRANCH_MANAGER           → filial tanlagichi YO'Q, o'z filiali
ACCOUNTANT               → global scope, read-only menyu
SUPER_ADMIN              → hamma narsa + filial tanlagichi
```

---

## Risklar va yumshatish

| Risk | Ehtimol | Yumshatish |
|---|---|---|
| `/admin/reports` regressiyasi (yaqinda hardened) | O'rta | Oxirgi ko'chiriladi; `validate-admin-sales-reports.ts` har commitda |
| `admin-catalog.tsx` (579 q.) ko'chirishda funksiya yo'qolishi | O'rta | Avval komponentga bo'lish, keyin stil almashtirish — ikki alohida commit |
| Token yangilash sessiya xatolarini keltirib chiqarishi | Past | Parallel so'rovlar uchun bitta refresh promise; qo'lda sinov |
| Tailwind 4 token qatlami mavjud POS stillari bilan urishishi | Past | `admin-theme.css` faqat `/admin/*` ostida qo'llaniladi |
| Bosqich cho'zilib ketishi | O'rta | Har bosqich mustaqil deploy qilinadi; yarim tugagan holat production'ga chiqmaydi |

---

## Tegilmaydigan narsalar

Bu reja doirasida **o'zgartirilmaydi**:

```
❌ Backend schema, migratsiya, seed          (1–3 bosqichlarda)
❌ apps/customer-web
❌ POS ekranlari  (/pos, /shift, /waiter, /kitchen)
❌ Telegram integratsiyasi
❌ Media servisi va volume
❌ Cloudflare marshrutlari
❌ Production DB (fake order/shift yaratilmaydi)
```

---

## Keyingi qadam

**1-bosqich, 1.1 punkt:** `apps/pos-web/app/admin-theme.css` token qatlamini yozish.

Tasdiqlaganingizdan keyin boshlayman.

---

## Reja tashqarisidagi ochiq masalalar

Bular rejaga kirmadi, lekin hal qilinishi kerak:

| # | Masala | Manba |
|---|---|---|
| 1 | `ADMIN` vs `BRANCH_MANAGER` ierarxiyasi (ikkalasida `STAFF_ROLE_ASSIGN`) | RBAC JSON `policy_decisions_to_finalize` |
| 2 | Filial buxgalteri kerakmi (`BRANCH_ACCOUNTANT`)? | ⟵ |
| 3 | `BRANCH_MANAGER` real ishda POS/oshxona operatorimi? | ⟵ |
| 4 | `MENU_DELETE` — hard delete yoki arxivlash? | ⟵ (arxivlash tavsiya qilingan) |
| 5 | WebSocket autentifikatsiyasi (mijoz PII global tarqatilmoqda) | Loyiha tahlili, 2026-09-06 |
| 6 | Login'da brute-force himoyasi yo'q | ⟵ |

5 va 6 — **admin panelga tegishli emas, lekin xavfsizlik masalalari**.
Alohida rejalashtirilishi kerak.
