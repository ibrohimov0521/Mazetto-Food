# MAZETTO FOOD ↔ QueenFood — to'liq qiyosiy tahlil

Tuzilgan sana: 2026-09-10
Mazetto HEAD: `f7168ff` (`admin-redesign-phase-5`)
QueenFood manba: `C:\Users\zikrillo\Desktop\developer\code\CorpEats` (paket `corpeats`, brend QueenFood / Qirolicha Taomlari)

**Maqsad:** QueenFood'dan o'zlashtirilishi mumkin bo'lgan kuchli jihatlarni aniqlash.
**Natija rejalari:** [`MAZETTO_PHASE_7_PLAN.md`](./MAZETTO_PHASE_7_PLAN.md) · [`MAZETTO_ROADMAP_MASTER.md`](./MAZETTO_ROADMAP_MASTER.md)

> **Yo'l nomlari haqida.** Bu hujjatda `apps/api`, `apps/web`, `apps/mobile`, `packages/db|ui|types` — **QueenFood** repodagi yo'llar. `apps/backend`, `apps/pos-web`, `apps/customer-web` — **Mazetto**'niki.

---

## 1. Ikki loyiha nima

| | Mazetto | QueenFood |
|---|---|---|
| Biznes modeli | Restoran: POS + zal + oshxona + onlayn buyurtma | Korporativ ovqat yetkazish: obuna + slot + kuryer |
| Mijoz | Restoran mehmoni | Ofis xodimi / yuridik shaxs |
| Yetkazish | Yangi qo'shilmoqda | Asosiy oqim |
| Sotuv nuqtasi | POS terminal, ofitsiant, kassa | Yo'q — hammasi oldindan buyurtma |

Biznes farqli, lekin **texnik muammolar bir xil**: rol asosidagi panel, buyurtma hayot sikli, to'lov, hisobot, realtime, Telegram, karta, kuryer.

---

## 2. O'lcham

| Qism | Mazetto | QueenFood |
|---|---|---|
| Backend | 17 360 qator (135 fayl) | **37 342** qator (268 fayl) |
| Web (admin+POS / dashboard) | 17 000 qator | **31 137** qator (182 fayl) |
| Mobil ilova | yo'q | **36 696** qator (Flutter, 150 fayl) |
| Umumiy UI paketi | 7 qator (1 tugma) | **3 135** qator (28 komponent) |
| Baza modellari | 70 model/enum, 20 migratsiya | 51 model/enum, **62** migratsiya |
| Testlar | **0** | **48** spec fayl + Playwright e2e |

---

## 3. Infratuzilma

| Servis | Mazetto | QueenFood | Izoh |
|---|---|---|---|
| PostgreSQL | ✅ | ✅ | |
| Redis | ⚠️ **ko'tarilgan, ishlatilmaydi** | ✅ kesh, throttle, geo | |
| RabbitMQ | ❌ | ✅ bildirishnoma navbati | |
| MinIO | ❌ | ✅ media saqlash | Mazetto: qo'lda nginx volume |
| OSRM | ❌ | ✅ marshrut optimizatsiyasi | Haversine fallback bilan |
| Tile server | ❌ | ✅ self-hosted xarita | |
| Uptime Kuma | ❌ | ✅ monitoring | |
| nginx | ✅ (faqat media) | ✅ to'liq reverse proxy | |

---

## 4. Qatlam-qatlam qiyoslash

### 4.1 Backend paketlari

