"use client";

import { AdminTelegramStatisticsPage } from "../../../../components/admin/admin-telegram-statistics";
import { AdminPageHeader } from "../../../../components/admin-shell/admin-page-header";

export default function TelegramStatisticsPage() {
  return (
    <>
      <AdminPageHeader
        breadcrumbs={[
          { label: "Admin", href: "/admin/dashboard" },
          { label: "Telegram statistikasi" },
        ]}
        description="Telegram bot orqali bog'langan mijozlar va kelgan buyurtmalar"
        title="Telegram statistikasi"
      />
      <AdminTelegramStatisticsPage />
    </>
  );
}
