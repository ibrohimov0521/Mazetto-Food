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

export const authStorageKey = "mazetto.auth.session";

export const roleRedirects: Record<MazettoRole, string> = {
  SUPER_ADMIN: "/admin/dashboard",
  ADMIN: "/admin/dashboard",
  BRANCH_MANAGER: "/manager/dashboard",
  CASHIER: "/pos",
  WAITER: "/waiter",
  KITCHEN: "/kitchen",
  ACCOUNTANT: "/accounting",
};

export function getApiBaseUrl(): string {
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

export function hasPermission(user: AuthUser | null, permission: string): boolean {
  return Boolean(user?.permissions.includes("*") || user?.permissions.includes(permission));
}

export function hasRole(user: AuthUser | null, roles: string[]): boolean {
  return Boolean(user && roles.some((role) => user.roles.includes(role)));
}
