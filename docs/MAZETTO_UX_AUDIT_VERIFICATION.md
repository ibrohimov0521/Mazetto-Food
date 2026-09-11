# MAZETTO FOOD — UX audit topilmalarini tekshirish matritsasi

Sana: 2026-09-12
Manba: `docs/MAZETTO_UX_UI_AUDIT_2026-09-12.md` va `docs/ux-audit/*.md`
Yo'riqnoma: `AI_UX_AUDIT_IMPLEMENTATION_GUIDE.md`

Holat qiymatlari: **CONFIRMED** (kodda tasdiqlandi), **PARTIALLY_TRUE** (muammo bor, lekin auditdagi ta'rif noto'g'ri), **NOT_REPRODUCIBLE** (kod auditdagi da'voni qo'llab-quvvatlamaydi), **NEEDS_DECISION** (egasining qarori kerak).

Tekshirish muhiti: `node_modules` o'rnatildi, Prisma client generatsiya qilindi. `pnpm` bu muhitda ishlamaydi (filtrlangan buyruq ichida o'zini qayta chaqirib yiqiladi), shuning uchun barcha tekshiruvlar binarlarni to'g'ridan-to'g'ri chaqirish bilan bajarildi: `node_modules/.bin/tsc`, `node_modules/.bin/eslint`, `apps/*/node_modules/.bin/next build`, `node --test --import tsx`.

---

## 1. Critical

| Topilma | Holat | Dalil | Qaror |
| --- | --- | --- | --- |
| P-1 POS'da buyurtma turi yo'q | **CONFIRMED** va auditdan KO'RA chuqurroq | `orders.service.ts` `type: OrderType.TAKEAWAY` deb qattiq yozgan, va `CreatePosCheckoutDto` `type` maydonini UMUMAN qabul qilmasdi — ya'ni muammo faqat UI'da emas, API kontraktida ham edi | DTO'ga `type` va `tableId` qo'shildi, `assertPosCheckoutType` qoidasi yozildi, UI'ga segment control va stol tanlovi qo'shildi. `DINE_IN` stolni talab qiladi, `TAKEAWAY` stolni rad etadi |
| P-2 POS faqat naqd | **CONFIRMED** uchala qatlamda | UI'da `validCash` gate, DTO'da faqat `cashReceived`, servisda `assertCashPaymentMethod` bilan bitta naqd to'lov. `listPosCatalog` esa `paymentMethods: [{ code: "CASH" }]` deb qattiq qaytarardi | DTO'ga `payments[]` (4 tagacha) qo'shildi, servis har bo'lakka alohida `Payment` + `RevenueRecord` yozadi, `cashTransaction` esa FAQAT `CASH` uchun. `listPosCatalog` filialning sozlangan usullarini qaytaradi |
| C-1 Kuryer har doim `CASH` yozadi | **PARTIALLY_TRUE** | Frontend haqiqatan shartsiz `paymentMethodCode: "CASH"` yuborardi. LEKIN `customer-courier.service.ts` to'lovni faqat `outstanding > 0` bo'lganda yaratadi, ya'ni onlayn to'langan buyurtma kuryer kassasiga **tushmaydi** — auditdagi "kassa balansini buzadi" da'vosi pul darajasida takrorlanmaydi | Haqiqiy muammo — kuryer eshik oldida pul olish kerakmi-yo'qmi BILMASDI. Kartaga to'lov holati badge'i qo'shildi, tasdiq dialogida summa yoziladi, `paymentMethodCode` faqat rost bo'lganda yuboriladi |
| W-1 Ofitsiantda himoya yo'q | **CONFIRMED** | `waiter/page.tsx` dagi `load`, `openTable`, `addProduct`, `updateOrderStatus` — to'rttasi ham try/catch'siz, tugmalar hech qachon disabled bo'lmaydi | Ekran POS patternlari bo'yicha qayta yozildi: `actionLock` ref, `pendingAction`/`busyLineId`, inline `role="alert"`, `SessionExpiredError` → logout |

---

## 2. High — bajarildi

