# MAZETTO FOOD — Bosh yo'l xaritasi

Tuzilgan sana: 2026-09-10
Holat sanasi: HEAD `f7168ff`, branch `admin-redesign-phase-5` (`main` dan **34 commit oldinda**, deploy qilinmagan)

Bu hujjat barcha mavjud rejalarni **bitta bajarilish tartibiga** joylashtiradi.

---

## 1. Rejalar inventari

| Hujjat | Qamrov | Holat |
|---|---|---|
| [`admin-redesign/PLAN.md`](./admin-redesign/PLAN.md) | Admin panel 1–4-bosqich | ✅ 1–3 tugagan · 🟡 4 qisman |
| [`admin-redesign/PLAN-5-REDIZAYN.md`](./admin-redesign/PLAN-5-REDIZAYN.md) | Vizual redizayn + B1–B7 | ✅ kod tayyor · ✅ API QA · 🟡 brauzer QA qolgan · ⛔ deploy yo'q |
| [`MAZETTO_FULL_CODE_AUDIT.md`](./MAZETTO_FULL_CODE_AUDIT.md) | AUD-001…AUD-020 | 🟡 aksariyati yopilgan, AUD-005 va AUD-009 ochiq |
| [`MAZETTO_PHASE_6_PLAN.md`](./MAZETTO_PHASE_6_PLAN.md) | Qobiq (A–D) + qattiqlashtirish (H1–H12) | 📋 reja |
| [`MAZETTO_PHASE_7_PLAN.md`](./MAZETTO_PHASE_7_PLAN.md) | QueenFood'dan o'zlashtirish (Q1–Q8) | 📋 reja |
| [`MAZETTO_QUEENFOOD_COMPARISON.md`](./MAZETTO_QUEENFOOD_COMPARISON.md) | Qiyosiy tahlil | 📖 ma'lumotnoma |

---

## 2. Hozirgi holat — muhit tayyor, faqat brauzer QA qolgan

Lokal ma'lumotlar bazasi bloklovchisi **yopilgan**. 2026-09-07 da muhit Docker'ga ko'chirildi:

| | Qiymat | Nega |
|---|---|---|
| `POSTGRES_PORT` | **5433** | 5432 ni Windows'ning `postgresql-x64-18` servisi egallagan |
| `REDIS_PORT` | **6380** | 6379 ni boshqa loyihaning konteyneri egallagan |

Migratsiya va seed qo'llangan, backend va pos-web ishga tushgan.

**Bajarilgan QA:**

- 34 route kompilyatsiya bo'ldi, dev logda 0 xato
- Yangi ekranlar chaqiradigan **27 endpoint** haqiqiy javob bilan sinaldi — 27/27 muvaffaqiyatli
- B1–B7 oqimlari uchdan uchigacha ishladi
- Javob kalitlari qo'lda yozilgan frontend turlariga solishtirildi va mos chiqdi

**Qolgan yagona bo'shliq — piksel darajasidagi ko'rik.** Sababi baza emas, brauzer boshqaruvi ulanmagani:

- Haqiqiy kengliklarda responsive tekshiruv (768 / 1024 / 1366 / 1440 / 1920 / 1024×600)
- Olti rol uchun RBAC vizual tekshiruvi
- Modallarni sichqoncha bilan ishlatib ko'rish

Bitta yo'l ham jonli ishlamadi: `paymentBreakdown` bo'sh bazada `[]` qaytaradi, ya'ni tuzatilgan Z-hisobot crash yo'li ishga tushmadi — buni ko'rish uchun buyurtma va to'lov fixture'i kerak.

### Lokal muhit eslatmalari

Bular har seans boshida bilinishi kerak:

- **Seed filial yaratmaydi** (0 ta). Birinchi filial admin panelning o'zidan yaratiladi.
- **Seed foydalanuvchi ham yaratmaydi.** `pnpm --filter backend staff:bootstrap` yoki `MAZETTO_BOOTSTRAP_ADMIN_*` o'zgaruvchilari kerak.
- `NEXT_PUBLIC_MEDIA_URL` 8080 ga ishora qiladi, lekin bu mashinada 8080 ni **boshqa loyihaning konteyneri** egallagan — mahsulot rasmlari noto'g'ri servisdan keladi. Media servisi compose faylida yo'q.

---

## 3. To'lqinlar

Ish 6 ta to'lqinga bo'lingan. Har to'lqin oldingisidan mustaqil natija beradi.

```
0-to'lqin   Brauzer QA + 5-bosqichni merge     ← eng yuqori prioritet
1-to'lqin   Xavfsizlik yamog'i                 ← mustaqil, tez
2-to'lqin   Qobiq refaktori (A bloki)          ← siz aytgan bug
3-to'lqin   Poydevor (Q1–Q4)
4-to'lqin   Karta va checkout (C, D bloklari)
5-to'lqin   Kuryer (B bloki)
6-to'lqin   Katta refaktorlar (Q5–Q8)
```

---

### 0-to'lqin — Brauzer QA va merge

| # | Ish | Manba |
|---|---|---|
| 0.1 | Bootstrap: birinchi filial + admin foydalanuvchi yaratish | `staff:bootstrap` |
| 0.2 | Brauzer QA: 12 ekran, 6 modal, responsive 768–1920 | [`PLAN-5`](./admin-redesign/PLAN-5-REDIZAYN.md) |
| 0.3 | Olti rol uchun RBAC vizual tekshiruvi | ⟶ |
| 0.4 | Buyurtma + to'lov fixture'i bilan Z-hisobot crash yo'lini jonli tekshirish | ⟶ |
| 0.5 | `NEXT_PUBLIC_MEDIA_URL` port to'qnashuvini hal qilish | ⟶ |
| 0.6 | `admin-redesign-phase-5` ni `main` ga merge | — |

**Nega birinchi:** 34 commit merge qilinmagan holda turibdi. Har kun konflikt xavfini oshiradi va 6-bosqich aynan shu kod ustiga quriladi.

**Chiqish sharti:** 5-bosqich ekranlari brauzerda ko'rilgan, `main` yangilangan.

> 2-to'lqin (qobiq refaktori) 0-to'lqin bilan **parallel** ketishi mumkin — u shu ekranlarning joylashuvini o'zgartiradi, ya'ni ikkalasini birga tekshirish samaraliroq bo'lishi mumkin. Qaror sizniki.

---

### 1-to'lqin — Xavfsizlik yamog'i

Mustaqil, tez, deploy qilinishi mumkin. Qobiq refaktorini kutmaydi.

| # | Ish | Manba | Mehnat |
|---|---|---|---|
| 1.1 | `X-Forwarded-For` ishonchini olib tashlash | [PHASE 6 H1](./MAZETTO_PHASE_6_PLAN.md) | bir necha qator |
| 1.2 | Chek raqamiga retry + P2002 ni constraint bo'yicha ajratish | [H4](./MAZETTO_PHASE_6_PLAN.md) | kichik |
| 1.3 | `shiftNumber` ga advisory lock | [H5](./MAZETTO_PHASE_6_PLAN.md) | kichik |
| 1.4 | `listCustomerOrders` ga `take` + sahifalash | [H10](./MAZETTO_PHASE_6_PLAN.md) | kichik |
| 1.5 | CORS ro'yxatini `CORS_ORIGIN` env'ga chiqarish (bitta manba) | [H12](./MAZETTO_PHASE_6_PLAN.md) | kichik |
| 1.6 | `helmet` + `@nestjs/throttler` (xotirada) | [H3](./MAZETTO_PHASE_6_PLAN.md) | kichik |
| 1.7 | `tsconfig` ga `scripts/` va `prisma/` qo'shish | [H12](./MAZETTO_PHASE_6_PLAN.md) | bir qator |

