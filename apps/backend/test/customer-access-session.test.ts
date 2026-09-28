import assert from "node:assert/strict";
import test from "node:test";
import { UnauthorizedException } from "@nestjs/common";
import type { JwtService } from "@nestjs/jwt";
import type { Socket } from "socket.io";
import { CustomerAuthGuard } from "../src/common/guards/customer-auth.guard";
import type { CustomerAuthenticatedRequest } from "../src/common/types/authenticated-customer";
import { createKitchenGatewayForTest } from "./kitchen-gateway-test-factory";
import type { PrismaService } from "../src/prisma/prisma.service";

function makeRequestContext() {
  const request = {
    headers: { authorization: "Bearer customer-token" },
    customer: undefined,
  } as unknown as CustomerAuthenticatedRequest;
  return {
    request,
    context: {
      switchToHttp: () => ({ getRequest: () => request }),
    },
  };
}

function makeCustomerGuard(active: boolean, activeTenantIds = ["tenant-a"]) {
  const jwt = {
    verifyAsync: async () => ({
      id: "customer-1",
      phone: "+998901234567",
      sessionId: "session-1",
      tokenUse: "customer_access",
      exp: Math.floor(Date.now() / 1000) + 60,
    }),
  } as unknown as JwtService;
  const prisma = {
    restaurantTenant: {
      findMany: async () => activeTenantIds.map((id) => ({ id })),
    },
    customerSession: {
      findFirst: async () => (active ? { id: "session-1" } : null),
    },
  } as unknown as PrismaService;
  const Guard = CustomerAuthGuard as unknown as new (
    jwt: JwtService,
    prisma: PrismaService,
  ) => CustomerAuthGuard;
  return new Guard(jwt, prisma);
}

test("customer HTTP access requires its unrevoked server-side session", async () => {
  const { context, request } = makeRequestContext();
  const guard = makeCustomerGuard(true);

  assert.equal(await guard.canActivate(context as never), true);
  assert.equal(request.customer?.sessionId, "session-1");
});

test("customer HTTP access is rejected after logout revokes its session", async () => {
  const { context } = makeRequestContext();
  const guard = makeCustomerGuard(false);

  await assert.rejects(
    guard.canActivate(context as never),
    UnauthorizedException,
  );
});

test("customer websocket is rejected after its session is revoked", async () => {
  let disconnected = false;
  const jwt = {
    verifyAsync: async () => ({
      id: "customer-1",
      phone: "+998901234567",
      sessionId: "session-1",
      tokenUse: "customer_access",
      exp: Math.floor(Date.now() / 1000) + 60,
    }),
  } as unknown as JwtService;
  const prisma = {
    customerSession: { findFirst: async () => null },
  } as unknown as PrismaService;
  const gateway = createKitchenGatewayForTest(jwt, prisma);
  const client = {
    handshake: {
      auth: { token: "customer-token", tokenType: "customer" },
      headers: {},
    },
    data: {},
    join: () => undefined,
    disconnect: () => {
      disconnected = true;
    },
  } as unknown as Socket;

  await gateway.handleConnection(client);

  assert.equal(disconnected, true);
});
