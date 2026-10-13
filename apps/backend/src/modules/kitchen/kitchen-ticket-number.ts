import { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";

const allocationAttempts = 5;
type TransactionClient = Prisma.TransactionClient;
type CandidateFactory = () => string;

export async function allocateKitchenTicketNumber(
  tx: TransactionClient,
  createCandidate: CandidateFactory = defaultCandidate,
): Promise<string> {
  for (let attempt = 0; attempt < allocationAttempts; attempt += 1) {
    const candidate = createCandidate();
    const lockKey = `kitchen-ticket-number:${candidate}`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;
    const existing = await tx.kitchenTicket.findUnique({
      where: { ticketNumber: candidate },
      select: { id: true },
    });
    if (!existing) return candidate;
  }

  throw new Error("Unable to allocate a kitchen ticket number");
}

function defaultCandidate(): string {
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const suffix = randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase();
  return `KDS-${date}-${suffix}`;
}
