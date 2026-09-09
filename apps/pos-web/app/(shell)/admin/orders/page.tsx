"use client";

import { AdminOrdersPage } from "../../../../components/admin/admin-orders";
import { AdminPageHeader } from "../../../../components/admin-shell/admin-page-header";

export default function OrdersPage() {
  return (
    <>
      <AdminPageHeader
        breadcrumbs={[
          { label: "Admin", href: "/admin/dashboard" },
          { label: "Operatsiya" },
          { label: "Buyurtmalar" },
        ]}
        description="Kassa, sayt va Telegram buyurtmalari bir ro'yxatda"
        title="Buyurtmalar"
      />
      <AdminOrdersPage />
    </>
  );
}
