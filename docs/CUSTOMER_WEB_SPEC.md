# MAZETTO FOOD mijozlar sayti

Holat: 2026-10-24. Bu hujjat amaldagi arxitekturani va hali staging/real qabul talab qiladigan qismlarni ajratadi.

## Arxitektura

- Bitta `customer-web` ilovasi Mazetto Food va keyingi restoran domenlari uchun ishlaydi; har tenantga alohida frontend build talab qilinmaydi.
- Brauzer so‘rovlari yagona backend va Order Engine’ga boradi. `mazettofood.uz` oilasida sozlangan API manzili ishlatiladi; boshqa production tenant domenlari same-origin `/api/v1` yo‘li orqali Next.js proxy’dan o‘tadi.
- Backend tenantni frontend yuborgan `tenantId`dan emas, ro‘yxatdan o‘tgan va tasdiqlangan domen hamda ishonchli proxy hostidan aniqlaydi. Proxy sozlamasi noto‘g‘ri bo‘lsa, so‘rov boshqa restoranga tushmasdan yopiq rad etilishi kerak.
- Menyu va umumiy sahifa ma’lumotlari qisqa muddat kesh qilinadi. Quote, filial mavjudligi, login va checkout keshga olinmaydi.
- Narx, chegirma, mavjudlik, filial, yetkazish to‘lovi va buyurtma holatini backend belgilaydi. Buyurtmaning yagona raqami va holati POS bilan bir xil.
- Hozirgi mijoz to‘lovi siyosati naqd pul. Click, Payme, karta va QR faol to‘lov usuli sifatida ko‘rsatilmasin.

## Tenant domenini ulash

1. Platform admin tenant va domen yozuvini yaratadi; TXT yozuvi domen egaligini tasdiqlaydi.
2. DNS, TLS sertifikati, customer-web host routing’i va backend proxy hostni saqlashi alohida sozlanadi. TXT tekshiruvi bularni o‘zi bajarmaydi.
3. Backend faqat ACTIVE tenant va VERIFIED domen uchun tenant kontekstini beradi. Ko‘proq aniq subdomen o‘chirilgan bo‘lsa, tasdiqlangan ota-domen orqali ruxsatni meros qilib olmasligi kerak.
4. Restoran ACTIVE bo‘lishi buyurtma qabul qilishni o‘zi yoqmaydi. Filial faolligi, `acceptsOrders`, `CUSTOMER_WEB` va `WEB_ORDERS` alohida shartlardir.

## Buyurtma yo‘li

Mijoz menyuni ko‘radi, savatni shakllantiradi, backend’dan quote oladi va checkout yuboradi. Checkout narxni qayta hisoblaydi, tenant/filialni tekshiradi, takroriy yuborishni idempotent boshqaradi va bitta order yaratadi. Buyurtma POS/admin ro‘yxatida `WEB` manbasi bilan ko‘rinadi. To‘lov, inventar va order status qoidalarining egasi backend bo‘lib qoladi.

## Qabul holati

Kod va avtomatik host/API sinovlari audit branch’ida bajarilmoqda. Staging’da har bir yangi tenant hostidan menyu → quote → order → POS oqimi, tenantlararo ajratish, DNS/TLS va mobil brauzer tekshirilmaguncha biznes oqimi “to‘liq qabul qilindi” hisoblanmaydi. Qolgan bosqichlar [2026-10-24 qabul jadvalida](./audit/ACCEPTANCE_MATRIX_2026-10-24.md) yuritiladi.
