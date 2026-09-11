# MAZETTO FOOD — CI/CD

Maqsad: tekshirilmagan kod `main` ga ham, production'ga ham chiqmasin.

**CD YO'Q.** Bu hujjat faqat CI haqida. Production'ga chiqarish to'liq qo'lda
va bitta odam — reliz egasi — zimmasida: [`RELEASE_RULES.md`](RELEASE_RULES.md).
Avtomatik deploy (`deploy.yml`) ataylab olib tashlandi.

```text
branch ──► PR ──► CI "verify" ── yashil bo'lishi SHART ──► merge
                                                             │
                   main'dagi commit uchun CI "verify" ◄──────┘
                                  │ tugadi
                                  ▼
        Release handoff: issue ochiladi va reliz egasiga biriktiriladi
                                  │
                                  ▼
        Reliz egasi o'z mashinasida: pull → pnpm run ci → release:gate
                                  │
                                  ▼
        Reliz egasi: backup → deploy → migrate deploy → release:smoke
                                  │
                                  ▼
                   production tegi suriladi, issue yopiladi
```

## 1. Ish tartibi

- `main` ga to'g'ridan-to'g'ri push qilinmaydi — branch protection rad etadi.
- Har ish alohida branch'da: `feat/...`, `fix/...`, `chore/...`.
- PR ochiladi. Shablon (`.github/pull_request_template.md`) CI tutmaydigan
  narsalarni eslatadi.
- `verify` checki yashil bo'lmaguncha merge tugmasi yopiq.

## 2. CI nimani tekshiradi

`.github/workflows/ci.yml` — har PR'da va `main` ga har push'da.

| Bosqich                          | Nimani ushlaydi                                                                         |
| -------------------------------- | --------------------------------------------------------------------------------------- |
| `pnpm install --frozen-lockfile` | lockfile va `package.json` mos kelmasligi                                               |
| `prisma migrate deploy`          | migratsiya SQL'i toza PostgreSQL 18 ga qo'llanmasligi                                   |
| `pnpm run ci` → prisma generate  | schema xatosi                                                                           |
| `pnpm run ci` → typecheck        | TypeScript xatolari (ilovalar va backend skriptlari)                                    |
| `pnpm run ci` → lint             | ESLint qoidalari                                                                        |
| `pnpm run ci` → test             | backend regressiya testlari                                                             |
| `pnpm run ci` → build            | Next.js, Nest va agent build yiqilishi                                                  |
| `pnpm run ci` → validate         | `apps/backend/scripts/validate-*.ts` qoidalari (`-db` bilan tugaydiganlaridan tashqari) |
| smoke: backend boot              | production rejimida ishga tushmaslik: env tekshiruvi, Nest DI xatosi, bazaga ulanish    |

Workflow qadamlarni qayta yozmaydi, server'dagi `pnpm run ci` ning O'ZINI
chaqiradi — ikkalasi hech qachon ajralib ketmaydi. Eski workflow aynan shunday
ajralgan edi: `prisma generate` ni tushirib qoldirgani uchun `main` dagi har
push qizil bo'lgan va buni hech kim sezmagan.

Migratsiya `pnpm run ci` dan OLDIN turadi. Nomi `-db` bilan tugamaydigan ba'zi
validatorlar ham bazaga yozib, tranzaksiyani qaytarib oladi (masalan
`validate-order-display-numbers`). Server'da `pnpm run ci` migratsiya qilingan
bazaga qarshi yuradi, CI'da ham shunday bo'lishi kerak.

### CI tutmaydigan narsalar

Dizayn buzilishi, real brauzerdagi UX, mobil layout, production env
yetishmasligi, Telegram token/webhook, printer ulanishi, Cloudflare/DNS, real
ma'lumotdagi chekka holatlar. Ular uchun: PR shablonidagi qo'lda checklist va
relizdan keyingi smoke.

## 3. Branch protection — bir marta, repo egasi

Sozlamani faqat repo admini (`ibrohimov0521`) o'zgartira oladi.

**UI:** Settings → Branches → Add branch protection rule → Branch name pattern: `main`

- ✅ Require a pull request before merging — Required approvals: `0`
  (jamoa kattalashsa `1` qiling)
- ✅ Require status checks to pass before merging → `verify` ni qo'shing
- ⬜ Require branches to be up to date before merging — o'chiq qoladi. Merge'dan
  keyin `main` da CI baribir qayta yuradi va deploy aynan o'sha natijani talab
  qiladi, ya'ni har PR'ni qayta-qayta rebase qilish shart emas.
