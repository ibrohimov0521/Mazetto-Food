"use client";

import { useParams } from "next/navigation";
import { AdminStaffEditor } from "../../../../components/admin/admin-staff";
import { AdminLayout } from "../../../../components/admin-shell/admin-layout";
import { AdminPageHeader } from "../../../../components/admin-shell/admin-page-header";
import { PermissionGuard } from "../../../../components/auth/permission-guard";
import { RoleGuard } from "../../../../components/auth/role-guard";

export default function StaffDetailPage() {
  const params = useParams<{ id: string }>();

  return (
    <RoleGuard roles={["SUPER_ADMIN", "ADMIN", "BRANCH_MANAGER"]}>
      <PermissionGuard permission="STAFF_UPDATE">
        <AdminLayout>
          <AdminPageHeader
            breadcrumbs={[{ label: "Admin", href: "/admin/dashboard" }, { label: "Xodimlar", href: "/admin/staff" }, { label: "Profil" }]}
            description="Xodim ma'lumotlari, roli va holati"
            title="Xodim profili"
          />
          <AdminStaffEditor staffId={params.id} />
        </AdminLayout>
      </PermissionGuard>
    </RoleGuard>
  );
}
