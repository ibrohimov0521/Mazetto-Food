"use client";

import { AdminBranchesPage } from "../../../components/admin/admin-catalog";
import { AuthShell } from "../../../components/auth/auth-shell";
import { PermissionGuard } from "../../../components/auth/permission-guard";
import { RoleGuard } from "../../../components/auth/role-guard";

export default function BranchesPage() {
  return (
    <RoleGuard roles={["SUPER_ADMIN", "ADMIN", "BRANCH_MANAGER"]}>
      <PermissionGuard permission="BRANCH_VIEW">
        <AuthShell eyebrow="Filiallar" title="Filial holati">
          <AdminBranchesPage />
        </AuthShell>
      </PermissionGuard>
    </RoleGuard>
  );
}
