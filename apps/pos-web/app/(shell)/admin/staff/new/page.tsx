"use client";

import { AdminStaffEditor } from "../../../../../components/admin/admin-staff";
import { AdminPageHeader } from "../../../../../components/admin-shell/admin-page-header";

export default function NewStaffPage() {
  return (
    <>
      <AdminPageHeader
        breadcrumbs={[{ label: "Admin", href: "/admin/dashboard" }, { label: "Xodimlar", href: "/admin/staff" }, { label: "Yangi" }]}
        description="Yangi xodim yaratish va rol biriktirish"
        title="Yangi xodim"
      />
      <AdminStaffEditor />
    </>
  );
}
