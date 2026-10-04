"use client";
import { useLocale, useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { useCallback, useEffect, useState } from "react";
import { CustomerAuthPanel } from "@/components/customer-auth-panel";
import { ContactFooter } from "@/components/contact-footer";
import styles from "./profile.module.css";
import { MotionDiv, pageMotion, sectionMotion } from "@/components/motion-primitives";
import { MediaImage } from "@/components/media-image";
import { SiteShell } from "@/components/site-shell";
import { apiFetch } from "@/lib/api";
import { localizeMenuName } from "@/lib/customer-display";
import { localizeCustomerCopy } from "@/lib/customer-copy.mjs";
import { formatMoney, useCart } from "@/lib/cart";
import {
  orderTypeLabel,
  trackingLabel,
  trackingStatus,
  trackingTone,
} from "@/lib/order-tracking";
import { MapPin, Trash2 } from "lucide-react";
import {
  deliveryAddressText,
  isDeliveryLocation,
  type SavedAddress,
} from "@/lib/delivery-location";

type Dashboard = {
  id: string;
  name: string;
  phone: string;
  bonusBalance: string;
  customerOrders: {
    id: string;
    status: string;
    type: string;
    address?: string | null;
    deliveryAddress?: string | null;
    createdAt: string;
    /*
     * `status` ham keladi (server buyurtmaning barcha skalyar
     * maydonlarini qaytaradi) va `trackingStatus()` unga ustunlik
     * beradi — mijoz ko'rgan holat xodim panelidagi bilan bir xil
     * bo'lishi uchun.
     */
    order: {
      orderNumber: string;
      displayOrderNumber?: string | null;
      total: string;
      status?: string;
    };
  }[];
  favorites: { product: { id: string; name: string; imageUrl?: string | null; sellingPrice: string } }[];
};
export default function ProfilePage() {
  return (
    <SiteShell>
      <div className="mx-auto max-w-6xl bg-[#f5f5ef]">
        <Profile />
        <div className="px-4 pb-4">
          <ContactFooter />
        </div>
      </div>
    </SiteShell>
  );
}

function Profile() {
  const locale = useLocale();
  const meta = useTranslations("CustomerMeta");
  const t = useTranslations("Customer");
  const {
    customer,
    favoriteIds,
    openFulfillment,
    setCustomer,
    showToast,
  } = useCart();
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [localFavorites, setLocalFavorites] = useState<Dashboard["favorites"]>([]);

  const load = useCallback(async () => {
    if (!customer?.accessToken) {
      return;
    }

    setLoadError(null);
    try {
      const [data, products] = await Promise.all([
        apiFetch<Dashboard>("/customer/me/dashboard", { accessToken: customer.accessToken }),
        favoriteIds.length ? apiFetch<Dashboard["favorites"][number]["product"][]>("/customer/menu/products") : Promise.resolve([]),
      ]);
      setDashboard(data);
      setLocalFavorites(products.filter((product) => favoriteIds.includes(product.id)).map((product) => ({ product })));
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Profilni yuklab bo'lmadi.");
    }
  }, [customer, favoriteIds]);

  const favorites = [...new Map([...(dashboard?.favorites ?? []), ...localFavorites].map((entry) => [entry.product.id, entry])).values()];

  useEffect(() => {
    void load();
  }, [load]);

  /*
   * HAQIQIY saqlangan manzillar.
   *
   * Ilgari bu ro'yxat o'tgan buyurtmalarning `deliveryAddress` MATNIDAN
   * yasalardi (eng ko'p 3 ta, tahrirlanmaydigan chip). Haqiqiy manzil
   * do'koni esa `/customer/me/addresses` — checkout dialogida
   * tahrirlanadigan o'sha ro'yxat. Natijada profil va checkout mijozga
   * IKKI XIL ro'yxat ko'rsatardi va profildan manzilni boshqarish
   * imkoni yo'q edi.
   */
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [addressError, setAddressError] = useState<string | null>(null);
  const [removingAddressId, setRemovingAddressId] = useState<string | null>(
    null,
  );

  const loadAddresses = useCallback(async () => {
    if (!customer?.accessToken) return;
    setAddressError(null);
    try {
      const saved = await apiFetch<SavedAddress[]>("/customer/me/addresses", {
        accessToken: customer.accessToken,
      });
      setAddresses(saved.filter((entry) => isDeliveryLocation(entry.location)));
    } catch {
      setAddressError("Manzillar yuklanmadi.");
    }
  }, [customer?.accessToken]);

  useEffect(() => {
    void loadAddresses();
  }, [loadAddresses]);

  async function removeAddress(id: string) {
    if (removingAddressId) return;
    setRemovingAddressId(id);
    setAddressError(null);
    try {
      await apiFetch(`/customer/me/addresses/${id}`, {
        method: "DELETE",
        ...(customer?.accessToken
          ? { accessToken: customer.accessToken }
          : {}),
      });
      setAddresses((current) => current.filter((entry) => entry.id !== id));
      showToast("Manzil o'chirildi");
    } catch {
      setAddressError("Manzilni o'chirib bo'lmadi.");
    } finally {
      setRemovingAddressId(null);
    }
  }

  if (!customer?.accessToken) {
    return (
      <section className="mx-auto max-w-xl px-4 py-6">
        <div className="mf-card p-5 sm:p-6">
          <CustomerAuthPanel
            description={meta("verifyFavorites")}
            title={t("telefon_orqali_profil_eadc1cfb")}
          />
        </div>
      </section>
    );
  }

  return (
    <MotionDiv {...pageMotion} className="mx-auto max-w-6xl px-4 py-5">
      {loadError ? (
        <div className="mf-card mb-4 p-4" role="alert">
          <p className="text-sm font-bold">{localizeCustomerCopy(loadError, locale)}</p>
          <button className="pressable mf-button-primary mt-3 px-4 py-2 text-sm font-black" onClick={() => void load()} type="button">{t("qayta_urinish_422d2790")}</button>
        </div>
      ) : null}
      <div className="grid w-full gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,320px)]">
        <div className={`${styles.identity} min-w-0 p-4 sm:p-5`}>
          <p className="text-xs font-black uppercase text-[#0A7168]">{t("telefon_orqali_profil_eadc1cfb")}</p>
          <h1 className="mt-1 break-words text-2xl font-black text-[#17314A]">{dashboard?.name ?? customer.name}</h1>
          <p className="mt-1 text-sm font-bold text-[#586B7D]">{dashboard?.phone ?? customer.phone}</p>
          <div className="mt-3 inline-flex rounded-full bg-[#0A7168]/10 px-3 py-1 text-xs font-black text-[#0A7168]">
            {t("profil_ulangan_817fff34")}</div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <Stat label={meta("orders")} value={`${dashboard?.customerOrders.length ?? 0}`} />
            <Stat label={meta("favorites")} value={`${favorites.length || favoriteIds.length}`} />
            <Stat label={meta("bonus")} value={formatMoney(dashboard?.bonusBalance ?? customer.bonusBalance ?? 0, locale)} />
          </div>
        </div>

        <div className={`${styles.actions} h-fit p-4 text-[#07373A]`}>
          <div className="grid gap-2">
            <Link className="pressable mf-button-primary px-4 py-3 text-center text-sm font-bold" href="/orders">
              {t("buyurtmalarim_44dff903")}</Link>
            <button
              className="pressable mf-button-secondary px-4 py-3 text-sm font-bold"
              onClick={() => {
                setCustomer(null);
                showToast("Profilingizdan chiqdingiz");
              }}
              type="button"
            >
              {t("chiqish_84f3032f")}</button>
          </div>
        </div>
      </div>

      <MotionDiv {...sectionMotion} className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel title={t("so_nggi_buyurtmalar_d8239dae")}>
          <div className="grid gap-3">
            {dashboard?.customerOrders.length ? (
              dashboard.customerOrders.slice(0, 5).map((order) => (
                <Link className="pressable mf-cart-row block p-4 transition hover:border-[#22C55E]/36" href={`/orders/${order.id}`} key={order.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-black text-[#17314A]">{order.order.displayOrderNumber ?? order.order.orderNumber}</p>
                      <p className="mt-1 flex flex-wrap items-center gap-2 text-xs font-semibold leading-5 text-[#586B7D]"><span className="mf-status-chip" data-tone={trackingTone(trackingStatus(order))}>{trackingLabel(trackingStatus(order), order.type, locale)}</span><span>{orderTypeLabel(order.type, locale)}</span></p>
                    </div>
                    <span className="shrink-0 font-black text-[#0A7168]">{formatMoney(order.order.total, locale)}</span>
                  </div>
                </Link>
              ))
            ) : (
              <p className="text-sm font-semibold text-[#586B7D]">{t("buyurtmalar_rasmiylashtirilgandan_keyi_eda360f4")}</p>
            )}
          </div>
        </Panel>

        <Panel title={t("sevimlilar_23030420")}>
          <div className="grid gap-3">
            {favorites.length ? favorites.map(({ product }) => (
              <Link className="pressable grid min-w-0 grid-cols-[72px_minmax(0,1fr)] gap-3 rounded-xl bg-[#0A7168]/7 p-2 transition hover:bg-[#0A7168]/10" href={`/product/${product.id}`} key={product.id}>
                <MediaImage
                  alt={product.name}
                  aspectClassName="h-[72px] w-[72px]"
                  className="rounded-xl"
                  sizes="72px"
                  src={product.imageUrl}
                />
                <div className="min-w-0">
                  <p className="break-words font-bold text-[#17314A]">{localizeMenuName(product.name, locale)}</p>
                  <p className="mt-1 text-sm font-bold text-[#0A7168]">{formatMoney(product.sellingPrice, locale)}</p>
                </div>
              </Link>
            )) : <p className="text-sm font-semibold text-[#586B7D]">{t("mahsulot_kartasidagi_yurakchani_bosing_230fc4f3")}</p>}
          </div>
        </Panel>
      </MotionDiv>

      <Panel title={t("saqlangan_manzillar_68b720a3")}>
        {addressError ? (
          <p role="alert" className="mb-3 text-sm font-bold text-[#A3231D]">
            {addressError}
          </p>
        ) : null}
        <div className="grid gap-3">
          {addresses.length ? (
            addresses.map((address) => (
              <div
                className="mf-cart-row flex min-w-0 items-start justify-between gap-3 p-4"
                key={address.id}
              >
                <div className="min-w-0">
                  <p className="break-words text-sm font-black text-[#17314A]">
                    {address.label || address.location.address}
                  </p>
                  <p className="mt-1 break-words text-xs font-semibold text-[#586B7D]">
                    {deliveryAddressText(address.location)}
                  </p>
                </div>
                <button
                  aria-label={localizeCustomerCopy((address.label || address.location.address) + " manzilini o'chirish", locale)}
                  className="mf-icon-control shrink-0"
                  disabled={removingAddressId === address.id}
                  onClick={() => void removeAddress(address.id)}
                  type="button"
                >
                  <Trash2 aria-hidden="true" size={17} />
                </button>
              </div>
            ))
          ) : (
            <p className="text-sm font-semibold text-[#586B7D]">
              {t("hali_saqlangan_manzil_yo_q_yetkazib_be_c1121169")}</p>
          )}
          <button
            className="mf-button-secondary justify-self-start"
            onClick={openFulfillment}
            type="button"
          >
            <MapPin aria-hidden="true" size={17} />
            {t("manzil_qo_shish_yoki_o_zgartirish_beca1c6d")}</button>
        </div>
      </Panel>
    </MotionDiv>
  );
}



function Panel({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <section className={`${styles.section} mt-4 py-4`}>
      <h2 className="mb-3 text-xl font-black text-[#17314A]">{title}</h2>
      {children}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className={`${styles.stat} min-w-0 p-2.5`}>
      <p className="text-[11px] font-bold text-[#0A7168]">{label}</p>
      <p className="mt-1 break-words text-sm font-black text-[#17314A] sm:text-base">{value}</p>
    </div>
  );
}
