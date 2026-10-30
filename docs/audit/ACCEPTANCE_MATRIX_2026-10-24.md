# Mazetto Food biznes qabul jadvali — 2026-10-24

Jadval ushbu branch’dagi ishni production’dagi mavjud holatdan ajratadi. “Kodni ko‘rib chiqish” yoki avtomatik test staging va real biznes qabulining o‘rnini bosmaydi.

Production bazasi: `e8ae781356fdab6878c28694bad93c556eb11a33` (`main` va masofadagi `production` tag). Deploy workflow #352 (`40091743808`) shu bazada muvaffaqiyatli; mazkur audit branch’i production’da yo‘q. Desktop release: `0.1.120`.

| Talab | Kod | Avtomatik test | Staging | Real qabul | Production |
|---|---|---|---|---|---|
| Yangi restoran ochish va filial kodini normallashtirish | Bajarilgan: forma `BEST FOODS`ni `BEST_FOODS` qiladi; tenant PROVISIONING yaratiladi | Bajarilgan: filial kodi, provisioning va owner oqimi sinovlari | Kutilmoqda: platform panelida yangi sinov tenant yaratish | Kutilmoqda: admin operator va owner bilan tasdiqlash | Audit branch’i chiqarilmagan |
| Owner parolini tiklash | Bajarilgan: faqat faol SUPER_ADMIN hisobi, yangi parol admin tomonidan ikki marta kiritiladi, plaintext hash/auditga kirmaydi, sessiyalar bekor qilinadi | Bajarilgan: owner ruxsati, tasdiq, arxiv blokirovkasi, audit va sessiya bekor qilish testlari | Backend image pr319-bd75baa stagingda; health 200, 64/64 migration va A/B smoke otgan. Staging owner reset UI/login yo'li yo'q, end-to-end qabul kutilmoqda | Kutilmoqda: operator va restoran egasi bilan | Audit branch’i production’da chiqarilmagan |
| Tenantni xavfsiz faollashtirish | Bajarilgan: branch/domain/owner/Telegram shartlari va serverdagi alohida xavfsizlik bayrog‘i; default yopiq, TXT sayt marshruti deb olinmaydi | Bajarilgan: yopiq darvoza, readiness blocker, tranzaksiyada qayta tekshiruv, aniq tasdiq va audit | PR #319 backend nomzodida A/B izolatsiyasi o‘tdi; public DNS/TLS/POS marshruti yo‘q, darvoza yopiq | Kutilmoqda: owner login va kanal holati | Audit branch’i production’da yo‘q |
| Arxivlash va tiklash | Bajarilgan: hard delete yo‘q; ma’lumot saqlanadi, ochiq order/smena va hal qilinmagan pul o‘tkazmasi bloklaydi, audit bilan tiklanadi | Bajarilgan: preview, protection, order blocker, audit va restore sinovlari | Kutilmoqda: faqat alohida sinov tenantida | Kutilmoqda: operatorning warning/restore oqimi | Audit branch’i chiqarilmagan |
| Sayt domeni → backend tenant → POS order | Bajarilgan: custom host same-origin API proxy; tenant backend’da tekshiriladi | Bajarilgan: host resolver va customer API URL testlari | Candidate backend’da host/domain va A/B testlari o‘tdi; public web/POS marshruti va to‘liq oqim hali yo‘q | Kutilmoqda: mijoz mobil brauzeri va POS operatori | Audit branch’i production’da yo‘q |
| Telegram tenant routing va xodimlar guruhi | Bajarilgan: deep link mapping, tenant chat config, audit va callback tekshiruvi | Bajarilgan: routing, stale mapping fail-closed, feature/config testlari | Candidate API’da faqat sintetik A/B; live webhook va staging bot yo‘q | Kutilmoqda: real Telegram account/group | Audit branch’i production’da yo‘q |
| Telegram owner statistikasi va kassir/kuryer smena hisobi | Bajarilgan: tenant-scoped hisobotlar, ruxsatga qarab bo‘limlar, kassirning o‘z smenasidagi buyurtmalar va har buyurtma uchun SALE - REFUND; kuryer ko‘rinishi faqat o‘z smenasidagi yetkazish buyurtmalari | Bajarilgan: backend 828/828 va qo‘shimcha 3/3 test; tanlangan Telegram/smena testlari 18/18; typecheck, ESLint va backend build o‘tdi | Kutilmoqda: staging Telegram hisoblari va haqiqiy kassa yozuvlari bilan tekshirish | Kutilmoqda: owner, kassir va kuryer bilan amaliy qabul | PR merge/deploy qilinmagan; production o‘zgarmagan |
| Active tenantning yagona tasdiqlangan domenini himoyalash | Bajarilgan: oxirgi VERIFIED domenni o‘chirish/rotatsiya qilish bloklanadi | Bajarilgan: domen lifecycle regressiya testi | Kutilmoqda: domen operatsion smoke | Kutilmoqda: domen operatori tasdiqlashi | Audit branch’i chiqarilmagan |

