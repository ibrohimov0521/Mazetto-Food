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
- The previously deployed staging image reported 54 migrations before the DLQ migration. After `20261003190000_notification_dead_letters` was applied, that older image reported 55/55. The merged `main` image contains two earlier migrations absent from that image; its first status check correctly surfaced them as pending. See the rollout record below.
- The new `notification_dead_letters` table exists and contains 0 rows. Staging API health returned HTTP 200 with PostgreSQL `ok` and Redis `connected`.
- Production database and services, real Telegram delivery, and restaurant orders were untouched.

## Staging backend rollout (2026-10-04)

- PR #218 was squash-merged to `main` as `2ed50cd121889c79b2754544a5a43ba4df55a9f1`; hosted CI passed before merge. The staging backend image was built from that merged tree: tag `mazetto-staging-api-crmkze:2ed50cd`, image ID `sha256:b39703709682274be78d5a563035988493cf579d811ef6b9f24e7adacb845f0a`.
- Before changing the staging service, the previous image `sha256:80ad57427f01486a39aa141ccdab450eaf2c6f7f049b6ebe79a6969fdc2c2087` was retained as `mazetto-staging-api-crmkze:rollback-2ed50cd`.
- The new image was deployed only to Swarm service `mazetto-staging-api-crmkze`. The Dokploy browser session was unauthenticated, so this was a direct staging-only Swarm update, not a Dokploy UI deployment. No production service was changed.
- Before resolving the two pending historical migrations, a fresh staging-only backup was created at `/home/javohir/backups/mazetto-staging/mazetto-20261004-before-pending-staging-migrations.dump`; SHA-256: `4c5526c18b188aac783597595782534246d7c7fa7d0074a80a1925708e6d5bee`. `pg_restore --list` succeeded and returned 700 archive entries.
- The merged image reported 57 migrations, with `20260930130000_branch_realtime_revision` and `20261002180000_print_driver_submission_status` pending. Both were applied to staging using the image's Prisma CLI and `prisma migrate deploy`; final status: 57/57 up to date.
- The new task is running the expected image. `/api/v1/health` returned HTTP 200 with PostgreSQL `ok` and Redis `connected`; `notification_dead_letters` contains 0 rows.
- The post-rollout staging A/B harness passed: tenant membership/cache isolation, order event delivery/reconnect, customer logout revocation, verified/unknown host handling, report/audit scope, OTP sessions, and media isolation. Synthetic `.invalid` host fixtures were cleaned up; no real Telegram/SMS delivery occurred. After cleanup, health remained 200 and migrations remained 57/57.
- The rollback image remains available locally. This rollout validates startup, schema compatibility, and health; it does not prove live Telegram delivery or all restaurant workflows. Production migration/deploy, public staging access, and second-tenant activation remain closed.

## Staging A/B recheck (2026-10-13)

- The staging API container was running image `mazetto-staging-api-crmkze:f6531fc` (revision `f6531fc35c9122e908f30175a563deb871e05fde`, built 2026-10-04). Its internal health endpoint returned HTTP 200; PostgreSQL was `ok` and Redis was connected.
- The guarded `qa-tenant-ab-staging.mjs` harness passed on that deployed staging image: tenant membership/cache separation, live order delivery and reconnect, customer logout revocation, host/domain checks, reports/audit, OTP sessions and tenant media isolation.
- The harness completed its synthetic fixture and media cleanup and verified the original staging baseline. No production service, database, DNS, real Telegram, SMS or customer data was used.
- The baseline proof above was against old image `f6531fc`; candidate rollout and proof are recorded below. Production remains at 59/61 and unchanged.

## Audit candidate staging rollout (2026-10-13)

