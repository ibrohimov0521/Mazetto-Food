"use client";

import { AdminProductsPage } from "../../../components/admin/admin-catalog";
import { AuthShell } from "../../../components/auth/auth-shell";
import { PermissionGuard } from "../../../components/auth/permission-guard";
import { RoleGuard } from "../../../components/auth/role-guard";

export default function ProductsPage() {
  return (
    <RoleGuard roles={["SUPER_ADMIN", "BRANCH_MANAGER"]}>
      <PermissionGuard permission="MENU_VIEW">
        <AuthShell eyebrow="Menyu boshqaruvi" title="Mahsulotlar">
          <AdminProductsPage />
        </AuthShell>
      </PermissionGuard>
    </RoleGuard>
  );
}
