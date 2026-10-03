# BestTeam va Mazetto mahsulotlari: umumiy yo'l xaritasi


## 1. Mahsulot chegaralari

Bu repoda uchta mahsulot bor. Ularning vazifasi, foydalanuvchisi, hosti, ruxsati va dizayni alohida saqlanadi.

| Mahsulot | Vazifasi | Foydalanuvchi | Brend |
| --- | --- | --- | --- |
| `admin.mazetto.uz` | BestTeam egasining ko'p restoranli boshqaruv markazi | Platforma egasi va BestTeam operatorlari | BestTeam logosi, fon rasmi, och moviy va oq |
| `mazetto.uz` | Login va doimiy saqlashsiz mahsulot demosi | Bo'lajak mijozlar | Demo uchun alohida |
| `mazettofood.uz` va restoran ilovalari | Mazetto Food nomli bitta mijoz restoranining real savdo tizimi | Restoran egasi, kassir, oshxona, ofitsiant, kuryer, mijoz | Hozirgi Mazetto Food dizayni/logosi o'zgarishsiz |

### Qat'iy chegaralar
- BestTeam ko'rinishi yoki aktivlari Mazetto Food ilovalariga ko'chirilmaydi.
- Mazetto Food logosi, ranglari, tipografiyasi va ekranlari qayta brend qilinmaydi; faqat funksiyalar va xatolar yaxshilanadi.
- Demo va owner console boshqa-boshqa host, API ruxsati va ma'lumot oqimiga ega bo'ladi.
- Umumiy backend/baza tenantlararo ruxsat bermaydi. Har bir HTTP, real-time, job, bot va fayl amali tenantni tekshiradi.
- Izolyatsiya sinovdan o'tmaguncha ikkinchi restoran yoki domenni faollashtirish yo'q.
- Aniq deploy ruxsatisiz production, Dokploy, DNS/Cloudflare, push yoki jonli bazaga tegilmaydi.

## 2. O'xshash tizimlardan olinadigan naqshlar

Rasmiy naqshlarni rasmiy manbalardan solishtirish: Toast bir panelda menyu versiyasi, filialga xos narx, umumiy sozlamalar va guruh/filial hisobotini beradi; Lightspeed manbalari esa ingredient darajasidagi ombor, menyu/modifier, stol rejasi, KDS, xodim ruxsatlari, masofaviy va mobil hisobot, offline rejim hamda smena/xodim analitikasini ko'rsatadi. Mazetto uchun xulosa: markaziy boshqaruv + filial override'i, hisobotni bir xil metrikalarda solishtirish, xodim ruxsatlari, offline holat va qayta ulanish UX'i. Bularni ko'rinishni ko'chirmasdan alohida backlog/test bilan joriy qilish kerak. [Toast multi-location](https://pos.toasttab.com/products/multi-location-management), [Lightspeed feature list](https://www.lightspeedhq.com/pos/restaurant/features/), [Lightspeed multi-location/reporting](https://www.lightspeedhq.com/pos/restaurant/multilocation-restaurant-pos-original/).

## 3. Funksiyalar katalogi

### A. BestTeam owner console
1. **Umumiy ko'rinish:** restoran/filial soni, active/paused/setup/error; web/API/agent health, oxirgi heartbeat, latency; ustuvor alertlar, tasdiqlash tarixi va filtrlanuvchi KPI.
2. **Restoran onboarding:** tashkilot, tenant kodi, filiallar, egasi/rollar, domen, app, bot va integratsiya wizard'i; DNS/SSL/domain verification; checklist, xatolar va audit. Yaratish faqat security gate'dan keyin.
3. **Tenant/filial lifecycle:** holat va xizmatlar; pause/resume/deactivate uchun sabab, oqibat preview, tasdiq va audit; platform monitoring yozuvlari haqiqiy tenant deb ko'rsatilmaydi.
4. **Log/diagnostika:** tenant/service/severity/time/request ID bo'yicha qidiruv; xato takrorlanishi, versiya/deploy bilan bog'lanish; PII/secret redaction; assign/comment/acknowledge/resolve. O'zgartiruvchi repair avval dry-run va audit talab qiladi.
5. **Hisobot:** sana, tenant, filial, kanal bo'yicha savdo/order/average check/cancel/payment; CSV eksport ruxsati va audit; manba orderlar bilan reconciliation.
6. **Backup/baza:** oxirgi zaxira, retention, checksum va restore drill; tenant hajmi/anomaliya; cleanup faqat dry-run, ta'sir ro'yxati, backup va ikki bosqichli tasdiq bilan. Paneldan bevosita SQL/delete yo'q.
7. **Foydalanuvchi/ruxsat/audit:** platform operatori va tenant xodimlari uchun mustaqil role/permission; minimal privilege, MFA/session revoke; actor, tenant, sabab va natijali o'zgarmas audit.
8. **Versiya/release:** BestTeam owner console, Mazetto backend/API, customer-web, POS web (admin/kassa/KDS/ofitsiant/kuryer), Telegram bot, desktop klient va print-agent build/SHA/minimum supported version/changelog; staging, health gate, canary, rollback. Versiya yangilash Mazetto Food brendini o'zgartirmaydi.

### B. Mazetto Food restoran panellari
- **Restoran admini:** xodim/rollar, filial va ish vaqti, menyu/narx/modifier, buyurtma kanallari, yetkazish zonalari, chegirma/soliq, sozlama va audit.
- **Kassa/POS:** tez qidiruv va qayta buyurtma, order/payment statusi, chek qayta chiqarish, smena/cash movement, offline indikator va idempotent sync.
- **Oshxona/KDS:** navbat/stansiya, taymer/kechikish, item-level tayyorlash, eslatma/allergen, ticket oqimi, printer fallback, uzilgan real-time aloqani tiklash.
- **Ofitsiant:** stol, buyurtma/kurs/qo'shimcha, ko'chirish-birlashtirish, hisobni bo'lish, ruxsatli bekor qilish.
- **Kuryer:** tayinlash/qabul, pickup/delivery, zarur manzil/aloqa, muvaffaqiyatsizlik sababi, naqd topshirish auditi.
- **Ombor/tannarx:** retsept/ingredient, birlik, kirim-chiqim, min qoldiq, savdo reconciliation; moliyaviy qoida tasdiqlanmaguncha noto'g'ri foyda ko'rsatilmaydi.
- **Hisobot/mobil:** savdo, to'lov, mahsulot, smena, staff va delivery; push token, offline navbat, klient versiyasi va release e'loni.
- **Hisob xavfsizligi:** har bir rol profil menyusidan o'z parolini almashtiradi; joriy parol tasdiqlanadi, refresh sessiyalar bekor qilinadi, credential version eski access tokenni ham rad etadi va amal auditga yoziladi.
- Yangi UX mavjud Mazetto Food tipografiya, spacing, rang va logo qoidalariga amal qiladi. Screenshot baseline vizual regressiyani ushlaydi.

