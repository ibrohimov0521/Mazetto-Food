# AdminLTE 4 — Texnik Referens

Yig'ilgan sana: 2026-09-06
Manba: `npm pack admin-lte@4` → **4.9.1**
Vendored: `./source/` (scss + ts + LICENSE)

## 1. Stack fakti

| Xususiyat | Qiymat |
|---|---|
| Versiya | 4.9.1 |
| Litsenziya | **MIT** (ColorlibHQ, 2014–2023) |
| Peer dependency | `bootstrap ^5.3.8` |
| jQuery | **Yo'q** — v4 da butunlay olib tashlangan |
| Manba tili | SCSS + TypeScript |
| Rasmiy React versiyasi | **Yo'q** — faqat HTML/CSS/JS |
| npm | `npm install admin-lte@4` |
| Paket hajmi | 4.3 MB (157 fayl), `src/scss` + `src/ts` esa atigi 375 KB |

**Muhim:** AdminLTE 4 — bu Bootstrap 5.3 ustidagi **tema qatlami**. U mustaqil ishlamaydi;
Bootstrap CSS'i albatta kerak. Bizning `pos-web` esa Tailwind CSS 4 da — ikki tizim bir sahifada
`reboot` vs `preflight` darajasida to'qnashadi.

## 2. Dizayn tokenlari (`source/scss/_variables.scss` dan)

### Layout o'lchamlari

| Token | Qiymat | Izoh |
|---|---|---|
| `$lte-sidebar-width` | **250px** | Asosiy sidebar kengligi |
| `$lte-sidebar-breakpoint` | `lg` (992px) | Shundan pastda sidebar overlay bo'ladi |
| `$lte-sidebar-padding-x` | `.5rem` | |
| `$lte-sidebar-padding-y` | `.5rem` | |
| `$lte-sidebar-mini-width` | `(nav-link-padding-x + .5rem + .8rem) × 2` | Yig'ilgan holat (~4.6rem) |
| `$lte-app-header-height` | `nav-link-height + navbar-padding-y × 2` | ≈ **57px** standart, compact ≈ 44px |
| `$lte-content-padding-x` | `.5rem` | Kontent gorizontal padding |
| `$lte-app-footer-padding` | `1rem` | |
| `$lte-search-field-width` | `14rem` → fokusda `18rem` | Navbar qidiruv |

### Z-index qatlamlari — **muhim, to'g'ridan-to'g'ri ko'chiring**

```
$lte-zindex-app-header       = $zindex-fixed + 4   (1034)
$lte-zindex-sidebar          = $zindex-fixed + 8   (1038)
$lte-zindex-sidebar-overlay  = sidebar - 1         (1037)
$lte-zindex-fixed-header     = $zindex-fixed       (1030)
$lte-zindex-fixed-footer     = $zindex-fixed       (1030)
```

Bu tartib sinovdan o'tgan: sidebar header'dan ustun, overlay ikkalasining orasida.
Tailwind'ga ko'chirganda aynan shu nisbatni saqlang.

### Animatsiya

```
$lte-transition-speed = .3s
$lte-transition-fn    = ease-in-out
```

