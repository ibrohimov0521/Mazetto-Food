"use client";

import { useEffect, useMemo, useState } from "react";
import { AdminPageHeader } from "../../../../components/admin-shell/admin-page-header";
import { useAuth } from "../../../../components/auth/auth-provider";
import { Badge } from "../../../../components/admin-ui/badge";
import { Button } from "../../../../components/admin-ui/button";
import {
  Card,
  CardBody,
  CardHeader,
} from "../../../../components/admin-ui/card";
import {
  EmptyState,
  ErrorState,
  SkeletonRows,
} from "../../../../components/admin-ui/feedback";
import {
  FormField,
  Select,
  TextInput,
} from "../../../../components/admin-ui/form";
import { Icon } from "../../../../components/admin-ui/icon";
import { Modal } from "../../../../components/admin-ui/modal";
import { useToast } from "../../../../components/admin-ui/toast";
import { apiFetch, SessionExpiredError } from "../../../../lib/api";
import { hasPermission } from "../../../../lib/auth";
import { useApiResource } from "../../../../lib/use-api-resource";

/*
 * RETSEPTLAR.
 *
 * Ilgari bu ekran:
 *   - to'liq INGLIZ tilida edi ("Product variant", "Add", "Save recipe",
 *     "Qty") — panelning qolgan qismi o'zbekcha;
 *   - ingredientni ID bilan QO'LDA yozishni talab qilardi
 *     (`placeholder="Ingredient ID"`), holbuki `GET /inventory/ingredients`
 *     ro'yxatni beradi;
 *   - yorliq o'rniga faqat placeholder ishlatardi;
 *   - tanlangan variantning MAVJUD retseptini yuklamasdi. `PUT /recipes`
 *     esa `recipeItem.deleteMany` qiladi, ya'ni bo'sh ro'yxat bilan saqlash
 *     mavjud retseptni JIMGINA o'chirib tashlardi;
 *   - yuklanish, xato va band holatlari yo'q edi, `apiFetch` xatosi
 *     yuqoriga otilardi;
 *   - 1024–1279px da `lg:grid-cols-[1fr_420px]` tashqi setka ichida
 *     `md:grid-cols-[1fr_120px_140px_auto]` qatori kartochkadan chiqib
 *     ketardi (~420px joyga ~520px talab). Endi ikki ustunli tartib faqat
 *     `xl` dan boshlanadi, ingredient qatori esa `sm`/`lg` da bosqichma-
 *     bosqich ochiladi.
 */

type Product = {
  id: string;
  name: string;
  variants: { id: string; name: string; sellingPrice: string }[];
};

type Ingredient = {
  id: string;
  name: string;
  unit: IngredientUnit;
  costPerUnit?: string | null;
};

type IngredientUnit = "KG" | "GRAM" | "LITER" | "PIECE";

type Recipe = {
  id: string;
  variantId: string;
  variant: { id: string; name: string; product: { id: string; name: string } };
  items: {
    id: string;
    quantity: string;
    unit: IngredientUnit;
    ingredient: { id: string; name: string; unit?: IngredientUnit };
  }[];
};

type DraftItem = {
  ingredientId: string;
  quantity: string;
  unit: IngredientUnit;
};

const unitLabels: Record<IngredientUnit, string> = {
  GRAM: "gramm",
  KG: "kg",
  LITER: "litr",
  PIECE: "dona",
};

export default function AdminRecipesPage() {
  return (
    <>
      <AdminPageHeader
        breadcrumbs={[
          { label: "Admin", href: "/admin/dashboard" },
          { label: "Ombor" },
          { label: "Retseptlar" },
        ]}
        description="Mahsulot variantlari uchun ingredient tarkibi"
        title="Retseptlar"
      />
      <RecipeBuilder />
    </>
  );
}

