"use client";

import { AdminShiftsPage } from "../../../components/admin/admin-shifts";
import { AdminLayout } from "../../../components/admin-shell/admin-layout";
import { AdminPageHeader } from "../../../components/admin-shell/admin-page-header";
import { PermissionGuard } from "../../../components/auth/permission-guard";
import { RoleGuard } from "../../../components/auth/role-guard";

export default function AdminShiftsPageRoute() {
  return (
    <RoleGuard roles={["SUPER_ADMIN", "BRANCH_MANAGER"]}>
      <PermissionGuard permission="SHIFT_VIEW_BRANCH">
        <AdminLayout>
          <AdminPageHeader
            breadcrumbs={[
              { label: "Admin", href: "/admin/dashboard" },
              { label: "Kassa va moliya" },
              { label: "Smenalar" },
            ]}
            description="Kassir smenalari va kassa solishtiruvi"
            title="Smenalar"
          />
          <AdminShiftsPage />
        </AdminLayout>
      </PermissionGuard>
    </RoleGuard>
  );
}
