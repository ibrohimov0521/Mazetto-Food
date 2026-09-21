CREATE TABLE "expense_categories" (
  "id" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "normalizedName" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "expense_categories_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "expense_categories_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

INSERT INTO "expense_categories" (
  "id", "branchId", "name", "normalizedName", "isActive", "createdAt", "updatedAt"
)
SELECT
  'expcat_' || md5("branchId" || ':' || lower(btrim("category"))),
  "branchId",
  min(btrim("category")),
  lower(btrim("category")),
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "expenses"
WHERE btrim("category") <> ''
GROUP BY "branchId", lower(btrim("category"));

CREATE UNIQUE INDEX "expense_categories_branchId_normalizedName_key"
  ON "expense_categories"("branchId", "normalizedName");
CREATE INDEX "expense_categories_branchId_isActive_name_idx"
  ON "expense_categories"("branchId", "isActive", "name");
