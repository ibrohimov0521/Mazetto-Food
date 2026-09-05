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
        <AdminLayout>
          <AdminPageHeader
            breadcrumbs={[{ label: "Admin", href: "/admin/dashboard" }, { label: "Ombor" }, { label: "Retseptlar" }]}
            description="Mahsulot variantlari uchun ingredient tarkibi"
            title="Retseptlar"
          />
          <RecipeBuilder />
        </AdminLayout>
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
    <section className="grid gap-5">
      <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
        <section className="rounded-mz-card border border-mz-border bg-mz-surface p-5 shadow-mz-card">
          <form className="grid gap-4" onSubmit={saveRecipe}>
            <label className="grid gap-2 text-sm font-semibold text-mz-text">
              Product variant
              <select
                className="rounded-mz-control border border-mz-border bg-mz-surface px-4 py-3 text-sm text-mz-text outline-none"
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

            <div className="grid gap-3 rounded-mz-control bg-mz-info-bg/60 p-4 md:grid-cols-[1fr_120px_140px_auto]">
              <TextInput placeholder="Ingredient ID" value={ingredientId} onChange={(event) => setIngredientId(event.target.value)} />
              <TextInput placeholder="Qty" type="number" min="0.001" step="0.001" value={quantity} onChange={(event) => setQuantity(event.target.value)} />
              <select className="rounded-mz-control border border-mz-border bg-mz-surface px-4 py-3 text-sm text-mz-text outline-none" value={unit} onChange={(event) => setUnit(event.target.value)}>
                <option value="GRAM">GRAM</option>
                <option value="KG">KG</option>
                <option value="LITER">LITER</option>
                <option value="PIECE">PIECE</option>
              </select>
              <button className="rounded-mz-control border border-mz-border bg-mz-surface px-4 py-2 text-sm font-semibold text-mz-info" onClick={addRecipeItem} type="button">
                Add
              </button>
            </div>

            <div className="grid gap-2">
              {items.length ? (
                items.map((item, index) => (
                  <div className="flex items-center justify-between rounded-mz-control border border-mz-border px-4 py-3 text-sm" key={`${item.ingredientId}-${index}`}>
                    <span className="font-semibold text-mz-text">{item.ingredientId}</span>
                    <span className="text-mz-text-muted">{item.quantity} {item.unit}</span>
                  </div>
                ))
              ) : (
                <EmptyState title="Add ingredients to build this recipe." />
              )}
            </div>

            <Button type="submit">Save recipe</Button>
          </form>
        </section>

        <aside className="grid gap-3">
          {recipes.length ? (
            recipes.map((recipe) => (
              <article className="rounded-mz-card border border-mz-border bg-mz-surface p-5 shadow-mz-card" key={recipe.id}>
                <h3 className="font-semibold text-mz-text">{recipe.variant.product.name}</h3>
                <p className="mt-1 text-sm text-mz-info">{recipe.variant.name}</p>
                <div className="mt-4 grid gap-2">
                  {recipe.items.map((item) => (
                    <div className="flex justify-between text-sm text-mz-text-muted" key={item.id}>
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
    </section>
  );
}
