"use client";

import { AdminProductsPage } from "../../../../components/admin/admin-catalog";
import { AdminPageHeader } from "../../../../components/admin-shell/admin-page-header";

export default function ProductsPage() {
  return (
    <>
      <AdminPageHeader
        breadcrumbs={[{ label: "Admin", href: "/admin/dashboard" }, { label: "Katalog" }, { label: "Mahsulotlar" }]}
        description="Narx, holat, katalog ko'rinishi va set tarkibi"
        title="Mahsulotlar"
      />
      <AdminProductsPage />
    </>
  );
}