### C. `mazetto.uz` demo
- Login yo'q; sintetik data; real restoran/mijoz ma'lumoti yo'q.
- Write endpointsiz demo API yoki qat'iy read-only fixture; order/payment/bot/email/push side-effect yo'q.
- Browser/serverda shaxsiy ma'lumotni doimiy saqlamaslik; reset, rate limit va abuse himoyasi.
- Tugmalar natijani simulyatsiya qiladi; real operatsiya deb ko'rsatilmaydi.
- Haqiqiy ishlamaydigan ekran soxta “real” interfeys sifatida taqdim etilmaydi.

## 4. Bosqichma-bosqich bajarish

### 0. Holatni mustahkamlash
Dirty worktree, branch va test/build holatini qayd etish; deployable app/API/worker/bot/schema/mobile ro'yxati; foydalanuvchi o'zgarishlarini asrash.
**Chiqish:** servis xaritasi va takrorlanadigan test buyruqlari.

### 1. Owner panel bazasi
BestTeam branding faqat owner console; tenant registry va monitoring registry aniq ajralishi; umumiy health/alert/KPI; role, responsive va accessibility test.
**Chiqish:** owner-only API contract, UI state testlari.

### 2. Tenant xavfsizlik inventari
Schema/migration, branchsiz yozuv, global unique, PII, upload/cache/job/realtime/bot ro'yxati; controller/service auth-scope xaritasi; threat model va tiklanadigan staging backup.
**Chiqish:** har data guruhining egasi va ruxsat qoidasi yozilgan.

### 3. Tenant authorization
Server hostname/domain va membershipdan trusted tenant kontekstini topadi; mijoz yuborgan tenantId/headerga ishonmaydi. HTTP, WebSocket, queue/scheduler, bot, upload, cache, idempotency, export/audit hammasi scope oladi. Branchsiz record egasi explicit belgilanadi.
**Chiqish:** tenant A/B adversarial testlar, fail-closed, mavjud Mazetto regressiyasi o'tgan.

### 4. Mazetto Food compatibility
Order/POS/KDS/waiter/courier staging oqimlari, parallel order, retry/idempotency, WS uzilishi/reconnect va worker retry sinovlari. Brend screenshot baseline.
**Chiqish:** role E2E, load, payment/order reconciliation, rollback drill.

### 5. Tenant onboarding/lifecycle
Preview -> provision -> domain verify -> integration health -> activate; sababli pause/resume/deactivate; secret manager; sintetik tenant B.
**Chiqish:** tenant A/B testlaridan oldin production activation boshqaruvi yopiq.

### 6. Monitoring, support va hisobot
SLO/alert/log qidiruv, tenant va filial filtrlari, CSV audit, backup/restore statusi; destructive repair/cleanup dry-run.
**Chiqish:** privacy/performance/audit/reconciliation review.

### 7. Mazetto Food funksiyalarini boyitish
Admin/POS/KDS/waiter/courier/ombor/report/mobil backlogni workflow bo'yicha bajarish; role E2E, concurrency, API contract, backward-compatible app version va release notes.
**Chiqish:** vizual brend o'zgarmagan, app'lar mos va rollback bor.

### 8. Public demo
Alohida synthetic fixture/runtime; real backend write va tashqi side-effect yo'qligini network/API testi bilan isbotlash; abuse/reset/device test.
**Chiqish:** demo real tenantni o'qimaydi ham, yozmaydi ham.

### 9. Release va ko'lamlash
Restorable backup, staging migration, canary, health/error budget/rollback; avval alohida tasdiqli Mazetto Food release, keyin pilot tenant; DNS/Dokploy alohida tasdiqli change.
**Chiqish:** versiyalar qayd etilgan, health barqaror, isolation test o'tgan.

## 5. Har bosqichdagi test darvozalari

- Unit: resolver, permission, lifecycle, report math.
- API/integration: host, role, tenant/branch predicate, idempotency.
- Adversarial: A token + B tenant ID; noto'g'ri host; branchsiz record; WS/job/bot cross-tenant.
- E2E: customer order -> POS -> kitchen -> waiter/courier -> receipt/refund.
- Concurrency/load: parallel order/status, duplicate webhook, reconnect va burst.
- Hozir maksimal parallel buyurtma sig'imi noma'lum: backend test/script ichida k6/autocannon/artillery load harness topilmadi; concurrency unit testlari throughputni o'lchamaydi. Real limitni faqat alohida staging DB va sintetik orderlar bilan o'lchash mumkin.
- Data: migration/backfill, unique constraints, backup/restore, export va cleanup dry-run.
- Frontend: accessibility, mobile, loading/error/empty states.
- Brand regression: BestTeam faqat owner console; Mazetto Food logo va ko'rinish baseline'i saqlangan.
- Backend suite, typecheck, tegishli app build va `git diff --check`.
- Deploy/push faqat foydalanuvchi aniq ruxsat bergandan keyin.

## 6. Ish yuritish va xavfsizlik

1. Bir vaqtda bitta aniq oqim/bosqich; oldin ta'sirlanadigan endpoint/model/app/integratsiyani xaritalash.
2. Mavjud o'zgarishlarni hech qachon bekor qilmaslik; migration additive, stagingda tekshirilgan va rollback rejali.
3. MazettoFood CSS/visual asset faqat funksional bug sababiy bog'liqligi isbotlansa ko'rib chiqiladi; brend ko'rinishi o'zgartirilmaydi.
4. Testdan o'tmagan capability “tayyor” deb ko'rsatilmaydi.
5. Secretlar repo, shell output, screenshot, audit metadata va logga chiqarilmaydi.
6. Production restore/cleanup/deploy uchun backup, runbook va alohida tasdiq shart.

## 7. Joriy holat va navbatdagi ish

2026-09-27: owner-only tenant registry API/UI va permission testi bor; registry qidiruv/status filtri/yig'ma ko'rsatkichlar bilan boyitildi. MazettoFood POS checkout retry dublikat realtime/Telegram xabarlari chiqarmaydi; staff credential version eski tokenni va ochiq socketlarni bekor qiladi. Customer access token endi CustomerSession ID bilan bog'langan: REST va WebSocket har ulanish/so'rovda faol, muddati o'tmagan sessionni tekshiradi; logout tegishli socketlarni ham uzadi; staff va customer WebSocket'lar JWT exp vaqtida avtomatik uziladi. Customer product-detail branch filtri 3 regression test bilan tuzatildi. Backend suite 311/311 va backend TypeScript tekshiruvi o'tdi; owner, POS va customer web production buildlari hamda owner/POS ESLint tekshiruvlari o'tgan. Credential-version migration tayyor, ammo qo'llanmagan. Customer eski access-token bilan keladigan browserlar refresh cookie orqali yangilanishi stagingda tekshirilishi shart. Bu membership, host routing, tenant data isolation yoki lifecycle tayyorligini anglatmaydi.
Package metadata audit: backend, customer-web, POS web, platform-web, Telegram bot va print-agent package'lari 0.1.0; desktop 0.1.44. Package versiyasi deployed buildni isbotlamaydi; release inventory commit SHA/build ID va productionda faol komponentni alohida qayd qilishi kerak.

