"use client";

import { AdminNotificationsPage } from "../../../../components/admin/admin-notifications";
import { AdminPageHeader } from "../../../../components/admin-shell/admin-page-header";

export default function AdminNotificationsRoute() {
  return (
    <>
      <AdminPageHeader
        breadcrumbs={[
          { label: "Admin", href: "/admin/dashboard" },
          { label: "Tizim" },
          { label: "Telegram xabarlari" },
        ]}
        description="Yetkazilmagan buyurtma bildirishnomalarini tekshirish va boshqarish"
        title="Telegram xabarlari"
      />
      <AdminNotificationsPage />
    </>
  );
}
