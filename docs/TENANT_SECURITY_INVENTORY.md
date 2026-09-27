# Tenant isolation: joriy xavfsizlik inventari

Sana: 2026-09-27
Repo: /home/javohir/dev/mazetto-panel-improvements
Maqsad: shared backend va PostgreSQL'da ikkinchi restoranni yoqishdan oldin tekshiriladigan xavf xaritasi.

## Xulosa

Hozirgi deployment bitta haqiqiy restoran uchun ishlaydi. Schema'da RestaurantTenant, TenantDomain va Branch.tenantId mavjud; Mazetto Food filiallari tenantga biriktirilgan. Dastlabki source qidiruvi tenant predicate topmagan; keyingi xavfsizlik iteratsiyalarida staff assignment/ID amallari va authenticated branch-admin CRUD'ning ayrim query'lariga tenant tekshiruvi qo'shildi. Bu faqat yopiq endpointlar bo'yicha alohida bo'lak: ko'p API va public customer yo'llarida trusted tenant context hamda query scope hali yo'q. 34 controller bor; 20 service branch-scope helperidan foydalanadi. Shu sabab ko'p tenant ishlashga hali tayyor emas.

**Qaror:** ikkinchi restoran, yangi verified domain yoki public tenant routing'ni faollashtirmaslik. Tenant authorization barcha kirish yo'llarida isbotlanmaguncha lifecycle create/activate yo'q.

## Dalillar va aniq risklar

### 1. Tenant konteksti auth user ichida yo'q
- AuthenticatedUser hozir id, role/permission, branchId va isGlobalScope olib yuradi; tenantId yoki tenant membership yo'q.
- JWT guard user scope'ini DB'dagi User, Employee.branchId va global role'lardan qayta quradi.
- User auth cache ham shu tenant-siz profilni saqlaydi.
- TenantDomain verified yozuvini request hostga bog'laydigan resolver backend source'da topilmadi.
- Frontend Next rewrite/headerini tenant vakolati deb qabul qilish mumkin emas: proxy/host ishonch chegarasi alohida isbotlanishi kerak.

### 2. Filial helperi tenant chegarasi emas
resolveBranchScope branch IDni cheklaydi. Global-scope user uchun so'ralgan branchni qaytaradi yoki branch so'ralmasa undefined qaytaradi. Bir tenantli tizimda bu global hisobot/admin oqimiga mos; ikkinchi tenant bo'lsa undefined bir nechta tenant filiallarini qamrab olishi mumkin. Helperga tenantId qo'shishning o'zi yetmaydi: har bir query, related lookup, update/delete, aggregate va nested write ham scope olishi kerak.

### 3. Customer ma'lumotlari branchdan kengroq
Public customer catalog/branches va customer auth/checkout/order endpointlari mavjud. Customer identity, login challenge, refresh/session, address, favorites/cart/order tarixining tenantga tegishli bo'lish qoidasi aniqlanmagan. BranchId'siz obyektga birinchi filialdan tenant taxmin qilish mumkin emas. Global unique email/phone/Telegram ID qoidalari tenantlar orasidagi identifikatsiya siyosati bilan muvofiqlashtirilishi kerak.

### 4. Tashqi va asinxron yo'llar
- Telegram customer/staff webhook public endpoint; hozir secret env orqali tekshiriladi. Kelajakda bot credential tenant bo'yicha tanlanishi kerak.
- Customer access REST va WebSocket endi bir xil CustomerSession (customerId, revokedAt, expiresAt) holatini tekshiradi; logout session room'dagi socketlarni uzadi va connect race'da revoke room'ga kirgandan keyin token qayta tekshiriladi; staff/customer WebSocket JWT exp vaqtida uziladi. Tenant ownership esa hali yo'q: customer ID global va domainga bog'lanmagan; queue/cron, storage upload, cache, idempotency va report/export alohida audit talab qiladi.
- Public health/geocoding kabi endpointlarda tenant talab qilinmasligi mumkin, ammo ular tenant data sizdirmasligi shart.
- PlatformSite has an optional `tenantId` FK to RestaurantTenant for explicit control-plane association only. Tenant registry selects only website/API/agent health fields; it does not select `lastHeartbeatData` or treat heartbeat order/branch totals as tenant-scoped. Diagnostics/events/reports remain separate owner views.

## Qidiruvda aniqlangan API sirtlari

