import assert from "node:assert/strict";
import test from "node:test";
import { OrdersService } from "../src/modules/orders/orders.service";

test("background POS Telegram notification failures are contained", async () => {
  const service = new OrdersService(
    {
      order: {
        findUnique: async () => ({ staffTelegramMessageId: null }),
      },
    } as never,
    {} as never,
    {} as never,
    {
      notifyNewOrder: async () => {
        throw new Error("dead-letter storage unavailable");
      },
    } as never,
  );
  const logger = (service as unknown as {
    logger: { error: (...args: unknown[]) => void };
  }).logger;
  const logged: unknown[][] = [];
  logger.error = (...args) => logged.push(args);

  await (service as unknown as {
    notifyTelegramStaffGroupIfNeeded: (orderId: string) => Promise<void>;
  }).notifyTelegramStaffGroupIfNeeded("order-a");

  assert.equal(logged.length, 1);
  assert.ok(logged[0]);
  assert.match(String(logged[0][0]), /order-a/);
});
