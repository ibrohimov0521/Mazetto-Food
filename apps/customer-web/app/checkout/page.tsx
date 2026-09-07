"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Banknote,
  Check,
  MapPin,
  Pencil,
  ShoppingBag,
  Truck,
  UserRound,
} from "lucide-react";

import { deliveryAddressText } from "../../lib/delivery-location";

import "leaflet/dist/leaflet.css";
import "./checkout.css";
import "../../components/fulfillment-dialog.css";

import { CustomerAuthPanel } from "../../components/customer-auth-panel";
import { AnimatedMoney, hapticTap } from "../../components/motion-primitives";
import { MediaImage } from "../../components/media-image";
import { SiteShell } from "../../components/site-shell";
import { useCheckoutRuntime } from "../../lib/checkout-runtime";
import { localizeMenuName } from "../../lib/customer-display";

import type { Branch } from "../../lib/types";

type OrderResult = {
  customerOrder: { id: string };
  order: {
    orderNumber: string;
    displayOrderNumber?: string | null;
    id?: string;
  } | null;
};
type OrderType = "DELIVERY" | "PICKUP";
type PaymentMethod = "CASH";
type CheckoutQuote = {
  subtotal: string;
  deliveryFee: string;
  total: string;
  paymentMethods: { code: PaymentMethod; label: string; status: "AVAILABLE" }[];
};
type FormErrors = Partial<
  Record<
    "name" | "phone" | "address" | "branchId" | "items" | "customer",
    string
  >
>;

const checkoutAttemptKey = "mazetto.customer.checkoutAttemptId";
const checkoutAttemptPayloadKey = "mazetto.customer.checkoutAttemptPayload";

const paymentOptions: { value: PaymentMethod; label: string; hint: string }[] =
  [{ value: "CASH", label: "Naqd", hint: "Kuryerga yoki kassada" }];

export default function CheckoutPage() {
  return (
    <SiteShell>
      <CheckoutFlow />
    </SiteShell>
  );
}

