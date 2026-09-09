"use client";

import { AdminCategoriesPage } from "../../../../components/admin/admin-categories";
import { AdminPageHeader } from "../../../../components/admin-shell/admin-page-header";

export default function CategoriesPage() {
  return (
    <>
      <AdminPageHeader
        breadcrumbs={[
          { label: "Admin", href: "/admin/dashboard" },
          { label: "Katalog" },
          { label: "Kategoriyalar" },
        ]}
        description="Menyu kategoriyalari, saralash tartibi va ommaviy ko'rinish"
        title="Kategoriyalar"
      />
      <AdminCategoriesPage />
    </>
  );
}
