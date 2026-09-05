"use client";

import { AdminDashboard } from "../../../components/admin/admin-dashboard";
import { AdminLayout } from "../../../components/admin-shell/admin-layout";
import { AdminPageHeader } from "../../../components/admin-shell/admin-page-header";
import { PermissionGuard } from "../../../components/auth/permission-guard";
import { RoleGuard } from "../../../components/auth/role-guard";

export default function AdminDashboardPage() {
  return (
    <RoleGuard roles={["SUPER_ADMIN", "ADMIN", "BRANCH_MANAGER"]}>
      <PermissionGuard permission="ADMIN_ACCESS">
        <AdminLayout>
          <AdminPageHeader
            breadcrumbs={[{ label: "Admin" }, { label: "Dashboard" }]}
            description="Bugungi operatsion ko'rsatkichlar va katalog holati"
            title="MAZETTO boshqaruvi"
          />
          <AdminDashboard />
        </AdminLayout>
      </PermissionGuard>
    </RoleGuard>
  );
}
