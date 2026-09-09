"use client";

import { AdminPaymentsPage } from "../../../../components/admin/admin-payments";
import { AdminPageHeader } from "../../../../components/admin-shell/admin-page-header";

export default function AdminPaymentsPageRoute() {
  return (
    <>
      <AdminPageHeader
        breadcrumbs={[
          { label: "Admin", href: "/admin/dashboard" },
          { label: "Kassa va moliya" },
          { label: "To'lovlar" },
        ]}
        description="Barcha kanallar bo'yicha to'lov tarixi"
        title="To'lovlar"
      />
      <AdminPaymentsPage />
    </>
  );
}
