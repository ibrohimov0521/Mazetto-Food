# MAZETTO FOOD Telegram buyurtma arxitekturasi

Holat: 2026-10-24. Telegram mijoz buyurtmasi va xodimlarga bildirishnoma yagona backend hamda Order Engine bilan ishlaydi. Ushbu branch’dagi ko‘p tenantli ulash hali staging va real Telegram hisobi bilan qabul qilinishi kerak.

## Mijoz botining oqimi

- Bitta umumiy Mazetto mijoz boti ishlatiladi. Tenant havolasi `/start t_<TENANT_CODE>` parametrini olib yuradi.
- Backend parametrni ruxsat o‘rnida qabul qilmaydi: tenant ACTIVE, `TELEGRAM_ORDERS` yoqilgan, kamida VERIFIED domeni va xodimlar bildirishnoma guruhi borligini tekshiradi.
- Muvaffaqiyatli `/start`dan keyin Telegram chat va foydalanuvchi ID’si tenant bilan server bazasida bog‘lanadi. Keyingi xabarlar ham shu mapping orqali tenantga tushadi. Oldingi tenant o‘chirilgan bo‘lsa foydalanuvchi asosiy restoranga jim ko‘chirilmaydi.
- Deep link bo‘lmagan yangi foydalanuvchilar uchun eski MAZETTO_FOOD `/start` mosligi saqlangan. Yaroqsiz yoki tayyor bo‘lmagan tenant parametri boshqa restoranga fallback qilmaydi.
- Telegram buyurtmasi backend menyu, quote, filial tekshiruvi va checkout qoidalaridan foydalanadi; tenant, filial va `TELEGRAM` manbasi serverda belgilanadi. POS shu order’ni umumiy status oqimida ko‘radi.

## Xodim guruhi va xabarlar

- Xodimlar guruhi Chat ID’si tenant konfiguratsiyasida saqlanadi; global `TELEGRAM_STAFF_CHAT_ID` faqat eski MAZETTO_FOOD tenantiga moslik uchun ishlatiladi.
- Platform owner panelida guruh ID’si va mijoz bot havolasi sozlanadi. Tokenlar panelga qaytarilmaydi; o‘zgarishlar auditga yoziladi.
- Buyurtma xabari va callback buyurtmaning tenant/filial guruhiga va faol xodimga tekshiriladi. Xato bildirishnomalar qayta urinish/dead-letter oqimida saqlanadi.
- `TELEGRAM_ORDERS`ni yoqishdan oldin tenant xodimlar guruhi sozlangan bo‘lishi kerak. Kanaldagi buyurtmalar restoran POS/admin panelida ham kuzatiladi.

## Operatsion nazorat va chegaralar

- Panel serverda bot tokeni/webhook siri mavjudligini va tenant guruh sozlamasini ko‘rsatadi. Panelning bu ko‘rsatkichi Telegram’dagi webhook haqiqatda ro‘yxatdan o‘tganini isbotlamaydi.
- Webhook manzili, pending update va Telegram’dagi oxirgi xato release vaqtida maxfiy tokenni chiqarmaydigan `pnpm telegram:smoke` orqali alohida read-only tekshiriladi.
- Bitta shared customer bot mavjud; har tenantga o‘z tokenini berish ushbu yechimga kirmaydi. `TELEGRAM_BOT_TOKEN` va webhook siri server muhitida qoladi.
- Staging’da alohida sinov tenanti bilan `/start`, menyu, quote, buyurtma, POS ko‘rinishi, xodim guruhiga xabar va callback ruxsati real Telegram hisobida tekshirilishi lozim.

Qabulning besh bosqichli holati [2026-10-24 qabul jadvalida](./audit/ACCEPTANCE_MATRIX_2026-10-24.md).
