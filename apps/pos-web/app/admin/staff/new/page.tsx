"use client";

import { AdminStaffEditor } from "../../../../components/admin/admin-staff";
import { AdminLayout } from "../../../../components/admin-shell/admin-layout";
import { AdminPageHeader } from "../../../../components/admin-shell/admin-page-header";
import { PermissionGuard } from "../../../../components/auth/permission-guard";
import { RoleGuard } from "../../../../components/auth/role-guard";

export default function NewStaffPage() {
  return (
    <RoleGuard roles={["SUPER_ADMIN", "ADMIN", "BRANCH_MANAGER"]}>
      <PermissionGuard permission="STAFF_CREATE">
        <AdminLayout>
          <AdminPageHeader
            breadcrumbs={[{ label: "Admin", href: "/admin/dashboard" }, { label: "Xodimlar", href: "/admin/staff" }, { label: "Yangi" }]}
            description="Yangi xodim yaratish va rol biriktirish"
            title="Yangi xodim"
          />
          <AdminStaffEditor />
        </AdminLayout>
      </PermissionGuard>
    </RoleGuard>
  );
}
