# MAZETTO FOOD — Admin Panel Redizayn: Ma'lumot To'plami

Yig'ilgan sana: 2026-09-06
Holat: **MA'LUMOT YIG'ILDI · REJA TUZILDI** → [`PLAN.md`](./PLAN.md)

Bu papka admin panel redizayni uchun yig'ilgan barcha manba materiallarni va
`malumot/admin_roles/mazetto_admin_roles_rbac_plan.json` asosida tuzilgan rejani saqlaydi.

**Kod hali yozilmagan.** Reja: [`PLAN.md`](./PLAN.md) — 4 bosqich, tasdiqlangan 3 ta qaror bilan.

## Papka tuzilishi

```text
docs/admin-redesign/
  README.md                              ← shu fayl (indeks + xulosalar)
  PLAN.md                                ★ REDIZAYN REJASI (4 bosqich)
  01-adminlte4/
    ADMINLTE4_REFERENCE.md               AdminLTE 4 tahlili: stack, token, layout, komponent
    source/                              AdminLTE 4.9.1 manba (MIT, vendored)
      scss/                              46 SCSS fayl — dizayn tokenlari va komponentlar
      ts/                                12 TS fayl — React'da qayta yozilishi kerak bo'lgan xatti-harakatlar
      LICENSE                            MIT litsenziya matni
  02-lezato/
    LEZATO_ANALYSIS.md                   Lezato tahlili: palitra, o'lchamlar, IA, litsenziya chegarasi
  03-current-state/
    CURRENT_ADMIN_INVENTORY.md           Mavjud 17 admin route + komponentlar + bo'shliqlar
    BACKEND_API_INVENTORY.md             115 backend endpoint (avtomatik generatsiya)
  04-design-system/
    MAZETTO_ADMIN_TOKENS.md              Brend tokenlari: customer-web vs POS-web vs AdminLTE vs Lezato
  05-rbac/
    RBAC_UI_MATRIX.md                    Rol → permission → menyu → route matritsasi
```

## Eng muhim beshta xulosa

### 1. Lezato'ning ma'lumot arxitekturasi bizga mos emas

Lezato sidebar'ida 77 ta element bor, lekin ularning **faqat ~10 tasi** restoran biznesiga tegishli
(Dashboard, Orders, Order Details, Customers, Analytics, Review, Shop, Product Grid/List/Details, Invoice).
Qolgani — generic Bootstrap demo sahifalari: Accordion, Carousel, Popover, Sweet Alert, Error 400/403/404/500/503,
5 xil chart kutubxonasi demosi va h.k.

**Xulosa:** Lezato'dan **vizual uslub** oling, **tuzilma** emas. MAZETTO'ning domain modeli (51 Prisma modeli,
115 endpoint, 48 permission) Lezato'nikidan ancha chuqur. Sidebar tuzilishini RBAC JSON'dan quring, Lezato'dan emas.

### 2. Lezato palitrasi brend qulfiga zid

| | Lezato | MAZETTO (qulflangan) |
|---|---|---|
| Primary | `#FD683E` to'q sariq | `#004f55` chuqur teal |
| Secondary | `#624FD1` binafsha | `#ffd83d` oltin sariq |
| Sarlavha shrifti | MuseoModerno | — |

`docs/DESIGN_RULES.md` da to'g'ridan-to'g'ri yozilgan: *"Avoid ... purple-heavy themes"*.
`docs/design/MAZETTO_DESIGN_LOCK.md` esa teal/oltin/ivory palitrani **qulflangan** deb belgilagan.

**Xulosa:** Lezato'ning rang palitrasini olmang. Faqat geometriya (radius, bo'shliq, zichlik) va layout mantig'ini oling.

### 3. AdminLTE 4 React emas, Lezato'ning Bootstrap versiyasi jQuery'da

- AdminLTE **4.9.1**, Bootstrap **^5.3.8** peer dependency, MIT, `admin-lte@4`
- AdminLTE 4 jQuery'ni **butunlay tashlagan**, o'z TS komponentlariga o'tgan (12 ta fayl)
- Lezato'ning Bootstrap 5 versiyasi esa **jQuery** ga tayanadi

**Xulosa:** Lezato widget'larini AdminLTE 4 ga ko'chirib bo'lmaydi. Bu ikki kod bazasi bir-biriga tushmaydi.

### 4. AdminLTE 4 ning haqiqiy qiymati — SCSS tokenlari va layout o'lchamlari

MIT litsenziya tufayli `source/scss/` dagi hamma narsani bemalol o'qish, o'lchamlarni ko'chirish mumkin.
Eng qimmatlisi `_variables.scss` (250px sidebar, z-index qatlamlari, card shadow formulasi),
`_small-box.scss` va `_info-box.scss` (KPI kartochka anatomiyasi).

`source/ts/` dagi 12 fayl esa React'da **qayta yozilishi kerak** bo'lgan xatti-harakatlar ro'yxati:
`push-menu` (sidebar toggle), `treeview` (ichma-ich menyu), `layout`, `color-mode` (kunduz/tun),
`card-widget` (collapse/remove), `fullscreen`, `sidebar-search`, `accessibility`.

### 5. Backend'da UI'siz qolgan 11 ta tayyor modul bor

Admin UI backend'ning atigi **14 endpointini** ishlatadi (115 dan ~12%).
To'liq ishlaydigan, lekin ekrani yo'q modullar:

```
buyurtmalar          online buyurtmalar    mijozlar
bosh sahifa/aksiyalar smenalar/kassa       cheklar
oshxona monitoringi  yetkazib beruvchilar  to'lovlar
rollar/permissionlar foydalanuvchilar
```

**Xulosa:** Eng katta va eng arzon g'alaba shu yerda — backend allaqachon yozilgan, faqat ekran kerak.

## Manba havolalari

- AdminLTE: https://adminlte.io — [npm `admin-lte@4`](https://www.npmjs.com/package/admin-lte), MIT
- Lezato demo: https://lezato.dexignzone.com/xhtml/index.html
- Lezato ThemeForest (Bootstrap 5): https://themeforest.net/item/lezato-restaurant-food-admin-dashboard-template-bootstrap-5/33097754 — Regular $25 / Extended $1000
- Lezato ThemeForest (React/Vite): https://themeforest.net/item/lezato-react-vite-restaurant-food-admin-dashboard-template/56054147

## Litsenziya holati

| Manba | Litsenziya | Bizda nima qilinadi |
|---|---|---|
| AdminLTE 4.9.1 | **MIT** | `source/` ga vendored qilindi, kod o'qish/ko'chirish erkin |
| Lezato | **Tijoriy (ThemeForest)** | Kod ham, asset ham **ko'chirilmadi**. Faqat ochiq demo'dan o'lchov va palitra **o'qildi** va hujjatga yozildi |

Bu papkada Lezato'ning bironta ham HTML/CSS/JS qatori yoki rasmi saqlanmagan.
