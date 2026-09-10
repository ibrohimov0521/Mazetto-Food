import { notFound } from "next/navigation";
import ProductPage from "./product-client";
import { getPublicProduct } from "../../../lib/public-catalog";
import { displayProduct } from "../../../lib/customer-display";
import { jsonLd, pageMetadata, siteUrl } from "../../../lib/seo";

export const revalidate = 300;
type Props = { params: Promise<{ id: string }> };
export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const data = await getPublicProduct(id);
  if (!data) notFound();
  const product = displayProduct(data);
  return pageMetadata(
    product.name,
    product.description ||
      `${product.name} - Mazetto Food. Narxi, tarkibi va onlayn buyurtma.`,
    "/product/" + encodeURIComponent(id),
    product.imageUrl,
  );
}
export default async function ProductRoute({ params }: Props) {
  const { id } = await params;
  const initialProduct = await getPublicProduct(id);
  if (!initialProduct) notFound();
  const product = displayProduct(initialProduct);
  const price =
    product.variants.find((variant) => variant.isDefault)?.sellingPrice ??
    product.variants[0]?.sellingPrice ??
    product.sellingPrice;
  const url = siteUrl + "/product/" + encodeURIComponent(id);
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
