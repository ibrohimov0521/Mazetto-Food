"use client";

import { AdminProductsPage } from "../../../../components/admin/admin-catalog";
import { AdminPageHeader } from "../../../../components/admin-shell/admin-page-header";
import { ButtonLink } from "../../../../components/admin-ui/button";
import { hasPermission } from "../../../../lib/auth";
import { useAuth } from "../../../../components/auth/auth-provider";

export default function ProductsPage() {
  const { user } = useAuth();

  return (
    <>
      <AdminPageHeader
        breadcrumbs={[
          { label: "Admin", href: "/admin/dashboard" },
          { label: "Katalog" },
          { label: "Mahsulotlar" },
        ]}
        description="Narx, holat, katalog ko'rinishi va set tarkibi"
        title="Mahsulotlar"
        {...(hasPermission(user, "MENU_CREATE")
          ? {
              /*
               * Yagona asosiy harakat sahifa sarlavhasida turadi — ilgari u
               * filtr qatorining oxirida, filtr maydonlari orasida edi.
               */
              actions: (
                <ButtonLink href="/admin/products/new" size="lg">
                  Yangi mahsulot
                </ButtonLink>
              ),
            }
          : {})}
      />
      <AdminProductsPage />
    </>
  );
}
