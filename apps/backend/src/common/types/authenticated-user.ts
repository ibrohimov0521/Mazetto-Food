import type { Request } from "express";

export type AuthenticatedUser = {
  id: string;
  email?: string;
  phone?: string;
  employeeId?: string;
  branchId?: string;
  isGlobalScope?: boolean;
  roles: string[];
  permissions: string[];
};

export type AuthenticatedRequest = Request & {
  user?: AuthenticatedUser;
};