- Built from exact PR #296 commit `8b42159818718d8339dcfd0e6c48ade1b89ec58e` as image `mazetto-staging-api-crmkze:8b42159`. Previous image `f6531fc` remains available as rollback tag `rollback-8b42159`.
- Before migration, staged a backup of database `mazetto_staging`: `/home/javohir/backups/mazetto-staging/mazetto-staging-before-audit-8b42159-20261013.dump`; SHA-256 `9ecb4ea5386007e7286954a1fa9c57f60810609fc84c597d34a264670af9d92d`. `pg_restore --list` returned 716 entries.
- Staging was at 58 migrations; candidate `prisma migrate deploy` successfully applied `20261009190000_partial_cash_item_refunds`, `20261013120000_product_kitchen_printer_routing`, and `20261013140000_tenant_scoped_order_numbers`. Final status: 61/61; no failed or unfinished migration.
- Staging Swarm service converged on the candidate image with stop-first update and rollback-on-failure. Internal `/api/v1/health` returned HTTP 200, database `ok`, Redis `connected`.
- The guarded `qa-tenant-ab-staging.mjs` harness passed on the candidate, including tenant membership/cache separation, live order delivery/reconnect, logout revocation, host/domain, reports/audit, OTP and tenant media isolation. Synthetic fixtures were cleaned up; post-cleanup health remained 200 and migrations 61/61.
- This does not prove full cashier-to-kitchen-to-cash/receipt UI acceptance, physical printer paper output, real Telegram/SMS or NBU settlement. Those remain open. Production DB/service and second-tenant activation were not changed.

## PR #303 follow-up candidate staging rollout (2026-10-14)

- Exact PR head `379f3c0660c054d8e1e50e1ff66b37744c3b0e7b`; CI run #874 (`38547858823`) passed both `windows-desktop-package` and `verify`, including migrations on clean PostgreSQL, full CI suite, media smoke, unified cash DB integration, customer checkout/outbox DB integration and backend health smoke.
- The source change makes POS cash completion conditional on `kitchen_pos_orders_enabled`. With kitchen visibility off, full cash payment completes the POS order; with it on, kitchen handoff owns ticket completion without double-counting cash. Customer payment input now accepts CASH only; unsupported methods are rejected. NBU QR/SMS integration is absent from active app code; historical proposals remain cancelled.
- Built image `mazetto-staging-api-crmkze:379f3c0` (image ID `sha256:31abad2c25f3c84935f4b0f035aeb51db60b439145c468d7b7d7fd0d294084b8`) and deployed it only to the staging Swarm service with stop-first update, a 60-second stability monitor and rollback-on-failure. Previous image tag `rollback-98f4027` remains available.
- Before deployment, backed up database `mazetto_staging` to `/home/javohir/backups/mazetto-staging/mazetto-staging-before-pr303-379f3c0-20261014T101942Z.dump` (299,114 bytes; SHA-256 `80a2a101ca6ab6e3056946bfc0e9242c6fba37f9f9dcea2d6519c1059311d8c7`). `pg_restore --list` passed with 722 archive entries. No schema migration was added; staging remained at 62/62.
- Post-deploy internal health returned HTTP 200, PostgreSQL `ok`, Redis `connected`. The guarded tenant A/B harness passed on the exact image, including catalog/homepage isolation, realtime order delivery/reconnect, logout revocation, host/domain, reports/audit, OTP and media isolation. Cleanup verified baseline restoration and removal of synthetic fixtures.
- The staging A/B harness does not execute an authenticated POS cash write. CI proves the database-level cash/kitchen rules; exact-candidate authenticated staging, staff/device acceptance and production release remain open.

## Legacy shift cash reconciliation rollout (2026-10-14)

- Commit 75d915c9fe72b0e4c44783c3d9b3a9bb1b9d0482 passed CI run #881 (38559698948), including the Windows Desktop package and full verification.
- Built image mazetto-staging-api-crmkze:75d915c (sha256:4e64089abed862e103ee179c264d3ef1e7cac7828e5c070adeb59b1f610cd41f). The previous staging image 379f3c0 is preserved as rollback-75d915c.
- Before rollout, backed up only database mazetto_staging to /home/javohir/backups/mazetto-staging/mazetto-20261014-115612441.dump (299,114 bytes; SHA-256 59fd35d5bb26455e562277249a5a610fe1f3d57d5c558f6710c40b30dd240fa5). pg_restore --list passed with 707 entries.
- Deployed only to the staging Swarm service with stop-first and rollback-on-failure; the service converged after its 60-second stability monitor. No schema migration was needed.
- Exact image health returned HTTP 200, PostgreSQL ok, Redis connected. Prisma reported 62 migrations found and schema up to date.

## PR #306 inventory/report validation rollout (2026-10-18)

