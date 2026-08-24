"use client";

import { useEffect, useState } from "react";
import { AuthShell } from "../../../../components/auth/auth-shell";
import { PermissionGuard } from "../../../../components/auth/permission-guard";
import { RoleGuard } from "../../../../components/auth/role-guard";
import { EmptyState, PrimaryButton } from "../../../../components/erp/erp-ui";
import { apiFetch } from "../../../../lib/api";

type Receipt = {
  id: string;
  receiptNumber: string;
  total: string;
  printed: boolean;
  printedAt?: string | null;
  createdAt: string;
  branch: { name: string; address?: string | null; phone?: string | null };
  order: {
    orderNumber: string;
    items: { id: string; productName: string; variantName?: string | null; quantity: string; totalPrice: string }[];
    payments: { id: string; amount: string; method: { code: string; name: string }; acceptedBy?: { firstName: string; lastName: string } | null }[];
  };
};

export default function ReceiptPage({ params }: { params: { id: string } }) {
  return (
    <RoleGuard roles={["CASHIER", "BRANCH_MANAGER", "SUPER_ADMIN"]}>
      <PermissionGuard permission="RECEIPT_VIEW">
        <AuthShell eyebrow="Receipt" title="Receipt preview">
          <ReceiptPreview id={params.id} />
        </AuthShell>
      </PermissionGuard>
    </RoleGuard>
  );
}

function ReceiptPreview({ id }: { id: string }) {
  const [receipt, setReceipt] = useState<Receipt | null>(null);

  async function load() {
    setReceipt(await apiFetch<Receipt>(`/receipts/${id}`));
  }

  useEffect(() => {
    void load();
  }, [id]);

  async function markPrinted() {
    setReceipt(await apiFetch<Receipt>(`/receipts/${id}/print`, { method: "PATCH" }));
  }

  if (!receipt) {
    return <EmptyState title="Receipt is loading." />;
  }

  return (
    <section className="grid gap-6 lg:grid-cols-[420px_1fr]">
      <article className="rounded-3xl border border-neutral-100 bg-white p-6 shadow-[0_14px_45px_rgba(17,24,39,0.08)]">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-neutral-950">MAZETTO FOOD</h2>
          <p className="mt-1 text-sm text-neutral-500">{receipt.branch.name}</p>
          <p className="text-sm text-neutral-500">{receipt.branch.phone ?? ""}</p>
        </div>
        <div className="my-5 border-t border-dashed border-neutral-300" />
        <div className="grid gap-1 text-sm text-neutral-600">
          <p>Receipt: <span className="font-semibold text-neutral-950">{receipt.receiptNumber}</span></p>
          <p>Order: <span className="font-semibold text-neutral-950">{receipt.order.orderNumber}</span></p>
          <p>Date: {new Date(receipt.createdAt).toLocaleString()}</p>
        </div>
        <div className="my-5 border-t border-dashed border-neutral-300" />
        <div className="grid gap-3">
          {receipt.order.items.map((item) => (
            <div className="flex justify-between gap-4 text-sm" key={item.id}>
              <span className="font-semibold text-neutral-800">{formatQuantity(item.quantity)}x {item.productName} {item.variantName ?? ""}</span>
              <span className="text-neutral-600">{formatMoney(item.totalPrice)}</span>
            </div>
          ))}
        </div>
        <div className="my-5 border-t border-dashed border-neutral-300" />
        <div className="grid gap-2 text-sm">
          {receipt.order.payments.map((payment) => (
            <div className="flex justify-between" key={payment.id}>
              <span className="text-neutral-600">{payment.method.name}</span>
              <span className="font-semibold text-neutral-950">{formatMoney(payment.amount)}</span>
            </div>
          ))}
        </div>
        <div className="mt-5 flex justify-between rounded-2xl bg-emerald-50 px-4 py-3 text-lg font-bold text-neutral-950">
          <span>Total</span>
          <span>{formatMoney(receipt.total)}</span>
        </div>
      </article>

      <aside className="rounded-3xl border border-neutral-100 bg-white p-5 shadow-[0_14px_45px_rgba(17,24,39,0.08)]">
        <h2 className="text-xl font-semibold text-neutral-950">Print status</h2>
        <p className="mt-2 text-sm text-neutral-500">
          {receipt.printed ? `Printed ${receipt.printedAt ? new Date(receipt.printedAt).toLocaleString() : ""}` : "Not printed yet"}
        </p>
        <div className="mt-5">
          <PrimaryButton onClick={() => void markPrinted()}>Mark printed</PrimaryButton>
        </div>
      </aside>
    </section>
  );
}

function formatMoney(value: string | number): string {
  return `${Number(value || 0).toLocaleString("uz-UZ")} UZS`;
}

function formatQuantity(value: string): string {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? String(parsed) : parsed.toFixed(2);
}
