# Mazetto Staging Runbook

Sana: 2026-09-29
Maqsad: tenant identity va tenantlararo izolyatsiyani production'ga tegmasdan tekshirish.

## Muhit xaritasi

| Qism                                            | Staging holati                                                |
| ----------------------------------------------- | ------------------------------------------------------------- |
| Dokploy loyiha / environment                    | `Mazetto Staging / staging`                                   |
| API                                             | `Mazetto Staging API`, ichki servis; public domain/route yo'q |
| PostgreSQL                                      | `mazetto-staging-postgres`, alohida bo'sh baza                |
| Redis                                           | `mazetto-staging-redis`                                       |
| S3-compatible media                             | `mazetto-staging-media`, SeaweedFS 4.47, faqat staging        |
| Production ma'lumotlari                         | Ko'chirilmagan                                                |
| Telegram va BestTeam monitoring credential'lari | Kiritilmagan                                                  |
| DNS / public access                             | Ochilmagan                                                    |

Staging API health tekshiruvi: `/api/v1/health` 200 qaytarishi, PostgreSQL `ok` va Redis `connected` bo'lishi kerak. Media tekshiruvi app ichidagi S3 SDK bilan staging bucket mavjudligini tasdiqlaydi. 2026-09-29 dagi tekshiruvlar o'tdi.

Boshlang'ich DB'da 53 migration qo'llangan, 1 baseline ACTIVE tenant va 0 filial/user/customer/membership bor. Bu A/B biznes oqimlari ishlashini anglatmaydi.

## Staging A/B smoke natijasi (2026-09-30)

apps/backend/scripts/qa-tenant-ab-staging.mjs faqat staging API containerida, ichki loopback API manziliga qarshi ishlaydi:

    docker exec -e MAZETTO_STAGING_AB_QA=1 <staging-api-container> node /app/apps/backend/scripts/qa-tenant-ab-staging.mjs

Harness production rejimini, aniq staging DB host/name'ini, 127.0.0.1 API manzilini va fixture boshlanishidagi bo'sh DB holatini tekshirmasa ishni boshlamaydi. Tenant domenlari .invalid; email/telefon/OTP sintetik. Telegram, SMS va tashqi webhook yuborilmaydi. Sinov vaqtida staging'da vaqtinchalik B tenant ACTIVE qilinadi; production tenant holatiga ta'sir qilmaydi. Fixture faqat o'zi yaratgan identifikatorlar bilan tozalanadi va yakunda baseline sonlar qayta tekshiriladi.

2026-09-30 live staging natijasi: verified/pending/unknown host fail-closed; A/B branch va public settings ajratilishi; staff membership/login/access token hamda cross-tenant settings write denial; bir xil telefon uchun tenant-scoped OTP/customer identity/session/access/refresh tekshiruvlari o'tdi. Cleanup'dan keyin DB baseline'ga qaytdi: 1 ACTIVE tenant, 0 branch/user/membership/domain/customer/challenge/setting/role/permission fixture; migration 53/53, health 200, Redis ulangan, staging S3 bucket mavjud.

## Ajratish qoidalari

1. Production DB, Redis, media, bot tokenlari, monitoring tokenlari va mijoz ma'lumotlarini staging'ga ulama yoki ko'chirma.
2. Staging domenini Cloudflare/DNS yoki Dokploy public route'iga qo'shma. Tenant host testlari uchun faqat test harness'dagi soxta Host ishlat.
3. Tenant, email, telefon, order, upload, device va export fixture'lari sintetik bo'lsin. Domen misollarida `.invalid` host ishlat; hech qachon real yuboriladigan Telegram/chat/token qiymatini kiritma.
4. Staging bot sinovlari mock transport bilan bajariladi. Production bot service yoki webhook'ini staging'dan ishga tushirma.
5. Credential va env qiymatlarini log, diff, terminal output, screenshot yoki test reportga chiqarma.
6. Dokploy staging ilovasi hozir `main` branch'ini kuzatadi. Deploydan oldin image/build commit SHA'ni tekshir; faqat staging project/environment va staging resurslari target ekanini qayta tasdiqla.
7. Staging DB'ni tozalash, restore qilish yoki fixture seed qilishdan oldin connection'i staging resursiga tegishli ekanini fail-closed tekshir. Production'ga o'xshash hostname yoki database aniqlansa testni darhol to'xtat.

## Migration tartibi

1. Staging PostgreSQL uchun restore qilinadigan backup yoki disposable snapshot ol.
2. Backend commit SHA va Prisma migration checksumlarini saqla.
3. Migration'ni faqat staging env bilan bir martalik runner/container ichida `prisma migrate deploy` orqali qo'lla; doimiy app start command'ini migration command'iga almashtirma.
4. Migration status, `/api/v1/health`, PostgreSQL va Redis holatini tekshir.
5. Xato bo'lsa production'ga tegma. Staging'ni snapshot'dan tikla yoki migration egasi bilan forward-fix rejasini yoz; migration tarixini qo'lda o'zgartirma.

