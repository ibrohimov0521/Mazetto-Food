import { hasPermission, hasRole, type AuthUser } from "./auth";

/*
 * Qobiq ichidagi route'lar uchun ruxsat matritsasi — YAGONA manba.
 *
 * MUAMMO (PHASE 6 A2). Ilgari har sahifa o'zining `RoleGuard` va
 * `PermissionGuard` ini qo'lda o'rab yurardi — 31 sahifada takrorlangan. Guard
 * `AdminLayout` dan TASHQARIDA turgani uchun u qaror qabul qilayotgan paytda
 * hech narsa sidebar'ni render qilmasdi, rad etilganda esa foydalanuvchi
 * qobig'i yo'q `/access-denied` sahifasiga uchib ketardi.
 *
 * Endi qoidalar shu yerda e'lon qilinadi va `app/(shell)/layout.tsx` ularni
 * BIR MARTA qo'llaydi. Sahifada faqat kontent qoladi.
 *
 * MUHIM: bu FAQAT UX qatlami. Haqiqiy authorization backendda —
 * `admin-nav.ts` dagi qoida o'zgarmaydi. Bu yerdagi maqsad foydalanuvchi
 * ochilmaydigan ekranni ochib, server xatosini kutmasligi.
 *
 * TARTIB MUHIM: birinchi mos kelgan qoida yutadi, shuning uchun aniqroq
 * naqshlar yuqorida turadi (`/admin/products/new` — `/admin/products/:id` dan
 * oldin, u esa `/admin/products` dan oldin).
 */

export type RouteAccessRule = {
  /** `:` bilan boshlangan segment istalgan bitta segmentga mos keladi. */
  pattern: string;
  roles: string[];
  /** Berilmasa faqat rol tekshiriladi (rolga xos landing sahifalari). */
  permission?: string;
};

const SUPER = "SUPER_ADMIN";
const ADMIN = "ADMIN";
const MANAGER = "BRANCH_MANAGER";
const ACCOUNTANT = "ACCOUNTANT";

