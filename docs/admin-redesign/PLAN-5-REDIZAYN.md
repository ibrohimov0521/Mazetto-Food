# 5-BOSQICH — Vizual redizayn + funksional bo'shliqlar

Tuzilgan sana: 2026-09-06
Boshlang'ich HEAD: `97d5ed4`
Asos: UX/UI tahlili + tasdiqlangan maket
Oldingi bosqichlar: [`PLAN.md`](./PLAN.md)

---

## Nima uchun bu bosqich

4-bosqich oxirida admin panel **funksional jihatdan keng** (23 route, backend
qamrovi ~70%) lekin **vizual jihatdan tugallanmagan**. Ikkita mustaqil ish
birlashtiriladi:

| Yo'nalish | Manba |
|---|---|
| **Vizual** — ikonka tizimi, shell, primitivlar | Maket va UX tahlili |
| **Funksional** — backend tayyor, UI'da bo'shliq | B bloki (B1–B7) |

Tartib **vizualdan boshlanadi**, chunki B bloki yangi primitivlarga (Tabs,
Pagination, Toggle) tayanadi — teskari tartibda ular ikki marta yozilardi.

---

## O'zgarmas cheklovlar

- **Token qatlami buzilmaydi.** `app/admin-theme.css` ga faqat bitta semantik
  nom qo'shiladi (`--color-mz-shell-deep`, qiymati allaqachon `#003b40` sifatida
  1-qatlamda bor). Boshqa hech qanday rang o'zgarmaydi.
- **Backend faqat 5.6 da o'zgaradi** (B7 — pagination parametrlari). 5.1–5.5
  butunlay frontend.
- **Yangi permission qo'shilmaydi.** B1–B6 uchun kerakli permissionlarning
  hammasi katalogda mavjud: `BRANCH_CREATE`, `BRANCH_EDIT`, `MENU_EDIT`,
  `MENU_DELETE`, `ORDER_UPDATE`, `RECEIPT_PRINT`, `REPORT_PRODUCTS_VIEW`,
  `REPORT_EMPLOYEES_VIEW`, `REPORT_EXPENSES_VIEW`, `INVENTORY_CREATE`.
  Seed va rol matritsasi tegilmaydi.
- **Shrift o'zgarmaydi.** Maketda IBM Plex ishlatilgan — bu faqat maket uchun.
  Kod hozirgi system font stack'ida qoladi.
- POS, oshxona, kassa, waiter ekranlari va `customer-web` **tegilmaydi**.
- `components/erp/erp-ui.tsx` **o'chirilmaydi** — hali `/pos/*` va `/waiter`
  ishlatadi, bu reja doirasidan tashqarida.

---

## Bloklovchi: lokal ma'lumotlar bazasi

`mazetto` roli lokal PostgreSQL 18 da hali yo'q. Bu **5.1–5.4 ni bloklamaydi**
(typecheck / lint / build DB'siz o'tadi), lekin quyidagilarni bloklaydi:

- brauzerda vizual tekshiruv
- `/admin/shifts`, `/admin/payments`, `/admin/audit` (403 qaytaradi)
- 5.5 dagi CRUD ekranlarini haqiqiy ma'lumotda sinash

Qadamlar: [`docs/LOCAL_DATABASE_SETUP.md`](../LOCAL_DATABASE_SETUP.md).
Birinchi qadam interaktiv parol so'raydi va **egasi tomonidan** bajarilishi kerak.

---

## 5.1 — Ikonka tizimi

**Ta'sir: juda yuqori.** Bitta o'zgarish panelning umumiy ko'rinishini eng ko'p
o'zgartiradi va bir vaqtda **funksional nuqsonni** ham yopadi: yig'ilgan
sidebar hozir ishlamaydi, chunki 23 menyu elementidan 13 tasi boshqa element
bilan bir xil harfga tushadi (`B`×2, `O`×2, `S`×3, `M`×2, `R`×2, `X`×2).

### Yangi fayl: `components/admin-ui/icon.tsx`

```
export type IconName = "gauge" | "receipt" | "globe" | ... ;   // 39 ta
export function IconSprite(): ReactElement    // <symbol> to'plami, bir marta mount
export function Icon({ name, className }): ReactElement
```

Tashqi kutubxona **o'rnatilmaydi**. 39 ta inline `<symbol>` ≈ 5 KB;
`lucide-react` paketi ~1.2 MB va tree-shaking Next.js `"use client"`
chegarasida ishonchsiz. Ikonkalar 24×24, `stroke-width` 1.75, yumaloq uch.

### O'zgaradi

