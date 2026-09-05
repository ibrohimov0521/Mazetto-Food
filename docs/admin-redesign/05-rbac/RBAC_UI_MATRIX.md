# RBAC → UI Matritsasi

Yig'ilgan sana: 2026-09-06
Manbalar:
- `malumot/admin_roles/mazetto_admin_roles_rbac_plan.json` (7 rol, 48 permission)
- [`../03-current-state/BACKEND_API_INVENTORY.md`](../03-current-state/BACKEND_API_INVENTORY.md) (115 endpoint)
- [`../03-current-state/CURRENT_ADMIN_INVENTORY.md`](../03-current-state/CURRENT_ADMIN_INVENTORY.md) (17 route)

---

## 1. Rollar qisqacha

| Rol | Scope | Filial majburiy | Permission soni | Default route |
|---|---|---|---|---|
| `SUPER_ADMIN` | **GLOBAL** | ❌ | `*` (hammasi) | `/admin` |
| `BRANCH_MANAGER` | BRANCH | ✅ | 46 | `/manager/dashboard` |
| `ADMIN` | BRANCH | ✅ | 24 | `/admin` |
| `ACCOUNTANT` | **GLOBAL** | ❌ | 9 | `/accounting` |
| `CASHIER` | BRANCH | ✅ | 12 | `/shift` → `/pos` |
| `WAITER` | BRANCH | ✅ | 6 | `/waiter` |
| `KITCHEN` | BRANCH | ✅ | 3 | `/kitchen` |

**Ierarxiya (tavsiya qilingan, hali tasdiqlanmagan):**
`SUPER_ADMIN` 100 > `BRANCH_MANAGER` 80 > `ADMIN` 70 > `ACCOUNTANT` 60 > `CASHIER` 40 > `WAITER`/`KITCHEN` 30

⚠️ **Ochiq masala:** `ADMIN` va `BRANCH_MANAGER` ikkalasida ham `STAFF_ROLE_ASSIGN` bor,
lekin `BRANCH_MANAGER` ierarxiyada yuqoriroq. JSON'da bu `policy_decisions_to_finalize` da
hal qilinmagan deb belgilangan.

---

## 2. Asosiy matritsa — modul × holat

**Ustunlar:** BE = backend tayyormi · UI = admin UI bormi · Sidebar = menyuda ko'rinadimi