34 controller: inventory, orders, pos, printers, uploads, tables, system-health, shifts, auth, platform-monitoring, reports, suppliers, geocoding, branches, customers, realtime, roles, telegram, dashboard, devices, menu, settings, users, staff, kitchen, recipes, cash-register, receipts, homepage, expenses, payments, notifications, audit va health.

Branch helperidan foydalanadigan 20 ta service fayli topildi: inventory, orders, printers, tables, shifts, reports, suppliers, branches, customers, customer-courier, realtime, dashboard, devices, users, staff, kitchen, cash-register, receipts, expenses va payments. Bu boshlang'ich ro'yxat; route va data access bo'yicha to'liq audit o'rnini bosmaydi.

### Route authorization audit (2026-09-27)

TypeScript AST skaneri apps/backend/src/modules ichidagi 33 controller'dan 231 dekoratorli HTTP route topdi; ilova darajasidagi HealthController bilan jami 34 controller. Route metadata bo'yicha 199 tasi method/class permission, 10 tasi CustomerAuth, 19 tasi explicit Public, 3 tasi global JWT guard bilan himoyalangan: `GET /auth/me`, `POST /devices/heartbeat`, `POST /staff/me/password`.

Bu uch JWT-only route o'z doirasida tekshirildi: auth/me faqat joriy user profilini qaytaradi; device heartbeat auth userni oladi va device.branchId uchun resolveBranchScope ishlatadi; own-password endpoint session user IDsi bilan o'z parolini almashtiradi. Bu tenant izolatsiyasi borligini isbotlamaydi: har bir service query va side effect tenant predicate olishi shart. Statik decorator skaneri runtime guard order yoki dinamik endpointni to'liq tasdiqlamaydi.

Public decorator qidiruvida auth login/refresh yo'llarining bir qismi; platform heartbeat; geocoding; customer auth, branch/menu va order yo'llari; Telegram webhooklar; device enrollment; settings/homepage public ko'rinishlari; health endpoint topildi. Har route method, DTO, DB access, rate limit, side-effect va domain scope bo'yicha jadvalga o'tkazilishi kerak. Public endpoint tenant talab qilmasligi mumkin, lekin bu anonymous cross-tenant read/write mumkin degani emas.

## Xavf reyestri

| ID | Muammo | Daraja | Yopish sharti |
| --- | --- | --- | --- |
| T-01 | AuthenticatedUser/membership tenant identifikatsiyasiz | Blocker | Verified host yoki membershipdan server trusted context; cache/JWT lifecycle ko'rib chiqilgan |
| T-02 | Backend query'larda tenant predicate aniqlanmadi | Blocker | Barcha HTTP/data access uchun tenant A/B adversarial coverage |
| T-03 | Global role branch filteridan keng natija olishi mumkin | Blocker | Global rol faqat tenant ichida global; platform owner biznes API'dan ajratilgan |
| T-04 | Customer identity/session/cart/address ownership noaniq | Blocker | Identity contract, schema va endpoint testlari tenant-aware |
| T-05 | Branchsiz yozuvlar egaligi noaniq | High | Model-by-model explicit ownership va backfill |
| T-06 | Telegram va background job context noaniq | High | Tenant-keyed credentials, payload va retry/dedup testlari |
| T-07 | Realtime/cache/storage/export scope tasdiqlanmagan | High | A/B event, cache collision, file IDOR va export testlari |
| T-08 | Global unique email/phone/code qoidalari | High | Tenant-aware uniqueness yoki hujjatlashtirilgan global policy va migration |
| T-09 | Monitoring registry provisioning deb talqin qilinishi mumkin | Medium | UI/API nomlari aniq; lifecycle alohida model va workflow |

## Keyingi chuqur inventory

Har Prisma modeli uchun jadval tuziladi:
- model va sensitive maydonlar;
- ownership yo'li: tenantId, branchId, user/customer/order FK yoki system-global;
- read/create/update/delete/aggregate entrypointlar;
- branchsiz row va backfill strategiyasi;
- tenantga oid unique/index/FK;
- cache, websocket, queue, bot, upload, backup/export ishlatilishi;
- test nomi va release gate.

Birinchi ko'rib chiqiladigan guruhlar: User/Role/Employee/login; Customer/Session/address/cart/favorite; Branch va branchsiz menu/setting/payment/integration; Order/OrderItem/payment/refund/receipt; inventory/supplier/warehouse; printer/device/print job; Telegram; audit/report; upload/media.

