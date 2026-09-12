"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  Clock3,
  MessageCircle,
  Phone,
  RotateCcw,
  XCircle,
  UserRound,
} from "lucide-react";
import { CustomerAuthPanel } from "../../../components/customer-auth-panel";
import { MotionDiv, pageMotion, sectionMotion } from "../../../components/motion-primitives";
import { SiteShell } from "../../../components/site-shell";
import { apiFetch } from "../../../lib/api";
import { OrderProgress } from "../../../components/order-progress";
import {
  paymentStatusLabel,
  trackingLabel,
  trackingStatus,
} from "../../../lib/order-tracking";
import { useOrderUpdates } from "../../../lib/use-order-updates";
import { localizeMenuName } from "../../../lib/customer-display";
import { formatMoney, useCart } from "../../../lib/cart";
import { buildReorderItems, reorderMessage } from "../../../lib/reorder";
import {
  isSupportPhoneValid,
  supportLinks,
  supportPhone,
} from "../../../lib/contact";

type ModifierSnapshot = {
  /* Modifikator id'si — qayta buyurtmada aynan shu qo'shimchani tiklash uchun. */
  id?: string | null;
  name: string;
  quantity?: string;
  totalPrice?: string;
};
type Payment = {
  id: string;
  amount: string;
  status: string;
  methodCode?: string | null;
  method?: { name: string; code: string } | null;
};
type CustomerOrderDetail = {
  id: string;
  status: string;
  type: string;
  paymentMethod?: string | null;
  deliveryAddress?: string | null;
  notes?: string | null;
  createdAt: string;
  branch?: { name: string; address?: string | null } | null;
  order: {
    orderNumber: string;
    displayOrderNumber?: string | null;
    total: string;
    status?: string;
    items: {
      id: string;
      /* Qayta buyurtma uchun — server bu maydonlarni endi qaytaradi. */
      productId?: string | null;
      variantId?: string | null;
      productName: string;
      variantName?: string | null;
      quantity: string;
      unitPrice: string;
      totalPrice: string;
      modifierSnapshot?: ModifierSnapshot[] | null;
      notes?: string | null;
    }[];
    payments?: Payment[];
    statusHistory?: {
      id: string;
      fromStatus?: string | null;
      toStatus: string;
      reason?: string | null;
      createdAt: string;
      changedByEmployee?: { id: string; firstName: string; lastName: string } | null;
      changedByUser?: { id: string; displayName?: string | null } | null;
    }[];
  };
};

const typeLabels: Record<string, string> = {
  DELIVERY: "Yetkazib berish",
  PICKUP: "Olib ketish",
};
const paymentLabels: Record<string, string> = {
  CASH: "Naqd",
  CLICK: "Click",
  PAYME: "Payme",
  CARD: "Karta",
};

export default function OrderDetailPage() {
  return (
    <SiteShell>
      <OrderDetail />
    </SiteShell>
  );
}

