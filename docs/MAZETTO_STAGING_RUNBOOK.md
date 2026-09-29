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

## Release darvozasi

- [x] Alohida Dokploy staging project/environment va DB/Redis/media resurslari.
- [x] Staging migration 53/53 va API/PostgreSQL/Redis/S3 infrastructure smoke.
- [ ] Sintetik A/B fixture va HTTP/auth/domain fail-closed testlar.
- [ ] Queue/worker, retry/idempotency va bot mock testlari.
- [ ] Media, customer/staff realtime, cache, device, audit/export/report A/B testlari.
- [ ] Mazetto Food order/POS/KDS/courier regression va screenshot baseline.
- [ ] Staging backup restore hamda rollback mashqi.
- [ ] Har bir production API domain uchun alohida login/refresh smoke va owner tasdig'i.

Barcha darvozalar o'tmaguncha production migration/deploy, DNS/public route va ikkinchi restoran faollashtirishni bajarma. Bu runbook production deploy uchun o'z-o'zidan ruxsat bermaydi.