Schema statik tekshiruvida 40 modelda to'g'ridan-to'g'ri branchId ham, tenantId ham yo'q. Bu ularning egasizligini anglatmaydi: ko'pi boshqa model FKsi orqali tegishli tenant/filialga ulanadi. Ammo query shu relationni har safar tekshiradimi, alohida isbot kerak.

Model ro'yxati: RestaurantTenant, Customer, CustomerAddress, CustomerVerificationChallenge, CustomerSession, Cart, CartItem, User, Role, Permission, RolePermission, UserRole, AuditLog, PlatformSite, PlatformSiteDiagnostic, IdempotencyRequest, Session, HomepageHeroSlide, Promotion, ProductVariant, Modifier, ProductModifier, ProductBundleItem, KitchenTicket, OrderItem, KitchenTicketItem, KitchenTicketEvent, OrderStatusHistory, Ingredient, Stock, StockMovement, Recipe, RecipeItem, Payment, PaymentOperation, PrintAttempt, CustomerOrderAttempt, CustomerFavorite, CashTransferAllocation, Setting.

### Sxema bo'yicha ko'rilgan ownership zanjirlari
- CustomerAddress, CustomerSession, verification challenge, Cart, CartItem va CustomerFavorite Customer yoki cart orqali bog'langan; Customer.phone/email/telegramUserId global unique. CustomerOrder esa customer bilan birga Branch va Order'ga alohida bog'lanadi, uchalasining bir tenantdaligi transaction darajasida tekshirilishi shart.
- User email/phone va UserRole global; Employee faqat bitta branchga bog'langan, userId esa unique. Tenant ichida ko'p filialli xodim va platform operatorini ajratish uchun membership/role dizayni yo'q.
- Category va Product.branchId nullable. ProductVariant, ProductModifier, bundle item, homepage slide va promotion tenantni Product/Category relationidan oladi; Modifier esa o'zi global unique code bilan saqlanadi. Tenantlar uchun umumiy template bo'ladimi yoki alohida clone bo'ladimi, aniqlashtirish kerak.
- Order branchIdga ega, lekin orderNumber global unique. OrderItem, KitchenTicket/Event/Item, Payment/Operation, CustomerOrder, status history kabi yozuvlar Order FKsi orqali tenant oladi. Receipt/PrintJob esa o'z branchIdsi bilan birga parent order/receipt branchiga mosligini tekshirishi kerak.
- Ingredient branchsiz; Stock va StockMovement Warehouse orqali Branchga boradi; Recipe/RecipeItem ProductVariant/Product orqali filialga boradi. Supplier va PaymentMethod branchId nullable, shuning uchun branchsiz row'lar uchun ownership taxmin qilinmaydi.
- Setting.key, Modifier.code, orderNumber, kitchen ticketNumber va receiptNumber hozir global unikallikka ega. Tenantga ko'chirishda migration, collision report va mavjud mijoz receipt/API/Telegram compatibility tekshiriladi.

## Tenant B'dan oldingi test matritsasi

1. Tenant A tokeni bilan B branch/order/customer/file/event ID: deny yoki not-found, data qaytmasin.
2. B verified hostname + A membership; A hostname + B membership; unverified/disabled domain; forwarded-host spoof/browser tenant header: fail-closed.
3. Bitta filialli, ko'p filialli, tenant-wide admin va platform owner rollari; tenantlararo branch almashinuvi yo'q.
4. Public catalog/checkout/customer session: faqat host tenantidagi menyu/order; boshqa hostda cookie ishlamasin.
5. Realtime room, cache key, idempotency key, queue retry, Telegram webhook va print file: cross-tenant collision/delivery yo'q.
6. Export, audit, report, search, aggregate va pagination tenant predicate'ni saqlaydi.
7. Synthetic tenant B'da order -> POS -> kitchen -> waiter/courier; tenant A yozuvlari o'zgarmaydi.
8. Migration restore/replay, unique collision va backfill soni staging backup bilan mos.

## Qanday davom etiladi

