"use client";

import { AdminReportsPage } from "../../../components/admin/admin-reports";
import { AuthShell } from "../../../components/auth/auth-shell";
import { PermissionGuard } from "../../../components/auth/permission-guard";
import { RoleGuard } from "../../../components/auth/role-guard";

export default function ReportsPage() {
  return (
    <RoleGuard roles={["SUPER_ADMIN", "ADMIN", "BRANCH_MANAGER", "ACCOUNTANT"]}>
      <PermissionGuard permission="REPORT_SALES_VIEW">
        <AuthShell eyebrow="Hisobotlar" title="Sotuvlar hisoboti">
          <AdminReportsPage />
        </AuthShell>
      </PermissionGuard>
    </RoleGuard>
  );
}
