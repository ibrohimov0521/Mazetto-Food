ALTER TABLE "orders" ADD COLUMN "deliveryLocation" JSONB;
ALTER TABLE "customer_orders" ADD COLUMN "deliveryLocation" JSONB;
CREATE TABLE "customer_addresses" (
  "id" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "location" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "customer_addresses_pkey" PRIMARY KEY ("customerId", "id"),
  CONSTRAINT "customer_addresses_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "customer_addresses_customerId_updatedAt_idx" ON "customer_addresses"("customerId", "updatedAt");
