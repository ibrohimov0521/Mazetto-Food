# Mazetto Staging Runbook

Sana: 2026-09-29
Maqsad: tenant identity va tenantlararo izolyatsiyani production'ga tegmasdan tekshirish.

## Muhit xaritasi

| Qism | Staging holati |
| --- | --- |
| Dokploy loyiha / environment | `Mazetto Staging / staging` |
| API | `Mazetto Staging API`, ichki servis; public domain/route yo'q |
| PostgreSQL | `mazetto-staging-postgres`, alohida bo'sh baza |
| Redis | `mazetto-staging-redis` |
| S3-compatible media | `mazetto-staging-media`, SeaweedFS 4.47, faqat staging |
| Production ma'lumotlari | Ko'chirilmagan |
| Telegram va BestTeam monitoring credential'lari | Kiritilmagan |
| DNS / public access | Ochilmagan |

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
- [x] Staging migration 53/53 va API/PostgreSQL/Redis/S3 infrastructure smoke.
- [x] Sintetik A/B fixture va HTTP/auth/domain fail-closed testlar (staging live smoke, 2026-09-30; PR #113/#114).
- [ ] Queue/worker, retry/idempotency va bot mock testlari.
- [ ] Media, customer/staff realtime, cache, device, audit/export/report A/B testlari.
- [ ] Mazetto Food order/POS/KDS/courier regression va screenshot baseline.
- [ ] Staging backup restore hamda rollback mashqi.
- [ ] Har bir production API domain uchun alohida login/refresh smoke va owner tasdig'i.

Barcha darvozalar o'tmaguncha production migration/deploy, DNS/public route va ikkinchi restoran faollashtirishni bajarma. Bu runbook production deploy uchun o'z-o'zidan ruxsat bermaydi.
