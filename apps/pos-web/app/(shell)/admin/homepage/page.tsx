"use client";

import { AdminHomepagePage } from "../../../../components/admin/admin-homepage";
import { AdminPageHeader } from "../../../../components/admin-shell/admin-page-header";

export default function HomepageContentPage() {
  return (
    <>
      <AdminPageHeader
        breadcrumbs={[
          { label: "Admin", href: "/admin/dashboard" },
          { label: "Katalog" },
          { label: "Bosh sahifa" },
        ]}
        description="Mijoz saytining hero slaydlari va aksiyalari — o'zgarishlar darhol ko'rinadi"
        title="Bosh sahifa va aksiyalar"
      />
      <AdminHomepagePage />
    </>
  );
}
