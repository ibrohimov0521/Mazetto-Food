import { Prisma } from "@prisma/client";

type AuditClient = Pick<Prisma.TransactionClient, "auditLog">;

type AuditEntry = {
  userId: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  metadata?: Prisma.InputJsonValue;
};

/** Audit yozuvi asosiy o'zgarish bilan bir tranzaksiyada saqlanishi uchun. */
export function writeAuditLog(client: AuditClient, entry: AuditEntry) {
  return client.auditLog.create({
    data: {
      userId: entry.userId,
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId ?? null,
      ...(entry.metadata === undefined ? {} : { metadata: entry.metadata }),
    },
  });
}
