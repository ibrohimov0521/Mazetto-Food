import Home from "./home-client";
import { getPublicHome } from "../lib/public-catalog";
import { jsonLd, pageMetadata, siteUrl } from "../lib/seo";
import { selectHomeProducts } from "../lib/customer-display";

export const revalidate = 300;
export const metadata = pageMetadata(
  "Mazetto Food - Toshkentda fast food va yetkazib berish",
  "Mazetto Food rasmiy sayti. Lavash, burger, hot-dog va setlarni onlayn buyurtma qiling. Yetkazib berish va filialdan olib ketish.",
  "/",
);
export default async function HomePage() {
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
                url: siteUrl,
                inLanguage: "uz",
              },
              {
                "@type": "Restaurant",
                "@id": siteUrl + "/#restaurant",
                name: "Mazetto Food",
                url: siteUrl,
                image: siteUrl + "/brand/mazetto-food-logo.webp",
                hasMenu: siteUrl + "/menu",
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
