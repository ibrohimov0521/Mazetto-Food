"use client";

import { useParams } from "next/navigation";
import { AdminProductEditor } from "../../../../components/admin/admin-catalog";
import { AdminLayout } from "../../../../components/admin-shell/admin-layout";
import { AdminPageHeader } from "../../../../components/admin-shell/admin-page-header";
import { PermissionGuard } from "../../../../components/auth/permission-guard";
import { RoleGuard } from "../../../../components/auth/role-guard";

export default function ProductDetailPage() {
  const params = useParams<{ id: string }>();

  return (
    <RoleGuard roles={["SUPER_ADMIN", "ADMIN", "BRANCH_MANAGER"]}>
      <PermissionGuard permission="MENU_EDIT">
        <AdminLayout>
          <AdminPageHeader
            breadcrumbs={[{ label: "Admin", href: "/admin/dashboard" }, { label: "Mahsulotlar", href: "/admin/products" }, { label: "Tahrirlash" }]}
            description="Mavjud mahsulot ma'lumotlarini yangilash"
            title="Mahsulotni tahrirlash"
          />
          <AdminProductEditor productId={params.id} />
        </AdminLayout>
      </PermissionGuard>
    </RoleGuard>
  );
}