Birinchi controller-service-data delegate xaritasi security inventoryga kiritildi; method/query/predicate auditi davom etadi. Keyingi engineering qadam: route-to-model va tenant ownership jadvalini endpoint kesimida tugatish; customer identity/login/session, public ordering, websocket/job/bot/cache oqimlariga tenant owner contract belgilash. So'ng server-trusted host + membership resolverni MazettoFood tenant A/B adversarial testlari bilan test-first qurish. Tenant A o'zgarishlari tekshirilmaguncha yangi restoran/domain activate qilinmaydi.

**Hozirgi release holati:** deploy/push va production/DNS/Dokploy o'zgarishi bajarilmaydi.

## 8. Joriy iteratsiya: tenant domen reyestri (2026-09-27)

- BestTeam owner-only paneli mavjud tenantga domen yozuvi qo‘shish, DNS TXT challenge ko‘rsatish/nusxalash, DNS’dan tekshirish, challenge’ni yangilash va domenni faolsizlantirishni boshqaradi.
- `TenantDomain` jadvalida challenge tokenining SHA-256 hashigina saqlanadi; plaintext faqat yaratish yoki yangilash javobida bir marta qaytadi. Audit metadata tokenni olmaydi. Holat almashinuvi tenant ID + kutilgan status bilan shartlangan.
- `TENANT_DOMAIN` audit entitysi owner audit jurnaliga qo‘shildi. DNS topilmasa domen `PENDING` qoladi; resolver nosozligi xato sifatida qaytariladi.
- Bu faqat domen egaligini DNS orqali tasdiqlaydi: Cloudflare Tunnel, DNS record, HTTPS/TLS, ingress routing yoki tenant lifecycle o‘zgarmaydi. Tasdiqlangan domen ham server-trusted tenant resolverga ulanmagan; ikkinchi tenantni ishga tushirishga ruxsat bermaydi.
- Keyingi qadam: hostname + membership resolver threat modelini yakunlash, auth/session/public menu/checkout/websocket/job/bot scope'ini A/B adversarial testlar bilan qurish. So‘ng MazettoFood POS/KDS/ofitsiant/kuryer oqimlarini faqat funksional regressiya testlari bilan yaxshilash; MazettoFood logosi va UI mavzusi o‘zgarishsiz qoladi.
- Tekshiruv: backend suite 321/321; backend va BestTeam TypeScript, tegishli ESLint, Prisma schema validation va BestTeam production build o'tdi.



Owner monitoring build inventory: backend version uses the MAZETTO_BUILD_VERSION override or backend package metadata fallback, with an optional bounded MAZETTO_BUILD_ID. BestTeam detail aggregates reported device software versions per branch/type and shows unknown versions and online/offline counts. Browser frontend bundle versions are not yet reported; old agents must send a new heartbeat before the additional fields appear.


Tenant registry now adds read-only open-order and online/offline device counts, aggregated only from each tenant's branch IDs. PlatformSite has an optional FK to RestaurantTenant; owners can link monitoring records to existing tenants and see website/API/agent health in the registry. The additive migration is not applied to any database. Tenant registry deliberately omits heartbeat business totals because the agent payload is not tenant-scoped. Backend suite 311/311, backend/platform TypeScript checks and the BestTeam production build pass. Tenant provisioning, status changes, business-data scoping, push and deploy remain blocked.


## 9. Role scope chegarasi (2026-09-27)

- Login, JWT guard va Telegram xodim konteksti `PLATFORM_*` rollarini restoran global filial scope'iga aylantirmaydi. `/staff` va `/users` ro'yxatlari platform akkauntlarini yashiradi; restoran xodim boshqaruvi platform rollarini tayinlamaydi yoki BestTeam akkauntlarini ID orqali tahrirlashga ruxsat bermaydi.
- Regression sinovlari `PLATFORM_OWNER` + `WAITER` aralashmasi, filial chegarasi, platform rolini tayinlashni rad etish, `/staff` va `/users`dagi platform akkauntlari, staff ID orqali boshqaruv, filial CRUD va customer catalog scope'ini tekshiradi. Backend suite 350/350, backend TypeScript va tegishli ESLint o'tdi.
- Restoran filial admin API'larida list/get/update/working-hours/product-availability, create va bulk delete tenant bilan cheklangan; branchless legacy admin faqat yagona ACTIVE tenant bo'lsa tenantni aniqlaydi. Staff ID va yangi filial tayinlash ham tenant va tegishli filial doirasidan chiqmaydi.
- Public customer branch/category/product va order-branch tekshiruvi yagona ACTIVE tenant bilan cheklangan va ambiguity bo'lsa rad etiladi; checkout narx hisoblashida mahsulot kategoriyasi ham target filialga moslanadi. Bu faqat single-tenant fail-closed himoyasi; host-based routing yoki ko'p tenant ishlashga ruxsat emas. Customer identity/session/cart/order ownership va qolgan service/query/async scope'lar bitmaguncha yangi tenant yoqilmaydi.

## 10. Buyurtmalar va POS tenant scope (2026-09-27)

- Mazetto Food backend order yo'llarida tenant scope mustahkamlandi: POS catalog/checkout, staff-created order, list, detail/timeline, forced status va permanent bulk delete.
- POS checkout idempotency replay branch-tenant tekshiruvidan oldin operation qidirmaydi. Order detail/timeline va forced status tenant filterli DB lookup ishlatadi; bulk delete tenantni preflight va transaction ichida tekshiradi.
- Tekshiruvlar: backend suite 356/356, backend TypeScript va tegishli ESLint o'tdi. Mazetto Food UI/logo/CSS, schema va migration o'zgarmadi; push, deploy, production DB, DNS va Dokployga tegilmadi.
- Keyingi bosqich: orders subroute/payment/receipt va cash/inventory/report/printer/device/realtime/customer ownership auditini shu A/B negative-test yondashuvida davom ettirish. Server-trusted hostname + membership contexti va barcha sync/async ownership tekshirilmaguncha ikkinchi restoran yoqilmaydi.
## 11. Customer access va asynchronous tenant guard (2026-09-27)

