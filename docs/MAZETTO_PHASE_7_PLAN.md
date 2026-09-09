# MAZETTO FOOD — 7-BOSQICH: QueenFood'dan funksional o'zlashtirish

Tuzilgan sana: 2026-09-10
Boshlang'ich HEAD: `f7168ff`
Asos: [`MAZETTO_QUEENFOOD_COMPARISON.md`](./MAZETTO_QUEENFOOD_COMPARISON.md) §6
Oldingi bosqich: [`MAZETTO_PHASE_6_PLAN.md`](./MAZETTO_PHASE_6_PLAN.md)
Bajarilish tartibi: [`MAZETTO_ROADMAP_MASTER.md`](./MAZETTO_ROADMAP_MASTER.md)

**Kod hali yozilmagan.** Bu reja.

---

## Bloklar xaritasi

| Blok | Nima | Mehnat | Bog'liqlik |
|---|---|---|---|
| **Q1** | Sozlamalar reestri | o'rta | — |
| **Q2** | Rejalashtirilgan tozalash ishlari | past | Q1 (ixtiyoriy) |
| **Q3** | Ishga tushirish sog'lig'i: env validatsiya, Swagger, Makefile | past | — |
| **Q4** | Media yuklash (MinIO) | o'rta | — |
| **Q5** | Frontend ma'lumot qatlami (react-query) | yuqori | — |
| **Q6** | Bildirishnoma quvuri | yuqori | Q1 |
| **Q7** | Umumiy UI paketi | yuqori | Q5 |
| **Q8** | Ko'p tillilik (uz / ru) | yuqori | Q7 |

> Q1–Q4 mustaqil va past xavfli — istalgan vaqtda bajarilishi mumkin.
> Q5–Q8 katta refaktor — [PHASE 6](./MAZETTO_PHASE_6_PLAN.md) A bloki tugagandan **keyin**.

---

## Q1 — Sozlamalar reestri

### Muammo

Mazetto'da `Setting` jadvali **umuman yo'q**. 17 ta biznes konstantasi kodda qattiq yozilgan; har o'zgarish redeploy talab qiladi.

Bundan tashqari uchta qiymat **ikki faylda takrorlangan**:

| Konstanta | Fayl 1 | Fayl 2 |
|---|---|---|
| `CUSTOMER_CODE_TTL_MS` | `customers.service.ts:54` | `telegram-customer-auth.service.ts:59` |
| `CUSTOMER_CODE_REQUEST_WINDOW_MS` | `customers.service.ts:56` | `telegram-customer-auth.service.ts:60` |
| `CUSTOMER_CODE_REQUEST_LIMIT` | `customers.service.ts:57` | `telegram-customer-auth.service.ts:61` |

Biri o'zgartirilsa ikkinchisi ortda qoladi — jimgina drift.

### Q1.1 — `Setting` modeli va reestri

QueenFood `setting-rules.ts` naqshi:

```
type SettingRule =
  | { kind: 'int'; min: number; max: number }
  | { kind: 'bool' }
  | { kind: 'csv-enum'; values: readonly string[] }
  | { kind: 'string' }
  | { kind: '<domen>-json' }
```

**Ikkita majburiy qoida** (QueenFood izohidan):

1. **Yozishda validatsiya va normallashtirish.** `"True"` boolean sifatida FALSE deb o'qiladi; raqam bo'lmagan int jimgina default'ga tushadi va UI axlatni joriy qiymat deb ko'rsatadi. Har ikkalasi ham hech qanday xabarsiz buzadi.
2. **O'qish kalitlari ham reestrdan.** Aks holda xato yozilgan kalit abadiy hard-coded fallback qaytaradi. Kill switch'lar uchun eng xavflisi: biznes "o'chirdim" deb o'ylagan funksiya jimgina ishlab turadi.

`SettingKey` tipi reestrdan **hosil qilinadi** — bitta ro'yxat, ikkitasi emas.

### Q1.2 — Ko'chiriladigan konstantalar

