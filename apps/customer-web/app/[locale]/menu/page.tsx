import { CustomerMenuSections } from "@/components/customer-menu-sections";
import { ContactFooter } from "@/components/contact-footer";
import { SiteShell } from "@/components/site-shell";
import { getPublicMenu } from "@/lib/public-catalog";
import { pageMetadata } from "@/lib/seo";

export const revalidate = 300;
export async function generateMetadata({ params }: { params: Promise<{ locale: "uz" | "ru" }> }) {
  const { locale } = await params;
  const isRussian = locale === "ru";
  return pageMetadata(
    isRussian ? "Меню — лаваш, бургеры и наборы" : "Menyu - lavash, burger va setlar",
    isRussian
      ? "Меню и цены Mazetto Food. Выбирайте лаваш, бургеры, хот-доги, наборы и напитки, оформляйте заказ онлайн."
      : "Mazetto Food menyusi va narxlari. Lavash, burger, hot-dog, setlar va ichimliklarni tanlang va onlayn buyurtma qiling.",
    (isRussian ? "/ru" : "") + "/menu",
    undefined,
    locale,
  );
}
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
