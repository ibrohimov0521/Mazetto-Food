"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { io } from "socket.io-client";
import { AuthShell } from "../../components/auth/auth-shell";
import { PermissionGuard } from "../../components/auth/permission-guard";
import { RoleGuard } from "../../components/auth/role-guard";
import { EmptyState, PrimaryButton } from "../../components/erp/erp-ui";
import { apiFetch } from "../../lib/api";
import { getApiBaseUrl } from "../../lib/auth";

type TableStatus = "AVAILABLE" | "OCCUPIED" | "RESERVED" | "CLEANING";
type Table = {
  id: string;
  branchId: string;
  name: string;
  number: number | null;
  capacity: number | null;
  status: TableStatus;
  hall?: { id: string; name: string } | null;
  orders: Order[];
};
type Product = {
  id: string;
  name: string;
  variants: { id: string; name: string; sellingPrice: string }[];
};
type Order = {
  id: string;
  orderNumber: string;
  status: string;
  total: string;
  items: { id: string; productName: string; quantity: string; totalPrice: string }[];
};

export default function WaiterPage() {
  return (
    <RoleGuard roles={["WAITER", "SUPER_ADMIN", "BRANCH_MANAGER"]}>
      <PermissionGuard permission="TABLE_VIEW">
        <AuthShell eyebrow="Table service" title="Waiter workspace">
          <WaiterFloor />
        </AuthShell>
      </PermissionGuard>
    </RoleGuard>
  );
}