| Topilma | Holat | Dalil | Qaror |
| --- | --- | --- | --- |
| PM-1 Ortiqcha naqd va qaytim yo'q | **PARTIALLY_TRUE** | Tugma `tenderTotal !== outstanding` da bloklangan — bu rost. LEKIN backend `processOrderPayment` ortiqcha to'lovni ATAYLAB rad etadi ("Payment amount exceeds outstanding balance"), va bu to'g'ri hisob: 73 000 lik buyurtmaga 100 000 daromad yozilmaydi | Tuzatish UI tomonida: kassir olgan naqdni kiritadi, qaytim mijozga ko'rsatiladi, serverga esa faqat qoldiq summa yuboriladi. Backend qo'riqchisi TEGILMADI |
| PM-2 Ikki marta to'lov xavfi | **CONFIRMED** | `crypto.randomUUID()` POST tanasi ichida, har chaqiruvda yangi kalit — idempotentlik qayta bosishdan himoya qilmasdi | Barqaror `paymentKey` + "attempt signature" refi; kalit faqat yuboriladigan mazmun o'zgarganda yangilanadi |
| PM-3/R-1 Chek yo'li yo'q | **CONFIRMED** va yana bir bo'shliq topildi | To'lov sahifasida `router`/`Link` yo'q edi; chek sahifasi mavjud, lekin unga havola yo'q. QO'SHIMCHA: `createPosCheckout` chek yozuvini UMUMAN yaratmasdi (`receipt.create` faqat `payments.service.ts` da), ya'ni POS naqd sotuvi admin cheklar ro'yxatida ko'rinmasdi | Chek yozuvchisi `receipts/receipt-writer.ts` ga chiqarildi, POS checkout `ensureOrderReceipt` chaqiradi, `orderInclude` chek ishoratlarini beradi, muvaffaqiyat dialogi chekka havola qiladi |
| P-4 Savat yo'qoladi | **CONFIRMED** | `cart` faqat component state'da, `beforeunload` butun `app/(fullscreen)` da yo'q | Savat smena id'si bilan `sessionStorage` ga saqlanadi, ID bo'yicha saqlanib katalogdan tiklanadi (narx joriy qoladi), to'lgan savatda chiqishda ogohlantirish |
| 1.1 Birinchi "+" mahsulotni yo'qotadi | **CONFIRMED** | `lib/cart.tsx` `addItem` `false` qaytarardi va `onClose` `pendingItem` ni tashlardi — toast ham yo'q | Gating olib tashlandi: mahsulot darhol savatga tushadi. Menyu narxlari filialga bog'liq emas, checkout esa qayta kotirovka oladi; `validate()` manzilni baribir talab qiladi |
| 6.1 Xulosada har doim "naqd" | **CONFIRMED** | `checkout/page.tsx` da qat'iy "Buyurtmani olganda naqd to'lov" | Har usulga o'z ikonkasi va o'z xulosa matni; xulosa tanlangan usuldan olinadi |
| 6.2 Yaroqsiz to'lov usuli yuboriladi | **CONFIRMED** | Kotirovka kelgach radio yo'qoladi, lekin `paymentMethod` state'da qoladi | Effekt tanlangan usulni birinchi mavjud usulga qaytaradi |
| 9.1 Admin buyurtma qidiruvi yo'q | **CONFIRMED** | `ListOrdersDto` da `search`/`from`/`to` yo'q; `buildOrderSearchWhere` esa allaqachon mavjud va kuryer ro'yxatida ishlatilardi | `listOrders` shu yordamchini ishlatadi, `createdAt` oralig'i qo'shildi |
| 3.1 Karta narxi/tavsifi kontrastdan o'tmaydi | **CONFIRMED**, hisoblandi | Gradientning yorug' uchi `#258e88` ustida sariq narx 2.60:1, tavsif 2.53:1 | Karta yaxlit `#01555a`: narx 5.64:1, tavsif (80% oq) 6.11:1 |
| 3.2 `#17314A` shaffofliklari | **CONFIRMED**, hisoblandi | 45–65% variantlari oq va ivory ustida 2.5–4.5:1 orasida, 33 joyda | Yagona `#586b7d` (oq 5.51:1, ivory 5.28:1) |
| 3.4/3.5 Fokus halqasi ko'rinmaydi | **CONFIRMED**, hisoblandi | Lavanda `#b9b8f0` sariq tugmada 1.24:1, ivoryda 1.72:1; input fokus sariq oq ustida 1.4:1; checkout alohida yashil bilan ustidan yozardi | Chuqur teal (`--mf-bg`): sariqda 6.14:1, ivoryda 8.53:1. Checkout'dagi raqib qoida olib tashlandi |
| 3.6/3.7 Holat rangi ma'no bermaydi | **CONFIRMED** | Bekor qilinmagan barcha holat bir xil sariq chip; sariq bir vaqtda CTA, narx va faol holat rangi | `trackingTone()` qo'shildi: NEW sariq, jarayonda teal, yakunlandi yashil, bekor qizil. Har juftlik AA'dan o'tadi (6.09–8.19:1) |
| 10.4 Uch xil holat yorlig'i | **CONFIRMED** | `order-success`, `profile` va `lib/order-tracking.ts` bir-biriga zid; SERVED va ACCEPTED xom chiqardi | Ikki mahalliy nusxa o'chirildi, hammasi `order-tracking.ts` dan |
| 4.2 Checkout'da boshqa telefon maydoni | **CONFIRMED** | Checkout oddiy `<input type="tel" maxLength={40}>`, auth esa `PhoneInput` | Checkout `PhoneInput` ga o'tkazildi; `normalizePhone` 9 raqamli qiymatni qabul qilgani uchun tekshirish mantiqi o'zgarmadi |
| K-1/K-2 KDS o'qilmaydi | **CONFIRMED** | `.itemName` 13px, `.itemQuantity` 12px, taymer 12px; shoshilinchlik faqat `data-late={elapsed >= 25}` matn rangi | Alohida ish sifatida bajarildi (oshxona ekrani) |

