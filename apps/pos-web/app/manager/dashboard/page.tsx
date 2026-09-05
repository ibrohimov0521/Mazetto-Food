"use client";

import { AdminDashboard } from "../../../components/admin/admin-dashboard";
import { AdminLayout } from "../../../components/admin-shell/admin-layout";
import { AdminPageHeader } from "../../../components/admin-shell/admin-page-header";
import { RoleGuard } from "../../../components/auth/role-guard";

/*
 * BRANCH_MANAGER uchun login'dan keyingi asosiy sahifa (RBAC JSON default_route).
 *
 * Ilgari bu sahifa navigatsiyasiz, soxta inglizcha kartochkalar ko'rsatardi —
 * menejer bu yerdan hech qayerga o'tolmasdi. Endi admin qobig'i va haqiqiy
 * operatsion ko'rsatkichlar bilan ishlaydi; menyu permission bo'yicha filtrlanadi.
 */
export default function ManagerDashboardPage() {
  return (
    <RoleGuard roles={["BRANCH_MANAGER", "SUPER_ADMIN"]}>
      <AdminLayout>
        <AdminPageHeader
          breadcrumbs={[{ label: "Menejer" }, { label: "Dashboard" }]}
          description="Biriktirilgan filial bo'yicha bugungi ko'rsatkichlar"
          title="Filial boshqaruvi"
        />
        <AdminDashboard />
      </AdminLayout>
    </RoleGuard>
  );
}
