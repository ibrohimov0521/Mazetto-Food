"use client";

import { AdminStaffPage } from "../../../../components/admin/admin-staff";
import { AdminPageHeader } from "../../../../components/admin-shell/admin-page-header";

export default function StaffPage() {
  return (
    <>
      <AdminPageHeader
        breadcrumbs={[{ label: "Admin", href: "/admin/dashboard" }, { label: "Odamlar" }, { label: "Xodimlar" }]}
        description="Rol, filial, parol reset va bloklash"
        title="Xodimlar"
      />
      <AdminStaffPage />
    </>
  );
}