---

## 3. Auditda YO'Q, lekin tekshirishda topilgan xatolar

| Xato | Dalil | Qaror |
| --- | --- | --- |
| **Ombor zaxirasi ikki marta ayiriladi** | `deductRecipeStock` `stockDeductedAt` ni YOZADI, lekin hech qachon O'QIMAYDI — maydon sxemada bor va hatto `@@index([stockDeductedAt])` bilan indekslangan. `confirmOrderForPreparation` esa `CONFIRMED` holatni ataylab qabul qiladi, ya'ni oshxonaga qayta yuborishda barcha faol qatorlar ikkinchi marta ayirilardi | `pendingStockDeductionWhere()` filtri qo'shildi: o'zgarmagan buyurtmani qayta yuborish hech narsani ayirmaydi, keyin qo'shilgan qatorlar esa ayiriladi. Test bilan qulflandi |
| **POS sotuvi chek yozuvi yaratmaydi** | `receipt.create` butun backend'da faqat `payments.service.ts:705` da; `createPosCheckout` uni chaqirmaydi | Umumiy `receipt-writer.ts` va `ensureOrderReceipt` chaqiruvi |
| **Xodim sanasi brauzer mintaqasida** | `lib/order-display.ts` dagi `dateTimeFormatter` da `timeZone` yo'q, `StaffSync` esa "Asia/Tashkent" ni ochiq belgilaydi — bitta ekranda ikki xil vaqt | `timeZone: "Asia/Tashkent"` qo'shildi |
| **Ofitsiantda "hisob so'rash" hech qachon ishlamasdi** | `orders.service.updateStatus` `NEW → SERVED` o'tishini rad etadi ("Order must be confirmed before...") | Tugma faqat `CONFIRMED` dan keyin ko'rsatiladi |
| **Bitta stolda ikki ochiq buyurtma yashirin qolardi** | `listTables` `take: 1` ishlatadi, `POST /orders` esa (`POST /tables/:id/orders` dan farqli) mavjud faol buyurtmani tekshirmaydi | Tanlangan stol uchun `GET /tables/:id` o'qiladi va bir nechta buyurtma bo'lsa almashtirgich ko'rsatiladi |

---

## 4. NEEDS_DECISION — egasining qarori kerak

| Masala | Nima uchun o'zim hal qilmadim | Kerakli qaror |
| --- | --- | --- |
| **Qo'llab-quvvatlash telefoni noto'g'ri** | Kodda `+99895855406`, ya'ni `+998` dan keyin 8 raqam. O'zbekiston mobil raqami 9 raqamli. To'g'ri raqamni o'ylab topish begona odamga qo'ng'iroq qilinishiga olib kelardi | To'g'ri raqamni aytishingiz kerak. `apps/customer-web/lib/contact.ts` da bitta joyda tuzatiladi. Hozir interfeys uni bosiladigan havola sifatida ko'rsatmaydi |
| **POS'da yetkazib berish buyurtmasi** | Yetkazish narxi mijoz koordinatasiga bog'liq (belgilangan radius ichida bepul, undan keyin sozlamadagi narx). Kassa endpointi manzil ham, koordinata ham qabul qilmaydi. Turni qabul qilib narxni nolga qoldirish mijozdan KAM PUL olish bo'lardi | Kassada yetkazish kerak bo'lsa, POS'ga manzil kiritish va xarita/geokodlash oqimi kerak. Hozir `DELIVERY` ataylab rad etiladi va xato aniq yoziladi |
| **To'lov usullari ro'yxati spetsifikatsiyaga mos emas** | `docs/POS_SPEC.md` `TERMINAL, RAHMAT, CORPORATE_CARD, OTHER` deb yozadi, `prisma/seed.ts` esa `CASH, CARD, UZCARD, HUMO, CLICK, PAYME, ONLINE` ni yaratadi. Seed'da yo'q usulni taklif qilish "Active payment method not found" xatosini berardi | Qaysi ro'yxat to'g'ri? Seed va spetsifikatsiyani moslashtirish kerak. POS kassa ekrani endi bazadan o'qiydi, `/pos/payment` sahifasi esa bitta markazlashtirilgan konstantadan |
| **Ofitsiant oshxonaga qayta yubora olmaydi** | Birinchi yuborishdan keyin qo'shilgan qatorlar oshxonaga bormaydi. Backend'dagi `stockDeductedAt` filtri qo'shilgandan keyin bu texnik jihatdan xavfsiz bo'ldi, lekin oqim qarori kerak: qayta yuborish yangi ticket yaratadimi yoki mavjudiga qo'shadimi | Oshxona ish tartibi bo'yicha qaroringiz kerak |
| **Ikki dizayn hujjati zid** | `DESIGN_RULES.md` oq/yashil/ko'k va sariq faqat ogohlantirish deydi; `MAZETTO_DESIGN_LOCK.md` teal/gold/ivory va sariq CTA ni qulflaydi | Yo'riqnomangiz bo'yicha CTA uchun gold, semantik holatlar uchun status ranglari qo'llandi. `DESIGN_RULES.md` ga shu bandni yozib qo'yish tavsiya etiladi |

