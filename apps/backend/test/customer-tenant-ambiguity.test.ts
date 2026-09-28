import assert from "node:assert/strict";
import test from "node:test";
import { UnauthorizedException } from "@nestjs/common";
import type { JwtService } from "@nestjs/jwt";
import type { Socket } from "socket.io";
import { CustomerAuthGuard } from "../src/common/guards/customer-auth.guard";
import { createKitchenGatewayForTest } from "./kitchen-gateway-test-factory";
import type { PrismaService } from "../src/prisma/prisma.service";

const activeTenants = [{ id: "tenant-a" }, { id: "tenant-b" }];
const jwt = {
  verifyAsync: async () => ({
    id: "customer-a",
    phone: "+998901234567",
    sessionId: "session-a",
    tokenUse: "customer_access",
    exp: Math.floor(Date.now() / 1000) + 60,
  }),
} as unknown as JwtService;

test("customer REST and WebSocket access both fail closed with two active tenants", async () => {
  let sessionReads = 0;
  const prisma = {
    restaurantTenant: { findMany: async () => activeTenants },
    customerSession: {
      findFirst: async () => {
        sessionReads += 1;
        return { id: "session-a" };
      },
    },
  } as unknown as PrismaService;
  const request = { headers: { authorization: "Bearer customer-token" } };
  const context = { switchToHttp: () => ({ getRequest: () => request }) };
  const guard = new (CustomerAuthGuard as unknown as new (
    jwt: JwtService,
    prisma: PrismaService,
  ) => CustomerAuthGuard)(jwt, prisma);

  await assert.rejects(
    guard.canActivate(context as never),
    UnauthorizedException,
  );
  assert.equal(sessionReads, 0);

  let disconnected = false;
  const joined: string[] = [];
  const socket = {
    handshake: {
      auth: { token: "customer-token", tokenType: "customer" },
      headers: {},
    },
    data: {},
    join: async (room: string) => {
      joined.push(room);
    },
    disconnect: () => {
      disconnected = true;
    },
  } as unknown as Socket;
  await createKitchenGatewayForTest(jwt, prisma).handleConnection(socket);

  assert.equal(disconnected, true);
  assert.deepEqual(joined, []);
  assert.equal(sessionReads, 0);
});
