"use client";

import { AdminInventoryPage } from "../../../../components/admin/admin-inventory";
import { AdminPageHeader } from "../../../../components/admin-shell/admin-page-header";

export default function AdminInventoryRoute() {
  return (
    <>
      <AdminPageHeader
        breadcrumbs={[
          { label: "Admin", href: "/admin/dashboard" },
          { label: "Ombor" },
          { label: "Zaxira" },
        ]}
        description="Ingredient qoldiqlari va zaxira harakatlari"
        title="Ombor zaxirasi"
      />
      <AdminInventoryPage />
    </>
  );
}
