import assert from "node:assert/strict";
import test from "node:test";
import { NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { NotificationsController } from "../src/modules/notifications/notifications.controller";

const actors = {
  "tenant-a": { id: "staff-a", tenantId: "tenant-a", membershipId: "membership-a", isGlobalScope: true, roles: ["SUPER_ADMIN"], permissions: [] },
  "tenant-b": { id: "staff-b", tenantId: "tenant-b", membershipId: "membership-b", isGlobalScope: true, roles: ["SUPER_ADMIN"], permissions: [] },
};

function rowsFor(tenantId: "tenant-a" | "tenant-b") {
  return [{ tenantId, messageId: tenantId === "tenant-a" ? "message-a" : "message-b" }];
}

function createController(retryResult: "sent" | "failed" = "sent") {
  const calls = { list: [] as string[], retry: [] as string[] };
  const prisma = {
    restaurantTenant: { findFirst: async ({ where }: { where: { id: string } }) => ({ id: where.id }) },
  };
  const deadLetters = {
    list: async (tenantId: string) => {
      calls.list.push(tenantId);
      return rowsFor(tenantId as "tenant-a" | "tenant-b");
    },
  };
  const telegramNotifications = {
    retryDeadLetter: async (tenantId: string, messageId: string) => {
      calls.retry.push(tenantId + ":" + messageId);
      return messageId === "message-a" && tenantId === "tenant-a"
        ? retryResult
        : "not-found";
    },
  };
  return {
    calls,
    controller: new NotificationsController(prisma as never, deadLetters as never, telegramNotifications as never),
  };
}

test("dead-letter lists are isolated to the authenticated tenant", async () => {
  const { calls, controller } = createController();
  assert.deepEqual(await controller.list(actors["tenant-a"] as never), rowsFor("tenant-a"));
  assert.deepEqual(await controller.list(actors["tenant-b"] as never), rowsFor("tenant-b"));
  assert.deepEqual(calls.list, ["tenant-a", "tenant-b"]);
});

test("dead-letter retry passes the authenticated tenant and hides another tenant's message", async () => {
  const { calls, controller } = createController();
  assert.deepEqual(await controller.retry(actors["tenant-a"] as never, "message-a"), {
    messageId: "message-a",
    retried: true,
  });
  await assert.rejects(() => controller.retry(actors["tenant-b"] as never, "message-a"), NotFoundException);
  assert.deepEqual(calls.retry, ["tenant-a:message-a", "tenant-b:message-a"]);
});

test("failed dead-letter delivery is reported as unavailable, not as not found", async () => {
  const { controller } = createController("failed");
  await assert.rejects(
    () => controller.retry(actors["tenant-a"] as never, "message-a"),
    ServiceUnavailableException,
  );
});
