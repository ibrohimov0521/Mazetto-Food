# Mavjud Admin Panel — To'liq Inventarizatsiya

Yig'ilgan sana: 2026-09-06
Manba: `apps/pos-web/` @ `a72a73d`

## 1. Stack

| Xususiyat | Qiymat |
|---|---|
| Framework | **Next.js 16.3.2** (App Router) |
| React | **19.2.8** |
| CSS | **Tailwind CSS 4.1.18** (`@import "tailwindcss"`) |
| Realtime | `socket.io-client` 4.8.1 |
| Bootstrap | **Yo'q** |
| jQuery | **Yo'q** |
| Port | 3001 |
| UI kutubxona | Yo'q (`@mazetto/ui` deklaratsiya qilingan, lekin **import qilinmagan**) |

## 2. Admin route'lari — 17 ta fayl

| Route | Fayl qatori | Permission | Rollar | Turi |
|---|---|---|---|---|
| `/admin` | 7 | — | — | → `/admin/dashboard` redirect |
| `/admin/dashboard` | 18 | `ADMIN_ACCESS` | SUPER_ADMIN, ADMIN, BRANCH_MANAGER | Wrapper |
| `/admin/menu` | 7 | — | — | → `/admin/products` redirect |
| `/admin/products` | 18 | `MENU_VIEW` | SUPER_ADMIN, ADMIN, BRANCH_MANAGER | Wrapper |
| `/admin/products/new` | 18 | `MENU_CREATE` | SUPER_ADMIN, ADMIN, BRANCH_MANAGER | Wrapper |
| `/admin/products/[id]` | 21 | `MENU_EDIT` | SUPER_ADMIN, ADMIN, BRANCH_MANAGER | Wrapper |
| `/admin/categories` | 18 | `MENU_VIEW` | SUPER_ADMIN, ADMIN, BRANCH_MANAGER | Wrapper |
| `/admin/staff` | 18 | `STAFF_VIEW` | SUPER_ADMIN, ADMIN, BRANCH_MANAGER | Wrapper |
| `/admin/staff/new` | 18 | `STAFF_CREATE` | SUPER_ADMIN, ADMIN, BRANCH_MANAGER | Wrapper |
| `/admin/staff/[id]` | 21 | `STAFF_UPDATE` | SUPER_ADMIN, ADMIN, BRANCH_MANAGER | Wrapper |
| `/admin/branches` | 18 | `BRANCH_VIEW` | SUPER_ADMIN, ADMIN, BRANCH_MANAGER | Wrapper |
| `/admin/reports` | 18 | `REPORT_SALES_VIEW` | + **ACCOUNTANT** | Wrapper |
| `/admin/inventory` | **142** | `INVENTORY_VIEW` | SUPER_ADMIN, BRANCH_MANAGER | **O'z mantig'i** |
| `/admin/recipes` | **167** | `RECIPE_MANAGE` | SUPER_ADMIN, BRANCH_MANAGER | **O'z mantig'i** |
| `/admin/tables` | **174** | `TABLE_VIEW` | SUPER_ADMIN, BRANCH_MANAGER | **O'z mantig'i** |
| `/admin/printers` | **124** | `RECEIPT_PRINT` | SUPER_ADMIN, ADMIN, BRANCH_MANAGER | **O'z mantig'i** |

**Naqsh:** 13 ta route — 7–21 qatorli yupqa wrapper, butun mantiq 3 ta katta komponentda.
4 ta route (inventory, recipes, tables, printers) esa mantiqni o'z ichida saqlaydi — **izchil emas**.

## 3. Admin komponentlari

| Fayl | Qator | Vazifasi | Iste'mol qiladigan API |
|---|---|---|---|
| `components/admin/admin-catalog.tsx` | **579** | Mahsulot + kategoriya CRUD | `/menu/products`, `/menu/categories`, `/branches` |
| `components/admin/admin-reports.tsx` | **563** | Savdo hisobotlari | `/reports/sales`, `/branches` |
| `components/admin/admin-staff.tsx` | **492** | Xodim CRUD + rol | `/staff`, `/roles`, `/branches`, `/staff/me/password` |
| `components/erp/erp-ui.tsx` | **64** | Umumiy primitivlar | — |
| `components/auth/auth-provider.tsx` | 132 | Sessiya, login, logout | `/auth/login`, `/auth/logout`, `/cash-register/shift` |
| `components/auth/auth-shell.tsx` | 115 | Sahifa qobig'i + orqaga tugmasi | — |
| `components/auth/permission-guard.tsx` | 38 | Permission tekshiruvi (UX) | — |
| `components/auth/role-guard.tsx` | 36 | Rol tekshiruvi (UX) | — |

### `erp-ui.tsx` — mavjud dizayn tizimining hammasi (64 qator)

```
ErpPageShell    sahifa konteyner
PrimaryButton   asosiy tugma
EmptyState      bo'sh holat
TextInput       matn maydoni
```

**Bu yagona umumiy UI qatlami.** Card, Table, Modal, Badge, Select, Tabs, Toast,
Pagination, Skeleton — hech biri yo'q. Har bir sahifa ularni o'zi qayta yozadi.

## 4. Vizual holat — token tizimi yo'q

### Ranglar: Tailwind palitrasi + qattiq yozilgan hex aralashmasi

Eng ko'p ishlatiladigan Tailwind klasslari:

```
82×  bg-white          36×  text-neutral-950   30×  border-white
25×  text-slate-500    25×  border-neutral-100 22×  bg-emerald-50
20×  text-white        19×  text-neutral-500   18×  border-neutral-200
16×  text-emerald-700  14×  border-emerald-500 13×  text-neutral-700
```

Qattiq yozilgan hex qiymatlar (12 xil):

```
15×  #083f39   to'q teal        13×  #ffd52e   oltin
13×  #06433d   to'q teal         8×  #ffc83d   oltin
12×  #008678   o'rta teal        3×  #ffe86b   och oltin
 5×  #0c6b60   o'rta teal        3×  #f7c948   oltin
 9×  #fffaf0   ivory             6×  #d8e5df   och kulrang-yashil
 4×  #fff7e8   ivory             5×  #10233a   to'q ko'k-kulrang
```

**Muammo:** to'rt xil teal, to'rt xil oltin, ikki xil ivory — hech biri o'zgaruvchi orqali emas.
Bir joyda rangni o'zgartirish uchun 12 xil qiymatni qo'lda qidirish kerak.

### Radius: uch xil, tizimsiz

```
76×  rounded-2xl   (16px)
49×  rounded-3xl   (24px)
31×  rounded-full
 1×  rounded-xl    (12px)
```

## 5. Brend siljishi (brand drift)

`apps/customer-web` va `apps/pos-web` bir brendni ikki xil ifodalaydi:

| Rol | customer-web (`--mf-*` token) | pos-web admin (qattiq hex) |
|---|---|---|
| Asosiy fon | `#004f55` | `#06433d`, `#083f39` |
| O'rta teal | `#08686a` | `#008678`, `#0c6b60` |
| Oltin | `#ffd83d` | `#ffd52e`, `#ffc83d`, `#f7c948`, `#ffe86b` |
| Ivory | `#f5f5ef` | `#fffaf0`, `#fff7e8` |
| Matn | `#07373a` | `text-neutral-950` (`#0a0a0a`) |
| Radius | `24px` (`--mf-radius`) | `16px` / `24px` aralash |

**Xulosa:** customer-web tokenlashtirilgan (`--mf-*` CSS o'zgaruvchilari), pos-web esa yo'q.
Redizaynning birinchi vazifasi — pos-web admin uchun shu darajadagi token qatlamini yaratish.

## 6. Aniqlangan texnik bo'shliqlar

| # | Bo'shliq | Ta'sir |
|---|---|---|
| 1 | **Token tizimi yo'q** | 12 qattiq hex, 3 xil radius, tema o'zgartirib bo'lmaydi |
| 2 | **Umumiy UI qatlami 64 qator** | Card/Table/Modal/Badge har sahifada qayta yoziladi |
| 3 | **Izchil bo'lmagan naqsh** | 13 sahifa wrapper, 4 sahifa o'z mantig'i bilan |
| 4 | **Token yangilash yo'q** | `refreshToken` saqlanadi, lekin ishlatilmaydi → 15 daqiqada login'ga chiqarib yuboradi |
| 5 | **`JSON.parse` try/catch'siz** | `auth-provider.tsx:41`, `lib/api.ts:13` — buzilgan localStorage oq ekran beradi |
| 6 | **Sidebar navigatsiya yo'q** | Har sahifada "Orqaga" tugmasi; global menyu umuman yo'q |
| 7 | **Kunduz/tun rejimi yo'q** | `globals.css` da `color-scheme: light` qattiq belgilangan |
| 8 | **Skeleton/loading holati yo'q** | Yuklanish paytida bo'sh ekran |
| 9 | **Toast/notification yo'q** | Xatolar `throw` bilan yuqoriga chiqadi |
| 10 | **Jadval komponenti yo'q** | Saralash, filtr, pagination har joyda qo'lda |

## 7. Nima ishlaydi va saqlanishi kerak

Bular production'da tekshirilgan — redizaynda **buzilmasligi** kerak:

- ✅ `PermissionGuard` + `RoleGuard` naqshi (UX qatlami sifatida to'g'ri qurilgan)
- ✅ Rol bo'yicha login redirect (`getPrimaryRedirect` + ochiq smena tekshiruvi)
- ✅ `/admin/reports` — presetlar, filtrlar, Asia/Tashkent kun chegaralari (yaqinda hardened)
- ✅ `apiFetch` envelope naqshi (`{success, data, error}`)
- ✅ Admin "Orqaga" tugmasi mantig'i (`getSafeReferrer` — origin tekshiruvi bilan)
- ✅ Barcha 17 route RBAC bilan himoyalangan
- ✅ `access-denied` sahifasi

## 8. Backend API qamrovi

To'liq ro'yxat: [`BACKEND_API_INVENTORY.md`](./BACKEND_API_INVENTORY.md) — **115 endpoint**.

Admin UI iste'mol qiladigan endpointlar: **14 ta**.

```
/branches                 /menu/categories      /recipes        /tables
/halls                    /menu/products        /reports/sales  /kitchen
/inventory/movements      /printers             /roles
/inventory/stock          /staff                /staff/me/password
```

Ya'ni **115 dan 14 tasi** — backend qamrovining ~12%.

Ya'ni backend'ning katta qismi admin panelda ochilmagan. Batafsil tahlil
[`../05-rbac/RBAC_UI_MATRIX.md`](../05-rbac/RBAC_UI_MATRIX.md) da.
