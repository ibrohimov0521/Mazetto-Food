"use client";

import { useParams } from "next/navigation";
import { AdminProductEditor } from "../../../../components/admin/admin-catalog";
import { AuthShell } from "../../../../components/auth/auth-shell";
import { PermissionGuard } from "../../../../components/auth/permission-guard";
import { RoleGuard } from "../../../../components/auth/role-guard";

export default function ProductDetailPage() {
  const params = useParams<{ id: string }>();

  return (
    <RoleGuard roles={["SUPER_ADMIN", "BRANCH_MANAGER"]}>
      <PermissionGuard permission="MENU_EDIT">
        <AuthShell eyebrow="Menyu boshqaruvi" title="Mahsulotni tahrirlash">
          <AdminProductEditor productId={params.id} />
        </AuthShell>
      </PermissionGuard>
    </RoleGuard>
  );
}
