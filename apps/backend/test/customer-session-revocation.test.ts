import assert from "node:assert/strict";
import test from "node:test";
import type { JwtService } from "@nestjs/jwt";
import type { Socket } from "socket.io";
import { KitchenGateway } from "../src/modules/kitchen/kitchen.gateway";
import type { PrismaService } from "../src/prisma/prisma.service";

function makeCustomerJwt(): JwtService {
  return {
    verifyAsync: async () => ({
      id: "customer-1",
      phone: "+998901234567",
      sessionId: "session-1",
      tokenUse: "customer_access",
      exp: Math.floor(Date.now() / 1000) + 60,
    }),
  } as unknown as JwtService;
}

function makeCustomerSocket(disconnected: () => void, joined: string[]): Socket {
  return {
    handshake: { auth: { token: "customer-token", tokenType: "customer" }, headers: {} },
    data: {},
    join: async (room: string) => { joined.push(room); },
    disconnect: disconnected,
  } as unknown as Socket;
}

test("customer websocket revalidates its session after joining the revoke room", async () => {
  let reads = 0;
  let disconnected = false;
  const joined: string[] = [];
  const prisma = {
    restaurantTenant: { findMany: async () => [{ id: "tenant-a" }] },
    customerSession: {
      findFirst: async () => (++reads === 1 ? { id: "session-1" } : null),
    },
  } as unknown as PrismaService;
  const gateway = new KitchenGateway(makeCustomerJwt(), prisma);

  await gateway.handleConnection(makeCustomerSocket(() => { disconnected = true; }, joined));

  assert.equal(disconnected, true);
  assert.ok(joined.includes("customer-session:session-1"));
  assert.ok(!joined.includes("customer:customer-1"));
});

test("logout disconnects websockets in the revoked customer-session room", () => {
  const gateway = new KitchenGateway({} as JwtService, {} as PrismaService);
  const calls: Array<{ room: string; close: boolean }> = [];
  Object.defineProperty(gateway, "server", {
    value: {
      in: (room: string) => ({
        disconnectSockets: (close: boolean) => calls.push({ room, close }),
      }),
    },
  });

  gateway.disconnectCustomerSession("session-1");

  assert.deepEqual(calls, [{ room: "customer-session:session-1", close: true }]);
});
