"use client";

import { AdminCategoriesPage } from "../../../components/admin/admin-catalog";
import { AuthShell } from "../../../components/auth/auth-shell";
import { PermissionGuard } from "../../../components/auth/permission-guard";
import { RoleGuard } from "../../../components/auth/role-guard";

export default function CategoriesPage() {
  return (
    <RoleGuard roles={["SUPER_ADMIN", "ADMIN", "BRANCH_MANAGER"]}>
      <PermissionGuard permission="MENU_VIEW">
        <AuthShell eyebrow="Menyu boshqaruvi" title="Kategoriyalar">
          <AdminCategoriesPage />
        </AuthShell>
      </PermissionGuard>
    </RoleGuard>
  );
}
