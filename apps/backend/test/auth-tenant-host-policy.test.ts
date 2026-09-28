import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import { ForbiddenException } from "@nestjs/common";
import { hash } from "bcryptjs";
import { AuthService } from "../src/modules/auth/auth.service";

function userRecord(roleCode: string, passwordHash: string) {
  return {
    id: "user-1",
    email: "user@example.test",
    phone: null,
    passwordHash,
    credentialVersion: 0,
    isActive: true,
    employee: null,
    roles: [
      {
        role: {
          code: roleCode,
          isBranchScoped: false,
          permissions: [
            {
              permission: {
                code:
                  roleCode === "PLATFORM_OWNER"
                    ? "SYSTEM_HEALTH_VIEW"
                    : "KITCHEN_VIEW",
              },
            },
          ],
        },
      },
    ],
  };
}

function createService(
  account: ReturnType<typeof userRecord>,
  prismaOverrides: Record<string, unknown> = {},
) {
  const prisma = {
    user: {
      findFirst: async () => account,
      findUnique: async () => account,
      update: async () => ({}),
    },
    session: {
      create: async () => ({ id: "session-a" }),
      update: async () => ({}),
      findFirst: async () => null,
    },
    ...prismaOverrides,
  };
  const jwt = {
    signAsync: async () => "signed-token",
    verifyAsync: async () => ({}),
  };
  const throttle = {
    assertAllowed: async () => undefined,
    registerFailure: async () => undefined,
    clear: async () => undefined,
  };
  return new AuthService(
    prisma as never,
    jwt as never,
    throttle as never,
    { resolve: async () => null } as never,
    {
      resolve: async () => ({ kind: "UNREGISTERED", hostname: "unknown.test" }),
    } as never,
  );
}

test("unknown hosts cannot create legacy restaurant staff sessions", async () => {
  const password = "Correct-horse-1!";
  const service = createService(userRecord("KITCHEN", await hash(password, 4)));

  await assert.rejects(
    service.login(
      { identifier: "user@example.test", password },
      "127.0.0.1",
      "unknown.test",
    ),
    ForbiddenException,
  );
});

test("platform-only owner accounts can sign in on the owner-console host", async () => {
  const password = "Correct-horse-1!";
  const service = createService(
    userRecord("PLATFORM_OWNER", await hash(password, 4)),
  );

  const result = await service.login(
    { identifier: "user@example.test", password },
    "127.0.0.1",
    "admin.mazetto.uz",
  );

  assert.deepEqual(result.user.roles, ["PLATFORM_OWNER"]);
  assert.equal(result.tokens.accessToken, "signed-token");
});

test("refresh cannot renew a legacy restaurant session on an unknown host", async () => {
  const refreshToken = "legacy-refresh-token";
  const account = userRecord("KITCHEN", "");
  let signedTokens = 0;
  const service = new AuthService(
    {
      user: { findUnique: async () => account },
      session: {
        findFirst: async () => ({
          id: "session-a",
          refreshTokenHash: await hash(refreshToken, 4),
          membershipId: null,
        }),
        update: async () => ({}),
      },
    } as never,
    {
      verifyAsync: async () => ({
        id: "user-1",
        sessionId: "session-a",
        tokenUse: "refresh",
      }),
      signAsync: async () => {
        signedTokens += 1;
        return "new-token";
      },
    } as never,
    {} as never,
    { resolve: async () => null } as never,
    {
      resolve: async () => ({ kind: "UNREGISTERED", hostname: "unknown.test" }),
    } as never,
  );

  await assert.rejects(
    service.refresh(refreshToken, "unknown.test"),
    ForbiddenException,
  );
  assert.equal(signedTokens, 0);
});
