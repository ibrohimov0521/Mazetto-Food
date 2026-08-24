import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { getCustomerJwtAccessSecret } from "../../config/auth.config";
import type { AuthenticatedCustomer, CustomerAuthenticatedRequest } from "../types/authenticated-customer";

@Injectable()
export class CustomerAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<CustomerAuthenticatedRequest>();
    const token = this.extractBearerToken(request);

    if (!token) {
      throw new UnauthorizedException("Missing customer bearer token");
    }

    try {
      const customer = await this.jwtService.verifyAsync<AuthenticatedCustomer>(token, {
        secret: getCustomerJwtAccessSecret(),
      });

      if (customer.tokenUse !== "customer_access") {
        throw new UnauthorizedException("Invalid customer token");
      }

      request.customer = customer;
      return true;
    } catch {
      throw new UnauthorizedException("Invalid or expired customer token");
    }
  }

  private extractBearerToken(request: CustomerAuthenticatedRequest): string | undefined {
    const authorization = request.headers.authorization;

    if (!authorization) {
      return undefined;
    }

    const [scheme, token] = authorization.split(" ");

    if (scheme !== "Bearer" || !token) {
      return undefined;
    }

    return token;
  }
}