1. Controller/service'larni route-to-model jadvalga o'tkazish; public va async entrypointlarni belgilash.
2. Prisma model ownership va branchsiz row auditini tugatish.
3. Tenant membership/domain resolver kontraktini threat model bilan tasdiqlash.
4. AuthenticatedUser/request contextga trusted tenant qo'shishdan oldin resolver, cache invalidation va testlarni yozish.
5. Scope enforcementni modulma-modul query predicate va A/B adversarial tests bilan qo'llash.
6. Mazetto Food tenant A regression testlarini saqlash; keyin tenant B staging pilot.
7. Production migration/deploy faqat alohida release ruxsatidan keyin.

## Hozirgi chegaralar

- Mazetto Food web/POS/KDS/ofitsiant/kuryer dizayni va logosi o'zgartirilmaydi.
- Owner console monitoringi tenant provisioning bilan bir xil emas.
- Demo synthetic/read-only bo'lib qoladi.
- Hujjat xavfni qayd etadi; mavjud single-tenant production'ni o'zgartirmaydi.


## Controller -> service -> data ownership xaritasi (birinchi pass)

Quyidagi jadval controller route oilalarini handler/service va TypeScript ichida topilgan to'g'ridan-to'g'ri Prisma delegate'lari bilan bog'laydi. Bu AST call graph yoki runtime query audit emas: service helperlari, `$queryRaw`, queue consumer, Redis/cache, object storage, Telegram/provider va WebSocket side-effectlari to'liq aks etmasligi mumkin. Shuning uchun jadvaldagi model nomi tenant predicate borligini bildirmaydi. Har bir oiladagi read/write/aggregate va bulk yo'l alohida query-level testga o'tkazilishi kerak.

