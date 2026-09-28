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
- Commit `d356506` `feat/customer-tenant-isolation` branch'iga push qilindi; [PR #104](https://github.com/ibrohimov0521/Mazetto-Food/pull/104) ochiq, GitHub `verify` CI yurmoqda. Deploy hali bajarilmadi: migrationli reliz `main` dagi yashil CI, mustaqil tekshirilgan production PostgreSQL backup, qo'lda `migrate deploy` va release smoke talab qiladi.
- Ikkinchi restoran faollashtirilmaydi. Keyingi bosqich: haqiqiy staging bazasida A/B backfill/domain/login, async worker/navbat, alohida Telegram bot/webhook, media va realtime izolyatsiyasi, hamda backup restore/rollback mashqini isbotlash. Umumiy/global bot ko'p ACTIVE tenantda hozircha fail-closed qoladi.
