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
        <AdminLayout>
          <AdminPageHeader
            breadcrumbs={[{ label: "Admin", href: "/admin/dashboard" }, { label: "Ombor" }, { label: "Zaxira" }]}
            description="Ingredient qoldiqlari va zaxira harakatlari"
            title="Ombor zaxirasi"
          />
          <InventoryManagement />
        </AdminLayout>
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
    <section className="grid gap-5">
      <div className="flex flex-wrap justify-end gap-2">
        <span className="rounded-mz-pill bg-mz-warning-bg px-3 py-1.5 text-xs font-bold text-mz-warning">
          {lowStockCount} ta kam qoldiq ogohlantirishi
        </span>
      </div>
      <div className="grid gap-6">
        <section className="grid gap-3 rounded-mz-card border border-mz-border bg-mz-surface p-5 shadow-mz-card md:grid-cols-[1fr_180px]">
          <TextInput placeholder="Search ingredient" value={search} onChange={(event) => setSearch(event.target.value)} />
          <select
            className="rounded-mz-control border border-mz-border bg-mz-surface px-4 py-3 text-sm font-semibold text-mz-text outline-none"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="ALL">All stock</option>
            <option value="NORMAL">Normal</option>
            <option value="LOW_STOCK">Low stock</option>
            <option value="OUT_OF_STOCK">Out of stock</option>
          </select>
        </section>

        <form className="grid gap-3 rounded-mz-card border border-mz-border bg-mz-info-bg/60 p-5 md:grid-cols-[1fr_1fr_140px_auto]" onSubmit={addStock}>
          <TextInput placeholder="Warehouse ID" value={warehouseId} onChange={(event) => setWarehouseId(event.target.value)} required />
          <TextInput placeholder="Ingredient ID" value={ingredientId} onChange={(event) => setIngredientId(event.target.value)} required />
          <TextInput placeholder="Qty" type="number" min="0.001" step="0.001" value={quantity} onChange={(event) => setQuantity(event.target.value)} required />
          <Button type="submit">Add stock</Button>
        </form>

        <section className="overflow-hidden rounded-mz-card border border-mz-border bg-mz-surface shadow-mz-card">
          {filteredStock.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse text-left text-sm">
                <thead className="bg-mz-surface-sunken text-mz-text-muted">
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
                    <tr className="border-t border-mz-border" key={row.id}>
                      <td className="px-5 py-4 font-semibold text-mz-text">{row.ingredient.name}</td>
                      <td className="px-5 py-4 text-mz-text-muted">{row.warehouse.name}</td>
                      <td className="px-5 py-4 text-mz-text">{row.currentQuantity} {row.ingredient.unit}</td>
                      <td className="px-5 py-4 text-mz-text">{row.minimumQuantity}</td>
                      <td className="px-5 py-4 text-mz-text">{row.ingredient.costPerUnit}</td>
                      <td className="px-5 py-4">
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${row.status === "NORMAL" ? "bg-mz-info-bg text-mz-info" : "bg-mz-danger-bg text-mz-danger"}`}>
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
    </section>
  );
}
