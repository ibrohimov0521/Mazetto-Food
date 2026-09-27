import assert from "node:assert/strict";
import test from "node:test";
import type { JwtService } from "@nestjs/jwt";
import type { Socket } from "socket.io";
import { PERMISSIONS } from "../src/common/auth/permissions";
import { KitchenGateway } from "../src/modules/kitchen/kitchen.gateway";
import type { PrismaService } from "../src/prisma/prisma.service";

function makeGateway(
  payload: Record<string, unknown>,
  credentialVersion: number | number[],
  role = "KITCHEN",
  activeTenantIds = ["tenant-a"],
) {
  const versions = Array.isArray(credentialVersion)
    ? credentialVersion
    : [credentialVersion];
  let versionRead = 0;
  const jwt = {
    verifyAsync: async () => ({
      ...payload,
      exp: Math.floor(Date.now() / 1000) + 60,
    }),
  } as unknown as JwtService;
  const prisma = {
    restaurantTenant: {
      findMany: async () => activeTenantIds.map((id) => ({ id })),
    },
    user: {
      findUnique: async () => ({
        id: "user-1",
        credentialVersion:
          versions[Math.min(versionRead++, versions.length - 1)],
        isActive: true,
        employee: { id: "employee-1", branchId: "branch-1", status: "ACTIVE" },
        roles: [
          {
            role: {
              code: role,
              permissions: [{ permission: { code: PERMISSIONS.KITCHEN_VIEW } }],
            },
          },
        ],
      }),
    },
  } as unknown as PrismaService;
  return new KitchenGateway(jwt, prisma);
}

function makeSocket() {
  let disconnected = false;
  const joined: string[] = [];
  const client = {
    handshake: {
      auth: { token: "access-token", tokenType: "staff" },
      headers: {},
    },
    data: {},
    disconnect: () => {
      disconnected = true;
    },
    join: (room: string) => {
      joined.push(room);
    },
  } as unknown as Socket;
  return { client, joined, wasDisconnected: () => disconnected };
}

test("kitchen websocket rejects a staff access token after its credential version changes", async () => {
  const gateway = makeGateway({ id: "user-1", credentialVersion: 1 }, 2);
  const socket = makeSocket();

  await gateway.handleConnection(socket.client);

  assert.equal(socket.wasDisconnected(), true);
  assert.deepEqual(socket.joined, []);
});

test("kitchen websocket rechecks credentials after joining the revocation room", async () => {
  const gateway = makeGateway({ id: "user-1", credentialVersion: 1 }, [1, 2]);
  const socket = makeSocket();

  await gateway.handleConnection(socket.client);

  assert.equal(socket.wasDisconnected(), true);
});

test("legacy version-zero staff tokens remain accepted until credentials change", async () => {
  const gateway = makeGateway({ id: "user-1" }, 0);
  const socket = makeSocket();

  await gateway.handleConnection(socket.client);

  assert.equal(socket.wasDisconnected(), false);
  assert.ok(socket.joined.includes("branch:branch-1"));
});

test("global restaurant sockets fail closed when multiple tenants are active", async () => {
  const gateway = makeGateway(
    { id: "user-1", credentialVersion: 0 },
    0,
    "SUPER_ADMIN",
    ["tenant-a", "tenant-b"],
  );
  const socket = makeSocket();

  await gateway.handleConnection(socket.client);

  assert.equal(socket.wasDisconnected(), true);
  assert.deepEqual(socket.joined, []);
});

test("platform-only users cannot join restaurant order event rooms", async () => {
  const gateway = makeGateway({ id: "user-1" }, 0, "PLATFORM_OWNER");
  const socket = makeSocket();

  await gateway.handleConnection(socket.client);

  assert.equal(socket.wasDisconnected(), true);
});

test("accepted staff sockets join a per-user revocation room", async () => {
  const gateway = makeGateway({ id: "user-1", credentialVersion: 2 }, 2);
  const socket = makeSocket();

  await gateway.handleConnection(socket.client);

  assert.ok(socket.joined.includes("staff-user:user-1"));
});

test("credential invalidation disconnects all sockets for that staff user", () => {
  const gateway = makeGateway({ id: "user-1", credentialVersion: 2 }, 2);
  const calls: Array<{ room: string; close: boolean }> = [];
  Object.defineProperty(gateway, "server", {
    value: {
      in: (room: string) => ({
        disconnectSockets: (close: boolean) => calls.push({ room, close }),
      }),
    },
  });

  gateway.disconnectStaffUser("user-1");

  assert.deepEqual(calls, [{ room: "staff-user:user-1", close: true }]);
});
