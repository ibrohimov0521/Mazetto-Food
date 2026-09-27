import assert from "node:assert/strict";
import test from "node:test";
import { CustomerAuthService } from "../src/modules/customers/customer-auth.service";

test("customer logout revokes the session and disconnects its realtime sockets", async () => {
  const calls: string[] = [];
  const service = new CustomerAuthService(
    {
      customerSession: {
        updateMany: async () => ({ count: 1 }),
      },
    } as never,
    {
      verifyAsync: async () => ({
        id: "customer-1",
        phone: "+998901234567",
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

  const result = await service.logout({ refreshToken: "refresh-token" });

  assert.deepEqual(result, { revoked: true });
  assert.deepEqual(calls, ["session-1"]);
});