## A/B test ma'lumotlari

Disposable fixture quyidagilarni yaratishi kerak:

- A va B tenant, alohida branch, owner/staff/customer identity va membership.
- Har bir tenant uchun alohida verified test-domain yozuvi (`.invalid` host, faqat test DB ichida), unique test product/setting/order.
- A va B'da bir xil telefon/email qiymatidan foydalaniladigan identity holati, agar model bunga ruxsat bersa; session/token/customer yozuvlari aralashmasligi shart.
- Haqiqiy shaxsiy ma'lumotsiz order, upload, device, export va audit fixture'lari.
- Haqiqiy Telegram credential'siz test bot mapping'i va fake transport.

Sinovlar har bir holatda ruxsat etilgan va rad etilgan javobni tekshirishi kerak:

- A host + A membership muvaffaqiyatli; A token + B host, membership yoki tenant ID rad etiladi.
- Noma'lum host, unverified host, nofaol tenant/membership va ambiguous tenant fail-closed bo'ladi.
- Branchsiz yoki legacy record egasi aniq bo'lmasa, data qaytarmaydi va mutation'ni rad etadi.
- A setting/order/session/cache key/media object/report/export B'dan ko'rinmaydi; xuddi shu tekshiruv teskarisiga ham o'tadi.
- Har worker/job event'de trusted tenant ID saqlanadi; retry, duplicate delivery va idempotency A/B chegarasini buzmaydi.
- WebSocket reconnect va status/rol o'zgarishidan keyin eski socket/token ishlamaydi.
- Customer, staff va Telegram oqimlari bir xil global bot identity yoki session'ni tenantlararo ulashmaydi.
- Device registration, audit/search, CSV/export va monitoring agregatlari faqat tegishli tenant/branch scope'ini ko'rsatadi.
- Media upload yangi tenant prefiksiga yoziladi; oldingi global object'lar dalilsiz qayta tasniflanmaydi.

Testlar disposable staging fixture bilan ishlasin va yakunda yaratilgan yozuvlarni o'z fixture marker'i bo'yicha olib tashlasin. Umumiy staging ma'lumotini tozalovchi keng qamrovli `delete all` amali taqiqlanadi.

## Mazetto Food regression

Staging backend relizidan keyin mavjud Mazetto Food oqimlarini brend va biznes mantiqini o'zgartirmasdan tekshir:

- customer menu/checkout -> POS -> kitchen -> waiter/courier statuslari;
- parallel order, retry, duplicate webhook/idempotency va payment/order reconciliation;
- WebSocket uzilishi/reconnect, worker retry, receipt/print queue;
- role/branch permissions, admin reports va mobil/API contract;
- mavjud Mazetto Food logo, rang, layout va ekranlar uchun screenshot baseline.

Haqiqiy printer, to'lov yoki Telegram tashqi xizmatiga staging'dan side effect yuborma; test adapter/mock ishlat.

## Backup / restore / rollback

1. Faqat staging DB va staging object store'ni backup qil; sana, commit SHA va checksumni qayd et.
2. Restore'ni production'dan tarmoq jihatdan ajratilgan temporary PostgreSQL/object store'ga bajar.
3. Restore qilingan DB'da migration status, A/B asosiy jadval sonlari, login/domain smoke va object prefixlarini tekshir.
4. Rollback/forward-fix yo'lini bajargach, test resurslarini xavfsiz tugat; production volume yoki secret'lariga tegma.
5. Restore/rollback natijasi qayd etilmaguncha production migration yoki ikkinchi tenant activation yo'q.

## Telegram retry va dead-letter mock sinovi (2026-09-30)

apps/backend/test/telegram-notification-retry.test.ts fake fetch javoblari bilan tashqi tarmoqqa chiqmasdan Telegram order bildirishnomasining uch martalik 503 retry'sini, A tenant dead-letter yozuvining B ro'yxatidan ajralishini va tenant konteksti noaniq bo'lsa retry bloklanishini tekshiradi. Kontekst aniq bo'lgach mock muvaffaqiyatli javob beradi va eski dead-letter olib tashlanadi.

Bu test alohida durable queue/worker, real Telegram webhook/token, staging bot delivery yoki order boshidan POS/KDS/courier regression isbotlamaydi. Shu sababli release gate'dagi queue/worker va bot mock bandi hozircha ochiq qoladi.

## Tenant media A/B smoke (2026-09-30)

