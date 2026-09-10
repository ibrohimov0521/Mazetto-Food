# MAZETTO FOOD — Seans hisoboti, 2026-09-10

Branch: `admin-redesign-phase-5` · HEAD `dc9be95`
Boshlang'ich HEAD: `f7168ff`
Bajarilgan: 13 commit · 163 fayl · +7 410 / −1 117 qator

---

## ⚠ AVVAL O'QING: branch ajralgan

Seans oxirida `git fetch` qilinganda **`origin/main` boshqa joyda ekani aniqlandi**:

```
main / admin-redesign-phase-5   dc9be95   13 commit oldinda
origin/main                     0336c9a   41 commit oldinda
```

Men ishlagan vaqtda Javohir `origin/main` ga **41 commit** push qilgan. Ikki tomon
bir vaqtda, bir-biridan xabarsiz, **bir xil muammolarni** yechgan.

**Hech narsa yo'qolmagan.** 13 commit `admin-redesign-phase-5` branchida turibdi.
`main` lokal ravishda o'sha nuqtaga surilgan, lekin **push qilinmagan**.

### Mening xatom

Merge'dan oldin `git fetch` qilmadim. Lokal `origin/main` ma'lumoti eskirgan edi,
shuning uchun "toza fast-forward" degan xulosam noto'g'ri chiqdi. Push
bosqichida `fetch` qilib, buni to'xtatdim.

### Ustma-ust tushgan ishlar

| `origin/main` dagi commit | Mening ishim |
|---|---|
| `0d1564f` Redis auth cache va load test | **H8** — permission keshi |
| `580c159` CI checks va backend hardening | **1-to'lqin** |
| `5357871` Safe defaults for backend list sizes | **H10** — `listCustomerOrders` chegarasi |
| `fdac83a` Compact and unify admin panel shell | **2-to'lqin** — qobiq refaktori |
| `bebc8e0` Redesign courier, kitchen, cashier workspaces | **B bloki** — kuryer |
| `1dcb81f` Remove unused shared package placeholders | `packages/*` **o'chirilgan** — C1 rejam ularga tayanardi |
| `e2cef14` Print agent polling skeleton | **H11** — chop etish zanjiri |
| `4fbf198` Exclude source media from Docker builds | **H12c** — repo hajmi |

Bu avtomatik hal bo'ladigan narsa emas: sakkiz nuqtada ikkita mustaqil yechim bor
va qaysi biri saqlanishi **qaror** talab qiladi.

### Tavsiya etilgan tartib

1. Lokal `main` ni `origin/main` ga qaytarish (13 commit branchda qoladi).
2. `origin/main` ni branchga merge qilib, sakkiz to'qnashuvni birma-bir ko'rib chiqish.
3. Yoki branchni alohida PR sifatida push qilish (`admin-redesign-phase-5`) va
   Javohir bilan birga ko'rib chiqish.

---

## 1. Seans nima bilan boshlandi

Siz uch narsani so'radingiz:

1. Loyihani tahlil qilish.
2. Admin panelda **chapdagi menyu yo'qolib ketishi** — asosiy shikoyat.
3. QueenFood (`CorpEats`) kod bazasi bilan qiyoslash va undan kuchli jihatlarni
   o'zlashtirish.

---

## 2. Hujjatlar (commit `9eb02ca`, `c2de52c`)

Kod yozishdan oldin to'rtta hujjat tuzildi:

| Hujjat | Mazmuni |
|---|---|
| `MAZETTO_PHASE_6_PLAN.md` | Qobiq diagnozi (A–D bloklari) + backend topilmalari (H1–H12) |
| `MAZETTO_QUEENFOOD_COMPARISON.md` | To'liq qiyosiy tahlil, 25 modul inventari |
| `MAZETTO_PHASE_7_PLAN.md` | QueenFood'dan o'zlashtirish rejasi (Q1–Q8) |
| `MAZETTO_ROADMAP_MASTER.md` | Barcha rejalarni 6 to'lqinga joylashtirish |

Barcha `fayl:satr` havolalari kodda tekshirildi; oltitasi noto'g'ri chiqib
tuzatildi.

---

## 3. Sizning bug'ingiz: sidebar nega yo'qolardi

### Ildiz sabab

`AdminLayout` **Next layout emas edi** — oddiy komponent bo'lib, 31 sahifaning
har birida qo'lda chaqirilardi, guardlar esa undan **tashqarida** turardi.

Uch oqibati bor edi:

