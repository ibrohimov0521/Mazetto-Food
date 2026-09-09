"use client";

import { AdminReceiptsPage } from "../../../../components/admin/admin-receipts";
import { AdminPageHeader } from "../../../../components/admin-shell/admin-page-header";

export default function AdminReceiptsPageRoute() {
  return (
    <>
      <AdminPageHeader
        breadcrumbs={[
          { label: "Admin", href: "/admin/dashboard" },
          { label: "Kassa va moliya" },
          { label: "Cheklar" },
        ]}
        description="Chop etilgan va chop etilmagan cheklar"
        title="Cheklar"
      />
      <AdminReceiptsPage />
    </>
  );
}
