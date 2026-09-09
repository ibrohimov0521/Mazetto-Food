"use client";

import { AdminReportsPage } from "../../../../components/admin/admin-reports";
import { AdminPageHeader } from "../../../../components/admin-shell/admin-page-header";

export default function ReportsPage() {
  return (
    <>
      <AdminPageHeader
        breadcrumbs={[{ label: "Admin", href: "/admin/dashboard" }, { label: "Hisobotlar" }, { label: "Savdo" }]}
        description="Sana oralig'i bo'yicha ishonchli sotuvlar"
        title="Savdo hisoboti"
      />
      <AdminReportsPage />
    </>
  );
}
