import assert from "node:assert/strict";
import test from "node:test";
import type { AuthenticatedUser } from "../src/common/types/authenticated-user";
import { BranchesService } from "../src/modules/branches/branches.service";

const owner: AuthenticatedUser = {
  id: "owner-a",
  isGlobalScope: true,
  roles: ["SUPER_ADMIN"],
  permissions: ["BRANCH_EDIT"],
};

test("branch update keeps the tenant filter on the final write", async () => {
  let updateWhere: unknown;
  const service = new BranchesService({
    branch: {
      findFirst: async () => ({ id: "branch-a" }),
      update: async (args: { where: unknown }) => {
        updateWhere = args.where;
        return {};
      },
    },
    restaurantTenant: {
      findMany: async () => [{ id: "tenant-a" }],
    },
  } as never);

  await service.updateBranch("branch-a", { name: "Updated" }, owner);
  assert.deepEqual(updateWhere, { id: "branch-a", tenantId: "tenant-a" });
});