| Kalit | Hozirgi joyi | Qoida |
|---|---|---|
| `customer_code_ttl_minutes` | 2 faylda | `INT(1, 60)` |
| `customer_code_attempt_limit` | `customers.service.ts:55` | `INT(1, 20)` |
| `customer_code_request_limit` | 2 faylda | `INT(1, 20)` |
| `customer_code_request_window_seconds` | 2 faylda | `INT(10, 3600)` |
| `login_throttle_address_failures` | `auth.service.ts:37` | `INT(1, 100)` |
| `login_throttle_identifier_failures` | `auth.service.ts:38` | `INT(1, 200)` |
| `login_throttle_block_minutes` | `auth.service.ts:36` | `INT(1, 1440)` |
| `customer_order_attempt_ttl_hours` | `customer-order-engine.service.ts:52` | `INT(1, 168)` |
| `telegram_checkout_session_ttl_minutes` | `telegram-customer-ordering.service.ts:89` | `INT(5, 1440)` |
| `telegram_menu_page_size` | `telegram-customer-ordering.service.ts` | `INT(3, 20)` |
| `delivery_fee_tiers` | ❌ yo'q | `delivery-tiers-json` |
| `customer_payment_methods` | kodda `CASH` qattiq | `csv-enum` |
| `branch_accepting_orders` | filial jadvalida | — filialga xos, sozlamaga ko'chirilmaydi |

### Q1.3 — Admin ekrani

`/admin/settings` — mavjud qobiq ichida ([PHASE 6](./MAZETTO_PHASE_6_PLAN.md) A1 dan keyin). Permission: yangi `SETTING_MANAGE`, faqat `SUPER_ADMIN`.

Har kalit o'z qoidasidan kelib chiqib render qilinadi (int → number input, bool → toggle, csv-enum → chip group).

### Q1.4 — Public sozlamalar endpointi

QueenFood `public-settings.controller.ts` — mijoz tomoni serverdagi qiymatni **yagona manba** sifatida oladi. `delivery_fee_tiers` va `customer_payment_methods` shu yerdan.

Bu [PHASE 6](./MAZETTO_PHASE_6_PLAN.md) C7 va D8 uchun asos.

---

## Q2 — Rejalashtirilgan tozalash ishlari

### Muammo

Mazetto'da **birorta ham** rejalashtirilgan ish yo'q. Sxemada `expiresAt` indekslari mavjud — kimdir tozalashni ko'zda tutgan — lekin tozalovchi yozilmagan.

| Jadval | Indeks | Nima bo'ladi |
|---|---|---|
| `Session` | `schema.prisma:485` | eskirgan sessiyalar abadiy qoladi |
| `CustomerSession` | `schema.prisma:324` | ⟶ |
| `CustomerVerificationChallenge` | `schema.prisma:307` | **har OTP so'rovi doimiy qator qoldiradi** |
| `TelegramCheckoutSession` | `schema.prisma:288` | ⟶ |
| `CustomerOrderAttempt` | — | faqat qayta urinishda tozalanadi (AUD-004) |

### Q2.1 — `ScheduleModule` qo'shish

`@nestjs/schedule`. QueenFood `app.module.ts:59` da `ScheduleModule.forRoot()`.

### Q2.2 — Ishlar

| Ish | Davr | Nima |
|---|---|---|
| `cleanupExpiredSessions` | har kuni 03:00 | `Session` + `CustomerSession` — `expiresAt < now` yoki `revokedAt` eski |
| `cleanupExpiredChallenges` | har soat | `CustomerVerificationChallenge` — `expiresAt < now` |
| `cleanupExpiredCheckoutSessions` | har soat | `TelegramCheckoutSession` |
| `cleanupStaleOrderAttempts` | har 10 daqiqa | `CustomerOrderAttempt` — TTL o'tgan `PENDING` |
| `sweepLoginThrottle` | har 15 daqiqa | [PHASE 6 H2](./MAZETTO_PHASE_6_PLAN.md) — Redis'ga ko'chgach kerak emas |

### Q2.3 — Majburiy ehtiyot choralari

QueenFood `orders.scheduler.ts` dagi dars:

> **FAQAT** onlayn-prepay buyurtmalar tozalanadi. `BANK_TRANSFER` tozalanmaydi: u dizayn bo'yicha operator tasdiqlaguncha PENDING turadi — aks holda invoys buyurtmalari TTL'dan keyin **jimgina o'z-o'zini bekor qilardi**.

