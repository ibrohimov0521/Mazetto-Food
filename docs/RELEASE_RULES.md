# MAZETTO FOOD — Reliz qoidalari

Oxirgi yangilanish: 2026-09-11

Production'ga chiqarish **bitta odam zimmasida**. Bu hujjat shu qoidalar
to'plami: kim, nimani, qanday tartibda tekshiradi va nima qat'iyan man etiladi.

---

## 0. Asosiy qoida

> **Production'ga faqat reliz egasi chiqaradi.**
> Reliz egasi: **Javohir — [@ibrohimov0521](https://github.com/ibrohimov0521)**
>
> U commit'ni o'z mashinasiga tortib oladi, o'zi to'liq tekshiradi va o'zi
> deploy qiladi. Boshqa hech kim — odam ham, workflow ham — production'ga
> chiqarmaydi.

Prodga chiqishdan oldingi **barcha** tekshiruvlar reliz egasiga biriktirilgan.
Har `main` commit'i uchun GitHub issue avtomatik ochiladi va unga
biriktiriladi (3-bo'lim).

---

## 1. Nima avtomatik, nima emas

| Bosqich                          | Kim                                         |
| -------------------------------- | ------------------------------------------- |
| Kod tekshiruvi (CI `verify`)     | avtomatik — GitHub Actions                  |
| `main` ga merge                  | ishlab chiquvchi, CI yashil bo'lsa          |
| Relizga xabar berish             | avtomatik — issue ochiladi va biriktiriladi |
| **Lokal to'liq qayta tekshiruv** | **reliz egasi**                             |
| **Baza backup'i**                | **reliz egasi**                             |
| **Migratsiya**                   | **reliz egasi**                             |
| **Deploy**                       | **reliz egasi**                             |
| **Deploy'dan keyingi smoke**     | **reliz egasi**                             |
| **`production` tegi**            | **reliz egasi**                             |

```text
branch ──► PR ──► CI "verify" ── yashil bo'lishi SHART ──► merge
                                                             │
                   main'dagi commit uchun CI "verify" ◄──────┘
                                  │ tugadi
                                  ▼
                  Release handoff: issue ochiladi, @ibrohimov0521 ga biriktiriladi
                                  │
                                  ▼
        Javohir: git pull → pnpm run ci → release:gate → release:smoke
                                  │ hammasi o'tdi
                                  ▼
        Javohir: backup → deploy → migrate deploy → release:smoke → qo'lda ko'rish
                                  │
                                  ▼
                     production tegi suriladi, issue yopiladi
```

---

## 2. Qat'iyan man etiladi

- ❌ **Avtomatik deploy.** `.github/workflows/deploy.yml` (Dokploy API orqali
  avtomatik reliz) **o'chirildi** va qaytarilmaydi.
- ❌ **Dokploy'ning o'z "Autodeploy" i.** Har bir ilovada (backend,
  customer-web, pos-web, telegram-bot, media) **o'chiq** turishi shart. Yoqiq
  qolsa Dokploy har push'da o'zi deploy qiladi va bu qoidalarning hammasi
  ma'nosiz bo'ladi. **Buni bir marta tekshirish shart** — pastdagi 6-bo'lim.
- ❌ Boshqa odamning deploy qilishi.
- ❌ Backup'siz migratsiya.
- ❌ Production bazada `prisma migrate dev`, `db push`, `migrate reset`,
  `drop`, `truncate`, volume o'chirish.
- ❌ CI qizil commit'ni chiqarish.
- ❌ `main` da yo'q commit'ni chiqarish (`release:gate` rad etadi).

---

## 3. Xabar berish — Release handoff

`.github/workflows/release-handoff.yml`. `main` ga har push'dan keyin CI
tugashi bilan yuradi va issue ochadi:

- sarlavha: `Reliz tekshiruvi: <sha> — <commit sarlavhasi>`
  (CI qizil bo'lsa: `main QIZIL: ...`);
- yorliq `reliz`, **assignee @ibrohimov0521** — GitHub o'zi email va
  bildirishnoma yuboradi;
- ichida: commit, CI natijasi havolasi, `pnpm release:gate` chiqishi,
  `production` tegidan beri chiqmagan commitlar ro'yxati, yurgiziladigan
  buyruqlar va to'liq tekshiruv ro'yxati (checkbox).

Bir commit uchun ikkinchi issue ochilmaydi (CI qayta yurgizilsa ham).
Secret kerak emas — `GITHUB_TOKEN` yetadi.

Ochiq `reliz` issue'lari — bu production'ga chiqmagan navbat:

```bash
gh issue list --label reliz --state open
```

Issue **deploy qilinib, smoke o'tgandan keyin** yopiladi.

---

## 4. Reliz egasi bajaradigan tartib

Issue ichida ham shu buyruqlar bor.

**1-qadam — tortib olish va lokal tekshirish**

```bash
git fetch origin && git checkout main && git pull --ff-only
pnpm install --frozen-lockfile
pnpm --filter backend prisma:migrate:deploy   # LOKAL bazaga, production'ga emas
pnpm run ci                                   # typecheck, lint, test, build, validatorlar
```

**2-qadam — darvoza va production holati**

```bash
pnpm release:gate <sha>    # commit main'da va CI "verify" yashilmi;
                           # production tegidan beri qaysi ilova o'zgargani
                           # va yangi migratsiyalar ro'yxati
pnpm release:smoke         # production HOZIR sog'lommi (relizdan OLDIN)
```

`release:gate` rad etsa — **to'xtaydi.** Sababini tuzatmasdan chiqilmaydi.

**3-qadam — qo'lda ko'rish**

Issue'dagi checklist: dizayn, mobil layout (360 / 390 / 430 / 768 / 1440 px),
POS real qurilmada, Telegram webhook, printer, yangi env o'zgaruvchilar,
real ma'lumotdagi chekka holatlar.

**4-qadam — backup (migratsiya bo'lsa shart)**

```bash
pnpm db:backup
pg_restore --list <backup-fayli> | head    # backup ochilishini tekshirish
```

Backup yo'lini issue'ga yozing.

**5-qadam — deploy**

Dokploy panelidan qo'lda, yoki lokal mashinadan:

```bash
node scripts/dokploy-deploy.mjs --sha <to'liq-sha> backend pos-web customer-web
```

Migratsiya production konteynerida:

```bash
B=$(docker ps --format '{{.Names}}' | grep -m1 mazetto-food-backend)
docker exec -w /app/apps/backend "$B" ./node_modules/.bin/prisma migrate status
docker exec -w /app/apps/backend "$B" ./node_modules/.bin/prisma migrate deploy
```

To'liq tartib: [`MAZETTO_RELEASE_READINESS_CHECKLIST.md`](MAZETTO_RELEASE_READINESS_CHECKLIST.md).

**6-qadam — deploy'dan keyin**

```bash
pnpm release:smoke
git tag -f production <sha> && git push -f origin production
```

So'ng issue'ni yoping.

---

## 5. `production` tegi

Teg — production'da hozir turgan commit. `release:gate` va handoff issue'si
"nima chiqmagan" ni shu tegdan solishtiradi.

**Surilmasa** hisob buziladi: keyingi issue allaqachon chiqarilgan
o'zgarishlarni yana "chiqmagan" deb ko'rsatadi va allaqachon qo'llangan
migratsiyani "yangi" deb yozadi.

Birinchi marta belgilash:

```bash
git tag production <production'dagi-sha> && git push origin production
```

---

## 6. Bir martalik sozlash — reliz egasi

Bu qoidalar to'liq ishlashi uchun quyidagilar bir marta qilinadi. Faqat repo
admini qila oladi.

- [ ] **Dokploy → har bir ilova → Autodeploy O'CHIRILDI** (backend,
      customer-web, pos-web, telegram-bot, media). Bu eng muhimi: yoqiq
      qolsa production qoidadan tashqari chiqib ketaveradi.
- [ ] GitHub → Settings → Secrets and variables → Actions: `DOKPLOY_URL`,
      `DOKPLOY_API_KEY`, `AUTO_DEPLOY` va `DOKPLOY_APP_*` **o'chirildi** —
      ular endi ishlatilmaydi (deploy lokal mashinadan qilinsa, kalit lokal
      env'da turadi).
- [ ] Branch protection `main` uchun yoqilgan, majburiy check: `verify`
      ([`CI_CD.md`](CI_CD.md), 3-bo'lim).
- [ ] `production` tegi belgilangan (5-bo'lim).
- [ ] `@ibrohimov0521` repo'ni **Watch → All Activity** qilib qo'ygan yoki
      issue biriktirilishi haqidagi bildirishnoma yoqiq.

---

## 7. `main` qizil bo'lsa

Handoff issue'si sarlavhasi `main QIZIL:` bilan ochiladi va deploy
qadamlariga o'tilmaydi. Tartib: qizil commit chiqarilmaydi, avval `main`
tuzatiladi (tuzatish ham PR orqali), keyin yangi commit uchun yangi issue
keladi.

---

## Tegishli hujjatlar

- [`CI_CD.md`](CI_CD.md) — CI nimani tekshiradi, branch protection
- [`MAZETTO_RELEASE_READINESS_CHECKLIST.md`](MAZETTO_RELEASE_READINESS_CHECKLIST.md) — to'liq reliz tartibi
- [`DOKPLOY_DEPLOYMENT.md`](DOKPLOY_DEPLOYMENT.md) — Dokploy, rollback
- [`PRODUCTION_DEPLOYMENT.md`](PRODUCTION_DEPLOYMENT.md) — production muhiti