| API oilasi | Asosiy data delegate'lari | Egani aniqlash yo'li va tekshiruv |
| --- | --- | --- |
| `/auth/**`, `/staff/**`, `/users*`, `/roles*`, `/permissions*` | `User`, `Session`, `Employee`, `Role`, `UserRole`, `Permission`, `RolePermission`, `Shift`, `CashTransfer`, `AuditLog` | Hozir `User`/role identifikatorlari global. `Employee.branchId -> Branch.tenantId`; platform operator rolini restoran xodimidan ajratish va sessiya revoke scope'i kerak. |
| `/customer/auth/**`, `/customer/me/**`, `/customer/checkout/**`, `/customer/orders*`, `/customer/menu/**`, `/customer/branches*`, `/customers*`, `/online-orders*`, `/courier/**`, `/couriers*` | `Customer`, `CustomerAddress`, `CustomerSession`, `CustomerVerificationChallenge`, `CustomerOrder`, `CustomerOrderAttempt`, `Cart`, `CartItem`, `Order`, `OrderItem`, `OrderStatusHistory`, `Product`, `Category`, `ProductModifier`, `Employee`, `Shift` | `Customer` va login identifikatorlari hozir global; `CustomerOrder -> Order/Branch` zanjirining bitta tenant ekanini transaction ichida tekshirish shart. Public catalog, checkout, customer cookie va courier assignment host/membership qarorisiz tenant-safe emas. |
| `/branches/**`, `/tables/**`, `/halls/**`, `/waiter/orders*` | `Branch`, `BranchWorkingHour`, `Product`, `ProductBranchAvailability`, `Hall`, `RestaurantTable`, `Employee`, `Order`, `OrderStatusHistory` | Branch odatda `tenantId`ni bevosita beradi; table/hall, employee, product va order bir xil branch/tenantga tegishli ekanini nested write va ID lookup'da tekshirish kerak. |
| `/orders/**`, `/pos/**`, `/kitchen/**` | `Order`, `OrderItem`, `OrderEvent`, `OrderStatusHistory`, `Product`, `Category`, `Payment`, `PaymentMethod`, `PaymentOperation`, `PaymentRefund`, `KitchenTicket`, `KitchenTicketItem`, `KitchenTicketEvent`, `CashTransaction`, `CashTransferAllocation`, `RevenueRecord`, `Warehouse`, `OutboxEvent` | Asosiy egasi `Order.branchId -> Branch.tenantId`; nested item/status/payment/kitchen/outbox yozuvlari parent order tenantiga mos bo'lishi kerak. Bulk status/delete, idempotency va notification retry alohida adversarial test talab qiladi. |
| `/payments/**`, `/receipts/**`, `/printers/**`, `/devices/**`, `/system/health-metrics` | `Payment`, `PaymentOperation`, `PaymentRefund`, `Order`, `Shift`, `Employee`, `Receipt`, `PrintJob`, `PrintAttempt`, `Device`, `Printer`, `Branch` | To'lov order/branch/shift bilan mos bo'lishi kerak; printer/device ko'pincha `branchId` orqali egalanadi. Print claim/complete/fail/retry va device enrollment public tokenni tenantli qurilmaga bog'lashi kerak. Health aggregate tenant ma'lumotini tasodifan oshkor qilmasin. |
| `/inventory/**`, `/recipes/**`, `/suppliers/**` | `Ingredient`, `Warehouse`, `Stock`, `StockMovement`, `Recipe`, `RecipeItem`, `ProductVariant`, `Supplier` | Stock warehouse orqali branchga boradi; recipe product/variant orqali. `Ingredient` va `Supplier` kabi branchsiz/nullable yozuvga tenantni taxmin qilib qo'shib bo'lmaydi; explicit owner va backfill qarori kerak. |
| `/expenses/**`, `/cash-register/**`, `/shifts/**`, `/reports/**`, `/dashboard/**` | `Expense`, `ExpenseCategory`, `Shift`, `CashTransaction`, `CashTransfer`, `CashTransferAllocation`, `Order`, `OrderItem`, `Payment`, `PaymentRefund`, `Employee`, `RevenueRecord` | Filial hisobotida `resolveBranchScope` tenant scope o'rnini bosmaydi. Sana oralig'i, aggregate, export va global rol natijalari bir xil tenant predicate olishi kerak; moliyaviy metrikalar reconciliation bilan tekshiriladi. |
| `/menu/**`, `/homepage/**`, `/settings/**` va public `/customer/menu/**`, `/customer/home`, `/settings/public` | `Category`, `Product`, `ProductVariant`, `Modifier`, `ProductModifier`, `ProductBundleItem`, `Promotion`, `HomepageHeroSlide`, `Setting`, `CartItem`, `OrderItem` | `Product/Category.branchId` nullable; `Modifier.code` va `Setting.key` global unique. Public response verified host tenantiga bog'lanishi; shared menu template va tenant override siyosati belgilanmaguncha nullable row egasi aniqlanmaydi. |
| `/platform/sites/**`, `/platform/tenants*`, `/platform/events*`, `/platform/diagnostics*`, `/platform/audit*`, `/platform/reports*`, `/platform/heartbeat/**` | `PlatformSite`, `PlatformSiteEvent`, `PlatformSiteDiagnostic`, `RestaurantTenant`, shuningdek owner hisobotida `Branch`, `Device`, `Order`, `OrderStatusHistory`, `KitchenTicket`, `KitchenTicketEvent`, `PrintJob`, `AuditLog` | Bu BestTeam control-plane API; PlatformSite.tenantId links only an existing monitor record to a tenant; it does not provision, activate, or pause a tenant. Tenant registry returns minimal website/API/agent health and excludes lastHeartbeatData. Owner-wide reports remain separate. Tenant CRUD/lifecycle and restaurant business APIs must stay permission-separated. Heartbeat credentiali faqat tegishli site'ni yangilasin. |
| `/telegram/**`, `/notifications/dead-letters/**`, `/realtime/**` | `Branch`, `Customer`, `CustomerVerificationChallenge`, `Cart`, `CartItem`, `TelegramCheckoutSession`, `CustomerOrder`, `Product`, `Category`, `Order`, `Employee`, `User`, `OutboxEvent` va xabar providerlari | Controllerdan tashqaridagi webhook, worker, retry va socket room yo'llari bor. Bot credential, payload, dead-letter retry, outbox key va room identity tenantga bog'lanishi; global customer/chat identifikatoridan boshqa tenantni taxmin qilmaslik kerak. |
| `/uploads/**`, `/geocoding/**`, `/notifications/**`, `/health*` | Prisma delegate statik scanida bevosita aniqlanmadi yoki route boshqa service/provider'ga delegatsiya qiladi | Bu “data yo'q” degani emas. Upload object key/metadata uchun tenant ACL va signed URL IDOR testi; geocoding rate/PII siyosati; notification queue va health response side-effect/data-leak auditi kerak. |

