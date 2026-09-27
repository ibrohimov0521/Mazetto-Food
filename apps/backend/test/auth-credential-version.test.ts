import assert from "node:assert/strict";
import test from "node:test";
import { UnauthorizedException } from "@nestjs/common";
import { JwtAuthGuard } from "../src/common/guards/jwt-auth.guard";
import type { AuthenticatedUser } from "../src/common/types/authenticated-user";

function createGuard(
  credentialVersion: number | undefined,
  cachedVersion: number,
) {
  const request = {
    headers: { authorization: "Bearer access-token" },
    path: "/api/v1/admin/dashboard",
    socket: { remoteAddress: "127.0.0.1" },
  };
  const guard = new JwtAuthGuard(
    { verifyAsync: async () => ({ id: "user-1", credentialVersion }) } as never,
    { getAllAndOverride: () => false } as never,
    {} as never,
    {
      read: async () =>
        ({
          id: "user-1",
          credentialVersion: cachedVersion,
          roles: ["CASHIER"],
          permissions: ["POS_USE"],
        }) satisfies AuthenticatedUser,
    } as never,
  );
  const context = {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => request }),
  };

  return { guard, context };
}

test("access token is rejected after password credentials are changed", async () => {
  const { guard, context } = createGuard(2, 3);
  await assert.rejects(
    guard.canActivate(context as never),
    UnauthorizedException,
  );
});

test("legacy access token remains valid for an unchanged version-zero account", async () => {
  const { guard, context } = createGuard(undefined, 0);
  assert.equal(await guard.canActivate(context as never), true);
});
