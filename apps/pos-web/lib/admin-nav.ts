import { hasPermission, hasRole, type AuthUser } from "./auth";

/*
 * Admin navigatsiyasi — deklarativ, permission asosida.
 *
 * Manba: docs/admin-redesign/05-rbac/RBAC_UI_MATRIX.md §5
 *
 * QOIDA (RBAC JSON developer_rules.frontend):
 * Bu yerdagi filtrlash faqat UX uchun. Haqiqiy authorization backendda.
 * Menyuni yashirish himoya emas — har bir route o'zining PermissionGuard'iga ega
 * bo'lishi shart.
 *
 * Faqat MAVJUD route'lar ro'yxatda. 3-bosqichda yangi modullar qo'shilgani sayin
 * shu yerga ham qo'shiladi (PLAN.md §3).
 */

export type AdminNavItem = {
  label: string;
  href: string;
  permission: string;
  /**
   * Route'ning `RoleGuard` ro'yxati.
   *
   * Menyu route bilan AYNAN mos bo'lishi uchun kerak: permission bor, lekin
   * RoleGuard rad etadigan holatda menyu elementi ko'rsatilmasligi shart —
   * aks holda foydalanuvchi bosib `/access-denied` ga tushadi.
   */
  roles: string[];
  /** Faol holatni aniqlashda shu prefiksdagi barcha yo'llar hisobga olinadi. */
  matchPrefix?: string;
};

export type AdminNavGroup = {
  id: string;
  label: string;
  items: AdminNavItem[];
};

export const adminNavGroups: AdminNavGroup[] = [
  {
    id: "overview",
    label: "Boshqaruv",
    items: [
      {
        label: "Dashboard",
        href: "/admin/dashboard",
        permission: "DASHBOARD_VIEW",
        roles: ["SUPER_ADMIN", "ADMIN", "BRANCH_MANAGER"],
      },
    ],
  },
  {
    id: "operations",
    label: "Operatsiya",
    items: [
      {
        label: "Buyurtmalar",
        href: "/admin/orders",
        permission: "ORDER_VIEW",
        roles: ["SUPER_ADMIN", "BRANCH_MANAGER"],
        matchPrefix: "/admin/orders",
      },
      {
        label: "Online buyurtmalar",
        href: "/admin/online-orders",
        permission: "ONLINE_ORDER_VIEW",
        roles: ["SUPER_ADMIN", "ADMIN", "BRANCH_MANAGER", "ACCOUNTANT"],
      },
      {
        label: "Stollar va zallar",
        href: "/admin/tables",
        permission: "TABLE_VIEW",
        roles: ["SUPER_ADMIN", "BRANCH_MANAGER"],
      },
      {
        label: "Oshxona monitoringi",
        href: "/admin/kitchen-monitor",
        permission: "KITCHEN_VIEW",
        roles: ["SUPER_ADMIN", "BRANCH_MANAGER"],
      },
    ],
  },
  {
    id: "catalog",
    label: "Katalog",
    items: [
      {
        label: "Mahsulotlar",
        href: "/admin/products",
        permission: "MENU_VIEW",
        roles: ["SUPER_ADMIN", "ADMIN", "BRANCH_MANAGER"],
        matchPrefix: "/admin/products",
      },
      {
        label: "Kategoriyalar",
        href: "/admin/categories",
        permission: "MENU_VIEW",
        roles: ["SUPER_ADMIN", "ADMIN", "BRANCH_MANAGER"],
      },
      {
        label: "Bosh sahifa va aksiyalar",
        href: "/admin/homepage",
        permission: "HOMEPAGE_MANAGE",
        roles: ["SUPER_ADMIN", "ADMIN", "BRANCH_MANAGER"],
      },
    ],
  },
  {
    id: "inventory",
    label: "Ombor",
    items: [
      {
        label: "Zaxira",
        href: "/admin/inventory",
        permission: "INVENTORY_VIEW",
        roles: ["SUPER_ADMIN", "BRANCH_MANAGER"],
      },
      {
        label: "Retseptlar",
        href: "/admin/recipes",
        permission: "RECIPE_MANAGE",
        roles: ["SUPER_ADMIN", "BRANCH_MANAGER"],
      },
      {
        label: "Yetkazib beruvchilar",
        href: "/admin/suppliers",
        permission: "INVENTORY_VIEW",
        roles: ["SUPER_ADMIN", "BRANCH_MANAGER"],
      },
    ],
  },
  {
    id: "people",
    label: "Odamlar",
    items: [
      {
        label: "Xodimlar",
        href: "/admin/staff",
        permission: "STAFF_VIEW",
        roles: ["SUPER_ADMIN", "ADMIN", "BRANCH_MANAGER"],
        matchPrefix: "/admin/staff",
      },
      {
        label: "Mijozlar",
        href: "/admin/customers",
        permission: "CUSTOMER_VIEW",
        roles: ["SUPER_ADMIN", "ADMIN", "BRANCH_MANAGER", "ACCOUNTANT"],
      },
      {
        label: "Rollar va permissionlar",
        href: "/admin/roles",
        permission: "ROLE_VIEW",
        roles: ["SUPER_ADMIN", "ADMIN", "BRANCH_MANAGER"],
      },
    ],
  },
  {
    id: "reports",
    label: "Hisobotlar",
    items: [
      {
        label: "Savdo hisoboti",
        href: "/admin/reports",
        permission: "REPORT_SALES_VIEW",
        roles: ["SUPER_ADMIN", "ADMIN", "BRANCH_MANAGER", "ACCOUNTANT"],
      },
    ],
  },
  {
    id: "settings",
    label: "Sozlamalar",
    items: [
      {
        label: "Filiallar",
        href: "/admin/branches",
        permission: "BRANCH_VIEW",
        roles: ["SUPER_ADMIN", "ADMIN", "BRANCH_MANAGER"],
      },
      {
        label: "Printerlar",
        href: "/admin/printers",
        permission: "RECEIPT_PRINT",
        roles: ["SUPER_ADMIN", "ADMIN", "BRANCH_MANAGER"],
      },
    ],
  },
  {
    id: "cash",
    label: "Kassa va moliya",
    items: [
      {
        label: "Smenalar",
        href: "/admin/shifts",
        // 4-bosqichda qo'shilgan permission — `SHIFT_VIEW_OWN` dan farqli,
        // butun filial smenalarini ko'rish huquqini beradi.
        permission: "SHIFT_VIEW_BRANCH",
        roles: ["SUPER_ADMIN", "BRANCH_MANAGER"],
      },
      {
        label: "Cheklar",
        href: "/admin/receipts",
        permission: "RECEIPT_VIEW",
        roles: ["SUPER_ADMIN", "BRANCH_MANAGER", "ACCOUNTANT"],
      },
      {
        label: "To'lovlar",
        href: "/admin/payments",
        permission: "PAYMENT_VIEW",
        roles: ["SUPER_ADMIN", "BRANCH_MANAGER", "ACCOUNTANT"],
      },
    ],
  },
];

