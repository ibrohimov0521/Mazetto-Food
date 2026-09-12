"use client";

import { AdminDashboard } from "../../../components/admin/admin-dashboard";
import { AdminPageHeader } from "../../../components/admin-shell/admin-page-header";
import { useAuth } from "../../../components/auth/auth-provider";
import { ButtonLink } from "../../../components/admin-ui/button";
import { Card, CardBody, CardHeader } from "../../../components/admin-ui/card";
import { hasPermission, hasRole } from "../../../lib/auth";

/*
 * ACCOUNTANT uchun login'dan keyingi asosiy sahifa (RBAC JSON default_route).
 *
 * Ilgari bu sahifa navigatsiyasiz, soxta inglizcha kartochkalar ko'rsatardi —
 * buxgalter o'zining asosiy ishi bo'lgan `/admin/reports` ga o'tolmasdi.
 *
 * ACCOUNTANT global scope'ga ega, lekin `MENU_VIEW` yo'q — shuning uchun
 * `AdminDashboard` katalog blokini avtomatik yashiradi va tezkor havolalardan
 * faqat ruxsat berilganlari qoladi.
 *
 * Pastdagi havolalar ro'yxati AYNAN pul yo'li ekranlari uchun: ular
 * `lib/route-access.ts` dagi qoidalar bilan bir xil shartda ko'rsatiladi,
 * ya'ni ochilmaydigan havola chizilmaydi. Buxgalterda `SHIFT_VIEW_BRANCH`
 * yo'q va `/admin/shifts` uning roli uchun ochiq emas, shuning uchun
 * smenalar havolasi ro'yxatda yo'q — u faqat "ruxsat yo'q" sahifasiga
 * olib borardi.
 */

type MoneyLink = {
  href: string;
  title: string;
  description: string;
  roles: string[];
  permission: string;
};

const SUPER = "SUPER_ADMIN";
const ADMIN = "ADMIN";
const MANAGER = "BRANCH_MANAGER";
const ACCOUNTANT = "ACCOUNTANT";

const moneyLinks: MoneyLink[] = [
  {
    href: "/admin/reports",
    title: "Hisobotlar",
    description: "Savdo, mahsulot, xodim, xarajat va Z-hisobot",
    roles: [SUPER, ADMIN, MANAGER, ACCOUNTANT],
    permission: "REPORT_SALES_VIEW",
  },
  {
    href: "/admin/payments",
    title: "To'lovlar",
    description: "Barcha kanallar bo'yicha to'lov daftari",
    roles: [SUPER, MANAGER, ACCOUNTANT],
    permission: "PAYMENT_VIEW",
  },
  {
    href: "/admin/receipts",
    title: "Cheklar",
    description: "Chop etilgan va chop etilmagan cheklar",
    roles: [SUPER, MANAGER, ACCOUNTANT],
    permission: "RECEIPT_VIEW",
  },
  {
    href: "/admin/expenses",
    title: "Xarajatlar",
    description: "Filial xarajatlari va smena kassa hisobi",
    roles: [SUPER, ADMIN, MANAGER, ACCOUNTANT],
    permission: "REPORT_EXPENSES_VIEW",
  },
  {
    href: "/admin/shifts",
    title: "Smenalar",
    description: "Kutilgan, topshirilgan naqd va farq",
    roles: [SUPER, MANAGER],
    permission: "SHIFT_VIEW_BRANCH",
  },
];

export default function AccountingPage() {
  const { user } = useAuth();
  const visibleLinks = moneyLinks.filter(
    (link) => hasRole(user, link.roles) && hasPermission(user, link.permission),
  );

  return (
    <>
      <AdminPageHeader
        breadcrumbs={[{ label: "Buxgalteriya" }, { label: "Umumiy" }]}
        description="Barcha filiallar bo'yicha bugungi moliyaviy ko'rsatkichlar"
        title="Buxgalteriya"
      />

      <div className="grid gap-5">
        {visibleLinks.length > 0 ? (
          <Card>
            <CardHeader
              description="Sizning ruxsatingiz bo'yicha ochiladigan bo'limlar"
              title="Pul va hisobot bo'limlari"
            />
            <CardBody>
              <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {visibleLinks.map((link) => (
                  <li
                    className="flex flex-col gap-2 rounded-mz-control border border-mz-border bg-mz-surface-sunken p-3"
                    key={link.href}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-mz-text">
                        {link.title}
                      </p>
                      <p className="text-[13px] text-mz-text-muted">
                        {link.description}
                      </p>
                    </div>
                    <ButtonLink
                      className="w-full"
                      href={link.href}
                      variant="secondary"
                    >
                      Ochish
                    </ButtonLink>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        ) : null}

        <AdminDashboard />
      </div>
    </>
  );
}
