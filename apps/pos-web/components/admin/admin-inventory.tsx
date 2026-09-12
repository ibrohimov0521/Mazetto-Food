"use client";

import { FormEvent, useCallback, useMemo, useRef, useState } from "react";
import { apiFetch, SessionExpiredError } from "../../lib/api";
import { useApiResource } from "../../lib/use-api-resource";
import { canSwitchBranch } from "../../lib/admin-nav";
import { formatDateTime, formatMoney } from "../../lib/order-display";
import { hasPermission } from "../../lib/auth";
import { useAuth } from "../auth/auth-provider";
import { Badge, type BadgeTone } from "../admin-ui/badge";
import { Button, GuardedButton } from "../admin-ui/button";
import { Card, CardBody, CardHeader } from "../admin-ui/card";
import { DataTable, type DataTableColumn } from "../admin-ui/data-table";
import { ErrorState } from "../admin-ui/feedback";
import {
  FilterBar,
  focusFirstInvalidField,
  FormField,
  Select,
  TextInput,
  Textarea,
} from "../admin-ui/form";
import { Icon } from "../admin-ui/icon";
import { Modal } from "../admin-ui/modal";
import { InfoBox, StatGrid } from "../admin-ui/stat-box";
import { useToast } from "../admin-ui/toast";
import { moneyCell, numberCell } from "./admin-report-views";

