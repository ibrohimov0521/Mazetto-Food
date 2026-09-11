"use client";

import { AdminShiftsPage } from "../../../../components/admin/admin-shifts";
import { AdminPageHeader } from "../../../../components/admin-shell/admin-page-header";

export default function AdminShiftsPageRoute() {
  return (
    <>
      <AdminPageHeader
        breadcrumbs={[
          { label: "Admin", href: "/admin/dashboard" },
          { label: "Kassa va moliya" },
          { label: "Smenalar" },
        ]}
        description="Xodimlarning umumiy kassasi va smena solishtiruvi"
        title="Smenalar"
      />
      <AdminShiftsPage />
    </>
  );
}
