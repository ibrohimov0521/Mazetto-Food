"use client";

import { AdminStaffEditor } from "../../../../components/admin/admin-staff";
import { AuthShell } from "../../../../components/auth/auth-shell";
import { PermissionGuard } from "../../../../components/auth/permission-guard";
import { RoleGuard } from "../../../../components/auth/role-guard";

export default function NewStaffPage() {
  return (
    <RoleGuard roles={["SUPER_ADMIN", "ADMIN", "BRANCH_MANAGER"]}>
      <PermissionGuard permission="STAFF_CREATE">
        <AuthShell eyebrow="Xodimlar" title="Yangi xodim">
          <AdminStaffEditor />
        </AuthShell>
      </PermissionGuard>
    </RoleGuard>
  );
}