- ⬜ Do not allow bypassing the above settings — o'chiq qoladi: favqulodda
  holatda admin hotfix chiqara oladi. Qat'iyroq kerak bo'lsa yoqing.

**CLI** (xuddi shu sozlama):

```bash
gh api -X PUT repos/ibrohimov0521/Mazetto-Food/branches/main/protection --input - <<'EOF'
{
  "required_status_checks": {
    "strict": false,
    "checks": [{ "context": "verify", "app_id": 15368 }]
  },
  "required_pull_request_reviews": { "required_approving_review_count": 0 },
  "enforce_admins": false,
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false
}
EOF
```

`app_id: 15368` — GitHub Actions. Check shu ilovaga bog'lanadi, ya'ni push
huquqi bor kishi API orqali qo'lda "verify: success" statusini qo'yib
qo'ya olmaydi.

> ⚠️ Job nomi `verify` ni o'zgartirsangiz, protection sozlamasini ham
> yangilang. Aks holda har PR "Expected — Waiting for status to be reported"
> holatida qotib qoladi.

## 4. Reliz topshirig'i (avtomatik deploy O'RNIGA)

`.github/workflows/release-handoff.yml` — `main` dagi commit uchun CI tugagach
ishga tushadi va **deploy qilmaydi**, faqat xabar beradi:

1. Reliz egasiga (`@ibrohimov0521`) `reliz` yorlig'i bilan issue ochiladi va
   biriktiriladi — GitHub o'zi email/bildirishnoma yuboradi.
2. Issue ichida: commit va CI natijasi havolasi, `pnpm release:gate` ning
   to'liq chiqishi (qaysi ilova o'zgargan, yangi migratsiyalar), `production`
   tegidan beri chiqmagan commitlar ro'yxati, lokal yurgiziladigan buyruqlar
   va prodgacha bo'lgan to'liq tekshiruv ro'yxati.
3. CI qizil bo'lsa sarlavha `main QIZIL:` bilan ochiladi — deploy qadamlariga
   o'tilmaydi.
4. Bir commit uchun ikkinchi issue ochilmaydi (CI qayta yurgizilsa ham).

Secret KERAK EMAS: `GITHUB_TOKEN` yetadi, ya'ni merge bo'lishi bilan ishlaydi.

> `workflow_run` workflow'i faqat default branch'dagi nusxasidan yuradi — bu
> fayl `main` ga tushmaguncha hech narsa ochilmaydi.

Ochiq topshiriqlar — production'ga chiqmagan navbat:

```bash
gh issue list --label reliz --state open
```

### Avtomatik deploy nima uchun olib tashlandi

Avval `deploy.yml` `main` yashil bo'lgach commit'ni Dokploy API orqali o'zi
chiqarardi. Qaror: **production'ga faqat reliz egasi, o'z mashinasidan
chiqaradi** — u avval commit'ni tortib oladi, to'liq tekshiradi, keyin deploy
qiladi. Qoidalar to'plami: [`RELEASE_RULES.md`](RELEASE_RULES.md).

Shu bilan birga **Dokploy'ning o'z "Autodeploy" i har bir ilovada o'chiq
bo'lishi shart.** Yoqiq qolsa Dokploy GitHub'ni kutmasdan har push'da o'zi
deploy qiladi va workflow'ni o'chirish hech narsa bermaydi.