1. Guard qaror qabul qilayotgan paytda **hech narsa** sidebar'ni render qilmasdi.
2. Har navigatsiyada butun daraxt unmount/remount bo'lardi.
3. Rad etilganda foydalanuvchi qobiqsiz `/access-denied` ga uchardi.

### Aniq ayb: topbar yorliqlari

`admin-navbar.tsx:208` da beshta yorliq bor edi. Uchtasi — **Kassa, Oshxona,
Smena** — qobiq **umuman yo'q** sahifalarga ishora qilardi va oddiy `<a>` tegi
bilan render qilinardi, ya'ni **to'liq sahifa qayta yuklanishi**.

Owner "Kassa" ni bosardi → sidebar butunlay yo'qolardi → qaytish uchun faqat
brauzerning "orqaga" tugmasi qolardi.

### Yechim (commit `81681ad`, `8abc680`)

| Nima qilindi | Nega |
|---|---|
| Uch yorliq yangi tabda ochiladi | Kassa va oshxona — to'liq ekran ish joylari; admin sessiyasi buzilmasin |
| Qolgan ikkitasi `next/link` ga o'tdi | Ular ham `<a>` edi, ya'ni admin ichida yurish har safar butun ilovani qayta yuklardi |
| `app/(shell)/layout.tsx` — route group | Next hujjati: layoutlar navigatsiyada **qayta render qilinmaydi**. Aynan shu sidebar'ni joyida ushlaydi |
| Guardlar `lib/route-access.ts` ga | 31 sahifadagi takror o'rniga bitta matritsa |
| Rad etish qobiq ichida | Sidebar qoladi; ilgari yagona tugma **tizimdan chiqarardi** |
| Skeleton | Ilgari qattiq yangilashda butunlay oq sahifa edi |
| Rol uy sahifalari menyuga | BRANCH_MANAGER va ACCOUNTANT o'z bosh sahifasiga **qaytolmasdi** |

**42/42 URL o'zgarmadi** — route group qavs ichida bo'lgani uchun URL segmenti
hisoblanmaydi. Generatsiya qilingan route tiplaridan tekshirildi.

Matritsaga ko'chirish sahifalar bo'ylab tarqalgan bir narsani ochdi: `products`
va `staff` ostidagi **yozish** ekranlari ro'yxat ekranlaridan kuchliroq
permission talab qiladi (`MENU_CREATE`/`MENU_EDIT` vs `MENU_VIEW`).

### Brauzerda tasdiqlangan (commit `eb8ed0a`)

