"use client";

import { AdminRolesPage } from "../../../components/admin/admin-roles";
import { AdminLayout } from "../../../components/admin-shell/admin-layout";
import { AdminPageHeader } from "../../../components/admin-shell/admin-page-header";
import { PermissionGuard } from "../../../components/auth/permission-guard";
import { RoleGuard } from "../../../components/auth/role-guard";

export default function RolesPage() {
  return (
    <RoleGuard roles={["SUPER_ADMIN", "ADMIN", "BRANCH_MANAGER"]}>
      <PermissionGuard permission="ROLE_VIEW">
        <AdminLayout>
          <AdminPageHeader
            breadcrumbs={[
              { label: "Admin", href: "/admin/dashboard" },
              { label: "Odamlar" },
              { label: "Rollar" },
            ]}
            description="Rol matritsasi va permission katalogi — faqat ko'rish"
            title="Rollar va permissionlar"
          />
          <AdminRolesPage />
        </AdminLayout>
      </PermissionGuard>
    </RoleGuard>
  );
}