Route va model inventarining navbatdagi kengaytmasi: har method uchun controller DTO -> service method -> Prisma operation -> ownership predicate -> side-effect/outbox -> negative A-token/B-ID testi ustunlarini to'ldirish. Avval `Customer`, `/orders`-POS-KDS, payment/receipt, inventory hamda platform control-plane guruhlari olinadi; tenant membership va customer identity qarorlari tasdiqlanmaguncha enforcement kodi boshlanmaydi.

## Tekshirilgan customer oqimi va tuzatish (2026-09-27)

- `customer-web` mahsulot tafsiloti `localStorage`dan `branchId` olib `GET /customer/menu/products/:id?branchId=...` yuborar edi, lekin controller queryni tashlab yuborardi; service ham filial availability override'ini qo'llamasdi.
- Controller endi optional `branchId`ni service'ga uzatadi. U bo'lsa product faqat tanlangan branch yoki branchless umumiy productdan olinadi va shu branchdagi `OUT_OF_STOCK`/`UNAVAILABLE` override chiqarib tashlanadi. Parametr yo'q eski SEO/public chaqiruv saqlangan.
- Regression testlar query predicate, branchsiz compatibility va controller forwardingni qamraydi: 3/3. To'liq backend suite: 302/302; backend TypeScript va tegishli ESLint: o'tdi. `platform-web` va `customer-web` Next production build: o'tdi.
- Bu funksional filial tuzatishi, tenant xavfsizligi yechildi degani emas: `branchId` hali browserdan keladi, `Customer.phone/email/telegramUserId` global unique, verification challenge phone bilan global qidiriladi, `CustomerSession` tenant/host scope'ga ega emas. `CustomerOrderAttempt` customer ichida unique; kart va Telegram checkout session tenant owner'ni denormalize qilmaydi.
- Checkout DTO branchId'si body'dan keladi. Ikkinchi restoranni yoqishdan avval server-trusted host/domain + membership contexti customer auth, public catalog, checkout, REST/WS session, Telegram va joblarga o'tishi; A-token/B-branch-ID salbiy testlari o'tishi shart.
- O'zgarish schema yoki migration talab qilmadi. Testlar mock/service darajasida; real DB, staging tenant A/B, parallel throughput, push va deploy bajarilmadi.


## Owner monitoring build inventarizatsiyasi (2026-09-27)

- Backend heartbeat versiyasi MAZETTO_BUILD_VERSION bilan override qilinadi, aks holda runtime'dagi apps/backend/package.json versiyasi ishlatiladi; ixtiyoriy MAZETTO_BUILD_ID ham 40 belgigacha cheklanadi.
- Filial snapshotida faol Device yozuvlarining type + softwareVersion agregati qaytadi: jami, 5 daqiqalik freshness bo'yicha onlayn/oflayn va versiya berilmagan qurilma soni. Hardware ID, qurilma nomi va xodim/customer identifikatorlari chiqarilmaydi. Haddan tashqari noyob versiyalar bitta overflow guruhda qoladi.
- MazettoFood qurilma client'lari faqat heartbeat'da softwareVersion uzatgan darajada ko'rinadi. Web bundle'lar, PWA va mobil ilovalar uchun release/version manifest hali yo'q; package semver production build SHA yoki deploy qilinganini o'zi isbotlamaydi.
- O'zgarish backward-compatible: eski heartbeat'larda yangi ixtiyoriy maydonlar bo'lmasa ham qabul qilinadi. Bu tenant isolation, health-check yoki release activation tekshiruvining o'rnini bosmaydi.


## Tenant faollik agregati (2026-09-27)

- Owner-only tenant registry endi filial ID ro'yxatini DB'dan oladi va shu ID'lar bilan ochiq buyurtma hamda faol qurilmalarni agregatsiya qiladi; foreign/unmatched branch natijalari hech qaysi tenant javobiga qo'shilmaydi.
- Device online holati monitoring agenti bilan bir xil 5 daqiqalik so'nggi aloqa oynasidan hisoblanadi. Qurilma nomi, hardware ID va shaxsiy ma'lumotlar qaytmaydi. Tenant provision/status mutation hanuz bloklangan.
- Website/API probes confirm only those public endpoints, not full restaurant availability. PlatformSite.tenantId now provides an optional DB FK and owner-controlled association; it does not scope heartbeat events, reports, or business metrics. Tenant request/auth/async scoping and agent branch ownership remain unproven, so a second tenant must not be enabled.
- Regression tests cover tenant branch aggregation, foreign-branch exclusion, minimal linked-site health, and rejection of unknown tenant IDs before writes. Backend suite 311/311, backend/platform TypeScript checks, Prisma schema validation, and BestTeam production build pass. The additive migration remains unapplied; no production DB, push, or deploy was touched.