function RecipeBuilder() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const canManage = hasPermission(user, "RECIPE_MANAGE");

  const [variantId, setVariantId] = useState("");
  const [items, setItems] = useState<DraftItem[]>([]);
  const [baseline, setBaseline] = useState("[]");
  const [ingredientId, setIngredientId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState<IngredientUnit>("GRAM");
  const [rowError, setRowError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isWipeOpen, setIsWipeOpen] = useState(false);

  const {
    data,
    isLoading,
    error,
    reload: load,
  } = useApiResource(
    async () => {
      const [products, recipes, ingredients] = await Promise.all([
        apiFetch<Product[]>("/menu/products?includeInactive=true"),
        apiFetch<Recipe[]>("/recipes"),
        apiFetch<Ingredient[]>("/inventory/ingredients"),
      ]);

      return { products, recipes, ingredients };
    },
    [],
    "Retsept ma'lumotlarini yuklab bo'lmadi.",
  );

  const products = data?.products ?? [];
  const recipes = data?.recipes ?? [];
  const ingredients = data?.ingredients ?? [];

  const variants = useMemo(
    () =>
      products.flatMap((product) =>
        product.variants.map((variant) => ({
          id: variant.id,
          label: `${product.name} · ${variant.name}`,
        })),
      ),
    [products],
  );

  const currentRecipe = recipes.find((recipe) => recipe.variantId === variantId);

  /*
   * Tanlangan variant o'zgarganda forma SERVERDAGI retsept bilan
   * to'ldiriladi. Bu jimgina o'chirib yuborishning oldini oladi: `PUT`
   * barcha qatorlarni almashtiradi, ya'ni ekranda ko'rinmagan qator
   * saqlashda yo'qoladi.
   */
  useEffect(() => {
    if (!data) {
      return;
    }

    const nextVariantId = variantId || variants[0]?.id || "";

    if (nextVariantId !== variantId) {
      setVariantId(nextVariantId);
      return;
    }

    const recipe = recipes.find((entry) => entry.variantId === nextVariantId);
    const nextItems: DraftItem[] = (recipe?.items ?? []).map((item) => ({
      ingredientId: item.ingredient.id,
      quantity: String(item.quantity),
      unit: item.unit,
    }));

    setItems(nextItems);
    setBaseline(JSON.stringify(nextItems));
    setRowError("");
    /*
     * Bog'liqlik faqat `data` va `variantId`: `recipes` va `variants`
     * ikkisi ham `data` dan hosil bo'ladi, ya'ni qo'shimcha bog'liqlik
     * bir xil effektni ikki marta ishga tushirardi.
     */
  }, [data, variantId]);

  const isDirty = JSON.stringify(items) !== baseline;

  function ingredientName(id: string): string {
    return ingredients.find((entry) => entry.id === id)?.name ?? id;
  }

  function addItem(): void {
    if (!ingredientId) {
      setRowError("Ingredientni tanlang.");
      return;
    }

    const parsed = Number(quantity);

    if (!Number.isFinite(parsed) || parsed < 0.001) {
      setRowError("Miqdor kamida 0.001 bo'lishi kerak.");
      return;
    }

    if (items.some((item) => item.ingredientId === ingredientId)) {
      setRowError("Bu ingredient allaqachon ro'yxatda — miqdorini tahrirlang.");
      return;
    }

    setItems((current) => [
      ...current,
      { ingredientId, quantity: String(parsed), unit },
    ]);
    setIngredientId("");
    setQuantity("");
    setRowError("");
  }

  function removeItem(index: number): void {
    setItems((current) => current.filter((_, position) => position !== index));
  }

  function updateItem(index: number, patch: Partial<DraftItem>): void {
    setItems((current) =>
      current.map((item, position) =>
        position === index ? { ...item, ...patch } : item,
      ),
    );
  }

  async function submit(): Promise<void> {
    if (!variantId) {
      return;
    }

    const invalid = items.find((item) => Number(item.quantity) < 0.001);

    if (invalid) {
      setRowError(
        `${ingredientName(invalid.ingredientId)} miqdori kamida 0.001 bo'lishi kerak.`,
      );
      return;
    }

    // Bo'sh ro'yxat bilan saqlash mavjud retseptni O'CHIRADI — tasdiqlanadi.
    if (items.length === 0 && currentRecipe) {
      setIsWipeOpen(true);
      return;
    }

    await save();
  }

  async function save(): Promise<void> {
    setIsSaving(true);
    setIsWipeOpen(false);

    try {
      await apiFetch("/recipes", {
        method: "PUT",
        body: JSON.stringify({
          variantId,
          items: items.map((item) => ({
            ingredientId: item.ingredientId,
            quantity: Number(item.quantity),
            unit: item.unit,
          })),
        }),
      });
      showToast("Retsept saqlandi.", "success");
      setBaseline(JSON.stringify(items));
      load();
    } catch (caught) {
      if (caught instanceof SessionExpiredError) {
        return;
      }

      showToast(
        caught instanceof Error ? caught.message : "Saqlab bo'lmadi.",
        "danger",
      );
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading && !data) {
    return <SkeletonRows rows={8} />;
  }

  if (error && !data) {
    return <ErrorState message={error} onRetry={() => load()} />;
  }

  return (
    <div className="grid gap-4">
      {error ? <ErrorState message={error} onRetry={() => load()} /> : null}

      {variants.length === 0 ? (
        <Card>
          <EmptyState
            description="Retsept mahsulot variantiga bog'lanadi. Avval katalogda variantli mahsulot yarating."
            icon="utensils"
            title="Variant yo'q"
          />
        </Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
          <Card>
            <CardHeader
              description={
                currentRecipe
                  ? "Mavjud retsept yuklandi — saqlash butun tarkibni almashtiradi"
                  : "Bu variant uchun retsept hali yo'q"
              }
              title="Retsept tarkibi"
            />
            <CardBody className="grid gap-4">
              <FormField
                hint="Retsept aynan variantga bog'lanadi (masalan Katta / Kichik)"
                label="Mahsulot varianti"
              >
                {(props) => (
                  <Select
                    {...props}
                    onChange={(event) => setVariantId(event.target.value)}
                    value={variantId}
                  >
                    {variants.map((variant) => (
                      <option key={variant.id} value={variant.id}>
                        {variant.label}
                      </option>
                    ))}
                  </Select>
                )}
              </FormField>

              {ingredients.length === 0 ? (
                <div className="rounded-mz-control border border-mz-border bg-mz-surface-sunken p-3 text-[13px] text-mz-text-muted">
                  Ingredient ro&apos;yxati bo&apos;sh. Ingredientlar ombor
                  bo&apos;limida yaratiladi.
                </div>
              ) : canManage ? (
                <fieldset className="grid gap-3 rounded-mz-control bg-mz-info-bg/60 p-3">
                  <legend className="px-1 text-[13px] font-semibold text-mz-text">
                    Ingredient qo&apos;shish
                  </legend>
                  {/*
                    Qator BOSQICHMA-BOSQICH ochiladi: 375px da hamma maydon
                    ustma-ust, `sm` da miqdor va birlik yonma-yon, `lg` da
                    to'rt ustun. Ilgari `md` da to'rt ustun majburlanardi va
                    1024px da kartochkadan chiqib ketardi.
                  */}
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_120px_130px_auto]">
                    <div className="sm:col-span-2 lg:col-span-1">
                      <FormField label="Ingredient">
                        {(props) => (
                          <Select
                            {...props}
                            onChange={(event) => {
                              setIngredientId(event.target.value);
                              const picked = ingredients.find(
                                (entry) => entry.id === event.target.value,
                              );

                              // Ingredient o'z birligi bilan keladi — uni
                              // qo'lda tanlashga majburlash xato manbai edi.
                              if (picked) {
                                setUnit(picked.unit);
                              }
                            }}
                            value={ingredientId}
                          >
                            <option value="">Tanlang…</option>
                            {ingredients.map((ingredient) => (
                              <option key={ingredient.id} value={ingredient.id}>
                                {ingredient.name} ({unitLabels[ingredient.unit]}
                                )
                              </option>
                            ))}
                          </Select>
                        )}
                      </FormField>
                    </div>
                    <FormField label="Miqdor">
                      {(props) => (
                        <TextInput
                          {...props}
                          min="0.001"
                          onChange={(event) => setQuantity(event.target.value)}
                          step="0.001"
                          type="number"
                          value={quantity}
                        />
                      )}
                    </FormField>
                    <FormField label="Birlik">
                      {(props) => (
                        <Select
                          {...props}
                          onChange={(event) =>
                            setUnit(event.target.value as IngredientUnit)
                          }
                          value={unit}
                        >
                          {Object.entries(unitLabels).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </Select>
                      )}
                    </FormField>
                    <div className="flex items-end sm:col-span-2 lg:col-span-1">
                      <Button
                        className="w-full lg:w-auto"
                        onClick={addItem}
                        variant="ghost"
                      >
                        <Icon className="h-4 w-4" name="plus" />
                        Qo&apos;shish
                      </Button>
                    </div>
                  </div>
                  {rowError ? (
                    <p
                      className="text-[13px] font-medium text-mz-danger"
                      role="alert"
                    >
                      {rowError}
                    </p>
                  ) : null}
                </fieldset>
              ) : null}

              <div className="grid gap-2">
                {items.length === 0 ? (
                  <EmptyState
                    description={
                      canManage
                        ? "Yuqoridagi maydonlardan ingredient qo'shing."
                        : "Bu variant uchun tarkib kiritilmagan."
                    }
                    icon="boxes"
                    title="Tarkib bo'sh"
                  />
                ) : (
                  items.map((item, index) => (
                    <div
                      className="grid gap-2 rounded-mz-control border border-mz-border p-3 sm:grid-cols-[minmax(0,1fr)_120px_auto] sm:items-center"
                      key={item.ingredientId}
                    >
                      <p className="min-w-0 truncate text-sm font-semibold text-mz-text">
                        {ingredientName(item.ingredientId)}
                      </p>
                      {canManage ? (
                        <FormField
                          label={`${ingredientName(item.ingredientId)} miqdori (${unitLabels[item.unit]})`}
                        >
                          {(props) => (
                            <TextInput
                              {...props}
                              min="0.001"
                              onChange={(event) =>
                                updateItem(index, {
                                  quantity: event.target.value,
                                })
                              }
                              step="0.001"
                              type="number"
                              value={item.quantity}
                            />
                          )}
                        </FormField>
                      ) : (
                        <span className="text-sm text-mz-text-muted">
                          {item.quantity} {unitLabels[item.unit]}
                        </span>
                      )}
                      {canManage ? (
                        <Button
                          aria-label={`${ingredientName(item.ingredientId)} — ro'yxatdan olish`}
                          onClick={() => removeItem(index)}
                          variant="ghost"
                        >
                          <Icon className="h-4 w-4" name="trash" />
                          Olib tashlash
                        </Button>
                      ) : null}
                    </div>
                  ))
                )}
              </div>

              {canManage ? (
                <div className="flex flex-wrap items-center justify-end gap-3 border-t border-mz-border pt-3">
                  <p
                    aria-live="polite"
                    className="mr-auto text-[13px] font-medium text-mz-text-muted"
                  >
                    {isDirty
                      ? "Saqlanmagan o'zgarishlar bor"
                      : "Barcha o'zgarishlar saqlangan"}
                  </p>
                  <Button
                    disabled={!isDirty}
                    isLoading={isSaving}
                    onClick={() => void submit()}
                    size="lg"
                  >
                    Retseptni saqlash
                  </Button>
                </div>
              ) : (
                <p className="border-t border-mz-border pt-3 text-[13px] text-mz-text-muted">
                  Retseptni o&apos;zgartirish uchun RECIPE_MANAGE ruxsati
                  kerak.
                </p>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              description={`${recipes.length} ta variantda retsept bor`}
              title="Mavjud retseptlar"
            />
            <CardBody className="grid gap-2">
              {recipes.length === 0 ? (
                <EmptyState
                  description="Birinchi retseptni chapdagi formadan saqlang."
                  icon="book"
                  title="Retsept yo'q"
                />
              ) : (
                recipes.map((recipe) => (
                  <button
                    className={`grid gap-1 rounded-mz-control border p-3 text-left transition ${
                      recipe.variantId === variantId
                        ? "border-mz-accent bg-mz-info-bg"
                        : "border-mz-border bg-mz-surface hover:border-mz-accent"
                    }`}
                    key={recipe.id}
                    onClick={() => setVariantId(recipe.variantId)}
                    type="button"
                  >
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-mz-text">
                        {recipe.variant.product.name}
                      </span>
                      <Badge tone="info">{recipe.variant.name}</Badge>
                    </span>
                    <span className="text-[13px] text-mz-text-muted">
                      {recipe.items.length} ta ingredient
                    </span>
                  </button>
                ))
              )}
            </CardBody>
          </Card>
        </div>
      )}

      <Modal
        description="Bu variantning barcha ingredientlari o'chiriladi. Retsept bo'sh qoladi va tannarx hisobi ishlamaydi."
        footer={
          <>
            <Button onClick={() => setIsWipeOpen(false)} variant="ghost">
              Bekor qilish
            </Button>
            <Button
              isLoading={isSaving}
              onClick={() => void save()}
              variant="danger"
            >
              Tarkibni o&apos;chirish
            </Button>
          </>
        }
        isOpen={isWipeOpen}
        onClose={() => setIsWipeOpen(false)}
        title="Retsept tarkibi bo'shatilsinmi?"
      />
    </div>
  );
}