| # | Modul | Permission | Rollar | BE | UI | Sidebar |
|---|---|---|---|---|---|---|
| **A GURUH — bor, redizayn kerak** |
| 1 | Dashboard | `DASHBOARD_VIEW` / `ADMIN_ACCESS` | SA, A, BM, AC | ✅ | ✅ | ❌ |
| 2 | Mahsulotlar | `MENU_VIEW/CREATE/EDIT/DELETE` | SA, A, BM | ✅ | ✅ | ❌ |
| 3 | Kategoriyalar | `MENU_VIEW/CREATE/EDIT/DELETE` | SA, A, BM | ✅ | ✅ | ❌ |
| 4 | Xodimlar | `STAFF_*` (6 ta) | SA, A, BM | ✅ | ✅ | ❌ |
| 5 | Filiallar | `BRANCH_VIEW/CREATE/EDIT` | SA, A, BM | ✅ | ✅ | ❌ |
| 6 | Hisobotlar | `REPORT_*` (4 ta) | SA, A, BM, **AC** | ✅ | ✅ | ❌ |
| 7 | Stollar / Zallar | `TABLE_VIEW/CREATE/EDIT` | SA, BM | ✅ | ✅ | ❌ |
| 8 | Ombor | `INVENTORY_VIEW/CREATE/EDIT` | SA, BM, AC(ko'rish) | ✅ | 🟡 minimal | ❌ |
| 9 | Retseptlar | `RECIPE_MANAGE` | SA, BM | ✅ | 🟡 minimal | ❌ |
| 10 | Printerlar | `RECEIPT_PRINT` | SA, A, BM | ✅ | 🟡 minimal | ❌ |
| **B GURUH — backend tayyor, UI YO'Q ⬅️ eng katta bo'shliq** |
| 11 | **Buyurtmalar** | `ORDER_VIEW/UPDATE` | SA, BM | ✅ | ❌ | ❌ |
| 12 | **Online buyurtmalar** | `ONLINE_ORDER_VIEW` | SA, A, BM, AC | ✅ | ❌ | ❌ |
| 13 | **Mijozlar** | `CUSTOMER_VIEW` | SA, A, BM, AC | ✅ | ❌ | ❌ |
| 14 | **Bosh sahifa / Aksiyalar** | `HOMEPAGE_MANAGE` | SA, A, BM | ✅ | ❌ | ❌ |
| 15 | **Smenalar / Kassa** | `SHIFT_*`, `CASH_TRANSACTION_CREATE` | SA, BM | ✅ | ❌ | ❌ |
| 16 | **Cheklar** | `RECEIPT_VIEW` | SA, BM, AC | ✅ | ❌ | ❌ |
| 17 | **Oshxona monitoringi** | `KITCHEN_VIEW` | SA, BM | ✅ | ❌ | ❌ |
| 18 | **Yetkazib beruvchilar** | `INVENTORY_*` | SA, BM | ✅ | ❌ | ❌ |
| 19 | **To'lovlar** | `PAYMENT_CREATE` | SA, BM | ✅ | ❌ | ❌ |
| 20 | **Rollar / Permissionlar (ko'rish)** | `ROLE_VIEW`, `PERMISSION_VIEW` | SA, A, BM | ✅ | ❌ | ❌ |
| 21 | **Foydalanuvchilar** | `USER_VIEW` | SA, A, BM | ✅ | ❌ | ❌ |
| **C GURUH — backend ham yo'q (kelajak)** |
| 22 | Audit log | `AUDIT_VIEW` 🆕 | SA | 🟡 model bor | ❌ | ❌ |
| 23 | Rol/permission boshqaruvi | `ROLE_MANAGE`, `PERMISSION_MANAGE` 🆕 | SA | ❌ | ❌ | ❌ |
| 24 | Moliya (P&L, xarajat) | `FINANCE_*` 🆕 (7 ta) | SA, AC | ❌ | ❌ | ❌ |
| 25 | Katalog 2-bosqich | `VARIANT_MANAGE`, `BUNDLE_MANAGE` 🆕 (5 ta) | SA, A, BM | 🟡 qisman | ❌ | ❌ |
| 26 | Printer/print job | `PRINTER_*`, `PRINT_JOB_*` 🆕 (4 ta) | SA | 🟡 qisman | ❌ | ❌ |
| 27 | To'lov provayderlari | `PAYMENT_PROVIDER_MANAGE` 🆕 | SA | ❌ | ❌ | ❌ |
| 28 | Ombor kengaytmasi | `WAREHOUSE_*`, `STOCK_*` 🆕 (7 ta) | SA, BM | 🟡 qisman | ❌ | ❌ |

**Qisqartmalar:** SA = SUPER_ADMIN · A = ADMIN · BM = BRANCH_MANAGER · AC = ACCOUNTANT

### Raqamlar

| Ko'rsatkich | Qiymat |
|---|---|
| Backend endpointlari | **115** |
| Admin UI iste'mol qiladigan endpointlar | **~14** |
| To'liq UI'li modullar | **7** |
| Minimal UI'li modullar | **3** |
| Backend tayyor, UI yo'q modullar | **11** ⬅️ |
| Sidebar navigatsiyasi | **umuman yo'q** |
| Mavjud permissionlar | 48 |
| Rejalashtirilgan yangi permissionlar | 🆕 **30** |

---

## 3. Rol bo'yicha ko'rinishi kerak bo'lgan menyu

> Bu **RBAC JSON'dan hisoblangan**, dizayn qarori emas.
> Har bir element foydalanuvchining permission'i bo'lsagina ko'rinadi.

### SUPER_ADMIN (`*` — hammasi, global scope)

Barcha 28 modul. Yagona rol: filial tanlagichni ko'radi.

### BRANCH_MANAGER (46 permission, o'z filiali)

```
Dashboard
Buyurtmalar        (barcha, online, stollar)
Katalog            (mahsulot, kategoriya)
Oshxona            (monitoring)
Kassa              (smenalar, cheklar, to'lovlar)
Ombor              (zaxira, retsept, yetkazib beruvchi)
Xodimlar           (CRUD + rol biriktirish)
Mijozlar
Bosh sahifa        (hero, aksiyalar)
Filial             (sozlama, ish vaqti)
Hisobotlar         (4 tur — o'z filiali)
```

### ADMIN (24 permission, o'z filiali)

```
Dashboard
Katalog            (mahsulot, kategoriya)
Xodimlar           (CRUD + rol biriktirish)
Mijozlar
Online buyurtmalar
Bosh sahifa        (hero, aksiyalar)
Filial             (sozlama)
Hisobotlar         (4 tur — o'z filiali)
```

❌ ADMIN'da **yo'q**: POS, oshxona, smena, stol, ombor, retsept, buyurtma o'zgartirish.

### ACCOUNTANT (9 permission, **global**)

```
Dashboard          (read-only)
Hisobotlar         (savdo, mahsulot, xodim, xarajat — barcha filiallar)
Cheklar            (read-only)
Ombor              (read-only)
Mijozlar           (read-only)
Online buyurtmalar (read-only)
```

⚠️ Butunlay **read-only** rol. `FINANCE_*` yozish permissionlari hali yaratilmagan.

### CASHIER / WAITER / KITCHEN

Admin panelga **kirmaydi**. `ADMIN_ACCESS` permission'i yo'q → `/access-denied`.
Ularning ekranlari: `/pos`, `/shift`, `/waiter`, `/kitchen`.

---

## 4. Xavfsizlik shartnomasi — UI qurishda majburiy

RBAC JSON `developer_rules` va `staff_security_contract` dan:

### Frontend qoidalari

| # | Qoida |
|---|---|
| 1 | `RoleGuard`/`PermissionGuard` **faqat UX**; haqiqiy authorization backendda |
| 2 | Navigatsiya permission asosida ko'rsatiladi (yo'q bo'lsa — menyu elementi ham yo'q) |
| 3 | **Branch-scoped rolga boshqa filial tanlagichi ko'rsatilmaydi** ⬅️ shell dizaynida boshidan |
| 4 | 403 va `access-denied` holatlari aniq bo'lishi kerak |

### Backend qoidalari (UI ularga tayanadi)

| # | Qoida |
|---|---|
| 1 | Frontend yuborgan `role`/`branchId`/`cashierId`/`shiftId`/`price`/`total` ga **ishonilmaydi** |
| 2 | Sensitive o'zgarishlar audit log yozadi |
| 3 | Permission qo'shilsa — seed va validator ham yangilanadi |

### Sessiya bekor qilish hodisalari

```
Rol o'zgarishi        → sessiyalar bekor
Bloklash              → sessiyalar bekor
Parol reset           → sessiyalar bekor
O'z parolini o'zgartirish → sessiyalar bekor
```

⚠️ **UI ta'siri:** Bu hodisalardan keyin foydalanuvchi login'ga chiqariladi.
Admin panel buni to'g'ri qayta ishlashi kerak (hozir `apiFetch` 401 ni umumiy xato deb ko'rsatadi).

### SUPER_ADMIN himoyasi

```
SUPER_ADMIN accountini faqat SUPER_ADMIN boshqaradi
SUPER_ADMIN parolini faqat SUPER_ADMIN reset qiladi
Oxirgi aktiv SUPER_ADMIN deactivate yoki demote qilinmaydi
```

⚠️ **UI ta'siri:** Xodimlar ro'yxatida bu holatlarda tugmalar `disabled` bo'lishi va
sababni tushuntirishi kerak — server xatosini kutmasdan.

### Mavjud audit hodisalari (9 ta)

```
STAFF_CREATED              STAFF_UPDATED           STAFF_ROLE_CHANGED
STAFF_ACTIVATED            STAFF_BLOCKED           STAFF_PASSWORD_RESET
STAFF_OWN_PASSWORD_CHANGED
STAFF_BOOTSTRAP_SUPER_ADMIN_CREATED
STAFF_BOOTSTRAP_SUPER_ADMIN_RESET
```

`AuditLog` Prisma modeli mavjud, lekin **ko'rish uchun UI yo'q** (22-modul).

---

## 5. Sidebar tuzilishi uchun xom material

> Bu **taklif**, tasdiqlanmagan. Guruhlash RBAC JSON'dagi modul mantig'idan olingan.

```
📊 Boshqaruv
   Dashboard                    DASHBOARD_VIEW

🧾 Operatsiya
   Buyurtmalar                  ORDER_VIEW
   Online buyurtmalar           ONLINE_ORDER_VIEW
   Oshxona                      KITCHEN_VIEW
   Stollar / Zallar             TABLE_VIEW

🍔 Katalog
   Mahsulotlar                  MENU_VIEW
   Kategoriyalar                MENU_VIEW
   Bosh sahifa / Aksiyalar      HOMEPAGE_MANAGE

💰 Kassa va Moliya
   Smenalar                     SHIFT_VIEW_OWN
   Cheklar                      RECEIPT_VIEW
   To'lovlar                    PAYMENT_CREATE

📦 Ombor
   Zaxira                       INVENTORY_VIEW
   Retseptlar                   RECIPE_MANAGE
   Yetkazib beruvchilar         INVENTORY_VIEW

👥 Odamlar
   Xodimlar                     STAFF_VIEW
   Mijozlar                     CUSTOMER_VIEW
   Rollar / Permissionlar       ROLE_VIEW

📈 Hisobotlar
   Savdo                        REPORT_SALES_VIEW
   Mahsulotlar                  REPORT_PRODUCTS_VIEW
   Xodimlar                     REPORT_EMPLOYEES_VIEW
   Xarajatlar                   REPORT_EXPENSES_VIEW

⚙️ Sozlamalar
   Filiallar                    BRANCH_VIEW
   Printerlar                   RECEIPT_PRINT
   Audit log                    AUDIT_VIEW 🆕
```

**8 guruh, 24 element.** Taqqoslash uchun: Lezato'da 77 element bor, lekin ularning
faqat ~10 tasi restoran biznesiga tegishli.

---

## 6. Keyingi bosqich uchun ochiq savollar

| # | Savol | JSON'dagi holat |
|---|---|---|
| 1 | `ADMIN` va `BRANCH_MANAGER` ierarxiyasi aniqlanadimi? | `ROLE_HIERARCHY` — hal qilinmagan |
| 2 | Filial buxgalteri kerakmi (`BRANCH_ACCOUNTANT`)? | `ACCOUNTANT_SCOPE` — hal qilinmagan |
| 3 | `BRANCH_MANAGER` real ishda POS/oshxona operatori bo'ladimi? | `MANAGER_OPERATIONS` — hal qilinmagan |
| 4 | `MENU_DELETE` hard delete'mi yoki arxivlashmi? | `MENU_DELETE` — arxivlash tavsiya qilingan |
| 5 | 30 ta yangi permission qaysi bosqichda qo'shiladi? | `future_permission_plan` — 6 guruh |
| 6 | `cashier_shift_controls_ux` navbati o'zgaradimi? | `CURRENT_NEXT_TASK` deb belgilangan |
