"use client";

import { AdminProductEditor } from "../../../../components/admin/admin-catalog";
import { AdminLayout } from "../../../../components/admin-shell/admin-layout";
import { AdminPageHeader } from "../../../../components/admin-shell/admin-page-header";
import { PermissionGuard } from "../../../../components/auth/permission-guard";
import { RoleGuard } from "../../../../components/auth/role-guard";

export default function NewProductPage() {
  return (
    <RoleGuard roles={["SUPER_ADMIN", "ADMIN", "BRANCH_MANAGER"]}>
      <PermissionGuard permission="MENU_CREATE">
        <AdminLayout>
          <AdminPageHeader
            breadcrumbs={[{ label: "Admin", href: "/admin/dashboard" }, { label: "Mahsulotlar", href: "/admin/products" }, { label: "Yangi" }]}
            description="Katalogga yangi mahsulot qo'shish"
            title="Yangi mahsulot"
          />
          <AdminProductEditor />
        </AdminLayout>
      </PermissionGuard>
    </RoleGuard>
  );
}
