import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { Pool } from "pg";

type Scenario = {
  secondTenantActive?: boolean;
  crossTenantOrders?: boolean;
  mismatchedChallengePhone?: boolean;
};

async function main(): Promise<void> {
const databaseUrl = process.env.DATABASE_URL;
assert.ok(databaseUrl, "DATABASE_URL is required");
assert.equal(
  process.env.CUSTOMER_TENANT_MIGRATION_QA,
  "1",
  "This validator is only enabled by the isolated QA runner",
);
const databaseName = decodeURIComponent(new URL(databaseUrl).pathname.slice(1));
assert.match(
  databaseName,
  /^bestteam_owner_qa_[0-9]+_[0-9a-f]{6}$/,
  "Refusing to run outside the disposable owner QA database",
);

const migrationSql = readFileSync(
  new URL("../prisma/migrations/20260929100000_customer_tenant_isolation/migration.sql", import.meta.url),
  "utf8",
);
const pool = new Pool({ connectionString: databaseUrl });
const client = await pool.connect();
const schemas: string[] = [];

async function createLegacySchema(scenario: Scenario): Promise<string> {
  const schema = `customer_migration_${randomBytes(6).toString("hex")}`;
  schemas.push(schema);
  await client.query(`CREATE SCHEMA "${schema}"`);
  await client.query(`SET search_path TO "${schema}"`);
  await client.query(`
    CREATE TABLE restaurant_tenants (
      id TEXT PRIMARY KEY,
      status TEXT NOT NULL
    );
    CREATE TABLE branches (
      id TEXT PRIMARY KEY,
      "tenantId" TEXT NOT NULL REFERENCES restaurant_tenants(id)
    );
    CREATE TABLE customers (
      id TEXT PRIMARY KEY,
      phone TEXT NOT NULL,
      email TEXT,
      "telegramUserId" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE customer_orders (
      "customerId" TEXT NOT NULL REFERENCES customers(id),
      "branchId" TEXT NOT NULL REFERENCES branches(id)
    );
    CREATE TABLE customer_verification_challenges (
      id TEXT PRIMARY KEY,
      "customerId" TEXT REFERENCES customers(id) ON DELETE SET NULL ON UPDATE CASCADE,
      phone TEXT NOT NULL,
      "codeHash" TEXT NOT NULL,
      "expiresAt" TIMESTAMP(3) NOT NULL,
      "consumedAt" TIMESTAMP(3),
      attempts INTEGER NOT NULL DEFAULT 0,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE UNIQUE INDEX "customers_phone_key" ON customers(phone);
    CREATE UNIQUE INDEX "customers_email_key" ON customers(email);
    CREATE UNIQUE INDEX "customers_telegramUserId_key" ON customers("telegramUserId");
    CREATE INDEX "customers_createdAt_idx" ON customers("createdAt");
    CREATE INDEX "customer_verification_challenges_phone_createdAt_idx"
      ON customer_verification_challenges(phone, "createdAt");
    CREATE INDEX "customer_verification_challenges_phone_consumedAt_expiresAt_idx"
      ON customer_verification_challenges(phone, "consumedAt", "expiresAt");
    CREATE INDEX "customer_verification_challenges_customerId_idx"
      ON customer_verification_challenges("customerId");
  `);
  await client.query(
    "INSERT INTO restaurant_tenants (id, status) VALUES ('tenant-a', 'ACTIVE'), ('tenant-b', $1)",
    [scenario.secondTenantActive ? "ACTIVE" : "PROVISIONING"],
  );
  await client.query(
    'INSERT INTO branches (id, "tenantId") VALUES (\'branch-a\', \'tenant-a\'), (\'branch-b\', \'tenant-b\')',
  );
  await client.query(
    `INSERT INTO customers (id, phone, email, "telegramUserId") VALUES
      ('customer-ordered', '+998900000001', 'same@example.invalid', 'telegram-same'),
      ('customer-no-orders', '+998900000002', NULL, NULL)`,
  );
  await client.query(
    'INSERT INTO customer_orders ("customerId", "branchId") VALUES (\'customer-ordered\', \'branch-a\')',
  );
  if (scenario.crossTenantOrders) {
    await client.query(
      'INSERT INTO customer_orders ("customerId", "branchId") VALUES (\'customer-ordered\', \'branch-b\')',
    );
  }
  const challengePhone = scenario.mismatchedChallengePhone
    ? "+998900009999"
    : "+998900000001";
  await client.query(
    `INSERT INTO customer_verification_challenges (id, "customerId", phone, "codeHash", "expiresAt")
      VALUES ('challenge-linked', 'customer-ordered', $1, 'hash', CURRENT_TIMESTAMP + INTERVAL '5 minutes'),
             ('challenge-orphan', NULL, '+998900000003', 'hash', CURRENT_TIMESTAMP + INTERVAL '5 minutes')`,
    [challengePhone],
  );
  return schema;
}

async function assertNoCustomerTenantColumn(schema: string): Promise<void> {
  const columns = await client.query(
    `SELECT column_name FROM information_schema.columns
      WHERE table_schema = $1 AND table_name = 'customers' AND column_name = 'tenantId'`,
    [schema],
  );
  assert.equal(columns.rowCount, 0, "Rejected migration must not partially add tenant ownership");
}

async function assertRejectedScenario(scenario: Scenario, expectedError: RegExp): Promise<void> {
  const schema = await createLegacySchema(scenario);
  await assert.rejects(client.query(migrationSql), expectedError);
  await assertNoCustomerTenantColumn(schema);
}

try {
  await createLegacySchema({});
  await client.query(migrationSql);

  const customers = await client.query(
    'SELECT id, "tenantId" FROM customers ORDER BY id',
  );
  assert.deepEqual(customers.rows, [
    { id: "customer-no-orders", tenantId: "tenant-a" },
    { id: "customer-ordered", tenantId: "tenant-a" },
  ]);
  const challenges = await client.query(
    'SELECT id, "tenantId" FROM customer_verification_challenges ORDER BY id',
  );
  assert.deepEqual(challenges.rows, [
    { id: "challenge-linked", tenantId: "tenant-a" },
    { id: "challenge-orphan", tenantId: "tenant-a" },
  ]);

  await client.query(
    `INSERT INTO customers (id, "tenantId", phone, email, "telegramUserId")
      VALUES ('customer-b', 'tenant-b', '+998900000001', 'same@example.invalid', 'telegram-same')`,
  );
  await assert.rejects(
    client.query(
      `INSERT INTO customers (id, "tenantId", phone, email)
        VALUES ('customer-a-duplicate', 'tenant-a', '+998900000001', 'another@example.invalid')`,
    ),
    /duplicate key/,
  );
  await assert.rejects(
    client.query(
      `INSERT INTO customers (id, "tenantId", phone)
        VALUES ('customer-unknown-tenant', 'tenant-missing', '+998900000004')`,
    ),
    /foreign key constraint/,
  );

  await assertRejectedScenario(
    { secondTenantActive: true },
    /requires exactly one ACTIVE restaurant/,
  );
  await assertRejectedScenario(
    { crossTenantOrders: true },
    /Customer orders span multiple tenants/,
  );
  await assertRejectedScenario(
    { mismatchedChallengePhone: true },
    /challenge phone does not match its linked customer/,
  );

  console.log(
    "Customer tenant migration QA passed: legacy backfill, tenant-local identity uniqueness, foreign keys, and all fail-closed preflight gates.",
  );
} finally {
  await client.query("SET search_path TO public").catch(() => undefined);
  for (const schema of schemas.reverse()) {
    await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`).catch(() => undefined);
  }
  client.release();
  await pool.end();
}

}
main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