Mazetto'ga tarjimasi: **hech qanday tozalash ishi buyurtma, to'lov yoki chek qatoriga tegmasin.** Faqat sessiya/challenge/attempt kabi texnik qatorlar.

Har ish:
- `take: BATCH` bilan cheklangan (bir marta hammasini o'chirmaydi)
- `try/catch` ichida — muvaffaqiyatsizlik ilovani qulatmaydi
- o'chirilgan qator soni `> 0` bo'lsagina log yozadi

### Q2.4 — Sozlamadan boshqarish (Q1 dan keyin)

Har ishning TTL'i sozlamada bo'lsin, kodda emas.

---

## Q3 — Ishga tushirish sog'lig'i

Uchta kichik, mustaqil ish.

### Q3.1 — Env validatsiya (zod)

QueenFood `apps/api/src/config/env.validation.ts` (240 qator) — boot paytida sxema tekshiradi.

**Majburiy nozik nuqta** izohdan:

> Env boolean uchun **hech qachon** `z.coerce.boolean()` ishlatmang: u `Boolean(input)` chaqiradi, ya'ni `"false"` satri `true` ga aylanadi — bayroqni env fayli orqali umuman o'chirib bo'lmaydi.

Mazetto'da tekshirilishi kerak: `DATABASE_URL`, `JWT_*_SECRET` (prod'da majburiy — `auth.config.ts` da qisman bor), `TELEGRAM_*`, `NEXT_PUBLIC_API_BASE_URL`, `CORS_ORIGIN` (yangi — [PHASE 6 H12](./MAZETTO_PHASE_6_PLAN.md)).

### Q3.2 — Swagger

`@nestjs/swagger`, `/api/v1/docs`, **ishlab chiqarishda o'chiq** (QueenFood `main.ts:75` — `if (nodeEnv !== 'production')`).

Yon foyda: `docs/admin-redesign/03-current-state/BACKEND_API_INVENTORY.md` hozir qo'lda generatsiya qilingan — Swagger uni bepul beradi va eskirmaydi.

### Q3.3 — Makefile

QueenFood'dagi 21 maqsad ichidan Mazetto'ga tegishlilari:

```
verify      typecheck + lint + build + validator skriptlar
up / down   docker compose
migrate     prisma migrate deploy
backup-db   pg_dump + pg_restore --list bilan tekshirish
restore-db
health      backend / customer-web / pos-web / media
logs-*      servis loglari
```

`backup-db` ayniqsa muhim: [`MAZETTO_RELEASE_READINESS_CHECKLIST.md`](./MAZETTO_RELEASE_READINESS_CHECKLIST.md) 2-bosqichi buni **har reliz oldidan** talab qiladi va hozir qo'lda bajariladi.

---

## Q4 — Media yuklash

### Muammo

`apps/pos-web/components/admin/admin-product-editor.tsx:171` — mahsulot rasmi **oddiy matn maydoni**. Admin yo'lni qo'lda yozadi, fayl serverga qo'lda joylashtiriladi.

AUD-009 ("ishlab chiqarish media volume'i bo'sh") aynan shundan kelib chiqqan: rasm bazada yozilgan, lekin fayl hech qachon serverga chiqmagan.

### Q4.1 — Saqlash tanlovi

| Variant | Foyda | Zarar |
|---|---|---|
| **MinIO** (QueenFood) | S3 API, alohida servis, backup oson | +1 konteyner |
| Mavjud nginx volume + upload endpoint | infratuzilma o'zgarmaydi | backup/replikatsiya qo'lda |

> **Ochiq qaror.** Dokploy'da volume backup'i qanday qilinishiga bog'liq.

### Q4.2 — Upload endpointi

QueenFood `uploads.controller.ts` naqshi:

- `ParseFilePipe` — MIME va hajm bo'yicha rad etadi
- ruxsat etilgan MIME: `image/png|jpeg|webp|gif`
- UUID nom + MIME'dan kengaytma
- javob — public URL

Permission: `MENU_EDIT` (mahsulot rasmi), `HOMEPAGE_MANAGE` (banner).

### Q4.3 — Admin UI

Mahsulot muharririda matn maydoni o'rniga drag-drop zona (QueenFood `image-dropzone.tsx`). Eski URL maydoni qoladi — mavjud yo'llar buzilmasligi uchun.

