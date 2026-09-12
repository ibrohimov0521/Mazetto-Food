# MAZETTO FOOD — admin panel tekshiruvi va tuzatishlar

Sana: 2026-09-12
Sabab: egasining xabari — "20 dan oshiq bo'lim, ko'pisida mantiq yo'q, ichidagi funksiyalar ishlamaydi, button qo'yilgan bosilmaydi, buttonlar joylashuvi xato".

Qamrov: 34 marshrut, 24 komponent, 11 567 qator. Har bir bo'lim to'rt qismga bo'lib tekshirildi: katalog, operatsiyalar, pul/ombor, odamlar/sozlamalar. Har bir interaktiv boshqaruv (tugma, havola, select, toggle, forma) alohida ro'yxatga olinib, **ishlaydi / buzilgan / yo'q / o'chirilgan** deb belgilandi.

Tekshiruv: `tsc`, `eslint`, `next build` — uchtasi ham toza. Backend: 131 test o'tadi.

---

## 1. Eng jiddiy: bosilmaydigan yoki teskari ishlaydigan tugmalar

Bular egasining "button qo'yilgan bosilmaydi" degan gapini aynan tasdiqlaydi.

| Qayerda | Nima bo'lgan | Dalil |
| --- | --- | --- |
| **Mahsulot yaratish** | **Umuman ishlamasdi.** So'rov `isActive` maydonini yuborardi, `CreateProductDto` esa uni e'lon qilmagan, `main.ts` da `forbidNonWhitelisted: true` — ya'ni HAR BIR `POST` 400 bilan qaytardi | `menu-management.dto.ts`, `main.ts` |
| **Xarajat yozish** | **Admin va buxgalter uchun har doim xato berardi.** `POST /expenses` filialni chaqiruvchi qamrovidan oladi; global qamrovli rol `branchId` yuborishi SHART, formada esa bu maydon yo'q edi | `expenses.service.ts` |
| **Ofitsiantning "Hisob so'rash"** | Hech qachon muvaffaqiyatli bo'lmasdi: server `NEW → SERVED` o'tishini rad etadi | `orders.service.ts` |
| **Mahsulotni saqlash** | Har saqlashda modifikator guruh sozlamalari (`isRequired`, `minSelect`, `maxSelect`) **jimgina** standart qiymatga tushardi — hech qanday xato chiqmasdi | `menu.service.updateProduct` |
| **Retseptni saqlash** | Tanlangan variantning mavjud retsepti forma tomonidan **o'qilmasdi**, `PUT /recipes` esa hamma qatorni o'chirib qaytadan yozadi — ya'ni retsepti bor variantni ochib "Saqlash" bosish uni **butunlay o'chirardi** | `recipes.service.ts` |
| **Kategoriya tavsifi/rasmi** | Hech qachon o'chirib bo'lmasdi: bo'sh satr so'rovdan olib tashlanardi | `admin-categories.tsx` |
| **Kuryerni almashtirish** | `<select onChange>` darhol biriktirardi — strelka tugmalari bilan yurish buyurtmani jimgina boshqa kuryerga o'tkazardi | `admin-couriers.tsx` |
| **Buyurtma holati** | Oltita holat tekis qatorda taklif qilinardi, server esa yaroqsiz o'tishlarni (`NEW → SERVED`) rad etadi | `admin-orders.tsx` |
| **Ombor "Harakat qo'shish"** | O'chirilgan tugmadagi sabab `title` da yozilgan — brauzer buni ko'rsatmaydi, klaviatura esa unga yetmaydi | `admin-inventory.tsx` |
| **Chek "chop etilgan" filtri** | Faqat ekrandagi qatorlarni filtrlardi, pastdagi hisob esa filtrlanmagan sahifani sanardi. DTO'da `printed` allaqachon bor edi — fayldagi izoh yolg'on yozilgan edi | `admin-receipts.tsx` |
| **Onlayn buyurtma qidiruvi** | DTO `status` va `search` ni e'lon qilgan, servis esa ikkalasini ham **e'tiborsiz** qoldirardi | `customers.service.listOnlineOrders` |
| **Oshxonadan bekor qilish** | Sabab yozilmasdi: servis qat'iy bir satr yozardi, ya'ni tarixda "nima uchun" hech qachon ko'rinmasdi | `kitchen.service.cancelTicket` |

### 1.1 Auditdagi noto'g'ri da'vo

`admin-branches.tsx:463` dagi "Filial saqlanadi, lekin hozircha ishlamayapti" matni **buzilgan tugma emas edi**. Bu "Vaqtincha yopiq" toggle'ining TAVSIFI — ya'ni "filial o'chirilmaydi, faqat hozir ishlamayapti". Dastlabki auditda (va mening birinchi xulosamda) u interfeys o'zi haqida "ishlamayapti" deb tan olgan tugma deb o'qilgan edi.

