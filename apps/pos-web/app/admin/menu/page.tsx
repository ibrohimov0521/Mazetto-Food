"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { AuthShell } from "../../../components/auth/auth-shell";
import { PermissionGuard } from "../../../components/auth/permission-guard";
import { RoleGuard } from "../../../components/auth/role-guard";
import { EmptyState, ErpPageShell, PrimaryButton, TextInput } from "../../../components/erp/erp-ui";
import { apiFetch } from "../../../lib/api";

type Category = { id: string; name: string; description?: string; imageUrl?: string; sortOrder: number };
type Product = {
  id: string;
  categoryId: string;
  name: string;
  description?: string;
  imageUrl?: string;
  preparationTime?: number;
  sellingPrice: string;
  variants: { id: string; name: string; sellingPrice: string; isDefault: boolean }[];
  modifiers: { modifier: { id: string; name: string; price: string } }[];
};

export default function AdminMenuPage() {
  return (
    <RoleGuard roles={["SUPER_ADMIN", "BRANCH_MANAGER"]}>
      <PermissionGuard permission="MENU_VIEW">
        <AuthShell eyebrow="Menu management" title="Menu catalog">
          <MenuManagement />
        </AuthShell>
      </PermissionGuard>
    </RoleGuard>
  );
}

function MenuManagement() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isProductFormOpen, setIsProductFormOpen] = useState(false);
  const [categoryName, setCategoryName] = useState("");
  const [productName, setProductName] = useState("");
  const [price, setPrice] = useState("0");
  const [image, setImage] = useState("");

  async function load() {
    const [nextCategories, nextProducts] = await Promise.all([
      apiFetch<Category[]>("/menu/categories"),
      apiFetch<Product[]>("/menu/products"),
    ]);
    setCategories(nextCategories);
    setProducts(nextProducts);
    setSelectedCategory((current) => current ?? nextCategories[0]?.id ?? null);
  }

  useEffect(() => {
    void load();
  }, []);

  const visibleProducts = useMemo(
    () => products.filter((product) => !selectedCategory || product.categoryId === selectedCategory),
    [products, selectedCategory],
  );

  async function createCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await apiFetch("/menu/categories", {
      method: "POST",
      body: JSON.stringify({ name: categoryName, sortOrder: categories.length }),
    });
    setCategoryName("");
    await load();
  }

  async function createProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedCategory) {
      return;
    }

    await apiFetch("/menu/products", {
      method: "POST",
      body: JSON.stringify({
        categoryId: selectedCategory,
        name: productName,
        image,
        variants: [{ name: "Regular", price: Number(price), isDefault: true }],
      }),
    });
    setProductName("");
    setPrice("0");
    setImage("");
    setIsProductFormOpen(false);
    await load();
  }

  return (
    <ErpPageShell
      title="Menu management"
      subtitle="Manage categories, product cards, images, variants, and modifier-ready product structure."
      actions={<PrimaryButton onClick={() => setIsProductFormOpen(true)}>Create product</PrimaryButton>}
    >
      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <aside className="rounded-3xl border border-neutral-100 bg-white p-4 shadow-[0_14px_45px_rgba(17,24,39,0.08)]">
          <form className="mb-4 grid gap-3" onSubmit={createCategory}>
            <TextInput
              placeholder="New category"
              value={categoryName}
              onChange={(event) => setCategoryName(event.target.value)}
              required
            />
            <PrimaryButton type="submit">Add category</PrimaryButton>
          </form>
          <div className="grid gap-2">
            {categories.map((category) => (
              <button
                className={`rounded-2xl px-4 py-3 text-left text-sm font-semibold transition ${
                  selectedCategory === category.id
                    ? "bg-emerald-600 text-white"
                    : "bg-neutral-50 text-neutral-700 hover:bg-emerald-50"
                }`}
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                type="button"
              >
                {category.name}
              </button>
            ))}
          </div>
        </aside>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visibleProducts.length ? (
            visibleProducts.map((product) => (
              <article
                className="rounded-3xl border border-neutral-100 bg-white p-5 shadow-[0_14px_45px_rgba(17,24,39,0.08)]"
                key={product.id}
              >
                <div className="flex h-36 items-center justify-center rounded-2xl bg-emerald-50 text-sm font-semibold text-emerald-800">
                  {product.imageUrl ? "Image uploaded" : "No image"}
                </div>
                <h3 className="mt-4 text-lg font-semibold text-neutral-950">{product.name}</h3>
                <p className="mt-1 text-sm text-neutral-500">{product.description ?? "No description"}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {product.variants.map((variant) => (
                    <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-700" key={variant.id}>
                      {variant.name} · {variant.sellingPrice}
                    </span>
                  ))}
                </div>
              </article>
            ))
          ) : (
            <div className="md:col-span-2 xl:col-span-3">
              <EmptyState title="No products in this category yet." />
            </div>
          )}
        </section>
      </div>

      {isProductFormOpen ? (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/30 px-4">
          <form className="grid w-full max-w-lg gap-4 rounded-3xl bg-white p-6 shadow-2xl" onSubmit={createProduct}>
            <h3 className="text-xl font-semibold text-neutral-950">Create product</h3>
            <TextInput placeholder="Product name" value={productName} onChange={(event) => setProductName(event.target.value)} required />
            <TextInput placeholder="Image URL" value={image} onChange={(event) => setImage(event.target.value)} />
            <TextInput placeholder="Regular price" type="number" min="0" value={price} onChange={(event) => setPrice(event.target.value)} required />
            <div className="flex justify-end gap-3">
              <button className="rounded-2xl px-4 py-2 text-sm font-semibold text-neutral-600" onClick={() => setIsProductFormOpen(false)} type="button">
                Cancel
              </button>
              <PrimaryButton type="submit">Save product</PrimaryButton>
            </div>
          </form>
        </div>
      ) : null}
    </ErpPageShell>
  );
}
