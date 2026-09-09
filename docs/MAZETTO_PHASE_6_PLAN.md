# MAZETTO FOOD — 6-BOSQICH: Admin qobig'i, kuryer, karta va backend qattiqlashtirish

Tuzilgan sana: 2026-09-10
Boshlang'ich HEAD: `f7168ff` (branch `admin-redesign-phase-5`, `main` dan 34 commit oldinda)
Oldingi bosqichlar: [`admin-redesign/PLAN.md`](./admin-redesign/PLAN.md), [`admin-redesign/PLAN-5-REDIZAYN.md`](./admin-redesign/PLAN-5-REDIZAYN.md)
Tegishli audit: [`MAZETTO_FULL_CODE_AUDIT.md`](./MAZETTO_FULL_CODE_AUDIT.md) (2026-08-29)

---

## Bu hujjat nima

Ikkita mustaqil ish bitta rejaga birlashtirilgan:

| Qism | Manba | Bloklar |
|---|---|---|
| **1-qism — Admin qobig'i va yangi bo'limlar** | QueenFood (`CorpEats`) kod bazasi bilan qiyoslash | A, B, C, D |
| **2-qism — Backend qattiqlashtirish** | 2026-09-10 chuqur kod tekshiruvi | H1–H12 |

**Kod hali yozilmagan.** Bu faqat reja va topilmalar ro'yxati.

### Qiyoslash manbasi

QueenFood ishlab chiqarish kodi `C:\Users\zikrillo\Desktop\developer\code\CorpEats` da (paket nomi `corpeats`, brend QueenFood). Bu hujjatda `apps/api`, `apps/web`, `packages/*` yo'llari **o'sha repoga** ishora qiladi; `apps/backend`, `apps/pos-web`, `apps/customer-web` esa Mazetto'niki.

---

# 1-QISM — ADMIN QOBIG'I VA YANGI BO'LIMLAR

## 1.1 Diagnoz: sidebar nega yo'qoladi

### Ildiz sabab

| | Mazetto | QueenFood |
|---|---|---|
| Qobiq qayerda | `AdminLayout` — **oddiy komponent**, 31 sahifada qo'lda chaqiriladi | `app/(dashboard)/layout.tsx` — **Next layout**, 8 rol uchun bitta |
| `layout.tsx` soni | 1 (faqat root) | route-group bo'yicha: `(auth)`, `(dashboard)`, `(shop)`, `(storefront)` |
| Navigatsiyada | butun daraxt unmount → remount | React shell'ni hech qachon unmount qilmaydi |

Mazetto'da har sahifa `RoleGuard > PermissionGuard > AdminLayout > kontent` ko'rinishida yig'ilgan — qobiq guardlardan **ichkarida**. Shuning uchun guard ishlayotgan har lahzada sidebar umuman mavjud emas.

### To'rtta aniq nuqson

#### D1 — Topbar yorliqlari qobiqsiz sahifalarga olib boradi ★ asosiy bug

`apps/pos-web/components/admin-shell/admin-navbar.tsx:208` — `topbarShortcuts`:

| Yorliq | Manzil | Kimga ko'rinadi | Qobiq |
|---|---|---|---|
| Kassa | `/pos` | SUPER_ADMIN, BRANCH_MANAGER, CASHIER | **yo'q** |
| Oshxona | `/kitchen` | SUPER_ADMIN, ADMIN, BRANCH_MANAGER, KITCHEN | **yo'q** |
| Smena | `/shift` | SUPER_ADMIN, BRANCH_MANAGER, CASHIER | **yo'q** |
| Admin | `/admin/dashboard` | SUPER_ADMIN, ADMIN, BRANCH_MANAGER | bor |
| Hisobot | `/admin/reports` | + ACCOUNTANT | bor |

Uchtasi `<a>` tegi bilan render qilinadi (`admin-navbar.tsx:129`) — ya'ni **to'liq sahifa qayta yuklanishi**, client navigatsiya emas. Owner "Kassa" ni bosadi → sidebar butunlay yo'qoladi, qaytish uchun faqat brauzerning "orqaga" tugmasi qoladi.

#### D2 — `/access-denied` qobiqsiz o'lik nuqta

`apps/pos-web/app/access-denied/page.tsx` — `AdminLayout` yo'q. Guard rad etsa `router.replace("/access-denied")` (`role-guard.tsx:23`, `permission-guard.tsx:29`). Yagona tugma "Login sahifasiga qaytish" → foydalanuvchini **tizimdan chiqarib yuboradi**.

#### D3 — Sidebar har navigatsiyada qayta quriladi

`apps/pos-web/components/admin-shell/admin-layout.tsx:27-33` — `isCollapsed` avval `false` bo'ladi, keyin `useEffect` `localStorage` dan o'qiydi. Qobiq sahifa ichida bo'lgani uchun har o'tishda unmount/remount bo'ladi:

- yig'ilgan sidebar har o'tishda ochilib-yopiladi (ko'rinadigan flicker)
- `ToastProvider` state yo'qoladi → navigatsiyadan oldin chiqarilgan toast o'ladi
- sidebar scroll pozitsiyasi yo'qoladi

#### D4 — Ikki rolning "uy" sahifasi menyuda yo'q

`apps/pos-web/lib/auth.ts:52` — `roleRedirects`:

| Rol | Login'dan keyin tushadi | `admin-nav.ts` da havola bormi |
|---|---|---|
| ACCOUNTANT | `/accounting` | **yo'q** |
| BRANCH_MANAGER | `/manager/dashboard` | **yo'q** |

Ikkalasi ham qobiqli sahifa, lekin boshqa bo'limga o'tgach **qaytib kelolmaydi**.

### Muammo bo'lmagan narsa

Nav rollari route guard rollari bilan **23/23 mos** — birma-bir tekshirildi. Ya'ni "menyuda ko'rinadi, lekin guard rad etadi" holati **yo'q**. RBAC to'g'ri; muammo faqat qobiq joylashuvida.

---

## 1.2 A blok — Qobiq arxitekturasi

> **Hech qanday URL o'zgarmaydi.** Next 16 hujjati (`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route-groups.md`) tasdiqlaydi: qavs ichidagi papka URL yo'liga **kirmaydi**.
>
> Muhim ogohlantirish o'sha hujjatdan: to'liq sahifa qayta yuklanishi faqat **bir nechta root layout** ishlatilganda sodir bo'ladi. Bizda bitta root layout (`app/layout.tsx` — `<html>`/`<body>` + `AuthProvider`) va uning ostida group layoutlar bo'ladi, shuning uchun bu bizga tegmaydi.
>
> `apps/pos-web/AGENTS.md` talabi: bu Next'ning tanish versiyasi emas — implementatsiyadan oldin `node_modules/next/dist/docs/` dagi tegishli qo'llanma o'qilishi shart.

### A1 — Route group joriy qilish

```text
app/layout.tsx                  ← root: <html>/<body> + AuthProvider (o'zgarmaydi)

app/(shell)/layout.tsx          ← AdminLayout shu yerga ko'chadi
app/(shell)/admin/**            ← 30 sahifa
app/(shell)/accounting/
app/(shell)/manager/dashboard/
app/(shell)/courier/**          ← B blok uchun tayyor joy

app/(fullscreen)/pos/**
app/(fullscreen)/kitchen/
app/(fullscreen)/waiter/
app/(fullscreen)/shift/

app/(auth)/login/
app/(auth)/access-denied/       ← A3 ga qarang
```

31 sahifadan `AdminLayout` importi olib tashlanadi.

**Natija:** sidebar unmount bo'lmaydi → D3 yopiladi.

### A2 — Guardni layoutga ko'chirish

QueenFood `apps/web/app/(dashboard)/layout.tsx:48` da bitta tekshiruv qiladi:

```
roleCanAccess(user.role, pathname)  →  ROUTE_ALLOWED_ROLES matritsasidan
```

Mazetto'da bu matritsa **allaqachon mavjud** — `apps/pos-web/lib/admin-nav.ts` ichidagi har element `roles` va `permission` maydonlariga ega. Uni yagona haqiqat manbaiga aylantirish kerak: layout tekshiradi, sahifada faqat kontent qoladi.

> Bu **faqat UX qatlami**. Backend guardlari o'z joyida qoladi — `admin-nav.ts:9-12` dagi izoh aynan shuni ta'kidlaydi.

31 sahifadan `RoleGuard` + `PermissionGuard` takrori olib tashlanadi.

### A3 — Rad etish qobiq ichida ko'rsatilsin

`/access-denied` alohida sahifa emas, **layout ichidagi holat** bo'ladi:

- sidebar joyida qoladi → foydalanuvchi boshqa bo'limga o'tadi
- "Login sahifasiga qaytish" tugmasi olib tashlanadi (u tizimdan chiqarib yuboradi)

**Natija:** D2 yopiladi.

### A4 — Oq ekran o'rniga skeleton

Hozir guardlar `<main className="min-h-screen bg-white" />` qaytaradi (`role-guard.tsx:35`). QueenFood `LoadingShell` (logo + skeleton) ko'rsatadi (`(dashboard)/layout.tsx:18`).

Layoutga ko'chgach: sidebar darhol chiziladi, faqat kontent joyida skeleton turadi.

### A5 — Topbar yorliqlarini tuzatish ★

**Tavsiya:** `/pos`, `/kitchen`, `/shift` yangi tabda ochilsin (`target="_blank"`) — bular to'liq ekran ish joylari, admin sessiyasi buzilmasin.

**Qo'shimcha:** o'sha uch sahifaga "Admin panelga qaytish" tugmasi.

**Natija:** D1 yopiladi.

### A6 — Har rolning uy sahifasi menyuda bo'lsin

`lib/auth.ts:52` dagi `roleRedirects` bilan `adminNavGroups` sinxron bo'lishi shart. QueenFood'da `ROLE_HOME` (`lib/auth-utils.ts:5`) va har rol nav'ining birinchi elementi bir xil manzilga ishora qiladi.

**Natija:** D4 yopiladi.

### A7 — Faza darvozasi (ixtiyoriy)

QueenFood `apps/web/config/phase.ts` — `FROZEN_NAV_PREFIXES` orqali hali ishga tushmagan bo'limlar menyudan olib tashlanadi, route esa URL orqali ochiq qoladi:

```
/** Strips nav items that point into frozen panels; drops emptied groups. */
export function filterNavForPhase(groups: NavGroup[]): NavGroup[]
```

Kuryerni bosqichma-bosqich chiqarish uchun aynan kerak.

---

## 1.3 B blok — Kuryer roli

### Talab

Kuryer **alohida bo'lim** bo'lsin, lekin **qobiq saqlanib qolsin**. QueenFood'da aynan shunday: `(dashboard)/courier/*` bir xil `DashboardShell` ichida, faqat `NAV_CONFIG.COURIER` boshqa elementlar beradi.

### QueenFood kuryer ekranlari

| Route | Qator | Vazifa |
|---|---|---|
| `/courier` | 524 | bugungi holat, smenani yoqish/o'chirish |
| `/courier/orders` | 341 | biriktirilgan buyurtmalar, status o'zgartirish |
| `/courier/route` | 355 | bugungi marshrut, to'xtashlar ketma-ketligi |
| `/courier/map` | 101 | kartada marshrut |
| `/courier/history` | 203 | yetkazishlar tarixi |
| `/courier/profile` | 177 | profil + statistika |

Admin tomonda `/admin/couriers` — ro'yxat, status, marshrut qurish (`useBuildRouteMutation`, `useRouteSuggestionsMutation`).

### Mazetto'dagi bo'shliq

- `MazettoRole` (`apps/pos-web/lib/auth.ts:3`) da 7 rol bor, `COURIER` **yo'q**
- `Order.type` da `DELIVERY` bor, lekin **kim yetkazishi yozilmaydi**
- Bazada marshrut/to'xtash tushunchasi yo'q

### Bosqichlar

| # | Ish | Bog'liqlik |
|---|---|---|
| B1 | `COURIER` roli + permission matritsasi: `COURIER_ROUTE_VIEW`, `COURIER_STOP_UPDATE`, `COURIER_STATUS_TOGGLE`, admin uchun `COURIER_MANAGE` | — |
| B2 | Baza: `DeliveryRoute`, `RouteStop`; `Order` ga `courierId` | B1 |
| B3 | Kuryer ekranlari `app/(shell)/courier/*` | A1, B2 |
| B4 | `/admin/couriers` | B2 |

---

## 1.4 C blok — Karta va Toshkent chegarasi

### C1 — `TASHKENT_BOUNDS` yagona manba

QueenFood `packages/types/src/index.ts:74`:

```
latMin 41.18 · latMax 41.4 · lngMin 69.13 · lngMax 69.42
```

Izohidagi muhim tarix (`packages/types/src/index.ts:70-73`):

> Eski quti **41.45 / 69.5** edi va Saryog'och (**Qozog'iston**) hamda Toshkent **viloyati** hududiga chiqib ketardi. Bu — Toshkent **SHAHRI**.

