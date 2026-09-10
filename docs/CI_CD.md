# MAZETTO FOOD — CI/CD

Maqsad: tekshirilmagan kod `main` ga ham, production'ga ham chiqmasin — lekin
reliz ustidan nazorat (backup, migratsiya, qaysi servis qayta deploy bo'lishi)
hamon odamda qolsin.

```text
branch ──► PR ──► CI "verify" ── yashil bo'lishi SHART ──► merge
                                                             │
                     main'dagi commit uchun CI "verify" ◄────┘
                                  │
   server: pnpm release:gate <sha> --since <prod-sha>   ← qizil bo'lsa to'xtaydi
                                  │
            backup + prisma migrate deploy (migratsiya bo'lsa)
                                  │
                      image build + deploy (odatdagidek)
                                  │
         pnpm release:smoke  ·  qo'lda: dizayn / mobil / Telegram / printer
```

## 1. Ish tartibi

- `main` ga to'g'ridan-to'g'ri push qilinmaydi — branch protection rad etadi.
- Har ish alohida branch'da: `feat/...`, `fix/...`, `chore/...`.
- PR ochiladi. Shablon (`.github/pull_request_template.md`) CI tutmaydigan
  narsalarni eslatadi.
- `verify` checki yashil bo'lmaguncha merge tugmasi yopiq.

## 2. CI nimani tekshiradi

`.github/workflows/ci.yml` — har PR'da va `main` ga har push'da.

| Bosqich                          | Nimani ushlaydi                                                                      |
| -------------------------------- | ------------------------------------------------------------------------------------ |
| `pnpm install --frozen-lockfile` | lockfile va `package.json` mos kelmasligi                                            |
| `pnpm run ci` → prisma generate  | schema xatosi                                                                        |
| `pnpm run ci` → typecheck        | TypeScript xatolari (ilovalar va backend skriptlari)                                 |
| `pnpm run ci` → lint             | ESLint qoidalari                                                                     |
| `pnpm run ci` → test             | backend regressiya testlari                                                          |
| `pnpm run ci` → build            | Next.js, Nest va agent build yiqilishi                                               |
| `pnpm run ci` → validate         | `apps/backend/scripts/validate-*.ts` qoidalari (bazasizlari)                         |
| smoke: `prisma migrate deploy`   | migratsiya toza PostgreSQL 18 ga qo'llanmasligi                                      |
| smoke: backend boot              | production rejimida ishga tushmaslik: env tekshiruvi, Nest DI xatosi, bazaga ulanish |

Workflow qadamlarni qayta yozmaydi, server'dagi `pnpm run ci` ning O'ZINI
chaqiradi — ikkalasi hech qachon ajralib ketmaydi. Eski workflow aynan shunday
ajralgan edi: `prisma generate` ni tushirib qoldirgani uchun `main` dagi har
push qizil bo'lgan va buni hech kim sezmagan.

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
  keyin `main` da CI baribir qayta yuradi va release gate aynan o'sha natijani
  talab qiladi, ya'ni har PR'ni qayta-qayta rebase qilish shart emas.
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

## 4. Production reliz

Relizning o'zi o'zgarmadi (`docs/MAZETTO_RELEASE_READINESS_CHECKLIST.md`), unga
ikki buyruq qo'shildi.

**Image yig'ishdan OLDIN:**

```bash
pnpm release:gate <sha> --since <prod-sha>
```

- `<sha>` `origin/main` tarixida bo'lmasa — rad etadi.
- Shu commit uchun `verify` yashil tugamagan bo'lsa — rad etadi (havola bilan).
- `--since` ga hozir production'da turgan commit beriladi (image tegidagi qisqa
  SHA, masalan `mazetto-food-backend-pdslpm:0a459a9` → `0a459a9`). Shunda qaysi
  ilovalarni qayta deploy qilish kerakligi va yangi migratsiyalar ro'yxati
  chiqadi.

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

## 5. Nima uchun CorpEats'dan yumshoqroq

CorpEats'da `main` ga merge → image build → registry → SSH orqali avtomatik
deploy → avtomatik rollback. Mazetto'da bu ATAYLAB yo'q:

| CorpEats                                           | Mazetto                       | Sabab                                                                                      |
| -------------------------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------ |
| Har `main` push'da GHCR image build + push         | yo'q                          | image server'da yig'iladi; registry va uning sirlari qo'shimcha yuk                        |
| SSH orqali avtomatik deploy + rollback             | qo'lda reliz + `release:gate` | migratsiya production'da backup bilan qo'lda yuradi — avtomatik deploy uni chetlab o'tardi |
| nginx konfig validatsiyasi                         | yo'q                          | routing Traefik/Dokploy'da                                                                 |
| Backup, Telegram test, mobile workflow'lari        | yo'q                          | hozircha kerak emas                                                                        |
| `paths-ignore` (faqat hujjat o'zgarsa CI yurmaydi) | yo'q                          | majburiy check hujjat PR'ida ham kelishi kerak, aks holda PR bloklanadi                    |
| Turbo kesh                                         | yo'q                          | repo public — Actions daqiqalari bepul, soddalik ustun                                     |

CorpEats'dan olingani: eskirgan run'ni bekor qilish (`main` bundan mustasno),
pnpm store keshi, `workflow_dispatch`, `timeout-minutes`.

## 6. Keyin qo'shish mumkin

- **DB validatorlar** (`validate-*-db.ts`) — CI'da Postgres allaqachon bor, ya'ni
  ular bir martalik bazada xavfsiz yurishi mumkin.
- **Dockerfile build** — image yig'ilishi reliz paytida emas, PR'da yiqilsin.
- **Avtomatik deploy** — migratsiyasiz relizlar uchun (Dokploy API
  `application.deploy` yoki SSH), `release:gate` ning o'zi darvoza bo'lib.
- **Playwright QA** (`scripts/qa-*.mjs`) — tanlanganlari PR'da.
