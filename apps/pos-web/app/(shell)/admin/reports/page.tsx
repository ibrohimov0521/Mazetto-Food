"use client";

import { AdminReportsPage } from "../../../../components/admin/admin-reports";
import { AdminPageHeader } from "../../../../components/admin-shell/admin-page-header";

export default function ReportsPage() {
  return (
    <>
      <AdminPageHeader
        /*
         * Sarlavha endi umumiy: ekranda beshta hisobot tabi bor
         * (savdo, mahsulot, xodim, xarajat, Z), shuning uchun "Savdo
         * hisoboti" deb nomlash boshqa to'rttasini yashirib qo'yardi.
         */
        breadcrumbs={[
          { label: "Admin", href: "/admin/dashboard" },
          { label: "Hisobotlar" },
        ]}
        description="Sana oralig'i bo'yicha savdo, mahsulot, xodim, xarajat va Z-hisobot"
        title="Hisobotlar"
      />
      <AdminReportsPage />
    </>
  );
}