**Mazetto uchun joy:** `packages/types`. Bu — o'lik paketni tiriltirish uchun birinchi haqiqiy sabab (H9 ga qarang): backend ham, ikkala frontend ham **bir xil raqamlarni** ko'rishi shart.

> QueenFood ikki nusxa saqlaydi (`packages/types` + `apps/api/src/common/geo/tashkent-bounds.ts`) chunki kompilyatsiya qilingan API raw-TS paketni runtime'da `require` qilolmaydi. Mazetto'da `apps/backend/package.json` da `@mazetto/types` dependency allaqachon bor va u `dist` ga build bo'ladi — bitta nusxa yetishi mumkin, tekshirilsin.

### C2 — Geocoding proxy

QueenFood `apps/api/src/modules/geocoding/geocoding.service.ts:7-17` — brauzerdan to'g'ridan-to'g'ri Nominatim'ga bormaslikning **to'rt sababi**:

1. IP bo'yicha rate limit — bitta ofis NAT = darhol 429
2. kesh yo'q — bir xil manzil qayta-qayta so'raladi
3. mijoz koordinatalari uchinchi tomonga oqadi
4. self-hosted geocoder'ga o'tish uchun frontend relizi kerak bo'lardi

Server proxy beradi:

| | Qiymat |
|---|---|
| Reverse kesh TTL | 30 kun (manzillar ko'chmaydi) |
| Search kesh TTL | 7 kun |
| Kesh kaliti | `geo:rev:{lang}:{lat.toFixed(4)}:{lng.toFixed(4)}` — ~11 m yaxlitlash |
| Timeout | 5 s |
| `User-Agent` | Nominatim siyosati talab qiladi |
| Baza URL | `NOMINATIM_URL` env |

**Bu — Mazetto'da Redis'ni tiriltirishning ikkinchi sababi** (birinchisi H2/H3). Hozir Redis `docker-compose.yml` da ko'tarilgan, lekin kodda **umuman ishlatilmaydi**.

### C3 — Ikki qatlamli tekshiruv + fail-open

| Qatlam | Nima qiladi |
|---|---|
| Bounding box | tez, oflayn, **ikkala tomonda** (`isWithinTashkent`) |
| Reverse geocode | aniq: `country_code` ≠ `uz` yoki state'da `viloyat\|область\|region` bo'lsa rad etadi |

Nominatim state nomini `accept-language` ga tarjima qiladi, shuning uchun regex **uchala tilni** ushlaydi.

**Fail-open majburiy.** Geocoder ishlamasa buyurtma **bloklanmaydi** — `{ label: '', inCity: true }` qaytadi va keshlanmaydi:

> *"the caller's bounding-box check already gated the pick, so an outage must degrade to 'no address label', never to a blocked order."*

Bu ataylab qilingan qaror va Mazetto'ga **aynan shunday** ko'chirilishi kerak.

### C4 — Forward search chegarasi

```
countrycodes=uz & viewbox=<TASHKENT_BOUNDS> & bounded=1 & limit=5
```

"Chilonzor" chet eldagi bir xil nomli joyga hech qachon tushmaydi. Xato bo'lsa bo'sh ro'yxat (soft-fail).

### C5 — Tile provider env orqali

QueenFood `apps/web/components/map-tiles.ts` — bitta manba, ikkala karta komponenti ishlatadi.

| Variant | URL |
|---|---|
| Self-hosted (compose `tiles` profili, kalitsiz) | `/tiles/{z}/{x}/{y}.png` |
| MapTiler (kalit kerak) | `https://api.maptiler.com/maps/streets-v2/...` |
| Default | `https://tile.openstreetmap.org/{z}/{x}/{y}.png` |

⚠️ Nozik nuqta izohdan: `||` ishlatilgan, `??` emas — **Docker build-arg o'rnatilmaganda bo'sh string bo'lib keladi** va `??` uni fallback'ga o'tkazmaydi.

⚠️ OSM public server siyosati og'ir ishlab chiqarish trafigini taqiqlaydi.

### C6 — Eski manzillar uchun oldindan ogohlantirish

Chegara toraytirilgach saqlangan manzil tashqarida qolishi mumkin. QueenFood buni checkout'da **darhol** ko'rsatadi, submit'dan keyingi 400 emas (`orders/new/page.tsx:51-57`).

### C7 — Yetkazish narxi

QueenFood `DELIVERY_FEE_PLAN.md` (CorpEats repo ildizida) — minimal buyurtma darvozasi **narxga aylantirilgan**:

| Asosiy porsiya | Yetkazish |
|---|---|
| 0–4 | 40 000 so'm |
| 5–9 | 20 000 so'm |
| 10+ | tekin |

Sabab: `min_order_quantity=10` savatni 250–339 ming so'mga ko'tarib qo'yardi va voronka tahlilida nol buyurtmaning bosh gumondori edi.

**Ikkita arxitektura darsi:**

1. **Jadval bazada** (`delivery_fee_tiers` JSON setting), kodda emas → deploysiz o'zgartiriladi. Server yagona manba, `getPublic()` orqali frontendga e'lon qilinadi.
2. **`deliveryFee` daromadga kirmasligi kerak.** QueenFood'da u `totalPrice` ichida turgani uchun `platform_commission_pct` yetkazish pulidan ham komissiya olardi va `kitchenShare` oshxonaga u ishlab topmagan pulni yozardi. Qoida: **"daromad = sotilgan taom"**, yetkazish alohida ustun.

Mazetto'da `Order.deliveryFeeTotal` alohida maydon sifatida allaqachon bor (`schema.prisma:877`) — hisobotlarda ajratilganini tekshirish kerak.

> Mazetto'da masofa asosidagi variant ham mumkin — `Branch.latitude/longitude` `Decimal(10,7)` bo'lib mavjud (`schema.prisma:169-170`). Lekin asosiy naqsh "sozlamadan boshqariladigan jadval".

---

## 1.5 D blok — Buyurtma ketma-ketligi

### Tuzilish farqi

| | QueenFood | Mazetto |
|---|---|---|
| Savat | `/cart` | `/cart` |
| 1-qadam | `/orders/new` — Ma'lumotlar | — |
| 2-qadam | `/orders/new/payment` — To'lov | `/checkout` (bitta sahifa) |
| Yakun | buyurtma sahifasi | `/order-success/[id]` |

### D1 — Qadamlar ajratilgan + stepper

`apps/web/components/storefront/checkout-stepper.tsx` — ① Ma'lumotlar → ② To'lov. 1-qadam 2-qadamga o'tgach ✓ ga aylanadi.

### D2 — State qatlamlari ajratilgan

| Ma'lumot | Saqlash | Sabab |
|---|---|---|
| Savat | `localStorage` | vizitlar orasida saqlanadi |
| Checkout ma'lumotlari | `sessionStorage` | tab bilan o'ladi |

`apps/web/store/checkout.store.ts` izohi:

> *"survives the page hop and a refresh, but dies with the tab — half-filled delivery details aren't worth keeping across visits (unlike the cart, which persists in localStorage)."*

Mazetto hozir hammasini `localStorage` da saqlaydi (`apps/customer-web/lib/cart.tsx:170-192`).

### D3 — "Tushib qolish" holatlari ishlangan

| Holat | Xatti-harakat |
|---|---|
| Savat bo'sh | `EmptyState` + "Menyuga" tugmasi (jimgina redirect **emas**) |
| Slot tanlanmagan | menyuga qaytaradi, sababi bilan |
| 2-qadamga ma'lumotsiz kirildi | 1-qadamga qaytaradi |
| Mehmon | `/login?redirect=/orders/new`, **savat omon qoladi** |
| Buyurtma berildi | `placed` bayrog'i — savat tozalanishi "bo'sh savat" guardini ishga tushirmasligi uchun |

Oxirgisi nozik: buyurtma berilganda savat va detallar tozalanadi, bu esa o'z navigatsiyasidan **oldin** "bo'sh savat → 1-qadamga" guardini ishga tushirib yuborardi.

### D4 — To'lov usullari: qulf va "tez kunda" farqi

`orders/new/payment/page.tsx:779-782` izohi:

> *"locked rows show a padlock + the 'X/threshold online orders' progress note instead of being hidden. A `badge` (e.g. 'Tez kunda') replaces the padlock — a lock reads as 'earn it', a badge as 'not launched yet'."*

Ikkalasi ham **yashirilmaydi** — ko'rsatiladi va sababi tushuntiriladi.

Qo'shimcha mexanizmlar:
- `PREPAY = ['PAYME','CLICK','UZUM']` — frontend backend ro'yxatini aks ettiradi
- ishonch darvozasi: `threshold` ta onlayn to'langan buyurtmadan keyin "yetkazishda to'lash" ochiladi
- PSP kill switch — **serverda ham** majburlanadi

Mazetto hozir faqat `CASH` ko'rsatadi (AUD-002 tuzatishi) — bu to'g'ri, lekin QueenFood naqshi mijozga "keyin nima bo'lishini" ko'rsatadi.

### D5 — Telefon normalizatsiyasi frontendda ham

```
normalizePhone(raw)  →  +998XXXXXXXXX
PHONE_RE = /^\+998\d{9}$/
```

Mazetto backendda `normalizeCustomerPhone` bor (AUD-003 tuzatishi), frontendda yo'q.

### D6 — Vaqt: 30 daqiqalik chiplar

`timeSteps(from, to, stepMin = 30)` izohi:

> *"the native time widget showed AM/PM on many devices, which is not how time is written in Uzbekistan."*

### D7 — Toshkent "bugun"i

```
new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tashkent' }).format(new Date())
```

`toISOString()` UTC bo'lgani uchun sanani orqaga suradi. QueenFood buni 6+ joyda ishlatadi. Mazetto backendida `apps/backend/src/modules/orders/order-display-number.ts:60` da aynan shu naqsh bor — **frontendga ham kerak**.

### D8 — Narx faqat serverdan

`useDeliveryQuote` — mijoz tomoni hech qachon o'zi hisoblamaydi. Bu Mazetto'ning AUD-001 muammosining ildizi edi.

---

# 2-QISM — BACKEND QATTIQLASHTIRISH

2026-09-10 kod tekshiruvidan. Har topilma kodda tasdiqlangan.

## H1 — Login throttle: `X-Forwarded-For` spoofing ★ P1

**Fayl:** `apps/backend/src/modules/auth/auth.controller.ts:39-56`

```
cf-connecting-ip  →  bo'lsa ishlatiladi
x-forwarded-for   →  birinchi qiymat olinadi
request.ip        →  fallback
```

Express'da `trust proxy` o'rnatilmagan, lekin kod headerlarni **qo'lda** o'qiydi. Har kim `X-Forwarded-For: 1.2.3.4` yuborib istalgan qiymat bera oladi.

Throttle kaliti (`auth.service.ts:279`):

```
login:${identifier}:address:${clientAddress}   ← 5 urinish
login:${identifier}:account                    ← 20 urinish
```

Har so'rovda tasodifiy XFF yuborilsa — **har safar yangi, bo'sh bucket**. Manzil bo'yicha 5 urinishlik chegara amalda yo'q.

Ikkinchi kalit faqat identifikatorga bog'liq, spoofing bilan aylanib o'tilmaydi → **bitta akkauntni** brute-force qilish cheklangan. Lekin **ko'p akkaunt bo'ylab password spraying** cheksiz.

**Topologiya:** Cloudflare → Dokploy → backend. `cf-connecting-ip` ishonchli **faqat** origin to'g'ridan-to'g'ri ochiq bo'lmasa — buni tekshirish kerak.

**Tuzatish:** ishonchli proxy ro'yxati; XFF faqat ma'lum proxy'dan kelganda qabul qilinsin.

## H2 — Login throttle: cheksiz xotira o'sishi ★ P1

**Fayl:** `apps/backend/src/modules/auth/auth.service.ts:42` — `private readonly loginThrottle = new Map()`

Tozalash **faqat** `assertLoginAllowed` ichida, **aynan o'sha kalit qayta so'ralganda** bo'ladi (`auth.service.ts:306`). Hujumchi hech qachon bir kalitni ikki marta ishlatmaydi → hech narsa tozalanmaydi.

Backendda `setInterval`, `@Cron`, `ScheduleModule` — **umuman yo'q** (grep bilan tasdiqlandi). Davriy tozalash mavjud emas.

Kalitni hujumchi to'liq boshqaradi (identifikator + XFF) → **xotira tugatish hujumi ochiq**.

Qo'shimcha: backend qayta ishga tushsa yoki ikkinchi instance ko'tarilsa, cheklov butunlay yo'qoladi.

**Yechim namunasi** — QueenFood `RedisThrottlerStorage`:

> *"Counters live in Redis, not process memory — in-memory buckets reset on every deploy and would be counted per-replica."*

## H3 — Global rate limit va xavfsizlik header'lari yo'q · P2

Mazetto'da `@nestjs/throttler` ham, `helmet` ham o'rnatilmagan.

QueenFood sozlamasi:

| | Qiymat | Manba |
|---|---|---|
| Global guard | `ThrottlerGuard` | `apps/api/src/app.module.ts:94` |
| Standart limit | `ttl: 60_000, limit: 60` | `app.module.ts:55` |
| Saqlash | `RedisThrottlerStorage` | `app.module.ts:56` |
| Marshrut darajasi | 9 ta auth endpointda `@Throttle` (login 5/min, refresh 20/min) | `auth.controller.ts` |
| Header'lar | `app.use(helmet())` | `apps/api/src/main.ts:42` |

⚠️ Redis storage testidan nozik nuqta: **birinchi hit'da TTL o'rnatilmasa, kalit hech qachon eskirmaydi va mijoz bir marta limitga yetgach abadiy bloklanadi.**

## H4 — Chek raqami to'qnashuvi ★ P1

**Fayl:** `apps/backend/src/modules/payments/payments.service.ts:655`

```
RCPT-{sana}-{rand 100000..999999}
```

Fazo — kuniga atigi **900 000** qiymat (soniyada emas, **kunda**). Tug'ilgan kun paradoksi:

| Kunlik chek | Kamida bitta to'qnashuv ehtimoli |
|---|---|
| 100 | 0.6 % |
| 500 | **13 %** |
| 1 000 | 43 % |
| 2 000 | 89 % |

### To'qnashuv zanjiri (to'liq kuzatildi)

1. `createReceipt` to'lov tranzaksiyasi **ichida** ishlaydi (`payments.service.ts:610`)
2. `receiptNumber` da P2002 → **butun to'lov tranzaksiyasi bekor bo'ladi**
3. `catch` (satr 395) **har qanday** P2002 ni idempotency kaliti to'qnashuvi deb talqin qiladi
4. `resolveExistingOperationByKey` chaqiriladi — lekin `paymentOperation` ham o'sha tranzaksiyada yaratilgan edi (satr 174) va u ham bekor bo'lgan
5. `findUnique` → `null` → `BadRequestException("Payment operation could not be resolved")` — **HTTP 400**

Kassir tasodifiy son to'qnashuvi haqida hech narsa bilmaydi. To'lov esa yozilmagan.

**Bu yerda ikkita alohida nuqson bor:**

- H4a — raqam generatsiyasida retry yo'q
- H4b — P2002 `catch` constraint nomi bo'yicha **ajratilmagan**; har qanday unique buzilishi "idempotency" deb talqin qilinadi

## H5 — `shiftNumber` poygasi · P2

**Fayl:** `apps/backend/src/modules/shifts/shifts.service.ts:69-79`

```
MAX(shiftNumber) o'qiladi  →  +1  →  yoziladi
```

Prisma standart izolyatsiyasi Read Committed. Bir filialda ikki kassir bir vaqtda smena ochsa — ikkalasi bir xil raqam o'qiydi → `@@unique([branchId, shiftNumber])` (`schema.prisma:1324`) → biri **500** oladi.

`allocateDisplayOrderNumber` (`order-display-number.ts:24`) dagi `pg_advisory_xact_lock` naqshi shu yerga ham kerak.

## H6 — Raqam generatsiyasining umumiy holati

| Raqam | Usul | Himoya |
|---|---|---|
| `displayOrderNumber` | advisory lock + MAX+1 | ✅ to'g'ri |
| `ticketNumber` | tasodifiy + **5 urinish retry** (`kitchen.service.ts:78-90`) | ✅ yopiq |
| `orderNumber` | `POS-sana-vaqt-rand(1000..9999)` | ⚠️ retry yo'q (fazo soniyada — risk past) |
| `receiptNumber` | tasodifiy, kunlik fazo | ❌ H4 |
| `shiftNumber` | MAX+1 | ❌ H5 |

> **Tuzatish:** avvalgi tahlilda ticket raqamini ham ochiq deb sanagandim — unda retry mavjud.

## H7 — Fail-open guard naqshi · P2

**Fayl:** `apps/backend/src/modules/customers/customers.controller.ts`

Hozirgi holat **toza** — 8 ta mijoz endpointining hammasida `@UseGuards(CustomerAuthGuard)` bor.

**Nega TypeScript ushlamaydi:**

```
current-customer.decorator.ts:5   →  AuthenticatedCustomer | undefined  qaytaradi
customers.controller.ts:117       →  customer: AuthenticatedCustomer     deb e'lon qilingan
```

Param dekorator qaytish tipi parametr tipini cheklamaydi. `strict` ham, `exactOptionalPropertyTypes` ham bu yerda kuchsiz.

**Guard unutilsa:** beshala endpoint darhol `customer.id` ni o'qiydi → `TypeError` → **500**. Ma'lumot sizmaydi, xizmat qulaydi — bu bexosdan omad, dizayn emas. Agar kimdir `customer?.id` yozsa, Prisma'da `where: { customerId: undefined }` **filtrni butunlay olib tashlaydi** va barcha mijozlarning buyurtmalari qaytadi.

26 ta QA skriptidan **birortasi** bu naqshni tekshirmaydi.

> **Arxitekturaviy ildiz:** Mazetto'da ikkita mustaqil identity tizimi (`User`/xodim va `Customer`/mijoz), ikkita JWT sekret, ikkita guard. QueenFood'da bitta `User` jadvali va `CLIENT` roli — ularda bu muammo umuman yo'q.

**Tuzatish:** guardni default qilib, ochiqni aniq belgilash (fail-closed).

## H8 — Token claim'lari e'tiborsiz qoldiriladi · P2

`apps/backend/src/modules/auth/auth.service.ts:181` — access token **allaqachon** `roles` va `permissions` ni o'z ichiga oladi (`signAsync(user, ...)`, bu yerda `user = toAuthenticatedUser(...)`).

`apps/backend/src/common/guards/jwt-auth.guard.ts:47` esa token claim'larini **butunlay e'tiborsiz qoldiradi** va bazadan qayta o'qiydi.

Natijada **ikkala narx** ham to'lanadi:

- BRANCH_MANAGER'da ~50 ruxsat → har so'rovda `user → roles → role → rolePermissions → permission` 4 jadvalli join
- va o'sha 50 ruxsat har so'rov header'ida ~1 KB bo'lib yuriladi

Indekslar joyida (`@@id([userId, roleId])`, `@@id([roleId, permissionId])`) — muammo so'rov sifatida emas, **chastotasida**.

DB o'qishning yagona haqiqiy foydasi — darhol bekor qilish (rol o'zgardi, xodim bloklandi). Buni 15 soniyalik Redis keshi yoki `sessionVersion` hisoblagichi ham beradi.

