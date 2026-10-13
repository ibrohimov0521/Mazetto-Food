import assert from "node:assert/strict";
import test from "node:test";
import type { AuthenticatedUser } from "../src/common/types/authenticated-user";
import { ReceiptsService } from "../src/modules/receipts/receipts.service";

test("receipt history loads print-job timestamps and all printer outcomes", async () => {
  const user: AuthenticatedUser = {
    id: "owner-a",
    isGlobalScope: true,
    roles: ["SUPER_ADMIN"],
    permissions: [],
  };
  let query: Record<string, unknown> | undefined;
  const service = new ReceiptsService({
    restaurantTenant: { findMany: async () => [{ id: "tenant-a" }] },
    receipt: {
      findMany: async (args: Record<string, unknown>) => {
        query = args;
        return [];
      },
    },
  } as never);

  await service.listReceipts({} as never, user);

  const select = query?.select as Record<string, unknown>;
  assert.deepEqual(select.printJobs, {
    orderBy: { createdAt: "desc" },
    select: { status: true, submittedAt: true, createdAt: true },
  });
});
