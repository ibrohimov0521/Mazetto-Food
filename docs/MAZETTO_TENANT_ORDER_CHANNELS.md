# Restoran buyurtma kanallari: ulash va boshqarish

Holat: 2026-10-24. Ushbu hujjat `admin.mazetto.uz`, mijoz sayti va Telegram orasidagi ulanishni, shuningdek staging va real qabulda tekshirilishi kerak bo‘lgan qismlarni yozadi.

## Amaldagi oqim

- `admin.mazetto.uz` BestTeam Control yangi tenant, owner, birinchi filial, domen challenge va kanal bayroqlarini yaratadi. Tenant PROVISIONING holatida ochiladi; filial buyurtma qabul qilishga yoqilmaydi.
- Filial kodi forma va backend’da tekshiriladi. Mijoz/restoran nomidagi bo‘shliq branch code’da `_` ga aylantiriladi, masalan `BEST FOODS` → `BEST_FOODS`.
- TXT domen tasdig‘i ownership tekshiradi. DNS, TLS, web routing va proxy host sozlamasi infra ishidir; panelda tasdiqlangan TXT domeni live sayt deb ko‘rsatilmasin.
- Platform paneli activation checklist ko‘rsatadi. Backend faqat branch, VERIFIED domain, faol SUPER_ADMIN a’zoligi va yoqilgan Telegram bo‘lsa uning server konfiguratsiyasi tekshirilgandan keyin tenantni ACTIVE qiladi. Aktivatsiya filial savdosini yoki `acceptsOrders`ni yoqmaydi.
- Tenantni olib tashlash hard delete emas: arxivlash statusini o‘zgartiradi, ma’lumot va auditni saqlaydi, ochiq buyurtma bo‘lsa to‘xtaydi, asosiy MAZETTO_FOOD tenanti himoyalangan. To‘g‘ri arxiv auditi bo‘lsa qayta tiklash mumkin.
- `customer-web` umumiy frontend sifatida ishlaydi. Tenant production domenida API same-origin `/api/v1` Next proxy orqali backend’ga boradi; backend tenantni ishonchli forwarded host va tasdiqlangan domain yozuvidan aniqlaydi.
- Umumiy Telegram customer bot `/start t_<TENANT_CODE>` orqali tenantni tanlaydi. Server mapping chat/user ID’ni tenantga bog‘laydi; xodimlar guruhi tenant bo‘yicha sozlanadi. Mavjud Telegram buyurtmasi backend order yo‘li orqali POS’da ko‘rinadi.
- `CUSTOMER_WEB`, `WEB_ORDERS`, `TELEGRAM_ORDERS` feature flag’lari hosting yoki Telegram webhookni o‘zi sozlamaydi. Telegram panelidagi server konfiguratsiya belgisi Telegram API’dagi webhook ro‘yxatdan o‘tganini tasdiqlamaydi.

## Boshqaruv panelida kuzatiladigan narsalar

Har tenant uchun owner va status, filial, TXT domain holati, feature flags, xodimlar guruh Chat ID’si, bot deep linki, activation/archive/restore holati hamda audit yozuvlari mavjud. Qabul checklist’i uchun DNS/TLS/routing, Telegram getWebhookInfo, real buyurtmaning POS’ga kelishi va filial savdo holati alohida tekshiriladi.

## Biznes qabul tartibi

1. Staging’da yangi restoran yaratib, `BEST FOODS` filial kodi `BEST_FOODS` bo‘lib ketishini tekshiring.
2. Sinov tenantiga owner bilan kiring; DNS TXT, live DNS/TLS/routing va customer-web hostini tekshiring.
3. Sayt orqali menyu → quote → naqd checkout → POS → status o‘zgarishi oqimini boshqa tenant bilan aralashmasdan sinang.
4. Telegram bot deep link, xodimlar guruhi, notification, callback vakolati va POS ko‘rinishini staging Telegram hisobida sinang.
5. Arxiv preview’da buyurtma/to‘lov/filial/foydalanuvchi sonlari ko‘rinsin; ochiq buyurtma arxivni to‘xtatsin; yopilgan sinov tenanti arxivdan tiklansin.
6. Faqat avtomatik CI, staging va real qabul dalillari mavjud bo‘lgach, release checklist, backup, migration va rollback darvozalaridan o‘ting.

Hozir kod va avtomatik testlar bajarilayotgan branch bosqichida; staging, inson qabul testi va production release pending. Batafsil holat [qabul jadvalida](./audit/ACCEPTANCE_MATRIX_2026-10-24.md).