Staging A/B harness media tekshiruvini ham bajaradi. U faqat MINIO_ENDPOINT=mazetto-staging-minio va MINIO_BUCKET=mazetto-staging bo'lganda davom etadi; credential qiymatlarini chiqarmaydi. Authenticated A/B staff tokenlari bilan haqiqiy /uploads/image endpointiga bitta sintetik PNG yuboriladi, B tokenining A hostida uploadi rad etilishi shart, object keylar tenant prefiksiga mos bo'lishi va staging bucketda statObject bilan topilishi tekshiriladi.

    docker exec -e MAZETTO_STAGING_AB_QA=1 <staging-api-container> node /app/apps/backend/scripts/qa-tenant-ab-staging.mjs

2026-09-30 live staging natijasi o'tdi. Harness faqat o'zi qaytargan A/B object keylarini o'chirib, har birining yo'qligini qayta tekshiradi; DB fixture cleanup ham bir ACTIVE baseline tenant va qolgan fixture jadvallarida 0 qatorni tasdiqladi. Bu private staging sinovi, production media, bucket yoki biznes rasmlariga tegilmagan.

## Release darvozasi

- [x] Alohida Dokploy staging project/environment va DB/Redis/media resurslari.
- [x] Staging migration 54/54 va API/PostgreSQL/Redis/S3 infrastructure smoke.
- [x] Sintetik A/B fixture va HTTP/auth/domain fail-closed testlar (staging live smoke, 2026-09-30; PR #113/#114).
- [x] Fake transport bilan Telegram retry/dead-letter tenant isolation testi (unit/mock).
- [ ] Durable queue/worker, idempotency va restoranlarga alohida Telegram bot/webhook mapping.
- [x] Tenant-prefixed media upload va staff WebSocket auth A/B smoke (staging only; 2026-09-30).
- [x] Tenant device enrollment, audit list/facets, report/dashboard A/B scope (staging only; PR #123/#124/#125, 2026-09-30). Sales CSV is client-side and reads the scoped sales-report payload.
- [x] Customer WebSocket/revocation, actual staff event delivery/reconnect va shared cache A/B tests (staging live proof, PR #126/#127, 2026-09-30).
- [ ] Mazetto Food order/POS/KDS/courier regression va screenshot baseline.
- [ ] Staging backup restore hamda rollback mashqi.
- [ ] Har bir production API domain uchun alohida login/refresh smoke va owner tasdig'i.

Barcha darvozalar o'tmaguncha production migration/deploy, DNS/public route va ikkinchi restoran faollashtirishni bajarma. Bu runbook production deploy uchun o'z-o'zidan ruxsat bermaydi.

## Realtime event scope A/B (2026-09-30)

- PR #119 tightened Kitchen Gateway scope: branch/customer rooms now come only from persisted order/ticket ownership; unresolved records fail closed. Unit tests cover forged payload branch IDs and deleted order records.
- The guarded live staging harness verifies A/B outbox catch-up, foreign-branch denial, and cursor pagination; the post-run staging DB returns to its baseline.
- PR #119 (1f970bb) was merged after hosted CI passed; only the isolated staging API was redeployed. Health returned 200, PostgreSQL was ok, Redis was connected, and the live A/B harness passed.
- Staff WebSocket authentication on each tenant host and cross-host/unknown-host rejection are now proven separately by the following live A/B smoke. Actual event delivery/reconnect, customer socket revocation, cache/device/export/report isolation, full POS/KDS/courier workflows, and restore/rollback remain open.

## Staff WebSocket authentication A/B (2026-09-30)

- The staging-only harness now creates separate synthetic owner accounts and branch-scoped staff/Employee records for tenants A and B. This preserves the existing owner settings/media tests while exercising real Socket.IO handshakes for actual branch staff.
- Each staff account connected on its own verified synthetic host. A token on B's host, B token on A's host, and a tenant token on an unknown host all failed to remain connected. The client maps only the synthetic hostname to 127.0.0.1; no public DNS or egress is used.
- The harness waited for the server's post-connect authorization/disconnect decision, then closed successful sockets before deleting fixtures. Live run passed on the isolated staging API; fixture cleanup returned the database to its baseline and removed test media objects.
- This proves staff socket host/membership authentication, not actual order event delivery/reconnect or customer socket revocation. Those remain release gates.

## Tenant audit izolatsiyasi (2026-09-30)

- Audit yozuvlariga nullable tenant bog'lanishi va `(tenantId, createdAt)` indeksi qo'shildi. Yangi tenant amallari audit izini tegishli tenant bilan yozadi; eski tenant-siz yozuvlar backfill qilinmaydi va faqat platform egasiga ko'rinadi.
- Audit ro'yxati va filter facetlari tenant membership kontekstiga ko'ra chegaralandi. Tenant-siz restaurant admin global auditni ko'ra olmaydi; tenantId/membershipId nomuvofiqligi rad etiladi.
- Report/dashboard A/B tenant scope va audit list/facet scope uchun testlar qo'shildi. Lokal backend test, typecheck, lint va build o'tdi.
- Staging live A/B o'tdi: audit ro'yxati/facetlari A va B tenantlarida ajraldi; sales report A/B javoblari 200, A token bilan B branch report so'rovi 404 bo'ldi. Cleanup 1 baseline tenant, 0 branch/user va 6 baseline audit yozuvini tikladi.
- 54/54 migration, API health 200; staging deploy commit 757f5ad95829edab8a4922b2e873a24823f924d2. Pre-migration backup: /home/javohir/backups/mazetto-staging/mazetto_staging-before-tenant-audit-20260930T012128Z.dump; SHA-256 f77a209907128cb3f93ee532093942fa705ad0c043fb966389e686c48347205c, pg_restore --list passed.
- Birinchi smoke audit fixture izini qoldirdi; uni pre-test backup bilan solishtirib faqat bitta aniq synthetic row sifatida olib tashladik. Cleanup PR #125 endi unique fixture user ID'lari bo'yicha auditlarni user delete'dan oldin o'chiradi; qayta live smoke to'liq o'tdi. Restore/rollback mashqi hali alohida darvoza.
- Production migratsiyasi/deployi qilinmadi; qolgan release darvozalari yopilmaguncha production va ikkinchi tenant faollashtirilmaydi.


## Customer/staff realtime va membership cache A/B (2026-09-30)

- PR #126 staging harness kengaytmasi va #127 canonical permission fixture tuzatishi main'ga merge qilindi. Hosted CI #397/#399 muvaffaqiyatli; backend typecheck, lint, 463 test + 3 HTTP retry testi o'tdi.
- Faqat alohida Dokploy staging backend e3c3931c7f5b0dd4a53442ec2a77477bf620b1d0 commitiga deploy qilindi. Health 200, PostgreSQL OK, Redis connected.
- Bir xil foydalanuvchi tenant A va B membershiplarida ataylab turli rollarga ega bo'ldi. Login va /auth/me A-only rolni faqat A'da ko'rsatdi; B'da global user cache'dan A roli chiqmagan.
- Haqiqiy POST /orders oqimi A/B branch staff WebSocket'lariga buyurtma hodisasini chiqardi: har socket faqat o'z tenantining order ID'sini oldi. A staff socket qayta ulangach, catch-up cursor faqat A order eventini qaytardi.
- Customer A/B socketlari ulandi; A logout A sessiyasini darhol uzdi, B socket faol qoldi, A access token bilan qayta ulanish rad etildi.
- Yakuniy cleanup'dan so'ng A/B test tenant, branch, user, membership, domain, customer/session, setting, order, order event/outbox, role/permission fixture'lari yo'q qilindi; DB boshlang'ich baseline'i va health qayta tasdiqlandi. Synthetic .invalid hostlar ishlatildi; real SMS, bot yoki production ma'lumotlariga tegilmadi.
- Bu realtime/auth-cache darvozasini staging uchun yopadi; Mazetto Food production va ikkinchi tenant holatiga tegilmagan. Keyingi tartib: durable worker/queue va idempotency + bot mapping audit; keyin offline/online order, POS, kitchen, courier va receipt/printer regression; undan keyin backup restore/rollback hamda har production domen uchun read-only login/refresh smoke. Har bir release gate alohida staging'da o'tmaguncha production deploy/migration yoki ikkinchi tenant activation yo'q.
## Telegram dead-letter durable fallback migration (2026-10-04)

- PR #218 commit `a04ebd0b7382931c3b48c0f2fd58f82222223f04`; hosted CI run #594 passed, including applying all migrations to a clean PostgreSQL database.
- Before staging migration, a verified backup was created at `/home/javohir/backups/mazetto-staging/mazetto-20261003-184541644.dump`; SHA-256: `11961d026032934290073c2ea06d785f7c268f1c8e2ca41f1efd5ef8e13a9996`. The archive contained 675 entries and passed `pg_restore --list`.
- Staging database `mazetto_staging` was at 54 migrations before the change. Migration `20261003190000_notification_dead_letters` was applied with `prisma migrate deploy`; afterward 55/55 migrations were up to date.
- The new `notification_dead_letters` table exists and contains 0 rows. Staging API health returned HTTP 200 with PostgreSQL `ok` and Redis `connected`.
- This verifies the additive schema migration only. The backend code from PR #218 has not yet been deployed to staging; production database, services, Telegram, and restaurant orders were untouched.
