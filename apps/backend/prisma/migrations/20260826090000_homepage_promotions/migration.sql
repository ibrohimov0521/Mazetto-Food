-- CreateTable
CREATE TABLE "homepage_hero_slides" (
    "id" TEXT NOT NULL,
    "productId" TEXT,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "imageUrl" TEXT,
    "ctaLabel" TEXT,
    "targetUrl" TEXT,
    "badge" TEXT,
    "accent" JSONB,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "startAt" TIMESTAMP(3),
    "endAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "homepage_hero_slides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promotions" (
    "id" TEXT NOT NULL,
    "productId" TEXT,
    "categoryId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "ctaLabel" TEXT,
    "targetUrl" TEXT,
    "badge" TEXT,
    "discountPercent" DECIMAL(5,2),
    "promotionalPrice" DECIMAL(12,2),
    "accent" JSONB,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "startAt" TIMESTAMP(3),
    "endAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "promotions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "homepage_hero_slides_isActive_sortOrder_idx" ON "homepage_hero_slides"("isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "homepage_hero_slides_startAt_idx" ON "homepage_hero_slides"("startAt");

-- CreateIndex
CREATE INDEX "homepage_hero_slides_endAt_idx" ON "homepage_hero_slides"("endAt");

-- CreateIndex
CREATE INDEX "homepage_hero_slides_productId_idx" ON "homepage_hero_slides"("productId");

-- CreateIndex
CREATE INDEX "promotions_isActive_sortOrder_idx" ON "promotions"("isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "promotions_startAt_idx" ON "promotions"("startAt");

-- CreateIndex
CREATE INDEX "promotions_endAt_idx" ON "promotions"("endAt");

-- CreateIndex
CREATE INDEX "promotions_productId_idx" ON "promotions"("productId");

-- CreateIndex
CREATE INDEX "promotions_categoryId_idx" ON "promotions"("categoryId");

-- AddForeignKey
ALTER TABLE "homepage_hero_slides" ADD CONSTRAINT "homepage_hero_slides_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotions" ADD CONSTRAINT "promotions_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotions" ADD CONSTRAINT "promotions_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