## H9 — `packages/*` o'lik · P3

Aniq tekshiruv:

```
customer-web  →  @mazetto/* dan import:  0
pos-web       →  @mazetto/* dan import:  0
backend       →  @mazetto/types dan:     0
```

Shunga qaramay:

- `apps/backend/package.json` da `"@mazetto/types": "workspace:*"` dependency turibdi
- ikkala Next app'da `transpilePackages` sozlangan
- turbo har build/lint/typecheck'da bu 4 paketni quradi

Jami mazmun: **37 qator**.

**Imkoniyat:** C1 dagi `TASHKENT_BOUNDS` aynan `packages/types` ga tushishi kerak bo'lgan narsa.

## H10 — Chegarasiz `listCustomerOrders` · P2

**Fayl:** `apps/backend/src/modules/customers/customers.service.ts:457`

```
findMany({ where: { customerId }, orderBy: {...}, include: <to'liq> })
```

`take` yo'q, sahifalash yo'q. Sodiq mijoz 500 ta buyurtma yig'sa, `/orders` sahifasi har ochilganda 500 tasi ichki `items` va `payments` bilan tortiladi.

`apps/customer-web/app/orders/page.tsx:126-130` da **to'rtta** socket hodisasi bir xil `refresh` ga bog'langan → mijozning har bir buyurtmasi hayot siklida to'liq tarix 4 marta qayta yuklanadi.