/**
 * Foydalanuvchi ruxsatiga qarab menyuni filtrlaydi.
 * Bo'sh qolgan guruh butunlay olib tashlanadi.
 */
export function resolveAdminNav(user: AuthUser | null): AdminNavGroup[] {
  if (!user) {
    return [];
  }

  return adminNavGroups
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) => hasPermission(user, item.permission) && hasRole(user, item.roles),
      ),
    }))
    .filter((group) => group.items.length > 0);
}

/**
 * Joriy yo'l uchun faol menyu elementini aniqlaydi.
 * `matchPrefix` berilgan bo'lsa, ichki sahifalar ham (`/admin/staff/new`) faol hisoblanadi.
 */
export function isAdminNavItemActive(item: AdminNavItem, pathname: string): boolean {
  if (item.matchPrefix) {
    return pathname === item.matchPrefix || pathname.startsWith(`${item.matchPrefix}/`);
  }

  return pathname === item.href;
}

/**
 * Breadcrumb uchun joriy sahifa nomini topadi.
 */
export function findAdminNavItem(pathname: string): AdminNavItem | null {
  for (const group of adminNavGroups) {
    for (const item of group.items) {
      if (isAdminNavItemActive(item, pathname)) {
        return item;
      }
    }
  }

  return null;
}

/**
 * Branch-scoped rollar — bularga filial TANLAGICHI ko'rsatilmaydi
 * (RBAC JSON core_rules.branch_scoped_roles).
 */
const branchScopedRoles = ["ADMIN", "BRANCH_MANAGER", "CASHIER", "WAITER", "KITCHEN"];

/**
 * Foydalanuvchi filiallar orasida almasha oladimi.
 * Faqat global scope rollar (SUPER_ADMIN, ACCOUNTANT) uchun `true`.
 */
export function canSwitchBranch(user: AuthUser | null): boolean {
  if (!user) {
    return false;
  }

  if (user.permissions.includes("*")) {
    return true;
  }

  return !user.roles.some((role) => branchScopedRoles.includes(role));
}
