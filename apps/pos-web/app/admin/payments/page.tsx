"use client";

import { AdminPaymentsPage } from "../../../components/admin/admin-payments";
import { AdminLayout } from "../../../components/admin-shell/admin-layout";
import { AdminPageHeader } from "../../../components/admin-shell/admin-page-header";
import { PermissionGuard } from "../../../components/auth/permission-guard";
import { RoleGuard } from "../../../components/auth/role-guard";

export default function AdminPaymentsPageRoute() {
  return (
    <RoleGuard roles={["SUPER_ADMIN", "BRANCH_MANAGER", "ACCOUNTANT"]}>
      <PermissionGuard permission="PAYMENT_VIEW">
        <AdminLayout>
          <AdminPageHeader
            breadcrumbs={[
              { label: "Admin", href: "/admin/dashboard" },
              { label: "Kassa va moliya" },
              { label: "To'lovlar" },
            ]}
            description="Barcha kanallar bo'yicha to'lov tarixi"
            title="To'lovlar"
          />
          <AdminPaymentsPage />
        </AdminLayout>
      </PermissionGuard>
    </RoleGuard>
  );
}
