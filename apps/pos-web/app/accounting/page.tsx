"use client";

import { AdminDashboard } from "../../components/admin/admin-dashboard";
import { AdminLayout } from "../../components/admin-shell/admin-layout";
import { AdminPageHeader } from "../../components/admin-shell/admin-page-header";
import { RoleGuard } from "../../components/auth/role-guard";

/*
 * ACCOUNTANT uchun login'dan keyingi asosiy sahifa (RBAC JSON default_route).
 *
 * Ilgari bu sahifa navigatsiyasiz, soxta inglizcha kartochkalar ko'rsatardi —
 * buxgalter o'zining asosiy ishi bo'lgan `/admin/reports` ga o'tolmasdi.
 *
 * ACCOUNTANT global scope'ga ega, lekin `MENU_VIEW` yo'q — shuning uchun
 * `AdminDashboard` katalog blokini avtomatik yashiradi va tezkor havolalardan
 * faqat ruxsat berilganlari qoladi.
 */
export default function AccountingPage() {
  return (
    <RoleGuard roles={["ACCOUNTANT", "SUPER_ADMIN"]}>
      <AdminLayout>
        <AdminPageHeader
          breadcrumbs={[{ label: "Buxgalteriya" }, { label: "Umumiy" }]}
          description="Barcha filiallar bo'yicha bugungi moliyaviy ko'rsatkichlar"
          title="Buxgalteriya"
        />
        <AdminDashboard />
      </AdminLayout>
    </RoleGuard>
  );
}
