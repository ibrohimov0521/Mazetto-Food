"use client";

import { AdminReceiptsPage } from "../../../components/admin/admin-receipts";
import { AdminLayout } from "../../../components/admin-shell/admin-layout";
import { AdminPageHeader } from "../../../components/admin-shell/admin-page-header";
import { PermissionGuard } from "../../../components/auth/permission-guard";
import { RoleGuard } from "../../../components/auth/role-guard";

export default function AdminReceiptsPageRoute() {
  return (
    <RoleGuard roles={["SUPER_ADMIN", "BRANCH_MANAGER", "ACCOUNTANT"]}>
      <PermissionGuard permission="RECEIPT_VIEW">
        <AdminLayout>
          <AdminPageHeader
            breadcrumbs={[
              { label: "Admin", href: "/admin/dashboard" },
              { label: "Kassa va moliya" },
              { label: "Cheklar" },
            ]}
            description="Chop etilgan va chop etilmagan cheklar"
            title="Cheklar"
          />
          <AdminReceiptsPage />
        </AdminLayout>
      </PermissionGuard>
    </RoleGuard>
  );
}
