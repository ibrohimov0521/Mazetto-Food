-- One employee owns one active cash drawer per branch.
-- Historical closed shifts remain untouched.
CREATE UNIQUE INDEX "shifts_one_open_per_employee_branch"
  ON "shifts" ("branchId", "employeeId")
  WHERE "status" = 'OPEN';