- Hozirgi bosqich customer auth/session, websocket, checkout attempt, Telegram webhook/notification va media upload yo'llaridagi A/B tenant ambiguity chegaralarini fail-closed qildi; unit/service negative testlar qo'shildi.
- Tekshiruvlar: backend suite 388/388; backend TypeScript va validation scripts TypeScript; tegishli ESLint va `git diff --check` o'tdi.
- Production readiness emas: trusted host-to-tenant resolver va customer membership/token ownership yo'q. Global customer/session/cart/order-attempt yozuvlari, tenant-prefikssiz MinIO, global auth cache va Telegram dead-letter queue ko'p restoran uchun hali xavf tug'diradi. Yagona ACTIVE tenantni almashtirish boshqa tenant sessiyalarini noto'g'ri talqin qilishi mumkin.
- MazettoFood mijoziga topshirish uchun bu faqat tekshirilgan kod checkpointi; push/deploy yoki production smoke test bajarilmadi. Oldindan berilgan deploy qilmaslik talabi saqlanadi. MazettoFood UI/logo/design o'zgartirilmadi; Mazetto.uz owner panel ishlariga keyingi bosqich boshlanmadi.
- Keyingi bosqichni boshlashdan oldin foydalanuvchiga holat xabar qilinadi. Ikkinchi restoran faqat tenant identity/ownership dizayni, asinxron context, staging A/B, rollback va operatsion cheklistlar isbotlangach yoqiladi.

## 12. Owner onboarding bosqichi (2026-09-28)

- Owner-only API yangi tenantni har doim `PROVISIONING` holatida yaratadi; so'rovdan `ACTIVE` statusini qabul qilmaydi. Filial endpointi faqat shu holatdagi tenantga yozadi, tenant IDni aniq bog'laydi va filialni `isActive=false`, buyurtma/delivery/pickup o'chiq qilib saqlaydi. Yozuv va audit bitta tranzaksiyada; faol tenant uchun mutation 409 bilan rad etiladi.
- Owner panelida tayyorlanayotgan restoranga filial qo'shish formasi hamda haqiqiy filial, tasdiqlangan domen, monitoring yozuvi va website/API/agent holatidan hisoblanadigan onboarding checklist mavjud. Identity/security darvozasi yopiq ko'rsatiladi; activation boshqaruvi qo'shilmagan.
- Tekshiruvlar: backend 410/410; backend typecheck, lint, build va isolated API QA o'tdi. Platform UI typecheck, lint, production build va Playwright QA 1600/768/360px'da o'tdi. QA disposable local DB ishlatdi; live DB, push, deploy va DNS o'zgarmadi.
- Keyingi majburiy bosqich: tenant identity arxitekturasi. Tasdiqlangan domen hali request tenantini tanlamaydi; `AuthenticatedUser` tenant membership ko'tarmaydi; auth cache global, customer/session/cart, websocket, queue/bot va media oqimlari to'liq tenant egasiga bog'lanmagan. Trusted host + membership modeli va cache/async ownership testlari tugamaguncha ikkinchi tenantni faollashtirish taqiqlanadi.

## 13. Tenant identity bog'lanishi (2026-09-28)

- Exact, DNS-verified Host faol tenantni aniqlaydi; login, refresh, JWT va har HTTP so'rovi faol tenant membership'i hamda rollarni tekshiradi. Membership tenant ID shared REST scope helperlarida ishlatiladi; branch membership tenant-filial mosligini tekshiradi.
- Owner panelida mavjud faol akkauntni tenantga biriktirish, rol/filial belgilash va membership'ni suspend/reactivate qilish bor. Yangi user invite/akkaunt yaratish hozircha yo'q.
- Yangi tenant API faqat PROVISIONING holatida yaratadi, filiallari nofaol; lifecycle activation API yo'q. Ikkinchi tenant faollashtirilmaydi.
- Tekshiruv: backend 430/430, typecheck, lint, build, isolated owner API/web QA va platform UI Playwright o'tdi. Production DB, DNS, Dokploy, push va deploy o'zgarmadi.
- Noma'lum hostda restoran login va refresh endi deny-by-default; BestTeam platform-only akkauntlari admin/control-panel hostida kira oladi. Biroq barcha production API hostname'lari verified registry bilan solishtirilib, stagingda domen bo'yicha smoke-test qilinishi shart.
- Keyingi audit: staff websocket verified host va membership bilan bog'langan, roli/statusi o'zgarsa ulanish bekor qilinadi; dead-letter ro'yxatlari tenant ID bo'yicha ajratildi, yangi uploadlar tenant prefiksida saqlanadi. Hali durable queue/worker, restoranlarga alohida Telegram bot/webhook konfiguratsiyasi, customer realtime/session/order, cache, device va export/report A/B sinovlari hamda Employee multi-restaurant modelini hal qilish kerak.
- Release darvozasi: staging migration + mavjud xodim membership backfill + har bir API domenida login smoke test + backup/restore va rollback mashqi. Bular tugamaguncha production migration/deploy va tenant activation yo'q.

## 14. Tenant auth, realtime va async/storage isolation (2026-09-29)

- Noma'lum hostda restoran akkauntiga legacy login/refresh berilmaydi; faqat platform-only akkauntlar owner-console hosti registry'dan tashqarida bo'lsa ham kira oladi. Tenantga bog'langan access/refresh token boshqa yoki ro'yxatdan o'tmagan hostda qabul qilinmaydi.
- Staff kitchen WebSocket handshake request hostini tekshiradi, verified va ACTIVE tenant, tenantId + membershipId, hamda faol membership/rollarni qayta tasdiqlaydi. Noma'lum host, boshqa tenant tokeni, nofaol membership va ko'p tenantga mos kelmaydigan global socket fail-closed qilinadi.
- Membership suspend yoki rolni almashtirish tranzaksiya muvaffaqiyatli tugagach foydalanuvchining staff socketlarini uzadi.
- Izolyatsiyalangan local QA stagingga yaqin verified-host/membership fixture bilan migratsiya, owner bootstrap, tenant login/refresh, unknown-host denial, membership onboarding, monitoring API hamda owner web oqimini tekshirdi. QA faqat disposable local database ishlatdi.
- Tekshiruv: backend 444/444; backend typecheck, lint, build, dead-letter static validator va isolated API/web QA o'tdi.
- Yangi uploadlar tenants/{tenantId}/... MinIO prefiksiga yoziladi va notification dead-letter Redis/fallback ro'yxatlari tenant bo'yicha bo'lingan. Avvalgi MinIO root obyektlari joyida qoladi; eski global notify:dead yozuvlari tenantga tegishliligi isbotlanmaguncha import qilinmaydi va ularni stagingda order branch-tenant join orqali tasniflash/backfill qilish kerak. Hali customer session/token/cart/order ownership, customer realtime, durable queue/worker, restoranlarga alohida Telegram token/chat/webhook mapping, cache/device/export A/B testlari; haqiqiy staging migration/backfill, domen smoke-test va backup restore/rollback mashqi qolgan. Faol xodimga invite/account yaratish yo'q; Employee modeli hanuz bitta userga bitta employee yozuvini cheklaydi.
- Ikkinchi restoran hanuz PROVISIONING holatida qoladi. Production migration, push, deploy, DNS/Dokploy va tenant activation bajarilmadi; staging release gate to'liq o'tmaguncha bular bajarilmaydi.
## 15. Customer tenant identity va admin doirasi (2026-09-29)

