"use client";

import { CourierOrdersPage } from "../../components/courier/courier-orders";
import { AdminLayout } from "../../components/admin-shell/admin-layout";
import { AdminPageHeader } from "../../components/admin-shell/admin-page-header";
import { PermissionGuard } from "../../components/auth/permission-guard";
import { RoleGuard } from "../../components/auth/role-guard";

export default function CourierPage() {
  return (
    <RoleGuard roles={["COURIER", "SUPER_ADMIN", "ADMIN", "BRANCH_MANAGER"]}>
      <PermissionGuard permission="COURIER_DELIVERY_VIEW">
        <AdminLayout>
          <AdminPageHeader
            breadcrumbs={[
              { label: "Ish joylari", href: "/workspace" },
              { label: "Kuryer" },
            ]}
            description="Mijoz manzili, telefon raqami va navigatsiya tugmalari"
            title="Kuryer paneli"
          />
          <CourierOrdersPage />
        </AdminLayout>
      </PermissionGuard>
    </RoleGuard>
  );
}