## Owner-controlled domain registry (2026-09-27)

- `POST /platform/tenants/:tenantId/domains` creates a pending hostname only for an existing tenant. Verify, rotate-challenge, and disable endpoints scope every lookup and state transition to both tenantId and domainId; `PLATFORM_OWNER` and `SYSTEM_HEALTH_VIEW` protect the controller.
- Hostnames are normalized through IDNA and reject URLs, IPs, malformed labels, and single-label names. Verification queries `_bestteam-verify.<hostname>` TXT and compares the token hash using a constant-time comparison. Missing TXT stays pending; DNS resolver failure is not mistaken for a missing record.
- Only SHA-256 challenge hashes are stored; one-time plaintext is returned by create/rotate and excluded from audit metadata. Rotate/disable use tenant+status guarded updates, so stale concurrent transitions do not get audited as success.
- Domain verification proves DNS control only. It does not establish the trusted request tenant, configure a tunnel/Cloudflare/TLS route, or activate a tenant. No second tenant is safe until membership/domain resolution and all sync/async ownership paths pass the A/B test matrix.
- Owner UI shows one-time TXT instructions and explicit pending/verified/disabled states. Production DNS, database, push, and deploy are untouched.
- Verification: backend suite 321/321; backend/platform TypeScript, relevant ESLint, Prisma schema validation, and BestTeam production build passed. No migration was applied.


## Multi-tenant rollout gate: trusted identity still missing (static review, 2026-09-27)

- `AuthenticatedUser` carries user/employee/branch/roles/permissions but no tenant ID. `JwtAuthGuard` reloads the employee's single branch and global `UserRole` rows; `Employee` is attached to one branch and has no tenant membership relation.
- Login, JWT guard, and Telegram staff context now derive restaurant-wide `isGlobalScope` through one helper that excludes `PLATFORM_*` roles. A platform owner combined with a branch-scoped waiter role therefore remains confined to the employee's branch; regression tests cover this boundary.
- Restaurant `SUPER_ADMIN` and `ACCOUNTANT` remain global within the current single-restaurant model. Their branch queries and unscoped queries still do not check `Branch.tenantId` or `RestaurantTenant.status`, so they are not tenant-safe.
- That behavior is compatible with today's single-restaurant deployment, but it is not tenant isolation: after a second tenant's branches enter this database, global restaurant roles and any unscoped query require a tenant predicate before they can safely run. This is a rollout blocker, not a claim that a second tenant is active now.
- No request-host-to-tenant resolver or tenant/branch membership model is present in the authenticated request context. DNS TXT ownership proof does not provide that context. Do not create/activate a second tenant or map its app to this API yet.
- Required next implementation: decide tenant membership and platform-vs-restaurant identity; resolve tenant from a server-trusted host/app origin; propagate immutable tenant context to HTTP, websocket, jobs, bot, cache, files, reports, and audit; scope global roles inside that tenant; then pass the existing adversarial A/B matrix before a staging tenant is enabled.


## Platform-role branch-scope separation (2026-09-27)

- Restaurant scope is now computed once by `hasRestaurantGlobalScope` and reused by login response mapping, JWT revalidation, and Telegram staff context. A `PLATFORM_*` role cannot turn a branch-scoped employee into a restaurant-wide user.
- Restaurant staff role assignment rejects every `PLATFORM_*` code before querying roles. Both `/staff` and `/users` directory queries exclude accounts with platform roles; ID-based staff read/update/status/password/termination/deletion paths enforce target tenant and branch scope.
- Authenticated branch-admin list/get/update/working-hours/product-availability endpoints use tenant-scoped lookup; branch create explicitly connects the resolved tenant; bulk deletion scopes both preflight and delete queries. A branchless legacy admin fails closed unless exactly one tenant is ACTIVE. Foreign tenant branch IDs resolve as not-found.
- Public customer branch/category/product queries and branch order validation are restricted to the sole ACTIVE tenant; a requested branch ID must belong to it. Checkout re-fetches products with a matching branch/category predicate. Requests fail closed when more than one tenant is ACTIVE. This preserves the current one-tenant workflow but is not host-based routing or tenant membership.
- Regression tests cover platform-only roles, mixed platform/restaurant roles, staff ID access, cross-tenant branch assignment, branch-level access, tenant-filtered branch list/get/create/delete, customer catalog scoping, checkout product/category scoping, duplicate branch-code name redaction, ambiguous-tenant rejection, and existing restaurant role behavior.
- Backend suite: 350/350. Backend TypeScript and relevant ESLint passed. Customer identity/session/cart/order ownership still lacks trusted host tenant context, and other modules remain under audit; no second tenant is safe to activate.
## Order va POS tenant scope (2026-09-27)

