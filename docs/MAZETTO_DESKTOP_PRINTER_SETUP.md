# MAZETTO Desktop printer sozlash

Bu qo'llanma Mazetto Food POS cheklarini printerga to'g'ri yo'naltirish va filialda topshirish uchun.

## Hujjat turlari

- **Mijoz cheki**: filial va chek raqami, buyurtma, mahsulotlar, variant/modifikator va izohlar, to'lovlar va jami summa.
- **Oshxona ticket'i**: buyurtma raqami va turi, tayyorlanadigan mahsulotlar hamda oshxona izohlari; narx va to'lovlar chiqarilmaydi.
- **Bekor qilish / pul qaytarish**: hujjat turi ko'zga tashlanadigan qilib, sabab va tegishli mahsulot yoki qaytarilgan summa bilan chiqariladi.

## Printer ulanish turlari

- **Windows drayveri**: MAZETTO Desktop ilovasi Windowsda o'rnatilgan printerlardan foydalanadi. USB, Bluetooth yoki Windows qo'llaydigan boshqa ulanishlar drayver mavjud bo'lsa ishlaydi. Drayverdagi qog'oz o'lchamini ilovada tanlangan format bilan moslang.
- **Tarmoq ESC/POS**: printer IP manzili va odatda `9100` port orqali to'g'ridan-to'g'ri ulanadi. 58 mm va 80 mm termal qog'oz qo'llanadi. A4 tarmoq ESC/POS'ga yuborilmaydi; A4 printer uchun Windows drayveridan foydalaning.
- Xom ESC/POS matn kodlanishi va belgilar jadvali printer modeliga bog'liq; modelga mos code-page tanlash hozir avtomatik qilinmaydi. O'zbekcha belgilar buzilsa, printer ishlab chiqaruvchisining Windows drayveridan foydalaning va filialda chek chiqarib tekshiring ([Epson code-page jadvali](https://download4.epson.biz/sec_pubs/pos/reference_en/charcode/), [ESC t buyrug'i](https://download4.epson.biz/sec_pubs/pos/reference_en/escpos_dm/esc_lt.html)).
- `58 mm` va `80 mm` chek satrlarining sig'imini belgilaydi; bu printer drayveridagi jismoniy qog'oz sozlamasini o'zi o'zgartirmaydi.

## Admin panelda printer qo'shish

1. **Admin > Printerlar** bo'limidan kerakli filial uchun printer yarating yoki mavjudini tahrirlang.
2. Printer nomi va turini belgilang. IP manzili kiritilsa tarmoq ESC/POS yo'li tanlanadi; Windows drayveri uchun IP manzilni bo'sh qoldiring.
3. `58 mm`, `80 mm` yoki Windows uchun `A4` formatini tanlang.
4. Printer chiqarishi kerak bo'lgan yo'nalishlarni belgilang: mijoz cheki, oshxona, bekor qilish yoki pul qaytarish. Eski `BAR` roli hozir alohida bar hujjati yaratmaydi.
5. Bir xil yo'nalish bir nechta faol/ONLINE server printerga biriktirilsa, har biriga alohida ish navbatlanadi. Windows printerlar bir nechta bo'lsa, server printer nomi Windows queue nomi yoki ko'rinadigan nomiga teng bo'lishi kerak; mos kelmasa ish noaniq nusxalarga tarqatilmay, navbatda xato bilan qoladi.
6. Serverga biriktirilmagan ish Desktop'da shu rolga tanlangan barcha Windows printerlarga yuboriladi. Takroriy nusxalar istalmagan bo'lsa, har rolni bitta Windows printerga biriktiring.
7. Saqlang. Admin paneldagi ONLINE/OFFLINE qiymati qo'lda belgilanadi; printerga haqiqiy ulanishni Windows Desktop ilovasidagi test tekshiradi.

## Windows Desktop ilovasida ulash

1. MAZETTO Desktop ishga tushgan kompyuterda POS ichidagi Desktop holati/printer sozlamalarini oching.
2. Printerlarni qidiring, chek chiqaradigan Windows printerlarni belgilang.
3. Har bir printer uchun qog'oz formatini va hujjat yo'nalishlarini tanlang.
4. Avval **Test cheki**ni bosing. Test saqlangan sozlamadan foydalanib printerga namuna yuboradi.
5. Namuna to'g'ri chiqqach **Saqlash**ni bosing va filialda mijoz cheki hamda oshxona ticket'ini alohida sinang.

## Tasdiq va nosozlik

- `Chop etilgan` holati TCP ma'lumoti yuborilgani yoki Windows spooleri ishni qabul qilganini bildiradi; tizim qog'oz fizik chiqqanini sensor orqali tasdiqlamaydi. Har bir filialda haqiqiy printer bilan yakuniy sinov o'tkazing.
- Tasdiq kelmasa, sahifada navbat holati tekshirilishi aytiladi. Filial kompyuterida Desktop ilovasi ochiq, printer tanlangan va Windows test sahifasi muvaffaqiyatli ekanini tekshiring.
- `Brauzerda chop etish` qo'lda zaxira usulidir; u durable printer navbatida bajarilganini qayd qilmaydi.
- Jismoniy printerning modeli va drayveri bilan yakuniy test albatta filialda bajarilsin. Virtual ESC/POS testlari apparat, qog'oz yoki drayverni almashtirmaydi.

## Filialda yakuniy sinov

1. Haqiqiy test buyurtmasi bilan mijoz chekini chiqaring; mahsulot, modifikator, uzun izoh, to'lov va jami summani tekshiring.
2. Oshxona printerida buyurtma raqami/turi, mahsulotlar, modifikator va tayyorlash izohi chiqishini; narx va to'lov chiqmasligini tasdiqlang.
3. Test buyurtmasini bekor qilib, alohida test to'lovini qaytaring; sabab, salbiy summa va to'g'ri printer yo'nalishini tekshiring.
4. Printer vaqtincha o'chirilgan paytda ish `Chop etilgan` bo'lmasligini, printer qayta ulangach navbat holati tiklanishini kuzating.
5. Har bir rol uchun faqat kerakli printer nusxa olayotganini tekshiring. Bir nechta printerga nusxa ataylab kerak bo'lmasa, takroriy yo'nalishni o'chiring.

## Tekshirish doirasi

Desktop regressiya testlari 58 mm satr o'lchami, uzun mahsulot/izoh matnining o'ralishi, Windows drayveriga format uzatilishi, A4'ning TCP printerga ketmasligi va ish muvaffaqiyatsiz bo'lganda chekni noto'g'ri `Chop etilgan` deb belgilamaslikni tekshiradi.