**Nega bu tartib:** 1.1 va 1.2 eng yuqori xavf/mehnat nisbatiga ega. 1.6 dagi throttler xotirada boshlanadi; Redis'ga o'tish 3-to'lqinda.

**Chiqish sharti:** validator skriptlar o'tadi, `main` ga merge, deploy.

---

### 2-to'lqin — Qobiq refaktori ★

Siz aytgan "chapdagi menu paneli yo'qolyapti" muammosi shu yerda yopiladi.

| # | Ish | Manba | Yopadi |
|---|---|---|---|
| 2.1 | Topbar yorliqlarini tuzatish (`target="_blank"`) | [A5](./MAZETTO_PHASE_6_PLAN.md) | **D1 — asosiy bug** |
| 2.2 | Route group: `(shell)` / `(fullscreen)` / `(auth)` | [A1](./MAZETTO_PHASE_6_PLAN.md) | D3 |
| 2.3 | Guardni layoutga ko'chirish | [A2](./MAZETTO_PHASE_6_PLAN.md) | — |
| 2.4 | Rad etishni qobiq ichida ko'rsatish | [A3](./MAZETTO_PHASE_6_PLAN.md) | D2 |
| 2.5 | Oq ekran o'rniga skeleton | [A4](./MAZETTO_PHASE_6_PLAN.md) | — |
| 2.6 | Rol uy sahifalarini menyuga qo'shish | [A6](./MAZETTO_PHASE_6_PLAN.md) | D4 |
| 2.7 | Faza darvozasi (`filterNavForPhase`) | [A7](./MAZETTO_PHASE_6_PLAN.md) | — |

> **2.1 birinchi va alohida.** U bir necha qatorlik tuzatish va eng ko'p ko'rinadigan muammoni darhol yopadi — 2.2 ning katta refaktorini kutmasligi kerak.

**Ehtiyot:** implementatsiyadan oldin `apps/pos-web/node_modules/next/dist/docs/01-app/` o'qilsin — `AGENTS.md` talabi.

**Chiqish sharti:** har rol bilan brauzerda tekshirilgan — hech bir menyu tugmasi sidebar'ni yo'qotmaydi.

---

### 3-to'lqin — Poydevor

Keyingi bloklar shularga tayanadi.