- Exact PR head `e887ac81b463074ff468d956201e7ab2a72caf70` passed CI run #911: Windows package and full `verify` succeeded. The change adds bounded integer movement-history limits, strict inventory/report dates, and inclusive custom report range validation; it adds no migration.
- Before rollout, backed up only staging database `mazetto_staging` to `/home/javohir/backups/mazetto-staging/mazetto-staging-before-pr306-20261017T194127Z.dump`; SHA-256 `8f0634f83213f50ca4c29d464437bd82e32e901119cde721e34bb3ded8e6fe72`. `pg_restore --list` returned 722 entries.
- Built image `mazetto-staging-api-crmkze:pr306-e887ac8` from the exact committed archive, excluding untracked editor backups. Previous image `sha256:fc75dbeda8327395d4f7ce66169f352ca7ab87eca7cc69191d3cffdcf07a2d20` is retained as `rollback-pr306-e887ac8`.
- Deployed only to staging service `mazetto-staging-api-crmkze` with stop-first update, a 60-second stability monitor and rollback-on-failure. No migration was run; staging stayed at 62/62.
- Exact image health returned HTTP 200, PostgreSQL `ok`, Redis `connected`. The guarded tenant A/B harness passed its order/cash/refund/shift, kitchen, realtime, host/auth, reports/audit, OTP and tenant-media checks; its cleanup/baseline assertions passed.
- Production is unchanged at `e62321c`; PR #306 remains open. This staging proof does not claim physical-printer or employee-device acceptance.

## PR #306 pagination offset follow-up (2026-10-18)

- Exact code commit `3e2921ce7a9ba0560395f0db91617729f6255343` passed CI #913, including Windows packaging and full `verify`. Paginated list DTOs now reject offsets above 1,000,000; raw cashier/kitchen history offsets use the same cap. No migration was added.
- Before rollout, backed up only `mazetto_staging` to `/home/javohir/backups/mazetto-staging/mazetto-staging-before-offset-3e2921c-20261017T200219Z.dump`; SHA-256 `b9bc67283c152c15b06a1d5665eeb9c1883563f868c6ac70db3900eeb8cb1774`. `pg_restore --list` returned 722 entries.
- Built exact image `mazetto-staging-api-crmkze:pr306-3e2921c`; prior image `sha256:93bf6ec37e0e15d9299f523a421e1143f650629ac16f3d56ad29131946c07e68` is retained as `rollback-pr306-3e2921c`.
- Deployed only to staging service `mazetto-staging-api-crmkze` using stop-first, a 60-second stability monitor and rollback-on-failure. There was no migration; staging remained at 62/62.
- Exact candidate health returned HTTP 200 with PostgreSQL `ok` and Redis `connected`. The guarded tenant A/B harness passed its fixture cleanup/baseline assertions and order/cash/refund/shift, kitchen, realtime, host/auth, reports/audit, OTP and media checks.
- Production remains on `e62321c`; PR #306 is not yet merged. This staging proof does not imply physical-printer or employee-device acceptance.

## PR #306 production release (2026-10-18)

- PR #306 merged to `main` as `1a1bf8fea10e74dbee25eb907b6e4dac8ae17076`. Main CI #39066228634 passed Windows Desktop packaging and full `verify`.
- Deploy workflow #39066743457 passed the release gate, deployed only the backend, and passed production smoke 27/27. The remote `production` tag was advanced from `e62321c` to `1a1bf8f` and verified equal to `main`.
- The PR adds no migration; production remains at 62/62 migrations. No production database write was part of this release. The second restaurant remains inactive.
- Staging evidence for exact image `mazetto-staging-api-crmkze:pr306-3e2921c`, its backup and rollback image is recorded in the pagination offset follow-up above. Physical printer and employee-device acceptance is not implied by CI or smoke.

## Production media-volume recovery check (2026-10-18)

- Production media service `mazetto-food-media-btinws` uses Docker volume `mazetto-media` mounted at `/media`. Read-only size check: 63.4 MB and 171 files.
- Backup: `/home/javohir/backups/mazetto-prod-media/mazetto-media-20261017T204149Z.tar.gz`; SHA-256 `7f0e14365c04f907cb7f49fd1f392becc7d1fac828b5507b39d22ec85ab1194b`; archive size 65,808,605 bytes.
- SHA manifests before/after snapshot were identical. Restored to isolated `/home/javohir/backups/mazetto-prod-media/restore-check-20261017T204149Z`; all 171 files matched the live manifest. No production write or service interruption occurred.
- Backup directory and restore directory are mode 700; backup/manifests mode 600. This is same-host recovery evidence only; offsite copy and automated retention remain unverified.
