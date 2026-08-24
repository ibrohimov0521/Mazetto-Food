import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { AuthenticatedCustomer, CustomerAuthenticatedRequest } from "../types/authenticated-customer";

export const CurrentCustomer = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedCustomer | undefined => {
    const request = context.switchToHttp().getRequest<CustomerAuthenticatedRequest>();
    return request.customer;
  },
);
