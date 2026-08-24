"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { AuthShell } from "../../../components/auth/auth-shell";
import { PermissionGuard } from "../../../components/auth/permission-guard";
import { RoleGuard } from "../../../components/auth/role-guard";
import { EmptyState, ErpPageShell, PrimaryButton, TextInput } from "../../../components/erp/erp-ui";
import { apiFetch } from "../../../lib/api";

type StockRow = {
  id: string;
  currentQuantity: string;
  minimumQuantity: string;
  status: "NORMAL" | "LOW_STOCK" | "OUT_OF_STOCK";
  warehouse: { id: string; name: string; branchId: string };
  ingredient: { id: string; name: string; unit: string; costPerUnit: string };
};

export default function AdminInventoryPage() {
  return (
    <RoleGuard roles={["SUPER_ADMIN", "BRANCH_MANAGER"]}>
      <PermissionGuard permission="INVENTORY_VIEW">
        <AuthShell eyebrow="Inventory" title="Stock control">
          <InventoryManagement />
        </AuthShell>
      </PermissionGuard>
    </RoleGuard>
  );
}

function InventoryManagement() {
  const [stock, setStock] = useState<StockRow[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [warehouseId, setWarehouseId] = useState("");
  const [ingredientId, setIngredientId] = useState("");
  const [quantity, setQuantity] = useState("0");

  async function load() {
    setStock(await apiFetch<StockRow[]>("/inventory/stock"));
  }

  useEffect(() => {
    void load();
  }, []);

  const filteredStock = useMemo(
    () =>
      stock.filter((row) => {
        const matchesSearch = row.ingredient.name.toLowerCase().includes(search.toLowerCase());
        const matchesStatus = status === "ALL" || row.status === status;

        return matchesSearch && matchesStatus;
      }),
    [search, status, stock],
  );
  const lowStockCount = stock.filter((row) => row.status !== "NORMAL").length;

  async function addStock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await apiFetch("/inventory/movements", {
      method: "POST",
      body: JSON.stringify({
        ingredientId,
        warehouseId,
        type: "IN",
        quantity: Number(quantity),
        reason: "Manual stock intake",
      }),
    });
    setQuantity("0");
    await load();
  }

  return (
    <ErpPageShell
      title="Inventory management"
      subtitle="Track stock levels, low-stock risk, and every stock movement across warehouses."
      actions={<span className="rounded-full bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800">{lowStockCount} alerts</span>}
    >
      <div className="grid gap-6">
        <section className="grid gap-3 rounded-3xl border border-neutral-100 bg-white p-5 shadow-[0_14px_45px_rgba(17,24,39,0.08)] md:grid-cols-[1fr_180px]">
          <TextInput placeholder="Search ingredient" value={search} onChange={(event) => setSearch(event.target.value)} />
          <select
            className="rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm font-semibold text-neutral-700 outline-none"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="ALL">All stock</option>
            <option value="NORMAL">Normal</option>
            <option value="LOW_STOCK">Low stock</option>
            <option value="OUT_OF_STOCK">Out of stock</option>
          </select>
        </section>

        <form className="grid gap-3 rounded-3xl border border-emerald-100 bg-emerald-50/60 p-5 md:grid-cols-[1fr_1fr_140px_auto]" onSubmit={addStock}>
          <TextInput placeholder="Warehouse ID" value={warehouseId} onChange={(event) => setWarehouseId(event.target.value)} required />
          <TextInput placeholder="Ingredient ID" value={ingredientId} onChange={(event) => setIngredientId(event.target.value)} required />
          <TextInput placeholder="Qty" type="number" min="0.001" step="0.001" value={quantity} onChange={(event) => setQuantity(event.target.value)} required />
          <PrimaryButton type="submit">Add stock</PrimaryButton>
        </form>

        <section className="overflow-hidden rounded-3xl border border-neutral-100 bg-white shadow-[0_14px_45px_rgba(17,24,39,0.08)]">
          {filteredStock.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse text-left text-sm">
                <thead className="bg-neutral-50 text-neutral-500">
                  <tr>
                    <th className="px-5 py-4 font-semibold">Ingredient</th>
                    <th className="px-5 py-4 font-semibold">Warehouse</th>
                    <th className="px-5 py-4 font-semibold">Quantity</th>
                    <th className="px-5 py-4 font-semibold">Minimum</th>
                    <th className="px-5 py-4 font-semibold">Value unit</th>
                    <th className="px-5 py-4 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStock.map((row) => (
                    <tr className="border-t border-neutral-100" key={row.id}>
                      <td className="px-5 py-4 font-semibold text-neutral-950">{row.ingredient.name}</td>
                      <td className="px-5 py-4 text-neutral-600">{row.warehouse.name}</td>
                      <td className="px-5 py-4 text-neutral-700">{row.currentQuantity} {row.ingredient.unit}</td>
                      <td className="px-5 py-4 text-neutral-700">{row.minimumQuantity}</td>
                      <td className="px-5 py-4 text-neutral-700">{row.ingredient.costPerUnit}</td>
                      <td className="px-5 py-4">
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${row.status === "NORMAL" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                          {row.status.replaceAll("_", " ")}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="No stock rows found." />
          )}
        </section>
      </div>
    </ErpPageShell>
  );
}
