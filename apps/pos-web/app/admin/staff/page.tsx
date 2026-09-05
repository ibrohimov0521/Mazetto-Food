"use client";

import { AdminStaffPage } from "../../../components/admin/admin-staff";
import { AdminLayout } from "../../../components/admin-shell/admin-layout";
import { AdminPageHeader } from "../../../components/admin-shell/admin-page-header";
import { PermissionGuard } from "../../../components/auth/permission-guard";
import { RoleGuard } from "../../../components/auth/role-guard";

export default function StaffPage() {
  return (
    <RoleGuard roles={["SUPER_ADMIN", "ADMIN", "BRANCH_MANAGER"]}>
      <PermissionGuard permission="STAFF_VIEW">
        <AdminLayout>
          <AdminPageHeader
            breadcrumbs={[{ label: "Admin", href: "/admin/dashboard" }, { label: "Odamlar" }, { label: "Xodimlar" }]}
            description="Rol, filial, parol reset va bloklash"
            title="Xodimlar"
          />
          <AdminStaffPage />
        </AdminLayout>
      </PermissionGuard>
    </RoleGuard>
  );
}
