"use client";

import { AdminProductsPage } from "../../../components/admin/admin-catalog";
import { AdminLayout } from "../../../components/admin-shell/admin-layout";
import { AdminPageHeader } from "../../../components/admin-shell/admin-page-header";
import { PermissionGuard } from "../../../components/auth/permission-guard";
import { RoleGuard } from "../../../components/auth/role-guard";

export default function ProductsPage() {
  return (
    <RoleGuard roles={["SUPER_ADMIN", "ADMIN", "BRANCH_MANAGER"]}>
      <PermissionGuard permission="MENU_VIEW">
        <AdminLayout>
          <AdminPageHeader
            breadcrumbs={[{ label: "Admin", href: "/admin/dashboard" }, { label: "Katalog" }, { label: "Mahsulotlar" }]}
            description="Narx, holat, katalog ko'rinishi va set tarkibi"
            title="Mahsulotlar"
          />
          <AdminProductsPage />
        </AdminLayout>
      </PermissionGuard>
    </RoleGuard>
  );
}
