import type { Request } from "express";
import type { TenantRequestContext } from "../tenant/tenant-request-context.service";

export type AuthenticatedUser = {
  id: string;
  email?: string;
  phone?: string;
  credentialVersion?: number;
  tenantId?: string;
  membershipId?: string;
  employeeId?: string;
  branchId?: string;
  isGlobalScope?: boolean;
  roles: string[];
  permissions: string[];
};

export type AuthenticatedRequest = Request & {
  user?: AuthenticatedUser;
  tenantContext?: TenantRequestContext;
};
