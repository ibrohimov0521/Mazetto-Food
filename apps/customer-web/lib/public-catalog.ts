import { cache } from "react";
import type { Category, CustomerHome, Product } from "./types";

async function readPublic<T>(path: string): Promise<T | null> {
  const origin = process.env.CUSTOMER_SEO_API_URL ?? "https://api.mazettofood.uz/api/v1";
  const response = await fetch(origin.replace(/\/$/, "") + path, { next: { revalidate: 300 }, signal: AbortSignal.timeout(10000) });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error("Public catalog unavailable");
  const payload = await response.json() as { success: boolean; data: T };
  if (!payload.success || payload.data == null) throw new Error("Invalid public catalog");
  return payload.data;
}
export const getPublicProducts = cache(async () => (await readPublic<Product[]>("/customer/menu/products")) ?? []);
export const getPublicProduct = cache((id: string) => readPublic<Product>("/customer/menu/products/" + encodeURIComponent(id)));
export const getPublicMenu = cache(async () => {
  const [categories, products] = await Promise.all([readPublic<Category[]>("/customer/menu/categories"), getPublicProducts()]);
  return { categories: categories ?? [], products };
});
export const getPublicHome = cache(async () => {
  const [menu, home] = await Promise.all([getPublicMenu(), readPublic<CustomerHome>("/customer/home")]);
  return { ...menu, home: home ?? { heroSlides: [], promotions: [] } };
});
