"use client";

import { useCallback, useEffect, useState } from "react";
import { AuthShell } from "../../../components/auth/auth-shell";
import { PermissionGuard } from "../../../components/auth/permission-guard";
import { RoleGuard } from "../../../components/auth/role-guard";
import { EmptyState, PrimaryButton } from "../../../components/erp/erp-ui";
import { apiFetch } from "../../../lib/api";

type PrinterType = "RECEIPT" | "KITCHEN" | "BAR" | "THERMAL" | "A4" | "OTHER";
type PrinterStatus = "ONLINE" | "OFFLINE" | "ERROR";
type Printer = {
  id: string;
  branchId: string;
  name: string;
  type: PrinterType;
  status: PrinterStatus;
  isActive: boolean;
  branch?: { name: string } | null;
};

const printerTypes: PrinterType[] = ["THERMAL", "A4", "RECEIPT", "KITCHEN", "BAR", "OTHER"];
const printerStatuses: PrinterStatus[] = ["ONLINE", "OFFLINE", "ERROR"];

export default function PrintersPage() {
  return (
    <RoleGuard roles={["SUPER_ADMIN", "ADMIN", "BRANCH_MANAGER"]}>
      <PermissionGuard permission="RECEIPT_PRINT">
        <AuthShell eyebrow="Hardware" title="Printers">
          <PrintersConsole />
        </AuthShell>
      </PermissionGuard>
    </RoleGuard>
  );
}

function PrintersConsole() {
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [branchId, setBranchId] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState<PrinterType>("THERMAL");

  const loadPrinters = useCallback(async () => {
    setPrinters(await apiFetch<Printer[]>(branchId ? `/printers?branchId=${branchId}` : "/printers"));
  }, [branchId]);

  useEffect(() => {
    void loadPrinters();
  }, [loadPrinters]);

  async function createPrinter() {
    await apiFetch("/printers", {
      method: "POST",
      body: JSON.stringify({ branchId, name, type, status: "ONLINE" }),
    });
    setName("");
    await loadPrinters();
  }

  async function updateStatus(printer: Printer, status: PrinterStatus) {
    await apiFetch(`/printers/${printer.id}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    await loadPrinters();
  }

  return (
    <section className="grid gap-6 xl:grid-cols-[380px_1fr]">
      <aside className="rounded-3xl border border-neutral-100 bg-white p-5 shadow-[0_14px_45px_rgba(17,24,39,0.08)]">
        <h2 className="text-xl font-semibold text-neutral-950">Add printer</h2>
        <div className="mt-4 grid gap-3">
          <input className="rounded-2xl border border-neutral-200 px-4 py-3 text-sm outline-none focus:border-emerald-500" placeholder="Branch ID" value={branchId} onChange={(event) => setBranchId(event.target.value)} />
          <input className="rounded-2xl border border-neutral-200 px-4 py-3 text-sm outline-none focus:border-emerald-500" placeholder="Printer name" value={name} onChange={(event) => setName(event.target.value)} />
          <select className="rounded-2xl border border-neutral-200 px-4 py-3 text-sm font-semibold outline-none focus:border-emerald-500" value={type} onChange={(event) => setType(event.target.value as PrinterType)}>
            {printerTypes.map((printerType) => (
              <option key={printerType} value={printerType}>{printerType}</option>
            ))}
          </select>
          <PrimaryButton onClick={() => void createPrinter()}>Create printer</PrimaryButton>
        </div>
      </aside>

      <div className="rounded-3xl border border-neutral-100 bg-white p-5 shadow-[0_14px_45px_rgba(17,24,39,0.08)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-neutral-950">Configured printers</h2>
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700">ESC/POS ready</span>
        </div>
        {printers.length ? (
          <div className="mt-5 overflow-hidden rounded-2xl border border-neutral-100">
            <table className="w-full text-left text-sm">
              <thead className="bg-neutral-50 text-neutral-500">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Branch</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {printers.map((printer) => (
                  <tr key={printer.id}>
                    <td className="px-4 py-3 font-semibold text-neutral-900">{printer.name}</td>
                    <td className="px-4 py-3 text-neutral-600">{printer.branch?.name ?? printer.branchId}</td>
                    <td className="px-4 py-3 text-neutral-600">{printer.type}</td>
                    <td className="px-4 py-3">
                      <select className="rounded-xl border border-neutral-200 px-3 py-2 text-sm font-semibold" value={printer.status} onChange={(event) => void updateStatus(printer, event.target.value as PrinterStatus)}>
                        {printerStatuses.map((status) => (
                          <option key={status} value={status}>{status}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No printers configured yet." />
        )}
      </div>
    </section>
  );
}
