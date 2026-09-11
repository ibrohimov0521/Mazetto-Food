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

export function getApiBaseUrl(): string {
  if (
    typeof window !== "undefined" &&
    (window.location.hostname === "pos.mazettofood.uz" ||
      window.location.hostname.endsWith(".mazettofood.uz"))
  ) {
    return "/api/v1";
  }

  return process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000/api/v1";
}

export function getPrimaryRedirect(roles: string[]): string {
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
  const role = orderedRoles.find((candidate) => roles.includes(candidate));

  return role ? roleRedirects[role] : "/access-denied";
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
  permission: string;
  roles: string[];
};

const workspacePanels: WorkspacePanel[] = [
  {
    title: "Admin boshqaruv",
    description: "Filial, xodim, menyu va hisobotlarni boshqarish",
    href: "/admin/dashboard",
    permission: "DASHBOARD_VIEW",
    roles: ["SUPER_ADMIN", "ADMIN", "BRANCH_MANAGER"],
  },
  {
    title: "Kassa",
    description: "Smena ochish, POS va to'lovlarni yuritish",
    href: "/shift",
    permission: "SHIFT_VIEW_OWN",
    roles: ["SUPER_ADMIN", "BRANCH_MANAGER", "CASHIER", "KITCHEN", "COURIER"],
  },
  {
    title: "POS terminal",
    description: "Buyurtma yaratish va mahsulotlarni tez tanlash",
    href: "/pos",
    permission: "POS_USE",
    roles: ["SUPER_ADMIN", "BRANCH_MANAGER", "CASHIER"],
  },
  {
    title: "Oshxona",
    description: "Tayyorlash jarayoni va oshxona statuslari",
    href: "/kitchen",
    permission: "KITCHEN_VIEW",
    roles: ["SUPER_ADMIN", "ADMIN", "BRANCH_MANAGER", "KITCHEN"],
  },
  {
    title: "Ofitsiant",
    description: "Stol buyurtmalari va zal xizmatlari",
    href: "/waiter",
    permission: "TABLE_VIEW",
    roles: ["SUPER_ADMIN", "BRANCH_MANAGER", "WAITER"],
  },
  {
    title: "Kuryer",
    description: "Yetkazish manzillari, aloqa va navigatsiya",
    href: "/courier",
    permission: "COURIER_DELIVERY_VIEW",
    roles: ["SUPER_ADMIN", "ADMIN", "BRANCH_MANAGER", "COURIER"],
  },
  {
    title: "Buxgalteriya",
    description: "Moliyaviy ko'rsatkichlar va hisobotlar",
    href: "/accounting",
    permission: "DASHBOARD_VIEW",
    roles: ["SUPER_ADMIN", "ACCOUNTANT"],
  },
];

export function getAccessiblePanels(user: AuthUser | null): WorkspacePanel[] {
  if (!user) {
    return [];
  }

  const seen = new Set<string>();

  return workspacePanels.filter((panel) => {
    const allowed =
      hasRole(user, panel.roles) && hasPermission(user, panel.permission);

    if (!allowed || seen.has(panel.href)) {
      return false;
    }

    seen.add(panel.href);
    return true;
  });
}
