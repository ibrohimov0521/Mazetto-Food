"use client";

import { AdminRolesPage } from "../../../../components/admin/admin-roles";
import { AdminPageHeader } from "../../../../components/admin-shell/admin-page-header";

export default function RolesPage() {
  return (
    <>
      <AdminPageHeader
        breadcrumbs={[
          { label: "Admin", href: "/admin/dashboard" },
          { label: "Odamlar" },
          { label: "Rollar" },
        ]}
        description="Rol matritsasi va permission katalogi — faqat ko'rish"
        title="Rollar va permissionlar"
      />
      <AdminRolesPage />
    </>
  );
}