- Customer va OTP verification yozuvlariga tenant owner qo'shildi; global phone/email/Telegram identity unique cheklovlari tenant-scoped cheklovlarga almashtirildi. Backfill migration bir nechta ACTIVE tenant, tenantlararo aralash order tarixi yoki mos kelmaydigan challenge topilsa avvaldan to'xtaydi.
- Customer login/OTP/refresh/logout, legacy session guard, public catalog/checkout, customer websocket va Telegram customer oqimlari tenant context bilan bog'landi. Customer admin ro'yxat/statistika/bulk delete, kuryer dashboard/aggregates va assignment/status mutation'lari ham tenant predicate bilan himoyalandi.
- Migration uchun faqat disposable QA bazasida legacy schema backfill, tenant A/B unique/FK va fail-closed preflight sinovlari qo'shildi.
- Tekshiruv: backend suite 452/452; backend source/scripts typecheck, lint, Nest production build, Prisma schema validation, 52 migration checksum va isolated platform API/web QA o'tdi.
- Tenant-isolation branch'i push qilindi va [PR #104](https://github.com/ibrohimov0521/Mazetto-Food/pull/104) ochiq. Birinchi hosted CI uchta eskirgan static validator/QA fixture talabini aniqladi; ular tuzatildi va local ops validator 33/33 o'tdi. Eng yangi commit uchun GitHub `verify` qayta o'tishi merge oldidan shart. Deploy hali bajarilmadi: migrationli reliz `main` dagi yashil CI, mustaqil tekshirilgan production PostgreSQL backup, qo'lda `migrate deploy` va release smoke talab qiladi.
- Ikkinchi restoran faollashtirilmaydi. Keyingi bosqich: haqiqiy staging bazasida A/B backfill/domain/login, async worker/navbat, alohida Telegram bot/webhook, media va realtime izolyatsiyasi, hamda backup restore/rollback mashqini isbotlash. Umumiy/global bot ko'p ACTIVE tenantda hozircha fail-closed qoladi.

## 16. Tenant sozlamalari va A/B release checkpoint (2026-09-29)

- Setting endi (tenantId, key) bo'yicha ajratiladi; har bir qator faol tenantga FK bilan bog'langan. Mavjud global sozlamalarni yagona faol Mazetto tenantiga ko'chiruvchi 20260929110000_tenant_scoped_settings migration'i faqat aniq bitta ACTIVE tenant bo'lganda ishlaydi.
- Settings API, mijozga ochiq sozlamalar, OTP va Telegram auth, hamda checkout tarif/masofa hisoblashlari request yoki customer tenant kontekstidan foydalanadi. Redis kesh kaliti ham tenant bo'yicha ajratilgan.
- Disposable QA migration backfill/FK/unique shartlarini, settings registry DB smoke'ini, A/B verified-host so'rovlarida filial va har xil delivery tariflarini, bir xil telefon uchun ajratilgan OTP/customer/tokenlarni tekshirdi.
- Tekshiruv: Prisma schema valid; focused settings/audit testlari 5/5; to'liq CI'da 7/7 paket typecheck, lint, test va build, hamda 33/33 operatsion validator o'tdi. Izolyatsiyalangan API/owner-web/A-B QA ham o'tdi.
- A/B admin write sinovi ham qo'shildi: tenant B admini verified B hostida sozlamani yangilaydi; tenant A tokeni B sozlamasini o'zgartira olmaydi; qayta o'qishda A qiymati saqlanib, B qiymati yangilangani tasdiqlanadi. `qa:platform-isolated` qayta o'tdi.
- Settings migration guard testi 0 yoki 2 ACTIVE tenantda migratsiyani rad etib, schema va legacy qiymatlarni o'zgarishsiz saqlashini disposable DB'da isbotlaydi.
- Server inventory'da production servislar va doimiy `mazetto-dev-postgres` bor, lekin alohida staging app/API/DB aniqlanmadi. Dev bazasi staging o'rnida ishlatilmaydi.
- Bu kod va disposable local DB QA; production migration qo'llanmagan va ikkinchi restoran faollashtirilmagan. PR #104 hosted verify hali merge'dan oldin yashil bo'lishi shart.
- Keyingi release bosqichi: alohida staging stack tayyorlash, productionga o'xshash ma'lumot bilan settings/customer backfill, backup/restore va rollback mashqi, domenlar bo'yicha login smoke-test. Shu darvozalar va release tasdig'isiz production migrate/deploy qilinmaydi; A/B auditda qolgan queue/worker, alohida Telegram bot, media/realtime va export oqimlari ham tekshiriladi.

## 17. Release smoke ishonchliligi (2026-09-29)

- Release smoke qayta urinish bug'i tuzatildi: har so'rovga yangidan timeout signal beriladi; vaqtinchalik ulanish va HTTP xatolarida 3 martagacha progressiv kutish bilan qayta urinadi. Regression testlar timeout retry, vaqtinchalik HTTP javoblari va caller abortini tekshiradi.
- Full CI: 7 workspace package typecheck/lint/test/build o'tdi; backend 455/455, retry regressiya testlari 3/3, operatsion validatorlar 33/33. Main commit e6cfa40 uchun GitHub verify yashil.
- Fresh production backup /mnt/storage/backups/mazetto/postgres/mazetto-20260929-163512751.dump (411283 bayt) yaratilib, pg_restore --list bilan tekshirildi. Alohida vaqtinchalik Postgres'da backup restore, ikki migration deploy va original holatga restore mashqi oldin o'tgan.
- Production'da customer tenant isolation va tenant settings migrationlari qo'llandi; backend deploy muvaffaqiyatli. Joriy backend schema 53/53 migration up-to-date.
- Release gate backend'ni yagona o'zgargan ilova deb topdi. Post-deploy read-only smoke 24/24, barcha 78 media rasmi bilan o'tdi. Asosiy jadval sonlari backup rehearsal bilan mos; 1 ACTIVE tenant, ikkinchisi PROVISIONING.
- Telegram customer bot tekshirildi. Staff bot webhook'ning oxirgi saqlangan xatosi 2026-09-22 22:20 UTC dagi HTTP 500, pending_update_count=0; webhook o'zgartirilmadi. Staff Telegram UX uchun real foydalanuvchi bilan qo'lda tasdiq hali kerak.
- Production tag e6cfa40'ga ko'chirildi; PR #104 merge qilingan.
- Hali alohida staging app/API/DB stack yo'q. Keyingi bosqich: ajratilgan staging muhitini tayyorlash, tenant A/B queue/worker, bot mapping, media/realtime, device/export oqimlarini tekshirish va rollback mashqi. Shu dalillarsiz ikkinchi restoran faollashtirilmaydi.
## 18. Ajratilgan staging muhiti (2026-09-29)

