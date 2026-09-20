import type { MetadataRoute } from "next";
import { getPublicProducts } from "../lib/public-catalog";
import { displayProducts } from "../lib/customer-display";
import { siteUrl } from "../lib/seo";
export const revalidate = 300;
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let products: ReturnType<typeof displayProducts> = [];
  try {
    products = displayProducts(await getPublicProducts());
  } catch (error) {
    console.warn("Product sitemap entries are temporarily unavailable", error);
  }
  return [
    { url: siteUrl + "/" },
    { url: siteUrl + "/menu" },
    ...products.map((product) => ({
      url: siteUrl + "/product/" + encodeURIComponent(product.id),
    })),
  ];
}