> **Tuzatish:** avvalgi tahlilda "begona buyurtmalar ham qayta yuklashni keltirib chiqaradi" degandim — bu **noto'g'ri**. `kitchen.gateway.ts:231-250` hodisalarni faqat filial xonasi, global xodim xonasi va **aniq mijozning xonasiga** yuboradi. AUD-008 gateway darajasida amalda yopilgan.

Qolgan ~40 ta `take`siz `findMany` chegaralangan ma'lumotnoma jadvallari (POS katalogi — 74 mahsulot, rollar, printerlar, yetkazib beruvchilar) yoki sana bilan filtrlangan hisobotlar.

## H11 — Chop etish zanjiri ulanmagan · P3

`buildEscPos` **mavjud** (`apps/backend/src/modules/receipts/receipts.service.ts:119`), lekin ESC/POS baytlari emas — **abstrakt buyruq ro'yxati** (JSON):

```
{ type: "align", value: "center" }, { type: "bold", ... }, { type: "cut" }
```

`receipts.service.ts:83` da javobga `escpos:` maydoni sifatida qo'shiladi. **Uni hech kim iste'mol qilmaydi** — `pos-web` da `escpos` so'zi umuman uchramaydi.

```
Backend → JSON buyruq ro'yxati → [ HECH NARSA ] → bayt yo'q → printer yo'q
```

