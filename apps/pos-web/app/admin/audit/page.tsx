"use client";

import { AdminAuditPage } from "../../../components/admin/admin-audit";
import { AdminLayout } from "../../../components/admin-shell/admin-layout";
import { AdminPageHeader } from "../../../components/admin-shell/admin-page-header";
import { PermissionGuard } from "../../../components/auth/permission-guard";
import { RoleGuard } from "../../../components/auth/role-guard";

export default function AuditPage() {
  return (
    <RoleGuard roles={["SUPER_ADMIN"]}>
      <PermissionGuard permission="AUDIT_VIEW">
        <AdminLayout>
          <AdminPageHeader
            breadcrumbs={[
              { label: "Admin", href: "/admin/dashboard" },
              { label: "Sozlamalar" },
              { label: "Audit jurnali" },
            ]}
            description="Xodim boshqaruvi va xavfsizlik hodisalari tarixi"
            title="Audit jurnali"
          />
          <AdminAuditPage />
        </AdminLayout>
      </PermissionGuard>
    </RoleGuard>
  );
}