function OrderDetail() {
  const params = useParams<{ id: string }>();
  const { addItem, customer, refreshCustomer, showToast } = useCart();
  const [reordering, setReordering] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [order, setOrder] = useState<CustomerOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!customer?.accessToken) {
      setLoading(false);
      return;
    }

    if (!silent) setLoading(true);
    setNotFound(false);
    try {
      setOrder(await apiFetch<CustomerOrderDetail>(`/customer/me/orders/${params.id}`, { accessToken: customer.accessToken }));
    } catch (error) {
      if (!(error instanceof Error && error.message.includes("Sessiya muddati tugagan"))) {
        if (!silent) setNotFound(true);
        return;
      }
      const refreshed = await refreshCustomer();
      if (!refreshed) {
        if (!silent) setNotFound(true);
        return;
      }

      try {
        setOrder(await apiFetch<CustomerOrderDetail>(`/customer/me/orders/${params.id}`, { accessToken: refreshed.accessToken }));
      } catch {
        if (!silent) setNotFound(true);
      }
    } finally {
      setLoading(false);
    }
  }, [customer?.accessToken, params.id, refreshCustomer]);

  useEffect(() => {
    void load();
  }, [load]);

  useOrderUpdates(customer?.accessToken, load);

  const itemCount = useMemo(
    () => order?.order.items.reduce((total, item) => total + Number(item.quantity), 0) ?? 0,
    [order],
  );

  /*
   * Bekor qilish chegarasi SERVER bilan bir xil bo'lishi kerak
   * (`customer-shared.ts` dagi `CUSTOMER_CANCELLABLE_STATUSES`):
   * `PREPARING` dan oldin mumkin, undan keyin faqat qo'ng'iroq.
   *
   * Bu yerda takrorlangani ataylab: tugmani ko'rsatish qarori
   * mijoz brauzerida olinadi, lekin YAKUNIY qarorni baribir server
   * qabul qiladi va rad etsa, xatosi ekranda ko'rsatiladi.
   */
  const trackedStatus = order ? trackingStatus(order) : null;
  const canCancel =
    trackedStatus === "NEW" || trackedStatus === "CONFIRMED";
  const showCallToCancel =
    trackedStatus === "PREPARING" || trackedStatus === "READY";

  async function cancelOrder() {
    if (cancelling || !order) return;
    setCancelling(true);
    setCancelError(null);
    try {
      await apiFetch(`/customer/me/orders/${order.id}/cancel`, {
        method: "PATCH",
        body: JSON.stringify(cancelReason.trim() ? { reason: cancelReason.trim() } : {}),
        ...(customer?.accessToken ? { accessToken: customer.accessToken } : {}),
      });
      setCancelOpen(false);
      setCancelReason("");
      await load();
    } catch (caught) {
      setCancelError(
        caught instanceof Error
          ? caught.message
          : "Buyurtmani bekor qilib bo'lmadi.",
      );
    } finally {
      setCancelling(false);
    }
  }

  async function reorder() {
    if (reordering || !order) return;
    setReordering(true);
    try {
      const result = await buildReorderItems(order.order.items, {
        accessToken: customer?.accessToken,
      });
      for (const item of result.restored) addItem(item);
      showToast(reorderMessage(result));
    } catch {
      showToast("Menyu yuklanmadi. Qayta urinib ko'ring.");
    } finally {
      setReordering(false);
    }
  }

  if (!customer?.accessToken) {
    return (
      <section className="mx-auto max-w-3xl px-4 py-10">
        <div className="mf-card p-8">
          <CustomerAuthPanel
            description="Buyurtma tafsilotlarini ko'rish uchun telefon raqamingizni Telegram kodi bilan tasdiqlang."
            title="Telefonni tasdiqlang"
          />
        </div>
      </section>
    );
  }

  if (loading) {
    return (
      <section className="mx-auto max-w-4xl px-4 py-8">
        <div className="mf-card p-5">
          <div className="skeleton h-8 w-48 rounded-full" />
          <div className="skeleton mt-4 h-16 rounded-2xl" />
          <div className="mt-5 grid gap-3">
            <div className="skeleton h-24 rounded-2xl" />
            <div className="skeleton h-24 rounded-2xl" />
            <div className="skeleton h-24 rounded-2xl" />
          </div>
        </div>
      </section>
    );
  }

  if (notFound || !order) {
    return (
      <section className="mx-auto max-w-3xl px-4 py-10 text-center">
        <div className="mf-card p-8">
          <h1 className="text-3xl font-black text-white">Buyurtma topilmadi</h1>
          <p className="mt-3 text-white/60">Bu buyurtma sizning profilingizga tegishli bo'lmasligi yoki mavjud bo'lmasligi mumkin.</p>
          <Link className="pressable ripple mf-button-primary mt-5 inline-flex px-5 py-3 font-black" href="/orders">
            Buyurtmalarim
          </Link>
        </div>
      </section>
    );
  }

  return (
    <MotionDiv {...pageMotion} className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="grid min-w-0 gap-5">
        <section className="mf-checkout-card p-5">
          <p className="text-sm font-black uppercase text-[#0A7168]">Buyurtma tafsiloti</p>
          <h1 className="mt-2 break-words text-3xl font-black text-[#17314A]">{customerOrderNumber(order.order)}</h1>
          <p className="mt-2 text-sm font-semibold text-[#586B7D]">
            {new Date(order.createdAt).toLocaleString("uz-UZ")} · {typeLabels[order.type] ?? order.type}
          </p>
          <div className="mf-order-metrics mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Metric label="Holat" value={trackingLabel(trackingStatus(order), order.type)} />
            <Metric label="Mahsulot" value={`${itemCount} dona`} />
            <Metric label="Jami" value={formatMoney(order.order.total)} />
          </div>
          <OrderProgress value={order} />
          {/*
            QAYTA BUYURTMA va ALOQA. Ilgari buyurtma sahifasida ikkisi
            ham yo'q edi: doimiy mijoz savatni qaytadan yigardi, muammo
            chiqsa esa sahifadan chiqib ketishdan boshqa yo'l yo'q edi
            (`ContactFooter` faqat bosh sahifa, menyu va profilda).
          */}
          {/*
            O'lcham va joylashuv Tailwind klasslaridan keladi — `mf-button-*`
            faqat rang va chegarani beradi. Uchtasi ham bir xil balandlik
            (44px) va bir xil ichki bo'shliq oladi, shunda qator tekis
            ko'rinadi.
          */}
          <div className="mt-5 flex flex-wrap items-center gap-2.5">
            <button
              className="pressable ripple mf-button-primary inline-flex min-h-11 items-center gap-2 px-5 py-3 text-sm font-black"
              disabled={reordering}
              onClick={() => void reorder()}
              type="button"
            >
              <RotateCcw aria-hidden="true" size={17} />
              {reordering ? "Qo'shilmoqda..." : "Qayta buyurtma"}
            </button>
            <a
              className="pressable mf-button-secondary inline-flex min-h-11 items-center gap-2 px-4 py-3 text-sm font-bold"
              href={supportLinks.telegram}
              target="_blank"
              rel="noopener noreferrer"
            >
              <MessageCircle aria-hidden="true" size={17} />
              Yordam
            </a>
            {isSupportPhoneValid ? (
              <a
                className="pressable mf-button-secondary inline-flex min-h-11 items-center gap-2 px-4 py-3 text-sm font-bold"
                href={`tel:${supportPhone.href}`}
              >
                <Phone aria-hidden="true" size={17} />
                {supportPhone.display}
              </a>
            ) : null}
            {/*
              BEKOR QILISH — faqat oshxona tayyorlashni boshlamagan
              bo'lsa. Uslubi ataylab "ozgina" destruktiv: chegarasi va
              matni qizil, foni esa oq. To'ldirilgan qizil blok bu
              qatordagi asosiy amal (qayta buyurtma) bilan raqobat
              qilardi, holbuki bekor qilish kamdan-kam kerak bo'ladi.
            */}
            {canCancel ? (
              <button
                className="pressable mf-button-cancel inline-flex min-h-11 items-center gap-2 px-4 py-3 text-sm font-bold"
                disabled={cancelling}
                onClick={() => setCancelOpen(true)}
                type="button"
              >
                <XCircle aria-hidden="true" size={17} />
                {cancelling ? "Bekor qilinmoqda..." : "Bekor qilish"}
              </button>
            ) : null}
          </div>
          {/*
            Oshxona boshlagandan keyin bekor qilish faqat qo'ng'iroq
            orqali (egasining qoidasi). Tugmani o'chirib qo'yish
            o'rniga mijozga NIMA QILISHI aytiladi.
          */}
          {showCallToCancel ? (
            <p className="mt-3 text-xs font-semibold leading-5 text-[#586B7D]">
              Oshxona tayyorlashni boshladi. Bekor qilish uchun{" "}
              {isSupportPhoneValid ? (
                <a className="font-black underline" href={`tel:${supportPhone.href}`}>
                  {supportPhone.display}
                </a>
              ) : (
                "biz bilan"
              )}{" "}
              raqamiga qo'ng'iroq qiling.
            </p>
          ) : null}
          {cancelError ? (
            <p role="alert" className="mt-3 text-sm font-bold text-[#A3231D]">
              {cancelError}
            </p>
          ) : null}
        </section>

        <StatusHistory entries={order.order.statusHistory ?? []} type={order.type} />

        <MotionDiv {...sectionMotion} className="mf-checkout-card p-5">
          <h2 className="text-2xl font-black text-[#17314A]">Mahsulotlar</h2>
          <div className="mt-4 grid gap-3">
            {order.order.items.map((item) => (
              <article className="mf-cart-row min-w-0 p-4" key={item.id}>
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="break-words font-black text-[#17314A]">{Number(item.quantity)}x {localizeMenuName(item.productName)}</h3>
                    {item.variantName ? <p className="mt-1 text-sm font-semibold text-[#586B7D]">{localizeMenuName(item.variantName)}</p> : null}
                  </div>
                  <span className="shrink-0 font-black text-[#0A7168]">{formatMoney(item.totalPrice)}</span>
                </div>
                {modifiersFor(item.modifierSnapshot).length ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {modifiersFor(item.modifierSnapshot).map((modifier, index) => (
                      <span className="rounded-full bg-[#0A7168]/10 px-3 py-1 text-xs font-black text-[#0A7168]" key={`${modifier.name}-${index}`}>
                        {localizeMenuName(modifier.name)}
                      </span>
                    ))}
                  </div>
                ) : null}
                {item.notes ? <p className="mt-3 text-sm font-semibold text-[#586B7D]">Izoh: {item.notes}</p> : null}
              </article>
            ))}
          </div>
        </MotionDiv>
      </div>

      <aside className="grid min-w-0 content-start gap-5">
        <section className="mf-checkout-card p-5">
          <h2 className="text-2xl font-black text-[#17314A]">Xulosa</h2>
          <div className="mt-4 grid gap-3 text-sm font-bold text-[#586B7D]">
            <SummaryRow label="Filial" value={order.branch?.name ?? "Ko'rsatilmagan"} />
            {order.branch?.address ? <SummaryRow label="Manzil" value={order.branch.address} /> : null}
            <SummaryRow label="Turi" value={typeLabels[order.type] ?? order.type} />
            {order.deliveryAddress ? <SummaryRow label="Yetkazish" value={order.deliveryAddress} /> : null}
            <SummaryRow label="To'lov" value={paymentLabels[order.paymentMethod ?? ""] ?? order.paymentMethod ?? "Ko'rsatilmagan"} />
          </div>
        </section>

        <section className="mf-checkout-card p-5">
          <h2 className="text-xl font-black text-[#17314A]">To'lov holati</h2>
          <div className="mt-4 grid gap-2">
            {order.order.payments?.length ? order.order.payments.map((payment) => (
              <div className="mf-cart-row p-3 text-sm font-bold text-[#17314A]" key={payment.id}>
                <div className="flex justify-between gap-3">
                  <span>{payment.method?.name ?? payment.methodCode ?? "To'lov"}</span>
                  <span className="text-[#0A7168]">{formatMoney(payment.amount)}</span>
                </div>
                <p className="mt-1 text-xs text-[#586B7D]">{paymentStatusLabel(payment.status)}</p>
              </div>
            )) : <p className="text-sm font-semibold text-[#586B7D]">Buyurtmani olganda to'lanadi.</p>}
          </div>
        </section>
      </aside>
      {/*
        BEKOR QILISHNI TASDIQLASH. Native `<dialog>` ATAYLAB: u fokusni
        o'zida ushlab turadi va Esc bilan yopiladi — ilovaning boshqa
        joyida (fulfilment dialogi) ham shu naqsh ishlatiladi.
      */}
      {cancelOpen ? (
        <CancelDialog
          busy={cancelling}
          reason={cancelReason}
          onReasonChange={setCancelReason}
          onClose={() => {
            setCancelOpen(false);
            setCancelError(null);
          }}
          onConfirm={() => void cancelOrder()}
        />
      ) : null}
    </MotionDiv>
  );
}

