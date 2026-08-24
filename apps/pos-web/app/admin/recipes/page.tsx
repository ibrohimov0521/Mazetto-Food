"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { AuthShell } from "../../../components/auth/auth-shell";
import { PermissionGuard } from "../../../components/auth/permission-guard";
import { RoleGuard } from "../../../components/auth/role-guard";
import { EmptyState, ErpPageShell, PrimaryButton, TextInput } from "../../../components/erp/erp-ui";
import { apiFetch } from "../../../lib/api";

type Product = {
  id: string;
  name: string;
  variants: { id: string; name: string; sellingPrice: string }[];
};
type Recipe = {
  id: string;
  variant: { id: string; name: string; product: { name: string } };
  items: { id: string; quantity: string; unit: string; ingredient: { id: string; name: string } }[];
};

export default function AdminRecipesPage() {
  return (
    <RoleGuard roles={["SUPER_ADMIN", "BRANCH_MANAGER"]}>
      <PermissionGuard permission="RECIPE_MANAGE">
        <AuthShell eyebrow="Recipes" title="Recipe builder">
          <RecipeBuilder />
        </AuthShell>
      </PermissionGuard>
    </RoleGuard>
  );
}

function RecipeBuilder() {
  const [products, setProducts] = useState<Product[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [variantId, setVariantId] = useState("");
  const [ingredientId, setIngredientId] = useState("");
  const [quantity, setQuantity] = useState("0");
  const [unit, setUnit] = useState("GRAM");
  const [items, setItems] = useState<{ ingredientId: string; quantity: number; unit: string }[]>([]);

  async function load() {
    const [nextProducts, nextRecipes] = await Promise.all([
      apiFetch<Product[]>("/menu/products"),
      apiFetch<Recipe[]>("/recipes"),
    ]);
    setProducts(nextProducts);
    setRecipes(nextRecipes);
    setVariantId((current) => current || nextProducts.flatMap((product) => product.variants)[0]?.id || "");
  }

  useEffect(() => {
    void load();
  }, []);

  const variants = useMemo(
    () =>
      products.flatMap((product) =>
        product.variants.map((variant) => ({
          ...variant,
          label: `${product.name} · ${variant.name}`,
        })),
      ),
    [products],
  );

  function addRecipeItem() {
    if (!ingredientId || Number(quantity) <= 0) {
      return;
    }

    setItems((current) => [
      ...current,
      { ingredientId, quantity: Number(quantity), unit },
    ]);
    setIngredientId("");
    setQuantity("0");
  }

  async function saveRecipe(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await apiFetch("/recipes", {
      method: "PUT",
      body: JSON.stringify({ variantId, items }),
    });
    setItems([]);
    await load();
  }

  return (
    <ErpPageShell
      title="Recipe management"
      subtitle="Connect sellable product variants to ingredient quantities for automatic stock deduction."
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
        <section className="rounded-3xl border border-neutral-100 bg-white p-5 shadow-[0_14px_45px_rgba(17,24,39,0.08)]">
          <form className="grid gap-4" onSubmit={saveRecipe}>
            <label className="grid gap-2 text-sm font-semibold text-neutral-700">
              Product variant
              <select
                className="rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-950 outline-none"
                value={variantId}
                onChange={(event) => setVariantId(event.target.value)}
              >
                {variants.map((variant) => (
                  <option key={variant.id} value={variant.id}>
                    {variant.label}
                  </option>
                ))}
              </select>
            </label>

            <div className="grid gap-3 rounded-2xl bg-emerald-50/60 p-4 md:grid-cols-[1fr_120px_140px_auto]">
              <TextInput placeholder="Ingredient ID" value={ingredientId} onChange={(event) => setIngredientId(event.target.value)} />
              <TextInput placeholder="Qty" type="number" min="0.001" step="0.001" value={quantity} onChange={(event) => setQuantity(event.target.value)} />
              <select className="rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-950 outline-none" value={unit} onChange={(event) => setUnit(event.target.value)}>
                <option value="GRAM">GRAM</option>
                <option value="KG">KG</option>
                <option value="LITER">LITER</option>
                <option value="PIECE">PIECE</option>
              </select>
              <button className="rounded-2xl border border-emerald-200 bg-white px-4 py-2 text-sm font-semibold text-emerald-800" onClick={addRecipeItem} type="button">
                Add
              </button>
            </div>

            <div className="grid gap-2">
              {items.length ? (
                items.map((item, index) => (
                  <div className="flex items-center justify-between rounded-2xl border border-neutral-100 px-4 py-3 text-sm" key={`${item.ingredientId}-${index}`}>
                    <span className="font-semibold text-neutral-800">{item.ingredientId}</span>
                    <span className="text-neutral-500">{item.quantity} {item.unit}</span>
                  </div>
                ))
              ) : (
                <EmptyState title="Add ingredients to build this recipe." />
              )}
            </div>

            <PrimaryButton type="submit">Save recipe</PrimaryButton>
          </form>
        </section>

        <aside className="grid gap-3">
          {recipes.length ? (
            recipes.map((recipe) => (
              <article className="rounded-3xl border border-neutral-100 bg-white p-5 shadow-[0_14px_45px_rgba(17,24,39,0.08)]" key={recipe.id}>
                <h3 className="font-semibold text-neutral-950">{recipe.variant.product.name}</h3>
                <p className="mt-1 text-sm text-emerald-700">{recipe.variant.name}</p>
                <div className="mt-4 grid gap-2">
                  {recipe.items.map((item) => (
                    <div className="flex justify-between text-sm text-neutral-600" key={item.id}>
                      <span>{item.ingredient.name}</span>
                      <span>{item.quantity} {item.unit}</span>
                    </div>
                  ))}
                </div>
              </article>
            ))
          ) : (
            <EmptyState title="No recipes configured yet." />
          )}
        </aside>
      </div>
    </ErpPageShell>
  );
}
