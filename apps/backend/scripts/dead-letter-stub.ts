import type {
  DeadLetter,
  NotificationDeadLetterService,
} from "../src/modules/notifications/notification-dead-letter.service";

/*
 * O'lik xat servisining test o'rinbosari.
 *
 * Haqiqiy servis Redis talab qiladi, tekshirilayotgan mantiq esa unga
 * bog'liq emas. Stub yozuvlarni XOTIRADA saqlaydi, ya'ni skript kerak
 * bo'lsa "yo'qotish yozib olindimi" degan savolni ham tekshira oladi —
 * `entries` massivi ochiq qoldirilgan aynan shuning uchun.
 */
export function createDeadLetterStub(): NotificationDeadLetterService & {
  entries: DeadLetter[];
} {
  const entries: DeadLetter[] = [];

  const stub = {
    entries,
    record: async (input: {
      kind: string;
      orderId: string;
      error: unknown;
      attempts: number;
    }) => {
      const entry: DeadLetter = {
        messageId: `stub-${entries.length + 1}`,
        kind: input.kind,
        orderId: input.orderId,
        error:
          input.error instanceof Error
            ? input.error.message
            : String(input.error),
        failedAt: new Date().toISOString(),
        attempts: input.attempts,
      };
      entries.unshift(entry);
      return entry;
    },
    list: async (limit = 50) => entries.slice(0, limit),
    take: async (messageId: string) => {
      const index = entries.findIndex((row) => row.messageId === messageId);
      if (index === -1) return null;
      return entries.splice(index, 1)[0] ?? null;
    },
  };

  return stub as unknown as NotificationDeadLetterService & {
    entries: DeadLetter[];
  };
}