### Q4.4 — Migratsiya

Mavjud `media-source/` va `apps/customer-web/public/menu-media/` fayllari bir marta saqlashga ko'chiriladi. Bu [PHASE 6 H12c](./MAZETTO_PHASE_6_PLAN.md) (repo 232 MB) ni ham hal qiladi — rasmlar git'dan chiqadi.

---

## Q5 — Frontend ma'lumot qatlami

### Muammo

Mazetto'da har komponent o'zi `useState` + `useEffect` + `apiFetch` yozadi. Natijasi:

- kesh yo'q — bir xil ma'lumot qayta-qayta so'raladi
- invalidatsiya yo'q — yozgandan keyin qo'lda `load()` chaqiriladi
- "yuklanmoqda / xato / bo'sh" holatlari 46 ta komponentda qaytadan yoziladi
- ikki `api.ts` (customer-web va pos-web) mantiqan bir xil ishni bajaradi (297 qator takror)

### Q5.1 — Kutubxona

`@tanstack/react-query` + markazlashgan `lib/query-keys.ts`.

### Q5.2 — Bosqichma-bosqich ko'chirish

Hammasi bir vaqtda emas. Tartib:

1. `query-keys.ts` + `QueryClientProvider` root layoutda
2. Bitta ekran namuna sifatida (`/admin/orders` — sahifalash allaqachon bor)
3. Qolgan admin ekranlari domen bo'yicha
4. `customer-web` oxirida

### Q5.3 — `@mazetto/api-client` ni tiriltirish

Ikki `api.ts` dagi umumiy qism (envelope, base URL, xato) umumiy paketga; token yangilash mantig'i (`pos-web/lib/api.ts:29`) pos-web'da qoladi, chunki u sessiya modeliga bog'liq.

Bu [PHASE 6 H9](./MAZETTO_PHASE_6_PLAN.md) ("`packages/*` o'lik") ni yopadi.

---

## Q6 — Bildirishnoma quvuri

### Muammo

Telegram xabari to'g'ridan-to'g'ri buyurtma servisida (`telegram-order-notification.service.ts`, 750 qator). Navbat yo'q, retry yo'q, boshqa kanal yo'q. Telegram tushsa — xabar butunlay yo'qoladi.

### Q6.1 — Soddalashtirilgan arxitektura

QueenFood to'liq quvuri 3 025 qator va RabbitMQ talab qiladi. Mazetto'ga **soddalashtirilgan** versiya:

```
Domen hodisasi  →  EventPublisher  →  Redis navbati  →  worker  →  adapter
                                                                   ├── TELEGRAM (mavjud)
                                                                   ├── IN_APP   (mavjud gateway)
                                                                   └── SMS      (keyinchalik)
```

RabbitMQ **kerak emas** — 2–3 kanal uchun Redis list yetarli. QueenFood'da 5 kanal bor, shuning uchun u yerda oqlanadi.

### Q6.2 — Ko'chiriladigan asosiy g'oyalar

| G'oya | Nima beradi |
|---|---|
| `messageId` (UUID) idempotency kaliti | takroriy yuborish to'xtaydi |
| Shablonlar bitta faylda | matn o'zgarishi kod o'zgarishi emas |
| `RecipientResolver` alohida | "kimga" mantig'i "nima" dan ajraladi |
| Retry + dead letter | Telegram tushganda xabar yo'qolmaydi |
| `staffAudience` bayrog'i | bir hodisa, ikki matn — xodimga va mijozga |

### Q6.3 — Mavjud kodni saqlash

`telegram-order-notification.service.ts` dagi xodim lifecycle mantig'i (AUD-020 tuzatishi: `NEW/CONFIRMED → PREPARING → READY` ketma-ketligi, xabarni joyida tahrirlash) **saqlanadi** — u adapter ostiga ko'chadi, qayta yozilmaydi.

---

## Q7 — Umumiy UI paketi

### Muammo

`packages/ui` — **1 ta tugma, 7 qator**, hech qayerda import qilinmagan. Haqiqiy komponentlar `apps/pos-web/components/admin-ui/` da (9 fayl) va `customer-web` ular bilan bo'lisha olmaydi.

