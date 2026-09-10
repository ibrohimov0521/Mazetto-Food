import assert from "node:assert/strict";
import test from "node:test";
import { NotificationDeadLetterService } from "../src/modules/notifications/notification-dead-letter.service";
import type { RedisService } from "../src/redis/redis.service";

/** Redis yo'q — zaxira (xotira) yo'li sinaladi. */
function withoutRedis(): NotificationDeadLetterService {
  return new NotificationDeadLetterService({
    getClient: () => null,
  } as unknown as RedisService);
}

test("yuborilmagan bildirishnoma yozib olinadi", async () => {
  const service = withoutRedis();
  const entry = await service.record({
    kind: "staff_new_order",
    orderId: "order-1",
    error: new Error("Telegram 502"),
    attempts: 3,
  });

  assert.equal(entry.kind, "staff_new_order");
  assert.equal(entry.orderId, "order-1");
  assert.equal(entry.error, "Telegram 502");
  assert.equal(entry.attempts, 3);
  assert.ok(entry.messageId, "messageId bo'lishi shart");

  const listed = await service.list();
  assert.equal(listed.length, 1);
  assert.equal(listed[0]?.messageId, entry.messageId);
});

test("har yozuvda o'ziga xos messageId", async () => {
  /*
   * `messageId` — idempotency kaliti. Takrorlansa, qayta yuborishda
   * noto'g'ri yozuv o'chib ketardi.
   */
  const service = withoutRedis();
  const ids = new Set<string>();
  for (let i = 0; i < 20; i += 1) {
    const entry = await service.record({
      kind: "staff_new_order",
      orderId: `order-${i}`,
      error: "xato",
      attempts: 3,
    });
    ids.add(entry.messageId);
  }
  assert.equal(ids.size, 20);
});

test("eng yangisi ro'yxat boshida", async () => {
  const service = withoutRedis();
  await service.record({ kind: "k", orderId: "eski", error: "x", attempts: 1 });
  await service.record({ kind: "k", orderId: "yangi", error: "x", attempts: 1 });

  const listed = await service.list();
  assert.equal(listed[0]?.orderId, "yangi");
});

test("ro'yxat chegaralangan — xotira to'lib ketmaydi", async () => {
  /*
   * Redis uzoq vaqt tushib turganda har buyurtma zaxira ro'yxatga
   * tushadi. Chegarasiz bu jarayonni yeb qo'yardi.
   */
  const service = withoutRedis();
  for (let i = 0; i < 600; i += 1) {
    await service.record({
      kind: "k",
      orderId: `order-${i}`,
      error: "x",
      attempts: 1,
    });
  }
  const listed = await service.list(500);
  assert.equal(listed.length, 500);
  // Chegara eng ESKISINI tashlaydi, eng yangisini emas.
  assert.equal(listed[0]?.orderId, "order-599");
});

test("take yozuvni olib tashlaydi va ikkinchi marta null qaytaradi", async () => {
  const service = withoutRedis();
  const entry = await service.record({
    kind: "staff_new_order",
    orderId: "order-1",
    error: "x",
    attempts: 3,
  });

  assert.equal((await service.take(entry.messageId))?.orderId, "order-1");
  assert.equal(await service.take(entry.messageId), null);
  assert.equal((await service.list()).length, 0);
});

test("noma'lum messageId null beradi", async () => {
  const service = withoutRedis();
  assert.equal(await service.take("yo'q-bunday-id"), null);
});

test("list chegarasi qiymatni xavfsiz oraliqqa siqadi", async () => {
  const service = withoutRedis();
  await service.record({ kind: "k", orderId: "a", error: "x", attempts: 1 });

  // Nol yoki manfiy chegara bo'sh natija bermasligi kerak.
  assert.equal((await service.list(0)).length, 1);
  assert.equal((await service.list(-5)).length, 1);
  // Juda katta so'rov ham chegaradan oshmaydi.
  assert.ok((await service.list(10_000)).length <= 500);
});

test("Error bo'lmagan xato ham satrga aylanadi", async () => {
  /*
   * `catch` blokiga har narsa tushishi mumkin — string, obyekt, undefined.
   * `error.message` ga to'g'ridan-to'g'ri murojaat qilish o'sha yerda
   * ikkinchi xato tug'dirardi.
   */
  const service = withoutRedis();
  const entry = await service.record({
    kind: "k",
    orderId: "a",
    error: { status: 502 },
    attempts: 1,
  });
  assert.equal(typeof entry.error, "string");
});
