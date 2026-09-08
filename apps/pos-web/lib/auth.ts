"use client";

export type MazettoRole =
  | "SUPER_ADMIN"
  | "ADMIN"
  | "BRANCH_MANAGER"
  | "CASHIER"
  | "WAITER"
  | "KITCHEN"
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