Eng muhim dalil: sidebar yig'ildi, keyin uchta sahifa bo'ylab yurildi (jumladan
to'liq sahifa yuklanishi bilan) — **yig'ilgan holat saqlanib qoldi**. Ilgari u
har o'tishda ochilib ketardi, chunki `AdminLayout` remount bo'lardi.

---

## 4. Backend qattiqlashtirish (commit `b835a20`)

Chuqur tekshiruvda topilgan va tuzatilgan nuqsonlar:

### Login cheklovi ishlamasdi

`X-Forwarded-For` va `cf-connecting-ip` **shartsiz** o'qilardi. Ikkalasi ham
oddiy so'rov header'i — har so'rovda tasodifiy qiymat yuborish **har safar yangi,
bo'sh bucket** berardi. Manzil bo'yicha 5 urinishlik chegara amalda yo'q edi.

Endi `TRUSTED_PROXY_HOP_COUNT` e'lon qilinmaguncha hech qanday header'ga
ishonilmaydi, va zanjirdagi mijoz manzili **oxirgi N yozuvdan oldingisi**
sifatida olinadi — eng chap qismidan emas, chunki uni mijoz yozadi.

### Cheklov jadvali cheksiz o'sardi

Kalitning bir qismi login identifikatori, ya'ni uni **so'rov yuboruvchi
tanlaydi**. Tozalash faqat **aynan o'sha kalit** qayta so'ralganda ishlardi,
hujumchi esa hech qachon takrorlamaydi. Backendda davriy ish ham yo'q edi.

### Chek raqami to'qnashuvi

`RCPT-{sana}-{rand}` — fazo **kuniga** 900 000 qiymat, soniyada emas. Kunlik
500 chekda to'qnashuv ehtimoli **~13%**.

To'qnashuv **butun to'lov tranzaksiyasini** bekor qilardi. Va `catch` bloki har
qanday P2002 ni "idempotency kaliti" deb talqin qilardi, ya'ni kassir
*"Payment operation could not be resolved"* xatosini ko'rardi — sabab bilan
hech qanday aloqasi yo'q xabar.

Ikkita alohida nuqson: retry yo'qligi **va** P2002 ning constraint bo'yicha
ajratilmaganligi.

### Boshqalar

| Nuqson | Tuzatish |
|---|---|
| `shiftNumber` — `MAX+1` poygasi, ikki kassir 500 olardi | filialga bog'langan advisory lock |
| `listCustomerOrders` — `take` yo'q, butun tarix tortilardi | mavjud sahifalash DTO'si |
| CORS ikki faylda bayt-baytiga takror | `CORS_ORIGIN` env, `*` rad etiladi |
| helmet, rate limit yo'q | ikkalasi ham qo'shildi |

### 26 QA skripti tip tekshiruvidan tashqarida edi

`rootDir: "src"` bo'lgani uchun alohida `tsconfig.scripts.json` kerak bo'ldi.
Qamrovga kiritilishi bilan **31 xato** ochildi — aynan bashorat qilingan drift.
Eng muhimi: bir validator `CustomersService` ni **oltitadan beshta** bog'liqlik
bilan qurayotgan ekan, oxirgisi jimgina `undefined` bo'lib kelardi.

> Bu qamrov keyin **to'rt marta** o'zini oqladi: seansdagi har konstruktor
> o'zgarishini darhol ushladi.

---

## 5. Poydevor (commit `b2757d0`, `46accb1`, `1ce0ee2`, `ba1a2a5`)

### Backend `.env` ni umuman o'qimasdi

Dev'da Prisma *"DATABASE_URL is required"* derdi — bu **alomat**, sabab emas.
Node'ning o'z `loadEnvFile` i bilan tuzatildi (dotenv kerak emas). O'sha muammo
**12 skriptda** ham bor ekan; `validate-order-display-numbers` **shu sababdan**
yiqilayotgan ekan, tekshirayotgan narsasidan emas. Prisma konfiguratsiyasi ham
shunday edi.

Validatsiya zod bilan, boot paytida, **barcha muammoni birdan** ko'rsatadi.
`z.coerce.boolean()` ataylab ishlatilmadi: u `Boolean("false") === true` qiladi
va bayroqni env orqali **o'chirib bo'lmasdi** — kill switch uchun bu "biznes
o'chirdim deb o'ylagan funksiya jimgina ishlab turadi" degani.

### Redis boshidanoq compose'da bor edi, kodda ishlatilmasdi

Endi uch joyda: global rate limit, login cheklovi, sozlamalar keshi. Uchalasida
ham u **kesh sifatida** qaraladi — tushsa xizmat chegaralangan zaxiraga o'tadi,
so'rovlarni rad etmaydi. *Kassa kesh tufayli to'xtashi cheklovdan qimmatroq.*

### Rejalashtirilgan ish umuman yo'q edi

Sxemada **to'rtta `expiresAt` indeksi** bor — kimdir tozalashni ko'zda tutgan,
tozalovchi yozilmagan. Har OTP so'rovi doimiy qator qoldirardi.

Ikkita istisno o'z-o'zidan ko'rinmaydi:

- **Yaqinda bekor qilingan sessiya 30 kun saqlanadi.** `refresh` uni "token
  qayta ishlatilmoqda" signali deb o'qiydi; o'chirish o'g'irlangan tokenni
  oddiy "topilmadi" ga aylantirardi.
- **Tugallangan urinish yoshidan qat'i nazar saqlanadi.** U muvaffaqiyatli
  checkout'ning idempotentlik yozuvi — o'chirilsa o'sha kalit yangi buyurtma
  sifatida o'tardi, ya'ni **tozalash ishi dublikat buyurtma sababiga aylanardi**.

> QueenFood buni qimmat yo'l bilan o'rgangan: ularning tozalagichi
> `BANK_TRANSFER` to'lovlarini qamrab olgan va invoys buyurtmalari TTL'dan
> keyin **jimgina o'z-o'zini bekor qilgan**.

### Sozlamalar reestri

`Setting` jadvali **umuman yo'q edi** — 17 biznes konstantasi kodda. Uchtasi
**ikki faylda takrorlangan** edi.

QueenFood'ning ikki qoidasi ko'chirildi:

1. **Yozishda kanoniklashtirish.** `" TRUE "`, `"1"`, `"true"` → bitta qator.
2. **O'qish kalitlari ham reestrdan.** Aks holda xato yozilgan kalit abadiy
   default qaytaradi va admin panel qatorni to'g'ri ko'rsatadi — deyarli
   topib bo'lmaydigan nosozlik.

O'qish parserlari **ataylab yumshoq**: qator reestrdan oldin yozilgan bo'lishi
mumkin, buzuq qiymat default'ga tushadi, xizmatni qulatmaydi.

### Permission keshi

Guard har so'rovda to'rt jadvalli join qilardi, token esa rollarni allaqachon
olib yurardi — **ikkala narx ham** to'lanardi.

Token'ning **o'ziga** ishonish arzonroq, lekin noto'g'ri yechim: u 15 daqiqa
yashaydi va bekor qilib bo'lmaydi, ya'ni 30 soniyalik emas, **15 daqiqalik ko'r
nuqta**. Sinov: xodimni bloklash tokenni **darhol** 401 qildi.

---

## 6. Ekranlar va vositalar (commit `17fb713`, `216de00`, `dc9be95`)

### Swagger + amaliyot skriptlari

104 endpoint hujjatlashtirildi, bayroqsiz o'chiq. `@nestjs/swagger@12`
NestJS 12 uchun ekan va boot'da qulardi — 11 ga tushirildi. U `@scarf/scarf`
telemetriya paketini tortib keladi; u **ataylab rad etildi**, tasdiqlanmadi.

Reliz checklist'ining eng zerikarli, lekin eng muhim qadami endi skript:
`pnpm db:backup` nusxa oladi **va** `pg_restore --list` bilan o'qib ko'radi.
*O'qib bo'lmaydigan dump — backup emas, va buni tiklash kerak bo'lgan kunda
bilish juda kech.*

Makefile o'rniga Node skriptlari — bu mashinada `make` yo'q, tekshirilmagan
fayl qoldirmoqchi emasdim.

### Sozlamalar ekrani

Boshqaruv elementlari **qoidadan** chiziladi, kalit nomidan emas. Ekran qaysi
sozlamalar borligini bilmaydi — reestrga yangi kalit qo'shilsa o'z-o'zidan
paydo bo'ladi. Shakllarni frontendda qaytadan e'lon qilish reestr yechayotgan
drift muammosini qaytarardi.

### Media yuklash (MinIO)

Rasm maydoni **oddiy matn** edi: admin yo'lni qo'lda yozardi, faylni serverga
alohida joylashtirardi. Ikki qadam uzilgani uchun qator bazada bo'lib, fayl
serverga chiqmasligi mumkin edi — **AUD-009 aynan shu**.

Xavfsizlik chegaralari:

| Himoya | Nega |
|---|---|
| Fayl nomi **UUID** dan | asl nom obyekt ustiga yozishi, yo'l belgilarini olib kirishi mumkin |
| Kengaytma **tekshirilgan MIME** dan | nomga ishonib bo'lmaydi |
| MIME **aniq ro'yxat** | `image/*` SVG'ni o'tkazardi, u skript olib yuradi |
| Hajm **ikki joyda** | interceptor oqimni to'xtatadi, validator o'tganini rad etadi |
| Papka **oq ro'yxat** | `../` bucket ichida boshqa joyga yozardi |

---

## 7. Tekshiruv holati

| | Natija |
|---|---|
| Build | 9/9 |
| Typecheck + lint | 21/21 |
| Validatorlar | **18/18** (bazasiz) · 29 ta jami |
| Brauzer QA | 2-to'lqin, sozlamalar ekrani, media zonasi |
| Deploy | ❌ **qilinmagan** |

Yangi validatorlar: `validate-env-config`, `validate-media-uploads`,
`validate-maintenance-cleanup-db`, `validate-settings-registry-db`.

---

## 8. Muhit haqida topilganlar

Keyingi seans uchun:

- **Backend `.env` ni o'zi yuklaydi** (endi). Ilgari qo'lda eksport kerak edi.
- **Portlar band:** Postgres 5433, Redis 6380, MinIO 9002/9003 — 5432, 6379,
  9000/9001 ni boshqa loyihalar egallagan.
- **`NEXT_PUBLIC_MEDIA_URL` 8080 ga ishora qiladi**, lekin 8080 ni
  `corpeats-tiles` egallagan.
- **Seed filial ham, foydalanuvchi ham yaratmaydi.**
- **To'liq parallel `turbo build` xotirani tugatadi** dev serverlar va Chrome
  ochiq holda. `--concurrency=1` bilan o'tadi.
- **Eskirgan `nest` jarayoni** portni ushlab turib ikki marta chalg'itdi —
  4000-portni port bo'yicha tekshirish kerak.
- **`node --import tsx`** ishlatiladi, `pnpm exec` emas: Windows'da `pnpm` bu
  `.cmd` va Node uni `shell: true` siz ishga tushirmaydi (CVE-2024-27980).

### QA hisoblari

Mavjud `admin@mazetto.local` **tegilmadi** — paroli `.env` da yo'q va
`bootstrapSuperAdmin` hash'ni qayta yozadi.

| Hisob | Rol | Parol |
|---|---|---|
| `qa@mazetto.local` | SUPER_ADMIN | `QaShell#2026` |
| `qa-acc@mazetto.local` | ACCOUNTANT | `QaShell#2026` |

---

## 9. Qolgan bosqichlar

### Darhol: ajralishni hal qilish

Yuqoridagi ⚠ bo'limga qarang. Sakkiz nuqtada ikki tomonning yechimi bor.

### 4-to'lqin — karta va checkout

| # | Ish | Bog'liqlik |
|---|---|---|
| 4.1 | `TASHKENT_BOUNDS` yagona manba | ⚠ `packages/*` `origin/main` da **o'chirilgan** — joy qayta tanlanishi kerak |
| 4.2 | Geokodlash proxy (Redis kesh, fail-open) | Redis ✅ |
| 4.3 | Tile provider + karta komponenti | qaror kerak |
| 4.4 | Mijoz manzili: koordinata maydonlari | 4.1 |
| 4.5 | Yetkazish narxi (pog'onali, sozlamadan) | `Setting` ✅ |
| 4.6 | Checkout 2 qadamga + stepper | — |
| 4.7 | To'lov usullari ekrani (qulf/badge) | `Setting` ✅ |
| 4.8 | Telefon normalizatsiyasi, vaqt chiplari, Toshkent sanasi | — |

### 5-to'lqin — kuryer

⚠ `origin/main` da `bebc8e0 Redesign courier, kitchen, cashier workspaces`
bor. Bu blok **qaytadan ko'rib chiqilishi** kerak — ehtimol allaqachon
bajarilgan.

### 6-to'lqin — katta refaktorlar

| # | Ish |
|---|---|
| 6.1 | react-query + `query-keys` |
| 6.2 | `@mazetto/api-client` — ⚠ `origin/main` da o'chirilgan |
| 6.3 | Umumiy UI paketi — ⚠ ayni holat |
| 6.4 | Bildirishnoma quvuri (Redis navbati) |
| 6.5 | Ko'p tillilik (uz / ru) |
| 6.6 | Yirik fayllarni bo'lish (2003 va 1216 qator) |
| 6.7 | Repo hajmi — ⚠ `4fbf198` qisman qilgan |

### Hali ochiq topilmalar

| # | Ish |
|---|---|
| H11 | Chop etish zanjiri — ⚠ `e2cef14` skeleton qo'shgan |
| — | `orderNumber` retry (risk past, fazo soniyada) |
| — | Telegram bot alohida app sifatida (mantiq backendda, 2003 qator) |
| — | Rus tili mahsulot nomlari uchun baza qarori |

---

## 10. Ochiq qarorlar

| # | Savol | Ta'sir |
|---|---|---|
| 1 | Ajralish qanday hal qilinadi — merge, PR yoki qayta ko'rib chiqish? | hammasi |
| 2 | `TASHKENT_BOUNDS` qayerda yashaydi (`packages/*` o'chirilgan)? | 4.1 |
| 3 | Tile provider — OSM public yoki self-hosted? | 4.3 |
| 4 | Yetkazish narxi — porsiya pog'onasi yoki masofa? | 4.5 |
| 5 | Kuryer bloki qayta kerakmi (`bebc8e0` dan keyin)? | 5-to'lqin |
| 6 | Bildirishnoma navbati — Redis yoki RabbitMQ? | 6.4 |
| 7 | `NEXT_PUBLIC_MEDIA_URL` port to'qnashuvi | lokal QA |

---

## 11. Ishlab chiqarishga chiqarishdan oldin

Bu 13 commit **deploy qilinmagan**. Chiqarish uchun:

- **Baza migratsiyasi:** `20260910120000_business_settings`
- **Yangi infratuzilma:** MinIO konteyneri
- **Yangi env qiymatlari:** `MINIO_*`, `REDIS_URL`,
  `TRUSTED_PROXY_HOP_COUNT=2` (Cloudflare → Traefik), ixtiyoriy `CORS_ORIGIN`

Bularsiz backend ishga tushadi, lekin rasm yuklash o'chiq qoladi va cheklovlar
xotiradagi zaxira yo'liga tushadi.

`MAZETTO_RELEASE_READINESS_CHECKLIST.md` deploy oldidan backup va uni
tekshirishni talab qiladi — buning uchun endi `pnpm db:backup` bor.
