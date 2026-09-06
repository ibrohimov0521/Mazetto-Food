"use client";

import { AdminModifiersPage } from "../../../components/admin/admin-modifiers";
import { AdminLayout } from "../../../components/admin-shell/admin-layout";
import { AdminPageHeader } from "../../../components/admin-shell/admin-page-header";
import { PermissionGuard } from "../../../components/auth/permission-guard";
import { RoleGuard } from "../../../components/auth/role-guard";

export default function ModifiersPage() {
  return (
    <RoleGuard roles={["SUPER_ADMIN", "ADMIN", "BRANCH_MANAGER"]}>
      <PermissionGuard permission="MENU_VIEW">
        <AdminLayout>
          <AdminPageHeader
            breadcrumbs={[
              { label: "Admin", href: "/admin/dashboard" },
              { label: "Katalog" },
              { label: "Qo'shimchalar" },
            ]}
            description="Mahsulotlarga biriktiriladigan qo'shimchalar katalogi"
            title="Qo'shimchalar"
          />
          <AdminModifiersPage />
        </AdminLayout>
      </PermissionGuard>
    </RoleGuard>
  );
}
