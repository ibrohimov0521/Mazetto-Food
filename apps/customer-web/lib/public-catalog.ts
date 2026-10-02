import { cache } from "react";
import type { Category, CustomerHome, Product } from "./types";
import {
  fetchPublicDataWithRetry,
  logCatalogUpstreamEvent,
} from "./public-fetch.mjs";

async function readPublic<T>(path: string): Promise<T | null> {
  const origin = process.env.CUSTOMER_SEO_API_URL ?? "https://api.mazettofood.uz/api/v1";
  const startedAt = Date.now();
  const result = await fetchPublicDataWithRetry(
    origin.replace(/\/$/, "") + path,
    {
      headers: { "x-forwarded-host": "mazettofood.uz" },
      next: { revalidate: 300 },
    },
    { maxAttempts: 3, retryDelayMs: 200, timeoutMs: 3000 },
  );
  if (result.response === null) {
    logCatalogUpstreamEvent({
      path,
      status: null,
      attempts: result.attempts,
      elapsedMs: Date.now() - startedAt,
      ...(result.error instanceof Error ? { reason: result.error.name } : {}),
    });
    throw new Error("Public catalog unavailable");
  }

  const response = result.response;
  if (result.attempts > 1 || (!response.ok && response.status !== 404)) {
    logCatalogUpstreamEvent({
      path,
      status: response.status,
      attempts: result.attempts,
      elapsedMs: Date.now() - startedAt,
      recovered: response.ok && result.attempts > 1,
    });
  }

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
