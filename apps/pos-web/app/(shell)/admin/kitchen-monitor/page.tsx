"use client";

import { AdminKitchenMonitor } from "../../../../components/admin/admin-kitchen-monitor";
import { AdminPageHeader } from "../../../../components/admin-shell/admin-page-header";

export default function KitchenMonitorPage() {
  return (
    <>
      <AdminPageHeader
        breadcrumbs={[
          { label: "Admin", href: "/admin/dashboard" },
          { label: "Operatsiya" },
          { label: "Oshxona" },
        ]}
        description="Faol ticketlar, kutish vaqti va ruxsat bo'lsa oshxona qadamlari"
        title="Oshxona monitoringi"
      />
      <AdminKitchenMonitor />
    </>
  );
}
