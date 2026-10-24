# Restoran buyurtma kanallari: ulash va boshqarish

Holat: 2026-10-24. Hujjat mavjud kodni tekshirish va yangi restoranlar uchun tavsiya etilgan ulash tartibini yozadi.

## Hozirgi holat

- admin.mazetto.uz dagi BestTeam Control restoran, owner hisobi, birinchi filial, tenant domeni va kanal funksiyalarini yaratadi.
- Yangi tenant PROVISIONING holatida yaratiladi. Owner a’zoligi yaratiladi, lekin birinchi filial savdo uchun o‘chiq bo‘ladi; domen TXT tasdig‘ini kutadi. Restoran yaratish hali saytni internetga chiqarish yoki buyurtma qabulini yoqish degani emas.
- Backend tenantni mijoz so‘rovidagi tenantId qiymatidan emas, tasdiqlangan domen nomidan aniqlaydi. CUSTOMER_WEB va WEB_ORDERS kanallari alohida feature-gate bilan tekshiriladi; online buyurtma umumiy backend checkout yo‘lidan o‘tadi.
- customer-web hozir mazettofood.uz va www.mazettofood.uz uchun API manzilini qaytaradi. Yangi tenant hostlari uchun frontend host konfiguratsiyasi hali umumlashtirilmagan. Onboarding’dagi TXT yozuvi domen egasini tekshiradi, DNS, TLS va Dokploy routing’ni o‘zi sozlamaydi.
- Backend’da Telegram customer ordering va TELEGRAM buyurtma manbasi bor, ammo Telegram tokeni va webhook siri hozir umumiy environment sozlamalaridan olinadi. Webhook tenantni yagona faol restoran deb taxmin qiladi (resolveSoleActiveTenantId). Bir nechta faol tenant uchun TELEGRAM_ORDERS belgisining o‘zi yetarli emas; tenantli ulanish va botdan tenantgacha yo‘nalish hali yo‘q.

## Tavsiya etilgan tuzilma

### Sayt

Bitta customer-web ilovasini ko‘p tenant uchun ishlating; har restoran uchun alohida kod bazasi yoki alohida build kerak bo‘lmasin.

1. Restoran uchun slug.mazetto.uz domenini tasdiqlang va DNS/TLS/routing holatini panelda tekshiring. Mijozlar sayti hozir www.slug.mazetto.uz deb ko‘rsatiladi; bu ko‘p qavatli subdomen uchun DNS va TLS wildcard sozlamasini talab qiladi. Agar DNS boshqaruvi buni qo‘llamasa, mijozlar saytini slug.mazetto.uz hostida, restoran adminini esa alohida aniq host yoki yo‘l ostida berish kerak.
2. Frontend so‘rovlarni same-origin API proxy orqali backend’ga uzatsin. Ishonchli proxy brauzer kirgan hostni X-Forwarded-Host’da uzatsin; backend tasdiqlangan domen yozuvi orqali tenantId’ni o‘zi aniqlasin. Frontend yuborgan tenantId’ga ishonilmasin.
3. Mijoz menyu, savat, quote va checkout’ni backend’dan oladi. Narx, chegirma, filial, yetkazish narxi va yakuniy summa faqat backend’da hisoblanadi.
4. Sayt yoqilishi uchun tenant ACTIVE, domen VERIFIED, filial faol va acceptsOrders=true, hamda CUSTOMER_WEB/WEB_ORDERS mos ravishda yoqilgan bo‘lishi kerak.

### Telegram

Birinchi bosqich uchun restoranlarga alohida bot token tarqatish o‘rniga bitta Mazetto customer botini ko‘p tenantli qilish tavsiya etiladi.

1. admin.mazetto.uz paneli restoranga bot havolasi yaratadi: Telegram /start parametri tenantni topish uchun ishlatiladi, lekin u o‘zi ruxsat yoki tenant ID sifatida qabul qilinmaydi.
2. Backend faqat faol tenant, yoqilgan TELEGRAM_ORDERS va faol filial uchun bot sessiyasini ochadi. Tenant konteksti serverdagi tasdiqlangan mapping’dan olinadi; Telegram callback yoki mijoz yuborgan tenant qiymati tekshiriladi.
3. Savat, quote va buyurtma yaratish shu backend order/checkout qoidalaridan foydalanadi. tenantId, branchId va source=TELEGRAM serverda biriktiriladi; narx mijozdan olinmaydi.
4. Bot ulanishi, webhook, oxirgi xato, buyurtma qabul qilish holati va filial chat/notification sozlamalari panelda ko‘rinadi. Bot tokeni admin UI’da qayta ko‘rsatilmaydi.
5. Keyin restoranlar o‘z bot nomi va avatarini talab qilsa, alohida bot tokenli integratsiya qo‘shish mumkin. U tokenlarni shifrlab saqlash, yangilash va webhook’ni tekshirishni talab qiladi.

Telegram’dagi qabul qilingan buyurtmalar restoranning mavjud POS/admin buyurtmalar ro‘yxatida ko‘rinsin, kanal belgisi bilan farqlansin va ayni order status oqimidan foydalansin. admin.mazetto.uz platforma egasi uchun provisioning va sog‘liq nazoratini beradi; restoran xodimlarining kundalik buyurtma boshqaruvi tenant-scoped POS/admin panelda qoladi.

## admin.mazetto.uz panelida bo‘lishi kerak

Har restoran uchun bitta provisioning checklist:

- owner hisobi va tenant holati;
- filial kodi, manzili, ish vaqti, savdo/yetkazish holati;
- domen TXT tasdig‘i, DNS, TLS va sayt javobi;
- CUSTOMER_WEB, WEB_ORDERS, TELEGRAM_ORDERS funksiyalarining yoqilgan/ulangan holati;
- Telegram bot havolasi va webhook/notification holati;
- audit tarixi: kim o‘zgartirdi, qachon va nima sababdan.

Funksiya belgisi “yoqilgan” bo‘lishi kanal to‘liq ulandi degani bo‘lmasin. Panel “o‘chiq / sozlanmoqda / tekshiruv kutmoqda / tayyor / xato” kabi kanal holatini alohida ko‘rsatsin. Faqat tayyor va tekshirilgan kanalni buyurtma qabul qilishga yoqing.

## Ishni davom ettirish tartibi

1. Restoran yaratish formasidagi filial kodi xatosini bartaraf etish va onboarding regression testini o‘tkazish.
2. Ko‘p tenantli customer-web host/API proxy’ni staging’da yoqib, domen → menyu → quote → buyurtma → POS oqimini alohida tenant bilan tekshirish.
3. Telegram webhook’dagi yagona tenant taxminini olib tashlab, tenant-scoped bot sessiyasi va order yo‘lini staging’da tekshirish.
4. Admin panelda kanal checklist/health/audit’ini qo‘shish; bot yoki domen tayyor bo‘lmasa, kanalni buyurtma qabul qilishga yoqmaslik.
5. Biznes qabulini maxsus staging tenant’da o‘tkazish. Keyin CI, backup/migration va rollback darvozalaridan so‘ng production release qilish.

Production’da mijoz tenantini test ma’lumoti sifatida ishlatmang. Production qabul testi faqat maxsus sinov tenanti va buyurtma/notification oqimiga kelishilgan test siyosati bo‘lsa bajarilsin.
