"use client";

import { AdminModifiersPage } from "../../../../components/admin/admin-modifiers";
import { AdminPageHeader } from "../../../../components/admin-shell/admin-page-header";

export default function ModifiersPage() {
  return (
    <>
      <AdminPageHeader
        breadcrumbs={[
          { label: "Admin", href: "/admin/dashboard" },
          { label: "Katalog" },
          { label: "Qo'shimchalar" },
        ]}
        description="Mahsulotlarga biriktiriladigan qo'shimchalar katalogi"
        title="Qo'shimchalar"
      />
      <AdminModifiersPage />
    </>
  );
}
