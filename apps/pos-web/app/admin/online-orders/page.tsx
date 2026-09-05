"use client";

import { AdminOnlineOrdersPage } from "../../../components/admin/admin-online-orders";
import { AdminLayout } from "../../../components/admin-shell/admin-layout";
import { AdminPageHeader } from "../../../components/admin-shell/admin-page-header";
import { PermissionGuard } from "../../../components/auth/permission-guard";
import { RoleGuard } from "../../../components/auth/role-guard";

export default function OnlineOrdersPage() {
  return (
    <RoleGuard roles={["SUPER_ADMIN", "ADMIN", "BRANCH_MANAGER", "ACCOUNTANT"]}>
      <PermissionGuard permission="ONLINE_ORDER_VIEW">
        <AdminLayout>
          <AdminPageHeader
            breadcrumbs={[
              { label: "Admin", href: "/admin/dashboard" },
              { label: "Operatsiya" },
              { label: "Online buyurtmalar" },
            ]}
            description="Sayt va Telegram orqali kelgan mijoz buyurtmalari"
            title="Online buyurtmalar"
          />
          <AdminOnlineOrdersPage />
        </AdminLayout>
      </PermissionGuard>
    </RoleGuard>
  );
}
