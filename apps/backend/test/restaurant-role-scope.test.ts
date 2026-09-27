import assert from "node:assert/strict";
import test from "node:test";
import { ForbiddenException } from "@nestjs/common";
import { hasRestaurantGlobalScope, resolveBranchScope } from "../src/common/auth/access-scope";

test("platform roles never grant restaurant-wide branch scope", () => {
  assert.equal(hasRestaurantGlobalScope([{ code: "PLATFORM_OWNER", isBranchScoped: false }]), false);
  assert.equal(hasRestaurantGlobalScope([
    { code: "PLATFORM_OWNER", isBranchScoped: false },
    { code: "WAITER", isBranchScoped: true },
  ]), false);
});

test("platform role cannot widen an employee's branch access", () => {
  const roles = [
    { code: "PLATFORM_OWNER", isBranchScoped: false },
    { code: "WAITER", isBranchScoped: true },
  ];
  const user = {
    id: "owner-waiter",
    branchId: "branch-a",
    roles: roles.map((role) => role.code),
    permissions: [],
    isGlobalScope: hasRestaurantGlobalScope(roles),
  };

  assert.equal(resolveBranchScope(user), "branch-a");
  assert.throws(() => resolveBranchScope(user, "branch-b"), ForbiddenException);
});

test("restaurant-wide roles retain their existing single-restaurant scope", () => {
  assert.equal(hasRestaurantGlobalScope([{ code: "SUPER_ADMIN", isBranchScoped: false }]), true);
  assert.equal(hasRestaurantGlobalScope([{ code: "ACCOUNTANT", isBranchScoped: false }]), true);
  assert.equal(hasRestaurantGlobalScope([{ code: "BRANCH_MANAGER", isBranchScoped: true }]), false);
});