### Q7.1 — Ko'chiriladigan komponentlar

`admin-ui/` dan umumiy paketga: `icon`, `data-table`, `pagination`, `tabs`, `chip-group`, `toggle`, `stat-box`, `feedback`, `toast`.

⚠️ **Ehtiyot:** `docs/design/MAZETTO_DESIGN_LOCK.md` va `MAZETTO_VISUAL_COMPONENT_CONTRACT.md` mavjud — ko'chirish vizual kontraktni buzmasligi kerak.

### Q7.2 — QueenFood'dan olinadigan naqsh

`packages/ui` `next/link` ga bog'lanmaydi — iste'molchi o'z router-aware link'ini **inyeksiya qiladi**:

```
LinkComponent={Link}   // default: oddiy <a>
```

Sabab izohda: `React.ComponentType` `forwardRef` komponentlarni (masalan `next/link`) strukturaviy rad etadi, shuning uchun tip **yalang'och chaqiruv imzosi** sifatida yozilgan.

Bu Mazetto uchun ham zarur — `packages/ui` `next` ga dependency bo'lmasligi kerak.

---

## Q8 — Ko'p tillilik

### Muammo

O'zbekcha matn JSX ichida qattiq yozilgan. Toshkentda rus tilidagi mijozlar katta segment — qo'llab-quvvatlanmaydi.

### Q8.1 — Qamrov

| Bosqich | Nima |
|---|---|
| Q8a | `customer-web` — uz + ru (mijozga ko'rinadigan hamma narsa) |
| Q8b | `pos-web` admin — uz (mavjud) + ru |
| Q8c | Telegram bot matnlari |
| Q8d | Backend xato xabarlari |

### Q8.2 — Naqsh

`next-intl`, `messages/{uz,ru}.json`. Nav yorliqlari i18n kalitlari bo'ladi, tarjima layout'da hal qilinadi (QueenFood `NAV_CONFIG` da `label: 'orders'`).

Domen tarjimalari alohida fayllarda: mahsulot nomi, status, rol nomi — QueenFood `dish-i18n.ts` / `status-i18n.ts` / `role-labels.ts` naqshi.

### Q8.3 — Ma'lumot tarjimasi

⚠️ Mahsulot nomlari **bazada**. Ularni tarjima qilish uchun `Product.nameRu` maydoni yoki alohida `ProductTranslation` jadvali kerak — bu **alohida qaror** va Q8 doirasidan tashqarida bo'lishi mumkin.

---

## Ochiq qarorlar

| # | Savol | Ta'sir qiladi |
|---|---|---|
| 1 | Media saqlash — MinIO yoki mavjud volume + upload endpoint? | Q4.1 |
| 2 | Bildirishnoma navbati — Redis yetadimi yoki RabbitMQ kerakmi? | Q6.1 |
| 3 | Ko'p tillilik qamrovi — faqat mijoz tomonimi yoki admin ham? | Q8.1 |
| 4 | Mahsulot nomlari tarjima qilinadimi (baza o'zgarishi)? | Q8.3 |
| 5 | `packages/ui` ga ko'chirish dizayn qulfini buzmaydimi? | Q7.1 |
| 6 | Sozlamalar ekrani uchun `SETTING_MANAGE` permission qo'shiladimi? | Q1.3 |

---

## O'zgarmas cheklovlar

- **Buyurtma / to'lov / chek qatorlariga hech qanday tozalash ishi tegmaydi** (Q2.3).
- **Swagger ishlab chiqarishda o'chiq** (Q3.2).
- **Mavjud Telegram lifecycle mantig'i qayta yozilmaydi**, faqat ko'chiriladi (Q6.3).
- **Vizual kontrakt buzilmaydi** — `docs/design/MAZETTO_DESIGN_LOCK.md` (Q7.1).
- **Ishlab chiqarish bazasiga destruktiv buyruq yo'q** — [`MAZETTO_RELEASE_READINESS_CHECKLIST.md`](./MAZETTO_RELEASE_READINESS_CHECKLIST.md).
- Q5–Q8 [PHASE 6](./MAZETTO_PHASE_6_PLAN.md) A bloki tugamaguncha **boshlanmaydi** — qobiq refaktori ular bilan to'qnashadi.
