"use client";

import { AdminExpensesPage } from "../../../components/admin/admin-expenses";
import { AdminLayout } from "../../../components/admin-shell/admin-layout";
import { AdminPageHeader } from "../../../components/admin-shell/admin-page-header";
import { PermissionGuard } from "../../../components/auth/permission-guard";
import { RoleGuard } from "../../../components/auth/role-guard";

export default function ExpensesPage() {
  return (
    <RoleGuard roles={["SUPER_ADMIN", "ADMIN", "BRANCH_MANAGER", "ACCOUNTANT"]}>
      <PermissionGuard permission="REPORT_EXPENSES_VIEW">
        <AdminLayout>
          <AdminPageHeader
            breadcrumbs={[
              { label: "Admin", href: "/admin/dashboard" },
              { label: "Kassa va moliya" },
              { label: "Xarajatlar" },
            ]}
            description="Filial xarajatlari va smena kassa hisobiga bog'lash"
            title="Xarajatlar"
          />
          <AdminExpensesPage />
        </AdminLayout>
      </PermissionGuard>
    </RoleGuard>
  );
}
