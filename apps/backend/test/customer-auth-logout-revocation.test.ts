import assert from "node:assert/strict";
import test from "node:test";
import { CustomerAuthService } from "../src/modules/customers/customer-auth.service";

test("customer logout revokes only the current tenant session and disconnects its realtime sockets", async () => {
  const calls: string[] = [];
  let query: unknown;
  const service = new CustomerAuthService(
    {
      customerSession: {
        updateMany: async (args: { where: unknown }) => {
          query = args.where;
          return { count: 1 };
        },
      },
    } as never,
    {
      verifyAsync: async () => ({
        id: "customer-1",
        phone: "+998901234567",
        tenantId: "tenant-a",
        sessionId: "session-1",
        tokenUse: "customer_refresh",
      }),
    } as never,
    {} as never,
    {} as never,
    {
      disconnectCustomerSession: (sessionId: string) => calls.push(sessionId),
    } as never,
  );

  const result = await service.logout({ refreshToken: "refresh-token" }, "tenant-a");

  assert.deepEqual(result, { revoked: true });
  assert.deepEqual(query, {
    id: "session-1",
    customerId: "customer-1",
    customer: { is: { tenantId: "tenant-a" } },
    revokedAt: null,
  });
  assert.deepEqual(calls, ["session-1"]);
});

test("customer logout on a different tenant does not revoke or disconnect the session", async () => {
  const calls: string[] = [];
  const service = new CustomerAuthService(
    { customerSession: { updateMany: async () => ({ count: 0 }) } } as never,
    {
      verifyAsync: async () => ({
        id: "customer-1",
        phone: "+998901234567",
        tenantId: "tenant-a",
        sessionId: "session-1",
        tokenUse: "customer_refresh",
      }),
    } as never,
    {} as never,
    {} as never,
    { disconnectCustomerSession: (id: string) => calls.push(id) } as never,
  );

  assert.deepEqual(
    await service.logout({ refreshToken: "refresh-token" }, "tenant-b"),
    { revoked: false },
  );
  assert.deepEqual(calls, []);
});
