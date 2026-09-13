"use client";

import { AdminSystemHealth } from "../../../../components/admin/admin-system-health";
import { AdminPageHeader } from "../../../../components/admin-shell/admin-page-header";

export default function SystemHealthPage() {
  return (
    <>
      <AdminPageHeader
        breadcrumbs={[
          { label: "Admin", href: "/admin/dashboard" },
          { label: "Tizim holati" },
        ]}
        description="Xizmatlar va tekshirilgan backup dalili"
        title="Tizim holati"
      />
      <AdminSystemHealth />
    </>
  );
}
