"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { AdminLayout } from "../../../components/admin-shell/admin-layout";
import { AdminPageHeader } from "../../../components/admin-shell/admin-page-header";
import { PermissionGuard } from "../../../components/auth/permission-guard";
import { RoleGuard } from "../../../components/auth/role-guard";
import { Button } from "../../../components/admin-ui/button";
import { TextInput } from "../../../components/admin-ui/form";
import { EmptyState } from "../../../components/admin-ui/feedback";
import { apiFetch } from "../../../lib/api";

type TableStatus = "AVAILABLE" | "OCCUPIED" | "RESERVED" | "CLEANING";
type Table = {
  id: string;
  branchId: string;
  hallId: string | null;
  number: number | null;
  name: string;
  capacity: number | null;
  status: TableStatus;
  hall?: { id: string; name: string } | null;
};

export default function AdminTablesPage() {
  return (
    <RoleGuard roles={["SUPER_ADMIN", "BRANCH_MANAGER"]}>
      <PermissionGuard permission="TABLE_VIEW">
        <AdminLayout>
          <AdminPageHeader
            breadcrumbs={[{ label: "Admin", href: "/admin/dashboard" }, { label: "Operatsiya" }, { label: "Stollar" }]}
            description="Zal tuzilmasi va stol holati"
            title="Stollar va zallar"
          />
          <TableManagement />
        </AdminLayout>
      </PermissionGuard>
    </RoleGuard>
  );
}

function TableManagement() {
  const [tables, setTables] = useState<Table[]>([]);
  const [branchId, setBranchId] = useState("");
  const [hallName, setHallName] = useState("");
  const [hallId, setHallId] = useState("");
  const [tableName, setTableName] = useState("");
  const [number, setNumber] = useState("1");
  const [capacity, setCapacity] = useState("4");

  async function load() {
    const path = branchId ? `/tables?branchId=${encodeURIComponent(branchId)}` : "/tables";
    setTables(await apiFetch<Table[]>(path));
  }

  useEffect(() => {
    void load();
  }, []);

  const halls = useMemo(
    () =>
      [...new Map(tables.flatMap((table) => (table.hall ? [[table.hall.id, table.hall]] : []))).values()],
    [tables],
  );

  async function createHall(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await apiFetch("/halls", {
      method: "POST",
      body: JSON.stringify({ branchId, name: hallName }),
    });
    setHallName("");
    await load();
  }

  async function createTable(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await apiFetch("/tables", {
      method: "POST",
      body: JSON.stringify({
        branchId,
        hallId,
        number: Number(number),
        name: tableName,
        capacity: Number(capacity),
      }),
    });
    setTableName("");
    await load();
  }

  async function setStatus(tableId: string, status: TableStatus) {
    await apiFetch(`/tables/${tableId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    await load();
  }

  return (
    <section className="grid gap-5">
      <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
        <aside className="grid gap-4">
          <section className="rounded-mz-card border border-mz-border bg-mz-surface p-5 shadow-mz-card">
            <label className="grid gap-2 text-sm font-semibold text-mz-text">
              Branch ID
              <TextInput value={branchId} onChange={(event) => setBranchId(event.target.value)} placeholder="Required branch id" />
            </label>
          </section>

          <form className="grid gap-3 rounded-mz-card border border-mz-border bg-mz-surface p-5 shadow-mz-card" onSubmit={createHall}>
            <h3 className="font-semibold text-mz-text">Create hall</h3>
            <TextInput value={hallName} onChange={(event) => setHallName(event.target.value)} placeholder="Main Hall" required />
            <Button type="submit">Add hall</Button>
          </form>

          <form className="grid gap-3 rounded-mz-card border border-mz-border bg-mz-surface p-5 shadow-mz-card" onSubmit={createTable}>
            <h3 className="font-semibold text-mz-text">Create table</h3>
            <select className="rounded-mz-control border border-mz-border bg-mz-surface px-4 py-3 text-sm text-mz-text outline-none" value={hallId} onChange={(event) => setHallId(event.target.value)} required>
              <option value="">Select hall</option>
              {halls.map((hall) => (
                <option key={hall.id} value={hall.id}>{hall.name}</option>
              ))}
            </select>
            <TextInput value={tableName} onChange={(event) => setTableName(event.target.value)} placeholder="Table 1" required />
            <div className="grid grid-cols-2 gap-3">
              <TextInput value={number} onChange={(event) => setNumber(event.target.value)} type="number" min="1" placeholder="Number" />
              <TextInput value={capacity} onChange={(event) => setCapacity(event.target.value)} type="number" min="1" placeholder="Capacity" />
            </div>
            <Button type="submit">Add table</Button>
          </form>
        </aside>

        <section className="rounded-mz-card border border-mz-border bg-mz-surface p-5 shadow-mz-card">
          <div className="mb-5 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-mz-text">Floor layout</h3>
            <span className="text-sm font-medium text-mz-text-muted">Drag-ready card grid</span>
          </div>
          {tables.length ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {tables.map((table) => (
                <article className="cursor-grab rounded-mz-card border border-mz-border bg-mz-surface p-5 shadow-mz-card active:cursor-grabbing" draggable key={table.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase text-mz-info">{table.hall?.name ?? "No hall"}</p>
                      <h4 className="mt-2 text-xl font-semibold text-mz-text">{table.name}</h4>
                      <p className="mt-1 text-sm text-mz-text-muted">{table.capacity ?? 0} seats</p>
                    </div>
                    <StatusBadge status={table.status} />
                  </div>
                  <div className="mt-5 grid grid-cols-2 gap-2">
                    {(["AVAILABLE", "RESERVED", "CLEANING", "OCCUPIED"] as TableStatus[]).map((nextStatus) => (
                      <button className="rounded-mz-control border border-mz-border px-3 py-2 text-xs font-semibold text-mz-text hover:bg-mz-info-bg" key={nextStatus} onClick={() => void setStatus(table.id, nextStatus)} type="button">
                        {nextStatus}
                      </button>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState title="No tables yet. Add a hall and table to start the floor plan." />
          )}
        </section>
      </div>
    </section>
  );
}

function StatusBadge({ status }: { status: TableStatus }) {
  const colors: Record<TableStatus, string> = {
    AVAILABLE: "bg-mz-info-bg text-mz-info",
    OCCUPIED: "bg-mz-danger-bg text-mz-danger",
    RESERVED: "bg-mz-warning-bg text-mz-warning",
    CLEANING: "bg-mz-surface-sunken text-mz-text",
  };

  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${colors[status]}`}>{status}</span>;
}
