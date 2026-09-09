"use client";

import { useParams } from "next/navigation";
import { AdminOrderDetail } from "../../../../../components/admin/admin-orders";
import { AdminPageHeader } from "../../../../../components/admin-shell/admin-page-header";

export default function OrderDetailPage() {
  const params = useParams<{ id: string }>();

  return (
    <>
      <AdminPageHeader
        breadcrumbs={[
          { label: "Admin", href: "/admin/dashboard" },
          { label: "Buyurtmalar", href: "/admin/orders" },
          { label: "Detal" },
        ]}
        description="Buyurtma tarkibi, to'lovlari va holat tarixi"
        title="Buyurtma"
      />
      <AdminOrderDetail orderId={params.id} />
    </>
  );
}
