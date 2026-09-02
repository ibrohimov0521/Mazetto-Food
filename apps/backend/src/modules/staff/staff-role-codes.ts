export const staffRoleCodes = [
  "SUPER_ADMIN",
  "ADMIN",
  "BRANCH_MANAGER",
  "CASHIER",
  "WAITER",
  "KITCHEN",
  "ACCOUNTANT",
] as const;

export type StaffRoleCode = (typeof staffRoleCodes)[number];

export const branchScopedStaffRoles = new Set<StaffRoleCode>([
  "ADMIN",
  "BRANCH_MANAGER",
  "CASHIER",
  "WAITER",
  "KITCHEN",
]);
