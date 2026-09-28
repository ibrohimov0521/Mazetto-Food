import { KitchenGateway } from "../src/modules/kitchen/kitchen.gateway";
import type { JwtService } from "@nestjs/jwt";
import type { TenantRequestContextService } from "../src/common/tenant/tenant-request-context.service";
import type { AuthenticatedUser } from "../src/common/types/authenticated-user";
import type { TenantMembershipAuthService } from "../src/modules/auth/tenant-membership-auth.service";
import type { PrismaService } from "../src/prisma/prisma.service";

export type TestTenantContext = {
  resolve: (
    rawHost?: string,
  ) => Promise<
    | { kind: "UNREGISTERED"; hostname?: string }
    | { kind: "BLOCKED"; hostname: string }
    | { kind: "TRUSTED"; hostname: string; tenantId: string }
  >;
};

export type TestMembershipAuth = {
  resolve: (
    userId: string,
    tenantId: string,
    membershipId?: string,
  ) => Promise<AuthenticatedUser | null>;
};

export function createKitchenGatewayForTest(
  jwt: JwtService,
  prisma: PrismaService,
  tenantContext: TestTenantContext = {
    resolve: async () => ({
      kind: "TRUSTED",
      hostname: "mazetto-a.test",
      tenantId: "tenant-a",
    }),
  },
  membershipAuth: TestMembershipAuth = { resolve: async () => null },
) {
  return new KitchenGateway(
    jwt,
    prisma,
    tenantContext as unknown as TenantRequestContextService,
    membershipAuth as unknown as TenantMembershipAuthService,
  );
}
