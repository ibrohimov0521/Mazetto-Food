"use client";

import { useParams } from "next/navigation";
import { AdminProductEditor } from "../../../../../components/admin/admin-product-editor";
import { AdminPageHeader } from "../../../../../components/admin-shell/admin-page-header";

export default function ProductDetailPage() {
  const params = useParams<{ id: string }>();

  return (
    <>
      <AdminPageHeader
        breadcrumbs={[{ label: "Admin", href: "/admin/dashboard" }, { label: "Mahsulotlar", href: "/admin/products" }, { label: "Tahrirlash" }]}
        description="Mavjud mahsulot ma'lumotlarini yangilash"
        title="Mahsulotni tahrirlash"
      />
      <AdminProductEditor productId={params.id} />
    </>
  );
}