`PrintersModule` — 3 endpointli **ro'yxat** (117 qator jami): nom, tur, status. `metadata: { protocol: "ESC_POS", ready: true }` yaratish paytida yozib qo'yiladigan konstanta — niyatni tasvirlaydi, imkoniyatni emas. `PATCH /receipts/:id/print` faqat `printed: true` bayrog'ini qo'yadi.

Kontrakt loyihalashtirilgan, iste'molchi (`apps/print-agent`, 1 qator stub) yozilmagan.

## H12 — Kichik texnik qarz · P3

### CORS dublikati

`apps/backend/src/main.ts:7-13` va `apps/backend/src/modules/kitchen/kitchen.gateway.ts:14-20` — `diff` bilan **bayt-bayt bir xil**. Ikkalasi ham **kodga qattiq yozilgan**, env override yo'q. Yangi domen = kod o'zgarishi + redeploy.

QueenFood'da `CORS_ORIGIN` env (`apps/api/src/main.ts:26`).

⚠️ `docs/PRODUCTION_DEPLOYMENT.md:124` "Current backend websocket origin is `*`" deydi — **hujjat eskirgan**, kodda ro'yxat bor.

### Typecheck qamrovi

`tsc --listFiles` natijasi:

| Papka | Qamrovda |
|---|---|
| `apps/backend/src` | 135 fayl |
| `apps/backend/scripts` | **0** |
| `apps/backend/prisma` | **0** |

