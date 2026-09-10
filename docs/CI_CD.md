# MAZETTO FOOD — CI/CD

Maqsad: tekshirilmagan kod `main` ga ham, production'ga ham chiqmasin. Oddiy
o'zgarish o'zi deploy bo'lsin, lekin migratsiyali reliz (backup,
`prisma migrate deploy`) odam nazoratida qolsin.

```text
branch ──► PR ──► CI "verify" ── yashil bo'lishi SHART ──► merge
                                                             │
                   main'dagi commit uchun CI "verify" ◄──────┘
                                  │ yashil
                                  ▼
          Deploy workflow: release:gate — production tegidan beri nima o'zgardi?
                                  │
         ┌────────────────────────┴─────────────────────────┐
  migratsiya yo'q                                    migratsiya bor
         │                                                  │
  Dokploy API: o'zgargan ilovalar              to'xtaydi (ogohlantirish)
  → release:smoke                              → qo'lda reliz: backup, deploy,
  → production tegi suriladi                     migrate deploy, release:smoke,
                                                 production tegi
         │                                                  │
         └────── qo'lda: dizayn / mobil / Telegram / printer ┘
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

## 4. Avtomatik deploy

`.github/workflows/deploy.yml` — `main` dagi commit uchun `verify` yashil
tugagach ishga tushadi:

1. `release:gate` — commit `main` da va `verify` yashil ekani qayta tekshiriladi.
2. `production` tegidan beri qaysi ilovalar o'zgargani va yangi migratsiya
   bormi, aniqlanadi.
3. Quyidagilardan biri bo'lsa **deploy qilinmaydi** (ogohlantirish, xato emas):
   - yangi migratsiya bor → qo'lda reliz (5-bo'lim);
   - `production` tegi yo'q;
   - `main` bu orada oldinga ketgan → o'sha commit o'z CI'sidan keyin keladi.
4. O'zgargan ilovalar Dokploy API orqali **navbat bilan** deploy qilinadi:
   backend → customer-web → pos-web → telegram-bot → media. Har biri tugashi
   kutiladi. Har biridan oldin `main` hamon shu commit'da ekani qayta
   tekshiriladi, chunki Dokploy aniq commit'ni emas, branch uchini yig'adi.
5. `release:smoke` — konteyner ko'tarilishini kutib, 4 urinishgacha.
6. Hammasi o'tsa `production` tegi shu commit'ga suriladi.

Avtomatik rollback yo'q. Deploy yoki smoke yiqilsa job qizil bo'ladi, teg
joyida qoladi va Dokploy'da oldingi deploy'ga qo'lda qaytiladi
(`docs/DOKPLOY_DEPLOYMENT.md`, Rollback Notes).

Qo'lda ham yurgizish mumkin: Actions → **Deploy** → Run workflow. U `main`
uchini deploy qiladi va yuqoridagi shartlarning hammasi baribir amal qiladi.

### Yoqish — bir marta, repo admini

Workflow O'CHIQ holatda keladi: quyidagilar qilinmaguncha hech narsa deploy
qilmaydi.

**1. Dokploy'da**

- Settings → Profile → API/CLI → API kalit yarating.
- backend, customer-web, pos-web (kerak bo'lsa media, telegram-bot) ilovalarida
  **Autodeploy'ni o'chiring.** Aks holda Dokploy CI'ni kutmasdan har push'da
  o'zi deploy qiladi va bu darvoza ma'nosiz bo'ladi.
- Ilova ID'larini oling:

  ```bash
  curl -s -H "x-api-key: $DOKPLOY_API_KEY" "$DOKPLOY_URL/api/project.all" \
    | jq -r '.. | objects | select(has("applicationId") and has("appName")) | "\(.appName)  \(.applicationId)"'
  ```

**2. GitHub → Settings → Secrets and variables → Actions**

| Nomi                       | Turi     | Qiymat                                                               |
| -------------------------- | -------- | -------------------------------------------------------------------- |
| `DOKPLOY_URL`              | secret   | Dokploy panel manzili                                                |
| `DOKPLOY_API_KEY`          | secret   | 1-qadamdagi kalit                                                    |
| `DOKPLOY_APP_BACKEND`      | variable | backend `applicationId` — **majburiy**                               |
| `DOKPLOY_APP_CUSTOMER_WEB` | variable | customer-web `applicationId`                                         |
| `DOKPLOY_APP_POS_WEB`      | variable | pos-web `applicationId`                                              |
| `DOKPLOY_APP_MEDIA`        | variable | ixtiyoriy                                                            |
| `DOKPLOY_APP_TELEGRAM_BOT` | variable | ixtiyoriy                                                            |
| `AUTO_DEPLOY`              | variable | `true` — yoqadi; o'chirish uchun o'chiring yoki boshqa qiymat bering |

ID berilmagan ilova Dokploy'da emas deb hisoblanadi: avtomatik deploy
qilinmaydi, job summary'da "qo'lda" deb chiqadi. Backend bundan mustasno —
uning ID'si bo'lmasa `production` tegi surilmaydi, chunki migratsiyalar backend
bilan keladi. `print-agent` restoranda ishlaydi va hech qachon Dokploy'dan
deploy qilinmaydi.

**3. `production` tegi** — hozir production'da turgan commit'ga (image
tegidagi SHA):

```bash
git tag production <prod-sha> && git push origin production
```

**4. Tekshirish:** Actions → **Deploy** → Run workflow. Deploy qilmasa, nima
uchunligini job summary'da yozadi.

Ixtiyoriy: Settings → Environments → `production` → Required reviewers. Shunda
har deploy bitta tasdiq tugmasini kutadi.

`DOKPLOY_API_KEY` Dokploy panelga kirish beradi. U faqat secret sifatida
saqlanadi va workflow faqat `main` dagi push'dan keyin yuradi — fork'dan
kelgan PR unga yeta olmaydi.

## 5. Qo'lda reliz

Migratsiya bo'lsa, avtomatik deploy o'chiq bo'lsa yoki ilova Dokploy'da
bo'lmasa. Tartib `docs/MAZETTO_RELEASE_READINESS_CHECKLIST.md` da, unga uch
buyruq qo'shildi.

**Image yig'ishdan OLDIN:**

```bash
pnpm release:gate <sha>
```

- `<sha>` `origin/main` tarixida bo'lmasa — rad etadi.
- Shu commit uchun `verify` yashil tugamagan bo'lsa — rad etadi (havola bilan).
- `production` tegidan beri qaysi ilovalar o'zgargani va yangi migratsiyalar
  ro'yxatini chiqaradi. Boshqa nuqta bilan solishtirish: `--since <sha>`.

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

Avtomatik deploy va `release:gate` shu tegdan solishtiradi. Surilmasa, keyingi
avtomatik deploy allaqachon qo'llangan migratsiyani yana "yangi" deb ko'radi va
to'xtaydi.

## 6. Nima uchun CorpEats'dan yumshoqroq

CorpEats'da `main` ga merge → image build → registry → SSH orqali avtomatik
deploy → avtomatik rollback. Mazetto'da:

| CorpEats                                           | Mazetto                                            | Sabab                                                                   |
| -------------------------------------------------- | -------------------------------------------------- | ----------------------------------------------------------------------- |
| Har `main` push'da GHCR image build + push         | yo'q — image server'da (Dokploy) yig'iladi         | registry va uning sirlari qo'shimcha yuk                                |
| Har `main` push'da SSH orqali deploy               | Dokploy API orqali, faqat migratsiyasiz commit'lar | migratsiya production'da backup bilan qo'lda yuradi                     |
| Avtomatik rollback                                 | yo'q — job qizil bo'ladi, qaytarish qo'lda         | rollback bazani qaytarmaydi; qarorni odam qabul qiladi                  |
| nginx konfig validatsiyasi                         | yo'q                                               | routing Traefik/Dokploy'da                                              |
| Backup, Telegram test, mobile workflow'lari        | yo'q                                               | hozircha kerak emas                                                     |
| `paths-ignore` (faqat hujjat o'zgarsa CI yurmaydi) | yo'q                                               | majburiy check hujjat PR'ida ham kelishi kerak, aks holda PR bloklanadi |
| Turbo kesh                                         | yo'q                                               | repo public — Actions daqiqalari bepul, soddalik ustun                  |

CorpEats'dan olingani: eskirgan run'ni bekor qilish (`main` bundan mustasno),
deploy'ni yarmida bekor qilmaslik, `workflow_run` dagi branch shartini job'da
takrorlash, pnpm store keshi, `workflow_dispatch`, `timeout-minutes`.

## 7. Keyin qo'shish mumkin

- **DB validatorlar** (`validate-*-db.ts`) — CI'da Postgres allaqachon bor, ya'ni
  ular bir martalik bazada xavfsiz yurishi mumkin.
- **Dockerfile build** — image yig'ilishi deploy paytida emas, PR'da yiqilsin.
- **Deploy xabarnomasi** — natija Telegram kanaliga.
- **Playwright QA** (`scripts/qa-*.mjs`) — tanlanganlari PR'da.
