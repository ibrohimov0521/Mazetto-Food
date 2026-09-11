"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { AdminPageHeader } from "../../../../components/admin-shell/admin-page-header";
import { Button } from "../../../../components/admin-ui/button";
import { Card, CardHeader } from "../../../../components/admin-ui/card";
import { EmptyState, ErrorState } from "../../../../components/admin-ui/feedback";
import { FormField, Select, TextInput } from "../../../../components/admin-ui/form";
import { useToast } from "../../../../components/admin-ui/toast";
import { apiFetch, SessionExpiredError } from "../../../../lib/api";

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
type Branch = {
  id: string;
  name: string;
  address?: string | null;
};

const statusLabels: Record<TableStatus, string> = {
  AVAILABLE: "Bo'sh",
  OCCUPIED: "Band",
  RESERVED: "Bron qilingan",
  CLEANING: "Tozalanmoqda",
};

export default function AdminTablesPage() {
  return (
    <>
      <AdminPageHeader
        breadcrumbs={[{ label: "Admin", href: "/admin/dashboard" }, { label: "Operatsiya" }, { label: "Stollar" }]}
        description="Zal tuzilmasi va stol holati"
        title="Stollar va zallar"
      />
      <TableManagement />
    </>
  );
}

function TableManagement() {
  const { showToast } = useToast();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [branchId, setBranchId] = useState("");
  const [hallName, setHallName] = useState("");
  const [hallId, setHallId] = useState("");
  const [tableName, setTableName] = useState("");
  const [number, setNumber] = useState("1");
  const [capacity, setCapacity] = useState("4");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingHall, setIsSavingHall] = useState(false);
  const [isSavingTable, setIsSavingTable] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const [nextBranches, nextTables] = await Promise.all([
        apiFetch<Branch[]>("/branches"),
        apiFetch<Table[]>(branchId ? `/tables?branchId=${encodeURIComponent(branchId)}` : "/tables"),
      ]);
      setBranches(nextBranches);
      setTables(nextTables);
    } catch (caught) {
      if (caught instanceof SessionExpiredError) return;
      setError(caught instanceof Error ? caught.message : "Ma'lumotlarni yuklab bo'lmadi.");
    } finally {
      setIsLoading(false);
    }
  }, [branchId]);

  useEffect(() => {
    void load();
  }, [load]);

  const halls = useMemo(
    () =>
      [...new Map(tables.flatMap((table) => (table.hall ? [[table.hall.id, table.hall]] : []))).values()],
    [tables],
  );

  async function createHall(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!branchId) {
      showToast("Avval filialni tanlang.", "danger");
      return;
    }
    setIsSavingHall(true);
    try {
      await apiFetch("/halls", {
        method: "POST",
        body: JSON.stringify({ branchId, name: hallName }),
      });
      setHallName("");
      showToast("Zal qo'shildi.", "success");
      await load();
    } catch (caught) {
      if (caught instanceof SessionExpiredError) return;
      showToast(caught instanceof Error ? caught.message : "Zal qo'shib bo'lmadi.", "danger");
    } finally {
      setIsSavingHall(false);
    }
  }

  async function createTable(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!branchId) {
      showToast("Avval filialni tanlang.", "danger");
      return;
    }
    if (!hallId) {
      showToast("Avval zalni tanlang.", "danger");
      return;
    }
    setIsSavingTable(true);
    try {
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
      showToast("Stol qo'shildi.", "success");
      await load();
    } catch (caught) {
      if (caught instanceof SessionExpiredError) return;
      showToast(caught instanceof Error ? caught.message : "Stol qo'shib bo'lmadi.", "danger");
    } finally {
      setIsSavingTable(false);
    }
  }

  async function setStatus(tableId: string, status: TableStatus) {
    try {
      await apiFetch(`/tables/${tableId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      await load();
    } catch (caught) {
      if (caught instanceof SessionExpiredError) return;
      showToast(caught instanceof Error ? caught.message : "Holatni yangilab bo'lmadi.", "danger");
    }
  }

  return (
    <div className="grid gap-5">
      {error ? <ErrorState message={error} onRetry={() => void load()} /> : null}

      <div className="grid gap-5 xl:grid-cols-[360px_1fr]">
        <aside className="grid gap-4">
          <Card>
            <CardHeader title="Filial" description="Zal va stollar shu filial uchun ko'rsatiladi" />
            <div className="p-4">
              <FormField label="Filial">
                {(props) => (
                  <Select
                    {...props}
                    value={branchId}
                    onChange={(event) => {
                      setBranchId(event.target.value);
                      setHallId("");
                    }}
                  >
                    <option value="">Filialni tanlang</option>
                    {branches.map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name}
                      </option>
                    ))}
                  </Select>
                )}
              </FormField>
            </div>
          </Card>

          <Card as="div">
            <CardHeader title="Yangi zal" />
            <form className="grid gap-3 p-4" onSubmit={createHall}>
              <FormField label="Zal nomi" required>
                {(props) => (
                  <TextInput
                    {...props}
                    value={hallName}
                    onChange={(event) => setHallName(event.target.value)}
                    placeholder="Asosiy zal"
                    required
                  />
                )}
              </FormField>
              <Button disabled={isSavingHall || !branchId} type="submit">
                {isSavingHall ? "Qo'shilmoqda..." : "Zal qo'shish"}
              </Button>
            </form>
          </Card>

          <Card as="div">
            <CardHeader title="Yangi stol" />
            <form className="grid gap-3 p-4" onSubmit={createTable}>
              <FormField label="Zal" required>
                {(props) => (
                  <Select {...props} value={hallId} onChange={(event) => setHallId(event.target.value)} required>
                    <option value="">Zalni tanlang</option>
                    {halls.map((hall) => (
                      <option key={hall.id} value={hall.id}>
                        {hall.name}
                      </option>
                    ))}
                  </Select>
                )}
              </FormField>
              <FormField label="Stol nomi" required>
                {(props) => (
                  <TextInput
                    {...props}
                    value={tableName}
                    onChange={(event) => setTableName(event.target.value)}
                    placeholder="Stol 1"
                    required
                  />
                )}
              </FormField>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Raqami">
                  {(props) => (
                    <TextInput
                      {...props}
                      value={number}
                      onChange={(event) => setNumber(event.target.value)}
                      type="number"
                      min="1"
                    />
                  )}
                </FormField>
                <FormField label="Sig'imi">
                  {(props) => (
                    <TextInput
                      {...props}
                      value={capacity}
                      onChange={(event) => setCapacity(event.target.value)}
                      type="number"
                      min="1"
                    />
                  )}
                </FormField>
              </div>
              <Button disabled={isSavingTable || !branchId} type="submit">
                {isSavingTable ? "Qo'shilmoqda..." : "Stol qo'shish"}
              </Button>
            </form>
          </Card>
        </aside>

        <Card as="div">
          <CardHeader title="Zal sxemasi" description={isLoading ? "Yuklanmoqda..." : `${tables.length} ta stol`} />
          <div className="p-4">
            {tables.length ? (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {tables.map((table) => (
                  <article
                    className="rounded-mz-card border border-mz-border bg-mz-surface p-5 shadow-mz-card"
                    key={table.id}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase text-mz-info">
                          {table.hall?.name ?? "Zalsiz"}
                        </p>
                        <h4 className="mt-2 text-xl font-semibold text-mz-text">{table.name}</h4>
                        <p className="mt-1 text-sm text-mz-text-muted">{table.capacity ?? 0} o'rin</p>
                      </div>
                      <StatusBadge status={table.status} />
                    </div>
                    <div className="mt-5 grid grid-cols-2 gap-2">
                      {(["AVAILABLE", "RESERVED", "CLEANING", "OCCUPIED"] as TableStatus[]).map((nextStatus) => (
                        <button
                          className="rounded-mz-control border border-mz-border px-3 py-2 text-xs font-semibold text-mz-text hover:bg-mz-info-bg"
                          disabled={table.status === nextStatus}
                          key={nextStatus}
                          onClick={() => void setStatus(table.id, nextStatus)}
                          type="button"
                        >
                          {statusLabels[nextStatus]}
                        </button>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState title="Hali stol yo'q" description="Zal sxemasini boshlash uchun avval zal, so'ng stol qo'shing." />
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: TableStatus }) {
  const colors: Record<TableStatus, string> = {
    AVAILABLE: "bg-mz-info-bg text-mz-info",
    OCCUPIED: "bg-mz-danger-bg text-mz-danger",
    RESERVED: "bg-mz-warning-bg text-mz-warning",
    CLEANING: "bg-mz-surface-sunken text-mz-text",
  };

  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${colors[status]}`}>
      {statusLabels[status]}
    </span>
  );
}
