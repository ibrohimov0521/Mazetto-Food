export type StaffRoleCode =
  | "SUPER_ADMIN"
  | "ADMIN"
  | "BRANCH_MANAGER"
  | "CASHIER"
  | "WAITER"
  | "KITCHEN"
  | "COURIER"
  | "ACCOUNTANT";

export const branchScopedStaffRoles = new Set<StaffRoleCode>([
  "ADMIN",
  "BRANCH_MANAGER",
  "CASHIER",
  "WAITER",
  "KITCHEN",
  "COURIER",
]);
