"use client";

import { CourierOrdersPage } from "../../../components/courier/courier-orders";
import { StaffShell } from "../../../components/staff/staff-shell";
import { PermissionGuard } from "../../../components/auth/permission-guard";

export default function CourierPage() {
  return (
    <PermissionGuard permission="COURIER_DELIVERY_VIEW">
      <StaffShell title="Kuryer">
        <CourierOrdersPage />
      </StaffShell>
    </PermissionGuard>
  );
}
