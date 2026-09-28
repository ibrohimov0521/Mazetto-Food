import assert from "node:assert/strict";
import test from "node:test";
import type { JwtService } from "@nestjs/jwt";
import type { Socket } from "socket.io";
import { PERMISSIONS } from "../src/common/auth/permissions";
import { createKitchenGatewayForTest } from "./kitchen-gateway-test-factory";
import type { PrismaService } from "../src/prisma/prisma.service";

function socket(tokenType: "customer" | "staff") {
  let disconnected = false;
  const joined: string[] = [];
  const client = {
    handshake: { auth: { token: "expired-token", tokenType }, headers: {} },
    data: {},
    join: async (room: string) => {
      joined.push(room);
    },
    disconnect: () => {
      disconnected = true;
    },
  } as unknown as Socket;
  return { client, joined, wasDisconnected: () => disconnected };
}

test("customer websocket disconnects when its access JWT expiry is reached", async () => {
  const jwt = {
    verifyAsync: async () => ({
      id: "customer-1",
      phone: "+998901234567",
      sessionId: "session-1",
      tokenUse: "customer_access",
      exp: Math.floor(Date.now() / 1000) - 1,
    }),
  } as unknown as JwtService;
  const prisma = {
    restaurantTenant: { findMany: async () => [{ id: "tenant-a" }] },
    customerSession: { findFirst: async () => ({ id: "session-1" }) },
  } as unknown as PrismaService;
  const gateway = createKitchenGatewayForTest(jwt, prisma);
  const client = socket("customer");

  await gateway.handleConnection(client.client);
  await new Promise((resolve) => setTimeout(resolve, 5));

  assert.equal(client.wasDisconnected(), true);
});

test("staff websocket disconnects when its access JWT expiry is reached", async () => {
  const jwt = {
    verifyAsync: async () => ({
      id: "user-1",
      tenantId: "tenant-a",
      membershipId: "membership-a",
      credentialVersion: 0,
      exp: Math.floor(Date.now() / 1000) - 1,
    }),
  } as unknown as JwtService;
  const prisma = {
    user: {
      findUnique: async () => ({
        id: "user-1",
        credentialVersion: 0,
        isActive: true,
        employee: { id: "employee-1", branchId: "branch-1", status: "ACTIVE" },
        roles: [
          {
            role: {
              code: "KITCHEN",
              permissions: [{ permission: { code: PERMISSIONS.KITCHEN_VIEW } }],
            },
          },
        ],
      }),
    },
  } as unknown as PrismaService;
  const gateway = createKitchenGatewayForTest(
    jwt,
    prisma,
    {
      resolve: async () => ({
        kind: "TRUSTED" as const,
        hostname: "mazetto-a.test",
        tenantId: "tenant-a",
      }),
    },
    {
      resolve: async (userId, tenantId, membershipId) => ({
        id: userId,
        tenantId,
        membershipId: membershipId ?? "membership-a",
        credentialVersion: 0,
        branchId: "branch-1",
        roles: ["KITCHEN"],
        permissions: [PERMISSIONS.KITCHEN_VIEW],
      }),
    },
  );
  const client = socket("staff");

  await gateway.handleConnection(client.client);
  await new Promise((resolve) => setTimeout(resolve, 5));

  assert.equal(client.wasDisconnected(), true);
});
