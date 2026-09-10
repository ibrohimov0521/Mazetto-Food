"use client";

import { AdminSettings } from "../../../../components/admin/admin-settings";
import { AdminPageHeader } from "../../../../components/admin-shell/admin-page-header";

export default function AdminSettingsPage() {
  return (
    <>
      <AdminPageHeader
        breadcrumbs={[
          { label: "Admin", href: "/admin/dashboard" },
          { label: "Sozlamalar" },
          { label: "Biznes sozlamalari" },
        ]}
        description="Cheklovlar va mijoz oqimini deploysiz boshqarish"
        title="Biznes sozlamalari"
      />
      <AdminSettings />
    </>
  );
}
