"use client";

import { AdminSuppliersPage } from "../../../../components/admin/admin-suppliers";
import { AdminPageHeader } from "../../../../components/admin-shell/admin-page-header";

export default function SuppliersPage() {
  return (
    <>
      <AdminPageHeader
        breadcrumbs={[
          { label: "Admin", href: "/admin/dashboard" },
          { label: "Ombor" },
          { label: "Yetkazib beruvchilar" },
        ]}
        description="Ingredient yetkazib beruvchilari"
        title="Yetkazib beruvchilar"
      />
      <AdminSuppliersPage />
    </>
  );
}
