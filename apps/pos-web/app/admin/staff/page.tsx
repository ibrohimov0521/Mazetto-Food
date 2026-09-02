"use client";

import { AdminStaffPage } from "../../../components/admin/admin-staff";
import { AuthShell } from "../../../components/auth/auth-shell";
import { PermissionGuard } from "../../../components/auth/permission-guard";
import { RoleGuard } from "../../../components/auth/role-guard";

export default function StaffPage() {
  return (
    <RoleGuard roles={["SUPER_ADMIN", "ADMIN", "BRANCH_MANAGER"]}>
      <PermissionGuard permission="STAFF_VIEW">
        <AuthShell eyebrow="Xodimlar" title="Staff boshqaruvi">
          <AdminStaffPage />
        </AuthShell>
      </PermissionGuard>
    </RoleGuard>
  );
}
