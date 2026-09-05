"use client";

import { AdminKitchenMonitor } from "../../../components/admin/admin-kitchen-monitor";
import { AdminLayout } from "../../../components/admin-shell/admin-layout";
import { AdminPageHeader } from "../../../components/admin-shell/admin-page-header";
import { PermissionGuard } from "../../../components/auth/permission-guard";
import { RoleGuard } from "../../../components/auth/role-guard";

export default function KitchenMonitorPage() {
  return (
    <RoleGuard roles={["SUPER_ADMIN", "BRANCH_MANAGER"]}>
      <PermissionGuard permission="KITCHEN_VIEW">
        <AdminLayout>
          <AdminPageHeader
            breadcrumbs={[
              { label: "Admin", href: "/admin/dashboard" },
              { label: "Operatsiya" },
              { label: "Oshxona" },
            ]}
            description="Faol ticketlar — faqat kuzatish, holat o'zgartirilmaydi"
            title="Oshxona monitoringi"
          />
          <AdminKitchenMonitor />
        </AdminLayout>
      </PermissionGuard>
    </RoleGuard>
  );
}
