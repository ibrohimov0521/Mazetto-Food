"use client";

import { AdminSuppliersPage } from "../../../components/admin/admin-suppliers";
import { AdminLayout } from "../../../components/admin-shell/admin-layout";
import { AdminPageHeader } from "../../../components/admin-shell/admin-page-header";
import { PermissionGuard } from "../../../components/auth/permission-guard";
import { RoleGuard } from "../../../components/auth/role-guard";

export default function SuppliersPage() {
  return (
    <RoleGuard roles={["SUPER_ADMIN", "BRANCH_MANAGER"]}>
      <PermissionGuard permission="INVENTORY_VIEW">
        <AdminLayout>
          <AdminPageHeader
            breadcrumbs={[
              { label: "Admin", href: "/admin/dashboard" },
              { label: "Ombor" },
              { label: "Yetkazib beruvchilar" },
            ]}
            description="Ingredient yetkazib beruvchilari"
            title="Yetkazib beruvchilar"
          />
          <AdminSuppliersPage />
        </AdminLayout>
      </PermissionGuard>
    </RoleGuard>
  );
}