| # | Ish | Manba | Nega shu yerda |
|---|---|---|---|
| 3.1 | Env validatsiya (zod) | [Q3.1](./MAZETTO_PHASE_7_PLAN.md) | keyingi hamma sozlama shunga tayanadi |
| 3.2 | `Setting` reestri | [Q1](./MAZETTO_PHASE_7_PLAN.md) | C7 (yetkazish narxi) va D4 (to'lov usullari) uchun shart |
| 3.3 | `ScheduleModule` + tozalash ishlari | [Q2](./MAZETTO_PHASE_7_PLAN.md) | H2 (throttle Map) ni ham yopadi |
| 3.4 | Redis'ni ishga solish: throttle storage + permission keshi | [H2, H3, H8](./MAZETTO_PHASE_6_PLAN.md) | C2 (geokodlash keshi) uchun shart |
| 3.5 | `/admin/settings` ekrani | [Q1.3](./MAZETTO_PHASE_7_PLAN.md) | 2-to'lqin qobig'ini talab qiladi |
| 3.6 | Media yuklash | [Q4](./MAZETTO_PHASE_7_PLAN.md) | AUD-009 ni yopadi; rasmlarni git'dan chiqaradi |
| 3.7 | Swagger + Makefile | [Q3.2, Q3.3](./MAZETTO_PHASE_7_PLAN.md) | past xavf, amaliyotni yengillashtiradi |

**Chiqish sharti:** Redis ishlatilmoqda, sozlamalar bazadan o'qilmoqda, eskirgan qatorlar tozalanmoqda.

---

### 4-to'lqin — Karta va checkout

| # | Ish | Manba |
|---|---|---|
| 4.1 | `TASHKENT_BOUNDS` → `packages/types` (paketni tiriltirish) | [C1](./MAZETTO_PHASE_6_PLAN.md), [H9](./MAZETTO_PHASE_6_PLAN.md) |
| 4.2 | Geokodlash proxy (Redis kesh, fail-open) | [C2, C3](./MAZETTO_PHASE_6_PLAN.md) |
| 4.3 | Tile provider + karta komponenti | [C5](./MAZETTO_PHASE_6_PLAN.md) |
| 4.4 | Mijoz manzili: koordinata maydonlari + saqlangan manzillar | [C6](./MAZETTO_PHASE_6_PLAN.md) |
| 4.5 | Yetkazish narxi (sozlamadan, pog'onali) | [C7](./MAZETTO_PHASE_6_PLAN.md) + Q1 |
| 4.6 | Checkout 2 qadamga bo'linishi + stepper | [D1, D2, D3](./MAZETTO_PHASE_6_PLAN.md) |
| 4.7 | To'lov usullari ekrani (qulf / badge) | [D4](./MAZETTO_PHASE_6_PLAN.md) + Q1 |
| 4.8 | Telefon normalizatsiyasi, vaqt chiplari, Toshkent sanasi | [D5, D6, D7](./MAZETTO_PHASE_6_PLAN.md) |

**Bog'liqlik:** 4.5 va 4.7 `Setting` reestrisiz (3.2) ishlamaydi. 4.2 Redis'siz (3.4) ishlamaydi.

**Chiqish sharti:** mijoz kartada manzil tanlaydi, Toshkent tashqarisi rad etiladi, narx serverdan keladi.

---

### 5-to'lqin — Kuryer

| # | Ish | Manba |
|---|---|---|
| 5.1 | `COURIER` roli + permissionlar | [B1](./MAZETTO_PHASE_6_PLAN.md) |
| 5.2 | Baza: `DeliveryRoute`, `RouteStop`, `Order.courierId` | [B2](./MAZETTO_PHASE_6_PLAN.md) |
| 5.3 | Marshrut provayder abstraksiyasi — **Haversine bilan boshlanadi** | [Comparison §6.4](./MAZETTO_QUEENFOOD_COMPARISON.md) |
| 5.4 | Kuryer ekranlari `(shell)/courier/*` | [B3](./MAZETTO_PHASE_6_PLAN.md) |
| 5.5 | `/admin/couriers` | [B4](./MAZETTO_PHASE_6_PLAN.md) |
| 5.6 | OSRM (ixtiyoriy, keyinroq) | — |

**Bog'liqlik:** 2-to'lqin (qobiq) va 4-to'lqin (koordinata) tugagan bo'lishi shart.

**Chiqish sharti:** kuryer o'z marshrutini ko'radi, to'xtash statusini o'zgartiradi, sidebar joyida qoladi.

---

### 6-to'lqin — Katta refaktorlar

Bular funksiya qo'shmaydi, lekin keyingi hamma ishni tezlashtiradi. Shoshilinch emas.

| # | Ish | Holat |
|---|---|---|
| 6.1 | Admin ekranlarida ma'lumot yuklash | ✅ bajarildi — **react-query'siz**, quyida sabab |
| 6.2 | Umumiy API mijozi | ✅ hal qilindi — **paketsiz**, quyida sabab |
| 6.3 | Umumiy UI paketi | ❌ KERAK EMAS — takror yo'q |
| 6.4 | Bildirishnoma quvuri | ✅ bajarildi (o'lik xatlar) |
| 6.5 | Ko'p tillilik (uz / ru) | ❌ HOZIRCHA KERAK EMAS |
| 6.6 | Yirik fayllarni bo'lish | ✅ bajarildi (3 fayl, 13 modul) |
| 6.7 | Repo hajmi | ✅ hal qilindi — **tarix qayta yozilmadi**, quyida sabab |

---

### 6-to'lqindagi qarorlar va ularning dalili

Reja yozilganidan keyin kod o'zgardi, shuning uchun uchta band boshqacha
hal qilindi. Har biri o'lchovga asoslangan.

**6.1 — react-query o'rniga `useApiResource`.**
Reja react-query'ni taklif qilgan edi. O'lchov: 22 ta admin ekranidan
HECH BIRIDA javob tartibi qo'riqchisi yo'q edi va 12 tasi filtr
o'zgarganda qayta yuklardi — ya'ni filtrni tez almashtirganda sekinroq
javob yutib, jadval eski ma'lumotni ko'rsatardi. react-query buni
yechadi, lekin yangi bog'liqlik va 22 faylni qayta yozish evaziga.
100 qatorlik hook xuddi shu poygani yechdi va 43 ta takroriy `catch`
blokini bitta joyga yig'di. Kesh va qayta urinish admin panelida talab
qilinmagan.

**6.2 — `@mazetto/api-client` paketi o'rniga konvert qulfi.**
Ikkala `apiFetch` ATAYLAB boshqacha: `pos-web` xodim sessiyasi bilan
ishlaydi va 401 da tokenni yangilaydi; `customer-web` mijoz tokenini
parametr sifatida oladi va katalogni 30 soniya keshlaydi. Ularni bitta
paketga yig'ish har ikkalasiga keraksiz maydonlar qo'shardi.

Umumiy narsa faqat konvert SHAKLI edi — va aynan o'sha yerda HAQIQIY
XATO topildi: `pos-web` tipida `message: string` deb yozilgan, backend
esa validatsiya xatolarini MASSIV qaytaradi. `new Error(massiv)`
xabarlarni vergul bilan bo'shliqsiz yopishtirardi. Tuzatildi va
`validate-api-envelope` bilan qulflandi.

**6.3 — umumiy UI paketi KERAK EMAS.**
O'lchov: `pos-web/components/admin-ui/` da 15 ta umumiy komponent bor
(Tailwind `mz-` tokenlari). `customer-web` da umumiy komponent NOLTA —
uning hammasi domenga bog'langan (`branch-picker`, `delivery-map`) va
boshqa dizayn tizimida (`mf-` CSS sinflari). Uning "toast"i esa savat
kontekstidagi metod. Ya'ni yo'q qilinadigan takror yo'q: bu ikki
MAHSULOT — admin panel va do'kon.

**6.5 — ko'p tillilik HOZIRCHA kerak emas.**
O'lchov: `lang="uz"`, `locale: "uz_UZ"`, UI'da ruscha matn NOL.
`localizeMenuName` aslida tarjima emas, katalog kodini o'zbekcha nomga
o'giradi. Ikkinchi til paydo bo'lmaguncha i18n infratuzilmasi yuki
bo'sh qoladi.

**6.7 — tarix QAYTA YOZILMADI.**
`.git` 237 MB va uning katta qismi tarixdagi dizayn manbalari (46 MB
`.cdr`, 8.7 MB PDF). Tozalash `git filter-repo` talab qiladi: har
commit SHA'si o'zgaradi, `main` ga force-push kerak, hamma reponi
qaytadan klon qiladi va yo'ldagi shoxlar uziladi.

O'lchov shuni ko'rsatdiki, bu og'irlik amalda deyarli hech narsaga
turmaydi: `.dockerignore` `.git` ni chiqaradi (Docker build tarixni
ko'chirmaydi) va `actions/checkout@v4` sukut bo'yicha sayoz klon qiladi
(CI to'liq tarixni tortmaydi). Qoladigan narxi — dasturchining bir
martalik to'liq kloni.

Shuning uchun tarix tegilmadi, lekin O'SISH TO'XTATILDI:
`validate-repo-weight` ro'yxatdan tashqari 512K dan og'ir yangi fayl
qo'shilsa yiqiladi. Tarixni tozalash kerak bo'lsa, u alohida, hamma
kelishgan holda rejalashtiriladigan ish.

---

## 4. Bog'liqlik grafigi

```
0-to'lqin (brauzer QA + merge)
    │
    ├──> 1-to'lqin (xavfsizlik yamog'i) ──────────────┐
    │                                                 │
    └──> 2-to'lqin (qobiq A) ────┐                    │
                                 │                    │
                                 v                    v
                          3-to'lqin (Q1 sozlama, Q2 cron, Redis, Q4 media)
                                 │
                    ┌────────────┴────────────┐
                    v                         v
            4-to'lqin (C karta, D checkout)   6-to'lqin (Q5–Q8 refaktor)
                    │
                    v
            5-to'lqin (B kuryer)
```

1-to'lqin hech narsani bloklamaydi — istalgan vaqtda parallel ketishi mumkin.
6-to'lqin 3-to'lqindan keyin istalgan vaqtda boshlanishi mumkin.

---

## 5. Har to'lqin uchun umumiy chiqish sharti

Loyihaning mavjud intizomiga muvofiq ([`MAZETTO_RELEASE_READINESS_CHECKLIST.md`](./MAZETTO_RELEASE_READINESS_CHECKLIST.md)):

1. `pnpm typecheck` + `pnpm lint` + `pnpm build` toza
2. Tegishli `apps/backend/scripts/validate-*.ts` skriptlari o'tadi
3. **Brauzerda ko'rilgan** — 5-bosqich shu qadamni o'tkazib yuborgan edi
4. [`MAZETTO_WORK_STATUS.md`](./MAZETTO_WORK_STATUS.md) ga yozuv qo'shilgan
5. Deploy oldidan: baza backup + `pg_restore --list` bilan tekshirish
6. Deploy'dan keyin: health + smoke natijasi yozib olingan

---

## 6. Ochiq qarorlar — to'lqin bo'yicha

| To'lqin | Qaror | Manba |
|---|---|---|
| 3 | Media saqlash: MinIO yoki mavjud volume? | [Q4.1](./MAZETTO_PHASE_7_PLAN.md) |
| 3 | Sozlamalar uchun `SETTING_MANAGE` permission? | [Q1.3](./MAZETTO_PHASE_7_PLAN.md) |
| 4 | Yetkazish narxi: porsiya pog'onasi yoki masofa? | [PHASE 6](./MAZETTO_PHASE_6_PLAN.md) |
| 4 | Tile provider: OSM public yoki self-hosted? | [C5](./MAZETTO_PHASE_6_PLAN.md) |
| 5 | Kuryer: mustaqil `Courier` jadvalmi yoki `Employee` + rol? | [PHASE 6](./MAZETTO_PHASE_6_PLAN.md) |
| 5 | Marshrut optimizatsiyasi kerakmi yoki oddiy ro'yxat yetadimi? | [PHASE 6](./MAZETTO_PHASE_6_PLAN.md) |
| 6 | Bildirishnoma navbati: Redis yoki RabbitMQ? | [Q6.1](./MAZETTO_PHASE_7_PLAN.md) |
| 6 | Ko'p tillilik qamrovi va mahsulot nomlari tarjimasi? | [Q8](./MAZETTO_PHASE_7_PLAN.md) |
| 6 | `media-source/` + 48 MB `.cdr`: Git LFS yoki repodan chiqarish? | [H12c](./MAZETTO_PHASE_6_PLAN.md) |

---

## 7. Keyingi qadam

Bloklovchi yo'q — uchta ish darhol boshlanishi mumkin:

| Ish | Nega birinchi |
|---|---|
| **2.1** — topbar yorliqlari (`target="_blank"`) | bir necha qator, siz aytgan bug'ni darhol yopadi |
| **1.1** — XFF ishonchini olib tashlash | bir necha qator, P1 xavfsizlik |
| **0.1** — bootstrap: filial + admin foydalanuvchi | brauzer QA'ning old sharti |

Uchalasi bir-biriga tegmaydi, ya'ni istalgan tartibda.