- Yuqoridagi 17-bo'limdagi “staging yo'q” holati bu bo'lim bilan yangilandi. Dokploy'da production'dan alohida `Mazetto Staging / staging` loyiha-muhiti yaratildi. Alohida PostgreSQL, Redis, backend API va S3-compatible media ombori ishlayapti.
- Staging media uchun SeaweedFS 4.47 ishlatilmoqda: staging'da MinIO image registry'dan tortilmadi. Bu faqat test ombori; Mazetto Food production media servisi va sozlamalari o'zgartirilmagan.
- Staging backend alohida, tashqi domen/route ochilmagan va production bot/monitoring tokenlari yoki production ma'lumotlari berilmagan. Staging kalitlari va saqlash credential'lari faqat Dokploy staging environment'da turadi.
- Staging bazasiga 53/53 migration qo'llandi. Boshlang'ich holat: migration baseline'dagi 1 ACTIVE tenant, 0 filial, 0 user, 0 customer va 0 membership; production'dan ma'lumot ko'chirilmagan.
- 2026-09-29 tekshiruvi: ichki `/api/v1/health` 200, PostgreSQL OK, Redis ulangan, S3 SDK orqali `mazetto-staging` bucket mavjud. API 1/1 ishlayapti.
- Bu infratuzilma smoke-testidir, tenant A/B izolyatsiyasining dalili emas. Sintetik tenant A/B, membership, verified test host, login va endpoint bo'yicha rad etish/ajratuvchi testlar hali bajarilishi kerak.
- Keyingi navbat: staging-only sintetik fixture va test harness; REST/auth/domain A/B; async worker/navbat va idempotency; Telegram adapter mock (haqiqiy token/webhook'siz); media prefiks, customer/staff realtime, cache, device hamda export/report; so'ng backup restore va rollback mashqi.
- Dokploy staging ilovasi GitHub `main` branch'ini kuzatadi. Har bir staging deploy oldidan kutilgan commit SHA va faqat staging resurslariga target qilinganini tasdiqlash kerak.
- Production migration/deploy, DNS o'zgarishi va ikkinchi restoran faollashtirilishi bu bosqichda bajarilmadi. Barcha A/B, restore/rollback va Mazetto Food regression darvozalari o'tmaguncha ikkinchi tenant `PROVISIONING` holatida qoladi.
- Operatsion tartib va check-list: [MAZETTO_STAGING_RUNBOOK.md](MAZETTO_STAGING_RUNBOOK.md).

## 19. Staging A/B core isolation smoke (2026-09-30)

- Staging-only A/B harness apps/backend/scripts/qa-tenant-ab-staging.mjs PR #113 va helper URL tuzatishi PR #114 orqali main'ga merge qilindi. Joriy staging app 06d6fc5 commitida qayta deploy qilindi.
- Live staging smoke verified/pending/unknown host denial, tenant A/B filial va public setting scope, staff membership/login/access token, cross-tenant admin setting mutation denial, bir xil telefon uchun OTP/customer/session/access/refresh ajratilishini tekshirdi. Sintetik .invalid host va ma'lumotlargina ishlatildi; tashqi SMS/Telegram jo'natilmadi.
- Cleanup'dan so'ng staging DB baseline tiklandi: 1 ACTIVE baseline tenant, 0 fixture branch/user/membership/domain/customer/challenge/setting/role/permission; 53/53 migration, API health 200, Redis ulangan, S3 bucket mavjud. Test va natijani qayta bajarish tartibi [runbook'da](MAZETTO_STAGING_RUNBOOK.md).
- Bu faqat staging proof: temporary B tenant production'da yaratilmagan yoki faollashtirilmagan. Mazetto Food production va uning servislari o'zgarmadi.
- Keyingi bosqich: queue/worker retry va idempotency, notification/Telegram mock, media tenant-prefiks hamda customer/staff realtime isolation testlarini implementatsiyadan oldin kod yo'llari bo'yicha inventarizatsiya qilib, faqat staging fixture'da tekshirish. Shu hamda qolgan release gates o'tmaguncha production deploy/migration va ikkinchi tenant activation taqiqlangan.

## 20. Telegram notification retry mock (2026-09-30)

- Yangi test Telegram notification oqimini fake fetch bilan tashqi tarmoqqa chiqarmasdan tekshiradi: vaqtinchalik HTTP 503 uchun 3 urinish, tenant A dead-letter yozuvining B ro'yxatidan ajralishi, ikki ACTIVE tenantli ambiguous kontekstda retry rad etilishi va tenant yagona bo'lgach muvaffaqiyatli qayta yuborish.
- Tekshiruv: backend suite 456/456, backend src typecheck, scripts/tests strict typecheck, yangi test lint o'tdi. Mazetto Food production o'zgarmadi.
- Durable worker/queue va restaurant-specific Telegram credentials/webhooklar implementatsiya yoki production sinovdan o'tkazilmadi; release gate ochiq. Keyingi xavfsiz ish: tenant-prefixed media uploadni private staging object store'da real A/B bilan sinash, so'ng customer/staff realtime va printer/receipt regression darvozalariga o'tish.

## 21. Staging tenant-isolation evidence (2026-09-30)

### Audit/report tenant izolatsiyasi (live staging passed; shared cache remains open)

- AuditLog yozuvlari tenantId bilan yoziladi va tenant admin faqat o'z tenantining audit list/facetlarini ko'radi; eski tenant-siz yozuvlar faqat platform owner scope'ida.
- PR #124 tenant audit/report kodi, PR #125 fixture cleanup tuzatishini olib kirdi. 463 backend test, hosted CI (#393 va #395), typecheck, lint, build va 54/54 clean migration o'tdi.
- Live staging A/B o'tdi: A/B audit ro'yxati/facetlari ajraldi, tenant sales reportlar 200 qaytardi, A token bilan B branch hisoboti 404 bo'ldi. Cleanup 1 baseline tenant, 0 test branch/user va 6 original audit yozuvini tikladi; health 200.
- Staging deploy commit 757f5ad95829edab8a4922b2e873a24823f924d2. Pre-migration backup va SHA-256, migration status hamda cleanup tafsilotlari MAZETTO_STAGING_RUNBOOK.md'da.
- Keyingi darvoza: customer socket revocation, real staff event delivery/reconnect va shared cache A/B. Production migration/deploy va ikkinchi tenant activation hali yopiq.

### Earlier tenant-prefixed media A/B live proof

- PR #117 merged as 7a07e82; only the separate staging API was redeployed. Health returned 200, PostgreSQL ok, Redis connected.
- The guarded live harness used the actual authenticated upload endpoint for synthetic A/B images, denied the B token on A's host, verified both storage keys under their own tenant prefixes and confirmed both objects in the exact private staging bucket.
- Cleanup removed only the two recorded fixture objects and verified absence; database cleanup returned to 1 ACTIVE baseline tenant and zero fixture rows. Production media and Mazetto Food services remain unchanged.
- Remaining next gate: customer/staff realtime cross-tenant event and reconnect tests, followed by cache/device/export/report and end-to-end restaurant workflow regression. The broader media/realtime release gate stays open until all its remaining areas pass.


## 22. Customer/staff realtime va membership cache A/B proof (2026-09-30)

- PR #126 staging harnessiga customer logout revocation, real staff order.created delivery va reconnect catch-up, hamda shared account A/B membership role ajratilishini qo'shdi; PR #127 sinov permissionini haqiqiy ORDER_CREATE kodiga tuzatdi.
- Hosted CI #397/#399 yashil; 463 backend test + 3 retry test, backend typecheck/lint va production-mode startup smoke o'tdi.
- Isolated staging API e3c3931c7f5b0dd4a53442ec2a77477bf620b1d0 commitida ishga tushdi. Health 200, PostgreSQL OK, Redis connected.
- Live proof: bir userning tenant A/B /auth/me rollari ajraldi; real A/B staff sockets o'z order eventlarinigina oldi; reconnect catch-up faqat A eventini berdi; customer A logout faqat A socketni uzdi, B faol qoldi va A sessiyasi reconnectdan rad etildi.
- Harness yakunida DB bazaviy holatga qaytdi: 1 baseline ACTIVE tenant, sintetik tenant/branch/user/membership/domain/customer/session/setting/order/order-event/outbox/role/permission qoldig'i 0, audit baseline saqlandi. Production DB/app, domen va botlarga tegilmadi.
- Realtime, customer session revocation va tenant membership auth-cache A/B darvozasi yopildi. Navbatdagi bosqich: durable queue/worker va idempotency hamda tenant bot/webhook config yo'lini tekshirish; so'ng Mazetto Food offline/POS/KDS/courier/receipt-printer regression, backup restore/rollback va production domen login smoke. Ikkinchi restoran PROVISIONING holatda qoladi.

## 23. Desktop offline printer retry hardening (2026-09-30)

- Lokal chek navbati endi muvaffaqiyatsiz printerga darhol qayta-qayta murojaat qilmaydi: 5, 10, 20, 40 soniyalik kechikishlar bilan qayta urinadi va beshinchi muvaffaqiyatsizlikdan keyin dead-letter holatiga o'tadi. Navbat bitta tick'da ko'pi bilan 5 ishni bajaradi; xato bo'lsa shu drain pass to'xtaydi.
- Eski desktop SQLite bazalariga mos additive next_attempt_at migratsiyasi qo'shildi; lokal claim faqat system:auto navbatiga ta'sir qiladi.
- Desktop tekshiruvlari: 60/60 test (shu jumladan eski SQLite schema upgrade), TypeScript, ESLint va desktop compile/preload build o'tdi.
- Bu to'liq offline kafolati yoki production deploy degani emas. Faqat ro'yxatdan o'tgan offline commandlar va keshlangan GET'lar offline ishlaydi; karta to'lovi, login/enrollment va boshqa online-only yo'llar tarmoq talab qiladi. Jismoniy printerlar mijoz kassasida hali tekshirilmagan; Windows drayverlari va ESC/POS tarmoq yo'li virtual/unit testlar bilan qamralgan.
- O'zgarish faqat desktop client runtime'da; Dokploy backend qayta deploy qilinmadi. Desktop 0.1.47 Windows updater relizi GitHub release kanaliga muvaffaqiyatli chiqarildi. Haqiqiy printer acceptance testi hali restorandagi apparatlarda bajarilmagan.

## 24. Desktop graceful shutdown va offline navbatni asrash (2026-09-30)

- Desktop yopilayotganda gateway endi yangi so'rovlarni qabul qilmaydi, faol HTTP ishlarini va background sync/probe vazifalarini tugatishini kutadi. Shundan keyingina SQLite yopiladi.
- Printer worker yangi ticklarni to'xtatadi, ammo boshlangan chekni/print jobni yakunlashini kutadi; shunda yopilish vaqtida lokal navbat yoki outbox yozuvlari SQLite yopilgandan keyin ishlatilmaydi.
- Regression testlar: gateway yopilishi durable mutation sync tugashini kutadi; print worker faol printer ishini kutib, keyingi ishni boshlamaydi.
- Release tekshiruvlari: desktop test suite 62/62, TypeScript typecheck, ESLint va compile/preload build o'tdi. Bu xavfsiz shutdown dalili, internet uzilganda barcha amallar ishlashining kafolati emas.


- Desktop updater package 0.1.48 Windows release successfully published; Dokploy backend was not redeployed.

## 25. HTTP outage detection in desktop offline mode (2026-09-30)

- Upstream HTTP 502/503/504 and Cloudflare origin-unavailable 521-524 now switch the local gateway to offline mode instead of falsely reporting online.
- Cached successful GET snapshots are returned for ordinary reads. Realtime catch-up stays online-only and is not replaced with stale data.
- Cash POS/payment writes with a stable idempotency key may be saved to the local outbox on these outage responses. A write without a stable key is returned as an outage error and is not replayed, avoiding duplicate sales.
- Gateway regression suite: 18/18; full desktop suite: 65/65, plus TypeScript, ESLint, and compile/preload build passed.
- Desktop updater package 0.1.49; release will publish after hosted CI. This does not deploy backend services. Absolute offline operation is not claimed: first login/device enrollment, card/terminal payments, unregistered API actions, and uncached data still need internet. Physical printer acceptance is still pending.
- Next: customer-site hardware acceptance for cash sales, reconnect sync and configured printers; record exact printer models/connection types and resolve any driver-specific issues before promising compatibility. Continue the separate staging tenant A/B and durable Telegram queue gates without activating a second restaurant.

## 26. Ofitsiant buyurtma statusining offline navbati (2026-10-01)

- Ofitsiantning oshxonaga yuborish (CONFIRMED), hisob so'rash (SERVED) va buyurtmani qabul qilish amallari faqat ayni filialning yaqinda olingan keshidagi order hamda aynan mos expectedVersion bilan navbatga tushadi. UI barqaror idempotency kaliti yuboradi; navbatdagi o'zgarishlar versiyani bosqichma-bosqich optimistik yangilab, internet qaytganda asl server amallari bilan replay qilinadi.
- CANCELLED, COMPLETED, force, noma'lum status, eskirgan/keshlanmagan buyurtma, boshqa filial va idempotency kalitisiz status yozuvi navbatga olinmaydi. Bekor qilish internet talab qiladi. Oldingi relizlarda noto'g'ri navbatlangan umumiy order-action cancel replay qilinmay, conflict inbox'ga tushadi.
- POS'da shu qurilmada offline yaratilgan lokal orderning version 0 tasdiqlanishi dependency zanjirida saqlanadi; faqat faol shu filialdagi order-create navbati bilan bog'langan ID ruxsat oladi.
- Mazetto Food qamrovi: faqat keshda mavjud va xavfsiz ro'yxatdan o'tgan oqimlar offline ishlaydi. Birinchi login/enrollment, karta/terminal to'lovi, bekor qilish, yakunlash/to'lovni solishtirish, yangi yoki keshdan tashqari ma'lumot internet talab qiladi. 100% uzluksiz offline yoki istalgan printer modeliga sinovsiz kafolat berilmaydi.
- Lokal verifikatsiya: Desktop testlari 105/105, POS freshness/bootstrap testlari 25/25, Desktop/POS TypeScript checks, Desktop preload build, tegishli ESLint va POS Next production build (49 route) o'tdi. Haqiqiy kassadagi printer acceptance sinovi hali bajarilmadi.
- PR #183 merge commit b383ce2; main [CI](https://github.com/ibrohimov0521/Mazetto-Food/actions/runs/36882045386) va [Dokploy Deploy](https://github.com/ibrohimov0521/Mazetto-Food/actions/runs/36882513958) muvaffaqiyatli. [Desktop Release](https://github.com/ibrohimov0521/Mazetto-Food/actions/runs/36882045419) 0.1.90 Windows installer hamda updater manifestini chiqardi.
- Production reliz workflow'i yakunlandi; haqiqiy kassa printeri, qog'oz o'lchami va aloqa uzilgandagi fizik acceptance sinovi hali bajarilmadi.

## 27. Offline navbatni sessiya yangilanishidan keyin tiklash (2026-10-01)

- Internet uzilib turgan paytda Desktop outbox'ga saqlangan amal qayta ulanishda HTTP 401 olsa, endi konfliktga yoki yo'qolgan holatga o'tmaydi: "Kirish sessiyasini yangilash kutilmoqda" holatida diskdagi navbatda qoladi va eski token bilan takror-takror yuborilmaydi.
- Foydalanuvchi qayta autentifikatsiyalanganda yangi token bilan sinxronlash davom etadi. Token yangilanishi replay bilan bir vaqtda kelgan poyga holati ham qamraldi: eski so'rov 401 bo'lsa, navbat yangilangan token bilan qayta davom etadi.
- Tekshiruv: Desktop 107/107 test, TypeScript typecheck, ESLint va Desktop/preload build o'tdi. Bu offline buyurtma yo'qolmasligi uchun kod darajasidagi regression isboti; restorandagi haqiqiy printer qog'ozi chiqishi hali alohida acceptance sinovini talab qiladi.
- Desktop package 0.1.91; PR #184 merge commit 0ab6850. Hosted [CI](https://github.com/ibrohimov0521/Mazetto-Food/actions/runs/36888888490) o'tdi, [Windows release](https://github.com/ibrohimov0521/Mazetto-Food/actions/runs/36888888432) installer va updater manifestini chiqardi, [Dokploy deploy](https://github.com/ibrohimov0521/Mazetto-Food/actions/runs/36889352502) muvaffaqiyatli tugadi. Production smoke: API health 200, mazettofood.uz 200, POS 307 bilan /login'ga yo'naltirdi.

## 28. Printer fan-out va navbat unumdorligi (2026-10-01)

- Bir rolga biriktirilgan Windows printerlar bitta chek uchun ko'pi bilan 4 ta parallel yo'nalishda ishlaydi; lokal offline va server print job'lari bir xil himoyadan foydalanadi.
- Bir printer xato qilsa, qolgan tanlangan printerlarga yuborish to'xtamaydi. Har printer natijasi alohida saqlanadi; qayta urinishda tasdiqlangan nusxalar takrorlanmaydi.
- Tekshiruv: Desktop to'liq TAP suite 108/108, TypeScript, scoped ESLint, desktop compile, preload build va diff tekshiruvi o'tdi. Yetti printerli test 4 ta concurrency chegarasini, nosoz printerni ajratishni va retry'da nusxa takrorlanmasligini tasdiqlaydi.
- Desktop package 0.1.92; hosted CI, release va deploy ushbu PR'dan keyin kuzatiladi. Har bir filialdagi haqiqiy printer, qog'oz va Windows drayveri bilan acceptance sinovi hanuz kerak.
- Admin'da printer soniga sun'iy limit qo'yilmagan; amaliy moslik Windows drayveri yoki mos ESC/POS tarmoq printeriga bog'liq. Barcha apparat modellari sinovsiz ishlaydi deb kafolat bermaymiz.

## 29. Parallel POS checkout idempotency (2026-10-02)

- CI-only PostgreSQL 18 `cash_qa` integration test submits the same cash POS checkout concurrently with one idempotency key.
- It verifies both requests resolve to one order and that the payment operation, payment, kitchen ticket and kitchen events are created exactly once; balance changes once.
- PR #200 merged as `610948202c6252602e828e67225acfbde48e5248`. PR CI and main CI passed, including the disposable DB integration and production-startup smoke. Dokploy deploy and production smoke passed; production tag matches main. No runtime source changed in this test-only stage.
- The earlier CI attempt exposed a test-only kitchen wrapper that omitted a method; the wrapper was corrected before merge and the full PostgreSQL run passed.
- Remaining real-world gates are unchanged: exact hostname/account needed to reproduce the staff-login denial, and physical 58/80 mm printer acceptance on the restaurant hardware.

## 30. Telegram dead-letter retry result accuracy (2026-10-03)

- Telegram HTTP 200 responses with API-level `ok: false` are now treated as failures; Telegram-confirmed `ok: true` is required before a retry record is removed.
- A retry with Telegram configuration missing or an order that can no longer be resolved leaves the original dead-letter visible. A failed send returns HTTP 503; missing or unsupported records remain HTTP 404.
- Verification: backend suite 503/503, backend typecheck, scoped ESLint, retry/controller regressions, and backend production build passed. No schema or migration changed.
- PR #206 merged as `c4e0d8cd17d281036e34d22ad31a616b3fc32d25`; hosted CI passed, backend production deploy completed, and production smoke passed 24/24. `main` and the `production` tag were verified at the same commit. No live Telegram or staging side effects were sent.
- This is not a durable queue: dead letters remain Redis-backed with process-memory fallback, and per-restaurant Telegram credentials/webhooks are not implemented. Keep the second-tenant activation gate closed.

## 31. Dead-letter visibility after Redis recovery (2026-10-03)

- Redis pipeline command-level failures now enter the fallback path even when `exec()` itself resolves. Once Redis is available again, tenant-scoped listings merge Redis and process-memory entries by message ID and newest failure time; a successful retry removes both copies.
- Tests cover Redis reconnect, partial pipeline success/deduplication, and cleanup after retry. Local verification: backend suite 505/505, HTTP retry suite 3/3, backend typecheck, and scoped ESLint passed.
- This only fixes visibility within the current process. Process-memory fallback is still lost on process restart; a separately persisted queue/worker and tenant-specific bot/webhook configuration remain release gates. No schema or migration changed, and no second tenant was activated.
