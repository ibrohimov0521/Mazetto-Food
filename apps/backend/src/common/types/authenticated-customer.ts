import type { Request } from "express";
import type { TenantRequestContext } from "../tenant/tenant-request-context.service";

export type AuthenticatedCustomer = {
  id: string;
  phone: string;
  tenantId: string;
  sessionId: string;
  tokenUse: "customer_access";
};

export type CustomerAuthenticatedRequest = Request & {
  customer?: AuthenticatedCustomer;
  tenantContext?: TenantRequestContext;
};
