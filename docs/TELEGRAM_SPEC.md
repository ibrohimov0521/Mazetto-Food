# MAZETTO FOOD Telegram buyurtma arxitekturasi

Holat: 2026-10-30. Mijoz va xodim Telegram oqimlari umumiy backend hamda Order Engine bilan ishlaydi. Ko‘p tenantli webhook va xodim xabarlari kod hamda hosted CI’da tekshirildi; staging va haqiqiy Telegram hisoblari bilan qabul sinovi hali bajarilmadi.

## Mijoz botining oqimi

- Bitta umumiy Mazetto mijoz boti ishlatiladi. Restoran havolasi `/start t_<TENANT_CODE>` parametrini olib yuradi.
- Backend parametrni ruxsat deb qabul qilmaydi: tenant faol, `TELEGRAM_ORDERS` yoqilgan, tasdiqlangan domen va tenantning xodimlar guruhi sozlanganini tekshiradi.
- Muvaffaqiyatli `/start`dan keyin Telegram chat va foydalanuvchi ID’si tenant bilan server bazasida bog‘lanadi. Keyingi xabarlar shu mapping orqali tenantga tushadi. O‘chirilgan tenantdan foydalanuvchi asosiy restoranga yashirincha ko‘chirilmaydi.
- Deep link bo‘lmagan yangi foydalanuvchilar uchun eski `MAZETTO_FOOD` `/start` mosligi saqlangan. Yaroqsiz yoki tayyor bo‘lmagan tenant boshqa restoranga fallback qilmaydi.
- Telegram va restoran saytidagi checkout backend menyu, quote, filial, narx va checkout qoidalaridan foydalanadi. Tenant, filial va buyurtma manbasi serverda belgilanadi. POS/admin panel buyurtmani umumiy status oqimida ko‘radi.

## Xodim guruhi va shaxsiy xabarlar

- Har tenantning xodimlar guruhi Chat ID’si tenant konfiguratsiyasida saqlanadi. Global `TELEGRAM_STAFF_CHAT_ID` faqat eski `MAZETTO_FOOD` konfiguratsiyasi uchun moslik vazifasini bajaradi.
- Guruh xabari tenantning buyurtmalarini umumiy kanalga chiqaradi. Alohida shaxsiy xabarlar mustaqil sozlanadi: owner, kassir va kuryer uchun xabarnoma kalitlari POS sozlamalarida alohida yoqib/o‘chiriladi, yangi tenantda default holati o‘chiq.
- Owner uchun POS → Sozlamalar → Telegram buyurtma xabarlari bo‘limida Telegram ID bog‘lanadi. Bu faqat owner akkauntiga yoziladi va xodim profilidagi ID’ni o‘zgartirmaydi.
- Kassir va kuryer Telegram ID’si Admin → Xodimlar bo‘limidagi xodim profiliga yoziladi. Har bir oluvchi xabar yuboradigan staff botga shaxsiy chatdan `/start` yuborishi kerak.
- Owner faqat tegishli faol `SUPER_ADMIN` a’zoligiga ko‘ra buyurtma oladi. Kassirga faqat o‘z filialining buyurtmasi, kuryerga faqat hozir biriktirilgan buyurtma yuboriladi. O‘chirilgan rol sozlamasi xabarni to‘xtatadi.
- Onlayn sayt va mijoz Telegram boti buyurtmalari backenddagi tenant-scoped outbox’dan foydalanadi. Xabarlar tasdiqlangan yetkazishdan keyingina bajarildi deb belgilanadi; noaniq yuborish holati takroriy dublikat chiqarmaslik uchun xavfsiz qayta urinish/navbat qoidalariga bo‘ysunadi.
- Xabar xatosi outbox/dead-letter nazoratida ko‘rinadi va ruxsatli admin panelidan kerakli tenant doirasida qayta yuboriladi. Guruh yuborilmagan bo‘lsa, tizim uni muvaffaqiyatli deb ko‘rsatmaydi.

## Staff bot buyruqlari va tenant chegarasi

- `/myid` xodimning Telegram ID’sini ko‘rsatadi va uni tegishli panelda qayerga kiritishni aytadi. `/help` tenant bilan bog‘lanmagan odamga ham umumiy yo‘riq beradi.
- Xodim buyruqlari uning faol filial tenantidan aniqlanadi. Owner akkaunti uchun faqat bitta faol tenantdagi owner a’zoligi bo‘lsa tenant tanlanadi; bir nechta tenant bo‘lsa bot tasodifiy tanlamaydi va tenantga oid amalni rad etadi.
- Buyurtma ko‘rish va callback amallari har safar buyurtmaning tenant/filialiga hamda foydalanuvchining faol ruxsatiga tekshiriladi.

## Operatsion nazorat va qabul chegaralari

- `admin.mazetto.uz` tenant Telegram guruh ID’si, bot deep linki va tenant holatini boshqaradi. Tokenlar panelga qaytarilmaydi; o‘zgarishlar auditga yoziladi.
- Panel serverda bot tokeni/webhook siri mavjudligini ko‘rsatishi mumkin, lekin bu Telegram webhook haqiqatan ro‘yxatdan o‘tganini isbotlamaydi.
- Webhook manzili, pending update va Telegram’dagi oxirgi xato maxfiy tokenni chiqarmaydigan `pnpm telegram:smoke` orqali release vaqtida alohida read-only tekshiriladi.
- Bitta shared customer bot ishlatiladi; har tenantga alohida bot tokeni berish ushbu yechimga kirmaydi. Bot tokenlari va webhook sirlari server muhitida qoladi.
- Staging’da alohida sinov tenanti bilan `/start`, menyu, buyurtma, POS ko‘rinishi, owner/kassir/kuryer xabarlari, yoqib-o‘chirish, qayta yuborish va tenantlararo ajratish haqiqiy Telegram hisoblarida qabul qilinishi kerak.

Qabulning besh bosqichli holati [2026-10-24 qabul jadvalida](./audit/ACCEPTANCE_MATRIX_2026-10-24.md).
