"use client";

import { AdminHomepagePage } from "../../../components/admin/admin-homepage";
import { AdminLayout } from "../../../components/admin-shell/admin-layout";
import { AdminPageHeader } from "../../../components/admin-shell/admin-page-header";
import { PermissionGuard } from "../../../components/auth/permission-guard";
import { RoleGuard } from "../../../components/auth/role-guard";

export default function HomepageContentPage() {
  return (
    <RoleGuard roles={["SUPER_ADMIN", "ADMIN", "BRANCH_MANAGER"]}>
      <PermissionGuard permission="HOMEPAGE_MANAGE">
        <AdminLayout>
          <AdminPageHeader
            breadcrumbs={[
              { label: "Admin", href: "/admin/dashboard" },
              { label: "Katalog" },
              { label: "Bosh sahifa" },
            ]}
            description="Mijoz saytining hero slaydlari va aksiyalari — o'zgarishlar darhol ko'rinadi"
            title="Bosh sahifa va aksiyalar"
          />
          <AdminHomepagePage />
        </AdminLayout>
      </PermissionGuard>
    </RoleGuard>
  );
}
