"use client";

import { AdminOnlineOrdersPage } from "../../../../components/admin/admin-online-orders";
import { AdminPageHeader } from "../../../../components/admin-shell/admin-page-header";

export default function OnlineOrdersPage() {
  return (
    <>
      <AdminPageHeader
        breadcrumbs={[
          { label: "Admin", href: "/admin/dashboard" },
          { label: "Operatsiya" },
          { label: "Online buyurtmalar" },
        ]}
        description="Sayt va Telegram orqali kelgan mijoz buyurtmalari"
        title="Online buyurtmalar"
      />
      <AdminOnlineOrdersPage />
    </>
  );
}
