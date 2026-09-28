import assert from "node:assert/strict";
import test from "node:test";
import { ForbiddenException } from "@nestjs/common";
import { JwtAuthGuard } from "../src/common/guards/jwt-auth.guard";
import type { AuthenticatedUser } from "../src/common/types/authenticated-user";

function createGuard(input: {
  payload: Partial<AuthenticatedUser>;
  tenantContext:
    | { kind: "UNREGISTERED" }
    | { kind: "BLOCKED"; hostname: string }
    | { kind: "TRUSTED"; hostname: string; tenantId: string };
  membershipUser?: AuthenticatedUser | null;
  legacyUser?: AuthenticatedUser | null;
}) {
  const request: {
    headers: Record<string, string>;
    path: string;
    user?: AuthenticatedUser;
  } = {
    headers: {
      host:
        input.tenantContext.kind === "TRUSTED"
          ? input.tenantContext.hostname
          : "api.legacy.test",
      authorization: "Bearer valid",
    },
    path: "/api/v1/admin/dashboard",
  };
  let membershipCalls = 0;
  let cacheReads = 0;
  const guard = new JwtAuthGuard(
    { verifyAsync: async () => input.payload } as never,
    { getAllAndOverride: () => false } as never,
    {} as never,
    {
      read: async () => {
        cacheReads += 1;
        return input.legacyUser ?? null;
      },
      write: async () => undefined,
    } as never,
    { resolve: async () => input.tenantContext } as never,
    {
      resolve: async () => {
        membershipCalls += 1;
        return input.membershipUser ?? null;
      },
    } as never,
  );
  const context = {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => request }),
  };
  return {
    guard,
    context,
    request,
    get membershipCalls() {
      return membershipCalls;
    },
    get cacheReads() {
      return cacheReads;
    },
  };
}

test("trusted restaurant host rejects a global legacy session", async () => {
  const f = createGuard({
    payload: { id: "user-1", roles: ["SUPER_ADMIN"], permissions: [] },
    tenantContext: {
      kind: "TRUSTED",
      hostname: "api.restaurant.test",
      tenantId: "tenant-a",
    },
  });
  await assert.rejects(
    f.guard.canActivate(f.context as never),
    ForbiddenException,
  );
  assert.equal(f.membershipCalls, 0);
});

test("tenant session cannot be replayed on an unregistered host", async () => {
  const f = createGuard({
    payload: {
      id: "user-1",
      tenantId: "tenant-a",
      membershipId: "membership-a",
      roles: [],
      permissions: [],
    },
    tenantContext: { kind: "UNREGISTERED" },
  });
  await assert.rejects(
    f.guard.canActivate(f.context as never),
    ForbiddenException,
  );
  assert.equal(f.membershipCalls, 0);
});

test("unregistered host rejects legacy restaurant staff tokens", async () => {
  const legacyUser: AuthenticatedUser = {
    id: "user-1",
    roles: ["KITCHEN"],
    permissions: ["KITCHEN_VIEW"],
    credentialVersion: 2,
  };
  const f = createGuard({
    payload: { id: "user-1", credentialVersion: 2 },
    tenantContext: { kind: "UNREGISTERED" },
    legacyUser,
  });

  await assert.rejects(
    f.guard.canActivate(f.context as never),
    ForbiddenException,
  );
  assert.equal(f.cacheReads, 1);
});

test("platform-only accounts remain usable on the unregistered owner-console host", async () => {
  const platformUser: AuthenticatedUser = {
    id: "owner-1",
    roles: ["PLATFORM_OWNER"],
    permissions: ["SYSTEM_HEALTH_VIEW"],
    credentialVersion: 1,
  };
  const f = createGuard({
    payload: { id: "owner-1", credentialVersion: 1 },
    tenantContext: { kind: "UNREGISTERED" },
    legacyUser: platformUser,
  });

  assert.equal(await f.guard.canActivate(f.context as never), true);
  assert.deepEqual(f.request.user?.roles, ["PLATFORM_OWNER"]);
});

test("tenant session cannot cross over to another verified restaurant host", async () => {
  const f = createGuard({
    payload: {
      id: "user-1",
      tenantId: "tenant-a",
      membershipId: "membership-a",
      roles: [],
      permissions: [],
    },
    tenantContext: {
      kind: "TRUSTED",
      hostname: "api.restaurant-b.test",
      tenantId: "tenant-b",
    },
  });
  await assert.rejects(
    f.guard.canActivate(f.context as never),
    ForbiddenException,
  );
  assert.equal(f.membershipCalls, 0);
});

test("matched tenant session reloads membership roles and bypasses the global user-role cache", async () => {
  const user: AuthenticatedUser = {
    id: "user-1",
    tenantId: "tenant-a",
    membershipId: "membership-a",
    roles: ["BRANCH_MANAGER"],
    permissions: ["ORDER_VIEW"],
    credentialVersion: 3,
  };
  const f = createGuard({
    payload: { ...user },
    tenantContext: {
      kind: "TRUSTED",
      hostname: "api.restaurant-a.test",
      tenantId: "tenant-a",
    },
    membershipUser: user,
  });
  assert.equal(await f.guard.canActivate(f.context as never), true);
  assert.equal(f.membershipCalls, 1);
  assert.equal(f.cacheReads, 0);
  assert.equal(f.request.user?.tenantId, "tenant-a");
});

test("registered but unverified host is denied before even public handlers run", async () => {
  const f = createGuard({
    payload: {},
    tenantContext: { kind: "BLOCKED", hostname: "api.pending.test" },
  });
  await assert.rejects(
    f.guard.canActivate(f.context as never),
    ForbiddenException,
  );
});
