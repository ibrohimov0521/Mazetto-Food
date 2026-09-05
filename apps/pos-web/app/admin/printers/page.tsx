"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminLayout } from "../../../components/admin-shell/admin-layout";
import { AdminPageHeader } from "../../../components/admin-shell/admin-page-header";
import { PermissionGuard } from "../../../components/auth/permission-guard";
import { RoleGuard } from "../../../components/auth/role-guard";
import { Button } from "../../../components/admin-ui/button";
import { EmptyState } from "../../../components/admin-ui/feedback";
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
        <AdminLayout>
          <AdminPageHeader
            breadcrumbs={[{ label: "Admin", href: "/admin/dashboard" }, { label: "Sozlamalar" }, { label: "Printerlar" }]}
            description="Chek va oshxona printerlarini boshqarish"
            title="Printerlar"
          />
          <PrintersConsole />
        </AdminLayout>
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
      <aside className="rounded-mz-card border border-mz-border bg-mz-surface p-5 shadow-mz-card">
        <h2 className="text-xl font-semibold text-mz-text">Add printer</h2>
        <div className="mt-4 grid gap-3">
          <input className="rounded-mz-control border border-mz-border px-4 py-3 text-sm outline-none focus:border-mz-accent" placeholder="Branch ID" value={branchId} onChange={(event) => setBranchId(event.target.value)} />
          <input className="rounded-mz-control border border-mz-border px-4 py-3 text-sm outline-none focus:border-mz-accent" placeholder="Printer name" value={name} onChange={(event) => setName(event.target.value)} />
          <select className="rounded-mz-control border border-mz-border px-4 py-3 text-sm font-semibold outline-none focus:border-mz-accent" value={type} onChange={(event) => setType(event.target.value as PrinterType)}>
            {printerTypes.map((printerType) => (
              <option key={printerType} value={printerType}>{printerType}</option>
            ))}
          </select>
          <Button onClick={() => void createPrinter()}>Create printer</Button>
        </div>
      </aside>

      <div className="rounded-mz-card border border-mz-border bg-mz-surface p-5 shadow-mz-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-mz-text">Configured printers</h2>
          <span className="rounded-full bg-mz-info-bg px-3 py-1 text-sm font-semibold text-mz-info">ESC/POS ready</span>
        </div>
        {printers.length ? (
          <div className="mt-5 overflow-hidden rounded-mz-control border border-mz-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-mz-surface-sunken text-mz-text-muted">
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
                    <td className="px-4 py-3 font-semibold text-mz-text">{printer.name}</td>
                    <td className="px-4 py-3 text-mz-text-muted">{printer.branch?.name ?? printer.branchId}</td>
                    <td className="px-4 py-3 text-mz-text-muted">{printer.type}</td>
                    <td className="px-4 py-3">
                      <select className="rounded-mz-control border border-mz-border px-3 py-2 text-sm font-semibold" value={printer.status} onChange={(event) => void updateStatus(printer, event.target.value as PrinterStatus)}>
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
