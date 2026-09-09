"use client";

import { AdminProductEditor } from "../../../../../components/admin/admin-product-editor";
import { AdminPageHeader } from "../../../../../components/admin-shell/admin-page-header";

export default function NewProductPage() {
  return (
    <>
      <AdminPageHeader
        breadcrumbs={[{ label: "Admin", href: "/admin/dashboard" }, { label: "Mahsulotlar", href: "/admin/products" }, { label: "Yangi" }]}
        description="Katalogga yangi mahsulot qo'shish"
        title="Yangi mahsulot"
      />
      <AdminProductEditor />
    </>
  );
}
