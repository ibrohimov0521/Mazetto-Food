"use client";

import { useParams } from "next/navigation";
import { AdminOrderDetail } from "../../../../components/admin/admin-orders";
import { AdminLayout } from "../../../../components/admin-shell/admin-layout";
import { AdminPageHeader } from "../../../../components/admin-shell/admin-page-header";
import { PermissionGuard } from "../../../../components/auth/permission-guard";
import { RoleGuard } from "../../../../components/auth/role-guard";

export default function OrderDetailPage() {
  const params = useParams<{ id: string }>();

  return (
    <RoleGuard roles={["SUPER_ADMIN", "BRANCH_MANAGER"]}>
      <PermissionGuard permission="ORDER_VIEW">
        <AdminLayout>
          <AdminPageHeader
            breadcrumbs={[
              { label: "Admin", href: "/admin/dashboard" },
              { label: "Buyurtmalar", href: "/admin/orders" },
              { label: "Detal" },
            ]}
            description="Buyurtma tarkibi, to'lovlari va holat tarixi"
            title="Buyurtma"
          />
          <AdminOrderDetail orderId={params.id} />
        </AdminLayout>
      </PermissionGuard>
    </RoleGuard>
  );
}
