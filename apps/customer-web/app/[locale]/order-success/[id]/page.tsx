"use client";
import { useLocale, useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { MotionDiv, hapticTap, pageMotion } from "@/components/motion-primitives";
import { SiteShell } from "@/components/site-shell";
import { apiFetch } from "@/lib/api";
import { Check, X } from "lucide-react";
import { formatMoney, useCart } from "@/lib/cart";
import { trackingLabel, trackingStatus } from "@/lib/order-tracking";

type CustomerOrder = {
  id: string;
  status: string;
  type: string;
  createdAt: string;
  branch?: { name: string; address?: string | null } | null;
  order: {
    orderNumber: string;
    displayOrderNumber?: string | null;
    total: string;
    status?: string;
    items: { id: string; productName: string; quantity: string; totalPrice: string }[];
  };
};


export default function OrderSuccessPage() {
  return (
    <SiteShell>
      <OrderSuccess />
    </SiteShell>
  );
}

function OrderSuccess() {
  const locale = useLocale();
  const meta = useTranslations("CustomerMeta");
  const t = useTranslations("Customer");
  const params = useParams<{ id: string }>();
  const { customer, customerReady, refreshCustomer } = useCart();
  const [order, setOrder] = useState<CustomerOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(async () => {
    if (!customer?.accessToken) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setNotFound(false);
    try {
      setOrder(await apiFetch<CustomerOrder>(`/customer/me/orders/${params.id}`, { accessToken: customer.accessToken }));
    } catch (error) {
      if (!(error instanceof Error && error.message.includes("Sessiya muddati tugagan"))) {
        setNotFound(true);
        return;
      }
      const refreshed = await refreshCustomer();
      if (!refreshed) {
        setNotFound(true);
        return;
      }

      try {
        setOrder(await apiFetch<CustomerOrder>(`/customer/me/orders/${params.id}`, { accessToken: refreshed.accessToken }));
      } catch {
        setNotFound(true);
      }
    } finally {
      setLoading(false);
    }
  }, [customer, params.id, refreshCustomer]);

  useEffect(() => {
    void load();
  }, [load]);

  const itemCount = order?.order.items.reduce((total, item) => total + Number(item.quantity), 0) ?? 0;

  if (!customerReady) {
    return (
      <section aria-busy="true" className="mx-auto max-w-3xl px-4 py-10">
        <div className="mf-card min-h-40 animate-pulse p-8" />
      </section>
    );
  }

  if (!customer?.accessToken) {
    return (
      <section className="mx-auto max-w-3xl px-4 py-10 text-center">
        <div className="mf-card p-8">
          <h1 className="text-3xl font-black text-white">{t("telefonni_tasdiqlang_517d50f6")}</h1>
          <p className="mt-3 text-white/60">{t("buyurtma_holatini_ko_rish_uchun_profil_e822578e")}</p>
          <Link className="pressable ripple mf-button-primary mt-5 inline-flex px-5 py-3 font-bold" href="/">
            {t("bosh_sahifa_c823d32a")}</Link>
        </div>
      </section>
    );
  }

  if (loading) {
    return (
      <section className="mx-auto max-w-3xl px-4 py-10">
        <div className="mf-card p-6">
          <div className="skeleton mx-auto h-20 w-20 rounded-full" />
          <div className="skeleton mx-auto mt-5 h-8 w-2/3 rounded-full" />
          <div className="skeleton mx-auto mt-3 h-5 w-1/2 rounded-full" />
          <div className="mt-6 grid gap-3">
            <div className="skeleton h-16 rounded-2xl" />
            <div className="skeleton h-16 rounded-2xl" />
          </div>
        </div>
      </section>
    );
  }

  if (notFound || !order) {
    return (
      <section className="mx-auto max-w-3xl px-4 py-10 text-center">
        <div className="mf-card p-8">
          <h1 className="text-3xl font-black text-white">{t("buyurtma_topilmadi_e0d00e0d")}</h1>
          <p className="mt-3 text-white/60">{t("buyurtmalar_bo_limidan_oxirgi_holatni_b4f9e7db")}</p>
          <Link className="pressable ripple mf-button-primary mt-5 inline-flex px-5 py-3 font-bold" href="/orders">
            {t("buyurtmalarim_44dff903")}</Link>
        </div>
      </section>
    );
  }

  return (
      <section className="mx-auto max-w-3xl px-4 py-5">
      <MotionDiv {...pageMotion}>
        <div className="px-4 pb-6 pt-2 text-center text-white">
          {/*
            Bekor qilingan buyurtma ham SARIQ doira bilan ko'rsatilardi,
            ya'ni muvaffaqiyat va bekor bir xil ko'rinardi. Endi rang
            holatdan keladi: yashil - qabul qilindi, qizil - bekor.
          */}
          <div aria-hidden="true" className={`mx-auto grid h-16 w-16 place-items-center rounded-full text-3xl font-black ${order.status === "CANCELLED" ? "bg-[#FDEAE8] text-[#A3231D]" : "bg-[#E5F4EC] text-[#1F6640]"}`}>{order.status === "CANCELLED" ? <X size={34} strokeWidth={3} /> : <Check size={34} strokeWidth={3} />}</div>
          <h1 className="mt-4 text-2xl font-black">{order.status === "CANCELLED" ? t("buyurtma_bekor_qilingan_763e8343") : t("buyurtmangiz_qabul_qilindi_47b251f9")}</h1>
          <p className="mt-2 text-sm font-bold text-white/70">{customerOrderNumber(order.order)}</p>
        </div>

        <div className="mf-success-content grid gap-4 rounded-2xl bg-[#F5F5EF] p-4 sm:p-5">
          <div className="mf-order-metrics grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Metric label={meta("status")} value={trackingLabel(trackingStatus(order), order.type, locale)} />
            <Metric label={meta("product")} value={`${itemCount} ${meta("itemUnit")}`} />
            <Metric label={meta("total")} value={formatMoney(order.order.total, locale)} />
          </div>

          {order.branch ? (
            <div className="mf-cart-row p-4">
              <p className="text-xs font-black uppercase text-[#0A7168]">{t("filial_71af259b")}</p>
              <p className="mt-2 text-lg font-black text-[#17314A]">{order.branch.name}</p>
              {order.branch.address ? <p className="mt-1 text-sm font-semibold text-[#586B7D]">{order.branch.address}</p> : null}
            </div>
          ) : null}

          <div className="mf-cart-row p-4">
            <h2 className="text-lg font-black text-[#17314A]">{t("mahsulotlar_66e73a67")}</h2>
            <div className="mt-3 grid gap-2">
              {order.order.items.map((item) => (
                <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-3 border-b border-[#0A7168]/12 py-3 text-sm font-bold text-[#17314A]" key={item.id}>
                  <span className="break-words">{Number(item.quantity)}{t("x_11f6ad8e")}{" "}{item.productName}</span>
                  <span className="whitespace-nowrap text-[#0A7168]">{formatMoney(item.totalPrice, locale)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Link className="pressable ripple mf-button-primary flex justify-center px-5 py-4 font-black" href="/orders" onClick={() => hapticTap(12)}>
              {t("holatni_kuzatish_61cb4892")}</Link>
            <Link className="pressable ripple mf-button-secondary flex justify-center px-5 py-4 font-black" href="/menu" onClick={() => hapticTap(8)}>
              {t("menyuga_qaytish_1bc4a9f0")}</Link>
          </div>
        </div>
      </MotionDiv>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 border-b border-[#0A7168]/12 py-3">
      <p className="text-[10px] font-bold uppercase text-[#0A7168]">{label}</p>
      <p className="mt-2 break-words text-sm font-bold text-[#17314A]">{value}</p>
    </div>
  );
}



function customerOrderNumber(order: { displayOrderNumber?: string | null; orderNumber: string }): string {
  return order.displayOrderNumber ?? order.orderNumber;
}