ESLint ularni ko'radi (exit 0), lekin `eslint.config.mjs` da `projectService` ham, `recommendedTypeChecked` ham yo'q → faqat sintaktik qoidalar, tip xatosi hech qachon ushlanmaydi.

Bu skriptlar uchun ayniqsa muhim, chunki ular manba matnini **regex bilan** tekshiradi:

```js
// validate-realtime-auth.ts
assert.match(gateway, /@WebSocketGateway\(\{\s*cors:\s*\{\s*credentials:\s*true,/s);
```

Kodni ishga tushirmaydi — faylni `readFileSync` qilib naqsh qidiradi. Formatlash o'zgarishi jimgina buzadi. `249d633 Make the nav validator tolerate CRLF checkouts` commiti aynan shu sinfdagi buzilish edi.

### Repo hajmi

```
media-source/    153.9 MB   (85 PNG)
docs/             73.3 MB   ← 48 MB bitta CorelDRAW fayli + 8.9 MB PDF
apps/             23.4 MB   (customer-web/public)
qolgani            < 1 MB
```

`.git` pack — **232.73 MiB**. Ya'ni repo hajmining **~99.7 %** i dizayn manbalari; haqiqiy manba kod 1 MB dan kam.

Eng yomon fayl: `docs/design/source-media/menu mazetto.cdr` — **48 MB**, binar. Har qayta saqlanganda tarixga yana to'liq 48 MB qo'shiladi.