function CancelDialog({
  busy,
  reason,
  onReasonChange,
  onClose,
  onConfirm,
}: {
  busy: boolean;
  reason: string;
  onReasonChange: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const dialog = useRef<HTMLDialogElement | null>(null);

  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    if (!node.open) node.showModal();
    const stop = (event: Event) => {
      // Yuborilayotganda Esc bilan yopilishi so'rovni yarim qoldirardi.
      if (busy) event.preventDefault();
    };
    node.addEventListener("cancel", stop);
    return () => node.removeEventListener("cancel", stop);
  }, [busy]);

  return (
    <dialog
      className="mf-cancel-dialog"
      ref={dialog}
      onClose={onClose}
      aria-labelledby="cancel-order-title"
    >
      <h2 className="text-xl font-black text-[#17314A]" id="cancel-order-title">
        Buyurtmani bekor qilasizmi?
      </h2>
      <p className="mt-2 text-sm font-semibold leading-6 text-[#586B7D]">
        Bekor qilingandan keyin buyurtma qaytarilmaydi. Kerak bo'lsa yangi
        buyurtma berishingiz mumkin.
      </p>
      <label className="mt-4 grid gap-1.5 text-sm font-semibold text-[#17314A]">
        Sabab (ixtiyoriy)
        <textarea
          className="mf-input px-4 py-3"
          maxLength={300}
          placeholder="Masalan: adashib buyurtma berdim"
          rows={2}
          value={reason}
          onChange={(event) => onReasonChange(event.target.value)}
        />
      </label>
      <div className="mt-5 flex flex-wrap justify-end gap-2.5">
        <button
          className="pressable mf-button-secondary inline-flex min-h-11 items-center px-4 py-3 text-sm font-bold"
          disabled={busy}
          onClick={onClose}
          type="button"
        >
          Ortga
        </button>
        <button
          className="pressable mf-button-cancel is-solid inline-flex min-h-11 items-center gap-2 px-5 py-3 text-sm font-black"
          disabled={busy}
          onClick={onConfirm}
          type="button"
        >
          <XCircle aria-hidden="true" size={17} />
          {busy ? "Bekor qilinmoqda..." : "Ha, bekor qilaman"}
        </button>
      </div>
    </dialog>
  );
}

