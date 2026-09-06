"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch, SessionExpiredError } from "../../lib/api";
import { formatDateTime, formatMoney } from "../../lib/order-display";
import { hasPermission } from "../../lib/auth";
import { useAuth } from "../auth/auth-provider";
import { Badge, type BadgeTone } from "../admin-ui/badge";
import { Button } from "../admin-ui/button";
import { Card, CardHeader } from "../admin-ui/card";
import { DataTable, type DataTableColumn } from "../admin-ui/data-table";
import { ErrorState } from "../admin-ui/feedback";
import {
  FilterBar,
  FormField,
  Select,
  TextInput,
  Textarea,
} from "../admin-ui/form";
import { Icon } from "../admin-ui/icon";
import { Modal } from "../admin-ui/modal";
import { InfoBox, StatGrid } from "../admin-ui/stat-box";
import { useToast } from "../admin-ui/toast";

/*
 * Ombor — zaxira va harakatlar.
 *
 * Oldingi ekran foydalanuvchidan ombor va ingredient ID sini QO'LDA
 * yozishni talab qilardi va harakat turini `IN` ga qotirgan edi, chunki
 * backend'da ro'yxat endpoint'lari yo'q edi. Endi `GET /inventory/warehouses`
 * va `GET /inventory/ingredients` qo'shildi, shuning uchun tanlagichlar bor
 * va to'rtala harakat turi mavjud.
 *
 * Ingredient va ombor YARATISH ham shu ekranda: `POST /inventory/ingredients`
 * va `POST /inventory/warehouses` tayyor edi, lekin ekrani yo'q edi — ya'ni
 * yangi ingredient faqat seed orqali qo'shilardi va zaxira harakati uchun
 * tanlagich bo'sh qolaverardi.
 */

type StockStatus = "NORMAL" | "LOW_STOCK" | "OUT_OF_STOCK";
type MovementType = "IN" | "OUT" | "ADJUSTMENT" | "WASTE";

type StockRow = {
  id: string;
  currentQuantity: string;
  minimumQuantity: string;
  status: StockStatus;
  warehouse: { id: string; name: string; branchId: string };
  ingredient: { id: string; name: string; unit: string; costPerUnit: string };
};

type Movement = {
  id: string;
  type: MovementType;
  quantity: string;
  reason?: string | null;
  createdAt: string;
  ingredient?: { id: string; name: string; unit: string } | null;
  warehouse?: { id: string; name: string } | null;
  createdBy?: { id: string; displayName?: string | null } | null;
};

type InventoryBranch = { id: string; name: string };

type Warehouse = {
  id: string;
  name: string;
  branchId: string;
  branch?: { name: string } | null;
};
type Ingredient = {
  id: string;
  name: string;
  unit: string;
  minimumStock: string;
  costPerUnit: string;
};

const stockStatusLabels: Record<StockStatus, string> = {
  NORMAL: "Yetarli",
  LOW_STOCK: "Kam qoldi",
  OUT_OF_STOCK: "Tugagan",
};

const movementTypeLabels: Record<MovementType, string> = {
  IN: "Kirim",
  OUT: "Chiqim",
  ADJUSTMENT: "Tuzatish",
  WASTE: "Yo'qotish",
};

/** `IngredientUnit` enum qiymatlari — backend shu to'rttasini qabul qiladi. */
const ingredientUnits = [
  { value: "KG", label: "Kilogramm" },
  { value: "GRAM", label: "Gramm" },
  { value: "LITER", label: "Litr" },
  { value: "PIECE", label: "Dona" },
];

const emptyIngredientDraft = {
  name: "",
  unit: "KG",
  minimumStock: "0",
  costPerUnit: "0",
};
const emptyWarehouseDraft = { branchId: "", name: "" };

function stockTone(status: StockStatus): BadgeTone {
  if (status === "NORMAL") return "success";
  if (status === "LOW_STOCK") return "warning";
  return "danger";
}

function movementTone(type: MovementType): BadgeTone {
  if (type === "IN") return "success";
  if (type === "WASTE") return "danger";
  if (type === "ADJUSTMENT") return "warning";
  return "info";
}