### Yirik fayllar

| Fayl | Qator |
|---|---|
| `apps/backend/src/modules/telegram/telegram-customer-ordering.service.ts` | 2003 |
| `apps/backend/src/modules/orders/orders.service.ts` | 1216 |

---

# PRIORITETLAR

| # | Muammo | Daraja | Blok |
|---|---|---|---|
| D1 | Topbar yorliqlari sidebar'ni yo'qotadi | **P1 (UX)** | A5 |
| H1 | XFF spoofing → IP limiti aylanib o'tiladi | **P1** | — |
| H2 | Throttle `Map` cheksiz o'sadi | **P1** | — |
| H4 | Chek raqami to'qnashuvi + P2002 noto'g'ri talqini | **P1** | — |
| D2 | `/access-denied` o'lik nuqta | P2 | A3 |
| H3 | Global throttle / helmet yo'q | P2 | — |
| H5 | `shiftNumber` poygasi | P2 | — |
| H7 | Fail-open guard naqshi | P2 | — |
| H8 | Token claim'lari e'tiborsiz | P2 | — |
| H10 | `listCustomerOrders` chegarasiz | P2 | — |
| D3 | Sidebar remount / flicker | P2 | A1 |
| D4 | Rol uy sahifasi menyuda yo'q | P2 | A6 |
| H12c | Repo 232 MB | P2 | — |
| H9 | `packages/*` o'lik | P3 | C1 |
| H11 | Chop etish zanjiri ulanmagan | P3 | — |
| H12 | CORS dublikati, typecheck qamrovi, yirik fayllar | P3 | — |

## Eng tez qaytim beradigan uchtasi

1. **XFF ishonchini olib tashlash** — bir necha qator
2. **Chek raqamiga retry + P2002 ni constraint bo'yicha ajratish**
3. **`listCustomerOrders` ga `take`**

## Bloklar tartibi

```
A  →  C  →  D  →  B
```

- **A** mustaqil, eng tez foyda, hech narsani buzmaydi
- **C** (karta) **D** (checkout) uchun shart — manzil tanlash checkout ichida
- **B** (kuryer) **A** ga tayanadi (qobiq layoutda bo'lishi kerak) va **C** ga (marshrut = koordinata)

H-bloklari mustaqil — istalgan vaqtda parallel bajarilishi mumkin.

---

# OCHIQ QARORLAR

Quyidagilar hal qilinmaguncha tegishli ish boshlanmaydi:

| # | Savol | Ta'sir qiladi |
|---|---|---|
| 1 | Kuryer — mustaqil `Courier` jadvalmi yoki `Employee` + `COURIER` rolmi? | B2 |
| 2 | Yetkazish narxi — porsiya pog'onasi (QueenFood) yoki masofa asosida? | C7 |
| 3 | Tile provider — OSM public yoki self-hosted? | C5 |
| 4 | Marshrut optimizatsiyasi kerakmi (QueenFood `routeSuggestions`) yoki 1-versiyada oddiy ro'yxat yetadimi? | B3, B4 |
| 5 | Topbar yorliqlari — yangi tabda ochilsinmi yoki olib tashlansinmi? | A5 |
| 6 | `packages/*` — to'ldiriladimi (C1 bilan) yoki o'chiriladimi? | H9 |
| 7 | `media-source/` va 48 MB `.cdr` — Git LFS'gami yoki repodan butunlay chiqariladimi? | H12c |

---

# O'ZGARMAS CHEKLOVLAR

- **URL'lar o'zgarmaydi.** A1 route group ishlatadi — qavs ichidagi papka URL yo'liga kirmaydi.
- **Backend RBAC tegilmaydi.** A2 dagi guard ko'chirish faqat frontend UX qatlami; `admin-nav.ts:9-12` izohidagi qoida kuchda qoladi.
- **Yangi permission qo'shilmaydi** (A bloki uchun). B bloki yangi permissionlar talab qiladi — B1 da alohida.
- **Token qatlami buzilmaydi.** `app/admin-theme.css` tegilmaydi.
- **Next 16 hujjati o'qilsin.** `apps/pos-web/AGENTS.md` talabi: `node_modules/next/dist/docs/` dagi tegishli qo'llanma implementatsiyadan oldin o'qilishi shart.
- **`customer-web` D bloki tashqarisida tegilmaydi.**
- **Ishlab chiqarish bazasiga hech qanday destruktiv buyruq yo'q** — [`MAZETTO_RELEASE_READINESS_CHECKLIST.md`](./MAZETTO_RELEASE_READINESS_CHECKLIST.md) qoidalari kuchda.
