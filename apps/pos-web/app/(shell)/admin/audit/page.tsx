"use client";

import { AdminAuditPage } from "../../../../components/admin/admin-audit";
import { AdminPageHeader } from "../../../../components/admin-shell/admin-page-header";

export default function AuditPage() {
  return (
    <>
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
    </>
  );
}
