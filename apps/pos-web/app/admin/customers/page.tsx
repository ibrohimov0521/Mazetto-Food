"use client";

import { AdminCustomersPage } from "../../../components/admin/admin-customers";
import { AdminLayout } from "../../../components/admin-shell/admin-layout";
import { AdminPageHeader } from "../../../components/admin-shell/admin-page-header";
import { PermissionGuard } from "../../../components/auth/permission-guard";
import { RoleGuard } from "../../../components/auth/role-guard";

export default function CustomersPage() {
  return (
    <RoleGuard roles={["SUPER_ADMIN", "ADMIN", "BRANCH_MANAGER", "ACCOUNTANT"]}>
      <PermissionGuard permission="CUSTOMER_VIEW">
        <AdminLayout>
          <AdminPageHeader
            breadcrumbs={[
              { label: "Admin", href: "/admin/dashboard" },
              { label: "Odamlar" },
              { label: "Mijozlar" },
            ]}
            description="Mijoz bazasi, kanal va bonus holati"
            title="Mijozlar"
          />
          <AdminCustomersPage />
        </AdminLayout>
      </PermissionGuard>
    </RoleGuard>
  );
}