Tekshiruv: `isTemporarilyClosed` maydoni `CreateBranchDto` va `UpdateBranchDto` ikkalasida ham bor, ya'ni toggle har doim ishlagan. Matn faqat chalkash yozilgan edi va endi aniqroq qilib qayta yozildi.

---

## 2. Faqat ko'rish uchun qobiq bo'lgan qismlar

Skaner 11 komponentda hech qanday `POST`/`PATCH`/`DELETE` topmadi. Har biri alohida baholandi:

| Bo'lim | Qaror | Natija |
| --- | --- | --- |
| Onlayn buyurtmalar | **Haqiqiy bo'shliq** — daromad oqimi, lekin operator hech narsa qila olmasdi | Tasdiqlash, bekor qilish (sabab majburiy), kuryer biriktirish/yechish, buyurtmaga o'tish qo'shildi |
| Oshxona monitoringi | **Haqiqiy bo'shliq** | Chipta bo'yicha amal (server ruxsat bergan o'tish), bekor qilish, "oxirgi yangilanish", qo'lda yangilash. Kutish daqiqalari endi soat bilan yuradi |
| Mahsulotlar ro'yxati | **Haqiqiy bo'shliq** — arxivlash/tiklash endpointlari bor edi, lekin ishlatilmasdi va arxivlangan mahsulotga boshqa yo'l yo'q edi | Arxivlash va tiklash tasdiq bilan, holat filtri, filtrni tozalash |
| Smenalar | **Yopish yetishmasdi** | Smena yopish qo'shildi; kutilgan/haqiqiy/farq alohida ustunlar; kassa harakatlari jurnali |
| To'lovlar | **To'g'ri** — to'lov reestri faqat qo'shiladi | Filtrlar va tafsilot qo'shildi. Refund endpointi yo'q, shuning uchun tugma ham yo'q |
| Audit jurnali | **To'g'ri** — jurnal o'zgartirilmaydi | — |
| Rollar | Backend'da o'zgartirish endpointi yo'q | Hisobotda kerakli endpoint yozildi |
| Mijozlar, Dashboard, Hisobotlar, Katalog hisobi | **To'g'ri** — ko'rish ekranlari | Filtr, davr va tafsilot yaxshilandi |

---

## 3. Joylashuv va o'lcham

- Qator amallari sarlavhasiz ustunlarda turardi va mobil kartada `dt/dd` juftligi sifatida chiqardi — hammasi jadvalning o'z amal slotiga ko'chirildi.
- Admin tugmalarining hech bir o'lchami 44 px ga yetmasdi (`sm` 28 px, `md` 36 px), `sm` esa har bir qator amali uchun standart edi — endi 36/40/44.
- Yon panel qatorlari ~30 px, guruh sarlavhalari 10 px edi — endi 44 px va 11 px.
- Bekor qilish/arxivlash tasdiqlari modal tanasida, formadan tashqarida turardi — modalning o'z footeriga ko'chirildi, va forma to'ldirilgan modal endi tasodifiy bosishda yopilmaydi.
- Qizil rang qaytariladigan amallarda ishlatilardi ("Nofaol qilish"), band stol ham qizil edi — qizil faqat destruktiv amalda qoldi, band stol teal bo'ldi.
- 26 bo'lim 8 guruhda foydalanish chastotasiga qarama-qarshi tartibda edi (pul guruhi sozlamalardan keyin, oxirida), "Hisobotlar" esa bitta havola uchun butun sarlavha egallagan edi — 7 guruhga qayta tartiblandi.
- To'rt ikonka ikki marta ishlatilgan edi; yig'ilgan 60 px panelda ikonka yagona belgi — har bo'limga o'zining ikonkasi berildi.

---

## 4. Backend'da YO'Q, lekin kerak bo'lgan endpointlar

Bu ro'yxat sizning qaroringizni talab qiladi. Hech biri o'ylab topilmadi — har biri interfeys ishlashi uchun aynan kerak bo'lgan joydan chiqdi.

### 4.1 Pul qaytarish (refund) — eng muhimi

Sxema buni **to'liq nazarda tutgan**: `PaymentStatus.REFUNDED` va `PARTIALLY_REFUNDED`, `Payment.refundedAt`, `CashTransactionType.REFUND`, `RevenueRecordSource.ADJUSTMENT` — hammasi bor va **migratsiya kerak emas**. Lekin hech qaysi kod ularni yozmaydi, shuning uchun `Shift.refundsTotal` har doim nol.

```
POST /api/v1/payments/:id/refund     ruxsat: PAYMENT_REFUND (yangi)
{ amount, reason, shiftId?, idempotencyKey }
```

**BELGI QOIDALARI — buni aniqlab oldim, chunki xato qilish kassani buzadi:**

| Yozuv | Belgi | Nima uchun |
| --- | --- | --- |
| `CashTransaction` (`type: REFUND`) | **MUSBAT** | `shifts.service.calculateExpectedCash` va `cash-register.service` `REFUND` ni chiquvchi deb **ayiradi**. Manfiy yozilsa pul kassaga qo'shilib ketardi |
| `RevenueRecord` | **MANFIY** | Daromad yozuvlari belgisiz, shartsiz `.add()` bilan yig'iladi — netlashish uchun manfiy bo'lishi shart |
| Asl `Payment` qatori | **O'ZGARMAYDI** | Summasi hech qachon tahrirlanmaydi; faqat `status` va `refundedAt` belgilanadi |

Naqd bo'lmagan refund kassa yozuvi yaratmasligi kerak.

### 4.2 Qolgan endpointlar

| # | Kerak | Nima uchun |
| --- | --- | --- |
| 1 | `POST /orders/:id/void` `{ reason, restoreStock }` | Bekor qilish zaxirani qaytarmaydi — bu xodim tomonida ham shunday, ya'ni butun tizimda ombor siljib boradi |
| 2 | `GET /payment-methods?branchId` | Kassa ham, admin filtri ham seed ro'yxatini qo'lda takrorlashga majbur |
| 3 | `GET /cash-register/transfers?branchId&status&from&to` | Mavjud endpoint chaqiruvchining ochiq smenasini talab qiladi, ya'ni admin bo'sh ro'yxat ko'radi. Kimdan kimga qancha o'tganini ko'rsatib bo'lmaydi |
| 4 | Rol va ruxsat boshqaruvi | Rollar ekrani faqat ko'rish uchun, chunki endpoint yo'q. Bir login bir nechta rol olishi sizning asosiy qoidangiz |
| 5 | `{ items, total }` konverti | Barcha ro'yxatlar yalang'och massiv qaytaradi, shuning uchun "12 sahifadan 3-si" ko'rsatib bo'lmaydi |
| 6 | Mahsulot-modifikator guruh sozlamalari | **Bajarildi** — DTO endi `isRequired`, `minSelect`, `maxSelect`, `sortOrder` ni qabul qiladi |
| 7 | Kategoriya `parentId`, modifikator `description`/`sortOrder`/`isActive` | **Bajarildi** |
| 8 | Onlayn buyurtma server filtri, oshxona bekor qilish sababi | **Bajarildi** |
| 9 | To'plam (set) tarkibi, katalog ko'rinishi, retsept o'chirish, kam zaxira, inventarizatsiya, xarajat tuzatish/tasdiqlash | Interfeys hozir bu haqda halol: tugma qo'yilmagan |
| 10 | CSV/XLSX/PDF eksport | `ACCOUNTANT` rolining ta'rifida eksport va'da qilingan, lekin backend'da umuman yo'q — shuning uchun eksport tugmasi qo'yilmadi |

---

## 5. Qolgan xavflar

- **Brauzerda tekshirilmadi.** Admin ekranlari login va ma'lumotlar bazasini talab qiladi; mijoz sayti brauzerda tekshirildi (`pnpm qa:customer`), admin esa faqat `tsc`, `eslint` va `next build` bilan.
- **Sana filtrlari UTC chegarasini yuboradi**, backend esa Asia/Tashkent bilan ishlaydi (UTC+5). Yarim kechadan 5 soat ichidagi yozuvlar qo'shni kunga tushishi mumkin. To'g'ri yechim — backend faqat sanani (`YYYY-MM-DD`) qabul qilishi; pul yo'lida taxmin qilmadim.
- **`DataTable` endi karta ichida aylanadi** (`max-h-[70vh]`) — sticky sarlavha shuni talab qiladi. 1024×600 kassa planshetida ~420 px, ko'zdan o'tkazish kerak.
- **`admin-ui` ichida 12 px matn qoldi** (`Badge`, `CardHeader` tavsifi, `FormField` xatosi, `Pagination` hisobi). Bu umumiy primitivlar; bir qatorlik tuzatish, lekin ular parallel tahrirda edi.
- **Ombor zaxirasi sahifalanmaydi** — backend `/inventory/stock` da `limit` ni e'tiborsiz qoldiradi, shuning uchun qidiruv va filtr mijoz tomonida.
- **`ADJUSTMENT` faqat oshiradi**: kamaytirish uchun operator `WASTE` yozishga majbur, bu esa sababni noto'g'ri ko'rsatadi.
