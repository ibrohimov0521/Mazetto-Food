# MAZETTO Admin — Dizayn Tokenlari uchun Manba Ma'lumot

Yig'ilgan sana: 2026-09-06
Holat: **XOM MA'LUMOT — yakuniy token to'plami hali tasdiqlanmagan**

Bu hujjat token qarorlarini **qabul qilmaydi**. U to'rtta manbadan yig'ilgan qiymatlarni
bir joyga qo'yadi, shunda keyingi bosqichda token to'plami asosli tanlanadi.

---

## 1. To'rt manba yonma-yon

### Ranglar

| Rol | MAZETTO customer-web ✅ qulflangan | MAZETTO pos-web admin (hozir) | AdminLTE 4 | Lezato |
|---|---|---|---|---|
| Asosiy fon | `#004f55` | `#06433d`, `#083f39` | Bootstrap `$body-bg` | oq |
| Sirt / ikkilamchi | `#08686a` | `#008678`, `#0c6b60` | `$gray-*` | oq |
| Kartochka sirti | `#f5f5ef` ivory | `#fffaf0`, `#fff7e8` | `$body-bg` | oq |
| Primary | `#f5cf00` / `#ffd83d` oltin | `#ffd52e`, `#ffc83d`, `#f7c948`, `#ffe86b` | `#0d6efd` ko'k | `#FD683E` to'q sariq |
| Secondary | `#23958d` aqua | — | `$secondary` | `#624FD1` **binafsha** |
| Muvaffaqiyat | `#3f9f68` | `emerald-*` | `$success` | `#68e365` |
| Xato | — | `red-*`, `#f72b50`ga yaqin | `$danger` | `#f72b50` |
| Ogohlantirish | — | — | `$warning` | `#FFA41D` |
| Asosiy matn | `#07373a` | `text-neutral-950` (`#0a0a0a`) | `$body-color` | `#969ba0` ⚠️ |
| Yordamchi matn | `rgba(7,55,58,.72)` | `text-neutral-500`, `text-slate-500` | `$secondary-color` | — |
| Chegara | `rgba(0,79,85,.16)` | `neutral-100/200`, `#d8e5df` | `$border-color` | `rgba(0,0,0,.125)` |

**Kuzatuv 1:** customer-web yagona tokenlashtirilgan manba. Admin uni **manba** sifatida olishi kerak,
Lezato yoki AdminLTE'ni emas.

**Kuzatuv 2:** pos-web admin allaqachon **to'g'ri yo'nalishda** (teal + oltin), lekin
4 xil teal, 4 xil oltin, 2 xil ivory bilan — token emas, tasodifiy qiymatlar.

**Kuzatuv 3:** Lezato'ning `#969ba0` asosiy matn rangi oq fonda kontrast ≈ **2.6:1** —
WCAG AA (4.5:1) dan o'tmaydi. Ko'chirmang.

### Geometriya

| O'lchov | customer-web | pos-web admin | AdminLTE 4 | Lezato | **Admin uchun taklif oralig'i** |
|---|---|---|---|---|---|
| Sidebar kengligi | — | **yo'q** | 250px | 328px | 250–280px |
| Sidebar mini | — | — | ~4.6rem | 6.5rem (104px) | 64–80px |
| Header balandligi | kompakt | — | ~57px | 120px | 56–64px |
| Card radius | **24px** | 16px / 24px aralash | ~6px | 12px | 12–16px |
| Button radius | — | 16px / full | ~6px | 12px | 10–12px |
| Badge radius | — | full | ~6px | 12px | full yoki 8px |
| Bazaviy font | — | 16px | 16px | **14px** | **14px** |
| Card soyasi | `0 20px 56px .18` | — | `0 1px 3px .2` | `0 15px 30px .06` | `0 4px 16px` atrofida |
| Sidebar breakpoint | — | — | `lg` (992px) | — | `lg` (1024px) |

**Kuzatuv:** customer-web 24px radius mobil-birinchi mahsulot uchun to'g'ri, lekin
operatsion admin jadvallarida juda yumshoq ko'rinadi. Lezato'ning 12px — yaxshi o'rta yo'l.

### Z-index (AdminLTE'dan — sinovdan o'tgan, aynan ko'chirish tavsiya etiladi)

```
app-header        1034
sidebar           1038
sidebar-overlay   1037
fixed-header      1030
fixed-footer      1030
```

### Animatsiya

| Manba | Qiymat |
|---|---|
| AdminLTE 4 | `.3s ease-in-out`, `min-width`/`max-width`/`margin` bo'yicha |
| Lezato | `all .2s ease` |
| customer-web | Framer Motion sahifa o'tishlari |

**Tavsiya:** AdminLTE naqshi — `width` emas, `min/max-width` animatsiyasi (reflow kamayadi).

---

## 2. Brend qulfi — o'zgarmas qoidalar

`docs/design/MAZETTO_DESIGN_LOCK.md` va `docs/DESIGN_RULES.md` dan:

### ✅ Majburiy

| Token | Vazifasi |
|---|---|
| `brand-teal-dark` | asosiy qobiq, header, chuqur fon |
| `brand-teal` | asosiy brend sirtlari |
| `brand-teal-mid` | kartochkalar, ikkilamchi sirtlar |
| `brand-aqua` | ikkilamchi urg'u, fokus holatlari |
| `brand-yellow` | asosiy CTA, narxlar, faol harakatlar |
| `brand-ivory` | asosiy kontent sirtlari |
| `text-dark` | ivory/sariq sirtdagi matn |