function StatusHistory({
  entries,
  type,
}: {
  entries: NonNullable<CustomerOrderDetail["order"]["statusHistory"]>;
  type: string;
}) {
  return (
    <section className="mf-checkout-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#0A7168]">
            Buyurtma jurnali
          </p>
          <h2 className="mt-1 text-2xl font-black text-[#17314A]">
            Holatlar tarixi
          </h2>
        </div>
        <Clock3 className="mt-1 text-[#0A7168]" size={22} aria-hidden="true" />
      </div>
      {entries.length ? (
        <ol className="mt-5 grid gap-0">
          {entries.map((entry, index) => {
            const employee = entry.changedByEmployee;
            const actor =
              employee
                ? [employee.firstName, employee.lastName].filter(Boolean).join(" ")
                : entry.changedByUser?.displayName || "Tizim";
            return (
              <li className="relative flex gap-3 pb-5 last:pb-0" key={entry.id}>
                {index < entries.length - 1 ? (
                  <span className="absolute left-[13px] top-7 h-[calc(100%-18px)] w-px bg-[#0A7168]/18" />
                ) : null}
                <span className="relative z-10 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#0A7168]/10 text-[#0A7168]">
                  <CheckCircle2 size={17} aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <p className="font-black text-[#17314A]">
                      {trackingLabel(entry.toStatus, type)}
                    </p>
                    <time
                      className="text-xs font-semibold text-[#586B7D]"
                      dateTime={entry.createdAt}
                    >
                      {new Date(entry.createdAt).toLocaleString("uz-UZ")}
                    </time>
                  </div>
                  <p className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-[#586B7D]">
                    <UserRound size={13} aria-hidden="true" />
                    {actor}
                  </p>
                  {entry.reason ? (
                    <p className="mt-1 text-xs text-[#586B7D]">{entry.reason}</p>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="mt-4 text-sm font-semibold text-[#586B7D]">
          Holatlar tarixi hali shakllanmagan.
        </p>
      )}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="mf-cart-row min-w-0 p-4">
      <p className="text-xs font-black uppercase text-[#0A7168]">{label}</p>
      <p className="mt-2 break-words text-lg font-black text-[#17314A]">{value}</p>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 justify-between gap-3 border-b border-[#0A7168]/12 pb-3 last:border-b-0 last:pb-0">
      <span className="shrink-0 text-[#586B7D]">{label}</span>
      <span className="min-w-0 break-words text-right text-[#17314A]">{value}</span>
    </div>
  );
}

function customerOrderNumber(order: { displayOrderNumber?: string | null; orderNumber: string }): string {
  return order.displayOrderNumber ?? order.orderNumber;
}

function modifiersFor(value: ModifierSnapshot[] | null | undefined): ModifierSnapshot[] {
  return Array.isArray(value) ? value.filter((modifier) => Boolean(modifier.name)) : [];
}