- POS katalogi, POS checkout va xodim order yaratishi filialni actor tenantiga bog'laydi. Branchless legacy owner faqat yagona ACTIVE tenant bo'lganda davom etadi.
- Order list tenant relation predicate bilan filtrlanadi; aniq branch so'rovi ham shu tenantda ekanini tekshiradi. Detail va timeline DB queryning o'zida tenant (va branch-scoped user bo'lsa filial) bilan chegaralanadi.
- Permanent bulk delete avval faqat tenant orderlarini tanlaydi va tranzaksiya ichida scope'ni qayta tekshiradi; begona yoki aralash ID ro'yxati side-effect boshlamasdan not-found qaytaradi. Forced status update ham scoped order lookup'dan foydalanadi.
- POS idempotency replay qidiruvidan oldin branch/tenant tekshiruvi bajariladi; boshqa tenantdagi kalit bilan saqlangan operation'ni tekshirish yoki qaytarish imkoni yo'q.
- Yangi adversarial order testlari list, foreign-ID detail, bulk delete preflight/transaction recheck, forced status va POS replay guardni qamradi. Backend suite 356/356, backend TypeScript va tegishli ESLint o'tdi.
- Bu faqat order service uchun single-tenant fail-closed mustahkamlash. Item mutation va boshqa order subroute'lar, payment/receipt/cash/report/inventory/realtime hamda customer/session/async ownership qolgan auditda. Trusted host + membership resolver yo'q; ikkinchi tenantni yoqish xavfsiz emas. Migration, push, deploy va production o'zgarishi bajarilmadi.
## 11. Customer identity va asinxron yo'llar: A/B audit yakuni (2026-09-27)

- Customer code request/verify/refresh, customer REST session guard va kitchen websocket auth tenant ambiguity bo'lsa identity/session ma'lumotiga murojaat qilmaydi.
- Buyurtma urinishida filialga tegishli tenant tekshiruvi customer lookup yoki global idempotency replay'dan oldin bajariladi. Telegram customer/staff webhook ambiguity holatida xabarni ishlov bermasdan xavfsiz yakunlaydi; Telegram order notification tenant filialiga bog'langan orderni topadi; umumiy MinIO upload yagona faol tenant aniqlanmaguncha bloklanadi.
- Regression sinovlari: tenant ambiguity, boshqa filial/tenant order attempt, Telegram webhook/notification va upload. Yakuniy tekshiruv: backend 388/388; backend va validation-script TypeScript; tegishli ESLint; `git diff --check` o'tdi.
- Bu fail-closed single-tenant to'siq, to'liq tenant identity modeli emas. Customer, session, cart, address/favorite va order-attempt yozuvlari tenantga egalik qilmaydi; customer JWT/session host yoki membership bilan bog'lanmagan. Yagona faol tenantni A'dan B'ga almashtirish ham foydalanuvchini yangi tenantga bog'lab qo'yishi mumkin.
- Telegram dead-letter Redis kaliti global (`notify:dead`); MinIO object nomlari tenant prefixsiz; auth cache (`auth:user:<id>`) tenant membership versiyasiz. Job/queue va boshqa asinxron oqimlar uchun tenant context/ownership to'liq isbotlanmagan.
- Shuning uchun ikkinchi tenantni yoqmang va yagona ACTIVE tenantni boshqa restoranga almashtirmang. Keyingi arxitektura bosqichi trusted-host + membership/identity ownership'ni belgilab, DB ownership, cache, media, queue, bot va A/B staging testlarini qamrashi kerak.
- Mazkur checkpointda schema/migration yoki production DB o'zgartirilmadi; push, deploy, DNS va Dokploy bajarilmadi. Hozirgi task so'roviga muvofiq audit yakunlandi va keyingi bosqich boshlanmadi.