### ❌ Taqiqlangan

- generic neon yashil
- ko'k gradientlar
- **binafsha-og'ir temalar** ← Lezato secondary `#624FD1` aynan shu
- sterile toza oq
- katta bo'sh yalpiz (mint) panellar
- ortiqcha chegaralar, mayda tugmalar, mayda matn
- nazoratsiz zich jadvallar

### Semantik rang qoidalari

| Rang | Faqat shu uchun |
|---|---|
| Yashil | muvaffaqiyat, tugallangan, faol/online |
| Ko'k | navigatsiya, ma'lumot, tanlangan holat |
| Qizil | **faqat** buzuvchi harakat, bekor qilingan, jiddiy xato |
| To'q sariq / sariq | **kam** — ogohlantirish, kutilmoqda |

---

## 3. Responsive tekshiruv kengliklari (majburiy)

`docs/DESIGN_RULES.md` dan — admin ham shu ro'yxatga bo'ysunadi:

```
375  390  430  768  1024  1366  1440  1920
```

Qo'shimcha operatsion kengliklar (WORK_STATUS'dagi POS QA'dan):

```
1024×600   1366×768
```

### Majburiy sifat qoidalari

- gorizontal sahifa overflow **yo'q**
- kesilgan kartochka **yo'q**
- yetib bo'lmaydigan harakat tugmasi **yo'q**
- konteynerdan chiqib ketgan matn **yo'q**
- faqat-desktop kritik funksiya **yo'q**
- jadvallar kichik ekranda **transformatsiya qilinadi** (overflow emas)

---

## 4. Token qatlami uchun taklif qilinayotgan tuzilma

> Bu **taklif**, qaror emas. Keyingi bosqichda tasdiqlanadi.

Uch qatlamli model:

```
1-qatlam  PRIMITIV      xom qiymatlar
          --mz-teal-900 … --mz-teal-100
          --mz-gold-500 … --mz-gold-100
          --mz-ivory-*, --mz-gray-*
          --mz-red-*, --mz-amber-*, --mz-green-*

2-qatlam  SEMANTIK      rol bo'yicha
          --mz-surface, --mz-surface-raised, --mz-surface-sunken
          --mz-text, --mz-text-muted, --mz-text-inverse
          --mz-border, --mz-border-strong
          --mz-primary, --mz-primary-hover, --mz-focus
          --mz-success, --mz-danger, --mz-warning, --mz-info

3-qatlam  KOMPONENT     o'lcham va geometriya
          --mz-sidebar-w, --mz-sidebar-mini-w, --mz-header-h
          --mz-radius-card, --mz-radius-control, --mz-radius-pill
          --mz-shadow-card, --mz-shadow-overlay
          --mz-z-header, --mz-z-sidebar, --mz-z-overlay
```

**Sabab:** 1-qatlam kunduz/tun rejimida o'zgaradi, 2-qatlam esa o'zgarmaydi —
komponentlar faqat 2 va 3-qatlamga murojaat qiladi. Bu customer-web'ning `--mf-*`
naqshining kengaytirilgan versiyasi.

---

## 5. Hal qilinishi kerak bo'lgan ochiq savollar

| # | Savol | Nega muhim |
|---|---|---|
| 1 | Admin fon **to'q teal** (customer-web kabi) bo'ladimi yoki **och/ivory**? | Butun palitrani belgilaydi. Operatsion panellar odatda och fonli — kun bo'yi ishlash uchun. Lekin brend qobig'i to'q teal |
| 2 | Kunduz/tun rejimi bo'ladimi? | AdminLTE `color-mode.ts` tayyor naqsh beradi; hozir `color-scheme: light` qattiq |
| 3 | Bazaviy font 14px ga tushadimi? | Zichlik uchun ha, lekin `DESIGN_RULES` "mayda matn"dan ogohlantiradi |
| 4 | Card radius 12px yoki 16px? | customer-web 24px — admin undan zichroq bo'lishi kerak |
| 5 | Shrift oilasi qaysi? | customer-web'da aniq belgilanmagan; Lezato'nikini olmaymiz |
| 6 | Sidebar to'q (teal) yoki och? | Brend qobig'i to'q teal bo'lsa, sidebar tabiiy ravishda to'q |

---

## 6. Manba fayllar

| Manba | Yo'l |
|---|---|
| customer-web tokenlari | `apps/customer-web/app/globals.css:5-34` |
| pos-web hozirgi holati | [`../03-current-state/CURRENT_ADMIN_INVENTORY.md`](../03-current-state/CURRENT_ADMIN_INVENTORY.md) |
| AdminLTE tokenlari | [`../01-adminlte4/source/scss/_variables.scss`](../01-adminlte4/source/scss/_variables.scss) |
| AdminLTE tahlili | [`../01-adminlte4/ADMINLTE4_REFERENCE.md`](../01-adminlte4/ADMINLTE4_REFERENCE.md) |
| Lezato tahlili | [`../02-lezato/LEZATO_ANALYSIS.md`](../02-lezato/LEZATO_ANALYSIS.md) |
| Brend qulfi | `docs/design/MAZETTO_DESIGN_LOCK.md` |
| Dizayn qoidalari | `docs/DESIGN_RULES.md` |
| Brend logotipi | `docs/design/references/00_mazetto-food-logo-web-1024.webp` |
