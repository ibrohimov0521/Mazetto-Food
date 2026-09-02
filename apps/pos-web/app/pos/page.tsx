"use client";

import Link from "next/link";
import { AuthShell, DashboardCards } from "../../components/auth/auth-shell";
import { PermissionGuard } from "../../components/auth/permission-guard";
import { RoleGuard } from "../../components/auth/role-guard";

export default function PosPage() {
  return (
    <RoleGuard roles={["CASHIER", "SUPER_ADMIN", "BRANCH_MANAGER"]}>
      <PermissionGuard permission="POS_USE">
        <AuthShell eyebrow="Kassa ish joyi" title="POS">
          <DashboardCards
            items={[
              { label: "Buyurtmalar", value: "Yaratish" },
              { label: "To'lovlar", value: "Qabul qilish" },
              { label: "Menyu tahriri", value: "Cheklangan" },
            ]}
          />
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <PosLink href="/pos/payment" title="To'lov terminali" description="Naqd, karta va aralash to'lovlarni qabul qilish." />
            <PosLink href="/pos/shifts" title="Kassa smenasi" description="Smenani ochish, pul harakatlari va topshirishni kuzatish." />
          </div>
        </AuthShell>
      </PermissionGuard>
    </RoleGuard>
  );
}

function PosLink({ description, href, title }: { description: string; href: string; title: string }) {
  return (
    <Link className="rounded-3xl border border-neutral-100 bg-white p-5 shadow-[0_14px_45px_rgba(17,24,39,0.08)] transition hover:border-emerald-300 hover:bg-emerald-50" href={href}>
      <h2 className="text-lg font-semibold text-neutral-950">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-neutral-500">{description}</p>
    </Link>
  );
}
