"use client";

import { AdminOrdersPage } from "../../../components/admin/admin-orders";
import { AdminLayout } from "../../../components/admin-shell/admin-layout";
import { AdminPageHeader } from "../../../components/admin-shell/admin-page-header";
import { PermissionGuard } from "../../../components/auth/permission-guard";
import { RoleGuard } from "../../../components/auth/role-guard";

export default function OrdersPage() {
  return (
    <RoleGuard roles={["SUPER_ADMIN", "BRANCH_MANAGER"]}>
      <PermissionGuard permission="ORDER_VIEW">
        <AdminLayout>
          <AdminPageHeader
            breadcrumbs={[
              { label: "Admin", href: "/admin/dashboard" },
              { label: "Operatsiya" },
              { label: "Buyurtmalar" },
            ]}
            description="Kassa, sayt va Telegram buyurtmalari bir ro'yxatda"
            title="Buyurtmalar"
          />
          <AdminOrdersPage />
        </AdminLayout>
      </PermissionGuard>
    </RoleGuard>
  );
}