`AUTO_DEPLOY`, `DOKPLOY_URL`, `DOKPLOY_API_KEY` va `DOKPLOY_APP_*` Actions
sozlamalari endi ishlatilmaydi — ularni repo sozlamalaridan o'chirish mumkin.
`scripts/dokploy-deploy.mjs` qoldi: reliz egasi uni LOKAL mashinasidan
yurgizadi (`RELEASE_RULES.md`, 4-bo'lim, 5-qadam).

## 5. Qo'lda reliz

**Har doim — boshqa yo'l yo'q.** Kim qiladi va nimalarni tekshiradi:
[`RELEASE_RULES.md`](RELEASE_RULES.md). Bosqichma-bosqich tartib
`docs/MAZETTO_RELEASE_READINESS_CHECKLIST.md` da, unga uch buyruq qo'shildi.

**Image yig'ishdan OLDIN:**

```bash
pnpm release:gate <sha>
```

- `<sha>` `origin/main` tarixida bo'lmasa — rad etadi.
- Shu commit uchun `verify` yashil tugamagan bo'lsa — rad etadi (havola bilan).
- `production` tegidan beri qaysi ilovalar o'zgargani va yangi migratsiyalar
  ro'yxatini chiqaradi. Boshqa nuqta bilan solishtirish: `--since <sha>`.

**Migratsiya — production konteynerida** (backup olingandan keyin,
`MAZETTO_RELEASE_READINESS_CHECKLIST.md` 2-qadam):

```bash
B=$(docker ps --format '{{.Names}}' | grep -m1 mazetto-food-backend)
docker exec -w /app/apps/backend "$B" ./node_modules/.bin/prisma migrate status
docker exec -w /app/apps/backend "$B" ./node_modules/.bin/prisma migrate deploy
```

Prisma `node_modules/.bin` dan to'g'ridan-to'g'ri chaqiriladi va sozlamani
`prisma.config.ts` dan oladi. O'sha config ATAYLAB o'zi-yetarli: image'ga faqat
`dist` ko'chiriladi, `src` yo'q, shuning uchun u `src/` dan hech narsa import
qilmaydi. 2026-09-11 gacha import bor edi va konteynerda har qanday prisma
buyrug'i "Cannot find module './src/config/env'" bilan yiqilardi.

**Deploy'dan KEYIN:**

```bash
pnpm release:smoke
```

Faqat GET — buyurtma yaratmaydi, hech narsani o'zgartirmaydi. Backend health va
baza, ochiq menyu API'lari, tokensiz yopiq qolishi kerak bo'lgan endpointlar
(401), customer-web sahifalari, pos-web va media. Xuddi shuni GitHub'dan ham
yurgizish mumkin: Actions → **Production smoke** → Run workflow — natija tarixda
qoladi va tashqi tarmoqdan tekshirilgan bo'ladi.

Keyin qo'lda: dizayn va mobil layout, Telegram webhook info, printer.

**Oxirida `production` tegini suring:**

```bash
git tag -f production <sha> && git push -f origin production
```

`release:gate` va reliz topshirig'i issue'si shu tegdan solishtiradi. Surilmasa
hisob buziladi: keyingi topshiriq allaqachon chiqarilgan o'zgarishlarni yana
"chiqmagan" deb, qo'llangan migratsiyani esa "yangi" deb ko'rsatadi.

## 6. Nima uchun CorpEats'dan yumshoqroq

CorpEats'da `main` ga merge → image build → registry → SSH orqali avtomatik
deploy → avtomatik rollback. Mazetto'da:

| CorpEats                                           | Mazetto                                              | Sabab                                                                   |
| -------------------------------------------------- | ---------------------------------------------------- | ----------------------------------------------------------------------- |
| Har `main` push'da GHCR image build + push         | yo'q — image server'da (Dokploy) yig'iladi           | registry va uning sirlari qo'shimcha yuk                                |
| Har `main` push'da SSH orqali deploy               | yo'q — reliz egasi o'z mashinasidan qo'lda chiqaradi | qaror va javobgarlik bitta odamda; avtomatika faqat xabar beradi        |
| Avtomatik rollback                                 | yo'q — qaytarish qo'lda                              | rollback bazani qaytarmaydi; qarorni odam qabul qiladi                  |
| nginx konfig validatsiyasi                         | yo'q                                                 | routing Traefik/Dokploy'da                                              |
| Backup, Telegram test, mobile workflow'lari        | yo'q                                                 | hozircha kerak emas                                                     |
| `paths-ignore` (faqat hujjat o'zgarsa CI yurmaydi) | yo'q                                                 | majburiy check hujjat PR'ida ham kelishi kerak, aks holda PR bloklanadi |
| Turbo kesh                                         | yo'q                                                 | repo public — Actions daqiqalari bepul, soddalik ustun                  |

CorpEats'dan olingani: eskirgan run'ni bekor qilish (`main` bundan mustasno),
`workflow_run` dagi branch shartini job'da takrorlash, pnpm store keshi,
`workflow_dispatch`, `timeout-minutes`.

## 7. Keyin qo'shish mumkin

- **DB validatorlar** (`validate-*-db.ts`) — CI'da Postgres allaqachon bor, ya'ni
  ular bir martalik bazada xavfsiz yurishi mumkin.
- **Dockerfile build** — image yig'ilishi deploy paytida emas, PR'da yiqilsin.
- **Reliz topshirig'i Telegram'ga ham** — hozir faqat GitHub issue. Telegram
  uchun `TELEGRAM_BOT_TOKEN` va chat id secret'lari kerak; ularni faqat repo
  admini qo'sha oladi.
- **Playwright QA** (`scripts/qa-*.mjs`) — tanlanganlari PR'da.
