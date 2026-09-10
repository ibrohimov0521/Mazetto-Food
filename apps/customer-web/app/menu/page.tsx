import { CustomerMenuSections } from "../../components/customer-menu-sections";
import { ContactFooter } from "../../components/contact-footer";
import { SiteShell } from "../../components/site-shell";
import { getPublicMenu } from "../../lib/public-catalog";
import { pageMetadata } from "../../lib/seo";

export const revalidate = 300;
export const metadata = pageMetadata(
  "Menyu - lavash, burger va setlar",
  "Mazetto Food menyusi va narxlari. Lavash, burger, hot-dog, setlar va ichimliklarni tanlang va onlayn buyurtma qiling.",
  "/menu",
);
export default async function MenuPage() {
  const initial = await getPublicMenu().catch(() => undefined);
  return (
    <SiteShell>
      <CustomerMenuSections {...(initial ? { initial } : {})} />
      <div className="mx-auto max-w-6xl px-4 pb-4">
        <ContactFooter showProfile />
      </div>
    </SiteShell>
  );
}
