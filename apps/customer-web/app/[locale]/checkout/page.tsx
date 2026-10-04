"use client";
import { useLocale, useTranslations } from "next-intl";

import { useRouter } from "@/i18n/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@/i18n/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Banknote,
  Check,
  MapPin,
  Pencil,
  ShoppingBag,
  Smartphone,
  Truck,
  UserRound,
  type LucideIcon,
} from "lucide-react";

import { deliveryAddressText } from "@/lib/delivery-location";

import "leaflet/dist/leaflet.css";
import "./checkout.css";
import "@/components/fulfillment-dialog.css";

import { CustomerAuthPanel } from "@/components/customer-auth-panel";
import { AnimatedMoney, hapticTap } from "@/components/motion-primitives";
import { MediaImage } from "@/components/media-image";
import { SiteShell } from "@/components/site-shell";
import { OrderActionBar } from "@/components/order-action-bar";
import { useCheckoutRuntime } from "@/lib/checkout-runtime";
import { localizeMenuName } from "@/lib/customer-display";
import { localizeCustomerCopy } from "@/lib/customer-copy.mjs";

import type { Branch } from "@/lib/types";
import { normalizePhone } from "@/lib/phone";
import { PhoneInput, nationalPhoneValue } from "@/components/phone-input";

type OrderResult = {
  customerOrder: { id: string };
  order: {
    orderNumber: string;
    displayOrderNumber?: string | null;
    id?: string;
  } | null;
};
type OrderType = "DELIVERY" | "PICKUP";
/*
 * Server yagona manba: `customer_payment_methods` sozlamasi qaysi usullar
 * OPERATSION ekanini aytadi. Bu yerdagi ro'yxat butun KATALOG — hali ishga
 * tushmaganlari ham bor, chunki ular yashirilmaydi.
 *
 * Egasining qaroriga ko'ra hozircha FAQAT naqd ishlaydi, keyinchalik
 * Click va Payme qo'shiladi. Karta ro'yxatdan olib tashlandi: rejada
 * yo'q usulni "Tez kunda" deb ko'rsatish mijozga yolg'on va'da berardi.
 */
type PaymentMethod = "CASH" | "CLICK" | "PAYME";
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

/*
 * Har usulning O'Z ikonkasi va O'Z xulosa matni bor.
 *
 * Ilgari to'rttasi ham `Banknote` bilan chizilardi (ko'z rangdan/shakldan
 * usulni ajratolmasdi), xulosada esa qat'iy "Buyurtmani olganda naqd to'lov"
 * yozilardi — kartani tanlagan mijozga ham "naqd" deb ko'rsatilardi.
 *
 * `summary` — buyurtma xulosasidagi bir qatorlik jumla; `hint` — radio
 * yonidagi kichik izoh.
 */
const paymentOptions: {
  value: PaymentMethod;
  label: string;
  hint: string;
  icon: LucideIcon;
  summary: { delivery: string; pickup: string };
}[] = [
  {
    value: "CASH",
    label: "Naqd",
    hint: "Kuryerga yoki kassada",
    icon: Banknote,
    summary: {
      delivery: "Buyurtmani olganda kuryerga naqd to'lov",
      pickup: "Buyurtmani olganda kassada naqd to'lov",
    },
  },
  {
    value: "CLICK",
    label: "Click",
    hint: "Ilova orqali onlayn",
    icon: Smartphone,
    summary: {
      delivery: "Click ilovasi orqali onlayn to'lov",
      pickup: "Click ilovasi orqali onlayn to'lov",
    },
  },
  {
    value: "PAYME",
    label: "Payme",
    hint: "Ilova orqali onlayn",
    icon: Smartphone,
    summary: {
      delivery: "Payme ilovasi orqali onlayn to'lov",
      pickup: "Payme ilovasi orqali onlayn to'lov",
    },
  },
];

export default function CheckoutPage() {
  return (
    <SiteShell>
      <CheckoutFlow />
    </SiteShell>
  );
}

