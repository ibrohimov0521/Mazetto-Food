import { applyDecorators, UseGuards } from "@nestjs/common";
import { Public } from "./public.decorator";
import { CustomerAuthGuard } from "../guards/customer-auth.guard";

export const CUSTOMER_AUTH_KEY = "customerAuth";

export function CustomerAuth() {
  return applyDecorators(Public(), UseGuards(CustomerAuthGuard));
}