export function AdminInventoryPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const canCreate = hasPermission(user, "INVENTORY_CREATE");
  const [stock, setStock] = useState<StockRow[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [branches, setBranches] = useState<InventoryBranch[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isIngredientOpen, setIsIngredientOpen] = useState(false);
  const [isWarehouseOpen, setIsWarehouseOpen] = useState(false);
  const [ingredientDraft, setIngredientDraft] = useState(emptyIngredientDraft);
  const [warehouseDraft, setWarehouseDraft] = useState(emptyWarehouseDraft);
  const [isCreating, setIsCreating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState({
    warehouseId: "",
    ingredientId: "",
    type: "IN" as MovementType,
    quantity: "",
    reason: "",
  });

  const load = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const [
        nextStock,
        nextMovements,
        nextWarehouses,
        nextIngredients,
        nextBranches,
      ] = await Promise.all([
        apiFetch<StockRow[]>("/inventory/stock"),
        apiFetch<Movement[]>("/inventory/movements"),
        apiFetch<Warehouse[]>("/inventory/warehouses"),
        apiFetch<Ingredient[]>("/inventory/ingredients"),
        apiFetch<InventoryBranch[]>("/branches"),
      ]);
      setStock(nextStock);
      setMovements(nextMovements);
      setWarehouses(nextWarehouses);
      setIngredients(nextIngredients);
      setBranches(nextBranches);
      setWarehouseDraft((current) => ({
        ...current,
        branchId: current.branchId || (nextBranches[0]?.id ?? ""),
      }));
      setForm((current) => ({
        ...current,
        warehouseId: current.warehouseId || (nextWarehouses[0]?.id ?? ""),
        ingredientId: current.ingredientId || (nextIngredients[0]?.id ?? ""),
      }));
    } catch (caught) {
      if (caught instanceof SessionExpiredError) {
        return;
      }

      setError(
        caught instanceof Error
          ? caught.message
          : "Ombor ma'lumotlarini yuklab bo'lmadi.",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createIngredient(): Promise<void> {
    if (!ingredientDraft.name.trim()) {
      showToast("Ingredient nomi kerak.", "danger");
      return;
    }

    setIsCreating(true);

    try {
      await apiFetch("/inventory/ingredients", {
        method: "POST",
        body: JSON.stringify({
          name: ingredientDraft.name.trim(),
          unit: ingredientDraft.unit,
          minimumStock: Number(ingredientDraft.minimumStock) || 0,
          costPerUnit: Number(ingredientDraft.costPerUnit) || 0,
        }),
      });

      showToast("Ingredient qo'shildi.", "success");
      setIngredientDraft(emptyIngredientDraft);
      setIsIngredientOpen(false);
      await load();
    } catch (caught) {
      if (caught instanceof SessionExpiredError) {
        return;
      }

      showToast(
        caught instanceof Error ? caught.message : "Qo'shib bo'lmadi.",
        "danger",
      );
    } finally {
      setIsCreating(false);
    }
  }

  async function createWarehouse(): Promise<void> {
    if (!warehouseDraft.name.trim() || !warehouseDraft.branchId) {
      showToast("Ombor nomi va filial kerak.", "danger");
      return;
    }

    setIsCreating(true);

    try {
      await apiFetch("/inventory/warehouses", {
        method: "POST",
        body: JSON.stringify({
          branchId: warehouseDraft.branchId,
          name: warehouseDraft.name.trim(),
        }),
      });

      showToast("Ombor qo'shildi.", "success");
      setWarehouseDraft(emptyWarehouseDraft);
      setIsWarehouseOpen(false);
      await load();
    } catch (caught) {
      if (caught instanceof SessionExpiredError) {
        return;
      }

      showToast(
        caught instanceof Error ? caught.message : "Qo'shib bo'lmadi.",
        "danger",
      );
    } finally {
      setIsCreating(false);
    }
  }

  const filteredStock = useMemo(() => {
    const needle = search.trim().toLowerCase();

    return stock.filter((row) => {
      const matchesSearch =
        !needle ||
        row.ingredient.name.toLowerCase().includes(needle) ||
        row.warehouse.name.toLowerCase().includes(needle);

      return matchesSearch && (!statusFilter || row.status === statusFilter);
    });
  }, [search, statusFilter, stock]);

  const stats = useMemo(() => {
    const low = stock.filter((row) => row.status === "LOW_STOCK").length;
    const out = stock.filter((row) => row.status === "OUT_OF_STOCK").length;
    const value = stock.reduce(
      (sum, row) =>
        sum + Number(row.currentQuantity) * Number(row.ingredient.costPerUnit),
      0,
    );

    return { low, out, value, total: stock.length };
  }, [stock]);

  async function submitMovement(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();

    const quantity = Number(form.quantity);

    if (!Number.isFinite(quantity) || quantity <= 0) {
      showToast("Miqdor musbat son bo'lishi kerak.", "danger");
      return;
    }

    setIsSaving(true);

    try {
      await apiFetch("/inventory/movements", {
        method: "POST",
        body: JSON.stringify({
          warehouseId: form.warehouseId,
          ingredientId: form.ingredientId,
          type: form.type,
          quantity,
          reason: form.reason.trim() || undefined,
        }),
      });
      showToast(`${movementTypeLabels[form.type]} yozildi.`, "success");
      setIsFormOpen(false);
      setForm((current) => ({ ...current, quantity: "", reason: "" }));
      await load();
    } catch (caught) {
      if (caught instanceof SessionExpiredError) {
        return;
      }

      showToast(
        caught instanceof Error ? caught.message : "Harakat yozilmadi.",
        "danger",
      );
    } finally {
      setIsSaving(false);
    }
  }

  const stockColumns: DataTableColumn<StockRow>[] = [
    {
      key: "ingredient",
      header: "Ingredient",
      primary: true,
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate font-semibold text-mz-text">
            {row.ingredient.name}
          </p>
          <p className="truncate text-xs text-mz-text-muted">
            {row.warehouse.name}
          </p>
        </div>
      ),
    },
    {
      key: "quantity",
      header: "Qoldiq",
      align: "right",
      render: (row) => `${row.currentQuantity} ${row.ingredient.unit}`,
    },
    {
      key: "minimum",
      header: "Minimal",
      align: "right",
      hideOnMobile: true,
      render: (row) => `${row.minimumQuantity} ${row.ingredient.unit}`,
    },
    {
      key: "value",
      header: "Qiymat",
      align: "right",
      hideOnMobile: true,
      render: (row) =>
        formatMoney(
          Number(row.currentQuantity) * Number(row.ingredient.costPerUnit),
        ),
    },
    {
      key: "status",
      header: "Holat",
      align: "right",
      render: (row) => (
        <Badge tone={stockTone(row.status)} withDot>
          {stockStatusLabels[row.status]}
        </Badge>
      ),
    },
  ];

  const movementColumns: DataTableColumn<Movement>[] = [
    {
      key: "movement",
      header: "Harakat",
      primary: true,
      render: (movement) => (
        <div className="min-w-0">
          <p className="truncate font-semibold text-mz-text">
            {movement.ingredient?.name ?? "—"}
          </p>
          <p className="truncate text-xs text-mz-text-muted">
            {formatDateTime(movement.createdAt)} ·{" "}
            {movement.warehouse?.name ?? "—"}
          </p>
        </div>
      ),
    },
    {
      key: "type",
      header: "Turi",
      render: (movement) => (
        <Badge tone={movementTone(movement.type)}>
          {movementTypeLabels[movement.type]}
        </Badge>
      ),
    },
    {
      key: "quantity",
      header: "Miqdor",
      align: "right",
      render: (movement) =>
        `${movement.quantity} ${movement.ingredient?.unit ?? ""}`,
    },
    {
      key: "reason",
      header: "Sabab",
      hideOnMobile: true,
      render: (movement) => (
        <span className="text-xs text-mz-text-muted">
          {movement.reason ?? "—"}
        </span>
      ),
    },
  ];

  return (
    <div className="grid gap-5">
      {error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : null}

      <StatGrid>
        <InfoBox
          icon="boxes"
          label="Zaxira qatorlari"
          value={`${stats.total} ta`}
        />
        <InfoBox
          icon="alert"
          label="Kam qolgan"
          tone={stats.low > 0 ? "warning" : "neutral"}
          value={`${stats.low} ta`}
        />
        <InfoBox
          icon="inbox"
          label="Tugagan"
          tone={stats.out > 0 ? "danger" : "success"}
          value={`${stats.out} ta`}
        />
        <InfoBox
          icon="wallet"
          label="Zaxira qiymati"
          tone="brand"
          value={formatMoney(stats.value)}
        />
      </StatGrid>

      <Card>
        <CardHeader
          actions={
            <>
              {canCreate ? (
                <>
                  <Button
                    onClick={() => setIsIngredientOpen(true)}
                    size="sm"
                    variant="ghost"
                  >
                    <Icon className="h-4 w-4" name="plus" />
                    Ingredient
                  </Button>
                  <Button
                    onClick={() => setIsWarehouseOpen(true)}
                    size="sm"
                    variant="ghost"
                  >
                    <Icon className="h-4 w-4" name="plus" />
                    Ombor
                  </Button>
                </>
              ) : null}
              <Button
                disabled={warehouses.length === 0 || ingredients.length === 0}
                onClick={() => setIsFormOpen(true)}
                title={
                  warehouses.length === 0 || ingredients.length === 0
                    ? "Avval kamida bitta ombor va ingredient qo'shing"
                    : undefined
                }
              >
                Harakat qo&apos;shish
              </Button>
            </>
          }
          description="Ombor bo'yicha ingredient qoldiqlari"
          title="Zaxira"
        />

        <FilterBar>
          <div className="min-w-52 flex-1">
            <TextInput
              aria-label="Ingredient qidirish"
              placeholder="Ingredient yoki ombor nomi"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <div className="w-44">
            <Select
              aria-label="Holat bo'yicha filtr"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="">Barcha holatlar</option>
              {Object.entries(stockStatusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </div>
        </FilterBar>

        <DataTable
          caption="Zaxira qoldiqlari"
          columns={stockColumns}
          emptyDescription="Ombor yoki ingredient qo'shilmagan bo'lishi mumkin."
          emptyTitle="Zaxira qatori yo'q"
          getRowKey={(row) => row.id}
          isLoading={isLoading}
          rows={filteredStock}
        />
      </Card>

      <Card>
        <CardHeader
          description="Oxirgi kirim, chiqim, tuzatish va yo'qotishlar"
          title="Harakatlar"
        />
        <DataTable
          caption="Zaxira harakatlari"
          columns={movementColumns}
          emptyTitle="Harakat yo'q"
          getRowKey={(movement) => movement.id}
          isLoading={isLoading}
          rows={movements}
        />
      </Card>

      <Modal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title="Zaxira harakati"
      >
        <form
          className="grid gap-3"
          id="movement-form"
          onSubmit={submitMovement}
        >
          <FormField label="Ombor" required>
            {(props) => (
              <Select
                {...props}
                required
                value={form.warehouseId}
                onChange={(event) =>
                  setForm({ ...form, warehouseId: event.target.value })
                }
              >
                {warehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.name}
                    {warehouse.branch ? ` · ${warehouse.branch.name}` : ""}
                  </option>
                ))}
              </Select>
            )}
          </FormField>

          <FormField label="Ingredient" required>
            {(props) => (
              <Select
                {...props}
                required
                value={form.ingredientId}
                onChange={(event) =>
                  setForm({ ...form, ingredientId: event.target.value })
                }
              >
                {ingredients.map((ingredient) => (
                  <option key={ingredient.id} value={ingredient.id}>
                    {ingredient.name} ({ingredient.unit})
                  </option>
                ))}
              </Select>
            )}
          </FormField>

          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Harakat turi" required>
              {(props) => (
                <Select
                  {...props}
                  value={form.type}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      type: event.target.value as MovementType,
                    })
                  }
                >
                  {Object.entries(movementTypeLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              )}
            </FormField>
            <FormField label="Miqdor" required>
              {(props) => (
                <TextInput
                  {...props}
                  min={0.001}
                  required
                  step={0.001}
                  type="number"
                  value={form.quantity}
                  onChange={(event) =>
                    setForm({ ...form, quantity: event.target.value })
                  }
                />
              )}
            </FormField>
          </div>

          <FormField
            hint="Yo'qotish va tuzatish uchun sababni yozish tavsiya etiladi"
            label="Sabab"
          >
            {(props) => (
              <Textarea
                {...props}
                maxLength={500}
                value={form.reason}
                onChange={(event) =>
                  setForm({ ...form, reason: event.target.value })
                }
              />
            )}
          </FormField>
        </form>

        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <Button onClick={() => setIsFormOpen(false)} variant="ghost">
            Bekor qilish
          </Button>
          <Button disabled={isSaving} form="movement-form" type="submit">
            {isSaving ? "Yozilmoqda..." : "Yozish"}
          </Button>
        </div>
      </Modal>

      <Modal
        footer={
          <>
            <Button onClick={() => setIsIngredientOpen(false)} variant="ghost">
              Bekor qilish
            </Button>
            <Button
              disabled={isCreating}
              onClick={() => void createIngredient()}
            >
              {isCreating ? "Qo'shilmoqda…" : "Qo'shish"}
            </Button>
          </>
        }
        isOpen={isIngredientOpen}
        onClose={() => setIsIngredientOpen(false)}
        title="Yangi ingredient"
      >
        <div className="grid gap-3">
          <FormField label="Nomi" required>
            {(props) => (
              <TextInput
                {...props}
                onChange={(event) =>
                  setIngredientDraft((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                value={ingredientDraft.name}
              />
            )}
          </FormField>

          <FormField label="O'lchov birligi" required>
            {(props) => (
              <Select
                {...props}
                onChange={(event) =>
                  setIngredientDraft((current) => ({
                    ...current,
                    unit: event.target.value,
                  }))
                }
                value={ingredientDraft.unit}
              >
                {ingredientUnits.map((unit) => (
                  <option key={unit.value} value={unit.value}>
                    {unit.label}
                  </option>
                ))}
              </Select>
            )}
          </FormField>

          <FormField
            hint="Shu miqdordan pastda 'Kam qoldi' deb belgilanadi"
            label="Minimal zaxira"
          >
            {(props) => (
              <TextInput
                {...props}
                min="0"
                onChange={(event) =>
                  setIngredientDraft((current) => ({
                    ...current,
                    minimumStock: event.target.value,
                  }))
                }
                step="0.001"
                type="number"
                value={ingredientDraft.minimumStock}
              />
            )}
          </FormField>

          <FormField
            hint="Zaxira qiymatini hisoblashda ishlatiladi"
            label="Birlik tannarxi"
          >
            {(props) => (
              <TextInput
                {...props}
                min="0"
                onChange={(event) =>
                  setIngredientDraft((current) => ({
                    ...current,
                    costPerUnit: event.target.value,
                  }))
                }
                step="0.01"
                type="number"
                value={ingredientDraft.costPerUnit}
              />
            )}
          </FormField>
        </div>
      </Modal>

      <Modal
        footer={
          <>
            <Button onClick={() => setIsWarehouseOpen(false)} variant="ghost">
              Bekor qilish
            </Button>
            <Button
              disabled={isCreating}
              onClick={() => void createWarehouse()}
            >
              {isCreating ? "Qo'shilmoqda…" : "Qo'shish"}
            </Button>
          </>
        }
        isOpen={isWarehouseOpen}
        onClose={() => setIsWarehouseOpen(false)}
        title="Yangi ombor"
      >
        <div className="grid gap-3">
          <FormField label="Filial" required>
            {(props) => (
              <Select
                {...props}
                onChange={(event) =>
                  setWarehouseDraft((current) => ({
                    ...current,
                    branchId: event.target.value,
                  }))
                }
                value={warehouseDraft.branchId}
              >
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </Select>
            )}
          </FormField>

          <FormField label="Nomi" required>
            {(props) => (
              <TextInput
                {...props}
                onChange={(event) =>
                  setWarehouseDraft((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                placeholder="Masalan: Asosiy ombor"
                value={warehouseDraft.name}
              />
            )}
          </FormField>
        </div>
      </Modal>
    </div>
  );
}