## Release qabulidagi ochiq ishlar

- `pnpm telegram:smoke` bilan bot username, Telegram’dagi webhook manzili, pending update, oxirgi xato va backend health’ni maxfiy token chiqarmasdan tekshirish.
- Tenant activation darvozasini yopiq qoldirish; uni faqat staging A/B izolatsiyasi va DNS/TLS/POS trusted-host marshruti alohida tekshirilib qabul qilingandan so‘ng platforma operatori ochadi.
- Staging domain’ida DNS, TLS, routing va forwarded host preservation’ni tasdiqlash. TXT ownership tasdig‘ini live website tekshiruvi deb qabul qilmaslik.
- Alohida staging tenant orqali customer-web menyu → backend quote → naqd buyurtma → POS → Telegram notification/status oqimini tekshirish.
- Platform owner panelida activation, arxivlash ogohlantirishi va qayta tiklashni operator bilan qabul qilish.
- CI o‘tgan PR va release gate’dan so‘nggina production backup, migration va deploy; production qabul sinovi uchun foydalanuvchining kelishilgan test tenant/order siyosati kerak.

## Tekshiruv dalili

- PR #319 exact head bd75baa0e0356c236fd562ce5f65bbdd6f6558cb passed hosted CI run #955 (40940517495): verify and Windows desktop package succeeded.
- Owner password-reset focused tests passed 6/6; the complete backend suite passed 809/809 in CI run #957. Platform Web ESLint and TypeScript checks passed after the inactive-tenant warning fix.
- Exact staging image pr319-bd75baa passed health and the guarded A/B harness; Prisma reported 64/64 migrations. The harness verified fixture cleanup. The public platform owner panel is not available in staging, so browser-based password reset and owner login acceptance remain open.

- To'liq `pnpm ci` jarayonida typecheck, lint, barcha testlar va ilovalar build'i tugadi: Turbo 7/7 vazifa muvaffaqiyatli. Konteynerdagi `validate-repo-weight` linked worktree Git metama'lumotini ko'ra olmagani sababli shu konteyner yugurishi 32/33 validator bilan to'xtadi.
- Server checkout'ining o'zida `node scripts/ops-validate.mjs` 33/33 validator bilan o'tdi; `git diff --check` ham toza.
- Bu dalillar staging yoki real foydalanuvchi qabulini tasdiqlamaydi.

## Xavfsiz chegaralar

- Production’da test restoran, order, xodim yoki Telegram xabari yaratilmadi.
- `docs/MAZETTO_RELEASE_READINESS_CHECKLIST.md` talab qilgan aniq release approval, verified backup, migration tartibi va rollback rejasini chetlab o‘tmaslik.
- Ma’lumotni o‘chirish yoki `.orig`, `.~N~`, `next-env.d.ts`, untracked media fayllarini tekshirmasdan tozalash mumkin emas.
