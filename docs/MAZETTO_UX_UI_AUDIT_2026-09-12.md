# MAZETTO FOOD — UX/UI audit hisoboti

Sana: 2026-09-12
Qamrov: `apps/customer-web` (mijoz sayti), `apps/pos-web` xodim ekranlari (kassa, to'lov, chek, smena, oshxona, kuryer, ofitsiant, login) va admin/menejer paneli.
Usul: statik kod tahlili (barcha sahifa va komponentlar, CSS tokenlar, media-querylar). Kontrast koeffitsiyentlari CSS'dagi haqiqiy hex/rgba qiymatlaridan WCAG formulasi bilan hisoblandi. Brauzerda skrinshot olinmadi, shuning uchun "vizual" holatlar kod dalili bilan berilgan. Hech qanday fayl o'zgartirilmadi.

Batafsil, har topilma uchun fayl:qator ko'rsatilgan uch ilova hisobot: `docs/ux-audit/customer-web.md`, `docs/ux-audit/staff.md`, `docs/ux-audit/admin.md`.

---

## 1. Umumiy xulosa

Loyiha texnik jihatdan puxta qurilgan: idempotent buyurtma yuborish, native `<dialog>` bilan fokus boshqaruvi, skeleton/xato holatlari, safe-area qo'llab-quvvatlash, RBAC tushuntirishli tugmalar. Lekin UX jihatdan uchta tizimli zaiflik bor:

1. **Rang semantikasi buzilgan.** Sariq (gold) bir vaqtda asosiy CTA, narx, faol tab, faol nav, "kutilmoqda" holati va oshxona izohi rangi. Ko'z "nimaga e'tibor berish kerak"ni rangdan ajrata olmaydi. `docs/DESIGN_RULES.md` (oq/yashil/ko'k) bilan `docs/design/MAZETTO_DESIGN_LOCK.md` (teal/gold/ivory) bir-biriga zid, va kod shu ziddiyatni aks ettiradi.
2. **Mayda matn va mayda tugmalar.** 9–12 px matn (bottom nav, mahsulot kartasi, admin sidebar) va 28–40 px tugmalar (admin `sm`/`md`, kassadagi +/−, o'chirish) dizayn qoidalaridagi "no tiny text / no tiny buttons" talabini buzadi.
3. **Uch xil dizayn tizimi bitta mahsulotda.** Mijoz sayti, StaffShell (kassa/oshxona/kuryer), AuthShell + Tailwind emerald (to'lov/chek), admin-ui va erp-ui — tugma, radius, rang, valyuta formati va til bo'yicha bir-biridan farq qiladi.

Biznesga bevosita ta'sir qiladigan eng jiddiy 5 muammo:

| # | Muammo | Qayerda | Ta'sir |
|---|--------|---------|--------|
| 1 | Birinchi "+" bosilganda mahsulot savatga tushmaydi, avval filial + xaritada manzil so'raladigan modal ochiladi; modal yopilsa mahsulot yo'qoladi | `customer-web/lib/cart.tsx:421-425` | Konversiya yo'qotish, "tugma ishlamayapti" hissi |
| 2 | Kassa (POS) faqat naqd qabul qiladi; buyurtma turi (zal/olib ketish/yetkazish) tanlanmaydi; `/pos/payment` sahifasiga havola yo'q | `pos-web/app/(fullscreen)/pos/page.tsx:310-340, 597-655` | Karta mijozlariga xizmat ko'rsatib bo'lmaydi, oshxona buyurtmani noto'g'ri yo'naltiradi |
| 3 | Kuryer "Yetkazildi" bosganda to'lov usuli har doim `CASH` deb yoziladi | `pos-web/components/courier/courier-orders.tsx:279-281` | Onlayn to'langan buyurtmalar kassa balansini buzadi |
| 4 | Ofitsiant ekranida xato/yuklanish/ikki marta bosishdan himoya umuman yo'q | `pos-web/app/(fullscreen)/waiter/page.tsx:56-139` | Ikki marta stol ochiladi, oshxonaga yuborish jimgina muvaffaqiyatsiz bo'ladi |
| 5 | Aloqa footeridagi telefon `+99895855406` (8 raqam), noto'g'ri raqam | `customer-web/components/contact-footer.tsx:22` | Mijoz qo'ng'iroq qila olmaydi |

Ilova hisobotlardagi topilmalar soni (bu hujjatdagi umumlashtirilgan ro‘yxat ba’zi topilmalarni ajratib bergani uchun soni biroz ko‘proq):

| Qism | Critical | High | Medium | Low | Jami |
|------|----------|------|--------|-----|------|
| Mijoz sayti | 0 | 4 | 26 | 28 | 58 |
| Xodim ekranlari | 3 | 12 | 25 | 11 | 51 |
| Admin panel | 0 | 10 | 34 | 14 | 58 |

---

## 2. Mijoz sayti (customer-web)

### 2.1 Navigatsiya va sahifalar joylashuvi

- **High.** Birinchi "+" bosilganda `addItem()` `false` qaytaradi va fulfilment dialogini ochadi. Dialogni yopish `pendingItem`ni tashlab yuboradi, toast yo'q (`lib/cart.tsx:421-425, 503-510`). **Tavsiya:** mahsulotni darhol savatga qo'shish, filial/manzilni savat yoki checkout bosqichida so'rash. Agar gating qolsa, yopilganda "Manzil tanlangach savatga qo'shiladi" toastini ko'rsatish va olib ketishni default qilish.
- **Medium.** Mahsulot sahifasidagi "orqaga" qattiq `/menu` ga olib boradi, kategoriya/qidiruv konteksti yo'qoladi (`product-client.tsx:150-158`). `router.back()` ishlatish.
- **Medium.** Buyurtma tafsilotida ro'yxatga qaytish havolasi yo'q (`orders/[id]/page.tsx:177-253`).
- **Medium.** Avtorizatsiyasiz checkout'da faqat telefon formasi ko'rinadi, buyurtma tarkibi va summa yashirin (`checkout/page.tsx:438-461`). Summani auth paneli yonida ko'rsatish.
- **Medium.** Muvaffaqiyat sahifasidagi "Holatni kuzatish" `/orders` ro'yxatiga, aniq buyurtmaga emas (`order-success/[id]/page.tsx:169-171`).
- **Low.** Bottom nav'da savat yorlig'i o'rniga summa chiqadi, ustiga son badge — ikkita raqam, birlik yo'q (`site-shell.tsx:62-67`).
- **Low.** `branch-picker.tsx` hech qayerda import qilinmagan, o'lik komponent.

### 2.2 Tugmalar joylashuvi va o'lchami

- **Medium.** Mobil'da asosiy "Savatchaga qo'shish" tugmasi 12 px matnga qisqartirilgan (`product-detail.module.css:162-166`, `globals.css:1674`). Sahifadagi eng muhim tugma eng kichik matnda.
- **Medium.** Mahsulot sahifasida CTA variantlar, modifikatorlar va izoh maydonidan keyin, pastda to'liq menyu davom etadi — CTA skroll bilan yo'qoladi, sticky bar yo'q (`product-client.tsx:290-337`). Savat/checkout'dagi `OrderActionBar`ni qayta ishlatish.
- **Medium.** Savat va checkout'da ikkita fixed panel ustma-ust (bottom nav + action bar) 375×667 ekranning ~20 % ni egallaydi (`order-action-bar.css:1-17`). Action bar bo'lganda nav'ni yashirish.
- **Medium.** Savat va upsell'dagi +/− tugmalar 36 px (`cart/page.tsx:116-118`, `cart-upsell.tsx:149-173`). Minimum 44 px.
- **Medium.** Sozlash talab qiladigan mahsulotda "+" tugmasi aslida sahifaga o'tuvchi havola (`product-card.tsx:39-42`). Boshqa belgi/yorliq ("Tanlash").
- **Medium.** Savat action bar'ida "Jami" deb yetkazib berishsiz summa ko'rsatiladi, checkout'da esa kattaroq raqam chiqadi (`cart/page.tsx:172`).
- **Low.** Kartadagi stepper 2 soniyadan keyin yig'iladi, +/− yashirinadi (`product-card.tsx:142-173`).
- **Low.** "Qayta urinish", "Tahrirlash" 12 px matnli tugmalar (`checkout.css:375-388`). Bosh sahifa hero CTA mobil'da 11 px (`globals.css:1523-1527`).

Yaxshi: ikki marta yuborishdan himoya to'g'ri (`submitLock` + idempotency key, `checkout/page.tsx:352-436`).

### 2.3 Ranglar va kontrast

Hisoblangan WCAG koeffitsiyentlari (matn uchun talab ≥ 4.5:1, UI element ≥ 3:1):

| Juftlik | Koeff. | Holat |
|---|---|---|
| Ivory `#f5f5ef` / teal `#004f55` | 8.5 | ✅ |
| `#07373a` / sariq `#f5cf00` (CTA matni) | 8.5 | ✅ |
| `--mf-muted` (72 %) / ivory | 5.3 | ✅ |
| `--mf-text-soft` (58 %) / ivory | 3.5 | ❌ |
| `#17314A` 52 % / oq (savat, buyurtmalar, profil) | 3.1 | ❌ |
| `#17314A` 45–48 % / oq (buyurtma tafsiloti) | 2.6–2.8 | ❌ |
| Sariq narx / karta gradienti `#258e88→#096b70` | 2.6–4.1 | ❌ |
| Karta tavsifi `white/64`, 10 px | ≈2.5 | ❌ |
| Yashil `#3f9f68` / ivory | 3.0 | ❌ matn uchun |
| Aqua `#23958d` / ivory | 3.3 | ❌ matn uchun |
| Lavanda fokus halqasi `#b9b8f0` / ivory | 1.7 | ❌ |
| Sariq input fokus / ivory | 1.4 | ❌ |

- **High.** Menyu kartasida narx va tavsif — xarid uchun eng muhim ma'lumot — kontrastdan o'tmaydi (`product-card.tsx:118-122`, `globals.css:535-544`). Kartani `#004f55` yaxlit fonga o'tkazish (sariq → 6.1:1) yoki narxni ivory chipga `#07373a` bilan qo'yish.
- **High.** `text-[#17314A]/45…/62` variantlari 20 dan ortiq joyda; barchasi 4.5:1 dan past. Bitta `--mf-muted` (0.72) tokeniga o'tkazish.
- **Medium.** Fokus halqasi (lavanda) asosiy tugmalarda ko'rinmaydi; input fokus sariq; checkout'da esa yashil — ikki xil fokus tili (`globals.css:1034-1040, 1154-1158`, `checkout.css:811-814`).
- **Medium.** Barcha bekor qilinmagan buyurtma holatlari bir xil sariq chip: "Yangi" va "Yetkazildi" farqlanmaydi (`orders/page.tsx:262-269`). Holat → rang xaritasi: NEW/CONFIRMED sariq, PREPARING/READY teal, COMPLETED yashil, CANCELLED qizil.
- **Medium.** Sariq 10 xil rolda: CTA, narx, faol tab, faol nav, "Set" badge, sevimli, bo'lim chizig'i, checkout qadam. CTA ajralib turmaydi. Sariqni faqat CTA (+ narx) uchun qoldirish, faol holatlarni teal/aqua'ga o'tkazish.
- **Low.** Token nomlari yolg'on: `--mf-orange` aslida sariq, `--mf-blue` va `--mf-aqua` bir xil teal (`globals.css:13-17`).
- **Low.** Palitradan tashqari ranglar: Tailwind `sky-500` skeleton, `green-500` soya, `#22C55E` neon yashil (design lock taqiqlagan), `#67e8f9` cyan.
- **Low.** 6 xil "qora matn" (`#07373a`, `#17314A`, `#004f55`, `#0A4F55`, `#173d37`, `#063f3e`) va 10 ta yaqin teal/yashil. Ikki tokenga qisqartirish.

### 2.4 Formalar

- **Medium.** Auth paneli `<form>` emas: Enter yubormaydi, kod maydoni avtofokus olmaydi, `expiresAt` ko'rsatilmaydi, qayta yuborish cooldown yo'q (`customer-auth-panel.tsx:137-222`).
- **Medium.** Checkout'da telefon oddiy `<input type="tel" maxLength=40>`, auth'da esa puxta `PhoneInput` (+998, paste tozalash). Bitta oqimda ikki xil telefon UI (`checkout/page.tsx:609-623`).
- **Low.** `aria-invalid` bor, lekin xato matni `aria-describedby` bilan bog'lanmagan; `house` maydoniga `address-line2` autocomplete noto'g'ri; qavat/podyezd `inputMode` yo'q.
- **Low.** Mahsulot izohi `<textarea>` `maxLength`siz (`product-client.tsx:283-287`).
- **Low.** Qidiruv "⌕" va "x" matn glifi, Android'da kvadrat chiqishi mumkin. Lucide ikonkalarga o'tish.

### 2.5 Fikr-mulohaza (toast, bo'sh holat, xato)

- **Medium.** Toast action bar ustiga tushadi va aynan checkout xatosi paytida jami/CTA ni yopadi (`site-shell.tsx:74-81`, `order-action-bar.css:100-104`).
- **Medium.** Muvaffaqiyat va xato uchun bitta toast uslubi, ikonka yo'q, yopish tugmasi yo'q, 2.4 s da yo'qoladi; xato `role="status"` bilan (`site-shell.tsx:74-81`). Variant + `role="alert"` + uzoqroq muddat.
- **Low.** Mahsulot sahifasi SSR ma'lumot bo'lsa ham qayta yuklab, foydalanuvchi tanlagan variantni qaytarib qo'yadi (`product-client.tsx:57-86`).
- **Low.** `AnimatedNumber` reduced-motion'ni hurmat qilmaydi.

### 2.6 Checkout oqimi

- **High.** Xulosada har doim "Buyurtmani olganda naqd to'lov" yozuvi, karta tanlansa ham (`checkout/page.tsx:780-782`).
- **Medium.** Kvota kelgunga qadar 4 ta to'lov usuli tanlanadi; keyin mavjud bo'lmasa radio yo'qoladi, lekin `paymentMethod` state qoladi → yaroqsiz usul bilan yuboriladi (`checkout/page.tsx:142-159, 643-680`).
- **Medium.** Manzil tiklanganda "birinchi delivery yoqilgan filial" tanlanadi, eng yaqin filial mantiqi yo'q, masofa ko'rsatilmaydi (`lib/cart.tsx:31-56`, `fulfillment-dialog.tsx:190-219`).
- **Medium.** Barcha to'lov usullari bitta `Banknote` ikonkasi bilan.
- **Medium.** Checkout qatorlarida modifikatorlar ko'rsatilmaydi, lekin narxga kiritilgan (`checkout/page.tsx:691-724`).
- **Medium.** Minimal buyurtma va yetkazib berish narxi kvota kelguncha noma'lum; xato faqat yuborishda.
- **Low.** 3-qadam progress dekorativ: 1-qadam havola emas, 3-qadam hech qachon faol bo'lmaydi.

### 2.7 Mahsulot va menyu

- **Medium.** Kompakt kartalarda 10 px matn (tavsif, badge, "Set") past kontrastli gradient ustida (`product-card.tsx:101-118`).
- **Medium.** Mavjud emas / tugagan mahsulot holati UI'da umuman yo'q (`lib/types.ts`da `isAvailable` o'qilmaydi). Faqat yuborishda xato.
- **Low.** Qidiruv sticky tab'lardan yuqorida, skroll bilan yo'qoladi (`customer-menu-sections.tsx:194-211`).
- **Low.** Rasm va sarlavha ikkita alohida havola — 74 mahsulot = 148 tab-stop.
- **Low.** Karta matni uchun qattiq `grid-template-rows: 2.4rem 2rem 1.9rem` — Android'da Roboto balandroq, ikkinchi qator kesiladi (`globals.css:581, 1596`).

### 2.8 Responsivlik

- **Medium.** Bottom nav yorliqlari 9–10 px (`site-shell.tsx:53`, `globals.css:1482-1486`).
- **Medium.** `font-family: Arial` + `font-black` (900): Arial'da 900 yo'q, Android'da Arial yo'q — barcha qattiq balandliklar bitta platformaga moslangan (`globals.css:66`). `next/font` bilan haqiqiy 700/800 shrift.
- **Low.** 375 px da hero matni va rasmi yonma-yon, matn ustuni ~150 px (`homepage-sliders.tsx:33-64`).
- **Low.** Checkout `min-height: calc(100dvh - 80px)` + 150 px pastki padding — qisqa kontentda katta bo'sh maydon.

Yaxshi: `viewportFit: cover`, `env(safe-area-inset-*)` header/nav/bar/toast/dialogda; `overflow-x: clip`; mobil inputlar 16 px (iOS zoom yo'q).

### 2.9 Accessibility

- **Medium.** Fokus halqalari 3:1 dan past (2.3 ga qarang).
- **Medium.** Ikonka o'rnida matn gliflari (×, ♥, ⌕, ⌖, ‹ ›, →, ✓) — shriftga bog'liq.
- **Low.** Kategoriya tab'lari `aria-pressed` bilan tugma, `tablist` emas.
- **Low.** Xarita konteynerida `role`/`tabIndex` yo'q, klaviatura bilan surish haqida ishora yo'q.
- **Low.** To'lov holati xom enum ("PENDING") ko'rsatiladi (`orders/[id]/page.tsx:246`).

### 2.10 Izchillik

- **Medium.** 7 xil tugma tizimi, 4 xil sariq (`#f5cf00`, `#ffd83d`, `#ffdd29`, gradient), radius 8/10/12/16/20/24, 12–15 px matn — bitta "primary" rol uchun. Mahsulot sahifasidagi teal "Menyu" tugmasi asosiy CTA'ga o'xshaydi.
- **Medium.** Buyurtma holati yorliqlari 3 joyda takrorlangan va farq qiladi: NEW = "Yangi" / "Yangi buyurtma"; COMPLETED = "Yakunlandi" / "Yetkazildi"; SERVED, ACCEPTED xom chiqadi (`order-success:26-34`, `profile:31-39`, `lib/order-tracking.ts:12-22`).
- **Medium.** Footer telefon `+99895855406` — 8 raqam, `formatPhone` ishlatilmagan.
- **Low.** "Savat" / "Savatcha" / "savatga"; "Buyurtma" / "Buyurtmalar" / "Buyurtmalarim"; "Bosh" / "Bosh sahifa".
- **Low.** `globals.css` va `checkout.css`da ~15 ta o'lik CSS bloki; 40 qatorlik `.text-white\/NN` remap xaki.
- **Low.** Hamma joyda `font-black` (900) — hech narsa ajralib turmaydi.

### 2.11 Buyurtma kuzatish va profil

- **Medium.** "Qayta buyurtma" yo'q — doimiy mijoz savatni qaytadan yig'adi.
- **Medium.** NEW buyurtmani bekor qilish va buyurtma sahifalarida qo'llab-quvvatlash aloqasi yo'q.
- **Medium.** Profildagi "Saqlangan manzillar" o'tgan buyurtmalardan olingan matn chiplari; haqiqiy `/customer/me/addresses` ko'rsatilmaydi va tahrirlanmaydi (`profile/page.tsx:88-95`).
- **Low.** "Chiqish" tasdiqsiz, "Buyurtmalarim" bilan bir xil o'lchamda.
- **Low.** Bonus balans 2 joyda ko'rsatiladi, lekin checkout'da ishlatib bo'lmaydi va tushuntirilmaydi.
- **Low.** Sana soniyalar bilan ("14:03:22").
- **Low.** Naqd buyurtmada "To'lov ma'lumoti hali biriktirilmagan" — muammo bordek eshitiladi.

---

## 3. Xodim ekranlari (pos-web fullscreen)

### 3.1 Kassa (POS)

- **Critical.** Buyurtma turi tanlanmaydi (DINE_IN/PICKUP/DELIVERY). Payload faqat `items`, `cashReceived`. Oshxona barcha POS chiptalarini "Olib ketish" deb ko'rsatadi (`pos/page.tsx:310-340`, `kitchen/page.tsx:559-563`). Chek panelining tepasiga segment control qo'shish.
- **Critical.** Faqat naqd. "Buyurtmani tasdiqlash" naqd summa ≥ jami bo'lmaguncha bloklangan; `/pos/payment` sahifasiga hech qanday havola yo'q (`pos/page.tsx:597-655`). To'lov usuli qatorini checkout blokiga qo'shish, naqd klaviaturani faqat Naqd tanlanganda ko'rsatish, split tender.
- **High.** Sensorli kassada ekran klaviaturasi yo'q; `<input type="number">` (e, -, scroll bilan o'zgaradi); tez summa faqat +50 000 / +100 000 (`pos/page.tsx:599-635`). 56 px tugmali keypad + 5k/10k/20k/50k/100k/200k qatori.
- **High.** Savat faqat component state'da; "Smena" tugmasi, orqaga yoki reload — savat jimgina yo'qoladi, `beforeunload` yo'q (`pos/page.tsx:126, 372-386`). `sessionStorage`ga saqlash + ogohlantirish.
- **High.** Chegirma, kutib turish (park), buyurtma/mahsulot izohi, xizmat/yetkazish haqi yo'q — barchasi `POS_SPEC.md`da talab qilingan. KDS `item.notes`ni ko'rsatadi, lekin POS yubormaydi.
- **Medium.** Savatdagi +/− 40 px, o'chirish 36 px va +/− dan 12 px yuqorida — tasodifiy o'chirish (`staff.module.css:1035-1069`). Tez naqd tugmalari 36 px / 12 px.
- **Medium.** Sotuvdan keyin keyingi qadam yo'q: "Chek chop etish", "Yangi buyurtma" tugmalari yo'q, `/pos/receipt/[id]` ga o'tish yo'q (`pos/page.tsx:527-537`).
- **Medium.** Landshaft telefon / 1024×600 planshetda desktop rejim qoladi, savat qatorlari ko'rinmaydi (`staff.module.css:843-849, 1204`).
- **Medium.** Yuborish paytida barcha 20 ta mahsulot plitkasi xiralashadi (`pos/page.tsx:486`).
- **Low.** Klaviatura yorliqlari (Enter = to'lov, Esc, /) yo'q. Sevimli/tez-tez mahsulotlar yo'q. Plitkalar qatorni to'ldirmaydi.

### 3.2 To'lov sahifasi

- **High.** Faqat aniq summa qabul qilinadi (`tenderTotal !== outstanding` → disabled), qaytim hisoblanmaydi (`payment/page.tsx:211`). 73 000 ga 100 000 berib bo'lmaydi.
- **High.** Xato, yuklanish, ikki marta bosishdan himoya yo'q; har chaqiruvda yangi UUID — retap ikkinchi to'lov yaratadi (`payment/page.tsx:83-101`).
- **High.** Tasdiqlash, chek qadami, kassaga qaytish yo'q; `AuthShell` (admin ko'rinishi) — kassir boshqa ilovaga tushib qolgandek (`payment/page.tsx:31`).
- **Medium.** Inglizcha/o'zbekcha aralash ("Cash register", "Payable orders", "TO'LOV"), xom kodlar (UZCARD, ONLINE), "UZS" vs "so'm".
- **Medium.** Tender qatorlari mayda, "Remove" faqat qizil matn.

### 3.3 Chek

- **Medium.** `window.print()` yo'q, print stylesheet yo'q, xato holati yo'q ("Receipt is loading." abadiy qoladi) (`receipt/[id]/page.tsx:41-51`).
- **Low.** Sana timezone'siz; tugmalar 36 px.

### 3.4 Oshxona displeyi (KDS)

- **High.** Chipta matni 11–13 px, taymer 12 px — 1–2 m masofadan o'qib bo'lmaydi (`staff.module.css:643-712`). Mahsulot nomi ≥ 22 px, miqdor chipi ≥ 28 px, taymer ≥ 20 px; "TV" zichlik rejimi.
- **High.** Shoshilinchlik faqat 25 daqiqada qizil taymer; karta darajasida rang yo'q; `priority` maydoni keladi, lekin ko'rsatilmaydi (`kitchen/page.tsx:568`). 5/10/15 daq. bosqichli chegara, karta chetida rang tasmasi, yosh bo'yicha saralash.
- **Medium.** Ovoz signali 0.18 s, 8 % gain, har safar yangi `AudioContext`, autoplay bloklanganda hech qanday ishora yo'q (`kitchen/page.tsx:688-708`). Fritur shovqinida eshitilmaydi.
- **Medium.** Amal xatosi sahifa tepasida, chiptadan 800 px uzoqda (`kitchen/page.tsx:365-369`).
- **Medium.** Bitta global qulf: bir bump paytida barcha chiptalar bloklangan, 12 s gacha (`kitchen/page.tsx:412`).
- **Medium.** Ustunlar alohida skroll qilmaydi; 12 ta NEW chipta READY ustunini ekrandan chiqarib yuboradi; stats bloki doimiy ~150 px.
- **Low.** Stansiya (oshxona/bar) filtri yo'q. "Tayyor" ham ustun nomi, ham tugma yorlig'i. "Tayyorlanmoqda" sariq warning tonida.

### 3.5 Kuryer

- **High.** Har bir yetkazish `paymentMethodCode: "CASH"` bilan yopiladi; kartada to'lov holati ko'rsatilmaydi (`courier-orders.tsx:279-281, 817-831`). "To'lov: naqd / to'langan" ko'rsatish, naqd bo'lsa "Naqd oldingizmi?" so'rash.
- **Medium.** Kassirga naqd topshirish tasdiqsiz, kassirdagi `CashHandover` esa tasdiq so'raydi (`courier-orders.tsx:327-348`).
- **Medium.** Kuryer istalgan buyurtmani bir tasdiq bilan bekor qila oladi, sabab so'ralmaydi (`courier-orders.tsx:832-841`).
- **Medium.** Oflayn holat yo'q (`navigator.onLine` ishlatilmagan); podvalda "Yetkazildi" 12 s kutib xato beradi va unutiladi.
- **Medium.** Kartalar saralanmagan (READY birinchi, masofa bo'yicha emas), `distanceKm` bor lekin ishlatilmaydi.
- **Low.** Logo `transform: scale(1.85)` layout joyi ajratmaydi, telefonda sarlavha ustiga chiqishi mumkin (`staff.module.css:1-3`).

### 3.6 Ofitsiant

- **Critical.** Hech qayerda try/catch, yuklanish, disabled yo'q: "Open table" ikki marta = ikki buyurtma; "Send kitchen" xatosi ko'rinmaydi (`waiter/page.tsx:56-139`).
- **High.** Buyurtma kiritish real xizmat uchun yaroqsiz: kategoriya, qidiruv, variant, modifikator, miqdor, izoh, o'chirish yo'q; mahsulot tugmalari ~40 px, `max-h-64` ro'yxat (`waiter/page.tsx:200-206`).
- **High.** "Send kitchen" / "Request pay" tasdiqsiz, 36 px, bir xil uslub.
- **Medium.** Band stol qizil (dizayn qoidasida qizil faqat destructive), holat xom enum 11 px, zal bo'yicha guruhlash yo'q.
- **Medium.** Butun sahifa inglizcha, summa formatlanmagan.

### 3.7 Smena va naqd topshirish

- **Medium.** Kamomad yashil rangda ko'rsatiladi (`.change { color: #347555 }` shartsiz) (`shift/page.tsx:469-476`, `staff.module.css:1117-1124`).
- **Medium.** Ochilish balansi default "0", bir bosishda qabul qilinadi (`shift/page.tsx:98, 557-571`).
- **Medium.** Topshirish dialoglarida "Ortga" tugmasi yo'q; xato sahifada ham, dialogda ham takrorlanadi.
- **Low.** KITCHEN/COURIER rollari kassir smena konsoliga yo'naltiriladi, oshpaz naqd smena ocha oladi.

### 3.8 Login / workspace

- **Medium.** Faqat parol; umumiy kassa uchun PIN yoki tez foydalanuvchi almashtirish yo'q (`login/page.tsx:118-128`).
- **Medium.** Routing va guard paytida bo'sh oq ekran (`workspace/page.tsx:25`, `permission-guard.tsx:34`) — sekin planshetda "qotib qoldi"dek.
- **Low.** "JWT va refresh session xavfsizligi", "permission" — texnik jargon.
- **Low.** Access-denied faqat "login'ga qaytish" taklif qiladi, foydalanuvchi hali tizimda.
- **Low.** Telefon 9 raqamdan kam bo'lsa jimgina hech narsa bo'lmaydi.

### 3.9 Ranglar (staff)

| Juftlik | Koeff. | Holat |
|---|---|---|
| Bo'sh holat matni `#69847a` / `#f0f5f4` | 3.7 | ❌ |
| Input chegarasi `#b4ccc0` / oq | 1.7 | ❌ UI |
| Tugma chegarasi `#d5e2dd` / oq | 1.3 | ❌ UI |
| Qolgan asosiy juftliklar | 4.9–13 | ✅ |

- **Medium.** Gold uch ma'noda: CTA, "kutilmoqda" badge, oshxona izohi, miqdor chipi, NEW ustun chegarasi. KDS'da "nimaga e'tibor" rangdan ajralmaydi.
- **Low.** Login/to'lov/chek Tailwind `emerald-*`, ofitsiant qattiq hex, StaffShell `#004f55/#128780` — palitra siljishi.

### 3.10 Umumiy (staff)

- **High.** Uch xil dizayn tizimi bitta kassir sessiyasida: POS (StaffShell) → to'lov (AuthShell, emerald, `rounded-3xl`) → chek. To'lov/chek/ofitsiantni StaffShell'ga o'tkazish.
- **Medium.** `money()` 5 joyda takrorlangan, ba'zilari yaxlitlaydi, ba'zilari "UZS". Tarix dialogi 3 faylga copy-paste.
- **Medium.** Toast yo'q; POS muvaffaqiyat banneri keyingi qo'shishgacha qoladi; oshxona/kuryerda muvaffaqiyat fikri yo'q.
- **Medium.** Oflayn holat hech qayerda yo'q.
- **Medium.** `<select>` fokus halqasidan chiqarib qo'yilgan; KDS yangi chiptalar `aria-live` bilan e'lon qilinmaydi.
- **Low.** Header panel havolalari 12 px / 32 px, chiqish ikonkasi 34 px — sensorli kassada eng qiyin nishonlar.

---

## 4. Admin / menejer paneli

### 4.1 Navigatsiya

- **High.** 25 ta element, 8 ta tekis guruh; "Kassa va moliya" oxirgi guruh, "Hisobotlar" bitta elementli guruh; moliya 3 guruhga tarqalgan (`lib/admin-nav.ts:48-306`). Foydalanish chastotasi bo'yicha tartiblash, yig'iladigan guruhlar.
- **Medium.** Bir xil ikonkalar turli sahifalarda (`gauge` ×2, `truck` ×2, `building` ×2, `banknote` ×2) — 60 px yig'ilgan rail'da ikonka yagona belgi.
- **Medium.** Sidebar qatorlari ~30 px, header tugmalari 32 px (`admin-sidebar.tsx:92-99`, `admin-navbar.tsx:305-340`).
- **Medium.** `text-[10px]` guruh sarlavhalari, rol yorlig'i, avatar.
- **Medium.** Filial badge telefonda yashirin va "Filial" so'zini ko'rsatadi, filial nomini emas (`branch-scope-badge.tsx:639-650`).
- **Medium.** Faol holat ikki joyda turlicha (komponent va `admin-theme.css:184-188`), CSS yutadi.
- **Low.** Breadcrumb o'rtasidagi guruh havola emas; tafsilot sahifasida "Detal" / "Buyurtma", raqam pastda.

### 4.2 Dashboard

- **High.** 4 ta "bugun" KPI + katalog soni + sidebar takrori. Davr tanlash, trend, grafik, top mahsulotlar, ochiq buyurtmalar, filial kesimi yo'q (`admin-dashboard.tsx:99-145`).
- **Medium.** Menejer va buxgalter sahifalari bir xil `AdminDashboard`.
- **Medium.** Hisobot "grafigi" — 70 px li qatorlar ro'yxati; 30 kun = 2100 px; gold ustunlar oq fonda 1.4:1, yorliqlar xom ISO sana (`admin-reports.tsx:419-429`).
- **Medium.** Skeleton shakli yuklangan layoutga mos emas — har yuklashda layout shift.

### 4.3 Jadvallar

- **High.** Sticky header yo'q; 50 qatorli sahifalarda ustun ma'nosi yo'qoladi (`data-table.tsx:145-192`).
- **High.** Printerlar jadvali xom `<table>` + `overflow-hidden` — 375 px da kesiladi; hisobot jadvali raqamlarni chapga tekislaydi (`printers/page.tsx:96-121`, `admin-reports.tsx:718-794`).
- **Medium.** Saralash API bor, hech bir ekran ishlatmaydi.
- **Medium.** Qidiruv/filtr faqat joriy sahifada, lekin pagination hisobi filtrsiz — "1–50" yozuvi, jadvalda 3 qator.
- **Medium.** Bulk tanlash oddiy ustun sifatida; mobil kartada "Tanlash" yorlig'i; bulk panel doim ko'rinadi.
- **Medium.** Ikki xil qator-amal patterni (`rowActions` vs inline ustun); ba'zi jadvallarda har qatorda qizil tugma.
- **Medium.** Mobil kartada matn 12 px — desktopdan kichik.
- **Medium.** `hideOnMobile` ustunlarni jimgina yo'qotadi ("Batafsil" yo'q).
- **Low.** Oxirgi sahifada aynan `pageSize` qator bo'lsa "Keyingi" bo'sh sahifaga olib boradi.

### 4.4 Formalar

- **High.** `FormField` `error` prop'ini qo'llab-quvvatlaydi, lekin hech bir ekran uzatmaydi; barcha validatsiya 5 soniyalik toast (`form.tsx:335-382` va 6 ta ekran). Maydon belgilanmaydi, fokus yo'q.
- **High.** Mahsulot yaratilgach `history.replaceState` — `productId` o'zgarmaydi, `isNew` `true` qoladi, ikkinchi "Saqlash" yana `POST` → dublikat mahsulot (`admin-product-editor.tsx:314-316`).
- **High.** Saqlash/Bekor qilish uzun sahifaning pastida, sticky emas; dirty-state va saqlanmagan o'zgarish ogohlantirishi yo'q.
- **Medium.** Variant qatori 1024–1279 px da kartadan chiqib ketadi (`admin-product-editor.tsx:509-573`).
- **Medium.** Kategoriya/homepage'da rasm uchun matn maydoni, `ImageDropzone` bor lekin ishlatilmagan.
- **Medium.** Staff/catalog ekranlari o'z `Select`/`Field`/`Check` primitivlarini qayta yozadi, balandliklar mos kelmaydi.
- **Medium.** Staff editorida `<label>` ichida `<label>` (nested labels, noto'g'ri HTML).
- **Medium.** Staff editorida yuklanish holati yo'q; Save disabled emas — ikki marta yuborish mumkin.
- **Medium.** "O'z parolimni o'zgartirish" xodimlar ro'yxati sahifasining pastida, placeholder-only inputlar.
- **Medium.** `customer_delivery_enabled` kabi kill-switch toggle'lar bir bosishda tasdiqsiz saqlanadi (`admin-settings.tsx:278-290`).
- **Low.** Ish vaqti modalida footer skroll bilan yo'qoladi.

### 4.5 Tugmalar

- **High.** `sm` = 28 px / 12 px, `md` = 36 px; `lg` yo'q; hech bir o'lcham 44 px ga yetmaydi. `sm` barcha qator amallarida default (`button.tsx:27-30`).
- **Medium.** `loading` prop yo'q; har ekran "Saqlanmoqda..." ni qo'lda yozadi ("..." vs "…"), spinner yo'q; ba'zi o'chirish tasdiqlarida busy yo'q → ikki `DELETE`.
- **Medium.** "Nofaol qilish" (qaytariladigan) `danger` variantda.
- **Medium.** "Tahrirlash" ba'zida `secondary`, ba'zida `ghost`; bir ekranda 2–3 ta gold `primary`.
- **Low.** Modal/toast yopish tugmasi "✕" matn glifi 28 px.

### 4.6 Modallar

- **Medium.** Backdrop bosish har qanday modalni yopadi, forma ma'lumoti yo'qoladi, ogohlantirish yo'q.
- **Medium.** Tasdiqsiz jiddiy amallar: kuryer qayta biriktirish (`<select onChange>`), mahsulot filial mavjudligi (mijozga darhol ko'rinadi), xodim bloklash (barcha sessiyalar o'ldiriladi), parol reset, stol holati.
- **Low.** Fokus panelga tushadi, birinchi maydonga emas.
- **Low.** Yarim modallar `footer` prop, yarmi qo'lda yozilgan div.

### 4.7 Fikr-mulohaza

- **Medium.** Barcha toastlar, xatolar ham, 5 s da yo'qoladi; hover'da pauza yo'q, Undo/Retry yo'q.
- **Medium.** Optimistik yangilanish yo'q; har mutation to'liq `load()` → butun sahifa skeletonga almashadi (kategoriya, filial).
- **Medium.** Xato yuzalari izchil emas: ba'zida sahifa o'rnida, ba'zida ustida, ba'zida toast.
- **Low.** Oshxona monitorida "oxirgi yangilanish" ko'rsatkichi yo'q.

### 4.8 Ranglar (admin)

| Juftlik | Koeff. | Holat |
|---|---|---|
| `text-muted #5c7b7e` / oq | 4.6 | ✅ (chegarada) |
| `text-muted` / `#eef4f3` (jadval th, badge, tabs, filter) | 4.1 | ❌ |
| `text-muted` / canvas `#f0f5f4` (sahifa tavsifi) | 4.2 | ❌ |
| `text-faint #9db0b2` / oq (holat tarixi sababi, InfoBox, ikonkalar) | 2.3 | ❌ |
| Oq / `accent #23958d` (secondary tugma) | 3.7 | ❌ |
| `accent` / oq (saralangan header) | 3.7 | ❌ |
| Gold / oq (tugma cheti, grafik ustunlari) | 1.4 | ❌ UI |
| Input chegarasi `#dde7e6` / oq | 1.3 | ❌ UI |
| Toggle-off `#b8ccca` / oq | 1.7 | ❌ UI |
| Sidebar matn/faol | 6.5 / 8.6 | ✅ |

- **High.** `text-faint` kontent rangi sifatida ishlatilgan.
- **High.** `secondary` tugma va saralangan header 4.5:1 dan past. Secondary → `#06616a` (6.6:1).
- **Medium.** Qizil "Yopiq" mahsulot/filial, band stol uchun; warning "Tavsiya", SUPER_ADMIN, "Tizim roli" uchun. `info` va `success` yaqin ranglar, 12 px badge'da farqlanmaydi.
- **Medium.** AdminLTE qoldiqlari: har `.bg-mz-primary` elementda 2 px bevel soya (avatar, logo, grafik ustunlari), header ostida gold chiziq, `h1` chap gold tasma (access-denied markazlangan sarlavhada ham), 64 px `InfoBox` ikonka bloki (`admin-theme.css:156-204`).
- **Low.** `.mz-admin * { letter-spacing: 0 }` barcha `tracking-*` utilitalarini o'chiradi.
- **Low.** `.report-select` Tailwind emerald hex.

### 4.9 Buyurtmalar boshqaruvi

- **High.** Buyurtma raqami / telefon bo'yicha qidiruv va sana oralig'i yo'q — 25 tadan varaqlash (`admin-orders.tsx:364-438`).
- **Medium.** Holat o'zgartirish barcha 6 holatni tekis qatorda beradi (NEW → SERVED ham); CANCELLED uchun sabab ixtiyoriy.
- **Medium.** Refund/void oqimi yo'q; `REFUNDED` yorlig'i bor, hech narsa uni yaratmaydi.
- **Medium.** Buyurtma tafsilotidan chek/chop etish yo'q.
- **Low.** Bulk sabab inglizcha ("Admin bulk action: …"), tarixga yoziladi; "employee:/user:" prefikslari xom.

### 4.10 Responsivlik va accessibility

- **Medium.** 768–1023 px da sidebar to'liq off-canvas, mini-rail yo'q — planshetda har navigatsiya hamburger orqali.
- **Medium.** Root `overflow-x-hidden` overflow xatolarini yashiradi (recipes 1024 px da chiqib ketadi, dropzone 768 px da).
- **High.** Placeholder-only inputlar: parol paneli, printers ("Branch ID"), recipes ("Ingredient ID"), reports (5 select + 2 sana, label yo'q).
- **Medium.** Mobil drawer fokusni ichiga olmaydi, trap yo'q, body skroll qulflanmaydi.
- **Medium.** `role="tab"` bor, lekin strelka navigatsiyasi yo'q.
- **Medium.** Yig'ilgan sidebar'da havola nomi faqat `title`.
- **Medium.** Disabled tugmada sabab faqat `title` (ko'rinmaydi); `GuardedButton` bor, ishlatilmagan.

### 4.11 Izchillik (admin)

- **Medium.** `erp-ui.tsx` admin'da ishlatilmaydi; hisobot o'z `Metric/Panel/DataTable` ni qayta yozadi; filial ro'yxati `useEffect` 7 ekranda takrorlangan.
- **Medium.** KPI o'lchamlari 4 xil; `font-black` staff/reports/navbar'da, `admin-ui` 700 dan oshmaydi.
- **Medium.** Printers va recipes sahifalari to'liq inglizcha; CANONICAL/LEGACY, rol kodlari, printer enum, to'lov kodlari xom; "N/A" vs "—". Ruscha matn topilmadi.
- **Medium.** `formatMoney` 4 ta shaxsiy nusxa; sana 3 xil format; grafik yorliqlari xom ISO.
- **Low.** `gap-4/5/6`, `p-4/5` aralash.

---

## 5. Yaxshi qilingan joylar

**Mijoz sayti:** markazda savatli fixed bottom nav (`aria-current`, badge); idempotent checkout + sessiya yangilash; native `<dialog>` fulfilment, bottom-sheet ≤ 599 px; reverse-geocode autofill + Toshkent zona tekshiruvi + GPS timeout xabarlari; IntersectionObserver scrollspy'li sticky tab'lar; har async yuzada skeleton, oflayn/timeout xabarlari o'zbekcha; `PhoneInput` (+998, paste tozalash); socket + polling + fokusda yangilanuvchi buyurtma kuzatish.

**Xodim ekranlari:** POS'da idempotency key har savat o'zgarishida yangilanadi, ref-qulf; ochiq smenasiz POS ishlamaydi, yopishda expected/actual/farq modal; native `<dialog>` fokus tiklash bilan; mobil POS "Menyu/Buyurtma" segment + safe-area'li to'lov bar; kuryer `tel:` + Google/Yandex deep-link + koordinata validatsiyasi; KDS polling versiyalash + abort + yashirin tabda pauza; 44 px baza tugma, 48 px input, `prefers-reduced-motion`.

**Admin:** bitta doimiy shell, access-denied shell ichida; `DataTable` mobil karta ko'rinishi, `aria-sort`, `scope="col"`; `Modal` fokus trap + Escape + skroll qulfi + bottom-sheet; halol destruktiv matnlar ("arxivlash vs o'chirish", "chop etmaydi, faqat belgilaydi"); `GuardedButton` RBAC sababi bilan; race-safe `useApiResource`; telefon maskalash + "Ko'rsatish"; uch qatlamli token fayli, global `:focus-visible`.

---

## 6. Amalga oshirish rejasi

**1-bosqich — biznesga zarar (1–2 hafta)**
1. Mijoz: birinchi "+" ni savatga to'g'ridan-to'g'ri qo'shish; checkout xulosasidagi "naqd" matnini `paymentMethod`dan olish; yaroqsiz to'lov usulini reset qilish; footer telefonini tuzatish.
2. POS: buyurtma turi segment control; to'lov usuli qatori (naqd/terminal/Click/Payme) + ekran keypad; savatni `sessionStorage`ga saqlash + chiqishda ogohlantirish; sotuvdan keyin "Chek / Yangi buyurtma".
3. To'lov sahifasi: ortiqcha summa + qaytim; try/catch + qulf + barqaror idempotency key; StaffShell'ga o'tkazish.
4. Kuryer: to'lov holatini ko'rsatish, `CASH` ni faqat naqd bo'lsa yuborish.
5. Ofitsiant: xato/yuklanish/qulf; POS katalogi va item dialogini qayta ishlatish.
6. Admin: mahsulot yaratilgach `router.replace`; buyurtma qidiruvi + sana oralig'i.

**2-bosqich — rang va o'qilishi (1 hafta)**
1. Bitta `--mf-muted` (≥ 4.5:1), `#17314A/45–62` va `--mf-text-soft` ni olib tashlash; karta narx/tavsif fonini yaxlit teal qilish; fokus halqasini teal/aqua qilish.
2. Holat → rang xaritasi (sariq = kutilmoqda, teal = jarayonda, yashil = yakunlandi, qizil = bekor) mijoz, KDS va admin uchun bitta modulda.
3. Sariqni faqat CTA (+ narx) uchun qoldirish; faol tab/nav/radio → teal.
4. Admin: `text-faint` faqat dekorativ; secondary tugma `#06616a`; `text-muted` → `#4f6d70`; input/toggle chegarasi ≥ 3:1; AdminLTE bevel/chiziq/tasma qoidalarini olib tashlash.
5. Staff: bo'sh holat matni va input chegarasi.
6. Mayda matn: bottom nav ≥ 11 px, karta ≥ 12 px, mobil CTA ≥ 14 px, admin `text-[10px]` ≥ 11 px.

**3-bosqich — tugmalar va komponentlar (2 hafta)**
1. Mijoz: 3 ta tugma komponenti (primary/secondary/text), bitta sariq, bitta radius; savat/upsell +/− 44 px; mahsulot sahifasida sticky action bar; action bar bo'lganda nav yashirish.
2. Staff: +/− 48 px, o'chirish 44 px va joyini o'zgartirish; quick-cash 44 px; header havolalari 44 px; `StaffToast`, `useOnline()` banner, bitta `formatMoney` va `StaffHistoryDialog`.
3. Admin: `Button` `lg` (44 px) + `isLoading`; `md` ≥ 40 px; sidebar qatorlari 44 px; sticky jadval header; `selectable` DataTable; inline `FormField error` + birinchi xato maydonga fokus; sticky saqlash footer + unsaved guard; `dismissOnBackdrop={false}` formalar uchun; tasdiq modallari (kuryer, filial mavjudligi, bloklash, parol reset).

**4-bosqich — oqimlar va funksiyalar (2–3 hafta)**
1. Mijoz: qayta buyurtma, NEW'ni bekor qilish, buyurtma sahifasida aloqa; profilda haqiqiy saqlangan manzillar; eng yaqin filial + masofa; mavjud emas holati; auth `<form>` + OTP avtofokus + cooldown; checkout'da `PhoneInput`.
2. POS: chegirma, park/hold, izohlar; klaviatura yorliqlari; landshaft rejim.
3. KDS: katta shrift, bosqichli shoshilinchlik, ustun skroll, kuchli ovoz + unlock ishorasi, per-ticket qulf, inline xato, stansiya filtri.
4. Kuryer: saralash, oflayn navbat, tasdiqli topshirish, bekor qilishda sabab.
5. Smena: kamomad qizil, ochilish balansi bo'sh + oldingi yopilish taklifi, dialoglarda "Ortga".
6. Admin: dashboard davr/trend/e'tibor ro'yxati; rolga xos landing; haqiqiy SVG grafik; printers/recipes o'zbekcha; enum yorliqlari; `useBranches()`; optimistik yangilanish; toast pauza/Undo; planshetda mini-rail.

**5-bosqich — tozalash**
O'lik CSS va komponentlar (`branch-picker.tsx`, `.mf-mobile-action-bar`, `.text-white\/NN` remap, `erp-ui` admin uchun), token nomlari (`--mf-orange` → `--mf-yellow`), `next/font` bilan haqiqiy shrift, `font-black`ni 700–800 ga tushirish, matn glossariysi ("Savat", "Buyurtmalarim").

---

## 7. Hujjat ziddiyati haqida eslatma

`docs/DESIGN_RULES.md` oq/yashil/ko'k identifikatsiyani va sariqni faqat ogohlantirish uchun belgilaydi. `docs/design/MAZETTO_DESIGN_LOCK.md` esa teal/gold/ivory palitrasini va sariq CTA'ni qulflaydi. Bu hisobotda sariq CTA buzilish deb hisoblanmadi (lock ustun). Lekin lock sariqni faol tab, nav, badge va holat uchun ruxsat bermaydi — bu joylar buzilish sifatida belgilandi. Ikkala hujjatni bir-biriga moslashtirish tavsiya etiladi: DESIGN_RULES'ga "CTA rangi lock bo'yicha gold; semantik ranglar (yashil/ko'k/qizil/sariq-warning) o'z kuchida" bandini qo'shish.
