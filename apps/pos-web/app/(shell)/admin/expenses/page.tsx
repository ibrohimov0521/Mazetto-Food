"use client";

import { AdminExpensesPage } from "../../../../components/admin/admin-expenses";
import { AdminPageHeader } from "../../../../components/admin-shell/admin-page-header";

export default function ExpensesPage() {
  return (
    <>
      <AdminPageHeader
        breadcrumbs={[
          { label: "Admin", href: "/admin/dashboard" },
          { label: "Kassa va moliya" },
          { label: "Xarajatlar" },
        ]}
        description="Filial xarajatlari va smena kassa hisobiga bog'lash"
        title="Xarajatlar"
      />
      <AdminExpensesPage />
    </>
  );
}
