-- Add server-calculated shift closing audit fields.
ALTER TABLE "shifts"
  ADD COLUMN "expectedCash" DECIMAL(12,2),
  ADD COLUMN "cashDifference" DECIMAL(12,2);

-- A cashier can have only one open shift per branch.
CREATE UNIQUE INDEX "shifts_one_open_employee_branch_idx"
  ON "shifts" ("branchId", "employeeId")
  WHERE "status" = 'OPEN';
