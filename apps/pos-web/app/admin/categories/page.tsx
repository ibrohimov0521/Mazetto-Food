"use client";

import { AdminCategoriesPage } from "../../../components/admin/admin-catalog";
import { AdminLayout } from "../../../components/admin-shell/admin-layout";
import { AdminPageHeader } from "../../../components/admin-shell/admin-page-header";
import { PermissionGuard } from "../../../components/auth/permission-guard";
import { RoleGuard } from "../../../components/auth/role-guard";

export default function CategoriesPage() {
  return (
    <RoleGuard roles={["SUPER_ADMIN", "ADMIN", "BRANCH_MANAGER"]}>
      <PermissionGuard permission="MENU_VIEW">
        <AdminLayout>
          <AdminPageHeader
            breadcrumbs={[{ label: "Admin", href: "/admin/dashboard" }, { label: "Katalog" }, { label: "Kategoriyalar" }]}
            description="Menyu kategoriyalari, saralash tartibi va ommaviy ko'rinish"
            title="Kategoriyalar"
          />
          <AdminCategoriesPage />
        </AdminLayout>
      </PermissionGuard>
    </RoleGuard>
  );
}