| Fayl | O'zgarish |
|---|---|
| `lib/admin-nav.ts` | Har `AdminNavItem` ga `icon: IconName`. RBAC filtri, `roles`, `permission` mantig'i **tegilmaydi** |
| `components/admin-shell/admin-layout.tsx` | `<IconSprite />` ni bir marta mount qilish |
| `components/admin-shell/admin-sidebar.tsx` | `item.label.slice(0, 1)` → `<Icon name={item.icon} />`; faol holat foni `bg-mz-shell-active` → `bg-mz-shell-deep`; oltin indikator `w-1` → `w-[3px]`, matn oq |
| `app/admin-theme.css` | `--color-mz-shell-deep: #003b40` semantik nomi |

### Yangi validator: `apps/backend/scripts/validate-admin-nav-rbac.ts`

3-bosqich rejasida va'da qilingan, hech qachon yozilmagan. Tekshiradi:

1. Har nav elementining `permission` i backend permission katalogida mavjud
2. Har nav elementida `icon` bor va u sprite'da aniqlangan
3. Har `href` uchun `app/` da haqiqiy route fayli bor
4. Nav elementining `roles` i route'ning `RoleGuard` ro'yxati bilan **aynan** mos
5. Ikkita nav element bir xil `href` ga ishora qilmaydi

**Commit:** `Add an icon system and fix the collapsed sidebar`

---

## 5.2 — Shell qatlami

| Fayl | O'zgarish |
|---|---|
| `admin-navbar.tsx` | `☰ ✕ » «` matn gliflari → SVG. Qidiruv maydoni (vizual, `Ctrl K`). Bildirishnoma tugmasi. Avatar + ism + rol. **"Chiqish" dropdown ichiga ko'chadi** — eng xavfli amal eng ko'zga tashlanadigan joyda turmasin |
| `admin-layout.tsx` | `<main>` ga `mx-auto w-full max-w-[1600px]`. 1920px monitorda satr uzunligi tiklanadi |
| `admin-page-header.tsx` | Breadcrumb ajratgichi SVG chevron; sarlavha o'lchami saqlanadi |

**Eslatma:** qidiruv maydoni bu bosqichda **vizual** — global qidiruv backend
endpoint'i yo'q. Uni ishlaydigan qilish alohida ish, rejaga kiritilmagan.
Ishlamaydigan input ko'rsatmaslik uchun u tugma sifatida render qilinadi va
bosilganda hech narsa qilmaydi emas, balki **umuman qo'shilmaydi** — agar
`SEARCH` endpoint'i qo'shilmasa. Qaror: qidiruvni 5.2 dan chiqarib tashlash.

**Commit:** `Complete the admin header and constrain content width`

---

## 5.3 — UI primitivlari

### 5.3a — Mavjudlarini yangilash

