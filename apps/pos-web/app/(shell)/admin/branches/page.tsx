"use client";

import { AdminBranchesPage } from "../../../../components/admin/admin-branches";
import { AdminPageHeader } from "../../../../components/admin-shell/admin-page-header";

export default function BranchesPage() {
  return (
    <>
      <AdminPageHeader
        breadcrumbs={[
          { label: "Admin", href: "/admin/dashboard" },
          { label: "Sozlamalar" },
          { label: "Filiallar" },
        ]}
        description="Filial holati, ish vaqti va buyurtma qabuli"
        title="Filiallar"
      />
      <AdminBranchesPage />
    </>
  );
}
