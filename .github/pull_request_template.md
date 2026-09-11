## Nima o'zgardi

<!-- 1–3 jumla: nima va nima uchun. -->

## Qaysi qismlarga tegildi

- [ ] backend
- [ ] customer-web
- [ ] pos-web
- [ ] telegram-bot / print-agent
- [ ] media
- [ ] Prisma migratsiya (`apps/backend/prisma/migrations`)

## CI avtomatik tekshiradi

`verify` checki migratsiyalarni toza bazaga qo'llaydi, `pnpm run ci` ni
yurgizadi (prisma generate → typecheck → lint → test → build → validatorlar),
so'ng backendni production rejimida ishga tushiradi. U yashil bo'lmaguncha
merge qilinmaydi.

## CI tutmaydigan narsalar — qo'lda

Tegishli qatorlarni belgilang, tegishli bo'lmaganini o'chirib yuboring.

- [ ] Dizayn va UX real brauzerda ko'rildi
- [ ] Mobil layout: 360 / 390 / 430 / 768 / 1440 px, gorizontal scroll yo'q
- [ ] Yangi env o'zgaruvchi bo'lsa — production env'ga (Dokploy) qo'shildi
- [ ] Telegram token/webhook'ga tegilgan bo'lsa — webhook info tekshirildi
- [ ] Printerga tegilgan bo'lsa — real printerda sinaldi
- [ ] Cloudflare / DNS / domen o'zgarishi kerak bo'lsa — shu yerda yozildi
- [ ] Real ma'lumotdagi chekka holatlar ko'rildi (bo'sh ro'yxat, yopiq filial, uzun nom…)

## Migratsiya bo'lsa

- [ ] Migratsiya additive: ustun/jadvalni o'chirmaydi va nomini o'zgartirmaydi,
      ya'ni eski backend yangi sxemada ham ishlay oladi
- [ ] Relizdan oldin production baza backup'i olinadi

## Production'ga chiqarish

Merge bu yerda tugaydi — **avtomatik deploy yo'q.** Merge'dan keyin CI tugashi
bilan reliz egasiga (@ibrohimov0521) topshiriq issue'si ochiladi; prodga
chiqarish va undan oldingi barcha tekshiruv o'sha issue'da, uning zimmasida.
Qoidalar: `docs/RELEASE_RULES.md`.

Relizga tegishli bir narsa bo'lsa (yangi env, Dokploy sozlamasi, migratsiya
tartibi) — shu yerga yozing, issue'ga ko'chadi.
