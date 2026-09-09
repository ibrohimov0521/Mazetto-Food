"use client";

import { AdminDashboard } from "../../../../components/admin/admin-dashboard";
import { AdminPageHeader } from "../../../../components/admin-shell/admin-page-header";

export default function AdminDashboardPage() {
  return (
    <>
      <AdminPageHeader
        breadcrumbs={[{ label: "Admin" }, { label: "Dashboard" }]}
        description="Bugungi operatsion ko'rsatkichlar va katalog holati"
        title="MAZETTO boshqaruvi"
      />
      <AdminDashboard />
    </>
  );
}
