import pg from "pg";

const { Client } = pg;
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required to prepare the print queue");
}

const client = new Client({ connectionString });

try {
  await client.connect();
  await client.query("BEGIN");
  await client.query(`
    DO $$
    BEGIN
      CREATE TYPE "PrintJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'PRINTED', 'DEAD_LETTER', 'CANCELLED');
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END
    $$;

    CREATE TABLE IF NOT EXISTS "print_jobs" (
      "id" TEXT NOT NULL,
      "receiptId" TEXT NOT NULL,
      "branchId" TEXT NOT NULL,
      "printerId" TEXT,
      "status" "PrintJobStatus" NOT NULL DEFAULT 'PENDING',
      "payload" JSONB NOT NULL,
      "attemptCount" INTEGER NOT NULL DEFAULT 0,
      "maxAttempts" INTEGER NOT NULL DEFAULT 5,
      "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "leaseToken" TEXT,
      "leaseExpiresAt" TIMESTAMP(3),
      "lastError" TEXT,
      "printedAt" TIMESTAMP(3),
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "print_jobs_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "print_jobs_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "receipts"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "print_jobs_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
      CONSTRAINT "print_jobs_printerId_fkey" FOREIGN KEY ("printerId") REFERENCES "printers"("id") ON DELETE SET NULL ON UPDATE CASCADE
    );

    CREATE TABLE IF NOT EXISTS "print_attempts" (
      "id" TEXT NOT NULL,
      "jobId" TEXT NOT NULL,
      "agentId" TEXT NOT NULL,
      "leaseToken" TEXT NOT NULL,
      "outcome" TEXT NOT NULL DEFAULT 'CLAIMED',
      "error" TEXT,
      "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "completedAt" TIMESTAMP(3),
      CONSTRAINT "print_attempts_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "print_attempts_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "print_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE
    );

    CREATE UNIQUE INDEX IF NOT EXISTS "print_attempts_jobId_leaseToken_key" ON "print_attempts"("jobId", "leaseToken");
    CREATE INDEX IF NOT EXISTS "print_jobs_branchId_status_nextAttemptAt_idx" ON "print_jobs"("branchId", "status", "nextAttemptAt");
    CREATE INDEX IF NOT EXISTS "print_jobs_status_leaseExpiresAt_idx" ON "print_jobs"("status", "leaseExpiresAt");
    CREATE INDEX IF NOT EXISTS "print_attempts_agentId_startedAt_idx" ON "print_attempts"("agentId", "startedAt");
  `);
  await client.query("COMMIT");
  console.log("Print queue schema is ready");
} catch (error) {
  await client.query("ROLLBACK").catch(() => undefined);
  throw error;
} finally {
  await client.end().catch(() => undefined);
}
