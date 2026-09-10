"use client";

import { CourierOrdersPage } from "../../../components/courier/courier-orders";
import { StaffShell } from "../../../components/staff/staff-shell";
import { PermissionGuard } from "../../../components/auth/permission-guard";
import { RoleGuard } from "../../../components/auth/role-guard";

export default function CourierPage() {
  return (
    <RoleGuard roles={["COURIER", "SUPER_ADMIN", "ADMIN", "BRANCH_MANAGER"]}>
      <PermissionGuard permission="COURIER_DELIVERY_VIEW">
        <StaffShell title="Kuryer">
          <CourierOrdersPage />
        </StaffShell>
      </PermissionGuard>
    </RoleGuard>
  );
}
