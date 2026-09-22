import assert from "node:assert/strict";
import test from "node:test";
import type { ExecutionContext } from "@nestjs/common";
import { JwtAuthGuard } from "../src/common/guards/jwt-auth.guard";
import { hashDeviceToken } from "../src/modules/devices/devices.service";

type TestUser = {
  id: string;
  roles: string[];
  permissions: string[];
};

function createGuard(options: {
  user: TestUser;
  device?: {
    isActive: boolean;
    enrolledAt: Date | null;
    deviceAuthTokenHash: string | null;
  } | null;
}) {
  return new JwtAuthGuard(
    { verifyAsync: async () => ({ id: options.user.id }) } as never,
    { getAllAndOverride: () => false } as never,
    {
      device: {
        findUnique: async () => options.device ?? null,
      },
    } as never,
    { read: async () => options.user, write: async () => undefined } as never,
  );
}

function context(input: {
  path?: string;
  deviceId?: string;
  deviceToken?: string;
}): ExecutionContext {
  const request = {
    path: input.path ?? "/api/v1/orders",
    headers: {
      authorization: "Bearer valid-token",
      ...(input.deviceId
        ? { "x-mazetto-device-id": input.deviceId }
        : {}),
      ...(input.deviceToken
        ? { "x-mazetto-device-token": input.deviceToken }
        : {}),
    },
  };

  return {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => request }),
  } as never;
}

const operationalUser: TestUser = {
  id: "cashier-1",
  roles: ["CASHIER"],
  permissions: ["POS_USE"],
};

test("operatsion rol oddiy webda device headersiz ishlaydi", async () => {
  const guard = createGuard({ user: operationalUser });

  assert.equal(await guard.canActivate(context({})), true);
});

test("admin oddiy brauzerda device headersiz ishlay oladi", async () => {
  const guard = createGuard({
    user: { id: "admin-1", roles: ["ADMIN"], permissions: ["ADMIN_ACCESS"] },
  });

  assert.equal(await guard.canActivate(context({})), true);
});

test("rasmiy desktop faol token bilan o'tadi", async () => {
  const token = "desktop-secret";
  const guard = createGuard({
    user: operationalUser,
    device: {
      isActive: true,
      enrolledAt: new Date(),
      deviceAuthTokenHash: hashDeviceToken(token),
    },
  });

  assert.equal(
    await guard.canActivate(
      context({ deviceId: "desktop-1", deviceToken: token }),
    ),
    true,
  );
});

test("device ID bor bo'lsa admin ham noto'g'ri token bilan o'tolmaydi", async () => {
  const guard = createGuard({
    user: { id: "admin-1", roles: ["ADMIN"], permissions: ["ADMIN_ACCESS"] },
    device: {
      isActive: true,
      enrolledAt: new Date(),
      deviceAuthTokenHash: hashDeviceToken("correct-token"),
    },
  });

  await assert.rejects(
    () =>
      guard.canActivate(
        context({ deviceId: "desktop-1", deviceToken: "wrong-token" }),
      ),
    /kod bilan tasdiqlanmagan/,
  );
});

test("desktop header yuborilsa operatsion rol uchun token majburiy", async () => {
  const guard = createGuard({ user: operationalUser });

  await assert.rejects(
    () => guard.canActivate(context({ deviceId: "desktop-1" })),
    /kod bilan tasdiqlanmagan/,
  );
});

test("auth me ulashdan oldin ham ochiq qoladi", async () => {
  const guard = createGuard({ user: operationalUser });

  assert.equal(
    await guard.canActivate(context({ path: "/api/v1/auth/me" })),
    true,
  );
});
