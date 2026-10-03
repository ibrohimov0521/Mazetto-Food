import assert from "node:assert/strict";
import test from "node:test";
import { NotificationDeadLetterService } from "../src/modules/notifications/notification-dead-letter.service";
import type { RedisService } from "../src/redis/redis.service";

type StoredDeadLetter = {
  id: number;
  tenantId: string;
  messageId: string;
  kind: string;
  orderId: string;
  error: string;
  failedAt: Date;
  attempts: number;
};

function memoryDatabase(failPrune = false) {
  const rows = new Map<string, StoredDeadLetter>();
  let nextId = 1;
  const notificationDeadLetter = {
    async create({ data }: { data: Omit<StoredDeadLetter, "id"> }) {
      const row = { ...data, id: nextId++ };
      rows.set(`${data.tenantId}:${data.messageId}`, row);
      return row;
    },
    async findMany({
      where,
      skip = 0,
      take,
    }: {
      where: { tenantId: string };
      skip?: number;
      take?: number;
    }) {
      if (failPrune && skip > 0) throw new Error("simulated prune failure");
      const matching = [...rows.values()]
        .filter((row) => row.tenantId === where.tenantId)
        .sort(
          (left, right) =>
            right.failedAt.getTime() - left.failedAt.getTime() ||
            right.id - left.id,
        );
      return matching.slice(skip, take === undefined ? undefined : skip + take);
    },
    async findFirst({
      where,
    }: {
      where: { tenantId: string; messageId: string };
    }) {
      return rows.get(`${where.tenantId}:${where.messageId}`) ?? null;
    },
    async deleteMany({
      where,
    }: {
      where: {
        tenantId: string;
        messageId?: string;
        id?: { in: number[] };
      };
    }) {
      let count = 0;
      for (const [key, row] of rows) {
        const matches =
          row.tenantId === where.tenantId &&
          (where.messageId ? row.messageId === where.messageId : true) &&
          (where.id ? where.id.in.includes(row.id) : true);
        if (matches) {
          rows.delete(key);
          count += 1;
        }
      }
      return { count };
    },
  };
  return {
    rows,
    client: { notificationDeadLetter },
  };
}

/** Redis yo'q — xat yozuvlari PostgreSQL zaxirasiga tushadi. */
function withoutRedis(
  database = memoryDatabase(),
): NotificationDeadLetterService {
  return new NotificationDeadLetterService(
    { getClient: () => null } as unknown as RedisService,
    database.client as never,
  );
}

function fakeRedisClient(lists: Map<string, string[]>, failPipeline = false) {
  return {
    pipeline() {
      const operations: (() => void)[] = [];
      return {
        lpush(key: string, value: string) {
          operations.push(() => { const rows = lists.get(key) ?? []; rows.unshift(value); lists.set(key, rows); });
          return this;
        },
        ltrim(key: string, start: number, end: number) {
          operations.push(() => lists.set(key, (lists.get(key) ?? []).slice(start, end + 1)));
          return this;
        },
        async exec() {
          operations.forEach((operation) => operation());
          return failPipeline
            ? [[new Error("simulated Redis command failure"), null], [null, "OK"]]
            : operations.map(() => [null, "OK"]);
        },
      };
    },
    async lrange(key: string, start: number, end: number) {
      return (lists.get(key) ?? []).slice(start, end + 1);
    },
    async lrem(key: string, count: number, value: string) {
      const rows = lists.get(key) ?? [];
      let removed = 0;
      for (let index = rows.length - 1; index >= 0 && removed < count; index -= 1) {
        if (rows[index] === value) { rows.splice(index, 1); removed += 1; }
      }
      lists.set(key, rows);
      return removed;
    },
  };
}

