"use client";

import { AdminCustomersPage } from "../../../../components/admin/admin-customers";
import { AdminPageHeader } from "../../../../components/admin-shell/admin-page-header";

export default function CustomersPage() {
  return (
    <>
      <AdminPageHeader
        breadcrumbs={[
          { label: "Admin", href: "/admin/dashboard" },
          { label: "Odamlar" },
          { label: "Mijozlar" },
        ]}
        description="Mijoz bazasi, kanal va bonus holati"
        title="Mijozlar"
      />
      <AdminCustomersPage />
    </>
  );
}