function CheckoutFlow() {
  const locale = useLocale();
  const meta = useTranslations("CustomerMeta");
  const t = useTranslations("Customer");
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
  const [phone, setPhone] = useState(() =>
    nationalPhoneValue(customer?.phone ?? ""),
  );
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
  const [online, setOnline] = useState(true);
  /*
   * Buyurtma yuborilgani. `clearCart()` va `router.push()` orasida React
   * qayta chizadi, va o'sha lahzada "savat bo'sh" guardi ishga tushib,
   * foydalanuvchi muvaffaqiyat sahifasiga o'tishdan oldin "Savatingiz
   * bo'sh" ni ko'rib qolardi.
   *
   * `useState` emas, `useRef`: bayroq QAYTA CHIZISHDAN oldin ta'sir
   * qilishi kerak, `setState` esa navbatga qo'yiladi.
   */
  const placed = useRef(false);
  const branchRequest = useRef(0);
  const quoteRequest = useRef(0);
  const offlineMessage = online
    ? null
    : "Internet aloqasi yo'q. Buyurtma yuborish uchun internetga ulaning.";
  const deliveryFee = quote ? Number(quote.deliveryFee) : 0;
  const total = quote ? Number(quote.total) : subtotal;
  const selectedBranch = branches.find((branch) => branch.id === branchId);

  useEffect(() => {
    const updateOnlineState = () => setOnline(window.navigator.onLine);
    updateOnlineState();
    window.addEventListener("online", updateOnlineState);
    window.addEventListener("offline", updateOnlineState);
    return () => {
      window.removeEventListener("online", updateOnlineState);
      window.removeEventListener("offline", updateOnlineState);
    };
  }, []);
  /*
   * Usullar YASHIRILMAYDI — hammasi ko'rsatiladi, hali ishga tushmaganiga
   * "Tez kunda" belgisi qo'yiladi.
   *
   * Nima uchun: yashirilgan usul "bu yerda yo'q" degan taassurot beradi va
   * mijoz kartada to'lay olmasligini buyurtma berayotganda biladi. Belgi esa
   * "hozircha yo'q, lekin bo'ladi" deydi — bu kutishni to'g'ri shakllantiradi.
   *
   * Qaysi usul operatsion ekanini SERVER aytadi (kotirovka javobidagi
   * `paymentMethods`). Kotirovka hali kelmagan bo'lsa hech biri tanlanmaydi.
   */
  const paymentAvailability = useMemo(() => {
    const allowedCodes = new Set(
      (quote?.paymentMethods ?? []).map((method) => method.code),
    );
    /*
     * Kotirovka hali kelmagan bo'lsa server HECH NARSA aytmagan. Bu holatda
     * hammasini "Tez kunda" deb belgilash yolg'on bo'lardi va yuklanish
     * tugagach uchtasi belgidan radioga sakrab, ko'z oldida "yaltirardi".
     * Shuning uchun bilmaganda hech narsa da'vo qilinmaydi.
     */
    if (!allowedCodes.size) {
      return paymentOptions.map((option) => ({ ...option, available: true }));
    }
    return paymentOptions.map((option) => ({
      ...option,
      available: allowedCodes.has(option.value),
    }));
  }, [quote?.paymentMethods]);
  /*
   * Tanlangan usul serverga ko'ra ishlamasa — birinchi ishlaydiganiga
   * o'tkaziladi.
   *
   * Ilgari mijoz kotirovka kelishidan oldin "Click"ni tanlab qo'ysa,
   * keyin server uni rad etgani uchun radio "Tez kunda" belgisiga
   * aylanardi, lekin `paymentMethod` state'da "CLICK" qolib ketardi va
   * buyurtma yaroqsiz usul bilan yuborilardi. Xato faqat yuborishdan
   * keyin ko'rinardi.
   */
  useEffect(() => {
    if (!quote) return;
    const available = paymentAvailability.filter((option) => option.available);
    if (!available.length) return;
    if (available.some((option) => option.value === paymentMethod)) return;
    setPaymentMethod(available[0]!.value);
  }, [quote, paymentAvailability, paymentMethod]);
  const selectedPayment =
    paymentOptions.find((option) => option.value === paymentMethod) ??
    paymentOptions[0]!;
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
          deliveryLocation:
            type === "DELIVERY" ? (deliveryLocation ?? undefined) : undefined,
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
    deliveryLocation,
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

    /*
     * Backend bilan BIR XIL qoidalar (`normalizeCustomerPhone` nusxasi).
     * Ilgari bu yerdagi regex "+7 998..." kabi boshqa mamlakat raqamini
     * o'tkazib yuborardi va uni server rad etardi — xato faqat yuborishdan
     * keyin ko'rinardi.
     */
    if (!normalizePhone(phone)) {
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
    if (!window.navigator.onLine) {
      setOnline(false);
      setSubmitError("Internet aloqasi yo'q. Buyurtma yuborilmadi.");
      showToast("Internet aloqasi yo'q. Buyurtma yuborilmadi.");
      return;
    }
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
        // Serverga har doim bitta ko'rinishda: `+998XXXXXXXXX`.
        phone: normalizePhone(phone) ?? phone.trim(),
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

      // Savatni tozalashdan OLDIN: quyidagi guard ishga tushmasin.
      placed.current = true;
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
          <p className="text-sm font-black uppercase text-[#0A7168]">
            {t("rasmiylashtirish_28dca60c")}</p>
          <CustomerAuthPanel
            description={meta("verifyCheckout")}
            title={t("telefonni_tasdiqlang_517d50f6")}
          />
          {process.env.NODE_ENV === "development" ? (
            <Link
              className="mf-location-button is-primary mt-5"
              href="/checkout/preview"
            >
              {t("dizaynni_loginsiz_ko_rish_5f7ddfd9")}<ArrowRight size={18} />
            </Link>
          ) : null}
        </div>
      </section>
    );
  }

  /*
   * `placed.current` — buyurtma berilgan, savat ataylab tozalangan va
   * navigatsiya yo'lda. Bu holatda "savat bo'sh" ekrani xato bo'lardi.
   * Jimgina redirect ATAYLAB emas: savat haqiqatan bo'sh bo'lsa,
   * foydalanuvchi nima uchun bu yerda ekanini bilishi kerak.
   */
  if (!items.length && !placed.current) {
    return (
      <section className="mf-checkout-empty">
        <ShoppingBag size={40} />
        <h1>{t("savatingiz_bo_sh_c7cdb9f8")}</h1>
        <Link className="mf-location-button is-primary" href="/menu">
          {t("menyuga_o_tish_cd33f01c")}<ArrowRight size={18} />
        </Link>
      </section>
    );
  }

  const locked =
    submitting ||
    loadingBranches ||
    loadingQuote ||
    Boolean(branchError) ||
    !online ||
    !quote;

  return (
    <div className="mf-checkout-page mf-order-checkout">
      <header className="mf-checkout-heading">
        <Link href="/cart" className="mf-checkout-back">
          <ArrowLeft size={18} />
          {t("savatcha_7a2af186")}</Link>
        <h1>{t("buyurtmani_rasmiylashtirish_b7827cb2")}</h1>
        <ol className="mf-checkout-progress" aria-label={t("buyurtma_bosqichlari_93ff8b5e")}>
          <li className="is-complete">
            <Check size={15} />
            <span>{t("savatcha_7a2af186")}</span>
          </li>
          <li aria-current="step">
            <span className="mf-progress-number">2</span>
            <span>{t("rasmiylashtirish_28dca60c")}</span>
          </li>
          <li>
            <span className="mf-progress-number">3</span>
            <span>{t("tayyor_6c016196")}</span>
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
              {type === "PICKUP" ? t("olib_ketish_903d19bf") : t("yetkazish_manzili_1de1c8d6")}
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
                      {t("manzil_tanlangan_aea24384")}</small>
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
                    ? t("o_zgartirish_f0d93509")
                    : t("manzilni_tasdiqlash_a5ab403c")}
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="mf-location-button is-primary"
                onClick={openFulfillment}
              >
                <MapPin size={18} />
                {t("qabul_qilish_usulini_tanlash_f3462386")}</button>
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
                  {t("qayta_urinish_422d2790")}</button>
              </div>
            ) : null}
          </section>

          <fieldset disabled={submitting} className="mf-checkout-section">
            <legend className="mf-checkout-section-title">
              <UserRound size={21} />
              <span>{t("aloqa_ma_lumotlari_2303a04e")}</span>
            </legend>
            <div className="mf-contact-fields">
              <label className="mf-checkout-field">
                {t("ism_va_familiya_70769198")}<input
                  id="checkout-name"
                  autoComplete="name"
                  maxLength={120}
                  aria-invalid={Boolean(errors.name)}
                  {...(errors.name
                    ? { "aria-describedby": "checkout-name-error" }
                    : {})}
                  className="mf-input"
                  placeholder={t("ismingiz_4e44737c")}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
                <FieldError id="checkout-name-error" message={errors.name} />
              </label>
              {/*
                Checkout o'z telefon maydonini qayta yozgan edi: oddiy
                `<input type="tel" maxLength={40}>` matn placeholder
                bilan, holbuki autorizatsiya paneli +998 prefiksi va
                paste tozalashi bo'lgan `PhoneInput` ni ishlatardi —
                bitta oqimda ikki xil telefon maydoni. `normalizePhone`
                9 raqamli mahalliy qiymatni ham qabul qiladi, shuning
                uchun tekshirish va yuborish mantiqi o'zgarmadi.
              */}
              <div className="mf-checkout-field">
                <PhoneInput
                  id="checkout-phone"
                  value={phone}
                  onChange={setPhone}
                  invalid={Boolean(errors.phone)}
                  {...(errors.phone ? { describedBy: "checkout-phone-error" } : {})}
                />
                <FieldError id="checkout-phone-error" message={errors.phone} />
              </div>
            </div>
            <label className="mf-checkout-field mf-order-comment">
              {t("buyurtmaga_izoh_5a1636c5")}<textarea
                className="mf-input"
                maxLength={1000}
                placeholder={t("qo_shimcha_istaklar_ixtiyoriy_44a9b21f")}
                rows={2}
                value={comment}
                onChange={(event) => setComment(event.target.value)}
              />
            </label>
          </fieldset>

          <fieldset disabled={submitting} className="mf-checkout-section">
            <legend className="mf-checkout-section-title">
              <Banknote size={21} />
              <span>{t("to_lov_usuli_63f773cf")}</span>
            </legend>
            {paymentAvailability.map((option) => (
              <label
                className={
                  "mf-checkout-payment" + (option.available ? "" : " is-soon")
                }
                key={option.value}
              >
                <option.icon size={24} aria-hidden="true" />
                <span>
                  <strong>{localizeCustomerCopy(option.label, locale)}</strong>
                  <small>
                    {!option.available
                      ? localizeCustomerCopy(option.hint, locale)
                      : option.value === "CASH"
                        ? type === "DELIVERY"
                          ? t("buyurtmani_olganda_kuryerga_580d090a")
                          : t("buyurtmani_olganda_kassada_88ac0fc0")
                        : localizeCustomerCopy(option.hint, locale)}
                  </small>
                </span>
                {option.available ? (
                  <input
                    type="radio"
                    name="payment"
                    value={option.value}
                    checked={paymentMethod === option.value}
                    onChange={() => setPaymentMethod(option.value)}
                  />
                ) : (
                  /*
                   * Radio o'rniga belgi: o'chirilgan radio bosiladigandek
                   * ko'rinadi va foydalanuvchi uni bosib, hech narsa
                   * bo'lmaganidan chalkashadi.
                   */
                  <span className="mf-payment-soon">{t("tez_kunda_9e2eba19")}</span>
                )}
              </label>
            ))}
          </fieldset>
        </div>

        <aside className="mf-checkout-summary" aria-labelledby="summary-title">
          <div className="mf-summary-heading">
            <h2 id="summary-title">{t("sizning_buyurtmangiz_9f54a8a4")}</h2>
            <Link href="/cart" className="mf-text-command">
              {t("tahrirlash_d68b026b")}</Link>
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
                  <strong>{localizeMenuName(item.productName, locale)}</strong>
                  <small>
                    {item.quantity} {t("dona_f4145289")}{item.variantName
                      ? " / " + localizeMenuName(item.variantName, locale)
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
              <dt>{t("mahsulotlar_66e73a67")}</dt>
              <dd>
                <AnimatedMoney
                  value={quote ? Number(quote.subtotal) : subtotal}
                />
              </dd>
            </div>
            <div>
              <dt>{type === "DELIVERY" ? t("yetkazib_berish_199c427a") : t("olib_ketish_903d19bf")}</dt>
              <dd>
                {loadingQuote ? (
                  t("hisoblanmoqda_82915ab1")
                ) : !quote ? (
                  t("hisoblanmagan_de975acb")
                ) : deliveryFee ? (
                  <AnimatedMoney value={deliveryFee} />
                ) : (
                  t("bepul_e462cc49")
                )}
              </dd>
            </div>
            <div className="mf-checkout-grand-total">
              <dt>{t("jami_52cea6a5")}</dt>
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
              {localizeCustomerCopy(submitError, locale)}
            </p>
          ) : null}
          {offlineMessage && !submitError ? (
            <p role="alert" className="mf-checkout-error">
              {localizeCustomerCopy(offlineMessage, locale)}
            </p>
          ) : null}
          {quoteError ? (
            <div role="alert" className="mf-checkout-error">
              <p>{localizeCustomerCopy(quoteError, locale)}</p>
              <button
                className="mf-text-command"
                onClick={() => void loadQuote()}
                type="button"
              >
                {t("qayta_hisoblash_f0405583")}</button>
            </div>
          ) : null}
          <p className="mf-summary-payment">
            <selectedPayment.icon size={18} aria-hidden="true" />{" "}
            {type === "PICKUP"
              ? localizeCustomerCopy(selectedPayment.summary.pickup, locale)
              : localizeCustomerCopy(selectedPayment.summary.delivery, locale)}
          </p>
        </aside>
      </div>
      <OrderActionBar
        total={total}
        totalLabel={
          loadingQuote ? "Hisoblanmoqda..." : quote ? "Jami" : "Mahsulotlar"
        }
        label={submitting ? "Yuborilmoqda..." : "Tasdiqlash"}
        disabled={locked}
        busy={submitting || loadingQuote}
        notice={localizeCustomerCopy(offlineMessage ?? submitError ?? quoteError, locale) ?? null}
        onConfirm={() => void submitOrder()}
      />
    </div>
  );
}

function FieldError({
  message,
  id,
}: {
  message: string | undefined;
  id?: string;
}) {
  const locale = useLocale();
  return message ? (
    <p className="mf-checkout-error" {...(id ? { id } : {})}>
      {localizeCustomerCopy(message, locale)}
    </p>
  ) : null;
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
