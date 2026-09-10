"use client";

import { AdminCouriersPage } from "../../../../components/admin/admin-couriers";
import { AdminPageHeader } from "../../../../components/admin-shell/admin-page-header";

export default function CouriersPage() {
  return (
    <>
      <AdminPageHeader
        breadcrumbs={[
          { label: "Admin", href: "/admin/dashboard" },
          { label: "Operatsiya" },
          { label: "Kuryerlar" },
        ]}
        description="Kim nima olib ketyapti va biriktirishni o'zgartirish"
        title="Kuryerlar"
      />
      <AdminCouriersPage />
    </>
  );
}
