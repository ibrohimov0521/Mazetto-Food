"use client";

import { AdminPageHeader } from "../../../../components/admin-shell/admin-page-header";
import { DesktopPrintSettings } from "../../../../components/admin/desktop-print-settings";

export default function PrintSettingsPage() {
  return (
    <>
      <AdminPageHeader
        breadcrumbs={[
          { label: "Bosh sahifa", href: "/admin/dashboard" },
          { label: "Uskunalar", href: "/admin/devices" },
          { label: "Chop etish sozlamalari" },
        ]}
        description="Windows printerlari va chek maketlarini boshqaring"
        title="Chop etish sozlamalari"
      />
      <DesktopPrintSettings />
    </>
  );
}
