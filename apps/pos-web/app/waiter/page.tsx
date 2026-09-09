"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { io } from "socket.io-client";
import { StaffShell } from "../../components/staff/staff-shell";
import { PermissionGuard } from "../../components/auth/permission-guard";
import { RoleGuard } from "../../components/auth/role-guard";
import { EmptyState, PrimaryButton } from "../../components/erp/erp-ui";
import { apiFetch } from "../../lib/api";
import { getApiBaseUrl } from "../../lib/auth";
import { readSession } from "../../lib/session";

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
  displayOrderNumber?: string | null;
  status: string;
  total: string;
  items: { id: string; productName: string; quantity: string; totalPrice: string }[];
};

export default function WaiterPage() {
  return (
    <RoleGuard roles={["WAITER", "SUPER_ADMIN", "BRANCH_MANAGER"]}>
      <PermissionGuard permission="TABLE_VIEW">
        <StaffShell title="Ofitsiant">
          <WaiterFloor />
        </StaffShell>
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
    const session = readSession();

    if (!session) {
      return;
    }

    const socket = io(getSocketBaseUrl(), {
      auth: { token: session.tokens.accessToken, tokenType: "staff" },
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
    <section className="mx-auto grid w-full max-w-[1760px] gap-4 p-3 sm:p-4 xl:grid-cols-[1fr_390px]">
      <div className="grid gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Legend color="bg-[#29996a]" label="Available" />
          <Legend color="bg-[#c8352f]" label="Occupied" />
          <Legend color="bg-[#ffd83d]" label="Reserved" />
          <Legend color="bg-[#9db0b2]" label="Cleaning" />
        </div>

        {tables.length ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {tables.map((table) => (
              <button
                className={`rounded-[10px] border p-4 text-left shadow-[0_4px_16px_rgba(0,79,85,0.10)] transition ${
                  selectedTableId === table.id ? "border-[#008a84] bg-[#eaf5f1] ring-2 ring-[#bfe2dc]" : "border-[#d5e2dd]"
                } ${statusBackground(table.status)}`}
                key={table.id}
                onClick={() => setSelectedTableId(table.id)}
                type="button"
              >
                <p className="text-xs font-semibold uppercase text-[#53706e]">{table.hall?.name ?? "Assigned hall"}</p>
                <h2 className="mt-3 text-2xl font-semibold text-[#07373a]">{table.name}</h2>
                <p className="mt-2 text-sm font-medium text-[#53706e]">{table.capacity ?? 0} seats</p>
                <p className="mt-5 rounded-full bg-[#f5f5ef] px-2.5 py-1 text-[11px] font-bold text-[#07373a]">{table.status}</p>
              </button>
            ))}
          </div>
        ) : (
          <EmptyState title="No assigned tables are available yet." />
        )}
      </div>

      <aside className="rounded-[10px] border border-[#d5e2dd] bg-white p-4 shadow-[0_4px_16px_rgba(0,79,85,0.10)]">
        {selectedTable ? (
          <div className="grid gap-4">
            <div>
              <p className="text-sm font-semibold text-[#006b63]">Selected table</p>
              <h3 className="mt-2 text-2xl font-semibold text-[#07373a]">{selectedTable.name}</h3>
            </div>

            {currentOrder ? (
              <>
                <div className="rounded-[8px] bg-[#eef4f3] p-3">
                  <p className="text-sm font-semibold text-[#245055]">{currentOrder.displayOrderNumber ?? currentOrder.orderNumber}</p>
                  <p className="mt-1 text-sm text-[#53706e]">{currentOrder.status} · {currentOrder.total}</p>
                </div>
                <div className="grid gap-2">
                  {currentOrder.items.length ? (
                    currentOrder.items.map((item) => (
                      <div className="flex justify-between rounded-[8px] border border-[#d5e2dd] px-3 py-2.5 text-sm" key={item.id}>
                        <span className="font-semibold text-neutral-800">{item.productName}</span>
                        <span className="text-[#53706e]">{item.quantity} · {item.totalPrice}</span>
                      </div>
                    ))
                  ) : (
                    <EmptyState title="No products added yet." />
                  )}
                </div>
                <div className="grid max-h-64 gap-2 overflow-auto pr-1">
                  {products.map((product) => (
                    <button className="rounded-[8px] border border-[#d5e2dd] px-3 py-2.5 text-left text-sm font-semibold text-[#07373a] hover:bg-[#eef4f3]" key={product.id} onClick={() => void addProduct(product)} type="button">
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
                <label className="grid gap-2 text-sm font-semibold text-[#245055]">
                  Guests
                  <input className="rounded-[8px] border border-[#b8ccca] px-3 py-2.5 text-sm outline-none focus:border-[#008a84] focus:ring-2 focus:ring-[#bfe2dc]" min="1" type="number" value={guestCount} onChange={(event) => setGuestCount(event.target.value)} />
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
    <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-sm font-semibold text-[#245055] shadow-sm">
      <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
      {label}
    </span>
  );
}

function statusBackground(status: TableStatus): string {
  const classes: Record<TableStatus, string> = {
    AVAILABLE: "bg-[#e8f5ee]",
    OCCUPIED: "bg-[#fdeceb]",
    RESERVED: "bg-[#fff7e8]",
    CLEANING: "bg-[#eef4f3]",
  };

  return classes[status];
}

function getSocketBaseUrl(): string {
  return getApiBaseUrl().replace(/\/api\/v1\/?$/, "");
}
