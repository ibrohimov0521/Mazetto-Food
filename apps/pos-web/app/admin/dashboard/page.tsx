"use client";

import { AdminDashboard } from "../../../components/admin/admin-catalog";
import { AuthShell } from "../../../components/auth/auth-shell";
import { PermissionGuard } from "../../../components/auth/permission-guard";
import { RoleGuard } from "../../../components/auth/role-guard";

export default function AdminDashboardPage() {
  return (
    <RoleGuard roles={["SUPER_ADMIN", "ADMIN", "BRANCH_MANAGER"]}>
      <PermissionGuard permission="ADMIN_ACCESS">
        <AuthShell eyebrow="Admin panel" title="MAZETTO boshqaruvi">
          <AdminDashboard />
        </AuthShell>
      </PermissionGuard>
    </RoleGuard>
  );
}
