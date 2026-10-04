import Home from "./home-client";
import { getPublicHome } from "@/lib/public-catalog";
import { jsonLd, pageMetadata, siteUrl } from "@/lib/seo";
import { selectHomeProducts } from "@/lib/customer-display";

export const revalidate = 300;
type Props = { params: Promise<{ locale: "uz" | "ru" }> };
export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const isRussian = locale === "ru";
  return pageMetadata(
    isRussian ? "Mazetto Food — фастфуд и доставка в Ташкенте" : "Mazetto Food - Toshkentda fast food va yetkazib berish",
    isRussian
      ? "Официальный сайт Mazetto Food. Заказывайте лаваш, бургеры, хот-доги и сеты онлайн с доставкой или самовывозом."
      : "Mazetto Food rasmiy sayti. Lavash, burger, hot-dog va setlarni onlayn buyurtma qiling. Yetkazib berish va filialdan olib ketish.",
    locale === "ru" ? "/ru" : "/",
    undefined,
    locale,
  );
}
export default async function HomePage({ params }: Props) {
  const { locale } = await params;
  const localizedRoot = siteUrl + (locale === "ru" ? "/ru" : "");
  const loaded = await getPublicHome().catch(() => undefined);
  // Only the products the homepage renders travel in the RSC payload; the rest
  // of the catalog is fetched by /menu and by the client refresh.
  const initial = loaded ? { ...loaded, products: selectHomeProducts(loaded.products, loaded.home) } : undefined;
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd({
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "WebSite",
                "@id": siteUrl + "/#website",
                name: "Mazetto Food",
                alternateName: "MAZETTO FOOD",
                url: localizedRoot,
                inLanguage: locale,
              },
              {
                "@type": "Restaurant",
                "@id": siteUrl + "/#restaurant",
                name: "Mazetto Food",
                url: siteUrl,
                image: siteUrl + "/brand/mazetto-food-logo.webp",
                hasMenu: localizedRoot + "/menu",
                servesCuisine: "Fast food",
              },
            ],
          }),
        }}
      />
      <Home {...(initial ? { initial } : {})} />
    </>
  );
}
