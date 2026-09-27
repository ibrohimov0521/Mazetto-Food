import type { Request } from "express";

export type AuthenticatedUser = {
  id: string;
  email?: string;
  phone?: string;
  credentialVersion?: number;
  employeeId?: string;
  branchId?: string;
  isGlobalScope?: boolean;
  roles: string[];
  permissions: string[];
};

export type AuthenticatedRequest = Request & {
  user?: AuthenticatedUser;
};
