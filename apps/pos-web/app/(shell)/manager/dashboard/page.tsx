"use client";

import { AdminDashboard } from "../../../../components/admin/admin-dashboard";
import { AdminPageHeader } from "../../../../components/admin-shell/admin-page-header";

/*
 * BRANCH_MANAGER uchun login'dan keyingi asosiy sahifa (RBAC JSON default_route).
 *
 * Ilgari bu sahifa `/admin/dashboard` VA `/accounting` bilan AYNAN bir xil
 * komponentni chizardi — uchta sahifa, bitta ko'rinish. Endi menejer
 * kompozitsiyasi berilgan (`variant="manager"`):
 *
 *   - filial tanlagichi YO'Q: BRANCH_MANAGER branch-scoped rol, backend
 *     baribir uni o'z filialiga qisqartiradi va tanlagich yolg'on bo'lardi;
 *   - ochiq kassa smenalari jadvali bor — menejerning kunlik ishi aynan shu,
 *     va u "bitta xodim = bitta umumiy kassa" qoidasini ko'rinadigan qiladi;
 *   - filial tayyorligi bloki bor: buyurtma qabuli, ish vaqti, xodim va
 *     kassa qurilmasi soni;
 *   - filiallar o'rtasidagi taqsimot YO'Q — bitta filial uchun ma'nosiz.
 */
export default function ManagerDashboardPage() {
  return (
    <>
      <AdminPageHeader
        breadcrumbs={[{ label: "Menejer" }, { label: "Dashboard" }]}
        description="Biriktirilgan filial bo'yicha savdo, ochiq smenalar va tayyorlik holati"
        title="Filial boshqaruvi"
      />
      <AdminDashboard variant="manager" />
    </>
  );
}
