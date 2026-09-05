"use client";

import { AdminReportsPage } from "../../../components/admin/admin-reports";
import { AdminLayout } from "../../../components/admin-shell/admin-layout";
import { AdminPageHeader } from "../../../components/admin-shell/admin-page-header";
import { PermissionGuard } from "../../../components/auth/permission-guard";
import { RoleGuard } from "../../../components/auth/role-guard";

export default function ReportsPage() {
  return (
    <RoleGuard roles={["SUPER_ADMIN", "ADMIN", "BRANCH_MANAGER", "ACCOUNTANT"]}>
      <PermissionGuard permission="REPORT_SALES_VIEW">
        <AdminLayout>
          <AdminPageHeader
            breadcrumbs={[{ label: "Admin", href: "/admin/dashboard" }, { label: "Hisobotlar" }, { label: "Savdo" }]}
            description="Sana oralig'i bo'yicha ishonchli sotuvlar"
            title="Savdo hisoboti"
          />
          <AdminReportsPage />
        </AdminLayout>
      </PermissionGuard>
    </RoleGuard>
  );
}