/*
 * Ombor — zaxira va harakatlar.
 *
 * TUZATILGAN NUQSONLAR.
 *
 * 1. "Harakat qo'shish" tugmasi ombor yoki ingredient yo'q bo'lganda
 *    o'chirilardi va SABABI `title` atributida turardi — O'CHIRILGAN
 *    elementda. Brauzer o'chirilgan tugmada tooltip ko'rsatmaydi va
 *    klaviatura fokusi ham unga tushmaydi, ya'ni sabab hech kimga
 *    ko'rinmasdi. Endi `GuardedButton` ishlatiladi: u sababni `sr-only`
 *    matn sifatida ham beradi, tashqi o'ramga esa `title` qo'yadi.
 *
 * 2. Validatsiya toast'ga ketardi. Endi xato maydon yonida
 *    (`FormField error`) va fokus birinchi noto'g'ri maydonga o'tadi.
 *
 * 3. Filtrlar mijoz tomonida edi. `InventoryQueryDto` da `branchId`,
 *    `ingredientId`, `type`, `from`, `to` va `limit` bor — endi ular
 *    serverga yuboriladi.
 *
 * BACKEND CHEKLOVI, ochiq aytilgan. `CreateStockMovementDto.quantity` da
 * `@Min(0.001)` bor va ishorani server o'zi qo'yadi — FAQAT `OUT` va
 * `WASTE` uchun minus. Ya'ni `ADJUSTMENT` shu API orqali qoldiqni faqat
 * OSHIRA oladi, kamaytira olmaydi. Forma shuni aytadi va kamaytirish uchun
 * `OUT`/`WASTE` ni taklif qiladi. Inventarizatsiya (stock-take) va kam
 * qoldiq uchun alohida endpoint yo'q — "Kam qoldi" filtri shu sababdan
 * mijoz tomonida.
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
  ADJUSTMENT: "Tuzatish (faqat oshirish)",
  WASTE: "Yo'qotish",
};

/** Jadvaldagi qisqa nom — yorliq uzun bo'lsa ustun kengayib ketardi. */
const movementTypeShort: Record<MovementType, string> = {
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

type MovementForm = {
  warehouseId: string;
  ingredientId: string;
  type: MovementType;
  quantity: string;
  reason: string;
};

type IngredientForm = {
  name: string;
  unit: string;
  minimumStock: string;
  costPerUnit: string;
};

type WarehouseForm = { branchId: string; name: string };

const emptyIngredientDraft: IngredientForm = {
  name: "",
  unit: "KG",
  minimumStock: "0",
  costPerUnit: "0",
};

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

/** Harakat miqdori serverdan ISHORALI keladi — chiqim manfiy. */
function quantityLabel(movement: Movement): string {
  const numeric = Number(movement.quantity);
  const unit = movement.ingredient?.unit ?? "";

  if (!Number.isFinite(numeric)) {
    return "—";
  }

  return `${numeric > 0 ? "+" : ""}${numeric} ${unit}`.trim();
}

const movementLimits = [50, 100, 200, 500];

export function AdminInventoryPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const canCreate = hasPermission(user, "INVENTORY_CREATE");
  const canEdit = hasPermission(user, "INVENTORY_EDIT");
  const showBranchFilter = canSwitchBranch(user);

  const [branchId, setBranchId] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [movementType, setMovementType] = useState("");
  const [movementIngredient, setMovementIngredient] = useState("");
  const [movementLimit, setMovementLimit] = useState(100);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isIngredientOpen, setIsIngredientOpen] = useState(false);
  const [isWarehouseOpen, setIsWarehouseOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [form, setForm] = useState<MovementForm>({
    warehouseId: "",
    ingredientId: "",
    type: "IN",
    quantity: "",
    reason: "",
  });
  const [formErrors, setFormErrors] = useState<
    Partial<Record<keyof MovementForm, string>>
  >({});
  const movementFormRef = useRef<HTMLFormElement>(null);

  const [ingredientDraft, setIngredientDraft] =
    useState<IngredientForm>(emptyIngredientDraft);
  const [ingredientErrors, setIngredientErrors] = useState<
    Partial<Record<keyof IngredientForm, string>>
  >({});
  const ingredientFormRef = useRef<HTMLFormElement>(null);

  const [warehouseDraft, setWarehouseDraft] = useState<WarehouseForm>({
    branchId: "",
    name: "",
  });
  const [warehouseErrors, setWarehouseErrors] = useState<
    Partial<Record<keyof WarehouseForm, string>>
  >({});
  const warehouseFormRef = useRef<HTMLFormElement>(null);

  const branchQuery = branchId ? `?branchId=${encodeURIComponent(branchId)}` : "";

  const {
    data: stockData,
    isLoading: isStockLoading,
    error: stockError,
    reload: reloadStock,
  } = useApiResource<StockRow[]>(
    () => apiFetch<StockRow[]>(`/inventory/stock${branchQuery}`),
    [branchQuery],
    "Zaxirani yuklab bo'lmadi.",
  );

  const movementParams = useMemo(() => {
    const params = new URLSearchParams({ limit: String(movementLimit) });
    if (branchId) params.set("branchId", branchId);
    if (movementType) params.set("type", movementType);
    if (movementIngredient) params.set("ingredientId", movementIngredient);
    return params.toString();
  }, [branchId, movementIngredient, movementLimit, movementType]);

  const {
    data: movementData,
    isLoading: isMovementLoading,
    error: movementError,
    reload: reloadMovements,
  } = useApiResource<Movement[]>(
    () => apiFetch<Movement[]>(`/inventory/movements?${movementParams}`),
    [movementParams],
    "Harakatlarni yuklab bo'lmadi.",
  );

  const { data: warehouseData, reload: reloadWarehouses } = useApiResource<
    Warehouse[]
  >(
    () => apiFetch<Warehouse[]>(`/inventory/warehouses${branchQuery}`),
    [branchQuery],
    "Omborlarni yuklab bo'lmadi.",
  );

  /* Ingredientlar GLOBAL — backend bu endpoint'da filial filtri qabul qilmaydi. */
  const { data: ingredientData, reload: reloadIngredients } = useApiResource<
    Ingredient[]
  >(
    () => apiFetch<Ingredient[]>("/inventory/ingredients"),
    [],
    "Ingredientlarni yuklab bo'lmadi.",
  );

  const { data: branchData } = useApiResource<InventoryBranch[]>(
    () => apiFetch<InventoryBranch[]>("/branches"),
    [],
    "Filiallarni yuklab bo'lmadi.",
  );

  const stock = stockData ?? [];
  const movements = movementData ?? [];
  const warehouses = warehouseData ?? [];
  const ingredients = ingredientData ?? [];
  const branches = branchData ?? [];

  const reloadAll = useCallback(() => {
    reloadStock();
    reloadMovements();
    reloadWarehouses();
    reloadIngredients();
  }, [reloadIngredients, reloadMovements, reloadStock, reloadWarehouses]);

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

  /*
   * Harakat tugmasining o'chirilish SABABI. `GuardedButton` uni ko'rinadigan
   * qiladi — `title` o'chirilgan tugmada hech kimga yetib bormasdi.
   */
  const movementBlockedReason = !canEdit
    ? "Zaxira harakati yozish uchun INVENTORY_EDIT ruxsati kerak."
    : warehouses.length === 0 && ingredients.length === 0
      ? "Avval kamida bitta ombor va bitta ingredient qo'shing."
      : warehouses.length === 0
        ? "Avval kamida bitta ombor qo'shing."
        : ingredients.length === 0
          ? "Avval kamida bitta ingredient qo'shing."
          : null;

  function openMovementForm(): void {
    setForm({
      warehouseId: warehouses[0]?.id ?? "",
      ingredientId: ingredients[0]?.id ?? "",
      type: "IN",
      quantity: "",
      reason: "",
    });
    setFormErrors({});
    setIsFormOpen(true);
  }

  function openWarehouseForm(): void {
    setWarehouseDraft({ branchId: branchId || (branches[0]?.id ?? ""), name: "" });
    setWarehouseErrors({});
    setIsWarehouseOpen(true);
  }

  function openIngredientForm(): void {
    setIngredientDraft(emptyIngredientDraft);
    setIngredientErrors({});
    setIsIngredientOpen(true);
  }

  function failureMessage(caught: unknown, fallback: string): string {
    return caught instanceof Error ? caught.message : fallback;
  }

  async function submitMovement(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();

    const quantity = Number(form.quantity);
    const next: Partial<Record<keyof MovementForm, string>> = {};

    if (!form.warehouseId) next.warehouseId = "Omborni tanlang.";
    if (!form.ingredientId) next.ingredientId = "Ingredientni tanlang.";

    if (form.quantity.trim() === "") {
      next.quantity = "Miqdorni kiriting.";
    } else if (!Number.isFinite(quantity) || quantity < 0.001) {
      next.quantity = "Miqdor 0.001 dan kichik bo'lmasligi kerak.";
    }

    if ((form.type === "WASTE" || form.type === "ADJUSTMENT") && !form.reason.trim()) {
      next.reason =
        "Yo'qotish va tuzatish uchun sabab yozilishi shart — bu zaxira auditi yozuvi.";
    }

    setFormErrors(next);

    if (Object.keys(next).length > 0) {
      requestAnimationFrame(() =>
        focusFirstInvalidField(movementFormRef.current),
      );
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
          ...(form.reason.trim() ? { reason: form.reason.trim() } : {}),
        }),
      });
      showToast(`${movementTypeShort[form.type]} yozildi.`, "success");
      setIsFormOpen(false);
      setFormErrors({});
      reloadAll();
    } catch (caught) {
      if (caught instanceof SessionExpiredError) {
        return;
      }

      /* "Stock cannot go below zero" — bu aynan miqdor maydonining xatosi. */
      setFormErrors({
        quantity: failureMessage(caught, "Harakat yozilmadi."),
      });
      requestAnimationFrame(() =>
        focusFirstInvalidField(movementFormRef.current),
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function submitIngredient(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();

    const next: Partial<Record<keyof IngredientForm, string>> = {};
    const minimum = Number(ingredientDraft.minimumStock);
    const cost = Number(ingredientDraft.costPerUnit);

    if (!ingredientDraft.name.trim()) {
      next.name = "Ingredient nomi kerak.";
    } else if (ingredientDraft.name.trim().length > 100) {
      next.name = "Nom 100 belgidan oshmasligi kerak.";
    }

    if (!Number.isFinite(minimum) || minimum < 0) {
      next.minimumStock = "Minimal zaxira 0 yoki katta son bo'lishi kerak.";
    }

    if (!Number.isFinite(cost) || cost < 0) {
      next.costPerUnit = "Tannarx 0 yoki katta son bo'lishi kerak.";
    }

    setIngredientErrors(next);

    if (Object.keys(next).length > 0) {
      requestAnimationFrame(() =>
        focusFirstInvalidField(ingredientFormRef.current),
      );
      return;
    }

    setIsSaving(true);

    try {
      await apiFetch("/inventory/ingredients", {
        method: "POST",
        body: JSON.stringify({
          name: ingredientDraft.name.trim(),
          unit: ingredientDraft.unit,
          minimumStock: minimum,
          costPerUnit: cost,
        }),
      });
      showToast("Ingredient qo'shildi.", "success");
      setIsIngredientOpen(false);
      setIngredientDraft(emptyIngredientDraft);
      reloadAll();
    } catch (caught) {
      if (caught instanceof SessionExpiredError) {
        return;
      }

      setIngredientErrors({
        name: failureMessage(caught, "Ingredient qo'shilmadi."),
      });
      requestAnimationFrame(() =>
        focusFirstInvalidField(ingredientFormRef.current),
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function submitWarehouse(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();

    const next: Partial<Record<keyof WarehouseForm, string>> = {};

    if (!warehouseDraft.branchId) next.branchId = "Filialni tanlang.";

    if (!warehouseDraft.name.trim()) {
      next.name = "Ombor nomi kerak.";
    } else if (warehouseDraft.name.trim().length > 100) {
      next.name = "Nom 100 belgidan oshmasligi kerak.";
    }

    setWarehouseErrors(next);

    if (Object.keys(next).length > 0) {
      requestAnimationFrame(() =>
        focusFirstInvalidField(warehouseFormRef.current),
      );
      return;
    }

    setIsSaving(true);

    try {
      await apiFetch("/inventory/warehouses", {
        method: "POST",
        body: JSON.stringify({
          branchId: warehouseDraft.branchId,
          name: warehouseDraft.name.trim(),
        }),
      });
      showToast("Ombor qo'shildi.", "success");
      setIsWarehouseOpen(false);
      reloadAll();
    } catch (caught) {
      if (caught instanceof SessionExpiredError) {
        return;
      }

      setWarehouseErrors({
        name: failureMessage(caught, "Ombor qo'shilmadi."),
      });
      requestAnimationFrame(() =>
        focusFirstInvalidField(warehouseFormRef.current),
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
          <p className="truncate text-[13px] text-mz-text-muted">
            {row.warehouse.name}
          </p>
        </div>
      ),
    },
    {
      key: "quantity",
      header: "Qoldiq",
      align: "right",
      render: (row) => (
        <span className={numberCell}>
          {row.currentQuantity} {row.ingredient.unit}
        </span>
      ),
    },
    {
      key: "minimum",
      header: "Minimal",
      align: "right",
      hideOnMobile: true,
      render: (row) => (
        <span className={numberCell}>
          {row.minimumQuantity} {row.ingredient.unit}
        </span>
      ),
    },
    {
      key: "value",
      header: "Qiymat",
      align: "right",
      hideOnMobile: true,
      render: (row) => (
        <span className={moneyCell}>
          {formatMoney(
            Number(row.currentQuantity) * Number(row.ingredient.costPerUnit),
          )}
        </span>
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
          <p className="truncate text-[13px] text-mz-text-muted">
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
          {movementTypeShort[movement.type] ?? movement.type}
        </Badge>
      ),
    },
    {
      key: "quantity",
      header: "Miqdor",
      align: "right",
      render: (movement) => {
        const numeric = Number(movement.quantity);

        return (
          <span
            className={`tabular-nums font-semibold ${
              numeric < 0 ? "text-mz-danger" : "text-mz-text"
            }`}
          >
            {quantityLabel(movement)}
          </span>
        );
      },
    },
    {
      key: "who",
      header: "Kim",
      hideOnMobile: true,
      render: (movement) => (
        <span className="text-[13px] text-mz-text-muted">
          {movement.createdBy?.displayName ?? "—"}
        </span>
      ),
    },
    {
      key: "reason",
      header: "Sabab",
      hideOnMobile: true,
      render: (movement) => (
        <span className="text-[13px] text-mz-text-muted">
          {movement.reason ?? "—"}
        </span>
      ),
    },
  ];

  return (
    <div className="grid gap-5">
      {stockError ? (
        <ErrorState message={stockError} onRetry={() => reloadStock()} />
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
          description="Qoldiq × birlik tannarxi"
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
                    onClick={openIngredientForm}
                    size="sm"
                    variant="ghost"
                  >
                    <Icon className="h-4 w-4" name="plus" />
                    Ingredient
                  </Button>
                  <Button onClick={openWarehouseForm} size="sm" variant="ghost">
                    <Icon className="h-4 w-4" name="plus" />
                    Ombor
                  </Button>
                </>
              ) : null}
              <GuardedButton
                blockedReason={movementBlockedReason}
                onClick={openMovementForm}
                size="lg"
              >
                Harakat qo&apos;shish
              </GuardedButton>
            </>
          }
          description="Ombor bo'yicha ingredient qoldiqlari"
          title="Zaxira"
        />

        <FilterBar>
          <div className="min-w-52 flex-1">
            <FormField label="Qidirish">
              {(props) => (
                <TextInput
                  {...props}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Ingredient yoki ombor nomi"
                  value={search}
                />
              )}
            </FormField>
          </div>

          <div className="w-44">
            <FormField label="Holat">
              {(props) => (
                <Select
                  {...props}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  value={statusFilter}
                >
                  <option value="">Barcha holatlar</option>
                  {Object.entries(stockStatusLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              )}
            </FormField>
          </div>

          {showBranchFilter ? (
            <div className="w-56">
              <FormField label="Filial">
                {(props) => (
                  <Select
                    {...props}
                    onChange={(event) => setBranchId(event.target.value)}
                    value={branchId}
                  >
                    <option value="">Barcha filiallar</option>
                    {branches.map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name}
                      </option>
                    ))}
                  </Select>
                )}
              </FormField>
            </div>
          ) : null}
        </FilterBar>

        <DataTable
          caption="Zaxira qoldiqlari"
          columns={stockColumns}
          emptyDescription={
            stock.length > 0
              ? "Qidiruv yoki holat filtriga mos qator yo'q."
              : "Ombor yoki ingredient qo'shilmagan bo'lishi mumkin."
          }
          emptyIcon="boxes"
          emptyTitle="Zaxira qatori yo'q"
          getRowKey={(row) => row.id}
          isLoading={isStockLoading}
          rows={filteredStock}
        />

        <CardBody className="border-t border-mz-border">
          <p className="text-[13px] text-mz-text-muted">
            Qidiruv va holat filtri shu ro&apos;yxat ichida ishlaydi: backend
            zaxirani sahifalamaydi va &quot;kam qoldi&quot; uchun alohida
            endpoint bermaydi.
          </p>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          description="Kirim, chiqim, tuzatish va yo'qotishlar"
          title="Harakatlar"
        />

        <FilterBar>
          <div className="w-48">
            <FormField label="Harakat turi">
              {(props) => (
                <Select
                  {...props}
                  onChange={(event) => setMovementType(event.target.value)}
                  value={movementType}
                >
                  <option value="">Barcha turlar</option>
                  {Object.entries(movementTypeShort).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              )}
            </FormField>
          </div>

          <div className="w-56">
            <FormField label="Ingredient">
              {(props) => (
                <Select
                  {...props}
                  onChange={(event) => setMovementIngredient(event.target.value)}
                  value={movementIngredient}
                >
                  <option value="">Barcha ingredientlar</option>
                  {ingredients.map((ingredient) => (
                    <option key={ingredient.id} value={ingredient.id}>
                      {ingredient.name}
                    </option>
                  ))}
                </Select>
              )}
            </FormField>
          </div>

          <div className="w-40">
            <FormField hint="Sahifalash yo'q" label="Ko'rsatish">
              {(props) => (
                <Select
                  {...props}
                  onChange={(event) =>
                    setMovementLimit(Number(event.target.value))
                  }
                  value={String(movementLimit)}
                >
                  {movementLimits.map((limit) => (
                    <option key={limit} value={limit}>
                      Oxirgi {limit} ta
                    </option>
                  ))}
                </Select>
              )}
            </FormField>
          </div>
        </FilterBar>

        {movementError ? (
          <CardBody>
            <ErrorState
              message={movementError}
              onRetry={() => reloadMovements()}
            />
          </CardBody>
        ) : (
          <DataTable
            caption="Zaxira harakatlari"
            columns={movementColumns}
            emptyDescription="Tanlangan filtr bo'yicha harakat qayd etilmagan."
            emptyIcon="boxes"
            emptyTitle="Harakat yo'q"
            getRowKey={(movement) => movement.id}
            isLoading={isMovementLoading}
            rows={movements}
          />
        )}
      </Card>

      <Modal
        description="Miqdor doim MUSBAT kiritiladi — chiqim va yo'qotish uchun ishorani server qo'yadi."
        dismissOnBackdrop={false}
        footer={
          <>
            <Button onClick={() => setIsFormOpen(false)} variant="ghost">
              Bekor qilish
            </Button>
            <Button
              form="movement-form"
              isLoading={isSaving}
              size="lg"
              type="submit"
            >
              Yozish
            </Button>
          </>
        }
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title="Zaxira harakati"
      >
        <form
          className="grid gap-3"
          id="movement-form"
          onSubmit={submitMovement}
          ref={movementFormRef}
        >
          <FormField
            {...(formErrors.warehouseId ? { error: formErrors.warehouseId } : {})}
            label="Ombor"
            required
          >
            {(props) => (
              <Select
                {...props}
                onChange={(event) =>
                  setForm({ ...form, warehouseId: event.target.value })
                }
                value={form.warehouseId}
              >
                <option value="">Tanlang…</option>
                {warehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.name}
                    {warehouse.branch ? ` · ${warehouse.branch.name}` : ""}
                  </option>
                ))}
              </Select>
            )}
          </FormField>

          <FormField
            {...(formErrors.ingredientId
              ? { error: formErrors.ingredientId }
              : {})}
            label="Ingredient"
            required
          >
            {(props) => (
              <Select
                {...props}
                onChange={(event) =>
                  setForm({ ...form, ingredientId: event.target.value })
                }
                value={form.ingredientId}
              >
                <option value="">Tanlang…</option>
                {ingredients.map((ingredient) => (
                  <option key={ingredient.id} value={ingredient.id}>
                    {ingredient.name} ({ingredient.unit})
                  </option>
                ))}
              </Select>
            )}
          </FormField>

          <div className="grid gap-3 sm:grid-cols-2">
            <FormField
              {...(form.type === "ADJUSTMENT"
                ? {
                    hint: "Tuzatish qoldiqni faqat OSHIRADI. Kamaytirish uchun Chiqim yoki Yo'qotish tanlang.",
                  }
                : {})}
              label="Harakat turi"
              required
            >
              {(props) => (
                <Select
                  {...props}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      type: event.target.value as MovementType,
                    })
                  }
                  value={form.type}
                >
                  {Object.entries(movementTypeLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              )}
            </FormField>

            <FormField
              {...(formErrors.quantity ? { error: formErrors.quantity } : {})}
              label="Miqdor"
              required
            >
              {(props) => (
                <TextInput
                  {...props}
                  inputMode="decimal"
                  min={0.001}
                  onChange={(event) =>
                    setForm({ ...form, quantity: event.target.value })
                  }
                  step={0.001}
                  type="number"
                  value={form.quantity}
                />
              )}
            </FormField>
          </div>

          <FormField
            {...(formErrors.reason ? { error: formErrors.reason } : {})}
            hint="Yo'qotish va tuzatish uchun majburiy — audit yozuvi."
            label="Sabab"
            required={form.type === "WASTE" || form.type === "ADJUSTMENT"}
          >
            {(props) => (
              <Textarea
                {...props}
                maxLength={500}
                onChange={(event) =>
                  setForm({ ...form, reason: event.target.value })
                }
                value={form.reason}
              />
            )}
          </FormField>
        </form>
      </Modal>

      <Modal
        dismissOnBackdrop={false}
        footer={
          <>
            <Button onClick={() => setIsIngredientOpen(false)} variant="ghost">
              Bekor qilish
            </Button>
            <Button
              form="ingredient-form"
              isLoading={isSaving}
              size="lg"
              type="submit"
            >
              Qo&apos;shish
            </Button>
          </>
        }
        isOpen={isIngredientOpen}
        onClose={() => setIsIngredientOpen(false)}
        title="Yangi ingredient"
      >
        <form
          className="grid gap-3"
          id="ingredient-form"
          onSubmit={submitIngredient}
          ref={ingredientFormRef}
        >
          <FormField
            {...(ingredientErrors.name ? { error: ingredientErrors.name } : {})}
            label="Nomi"
            required
          >
            {(props) => (
              <TextInput
                {...props}
                maxLength={100}
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

          <FormField
            hint="Yaratilgandan keyin o'zgartirilmaydi — backend'da tahrirlash yo'q."
            label="O'lchov birligi"
            required
          >
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

          <div className="grid gap-3 sm:grid-cols-2">
            <FormField
              {...(ingredientErrors.minimumStock
                ? { error: ingredientErrors.minimumStock }
                : {})}
              hint="Shu miqdordan pastda 'Kam qoldi' deb belgilanadi"
              label="Minimal zaxira"
            >
              {(props) => (
                <TextInput
                  {...props}
                  inputMode="decimal"
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
              {...(ingredientErrors.costPerUnit
                ? { error: ingredientErrors.costPerUnit }
                : {})}
              hint="Zaxira qiymatini hisoblashda ishlatiladi"
              label="Birlik tannarxi"
            >
              {(props) => (
                <TextInput
                  {...props}
                  inputMode="decimal"
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
        </form>
      </Modal>

      <Modal
        dismissOnBackdrop={false}
        footer={
          <>
            <Button onClick={() => setIsWarehouseOpen(false)} variant="ghost">
              Bekor qilish
            </Button>
            <Button
              form="warehouse-form"
              isLoading={isSaving}
              size="lg"
              type="submit"
            >
              Qo&apos;shish
            </Button>
          </>
        }
        isOpen={isWarehouseOpen}
        onClose={() => setIsWarehouseOpen(false)}
        title="Yangi ombor"
      >
        <form
          className="grid gap-3"
          id="warehouse-form"
          onSubmit={submitWarehouse}
          ref={warehouseFormRef}
        >
          <FormField
            {...(warehouseErrors.branchId
              ? { error: warehouseErrors.branchId }
              : {})}
            label="Filial"
            required
          >
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
                <option value="">Tanlang…</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </Select>
            )}
          </FormField>

          <FormField
            {...(warehouseErrors.name ? { error: warehouseErrors.name } : {})}
            label="Nomi"
            required
          >
            {(props) => (
              <TextInput
                {...props}
                maxLength={100}
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
        </form>
      </Modal>
    </div>
  );
}
