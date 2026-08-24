import type { Request } from "express";

export type AuthenticatedCustomer = {
  id: string;
  phone: string;
  tokenUse: "customer_access";
};

export type CustomerAuthenticatedRequest = Request & {
  customer?: AuthenticatedCustomer;
};
