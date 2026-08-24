"use client";

import Link from "next/link";
import { AuthShell, DashboardCards } from "../../components/auth/auth-shell";
import { RoleGuard } from "../../components/auth/role-guard";

export default function PosPage() {
  return (
    <RoleGuard roles={["CASHIER", "SUPER_ADMIN", "BRANCH_MANAGER"]}>
      <AuthShell eyebrow="Cashier workspace" title="POS">
        <DashboardCards
          items={[
            { label: "Orders", value: "Create" },
            { label: "Payments", value: "Receive" },
            { label: "Menu editing", value: "Restricted" },
          ]}
        />
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <PosLink href="/pos/payment" title="Payment terminal" description="Receive cash, card, Click, Payme, and mixed payments." />
          <PosLink href="/pos/shifts" title="Cash drawer" description="Open shifts, track drawer movements, and close the day." />
          <PosLink href="/admin/printers" title="Printers" description="Configure receipt printers and device status." />
        </div>
      </AuthShell>
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
