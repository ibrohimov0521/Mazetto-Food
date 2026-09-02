"use client";

import { useParams } from "next/navigation";
import { AdminStaffEditor } from "../../../../components/admin/admin-staff";
import { AuthShell } from "../../../../components/auth/auth-shell";
import { PermissionGuard } from "../../../../components/auth/permission-guard";
import { RoleGuard } from "../../../../components/auth/role-guard";

export default function StaffDetailPage() {
  const params = useParams<{ id: string }>();

  return (
    <RoleGuard roles={["SUPER_ADMIN", "ADMIN", "BRANCH_MANAGER"]}>
      <PermissionGuard permission="STAFF_UPDATE">
        <AuthShell eyebrow="Xodimlar" title="Xodim profili">
          <AdminStaffEditor staffId={params.id} />
        </AuthShell>
      </PermissionGuard>
    </RoleGuard>
  );
}