export const routeAccessRules: RouteAccessRule[] = [
  // Rolga xos landing sahifalari — permission talab qilmaydi.
  { pattern: "/accounting", roles: [ACCOUNTANT, SUPER] },
  { pattern: "/manager/dashboard", roles: [MANAGER, SUPER] },

  // `/admin` va `/admin/menu` — redirect sahifalari. Ular o'z maqsadining
  // qoidasini oladi, aks holda qobiq ularni noma'lum route deb rad etardi.
  {
    pattern: "/admin",
    roles: [SUPER, ADMIN, MANAGER],
    permission: "DASHBOARD_VIEW",
  },
  {
    pattern: "/admin/dashboard",
    roles: [SUPER, ADMIN, MANAGER],
    permission: "DASHBOARD_VIEW",
  },
  {
    pattern: "/admin/menu",
    roles: [SUPER, ADMIN, MANAGER],
    permission: "MENU_VIEW",
  },

  {
    pattern: "/admin/orders/:id",
    roles: [SUPER, MANAGER],
    permission: "ORDER_VIEW",
  },
  {
    pattern: "/admin/orders",
    roles: [SUPER, MANAGER],
    permission: "ORDER_VIEW",
  },
  {
    pattern: "/admin/online-orders",
    roles: [SUPER, ADMIN, MANAGER, ACCOUNTANT],
    permission: "ONLINE_ORDER_VIEW",
  },
  {
    pattern: "/admin/couriers",
    roles: [SUPER, ADMIN, MANAGER],
    permission: "COURIER_MANAGE",
  },
  // Eski manzil saqlanadi, sahifa foydalanuvchini yangi filial daraxtiga olib boradi.
  {
    pattern: "/admin/tables",
    roles: [SUPER, MANAGER],
    permission: "TABLE_VIEW",
  },
  {
    pattern: "/admin/kitchen-monitor",
    roles: [SUPER, MANAGER],
    permission: "KITCHEN_VIEW",
  },

  // Mahsulot yozish sahifalari o'qishdan KUCHLIROQ permission talab qiladi,
  // shuning uchun ular ro'yxatda oldinroq turishi shart.
  {
    pattern: "/admin/products/new",
    roles: [SUPER, ADMIN, MANAGER],
    permission: "MENU_CREATE",
  },
  {
    pattern: "/admin/products/:id",
    roles: [SUPER, ADMIN, MANAGER],
    permission: "MENU_EDIT",
  },
  {
    pattern: "/admin/products",
    roles: [SUPER, ADMIN, MANAGER],
    permission: "MENU_VIEW",
  },
  {
    pattern: "/admin/categories",
    roles: [SUPER, ADMIN, MANAGER],
    permission: "MENU_VIEW",
  },
  {
    pattern: "/admin/modifiers",
    roles: [SUPER, ADMIN, MANAGER],
    permission: "MENU_VIEW",
  },
  {
    pattern: "/admin/homepage",
    roles: [SUPER, ADMIN, MANAGER],
    permission: "HOMEPAGE_MANAGE",
  },

  {
    pattern: "/admin/inventory",
    roles: [SUPER, MANAGER],
    permission: "INVENTORY_VIEW",
  },
  {
    pattern: "/admin/recipes",
    roles: [SUPER, MANAGER],
    permission: "RECIPE_MANAGE",
  },
  {
    pattern: "/admin/suppliers",
    roles: [SUPER, MANAGER],
    permission: "INVENTORY_VIEW",
  },

  {
    pattern: "/admin/staff/new",
    roles: [SUPER, ADMIN, MANAGER],
    permission: "STAFF_CREATE",
  },
  {
    pattern: "/admin/staff/:id",
    roles: [SUPER, ADMIN, MANAGER],
    permission: "STAFF_UPDATE",
  },
  {
    pattern: "/admin/staff",
    roles: [SUPER, ADMIN, MANAGER],
    permission: "STAFF_VIEW",
  },
  {
    pattern: "/admin/customers",
    roles: [SUPER, ADMIN, MANAGER, ACCOUNTANT],
    permission: "CUSTOMER_VIEW",
  },
  {
    pattern: "/admin/roles",
    roles: [SUPER, ADMIN, MANAGER],
    permission: "ROLE_VIEW",
  },

  {
    pattern: "/admin/reports",
    roles: [SUPER, ADMIN, MANAGER, ACCOUNTANT],
    permission: "REPORT_SALES_VIEW",
  },

  // Filial daraxtidagi chuqur sahifalarda jadval huquqi ham kerak.
  {
    pattern: "/admin/branches/:branchId/halls/:hallId/tables/:tableId",
    roles: [SUPER, MANAGER],
    permission: "TABLE_VIEW",
  },
  {
    pattern: "/admin/branches/:branchId/halls/:hallId",
    roles: [SUPER, MANAGER],
    permission: "TABLE_VIEW",
  },
  {
    pattern: "/admin/branches/:branchId",
    roles: [SUPER, ADMIN, MANAGER],
    permission: "BRANCH_VIEW",
  },
  {
    pattern: "/admin/branches",
    roles: [SUPER, ADMIN, MANAGER],
    permission: "BRANCH_VIEW",
  },
  {
    pattern: "/admin/printers",
    roles: [SUPER, MANAGER],
    permission: "RECEIPT_PRINT",
  },
  { pattern: "/admin/audit", roles: [SUPER], permission: "AUDIT_VIEW" },
  // Kill switch va cheklov qiymatlari — filial darajasidagi qaror emas.
  { pattern: "/admin/settings", roles: [SUPER], permission: "SETTING_MANAGE" },

  {
    pattern: "/admin/shifts",
    roles: [SUPER, MANAGER],
    permission: "SHIFT_VIEW_BRANCH",
  },
  {
    pattern: "/admin/receipts",
    roles: [SUPER, MANAGER, ACCOUNTANT],
    permission: "RECEIPT_VIEW",
  },
  {
    pattern: "/admin/payments",
    roles: [SUPER, MANAGER, ACCOUNTANT],
    permission: "PAYMENT_VIEW",
  },
  {
    pattern: "/admin/expenses",
    roles: [SUPER, ADMIN, MANAGER, ACCOUNTANT],
    permission: "REPORT_EXPENSES_VIEW",
  },
];

/** Joriy yo'l uchun qoidani topadi; noma'lum yo'l uchun `null`. */
export function resolveRouteAccess(pathname: string): RouteAccessRule | null {
  return (
    routeAccessRules.find((rule) => matchesPattern(rule.pattern, pathname)) ??
    null
  );
}

export type RouteAccessVerdict = "allowed" | "denied" | "unknown-route";

export function checkRouteAccess(
  user: AuthUser | null,
  pathname: string,
): RouteAccessVerdict {
  const rule = resolveRouteAccess(pathname);

  if (!rule) {
    // Qobiq ichida qoidasi yo'q route — bu konfiguratsiya nuqsoni, ochiq
    // qoldirmaymiz. `validate-admin-nav-rbac.ts` buni yig'ilishdan oldin
    // ushlashi kerak.
    return "unknown-route";
  }

  if (!hasRole(user, rule.roles)) {
    return "denied";
  }

  if (rule.permission && !hasPermission(user, rule.permission)) {
    return "denied";
  }

  return "allowed";
}

function matchesPattern(pattern: string, pathname: string): boolean {
  const patternSegments = pattern.split("/").filter(Boolean);
  const pathSegments = pathname.split("/").filter(Boolean);

  if (patternSegments.length !== pathSegments.length) {
    return false;
  }

  return patternSegments.every((segment, index) => {
    const actual = pathSegments[index];

    if (!actual) {
      return false;
    }

    return segment.startsWith(":") ? true : segment === actual;
  });
}
