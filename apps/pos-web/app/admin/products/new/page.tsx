"use client";

import { AdminProductEditor } from "../../../../components/admin/admin-catalog";
import { AuthShell } from "../../../../components/auth/auth-shell";
import { PermissionGuard } from "../../../../components/auth/permission-guard";
import { RoleGuard } from "../../../../components/auth/role-guard";

export default function NewProductPage() {
  return (
    <RoleGuard roles={["SUPER_ADMIN", "BRANCH_MANAGER"]}>
      <PermissionGuard permission="MENU_CREATE">
        <AuthShell eyebrow="Menyu boshqaruvi" title="Yangi mahsulot">
          <AdminProductEditor />
        </AuthShell>
      </PermissionGuard>
    </RoleGuard>
  );
}