| Fayl | O'zgarish |
|---|---|
| `stat-box.tsx` | `InfoBox` dagi `label.slice(0, 1)` olib tashlanadi. `StatBox` ga `icon`, `unit`, `trend` (`{ direction, value, hint }`) maydonlari |
| `feedback.tsx` | `EmptyState` ga ikonka va harakat; `ErrorState` ixchamlashadi (butun blok qizil fon bo'lmaydi) |
| `data-table.tsx` | Saralash (`sortable`, `sortKey`, `onSort`), qator amallari ustuni, katak balandligi 44px |

### 5.3b — Yangilari

| Fayl | Nima uchun |
|---|---|
| `pagination.tsx` | Hozir **olti faylda** qo'lda takrorlangan: audit, expenses, orders, payments, receipts, shifts |
| `tabs.tsx` | B5 uchun majburiy — to'rt hisobot bir sahifada |
| `toggle.tsx` | B1 (filial faolligi), B2 (kategoriya faolligi) uchun |
| `date-range.tsx` | Preset tugmalari; **Asia/Tashkent mantig'i tegilmaydi** |

`components/admin-ui/index.ts` yangilanadi.

**Commit 1:** `Add icons and trends to stat boxes and empty states`
**Commit 2:** `Add sorting and row actions to the data table`
**Commit 3:** `Extract pagination, tabs, toggle and date range primitives`

---

## 5.4 — Mavjud ekranlarni yangi primitivlarga ko'chirish

Funksiya o'zgarmaydi — faqat takror olib tashlanadi va ko'rinish yangilanadi.

| Ish | Fayllar |
|---|---|
| Qo'lda yozilgan pagination → `<Pagination />` | `admin-audit`, `admin-expenses`, `admin-orders`, `admin-payments`, `admin-receipts`, `admin-shifts` |
| KPI bloklariga ikonka va trend | `admin-dashboard`, `admin-customers`, `admin-online-orders`, `admin-shifts` |
| Bo'sh holatlarga ikonka | `DataTable` ishlatuvchi barcha ekranlar (avtomatik) |

**Commit:** `Move admin screens onto the shared pagination and stat components`

---

## 5.5 — B bloki: backend tayyor, UI'da bo'shliq

Har biri **alohida commit**. Yangi permission yo'q, backend o'zgarmaydi.

### B1 — Filiallar CRUD
`components/admin/admin-catalog.tsx` → `AdminBranchesPage`

Hozir faqat o'qish. Ishlatilmayotgan endpointlar:

| Endpoint | Permission |
|---|---|
| `POST /branches` | `BRANCH_CREATE` |
| `PATCH /branches/:id` | `BRANCH_EDIT` |
| `PATCH /branches/:id/working-hours` | `BRANCH_EDIT` |

Ish vaqti tahriri — haftaning 7 kuni uchun ochilish/yopilish. `PATCH
/branches/:id/product-availability` **allaqachon** mahsulot tahrirlagichida
ishlatiladi, takrorlanmaydi.

### B2 — Kategoriya tahrirlash va o'chirish
Hozir faqat `POST`. Qo'shiladi: `PATCH /menu/categories/:id` (`MENU_EDIT`),
`DELETE /menu/categories/:id` (`MENU_DELETE`) — **tasdiqlash oynasi bilan**.

⚠️ `MENU_DELETE` uchun hard delete va arxivlash o'rtasidagi qaror
`policy_decisions_to_finalize` da **ochiq**. Backend hozir nima qilsa, UI ham
shuni qiladi; UI qarorni oldindan qabul qilmaydi. Tasdiqlash matni backend
xatti-harakatiga qarab yoziladi.

### B3 — Buyurtma holatini o'zgartirish
`PATCH /orders/:id/status` (`ORDER_UPDATE`) — `admin-orders.tsx` detal
panelida. Faqat ruxsat etilgan o'tishlar ko'rsatiladi (backend nima qabul
qilsa). `ORDER_UPDATE` yo'q foydalanuvchida tugmalar **render qilinmaydi**.

### B4 — Chek detali va qayta chop etish
`GET /receipts/:id` (`RECEIPT_VIEW`), `PATCH /receipts/:id/print`
(`RECEIPT_PRINT`). Ro'yxat endpoint'i `content` va ESC/POS qaytarmaydi —
detal ekrani qaytaradi.

### B5 — Hisobotlar: to'rt yangi tab
Hozir faqat `/reports/sales`. `Tabs` bilan bir sahifada:

| Tab | Endpoint | Permission |
|---|---|---|
| Savdo | `/reports/sales` | `REPORT_SALES_VIEW` |
| Mahsulotlar | `/reports/products` | `REPORT_PRODUCTS_VIEW` |
| Xodimlar | `/reports/employees` | `REPORT_EMPLOYEES_VIEW` |
| Xarajatlar | `/reports/expenses` | `REPORT_EXPENSES_VIEW` |
| Z-hisobot | `/reports/z` | `REPORT_SALES_VIEW` |

**Har tab o'z permission'i bilan alohida yashiriladi** — permission yo'q bo'lsa
tab umuman ko'rinmaydi. Mavjud savdo hisoboti mantig'i va Asia/Tashkent
sanalari **tegilmaydi**; `validate-admin-sales-reports.ts` o'tishi shart.

### B6 — Ombor: ingredient va ombor yaratish
`POST /inventory/ingredients`, `POST /inventory/warehouses`
(`INVENTORY_CREATE`). Hozir ikkalasi ham faqat seed orqali qo'shiladi.
`GET /inventory/cost` ishlatilmayapti — zaxira qiymati KPI'siga ulanadi.

### B7 — Pagination (⚠️ backend o'zgarishi kerak)
`GET /customers` va `GET /online-orders` **hech qanday parametr qabul
qilmaydi** — barcha yozuvni qaytaradi, filtr brauzerda bajariladi.

Backend: ikkala endpointga `limit`/`offset` DTO qo'shish (mavjud
`ReportQueryDto` naqshi bo'yicha), scope mantig'i **o'zgarmaydi**.
Frontend: `<Pagination />` ga o'tish.

Bu yagona backend o'zgarishi — shuning uchun **oxirgi** va alohida commit.

---

## 5.6 — QA

| Ish | Izoh |
|---|---|
| Responsive QA | 768 / 1024 / 1366 / 1440 / 1920 / 1024×600 — hech qachon bajarilmagan |
| RBAC vizual tekshiruv | 6 rol: SUPER_ADMIN, ADMIN, BRANCH_MANAGER, ACCOUNTANT, CASHIER, KITCHEN |
| Validator to'plami | Barcha mavjud skriptlar + yangi `validate-admin-nav-rbac.ts` |
| `pnpm typecheck` · `lint` · `build` | Har commitda |

---

## Commit ketma-ketligi

```
 1  Add an icon system and fix the collapsed sidebar          5.1
 2  Complete the admin header and constrain content width     5.2
 3  Add icons and trends to stat boxes and empty states       5.3a
 4  Add sorting and row actions to the data table             5.3a
 5  Extract pagination, tabs, toggle and date range           5.3b
 6  Move admin screens onto the shared components             5.4
 7  Add branch creation and working-hours editing             B1
 8  Add category editing and deletion                         B2
 9  Add order status transitions to the admin order view      B3
10  Add receipt detail and reprint                            B4
11  Add product, employee, expense and Z report tabs          B5
12  Add ingredient and warehouse creation                     B6
13  Paginate the customer and online-order listings           B7
```

**Deploy qilinmaydi.** Barcha ish lokal, har commit mustaqil tekshiriladi.

---

## Bajarilish holati (2026-09-06)

Shoxobcha: `admin-redesign-phase-5` · 12 commit · **deploy qilinmagan**

| Bosqich | Holat | Izoh |
|---|---|---|
| 5.1 Ikonka tizimi | ✅ | 45 ikonka, `validate-admin-nav-rbac.ts` |
| 5.2 Shell | ✅ | Header, `max-w-[1600px]` |
| 5.3a Primitivlarni yangilash | ✅ | stat-box, feedback, data-table |
| 5.3b Yangi primitivlar | ✅ | pagination, tabs, chip-group, toggle |
| 5.4 Ekranlarni ko'chirish | ✅ | 6 fayldagi pagination takrori yechildi |
| B1 Filiallar | ✅ | CRUD + ish vaqti |
| B2 Kategoriyalar | ✅ | Tahrirlash + arxivlash |
| B3 Buyurtma holati | ✅ | Filial cheklovi bilan |
| B4 Cheklar | ✅ | Detal + chop etilgan deb belgilash |
| B5 Hisobotlar | ✅ | 5 tab, har biri o'z permission'i ostida |
| B6 Ombor | ✅ | Ingredient va ombor yaratish |
| B7 Sahifalash | ✅ | Yagona backend o'zgarishi |
| 5.6 QA | ⛔ | **Bajarilmadi** — lokal DB yo'q |

### Rejadan chetlashishlar va sabablari

| Reja | Amalda | Sabab |
|---|---|---|
| `date-range.tsx` yozish | Yozilmadi | Hisobot ekranida preset chiplari va sana inputlari allaqachon ishlaydi; hech kim so'ramagan kalendar komponenti taxminiy ish bo'lardi. Lokal `QuickRange` o'rniga umumiy `ChipGroup` qo'shildi |
| KPI trend ko'rsatkichi | Qo'shilmadi | `GET /dashboard/summary` faqat bugungi raqamni beradi, solishtirish manbai yo'q. Foizni o'ylab topish mumkin emas |
| B3 `ORDER_UPDATE` bilan | `ORDER_SEND_KITCHEN` + filial sharti | Endpoint boshqa permission ostida; `orders.service.ts` chaqiruvchidan buyurtma filialining faol xodimi bo'lishni talab qiladi, super-admin uchun ham istisno yo'q |
| B2 "o'chirish" | "arxivlash" | `menu.service.ts:deleteCategory` `isActive: false` qo'yadi — bu `MENU_DELETE` bo'yicha ochiq qarorni amalda hal qilgan |
| 5.3b va 5.4 alohida commit | Bitta commit | Primitivni ishlatuvchisiz qo'shish bir commit davomida o'lik kod qoldirardi |

### Yo'l-yo'lakay topilgan va tuzatilgan

- `/admin/dashboard` route `ADMIN_ACCESS` talab qilardi, menyu va backend esa
  `DASHBOARD_VIEW`. Route to'g'rilandi; seed'da `ADMIN_ACCESS` bor-u
  `DASHBOARD_VIEW` yo'q rol bo'lmagani uchun kirish huquqi o'zgarmadi.
- `admin-catalog.tsx` dagi lokal `Badge` "green" va "teal" ni bir xil rangga
  solardi — olib tashlandi.
- `admin-catalog.tsx` uch ekranni (mahsulot, kategoriya, filial) saqlardi;
  endi faqat mahsulot.

### QA — statik qismi bajarildi

DB'siz bajarish mumkin bo'lgani qilindi (2026-09-07):

**1. Tur auditi.** Yangi ekranlarning TypeScript turlari backend javobiga
solishtirildi. Typecheck buni ushlay olmaydi: turlar qo'lda yozilgani uchun
ular o'zi bilan o'zi mos keladi, javob bilan emas.

Topilgani — **crash**: `ZReportView` `paymentBreakdown[].paymentMethod` ni satr
deb e'lon qilgan va to'g'ridan-to'g'ri render qilgan edi. `reports.service.ts`
u yerda butun `PaymentMethod` yozuvini saqlaydi, ya'ni to'lovi bor har qanday
davrda React obyektni render qilishga urinib xato tashlardi.

Shu usulda tekshirilgan va to'g'ri chiqqani: filial maydonlari va `String`
ish vaqti, kategoriyada o'qishda `imageUrl` / yozishda `image`, chek tarkibi
va to'lov usullari, ombor va buyurtma holati so'rov tanasi.

**2. Statik responsive ko'rik.** Ish vaqti oynasidagi qator
`grid-cols-[1fr_auto]` edi: ikkita `type="time"` input (Chrome'da ~120px)
kun nomi bilan yonma-yon 320px ekranga sig'masdi. Grid elementlari o'z
mazmunidan kichrayolmaydi, ya'ni bu kafolatlangan gorizontal overflow edi.

**3. Tab semantikasi.** `Tabs` `role="tab"` e'lon qilardi, lekin bog'liq panel
yo'q edi — ekran o'quvchi uchun bu oddiy tugmadan yomonroq.

### QA — API darajasida bajarildi (2026-09-07)

Lokal muhit Docker'ga ko'chirildi (`POSTGRES_PORT=5433`, `REDIS_PORT=6380` —
5432 ni Windows servisi, 6379 ni boshqa loyihaning konteyneri egallagan).
Migratsiya va seed qo'llandi, backend va pos-web ishga tushirildi.

**Route smoke testi:** 34 route, hammasi kompilyatsiya bo'ldi, dev logda 0 xato.

**API tekshiruvi:** yangi ekranlar chaqiradigan **27 endpoint** haqiqiy javob
bilan sinaldi — 27/27 muvaffaqiyatli. B1–B7 oqimlari uchdan uchigacha ishladi:
filial yaratildi, tahrirlandi va ish vaqti o'rnatildi; kategoriya PATCH
qilindi; beshta hisobot ham javob qaytardi; ingredient, ombor va zaxira
harakati yaratildi; `limit`/`offset` qabul qilindi.

Javob kalitlari frontend turlariga solishtirildi va mos chiqdi — jumladan
`/reports/z` ning 14 kaliti, `/inventory/*` ro'yxatlari, `/branches` dagi
`isTemporarilyClosed` va `timezone`, `/menu/categories` dagi `imageUrl` va
`_count`.

**Bitta yo'l tekshirilmadi:** `paymentBreakdown` bo'sh bazada `[]` qaytaradi,
ya'ni tuzatilgan crash yo'li jonli ishga tushmadi. Tuzatish servis kodiga va
savdo hisobotining ancha oldindan mavjud tur e'loniga solishtirilib
tekshirildi; buni jonli ko'rish uchun buyurtma va to'lov fixture'i kerak.

### QA — hali qilinmagan (brauzer kerak)

Chrome kengaytmasi ulanmagani uchun **piksel darajasida ko'rilmagan**:

- Haqiqiy kengliklarda responsive tekshiruv (768 / 1024 / 1366 / 1440 / 1920 / 1024×600)
- Olti rol uchun RBAC vizual tekshiruvi
- Modallarni sichqoncha bilan ishlatib ko'rish

Muhit tayyor turibdi, faqat brauzerni boshqarish yo'q.

### Lokal muhit eslatmalari

- Seed **filial yaratmaydi** (0 ta). Birinchi filial admin panelning o'zidan
  yaratiladi — B1 ekrani aynan shuning uchun kerak edi.
- Seed foydalanuvchi ham yaratmaydi; `pnpm --filter backend staff:bootstrap`
  yoki `MAZETTO_BOOTSTRAP_ADMIN_*` o'zgaruvchilari bilan
  `scripts/bootstrap-staff-admin.ts`.
- `NEXT_PUBLIC_MEDIA_URL` 8080 ga ishora qiladi; bu mashinada 8080 ni boshqa
  loyihaning konteyneri egallagan, ya'ni mahsulot rasmlari noto'g'ri
  servisdan keladi. Media servisi compose faylida yo'q.