---

## 5. Brauzerda o'tkazilgan tekshiruv

`scripts/qa-customer-contrast.mjs` qo'shildi (`pnpm qa:customer`). U yig'ilgan mijoz saytini headless Chromium'da 375, 390, 430, 768, 1024, 1366 va 1440 px da ochadi, har bir matn tugunining HAQIQIY fonini kaskaddan o'lchaydi, 11 px dan kichik matnni va haqiqiy gorizontal aylantirishni aniqlaydi. Chiqish kodi faqat shubhasiz muammolarda nolga teng bo'lmaydi.

**Brauzer topgan, manbani o'qishda ko'rinmagan uch xato:**

| Topilma | O'lchangan | Qaror |
| --- | --- | --- |
| Faol pastki nav yorlig'i | `#F5CF00` nav yuzasi `#08686a` ustida **4.32:1** (shell `#004f55` ustida 6.14:1 — oldingi tekshiruv faqat NOFAOL yorliqni ko'rgan) | `#FFE86B`, 5.32:1 |
| Teal matn `#0B7F75` | oq ustida 4.88:1, ivory ustida **4.46:1**, ikkisida ham ishlatiladi | Hamma joyda `#0A7168`: 5.87:1 / 5.37:1 |
| Footer krediti va hero "TAVSIYA" yorlig'i | 10 px, kredit 4.37:1 | 11 px, kredit 6.35:1 |

**Brauzer xato deb belgilagan, lekin haqiqiy bo'lmagan holatlar** (qo'lda tekshirildi):

- Desktop nav havolasi — fon 86% shaffof ivory teal ustida, ya'ni qora matn **9.41:1**. Prob 95% dan zich fonni talab qilgani uchun uni o'tkazib yuborgan.
- Hero sarlavhasi, kategoriya kartalari va footer matni — RASM va GRADIENT ustida. Bunday matnni bu usul bilan o'lchab bo'lmaydi.
- 18 ta "oqish" yozuvi — hammasida `doc === client`, ya'ni sahifa yon tomonga aylanmaydi. Belgilangan element kesilgan konteyner ichidagi `object-contain` rasm.

**Tuzatishlardan keyin:** mayda matn 0, sahifa xatosi 0, haqiqiy gorizontal oqish 0.

Skrinshotlar `.qa-screenshots/` ga yoziladi (gitignore'da).

## 6. Hali tekshirilmagan / qolgan xavflar

- **Xodim va admin ekranlari brauzerda ko'rilmadi.** Ular login va ma'lumotlar bazasini talab qiladi, shuning uchun faqat `tsc`, `eslint` va `next build` bilan tekshirildi. Oshxona shrift o'lchamlari va shoshilinchlik chegaralari haqiqiy chipta vaqtlari bilan sinalishi kerak.
- **`DataTable` endi karta ichida aylanadi** (`max-h-[70vh]`) — sticky sarlavha shuni talab qiladi. 1024×600 kassa planshetida bu ~420 px, ko'zdan o'tkazish kerak.
- **Mijoz saytining hero bloki** 390 px da matn va rasmni yonma-yon qo'yadi; CTA endi o'qiladi, lekin ustun hali ham tor (auditdagi 8.3, Low).
- **Migratsiya talab qilinmadi.** Hech qanday sxema o'zgarishi kiritilmadi — `stockDeductedAt` va `type`/`tableId` maydonlari allaqachon mavjud edi.
- **Chop etish faqat brauzer orqali.** Fizik printer integratsiyasi ataylab keyingi bosqichda qoldirildi va interfeys buni ochiq aytadi.
- **`:has()` bilan chek chop etish** Chrome 105+ / Safari 15.4+ talab qiladi; eski kassa brauzerida chek butun interfeys bilan chiqadi (buzilmaydi, lekin chiroyli emas).
- **Push bajarilmadi.** `NuriddinIsacov` hisobiga `ibrohimov0521/Mazetto-Food` ga yozish huquqi yo'q (HTTP 403). Barcha ish lokal commitlarda saqlanmoqda.
