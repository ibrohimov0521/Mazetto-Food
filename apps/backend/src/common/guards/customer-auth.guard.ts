import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { getCustomerJwtAccessSecret } from "../../config/auth.config";
import { requireTrustedTenantId } from "../tenant/require-trusted-tenant";
import { PrismaService } from "../../prisma/prisma.service";
import type { AuthenticatedCustomer, CustomerAuthenticatedRequest } from "../types/authenticated-customer";

@Injectable()
export class CustomerAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

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

      if (typeof customer.sessionId !== "string" || !customer.sessionId) {
        throw new UnauthorizedException("Customer session is required");
      }

      const tenantId = requireTrustedTenantId(request.tenantContext);
      if (customer.tenantId && customer.tenantId !== tenantId) {
        throw new UnauthorizedException("Customer token belongs to another restaurant");
      }
      const session = await this.prisma.customerSession.findFirst({
        where: {
          id: customer.sessionId,
          customerId: customer.id,
          customer: { is: { tenantId } },
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
        select: {
          id: true,
          customer: { select: { id: true, phone: true } },
        },
      });

      if (!session) throw new UnauthorizedException("Customer session is revoked or expired");
      request.customer = {
        id: session.customer.id,
        phone: session.customer.phone,
        tenantId,
        sessionId: customer.sessionId,
        tokenUse: "customer_access",
      };
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
