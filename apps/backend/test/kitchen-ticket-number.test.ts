import assert from "node:assert/strict";
import test from "node:test";
import { allocateKitchenTicketNumber } from "../src/modules/kitchen/kitchen-ticket-number";

test("oshxona chipta raqami mavjud qiymatni lock ostida o'tkazib yuboradi", async () => {
  const candidates = ["KDS-20261013-EXISTING", "KDS-20261013-AVAILABLE"];
  const checked: string[] = [];
  const locks: string[] = [];
  let candidateIndex = 0;
  const tx = {
    $executeRaw: async (_query: TemplateStringsArray, ...values: unknown[]) => {
      locks.push(String(values[0]));
      return 1;
    },
    kitchenTicket: {
      findUnique: async ({ where }: { where: { ticketNumber: string } }) => {
        checked.push(where.ticketNumber);
        return where.ticketNumber === candidates[0] ? { id: "existing" } : null;
      },
    },
  };

  const ticketNumber = await allocateKitchenTicketNumber(
    tx as never,
    () => candidates[candidateIndex++] ?? "unexpected",
  );

  assert.equal(ticketNumber, candidates[1]);
  assert.deepEqual(checked, candidates);
  assert.deepEqual(
    locks,
    candidates.map((candidate) => `kitchen-ticket-number:${candidate}`),
  );
});

test("oshxona chipta raqami ajratish collision bo'lsa chegaralangan", async () => {
  let attempts = 0;
  const tx = {
    $executeRaw: async () => 1,
    kitchenTicket: {
      findUnique: async () => ({ id: "existing" }),
    },
  };

  await assert.rejects(
    allocateKitchenTicketNumber(
      tx as never,
      () => `KDS-COLLISION-${attempts++}`,
    ),
    /Unable to allocate a kitchen ticket number/,
  );
  assert.equal(attempts, 5);
});