Sidebar `min-width`, `max-width`, `margin-left`, `margin-right` bo'yicha animatsiya qiladi
(`width` emas — bu layout reflow'ni kamaytiradi).

### Soya va tipografiya

| Token | Qiymat |
|---|---|
| `$lte-card-shadow` | `0 0 1px rgba(body-color, .125), 0 1px 3px rgba(body-color, .2)` |
| `$lte-card-title-font-size` | `1.1rem` |
| `$lte-card-title-font-weight` | `normal` (400) |
| `$lte-user-block-username-font-size` | `1rem` / weight `semibold` |
| `$lte-user-block-description-font-size` | `.8125rem` |
| `$lte-progress-bar-border-radius` | `1px` |

**Diqqat:** AdminLTE kartochka soyasi juda yumshoq (2 qatlamli, 3px blur).
Lezato'da esa `0 0.9375rem 1.875rem rgba(0,0,0,.06)` — 30px blur, ancha "havoli".
MAZETTO customer-web esa `0 20px 56px rgba(0,79,85,.18)` ishlatadi — eng dramatik.

## 3. Komponent anatomiyasi

### `.small-box` — KPI kartochkasi (`_small-box.scss`)

```
.small-box
  ├── .inner            padding: 10px
  │     ├── h3          font-size: 2.2rem, weight 700, margin-bottom 10px, nowrap
  │     └── p           font-size: 1rem
  │           └── small display:block, margin-top 5px, font-size .9rem
  ├── .small-box-icon   absolute top:15px right:15px, 70×70px, font-size 70px,
  │                     color rgba(black,.15), hover'da scale(1.1)
  └── .small-box-footer padding 3px 0, center, bg rgba(black,.07)
```

Responsive qoida: `col-lg-2`/`col-lg-3` ichida `h3` **1.6rem** ga tushadi, `xl` da yana `2.2rem` ga qaytadi.
`sm` dan pastda ikonka **butunlay yashiriladi** va matn markazga tekislanadi.

### `.info-box` — ikkilamchi KPI (`_info-box.scss`)

```
.info-box                 min-height: 80px, padding .5rem, display flex
  ├── .info-box-icon      70px kenglik, font-size 1.875rem, markazlashtirilgan
  └── .info-box-content   flex:1, padding 0 10px, line-height 1.8
        ├── .info-box-text    ellipsis + nowrap
        ├── .info-box-number  weight bold, margin-top .25rem
        └── .progress         height 2px
```

Responsive qoida: `col-*-2`/`col-*-3` ichida `.progress-description`
`md` da yashirinadi → `lg` da `.75rem` → `xl` da `1rem`.

### `.card` (`_cards.scss`)

Bootstrap `.card` ustiga: `$lte-card-shadow` qo'shiladi, header padding `card-spacer-y × 1` × `card-spacer-x`,
`.card-tools` tugmalari `--bs-btn-padding-x: .5rem; --bs-btn-padding-y: .25rem` bilan kichraytiriladi.

## 4. `source/ts/` — React'da qayta yozilishi kerak bo'lgan xatti-harakatlar

AdminLTE'ning JS'i DOM'ni to'g'ridan-to'g'ri o'zgartiradi (`classList.add/remove`, `setAttribute`).
React virtual DOM bilan bu to'qnashadi. Quyidagilar React hook/komponent sifatida qayta yoziladi:

| Fayl | Vazifasi | React'dagi ekvivalent |
|---|---|---|
| `push-menu.ts` | Sidebar ochish/yopish/collapse, `lg` dan pastda overlay | `useSidebar()` — `useState` + `useMediaQuery` |
| `treeview.ts` | Ichma-ich menyu akkordeoni | Boshqariladigan `openMenus` state |
| `layout.ts` | Layout sinflarini `<body>` ga qo'yish | `AdminLayout` komponentining `className` |
| `color-mode.ts` | Kunduz/tun rejimi, `localStorage` | `useTheme()` + `data-theme` atributi |
| `card-widget.ts` | Kartochkani yig'ish/o'chirish | `<Card collapsible>` propi |
| `fullscreen.ts` | Fullscreen API | `useFullscreen()` |
| `sidebar-search.ts` | Sidebar ichida menyu qidirish | Nazorat qilinadigan `input` + filtr |
| `direct-chat.ts` | Chat paneli | **Kerak emas** |
| `accessibility.ts` | ARIA/fokus boshqaruvi | Radix/Headless UI yoki qo'lda |
| `base-component.ts` | Ichki bazaviy klass | Kerak emas |
| `adminlte.ts` | Barchasini ro'yxatdan o'tkazish | Kerak emas |

**Xulosa:** AdminLTE 4 ni React'da ishlatish = uning JS'ining ~70% ini qayta yozish.
Shuning uchun uni **runtime dependency emas, dizayn referensi** sifatida olish arzonroq.

## 5. AdminLTE 4 ning kuchli va zaif tomonlari

### ✅ Olishga arziydi

- **Z-index qatlamlari** — sinovdan o'tgan, aynan ko'chiring
- **Sidebar o'lchamlari** (250px / mini ~4.6rem) va `lg` breakpoint mantig'i
- **KPI kartochka anatomiyasi** (`small-box`, `info-box`) — ayniqsa responsive font-size qoidalari
- **Transition strategiyasi** — `width` emas, `min/max-width` bo'yicha animatsiya
- **Compact mode** g'oyasi (`_compact-mode.scss`) — zich operatsion ekranlar uchun juda mos
- `ACCESSIBILITY-COMPLIANCE.md` — a11y checklist tayyor

### ❌ Olmang

- **Bootstrap bog'liqligi** — Tailwind 4 bilan bir sahifada yashamaydi
- **Default palitra** — Bootstrap ko'k (`#0d6efd`), MAZETTO teal emas
- **jQuery-era layout patternlari** — `direct-chat`, `ribbon`, `timeline` bizga kerak emas
- **`_docs.scss`** (19.5 KB) — faqat AdminLTE hujjatlari uchun
- **`adminlte-colors-v3.scss`** — v3 orqaga moslik qatlami, keraksiz

## 6. AdminLTE vs Lezato vs MAZETTO — o'lchov solishtiruvi

| O'lchov | AdminLTE 4 | Lezato | MAZETTO customer-web |
|---|---|---|---|
| Sidebar kengligi | **250px** | **328px** (20.5rem) | — (mobil bottom-nav) |
| Header balandligi | **~57px** | **120px** (7.5rem) | kompakt |
| Card radius | `$border-radius` ≈ **6px** | **12px** (0.75rem) | **24px** (`--mf-radius`) |
| Button radius | ≈ **6px** | **12px** | — |
| Bazaviy font | `1rem` (16px) | **0.875rem** (14px) | — |
| Card soyasi | `0 1px 3px` (juda yumshoq) | `0 15px 30px` (havoli) | `0 20px 56px` (dramatik) |
| Zichlik | **Zich** (operatsion) | **Havodor** (marketing) | O'rtacha |

**Tavsiya qilinadigan MAZETTO admin o'rtachasi:**
sidebar 250–280px, header 56–64px, card radius 12–16px, bazaviy font 14px,
soya AdminLTE va Lezato orasida (`0 4px 16px` atrofida) — operatsion ekran uchun
Lezato juda havodor, AdminLTE juda quruq.
