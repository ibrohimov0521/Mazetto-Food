import assert from "node:assert/strict";
import test from "node:test";
import { ForbiddenException, UnauthorizedException } from "@nestjs/common";
import { CustomerAuthGuard } from "../src/common/guards/customer-auth.guard";
import { requireTrustedTenantId } from "../src/common/tenant/require-trusted-tenant";
import { CustomerAuthService } from "../src/modules/customers/customer-auth.service";

test("public customer flows require a registered trusted tenant host", () => {
  assert.throws(() => requireTrustedTenantId(), ForbiddenException);
  assert.throws(
    () => requireTrustedTenantId({ kind: "UNREGISTERED", hostname: "unknown.test" }),
    ForbiddenException,
  );
  assert.equal(
    requireTrustedTenantId({
      kind: "TRUSTED",
      hostname: "restaurant.test",
      tenantId: "tenant-a",
    }),
    "tenant-a",
  );
});

test("customer OTP challenge queries and writes are tenant-scoped", async () => {
  let customerWhere: unknown;
  let countWhere: unknown;
  let expireWhere: unknown;
  let challengeData: Record<string, unknown> | undefined;
  const settings = {
    getInt: async (key: string) =>
      key === "customer_code_ttl_minutes"
        ? 10
        : key === "customer_code_request_window_seconds"
          ? 60
          : 5,
  };
  const transaction = {
    customer: {
      findUnique: async (args: { where: unknown }) => {
        customerWhere = args.where;
        return null;
      },
    },
    customerVerificationChallenge: {
      count: async (args: { where: unknown }) => {
        countWhere = args.where;
        return 0;
      },
      updateMany: async (args: { where: unknown }) => {
        expireWhere = args.where;
        return { count: 0 };
      },
      create: async (args: { data: Record<string, unknown> }) => {
        challengeData = args.data;
        return {
          id: "challenge-a",
          phone: args.data.phone,
          expiresAt: args.data.expiresAt,
          createdAt: new Date(),
        };
      },
    },
  };
  const service = new CustomerAuthService(
    { $transaction: (callback: (tx: typeof transaction) => unknown) => callback(transaction) } as never,
    {} as never,
    { deliverVerificationCode: async () => ({ status: "SENT" }) } as never,
    settings as never,
    {} as never,
  );

  await service.requestCode({ phone: "+998901234567" } as never, "tenant-a");

  assert.deepEqual(customerWhere, {
    tenantId_phone: { tenantId: "tenant-a", phone: "+998901234567" },
  });
  assert.equal((countWhere as { tenantId: string }).tenantId, "tenant-a");
  assert.equal((countWhere as { phone: string }).phone, "+998901234567");
  assert.ok((countWhere as { createdAt: { gte: Date } }).createdAt.gte instanceof Date);
  assert.equal((expireWhere as { tenantId: string }).tenantId, "tenant-a");
  assert.equal((expireWhere as { phone: string }).phone, "+998901234567");
  assert.equal((expireWhere as { consumedAt: null }).consumedAt, null);
  assert.ok((expireWhere as { expiresAt: { gt: Date } }).expiresAt.gt instanceof Date);
  assert.equal(challengeData?.tenantId, "tenant-a");
});

test("customer access token cannot cross the trusted restaurant domain", async () => {
  let sessionQueries = 0;
  const guard = new CustomerAuthGuard(
    {
      verifyAsync: async () => ({
        id: "customer-a",
        phone: "+998901234567",
        tenantId: "tenant-b",
        sessionId: "session-a",
        tokenUse: "customer_access",
      }),
    } as never,
    {
      customerSession: {
        findFirst: async () => {
          sessionQueries += 1;
          return null;
        },
      },
    } as never,
  );
  const request = {
    headers: { authorization: "Bearer signed-token" },
    tenantContext: {
      kind: "TRUSTED",
      hostname: "restaurant-a.test",
      tenantId: "tenant-a",
    },
  };
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
  } as never;

  await assert.rejects(guard.canActivate(context), UnauthorizedException);
  assert.equal(sessionQueries, 0);
});

test("legacy customer token is rebound from its database session to the trusted tenant", async () => {
  const guard = new CustomerAuthGuard(
    {
      verifyAsync: async () => ({
        id: "customer-a",
        phone: "stale-phone",
        sessionId: "session-a",
        tokenUse: "customer_access",
      }),
    } as never,
    {
      customerSession: {
        findFirst: async (args: { where: unknown }) => {
          const where = args.where as {
            id: string;
            customerId: string;
            customer: { is: { tenantId: string } };
            revokedAt: null;
            expiresAt: { gt: Date };
          };
          assert.equal(where.id, "session-a");
          assert.equal(where.customerId, "customer-a");
          assert.equal(where.customer.is.tenantId, "tenant-a");
          assert.equal(where.revokedAt, null);
          assert.ok(where.expiresAt.gt instanceof Date);
          return {
            id: "session-a",
            customer: { id: "customer-a", phone: "+998901234567" },
          };
        },
      },
    } as never,
  );
  const request = {
    headers: { authorization: "Bearer legacy-token" },
    tenantContext: {
      kind: "TRUSTED",
      hostname: "restaurant-a.test",
      tenantId: "tenant-a",
    },
  };
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
  } as never;

  assert.equal(await guard.canActivate(context), true);
  assert.deepEqual((request as { customer?: unknown }).customer, {
    id: "customer-a",
    phone: "+998901234567",
    tenantId: "tenant-a",
    sessionId: "session-a",
    tokenUse: "customer_access",
  });
});
