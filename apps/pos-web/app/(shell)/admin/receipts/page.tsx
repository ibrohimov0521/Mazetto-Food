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
        description="Chek holati va printer drayveri javobi"
        title="Cheklar"
      />
      <AdminReceiptsPage />
    </>
  );
}
