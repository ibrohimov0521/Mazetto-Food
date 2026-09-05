# Lezato — Vizual Referens Tahlili

Yig'ilgan sana: 2026-09-06
Manba: https://lezato.dexignzone.com/xhtml/index.html (ochiq demo)
Muallif: DexignZone (ThemeForest)

## ⚠️ Litsenziya chegarasi — birinchi o'qing

Lezato **tijoriy** shablon. Bu papkada uning bironta ham kod qatori, CSS fayli yoki rasmi
**saqlanmagan**. Faqat ochiq demo'dan **o'lchov va rang qiymatlari o'qilib**, quyida hujjatlashtirilgan.

| Harakat | Ruxsat |
|---|---|
| Demo'ga qarash, screenshot olish, o'lchov o'qish | ✅ Bepul, litsenziya kerak emas |
| Layout g'oyasi, ekran mantig'i, feature ro'yxatini olish | ✅ Erkin |
| HTML/CSS/SCSS/JS kodini ko'chirish | ❌ Regular License ($25) kerak |
| Rasm, illyustratsiya, ikonka, shrift ko'chirish | ❌ Ba'zilari sotib olingandan keyin ham faqat demo uchun |
| Piksel-ba-piksel klon | ❌ |
| Keyin SaaS qilib boshqalarga sotish | ❌ Extended License ($1000) kerak |

**Narx:** Regular $25 (bitta yakuniy mahsulot, foydalanuvchilardan pul olinmasa) /
Extended $1000 (sotish uchun). Ikkalasi 6 oy support bilan.

