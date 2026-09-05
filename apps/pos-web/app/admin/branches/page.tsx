"use client";

import { AdminBranchesPage } from "../../../components/admin/admin-catalog";
import { AdminLayout } from "../../../components/admin-shell/admin-layout";
import { AdminPageHeader } from "../../../components/admin-shell/admin-page-header";
import { PermissionGuard } from "../../../components/auth/permission-guard";
import { RoleGuard } from "../../../components/auth/role-guard";

export default function BranchesPage() {
  return (
    <RoleGuard roles={["SUPER_ADMIN", "ADMIN", "BRANCH_MANAGER"]}>
      <PermissionGuard permission="BRANCH_VIEW">
        <AdminLayout>
          <AdminPageHeader
            breadcrumbs={[{ label: "Admin", href: "/admin/dashboard" }, { label: "Sozlamalar" }, { label: "Filiallar" }]}
            description="Filial holati, ish vaqti va buyurtma qabuli"
            title="Filiallar"
          />
          <AdminBranchesPage />
        </AdminLayout>
      </PermissionGuard>
    </RoleGuard>
  );
}