function WaiterFloor() {
  const [tables, setTables] = useState<Table[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [guestCount, setGuestCount] = useState("2");

  const load = useCallback(async () => {
    const [nextTables, nextProducts] = await Promise.all([
      apiFetch<Table[]>("/tables"),
      apiFetch<Product[]>("/menu/products"),
    ]);
    setTables(nextTables);
    setProducts(nextProducts);
    setSelectedTableId((current) => current ?? nextTables[0]?.id ?? null);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const socket = io(getSocketBaseUrl(), {
      transports: ["websocket"],
    });
    const refresh = () => {
      void load();
    };

    socket.on("order.sent_to_kitchen", refresh);
    socket.on("order.status_changed", refresh);

    return () => {
      socket.disconnect();
    };
  }, [load]);

  const selectedTable = useMemo(
    () => tables.find((table) => table.id === selectedTableId) ?? null,
    [selectedTableId, tables],
  );
  const currentOrder = selectedTable?.orders[0] ?? null;

  async function openTable() {
    if (!selectedTable) {
      return;
    }

    await apiFetch(`/tables/${selectedTable.id}/orders`, {
      method: "POST",
      body: JSON.stringify({ guestCount: Number(guestCount) }),
    });
    await load();
  }

  async function addProduct(product: Product) {
    if (!currentOrder) {
      return;
    }

    const variant = product.variants[0];
    await apiFetch(`/orders/${currentOrder.id}/items`, {
      method: "POST",
      body: JSON.stringify({
        productId: product.id,
        variantId: variant?.id,
        quantity: 1,
        modifiers: [],
      }),
    });
    await load();
  }

  async function updateOrderStatus(status: "CONFIRMED" | "SERVED") {
    if (!currentOrder) {
      return;
    }

    await apiFetch(`/orders/${currentOrder.id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status, reason: status === "CONFIRMED" ? "Sent to kitchen" : "Payment requested" }),
    });
    await load();
  }

  return (
    <section className="grid gap-6 xl:grid-cols-[1fr_420px]">
      <div className="grid gap-5">
        <div className="flex flex-wrap items-center gap-3">
          <Legend color="bg-emerald-500" label="Available" />
          <Legend color="bg-red-500" label="Occupied" />
          <Legend color="bg-yellow-400" label="Reserved" />
          <Legend color="bg-neutral-400" label="Cleaning" />
        </div>

        {tables.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {tables.map((table) => (
              <button
                className={`rounded-3xl border p-5 text-left shadow-[0_14px_45px_rgba(17,24,39,0.08)] transition ${
                  selectedTableId === table.id ? "border-emerald-500 ring-4 ring-emerald-100" : "border-neutral-100"
                } ${statusBackground(table.status)}`}
                key={table.id}
                onClick={() => setSelectedTableId(table.id)}
                type="button"
              >
                <p className="text-xs font-semibold uppercase text-neutral-500">{table.hall?.name ?? "Assigned hall"}</p>
                <h2 className="mt-3 text-2xl font-semibold text-neutral-950">{table.name}</h2>
                <p className="mt-2 text-sm font-medium text-neutral-600">{table.capacity ?? 0} seats</p>
                <p className="mt-5 rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-neutral-800">{table.status}</p>
              </button>
            ))}
          </div>
        ) : (
          <EmptyState title="No assigned tables are available yet." />
        )}
      </div>

      <aside className="rounded-3xl border border-neutral-100 bg-white p-5 shadow-[0_14px_45px_rgba(17,24,39,0.08)]">
        {selectedTable ? (
          <div className="grid gap-5">
            <div>
              <p className="text-sm font-semibold text-emerald-700">Selected table</p>
              <h3 className="mt-2 text-2xl font-semibold text-neutral-950">{selectedTable.name}</h3>
            </div>

            {currentOrder ? (
              <>
                <div className="rounded-2xl bg-neutral-50 p-4">
                  <p className="text-sm font-semibold text-neutral-700">{currentOrder.orderNumber}</p>
                  <p className="mt-1 text-sm text-neutral-500">{currentOrder.status} · {currentOrder.total}</p>
                </div>
                <div className="grid gap-2">
                  {currentOrder.items.length ? (
                    currentOrder.items.map((item) => (
                      <div className="flex justify-between rounded-2xl border border-neutral-100 px-4 py-3 text-sm" key={item.id}>
                        <span className="font-semibold text-neutral-800">{item.productName}</span>
                        <span className="text-neutral-500">{item.quantity} · {item.totalPrice}</span>
                      </div>
                    ))
                  ) : (
                    <EmptyState title="No products added yet." />
                  )}
                </div>
                <div className="grid max-h-72 gap-2 overflow-auto pr-1">
                  {products.map((product) => (
                    <button className="rounded-2xl border border-neutral-100 px-4 py-3 text-left text-sm font-semibold text-neutral-800 hover:bg-emerald-50" key={product.id} onClick={() => void addProduct(product)} type="button">
                      {product.name}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <PrimaryButton onClick={() => void updateOrderStatus("CONFIRMED")}>Send kitchen</PrimaryButton>
                  <PrimaryButton onClick={() => void updateOrderStatus("SERVED")}>Request pay</PrimaryButton>
                </div>
              </>
            ) : (
              <div className="grid gap-3">
                <label className="grid gap-2 text-sm font-semibold text-neutral-700">
                  Guests
                  <input className="rounded-2xl border border-neutral-200 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100" min="1" type="number" value={guestCount} onChange={(event) => setGuestCount(event.target.value)} />
                </label>
                <PrimaryButton onClick={() => void openTable()}>Open table</PrimaryButton>
              </div>
            )}
          </div>
        ) : (
          <EmptyState title="Select a table to open an order." />
        )}
      </aside>
    </section>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-sm font-semibold text-neutral-700 shadow-sm">
      <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
      {label}
    </span>
  );
}

function statusBackground(status: TableStatus): string {
  const classes: Record<TableStatus, string> = {
    AVAILABLE: "bg-emerald-50",
    OCCUPIED: "bg-red-50",
    RESERVED: "bg-yellow-50",
    CLEANING: "bg-neutral-100",
  };

  return classes[status];
}

function getSocketBaseUrl(): string {
  return getApiBaseUrl().replace(/\/api\/v1\/?$/, "");
}