**Amaliy tavsiya:** Sotib olmang. Sizga faqat vizual referens kerak — bu bepul.
Sotib olsangiz ham, uning Bootstrap versiyasi **jQuery** ga tayanadi va AdminLTE 4
(jQuery'siz) yoki Next.js/React ga tushmaydi. Ya'ni $25 to'lab olgan kodni ishlata olmaysiz.

**Istisno:** Lezato'ning **React (Vite) versiyasi** ham bor (React 18 + Redux).
Agar rostdan tayyor kod sotib olmoqchi bo'lsangiz — AdminLTE 4 emas, o'sha mantiqiyroq.
Lekin u React 18 + Redux, sizda React 19 va Redux yo'q; port qilish baribir ish talab qiladi.

---

## 1. Rang palitrasi (demo CSS `:root` dan o'qildi)

```
--primary:        #FD683E    to'q sariq / marjon
--primary-hover:  #fc410c
--primary-dark:   #a02502
--secondary:      #624FD1    binafsha
--title:          #000

--bs-success:     #68e365    yorqin yashil
--bs-info:        #b48dd3    och binafsha
--bs-warning:     #FFA41D    to'q sariq-sariq
--bs-danger:      #f72b50    qizil-pushti
--bs-red:         #EE3232
--bs-green:       #297F00
--bs-cyan:        #3065D0
```

### ❌ Bu palitra MAZETTO'ga to'g'ridan-to'g'ri MOS EMAS

| | Lezato | MAZETTO qulflangan brend |
|---|---|---|
| Primary | `#FD683E` to'q sariq | `#004f55` chuqur teal |
| Secondary | `#624FD1` **binafsha** | `#ffd83d` oltin sariq |
| Sirt | oq / och kulrang | `#f5f5ef` ivory |

Ikki hujjat buni to'g'ridan-to'g'ri taqiqlaydi:

- `docs/DESIGN_RULES.md`: *"Avoid ... purple-heavy themes"*
- `docs/design/MAZETTO_DESIGN_LOCK.md`: teal / oltin / ivory palitrani **qulflangan** deb belgilagan

**Xulosa:** Lezato'dan rang olmang. Faqat **geometriya va zichlik** oling.

## 2. Tipografiya

```
--font-family-base:  Roboto, sans-serif
--font-family-title: MuseoModerno, cursive
body font-size:      0.875rem (14px)
body line-height:    1.5
body color:          #969ba0   (och kulrang — asosiy matn uchun juda past kontrast)
```

**Diqqat:** `#969ba0` asosiy matn rangi sifatida WCAG AA dan o'tmaydi
(oq fonda kontrast ≈ 2.6:1, kerak 4.5:1). Buni **ko'chirmang** — bu Lezato'ning zaif joyi.
MAZETTO'da matn rangi `#07373a` (kontrast ≈ 12:1) — ancha yaxshi.

## 3. Layout o'lchamlari (demo CSS dan o'qildi)

| Element | Qiymat |
|---|---|
| `.deznav` (sidebar) kengligi | **20.5rem = 328px** |
| Sidebar variantlari | 18rem, 17rem, 6.5rem (mini), 6.25rem, 11.25rem |
| `.header` balandligi | **7.5rem = 120px** |
| `.nav-header` (logo bloki) | 120px × 328px, `box-shadow: 0 15px 30px rgba(0,0,0,.06)` |
| `.content-body` margin-left | **20.563rem** (sidebar + 1px) |
| `.card` radius | **0.75rem = 12px** |
| `.card` border | `1px solid rgba(0,0,0,.125)` |
| `.card-header` padding | `0.5rem 1rem` |
| `.btn` radius | **0.75rem** |
| `.btn` padding | `0.375rem 0.75rem` |
| `.btn` font | `0.875rem` / weight 400 |
| `.badge` radius | **0.75rem** |
| `.badge` padding | `0.35em 0.65em` |
| `.badge` font | `0.75em` / weight **700** |

### Nima olishga arziydi

✅ **12px universal radius** — card, button, badge hammasi bir xil radius.
Bu izchillik yaxshi ta'sir beradi va MAZETTO'ning 24px customer radius'i bilan
16px admin radius orasida yaxshi o'rta yo'l.

✅ **14px bazaviy font** — operatsion admin uchun 16px dan yaxshiroq, ko'proq ma'lumot sig'adi.

✅ **Badge weight 700 + kichik font** — status chiplari uchun aniq va o'qiladigan pattern.

### Nima olmang

❌ **328px sidebar** — juda keng. 1366×768 laptopda ekranning 24% ini yeydi.
AdminLTE'ning 250px yoki 260–280px oralig'i operatsion panel uchun to'g'riroq.

❌ **120px header** — juda baland. Ikki qatorli header operatsion ishda joy isrof qiladi.
56–64px yetarli.

❌ **`#969ba0` matn rangi** — kontrast yetarli emas.

## 4. Ma'lumot arxitekturasi (sidebar, 77 element)

Demo sidebar'idan olingan to'liq ro'yxat:

**Restoran biznesiga tegishli (~10 ta):**
```
Dashboard (Light / Dark)
Orders → Order Details
Customers
Analytics
Review
Shop → Product Grid / Product List / Product Details / Order / Checkout / Invoice
```

**Generic shablon boilerplate (~67 ta):**
```
Apps      → Profile, Post Details, Email (Compose/Inbox/Read), Calendar
Charts    → Flot, Morris, Chartjs, Chartist, Sparkline, Peity
Bootstrap → Accordion, Alert, Badge, Button, Modal, Button Group, List Group,
            Cards, Carousel, Dropdown, Popover, Progressbar, Tab, Typography,
            Pagination, Grid
Plugins   → Select 2, Nestedable, Noui Slider, Sweet Alert, Toastr, Jqv Map, Light Gallery
Forms     → Form Elements, Wizard, CkEditor, Pickers, Form Validate
Table     → Datatable
Pages     → Login, Register, Error 400/403/404/500/503, Lock Screen, Empty Page
```

### ❌ Bu IA ni ko'chirmang

Lezato — bu **food skin kiygan generic Bootstrap shabloni**, restoran biznes tizimi emas.
Uning "restoran" qismi atigi 10 ta ekran.

MAZETTO'da esa allaqachon:
- 51 Prisma modeli
- 115 backend endpoint
- 48 permission
- 7 rol, ikki xil scope (GLOBAL / BRANCH)
- smena/kassa, oshxona ticket, retsept, ombor, Telegram buyurtma, filial mavjudligi

**Xulosa:** Sidebar tuzilishini `malumot/admin_roles/mazetto_admin_roles_rbac_plan.json` dan quring.
Lezato'dan faqat *"Orders ostida Order Details bo'lishi kerak"* darajasidagi mayda patternlarni oling.

## 5. Yakuniy xulosa: Lezato'dan aniq nima olinadi

| Element | Olinadimi | Qiymat |
|---|---|---|
| 12px universal radius (card/btn/badge) | ✅ | Izchil, zamonaviy |
| 14px bazaviy font | ✅ | Operatsion zichlik uchun to'g'ri |
| Badge: kichik font + weight 700 | ✅ | Status chiplari uchun aniq |
| Yumshoq katta soya (`0 15px 30px .06`) | 🟡 | Kartochkalar uchun ha, lekin biroz kamaytiring |
| Card header padding `.5rem 1rem` | ✅ | Zich va toza |
| Rang palitrasi | ❌ | Brend qulfiga zid |
| Shriftlar (Roboto/MuseoModerno) | ❌ | MAZETTO o'z tipografiyasiga ega bo'lishi kerak |
| 328px sidebar | ❌ | Juda keng |
| 120px header | ❌ | Juda baland |
| Matn rangi `#969ba0` | ❌ | Kontrast yetarli emas |
| Sidebar IA (77 element) | ❌ | Generic boilerplate |
| Kod / asset | ❌ | Litsenziya |

**Bir jumlada:** Lezato'dan **geometriya va zichlik hissi** olinadi; rang, shrift, tuzilma va kod olinmaydi.
