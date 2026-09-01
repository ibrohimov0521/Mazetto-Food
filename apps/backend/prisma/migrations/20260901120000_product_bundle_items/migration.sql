-- Add persisted bundle/set composition metadata for combo products.
-- This is additive only and does not change historical order snapshots.

CREATE TABLE "product_bundle_items" (
    "id" TEXT NOT NULL,
    "bundleProductId" TEXT NOT NULL,
    "componentCode" TEXT NOT NULL,
    "componentName" TEXT NOT NULL,
    "componentProductId" TEXT,
    "quantity" DECIMAL(10,3) NOT NULL,
    "unitLabel" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_bundle_items_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "product_bundle_items_bundleProductId_componentCode_key" ON "product_bundle_items"("bundleProductId", "componentCode");
CREATE INDEX "product_bundle_items_bundleProductId_idx" ON "product_bundle_items"("bundleProductId");
CREATE INDEX "product_bundle_items_componentProductId_idx" ON "product_bundle_items"("componentProductId");
CREATE INDEX "product_bundle_items_sortOrder_idx" ON "product_bundle_items"("sortOrder");

ALTER TABLE "product_bundle_items"
ADD CONSTRAINT "product_bundle_items_bundleProductId_fkey"
FOREIGN KEY ("bundleProductId") REFERENCES "products"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "product_bundle_items"
ADD CONSTRAINT "product_bundle_items_componentProductId_fkey"
FOREIGN KEY ("componentProductId") REFERENCES "products"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
