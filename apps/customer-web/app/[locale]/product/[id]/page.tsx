import { notFound } from "next/navigation";
import ProductPage from "./product-client";
import { getPublicProduct } from "@/lib/public-catalog";
import { displayProduct } from "@/lib/customer-display";
import { jsonLd, pageMetadata, siteUrl } from "@/lib/seo";

export const revalidate = 300;
type Props = { params: Promise<{ id: string; locale: "uz" | "ru" }> };
export async function generateMetadata({ params }: Props) {
  const { id, locale } = await params;
  const data = await getPublicProduct(id);
  if (!data) notFound();
  const product = displayProduct(data, locale);
  return pageMetadata(
    product.name,
    product.description ||
      (locale === "ru"
        ? `${product.name} — Mazetto Food. Состав, цена и онлайн-заказ.`
        : `${product.name} - Mazetto Food. Narxi, tarkibi va onlayn buyurtma.`),
    (locale === "ru" ? "/ru" : "") + "/product/" + encodeURIComponent(id),
    product.imageUrl,
    locale,
  );
}
export default async function ProductRoute({ params }: Props) {
  const { id, locale } = await params;
  const initialProduct = await getPublicProduct(id);
  if (!initialProduct) notFound();
  const product = displayProduct(initialProduct, locale);
  const price =
    product.variants.find((variant) => variant.isDefault)?.sellingPrice ??
    product.variants[0]?.sellingPrice ??
    product.sellingPrice;
  const url = siteUrl + (locale === "ru" ? "/ru" : "") + "/product/" + encodeURIComponent(id);
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd({
            "@context": "https://schema.org",
            "@type": "Product",
            name: product.name,
            description: product.description || product.name,
            image: product.imageUrl ? [product.imageUrl] : undefined,
            brand: { "@type": "Brand", name: "Mazetto Food" },
            url,
            offers: {
              "@type": "Offer",
              url,
              priceCurrency: "UZS",
              price: Number(price),
              seller: { "@type": "Organization", name: "Mazetto Food" },
            },
          }),
        }}
      />
      <ProductPage id={id} initialProduct={initialProduct} />
    </>
  );
}