function CheckoutFlow() {
  const router = useRouter();
  const {
    clearCart,
    customer,
    items,
    refreshCustomer,
    showToast,
    subtotal,
    request: apiFetch,
    preview,
    fulfillment,
    fulfillmentConfirmed,
    openFulfillment,
  } = useCheckoutRuntime();
  const [branches, setBranches] = useState<Branch[]>([]);
  const branchId = fulfillment?.branchId ?? "";
  const [name, setName] = useState(customer?.name ?? "");
  const [phone, setPhone] = useState(customer?.phone ?? "");
  const deliveryLocation = fulfillmentConfirmed
    ? (fulfillment?.location ?? null)
    : null;
  const submitLock = useRef(false);
  const [comment, setComment] = useState("");
  const type: OrderType = fulfillment?.type ?? "DELIVERY";
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [quote, setQuote] = useState<CheckoutQuote | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [loadingQuote, setLoadingQuote] = useState(false);
  const [loadingBranches, setLoadingBranches] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [branchError, setBranchError] = useState<string | null>(null);
  const branchRequest = useRef(0);
  const quoteRequest = useRef(0);
  const deliveryFee = quote ? Number(quote.deliveryFee) : 0;
  const total = quote ? Number(quote.total) : subtotal;
  const selectedBranch = branches.find((branch) => branch.id === branchId);
  const availablePaymentOptions = useMemo(() => {
    const allowedCodes = new Set(
      (quote?.paymentMethods ?? []).map((method) => method.code),
    );
    return allowedCodes.size
      ? paymentOptions.filter((option) => allowedCodes.has(option.value))
      : paymentOptions;
  }, [quote?.paymentMethods]);
  const orderItemsPayload = useMemo(
    () =>
      items.map((item) => ({
        productId: item.productId,
        variantId: item.variantId,
        quantity: item.quantity,
        notes: item.notes,
        modifiers: item.modifiers.map((modifier) => ({
          modifierId: modifier.modifierId,
          quantity: 1,
        })),
      })),
    [items],
  );

  const loadBranches = useCallback(async () => {
    const version = ++branchRequest.current;
    setLoadingBranches(true);
    setBranchError(null);
    try {
      const nextBranches = await apiFetch<Branch[]>("/customer/branches");
      if (version !== branchRequest.current) return;
      setBranches(nextBranches);
    } catch (error) {
      if (version === branchRequest.current)
        setBranchError(
          error instanceof Error ? error.message : "Filiallar yuklanmadi.",
        );
    } finally {
      if (version === branchRequest.current) setLoadingBranches(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    void loadBranches();
    return () => {
      branchRequest.current++;
    };
  }, [loadBranches]);

  useEffect(() => {
    if (customer) {
      setName(customer.name);
      setPhone(customer.phone);
    }
  }, [customer]);

  const loadQuote = useCallback(async () => {
    const version = ++quoteRequest.current;
    setQuote(null);
    if (!customer?.accessToken || !branchId || !items.length) {
      setQuote(null);
      setQuoteError(null);
      setLoadingQuote(false);
      return;
    }

    setLoadingQuote(true);
    setQuoteError(null);
    try {
      const request = {
        accessToken: customer.accessToken,
        body: JSON.stringify({
          branchId,
          type,
          items: orderItemsPayload,
        }),
        method: "POST",
      } as const;
      let nextQuote: CheckoutQuote;

      try {
        nextQuote = await apiFetch<CheckoutQuote>(
          "/customer/checkout/quote",
          request,
        );
      } catch (error) {
        if (!isCustomerSessionError(error)) {
          throw error;
        }

        const refreshed = await refreshCustomer();

        if (!refreshed) {
          throw error;
        }

        nextQuote = await apiFetch<CheckoutQuote>("/customer/checkout/quote", {
          ...request,
          accessToken: refreshed.accessToken,
        });
      }

      if (version === quoteRequest.current) setQuote(nextQuote);
    } catch (error) {
      if (version !== quoteRequest.current) return;
      const message =
        error instanceof Error ? error.message : "Narxni hisoblab bo'lmadi";
      setQuote(null);
      setQuoteError(message);
    } finally {
      if (version === quoteRequest.current) setLoadingQuote(false);
    }
  }, [
    branchId,
    customer?.accessToken,
    items.length,
    orderItemsPayload,
    apiFetch,
    refreshCustomer,
    type,
  ]);

  useEffect(() => {
    void loadQuote();
    return () => {
      quoteRequest.current++;
    };
  }, [loadQuote]);

  function validate() {
    const nextErrors: FormErrors = {};

    if (!customer?.accessToken) {
      nextErrors.customer =
        "Buyurtma berish uchun telefon raqamingizni tasdiqlang.";
    }

    if (!items.length) {
      nextErrors.items = "Savatingiz bo'sh.";
    }

    if (!branchId || !fulfillmentConfirmed) {
      nextErrors.address = "Qabul qilish usuli va manzilni tasdiqlang.";
    }

    if (branchId && !selectedBranch) {
      nextErrors.branchId = "Tanlangan filial topilmadi. Qaytadan tanlang.";
    }

    if (selectedBranch && !selectedBranch.acceptsOrders) {
      nextErrors.branchId = "Bu filial hozir buyurtma qabul qilmayapti.";
    }

    if (
      selectedBranch &&
      type === "DELIVERY" &&
      !selectedBranch.deliveryEnabled
    ) {
      nextErrors.branchId = "Bu filialda yetkazib berish mavjud emas.";
    }

    if (selectedBranch && type === "PICKUP" && !selectedBranch.pickupEnabled) {
      nextErrors.branchId = "Bu filialdan olib ketish mavjud emas.";
    }

    if (!name.trim()) {
      nextErrors.name = "Ismingizni kiriting.";
    }

    if (!/^(?:998)?\d{9}$/.test(phone.replace(/\D/g, ""))) {
      nextErrors.phone = "Telefon raqamni to'g'ri kiriting.";
    }

    if (type === "DELIVERY" && !deliveryLocation) {
      nextErrors.address = "Yetkazish manzilini belgilang va tasdiqlang.";
    }

    setErrors(nextErrors);
    const firstField = Object.keys(nextErrors)[0];
    if (firstField)
      requestAnimationFrame(() => {
        const target = document.getElementById(
          firstField === "address"
            ? "delivery-address"
            : "checkout-" + firstField,
        );
        target?.scrollIntoView({ block: "center", behavior: "instant" });
        target?.focus({ preventScroll: true });
      });
    return !Object.keys(nextErrors).length;
  }

  async function submitOrder() {
    if (
      submitLock.current ||
      submitting ||
      loadingBranches ||
      loadingQuote ||
      branchError ||
      !quote
    )
      return;
    if (!validate() || !customer?.accessToken) {
      showToast("Ma'lumotlarni tekshirib chiqing");
      return;
    }

    if (preview) {
      showToast(
        "Sinov muvaffaqiyatli: ma'lumotlar tayyor. Haqiqiy buyurtma yuborilmadi.",
      );
      return;
    }
    submitLock.current = true;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const orderPayload = {
        branchId,
        name: name.trim(),
        phone: phone.trim(),
        type,
        address:
          type === "DELIVERY" && deliveryLocation
            ? deliveryAddressText(deliveryLocation)
            : undefined,
        deliveryLocation:
          type === "DELIVERY" ? (deliveryLocation ?? undefined) : undefined,
        paymentMethod,
        notes: comment.trim() || undefined,
        items: orderItemsPayload,
      };
      const idempotencyKey = getCheckoutAttemptId(JSON.stringify(orderPayload));
      const request = {
        method: "POST",
        accessToken: customer.accessToken,
        body: JSON.stringify({
          idempotencyKey,
          ...orderPayload,
        }),
      } as const;
      let result: OrderResult;

      try {
        result = await apiFetch<OrderResult>("/customer/orders", request);
      } catch (error) {
        if (!isCustomerSessionError(error)) throw error;
        const refreshed = await refreshCustomer();

        if (!refreshed) {
          throw error;
        }

        result = await apiFetch<OrderResult>("/customer/orders", {
          ...request,
          accessToken: refreshed.accessToken,
        });
      }

      clearCart();
      clearCheckoutAttempt();
      hapticTap([18, 36, 18]);
      showToast("Buyurtma muvaffaqiyatli yuborildi");
      router.push(`/order-success/${result.customerOrder.id}`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Buyurtmani yuborib bo'lmadi";
      setSubmitError(message);
      showToast(message);
    } finally {
      submitLock.current = false;
      setSubmitting(false);
    }
  }

  if (!customer?.accessToken) {
    return (
      <section className="mx-auto max-w-3xl px-4 py-10">
        <div className="mf-checkout-card p-8">
          <p className="text-sm font-black uppercase text-[#0B7F75]">
            Rasmiylashtirish
          </p>
          <CustomerAuthPanel
            description="Buyurtmani yakunlash uchun telefon raqamingizni Telegram kodi bilan tasdiqlang."
            title="Telefonni tasdiqlang"
          />
          {process.env.NODE_ENV === "development" ? (
            <Link
              className="mf-location-button is-primary mt-5"
              href="/checkout/preview"
            >
              Dizaynni loginsiz ko'rish
              <ArrowRight size={18} />
            </Link>
          ) : null}
        </div>
      </section>
    );
  }

  if (!items.length) {
    return (
      <section className="mf-checkout-empty">
        <ShoppingBag size={40} />
        <h1>Savatingiz bo'sh</h1>
        <Link className="mf-location-button is-primary" href="/menu">
          Menyuga o'tish
          <ArrowRight size={18} />
        </Link>
      </section>
    );
  }

  const locked =
    submitting ||
    loadingBranches ||
    loadingQuote ||
    Boolean(branchError) ||
    !quote;

  return (
    <div className="mf-checkout-page">
      <header className="mf-checkout-heading">
        <Link href="/cart" className="mf-checkout-back">
          <ArrowLeft size={18} />
          Savatcha
        </Link>
        <h1>Buyurtmani rasmiylashtirish</h1>
        <ol className="mf-checkout-progress" aria-label="Buyurtma bosqichlari">
          <li className="is-complete">
            <Check size={15} />
            <span>Savatcha</span>
          </li>
          <li aria-current="step">
            <span className="mf-progress-number">2</span>
            <span>Rasmiylashtirish</span>
          </li>
          <li>
            <span className="mf-progress-number">3</span>
            <span>Tayyor</span>
          </li>
        </ol>
      </header>
      <div className="mf-checkout-layout">
        <div className="mf-checkout-main">
          <section
            className="mf-checkout-section"
            id="delivery-address"
            tabIndex={-1}
            aria-labelledby="delivery-title"
          >
            <h2 className="mf-checkout-section-title" id="delivery-title">
              {type === "PICKUP" ? (
                <ShoppingBag size={21} />
              ) : (
                <Truck size={21} />
              )}
              {type === "PICKUP" ? "Olib ketish" : "Yetkazish manzili"}
            </h2>
            {fulfillment ? (
              <div className="mf-selected-fulfillment">
                <MapPin size={21} />
                <div>
                  <strong>
                    {type === "PICKUP"
                      ? fulfillment.branchName
                      : fulfillment.location?.address}
                  </strong>
                  <p>
                    {type === "PICKUP"
                      ? fulfillment.branchAddress
                      : fulfillment.location
                        ? deliveryAddressText(fulfillment.location)
                        : ""}
                  </p>
                  {type === "DELIVERY" ? <p>{fulfillment.branchName}</p> : null}
                  {fulfillmentConfirmed ? (
                    <small>
                      <Check size={14} />
                      Manzil tanlangan
                    </small>
                  ) : null}
                </div>
                <button
                  type="button"
                  className="mf-location-button is-primary mf-address-change"
                  disabled={submitting}
                  onClick={openFulfillment}
                >
                  <Pencil size={17} aria-hidden="true" />
                  {fulfillmentConfirmed
                    ? "O'zgartirish"
                    : "Manzilni tasdiqlash"}
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="mf-location-button is-primary"
                onClick={openFulfillment}
              >
                <MapPin size={18} />
                Qabul qilish usulini tanlash
              </button>
            )}
            <FieldError message={errors.address ?? errors.branchId} />
            {branchError ? (
              <div role="alert">
                <FieldError message={branchError} />
                <button
                  className="mf-text-command"
                  onClick={() => void loadBranches()}
                  type="button"
                >
                  Qayta urinish
                </button>
              </div>
            ) : null}
          </section>

          <fieldset disabled={submitting} className="mf-checkout-section">
            <legend className="mf-checkout-section-title">
              <UserRound size={21} />
              <span>Aloqa ma'lumotlari</span>
            </legend>
            <div className="mf-contact-fields">
              <label className="mf-checkout-field">
                Ism va familiya
                <input
                  id="checkout-name"
                  autoComplete="name"
                  maxLength={120}
                  aria-invalid={Boolean(errors.name)}
                  className="mf-input"
                  placeholder="Ismingiz"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
                <FieldError message={errors.name} />
              </label>
              <label className="mf-checkout-field">
                Telefon raqam
                <input
                  id="checkout-phone"
                  autoComplete="tel"
                  type="tel"
                  maxLength={40}
                  aria-invalid={Boolean(errors.phone)}
                  className="mf-input"
                  placeholder="+998 90 123 45 67"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                />
                <FieldError message={errors.phone} />
              </label>
            </div>
            <label className="mf-checkout-field mf-order-comment">
              Buyurtmaga izoh
              <textarea
                className="mf-input"
                maxLength={1000}
                placeholder="Qo'shimcha istaklar (ixtiyoriy)"
                rows={2}
                value={comment}
                onChange={(event) => setComment(event.target.value)}
              />
            </label>
          </fieldset>

          <fieldset disabled={submitting} className="mf-checkout-section">
            <legend className="mf-checkout-section-title">
              <Banknote size={21} />
              <span>To'lov usuli</span>
            </legend>
            {availablePaymentOptions.map((option) => (
              <label className="mf-checkout-payment" key={option.value}>
                <Banknote size={24} />
                <span>
                  <strong>{option.label}</strong>
                  <small>
                    {type === "DELIVERY"
                      ? "Buyurtmani olganda kuryerga"
                      : "Buyurtmani olganda kassada"}
                  </small>
                </span>
                <input
                  type="radio"
                  name="payment"
                  value={option.value}
                  checked={paymentMethod === option.value}
                  onChange={() => setPaymentMethod(option.value)}
                />
              </label>
            ))}
          </fieldset>
        </div>

        <aside className="mf-checkout-summary" aria-labelledby="summary-title">
          <div className="mf-summary-heading">
            <h2 id="summary-title">Sizning buyurtmangiz</h2>
            <Link href="/cart" className="mf-text-command">
              Tahrirlash
            </Link>
          </div>
          <div className="mf-checkout-items">
            {items.map((item) => (
              <div className="mf-checkout-item" key={item.key}>
                <MediaImage
                  alt={item.productName}
                  aspectClassName="h-14 w-14"
                  className="rounded-lg"
                  sizes="56px"
                  src={item.imageUrl}
                />
                <div>
                  <strong>{localizeMenuName(item.productName)}</strong>
                  <small>
                    {item.quantity} dona
                    {item.variantName
                      ? " / " + localizeMenuName(item.variantName)
                      : ""}
                  </small>
                </div>
                <span>
                  <AnimatedMoney
                    value={
                      item.quantity *
                      (Number(item.unitPrice) +
                        item.modifiers.reduce(
                          (sum, modifier) => sum + Number(modifier.price),
                          0,
                        ))
                    }
                  />
                </span>
              </div>
            ))}
          </div>
          <dl className="mf-checkout-totals">
            <div>
              <dt>Mahsulotlar</dt>
              <dd>
                <AnimatedMoney
                  value={quote ? Number(quote.subtotal) : subtotal}
                />
              </dd>
            </div>
            <div>
              <dt>{type === "DELIVERY" ? "Yetkazib berish" : "Olib ketish"}</dt>
              <dd>
                {loadingQuote ? (
                  "Hisoblanmoqda..."
                ) : !quote ? (
                  "Hisoblanmagan"
                ) : deliveryFee ? (
                  <AnimatedMoney value={deliveryFee} />
                ) : (
                  "Bepul"
                )}
              </dd>
            </div>
            <div className="mf-checkout-grand-total">
              <dt>Jami</dt>
              <dd>
                <AnimatedMoney value={total} />
              </dd>
            </div>
          </dl>
          {type === "DELIVERY" && deliveryLocation ? (
            <p className="mf-summary-destination">
              <MapPin size={17} />
              <span>
                {deliveryLocation.address}, {deliveryLocation.house}
              </span>
            </p>
          ) : null}
          {submitError ? (
            <p role="alert" className="mf-checkout-error">
              {submitError}
            </p>
          ) : null}
          {quoteError ? (
            <div role="alert" className="mf-checkout-error">
              <p>{quoteError}</p>
              <button
                className="mf-text-command"
                onClick={() => void loadQuote()}
                type="button"
              >
                Qayta hisoblash
              </button>
            </div>
          ) : null}
          <button
            className="mf-checkout-submit mf-desktop-submit"
            disabled={locked}
            onClick={() => void submitOrder()}
            type="button"
          >
            <span>
              {submitting ? "Yuborilmoqda..." : "Buyurtmani tasdiqlash"}
            </span>
            <ArrowRight size={19} />
          </button>
        </aside>
      </div>
      <div className="mf-checkout-mobile-bar">
        <div>
          <span>Jami</span>
          <strong>
            <AnimatedMoney value={total} />
          </strong>
        </div>
        <button
          className="mf-checkout-submit"
          disabled={locked}
          onClick={() => void submitOrder()}
          type="button"
        >
          <span>{submitting ? "Yuborilmoqda..." : "Tasdiqlash"}</span>
          <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
}

function FieldError({ message }: { message: string | undefined }) {
  return message ? <p className="mf-checkout-error">{message}</p> : null;
}

let memoryAttempt: { id: string; signature: string } | null = null;

function getCheckoutAttemptId(payloadSignature: string): string {
  let storedSignature: string | null = null;
  let storedAttemptId: string | null = null;
  try {
    storedSignature = window.localStorage.getItem(checkoutAttemptPayloadKey);
    storedAttemptId = window.localStorage.getItem(checkoutAttemptKey);
  } catch {
    /* The in-memory attempt below also protects retries in this tab. */
  }
  if (memoryAttempt?.signature === payloadSignature) return memoryAttempt.id;

  if (storedAttemptId && storedSignature === payloadSignature) {
    return storedAttemptId;
  }

  const nextAttemptId = createClientId();
  memoryAttempt = { id: nextAttemptId, signature: payloadSignature };
  try {
    window.localStorage.setItem(checkoutAttemptKey, nextAttemptId);
    window.localStorage.setItem(checkoutAttemptPayloadKey, payloadSignature);
  } catch {
    /* Storage can be unavailable in private browsers. */
  }
  return nextAttemptId;
}

function clearCheckoutAttempt() {
  memoryAttempt = null;
  try {
    window.localStorage.removeItem(checkoutAttemptKey);
    window.localStorage.removeItem(checkoutAttemptPayloadKey);
  } catch {
    /* A completed order must not appear failed because storage is blocked. */
  }
}

function isCustomerSessionError(error: unknown): boolean {
  return (
    error instanceof Error && error.message.includes("Sessiya muddati tugagan")
  );
}

function createClientId(): string {
  if (typeof window.crypto?.randomUUID === "function") {
    return window.crypto.randomUUID();
  }

  return `checkout-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