| Imkoniyat | Mazetto | QueenFood |
|---|---|---|
| API hujjati | ❌ | `@nestjs/swagger` (prod'da o'chiq) |
| Rate limiting | ❌ (faqat qo'lda `Map`) | `@nestjs/throttler` + Redis storage |
| Xavfsizlik header'lari | ❌ | `helmet` |
| Rejalashtirilgan ishlar | ❌ | `@nestjs/schedule` — 5 ta cron |
| Parol hash | `bcryptjs` | `argon2` |
| Env validatsiya | ❌ ad-hoc `process.env` | `zod` sxema, boot'da |
| Xato kuzatuv | ❌ | `@sentry/node` |
| Navbat | ❌ | `amqplib` |
| Fayl saqlash | ❌ | `minio` |
| Sana/vaqt | qo'lda `Intl` | `luxon` |
| OTP | qo'lda | `otplib` |

### 4.2 Frontend paketlari

| Imkoniyat | Mazetto | QueenFood |
|---|---|---|
| Server state | ❌ har komponentda `useState`+`useEffect`+`fetch` | `@tanstack/react-query` + markazlashgan `query-keys.ts` |
| Client state | React Context | `zustand` (4 store) |
| Formalar | qo'lda | `react-hook-form` + `zod` |
| Ko'p tillilik | ❌ o'zbekcha JSX ichida | `next-intl` — uz / ru / en |
| Toast | o'z `ToastProvider` | `sonner` |
| Ikonkalar | 45 inline SVG | `lucide-react` |
| Xarita | ❌ | `leaflet` + `react-leaflet` |
| Xato kuzatuv | ❌ | `@sentry/nextjs` |

---

## 5. Modul inventari

QueenFood API'dagi 25 modul va Mazetto'dagi holati:

| QueenFood moduli | Mazetto ekvivalenti | Holat |
|---|---|---|
| `auth` | `auth` | ✅ ikkalasi ham yaxshi |
| `users`, `roles` | `users`, `roles`, `staff` | ✅ Mazetto kengroq |
| `audit` | `audit` | ✅ Mazetto kattaroq (79 vs 29 qator) |
| `orders` | `orders`, `customers` | ✅ |
| `payments` | `payments` | ✅ Mazetto POS uchun kuchliroq |
| `reports` | `reports` | ✅ |
| `menus` | `menu`, `products` | ✅ Mazetto kengroq (variant, modifier, bundle) |
| `kitchens` | `branches`, `kitchen` | ✅ |
| `health` | `health.controller.ts` | ✅ |
| **`settings`** | ❌ **umuman yo'q** | 🔴 katta bo'shliq |
| **`notifications`** | qisman (`telegram` ichida) | 🔴 katta bo'shliq |
| **`geocoding`** | ❌ | 🔴 C bloki |
| **`routing`** | ❌ | 🔴 B bloki |
| **`couriers`** | ❌ | 🔴 B bloki |
| **`locations`** | ❌ (manzil erkin matn) | 🔴 C bloki |
| **`uploads`** | ❌ | 🟠 media muammosi |
| **`tickets`** | ❌ | 🟠 mijoz qo'llab-quvvatlash |
| **`analytics`** | qisman (`dashboard`) | 🟠 |
| **`system`** | ❌ | 🟡 super-admin monitoring |
| `capacity`, `production`, `scheduling`, `meal-slots`, `subscriptions` | — | ⚪ korporativ keytering uchun, restoranga kerak emas |

Mazetto'da bor, QueenFood'da yo'q: `inventory`, `recipes`, `suppliers`, `tables`, `shifts`, `cash-register`, `printers`, `receipts`, `homepage`. Bular POS/restoran domeni — Mazetto bu yerda kuchliroq.

---

## 6. O'zlashtirishga arziydigan kuchli jihatlar

Har biri QueenFood kodidagi **o'z izohi** bilan — nima uchun shunday qilinganini asl manba yaxshiroq tushuntiradi.

### 6.1 Sozlamalar reestri ★★★

`apps/api/src/modules/settings/setting-rules.ts` (199 qator)

Har bir biznes konstantasi bazada, **yozishda validatsiya qilinadi va normallashtiriladi**:

```
min_order_quantity: INT(0, 1000)
trust_threshold: INT(0, 1000)
auto_confirm_orders: BOOL
qr_payment_payer_types: { kind: 'csv-enum', values: ['INDIVIDUAL','LEGAL_ENTITY'] }
delivery_fee_tiers: { kind: 'delivery-tiers-json' }
```

Kod izohidagi sabab (audit 2026-07-18):

> Sozlamalar server darvozalarini boshqaradi va ular saqlangan satrga ko'r-ko'rona ishonardi: xato yozilgan boolean (`"True"` → FALSE deb o'qiladi), raqam bo'lmagan int (jimgina hard-coded default'ga tushadi, UI esa axlatni joriy qiymat deb ko'rsatadi) — hammasi checkout'ni **hech qanday xabarsiz** buzardi.

Ikkinchi nozik qaror — **o'qish kalitlari ham ro'yxatdan olinadi**:

> Bu avval faqat YOZISHDA tekshirilardi; o'quvchi istalgan satrni so'rashi mumkin edi va xato yozilgan kalit abadiy hard-coded fallback qaytarardi. Bu kill switch'lar uchun eng yomoni: `qr_payments_enabled` va `auto_confirm_orders` default'i TRUE, ya'ni xato yozilgan kalit biznes **o'chirdim deb o'ylagan** funksiyani jimgina ishlatib turadi.

`SettingKey` tipi reestrdan **hosil qilinadi** — bitta ro'yxat, ikkitasi emas.

**Mazetto'dagi holat:** `Setting` jadvali **umuman yo'q**. 17 ta biznes konstantasi kodda qattiq yozilgan (`CUSTOMER_CODE_TTL_MS`, `LOGIN_THROTTLE_*`, `CUSTOMER_ORDER_ATTEMPT_TTL_MS`, ...). Har o'zgarish = redeploy. Bundan tashqari `CUSTOMER_CODE_TTL_MS` va `CUSTOMER_CODE_REQUEST_LIMIT` **ikki faylda takrorlangan** (`customers.service.ts` va `telegram-customer-auth.service.ts`) — drift xavfi.

### 6.2 Bildirishnoma quvuri ★★★

`apps/api/src/modules/notifications/` (3 025 qator)

```
Domen hodisasi  →  EventPublisher  →  RabbitMQ  →  kanal worker  →  adapter
                                                    ├── IN_APP
                                                    ├── TELEGRAM
                                                    ├── SMS
                                                    ├── EMAIL
                                                    └── PUSH
```

Kuchli tomonlari:

- `messageId` (UUID) — **idempotency kaliti**, takroriy yuborishni to'xtatadi
- `RecipientResolverService` — kimga yuborishni alohida hal qiladi
- `NotificationPreference` + `DeviceToken` modellari
- Shablonlar bir joyda (703 qator) va **retsipiyent tilida** render qilinadi (`User.language`)
- Bitta nozik qaror: `staffAudience` bayrog'i — bir xil enum hodisa, lekin xodimga "yangi buyurtma keldi", mijozga "buyurtmangiz qabul qilindi" matni. Sof ko'rinish farqi uchun enum migratsiyasi qilinmagan.

**Mazetto'dagi holat:** Telegram xabari to'g'ridan-to'g'ri buyurtma servisida (`telegram-order-notification.service.ts`, 750 qator). Navbat yo'q, retry yo'q, boshqa kanal yo'q. Telegram tushsa — xabar butunlay yo'qoladi.

### 6.3 Rejalashtirilgan tozalash ishlari ★★★

`@nestjs/schedule` bilan 5 ta cron:

| Ish | Davr | Nima qiladi |
|---|---|---|
| `cleanupExpiredRefreshTokens` | har kuni 03:00 | eskirgan tokenlarni o'chiradi |
| `expireStalePendingOrders` | har 10 daqiqa | to'lov kutayotgan buyurtmalarni bo'shatadi |
| `production` | har soat | ishlab chiqarish rejasini yangilaydi |
| `subscriptions` × 2 | 18:00, 21:00 | obuna takrorlarini yaratadi |

`expireStalePendingOrders` dagi izoh — bu sinfdagi ishlarning eng nozik jihati:

> **FAQAT** onlayn-prepay buyurtmalar tozalanadi. `BANK_TRANSFER` tozalanmasligi kerak: u dizayn bo'yicha operator tasdiqlaguncha PENDING turadi — aks holda invoys buyurtmalari TTL'dan keyin **jimgina o'z-o'zini bekor qilardi** (2026-07-10 da topilgan bug).

**Mazetto'dagi holat:** **birorta ham** rejalashtirilgan ish yo'q — `setInterval` ham, `@Cron` ham, `ScheduleModule` ham. Sxemada `expiresAt` indekslari **mavjud** (kimdir tozalashni ko'zda tutgan), lekin tozalovchi yo'q:

| Jadval | `expiresAt` indeksi | Tozalanadi |
|---|---|---|
| `Session` | `schema.prisma:485` | ❌ hech qachon |
| `CustomerSession` | `schema.prisma:324` | ❌ hech qachon |
| `CustomerVerificationChallenge` | `schema.prisma:307` | ❌ hech qachon |
| `TelegramCheckoutSession` | `schema.prisma:288` | ❌ hech qachon |

Har OTP so'rovi doimiy qator qoldiradi.

### 6.4 Provayder abstraksiyasi (marshrut) ★★★

`apps/api/src/modules/routing/providers/routing-provider.interface.ts`

```ts
interface RoutingProvider {
  getDistanceMatrix(points: GeoPoint[]): Promise<DistanceMatrix>;
  getRoute(orderedPoints: GeoPoint[]): Promise<RouteResult>;
}
```

Ikki implementatsiya: `OsrmProvider` (99 qator) va `HaversineFallbackProvider` (59 qator).

**Mazetto uchun eng muhim xulosa:** kuryer marshrutini **OSRM konteynerisiz** boshlash mumkin. Haversine + o'rtacha tezlik yetarli darajada ishlaydi; OSRM keyin, interfeysni buzmasdan qo'shiladi.

### 6.5 Geokodlash proxy ★★★

`apps/api/src/modules/geocoding/geocoding.service.ts` — [`MAZETTO_PHASE_6_PLAN.md`](./MAZETTO_PHASE_6_PLAN.md) C2 bo'limida to'liq yozilgan.

### 6.6 Env validatsiya (zod, boot'da) ★★

`apps/api/src/config/env.validation.ts` (240 qator)

Nozik nuqta izohdan:

> Env boolean uchun **hech qachon** `z.coerce.boolean()` ishlatmang: u `Boolean(input)` chaqiradi, ya'ni `"false"` satri `true` ga aylanadi — bayroqni env fayli orqali **umuman o'chirib bo'lmaydi**.

**Mazetto'dagi holat:** env qiymatlari tarqoq o'qiladi (`auth.config.ts`, `main.ts`, `lib/auth.ts`), sxema yo'q. Ishga tushish paytida noto'g'ri konfiguratsiya aniqlanmaydi.

### 6.7 Frontend ma'lumot qatlami ★★

```
hooks/*.hooks.ts   — 33 fayl, domen bo'yicha react-query hook'lari
lib/query-keys.ts  — markazlashgan kesh kalitlari
lib/api.ts         — bitta axios qatlami
store/*.store.ts   — zustand: auth, cart, checkout, drafts
```

**Mazetto'dagi holat:** har komponent o'zi `useState` + `useEffect` + `apiFetch` yozadi. Kesh yo'q, invalidatsiya yo'q, "yuklanmoqda / xato / bo'sh" holatlari har joyda qaytadan yoziladi.

### 6.8 Umumiy UI paketi ★★

28 komponent: `dashboard-shell`, `data-table`, `stat-card`, `status-chip`, `page-header`, `states` (empty/error), `chart-cards`, `countdown-timer` + 16 ta shadcn primitivi.

**Mazetto'dagi holat:** `packages/ui` — **1 ta tugma, 7 qator**, hech qayerda import qilinmagan. Ekvivalent komponentlar `apps/pos-web/components/admin-ui/` da yashaydi va `customer-web` ular bilan bo'lisha olmaydi.

### 6.9 Ko'p tillilik ★★

`next-intl`, `messages/{uz,ru,en}.json`. Nav yorliqlari i18n kalitlari (`NAV_CONFIG` da `label: 'orders'`), tarjima layout'da hal qilinadi.

Domen tarjimalari alohida: `dish-i18n.ts`, `slot-i18n.ts`, `status-i18n.ts`, `role-labels.ts`.

**Mazetto'dagi holat:** o'zbekcha matn JSX ichida qattiq yozilgan. Rus tilidagi mijozlar — Toshkentda katta segment — qo'llab-quvvatlanmaydi.

### 6.10 Media yuklash ★★

`apps/api/src/modules/uploads/minio.service.ts` — MIME bo'yicha kengaytma, `ParseFilePipe` validatsiyasi, UUID nom, public URL.

**Mazetto'dagi holat:** admin mahsulot muharririda rasm maydoni — **oddiy matn** (`admin-product-editor.tsx:171`), admin yo'lni qo'lda yozadi. Fayl serverga qo'lda joylashtiriladi. AUD-009 ("ishlab chiqarish media volume'i bo'sh") aynan shundan kelib chiqqan.

### 6.11 API hujjati ★

`@nestjs/swagger`, `/api/v1/docs`, **ishlab chiqarishda o'chiq**. Har endpointda `@ApiOperation` / `@ApiOkResponse`.

Yon foyda: `docs/admin-redesign/03-current-state/BACKEND_API_INVENTORY.md` (115 endpoint) Mazetto'da **qo'lda** generatsiya qilingan — Swagger buni bepul beradi.

### 6.12 Kuzatuv ★

Sentry (API va web), Uptime Kuma, `/system/health-metrics` (faqat SUPER_ADMIN).

### 6.13 Amaliyot vositalari ★

`Makefile` — 21 ta maqsad: `verify`, `up`, `down`, `migrate`, `backup-db`, `restore-db`, `health`, `logs-api`, `shell-db`.

**Mazetto'dagi holat:** [`MAZETTO_RELEASE_READINESS_CHECKLIST.md`](./MAZETTO_RELEASE_READINESS_CHECKLIST.md) da 11 bosqichli reliz tartibi **yozma** ravishda bor, lekin skript sifatida emas — har safar qo'lda bajariladi.

---

## 7. Mazetto qayerda kuchliroq

Bu bir tomonlama qiyoslash emas. Mazetto quyidagilarda ustun:

| Soha | Izoh |
|---|---|
| **TypeScript qat'iyligi** | `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes` + `no-explicit-any: error`. QueenFood'da bular yo'q. |
| **POS/restoran domeni** | Kassa, smena, stol, ofitsiant, oshxona ekrani, chek, printer — QueenFood'da umuman yo'q. |
| **Ombor va retsept** | `Ingredient`, `Stock`, `StockMovement`, `Recipe` + idempotent zaxira yechish. |
| **Mahsulot modeli** | Variant, modifier, bundle, filialga xos mavjudlik, narx tarixi. |
| **To'lov idempotentligi** | `PaymentOperation` + `requestHash` + `Serializable` izolyatsiya + `FOR UPDATE` qatorli qulf. |
| **Hujjatlashtirish** | 7 500 qator: audit, ish holati, reliz checklist, dizayn qulfi. QueenFood'da ham ko'p, lekin Mazetto'niki tizimliroq. |
| **Reliz intizomi** | Har reliz backup + rollback tegi + smoke natijasi bilan yozib boriladi. |

---

## 8. O'zlashtirilmaydigan narsalar

| QueenFood xususiyati | Nega Mazetto'ga kerak emas |
|---|---|
| `meal-slots`, `capacity`, `production`, `scheduling` | Korporativ keytering: oldindan buyurtma, slot, ishlab chiqarish rejasi. Restoranda buyurtma darhol tayyorlanadi. |
| `subscriptions` | Ofis obunasi modeli. |
| `LEGAL_ENTITY` to'lovchi turi va invoys oqimi | Restoran mijozi jismoniy shaxs. |
| RabbitMQ (birinchi bosqichda) | 5 ta kanal uchun oqlanadi; Mazetto'da 2 kanal bor — Redis navbati yetarli boshlanishiga. |
| OSRM konteyner (birinchi bosqichda) | Haversine fallback bilan boshlanadi. |
| Flutter mobil ilova | Alohida katta loyiha; hozirgi qamrovdan tashqarida. |
| `argon2` ga o'tish | `bcryptjs` xavfsiz; migratsiya narxi foydadan yuqori. |

---

## 9. Xulosa — prioritetlangan o'zlashtirish ro'yxati

| # | Kuchli jihat | Ta'sir | Mehnat | Reja bloki |
|---|---|---|---|---|
| 1 | Rejalashtirilgan tozalash ishlari | yuqori | past | Q2 |
| 2 | Sozlamalar reestri | yuqori | o'rta | Q1 |
| 3 | Env validatsiya (zod) | o'rta | past | Q3 |
| 4 | Geokodlash proxy + Toshkent chegarasi | yuqori | o'rta | [PHASE 6 C](./MAZETTO_PHASE_6_PLAN.md) |
| 5 | Marshrut provayder abstraksiyasi | yuqori | o'rta | [PHASE 6 B](./MAZETTO_PHASE_6_PLAN.md) |
| 6 | Media yuklash (MinIO) | yuqori | o'rta | Q4 |
| 7 | Frontend ma'lumot qatlami (react-query) | o'rta | yuqori | Q5 |
| 8 | Bildirishnoma quvuri | o'rta | yuqori | Q6 |
| 9 | Umumiy UI paketi | o'rta | yuqori | Q7 |
| 10 | Ko'p tillilik (uz/ru) | o'rta | yuqori | Q8 |
| 11 | Swagger + kuzatuv | past | past | Q3 |
| 12 | Makefile / amaliyot skriptlari | past | past | Q3 |

To'liq reja: [`MAZETTO_PHASE_7_PLAN.md`](./MAZETTO_PHASE_7_PLAN.md)
Bajarilish tartibi: [`MAZETTO_ROADMAP_MASTER.md`](./MAZETTO_ROADMAP_MASTER.md)
