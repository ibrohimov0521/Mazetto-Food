"use client";

export type MazettoRole =
  | "SUPER_ADMIN"
  | "ADMIN"
  | "BRANCH_MANAGER"
  | "CASHIER"
  | "WAITER"
  | "KITCHEN"
  | "COURIER"
  | "ACCOUNTANT";

export type AuthUser = {
  id: string;
  email?: string;
  phone?: string;
  employeeId?: string;
  branchId?: string;
  isGlobalScope?: boolean;
  roles: string[];
  permissions: string[];
};

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
  tokenType: "Bearer";
};

export type AuthSession = {
  user: AuthUser;
  tokens: AuthTokens;
};

/**
 * Rol nomlari — interfeysda ko'rsatish uchun.
 *
 * Backend rol kodlarini (`SUPER_ADMIN`) qaytaradi; foydalanuvchiga kod emas,
 * lavozim ko'rsatiladi.
 */
export const roleLabels: Record<MazettoRole, string> = {
  SUPER_ADMIN: "Bosh administrator",
  ADMIN: "Administrator",
  BRANCH_MANAGER: "Filial menejeri",
  CASHIER: "Kassir",
  WAITER: "Ofitsiant",
  KITCHEN: "Oshxona",
  COURIER: "Kuryer",
  ACCOUNTANT: "Buxgalter",
};

export const authStorageKey = "mazetto.auth.session";

export const roleRedirects: Record<MazettoRole, string> = {
  SUPER_ADMIN: "/admin/dashboard",
  ADMIN: "/admin/dashboard",
  BRANCH_MANAGER: "/manager/dashboard",
  CASHIER: "/shift",
  WAITER: "/waiter",
  KITCHEN: "/kitchen",
  COURIER: "/courier",
  ACCOUNTANT: "/accounting",
};

const customAdminRedirects = [
  { permission: "DASHBOARD_VIEW", href: "/admin/dashboard" },
  { permission: "ORDER_VIEW", href: "/admin/orders" },
  { permission: "ONLINE_ORDER_VIEW", href: "/admin/online-orders" },
  { permission: "MENU_VIEW", href: "/admin/products" },
  { permission: "BRANCH_VIEW", href: "/admin/branches" },
  { permission: "STAFF_VIEW", href: "/admin/staff" },
  { permission: "ROLE_VIEW", href: "/admin/roles" },
  { permission: "REPORT_SALES_VIEW", href: "/admin/reports" },
  { permission: "REPORT_PRODUCTS_VIEW", href: "/admin/reports" },
  { permission: "REPORT_EMPLOYEES_VIEW", href: "/admin/reports" },
  { permission: "REPORT_EXPENSES_VIEW", href: "/admin/reports" },
  { permission: "INVENTORY_VIEW", href: "/admin/inventory" },
  { permission: "SETTING_MANAGE", href: "/admin/settings" },
  { permission: "AUDIT_VIEW", href: "/admin/audit" },
] as const;

const adminWorkspacePermissions = customAdminRedirects.map(
  (entry) => entry.permission,
);

export function getApiBaseUrl(): string {
  if (
    typeof window !== "undefined" &&
    window.navigator.userAgent.includes("MAZETTO-Desktop/")
  ) {
    return "http://127.0.0.1:7359/api/v1";
  }

  if (
    typeof window !== "undefined" &&
    (window.location.hostname === "pos.mazettofood.uz" ||
      window.location.hostname.endsWith(".mazettofood.uz"))
  ) {
    return "/api/v1";
  }

  return process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000/api/v1";
}

export function getPrimaryRedirect(user: AuthUser): string {
  const orderedRoles: MazettoRole[] = [
    "SUPER_ADMIN",
    "ADMIN",
    "BRANCH_MANAGER",
    "CASHIER",
    "WAITER",
    "KITCHEN",
    "COURIER",
    "ACCOUNTANT",
  ];
  const role = orderedRoles.find((candidate) => user.roles.includes(candidate));

  if (role) {
    return roleRedirects[role];
  }

  if (hasPermission(user, "ADMIN_ACCESS")) {
    const adminRoute = customAdminRedirects.find((entry) =>
      hasPermission(user, entry.permission),
    );

    if (adminRoute) {
      return adminRoute.href;
    }
  }

  return getAccessiblePanels(user)[0]?.href ?? "/access-denied";
}

export function hasPermission(
  user: AuthUser | null,
  permission: string,
): boolean {
  return Boolean(
    user?.permissions.includes("*") || user?.permissions.includes(permission),
  );
}

export function hasRole(user: AuthUser | null, roles: string[]): boolean {
  return Boolean(user && roles.some((role) => user.roles.includes(role)));
}

export type WorkspacePanel = {
  title: string;
  description: string;
  href: string;
  permissions: string[];
  anyPermissions?: readonly string[];
};

const workspacePanels: WorkspacePanel[] = [
  {
    title: "Admin boshqaruv",
    description: "Filial, xodim, menyu va hisobotlarni boshqarish",
    href: "/admin/dashboard",
    permissions: ["ADMIN_ACCESS"],
    anyPermissions: adminWorkspacePermissions,
  },
  {
    title: "Kassa",
    description: "Smena ochish, POS va to'lovlarni yuritish",
    href: "/shift",
    permissions: ["SHIFT_VIEW_OWN"],
  },
  {
    title: "POS terminal",
    description: "Buyurtma yaratish va mahsulotlarni tez tanlash",
    href: "/pos",
    permissions: ["POS_USE"],
  },
  {
    title: "Oshxona",
    description: "Tayyorlash jarayoni va oshxona statuslari",
    href: "/kitchen",
    permissions: ["KITCHEN_VIEW"],
  },
  {
    title: "Ofitsiant",
    description: "Stol buyurtmalari va zal xizmatlari",
    href: "/waiter",
    permissions: ["TABLE_VIEW"],
  },
  {
    title: "Kuryer",
    description: "Yetkazish manzillari, aloqa va navigatsiya",
    href: "/courier",
    permissions: ["COURIER_DELIVERY_VIEW"],
  },
  {
    title: "Buxgalteriya",
    description: "Moliyaviy ko'rsatkichlar va hisobotlar",
    href: "/accounting",
    permissions: ["DASHBOARD_VIEW"],
  },
];

export function getAccessiblePanels(user: AuthUser | null): WorkspacePanel[] {
  if (!user) {
    return [];
  }

  const seen = new Set<string>();

  return workspacePanels.filter((panel) => {
    const allowed =
      panel.permissions.every((permission) =>
        hasPermission(user, permission),
      ) &&
      (!panel.anyPermissions ||
        panel.anyPermissions.some((permission) =>
          hasPermission(user, permission),
        ));

    if (!allowed || seen.has(panel.href)) {
      return false;
    }

    seen.add(panel.href);
    return true;
  });
}
