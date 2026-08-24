"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { AuthShell } from "../../../components/auth/auth-shell";
import { PermissionGuard } from "../../../components/auth/permission-guard";
import { RoleGuard } from "../../../components/auth/role-guard";
import { EmptyState, ErpPageShell, PrimaryButton, TextInput } from "../../../components/erp/erp-ui";
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
        <AuthShell eyebrow="Table management" title="Restaurant floor">
          <TableManagement />
        </AuthShell>
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
    <ErpPageShell
      title="Tables and halls"
      subtitle="Create halls, manage table capacity, and keep the restaurant floor status visible for service teams."
    >
      <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
        <aside className="grid gap-4">
          <section className="rounded-3xl border border-neutral-100 bg-white p-5 shadow-[0_14px_45px_rgba(17,24,39,0.08)]">
            <label className="grid gap-2 text-sm font-semibold text-neutral-700">
              Branch ID
              <TextInput value={branchId} onChange={(event) => setBranchId(event.target.value)} placeholder="Required branch id" />
            </label>
          </section>

          <form className="grid gap-3 rounded-3xl border border-neutral-100 bg-white p-5 shadow-[0_14px_45px_rgba(17,24,39,0.08)]" onSubmit={createHall}>
            <h3 className="font-semibold text-neutral-950">Create hall</h3>
            <TextInput value={hallName} onChange={(event) => setHallName(event.target.value)} placeholder="Main Hall" required />
            <PrimaryButton type="submit">Add hall</PrimaryButton>
          </form>

          <form className="grid gap-3 rounded-3xl border border-neutral-100 bg-white p-5 shadow-[0_14px_45px_rgba(17,24,39,0.08)]" onSubmit={createTable}>
            <h3 className="font-semibold text-neutral-950">Create table</h3>
            <select className="rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-950 outline-none" value={hallId} onChange={(event) => setHallId(event.target.value)} required>
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
            <PrimaryButton type="submit">Add table</PrimaryButton>
          </form>
        </aside>

        <section className="rounded-3xl border border-neutral-100 bg-white p-5 shadow-[0_14px_45px_rgba(17,24,39,0.08)]">
          <div className="mb-5 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-neutral-950">Floor layout</h3>
            <span className="text-sm font-medium text-neutral-500">Drag-ready card grid</span>
          </div>
          {tables.length ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {tables.map((table) => (
                <article className="cursor-grab rounded-3xl border border-neutral-100 bg-white p-5 shadow-[0_12px_36px_rgba(17,24,39,0.08)] active:cursor-grabbing" draggable key={table.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase text-emerald-700">{table.hall?.name ?? "No hall"}</p>
                      <h4 className="mt-2 text-xl font-semibold text-neutral-950">{table.name}</h4>
                      <p className="mt-1 text-sm text-neutral-500">{table.capacity ?? 0} seats</p>
                    </div>
                    <StatusBadge status={table.status} />
                  </div>
                  <div className="mt-5 grid grid-cols-2 gap-2">
                    {(["AVAILABLE", "RESERVED", "CLEANING", "OCCUPIED"] as TableStatus[]).map((nextStatus) => (
                      <button className="rounded-2xl border border-neutral-200 px-3 py-2 text-xs font-semibold text-neutral-700 hover:bg-emerald-50" key={nextStatus} onClick={() => void setStatus(table.id, nextStatus)} type="button">
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
    </ErpPageShell>
  );
}

function StatusBadge({ status }: { status: TableStatus }) {
  const colors: Record<TableStatus, string> = {
    AVAILABLE: "bg-emerald-50 text-emerald-700",
    OCCUPIED: "bg-red-50 text-red-700",
    RESERVED: "bg-yellow-50 text-yellow-700",
    CLEANING: "bg-neutral-100 text-neutral-700",
  };

  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${colors[status]}`}>{status}</span>;
}