test("yuborilmagan bildirishnoma yozib olinadi", async () => {
  const service = withoutRedis();
  const entry = await service.record({ tenantId: "tenant-a",
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

  const listed = await service.list("tenant-a");
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
    const entry = await service.record({ tenantId: "tenant-a",
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
  await service.record({ tenantId: "tenant-a", kind: "k", orderId: "eski", error: "x", attempts: 1 });
  await service.record({ tenantId: "tenant-a", kind: "k", orderId: "yangi", error: "x", attempts: 1 });

  const listed = await service.list("tenant-a");
  assert.equal(listed[0]?.orderId, "yangi");
});

test("ro'yxat chegaralangan — PostgreSQL zaxirasi to'lib ketmaydi", async () => {
  /*
   * Redis uzoq vaqt tushib turganda har buyurtma zaxira ro'yxatga
   * tushadi. Chegarasiz bu jarayon bazani to'ldirib yuborardi.
   */
  const database = memoryDatabase();
  const service = withoutRedis(database);
  for (let i = 0; i < 600; i += 1) {
    await service.record({
      tenantId: "tenant-a",
      kind: "k",
      orderId: `order-${i}`,
      error: "x",
      attempts: 1,
    });
  }
  const listed = await service.list("tenant-a", 500);
  assert.equal(listed.length, 500);
  assert.equal(database.rows.size, 500);
  // Chegara eng ESKISINI tashlaydi, eng yangisini emas.
  assert.equal(listed[0]?.orderId, "order-599");
});

test("zaxirani tozalash xatosi yangi dead letter yozuvini yo'qotmaydi", async () => {
  const database = memoryDatabase(true);
  const service = withoutRedis(database);
  const entry = await service.record({
    tenantId: "tenant-a",
    kind: "staff_new_order",
    orderId: "order-a",
    error: "Telegram 502",
    attempts: 3,
  });

  assert.equal((await service.list("tenant-a"))[0]?.messageId, entry.messageId);
});

test("take yozuvni olib tashlaydi va ikkinchi marta null qaytaradi", async () => {
  const service = withoutRedis();
  const entry = await service.record({ tenantId: "tenant-a",
    kind: "staff_new_order",
    orderId: "order-1",
    error: "x",
    attempts: 3,
  });

  assert.equal((await service.take("tenant-a", entry.messageId))?.orderId, "order-1");
  assert.equal(await service.take("tenant-a", entry.messageId), null);
  assert.equal((await service.list("tenant-a")).length, 0);
});

test("noma'lum messageId null beradi", async () => {
  const service = withoutRedis();
  assert.equal(await service.take("tenant-a", "yo'q-bunday-id"), null);
});

test("list chegarasi qiymatni xavfsiz oraliqqa siqadi", async () => {
  const service = withoutRedis();
  await service.record({ tenantId: "tenant-a", kind: "k", orderId: "a", error: "x", attempts: 1 });

  // Nol yoki manfiy chegara bo'sh natija bermasligi kerak.
  assert.equal((await service.list("tenant-a", 0)).length, 1);
  assert.equal((await service.list("tenant-a", -5)).length, 1);
  // Juda katta so'rov ham chegaradan oshmaydi.
  assert.ok((await service.list("tenant-a", 10_000)).length <= 500);
});

test("Error bo'lmagan xato ham satrga aylanadi", async () => {
  /*
   * `catch` blokiga har narsa tushishi mumkin — string, obyekt, undefined.
   * `error.message` ga to'g'ridan-to'g'ri murojaat qilish o'sha yerda
   * ikkinchi xato tug'dirardi.
   */
  const service = withoutRedis();
  const entry = await service.record({ tenantId: "tenant-a",
    kind: "k",
    orderId: "a",
    error: { status: 502 },
    attempts: 1,
  });
  assert.equal(typeof entry.error, "string");
});

test("Redis dead letters use isolated tenant keys", async () => {
  const lists = new Map<string, string[]>();
  const client = {
    pipeline() {
      const operations: (() => void)[] = [];
      return {
        lpush(key: string, value: string) {
          operations.push(() => { const rows = lists.get(key) ?? []; rows.unshift(value); lists.set(key, rows); });
          return this;
        },
        ltrim(key: string, start: number, end: number) {
          operations.push(() => lists.set(key, (lists.get(key) ?? []).slice(start, end + 1)));
          return this;
        },
        async exec() {
          operations.forEach((operation) => operation());
          return operations.map(() => [null, "OK"]);
        },
      };
    },
    async lrange(key: string, start: number, end: number) {
      return (lists.get(key) ?? []).slice(start, end + 1);
    },
    async lrem(key: string, count: number, value: string) {
      const rows = lists.get(key) ?? [];
      let removed = 0;
      for (let index = rows.length - 1; index >= 0 && removed < count; index -= 1) {
        if (rows[index] === value) { rows.splice(index, 1); removed += 1; }
      }
      lists.set(key, rows);
      return removed;
    },
  };
  const service = new NotificationDeadLetterService({ getClient: () => client } as never, memoryDatabase().client as never);
  const entryA = await service.record({ tenantId: "tenant-a", kind: "staff_new_order", orderId: "order-a", error: "x", attempts: 1 });
  const entryB = await service.record({ tenantId: "tenant-b", kind: "staff_new_order", orderId: "order-b", error: "x", attempts: 1 });
  assert.deepEqual([...lists.keys()].sort(), ["notify:dead:tenant-a", "notify:dead:tenant-b"]);
  assert.equal((await service.list("tenant-a"))[0]?.messageId, entryA.messageId);
  assert.equal((await service.list("tenant-b"))[0]?.messageId, entryB.messageId);
  assert.equal(await service.take("tenant-b", entryA.messageId), null);
  assert.equal((await service.take("tenant-a", entryA.messageId))?.tenantId, "tenant-a");
});

test("Redis uzilganda yozuv restartdan keyin PostgreSQL'dan tiklanadi", async () => {
  const lists = new Map<string, string[]>();
  const client = fakeRedisClient(lists);
  const database = memoryDatabase();
  const state: { client: unknown | null } = { client: null };
  const service = new NotificationDeadLetterService(
    { getClient: () => state.client } as never,
    database.client as never,
  );
  const entry = await service.record({
    tenantId: "tenant-a",
    kind: "staff_new_order",
    orderId: "order-a",
    error: "Redis vaqtincha uzildi",
    attempts: 3,
  });

  const restartedService = new NotificationDeadLetterService(
    { getClient: () => state.client } as never,
    database.client as never,
  );
  state.client = client;
  assert.equal(
    (await restartedService.list("tenant-a"))[0]?.messageId,
    entry.messageId,
  );
  assert.equal(
    (await restartedService.take("tenant-a", entry.messageId))?.messageId,
    entry.messageId,
  );
  assert.equal((await restartedService.list("tenant-a")).length, 0);
});

test("Redis pipeline ichki xatosi fallback yozuvini yashirmaydi yoki takrorlamaydi", async () => {
  const client = fakeRedisClient(new Map(), true);
  const service = new NotificationDeadLetterService({ getClient: () => client } as never, memoryDatabase().client as never);
  const entry = await service.record({
    tenantId: "tenant-a",
    kind: "staff_new_order",
    orderId: "order-a",
    error: "Telegram yuborilmadi",
    attempts: 3,
  });

  const listed = await service.list("tenant-a");
  assert.equal(listed.length, 1);
  assert.equal(listed[0]?.messageId, entry.messageId);
  assert.equal((await service.take("tenant-a", entry.messageId))?.messageId, entry.messageId);
  assert.equal((await service.list("tenant-a")).length, 0);
});
