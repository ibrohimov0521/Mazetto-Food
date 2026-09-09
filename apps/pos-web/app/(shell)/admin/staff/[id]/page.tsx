"use client";

import { useParams } from "next/navigation";
import { AdminStaffEditor } from "../../../../../components/admin/admin-staff";
import { AdminPageHeader } from "../../../../../components/admin-shell/admin-page-header";

export default function StaffDetailPage() {
  const params = useParams<{ id: string }>();

  return (
    <>
      <AdminPageHeader
        breadcrumbs={[{ label: "Admin", href: "/admin/dashboard" }, { label: "Xodimlar", href: "/admin/staff" }, { label: "Profil" }]}
        description="Xodim ma'lumotlari, roli va holati"
        title="Xodim profili"
      />
      <AdminStaffEditor staffId={params.id} />
    </>
  );
}
