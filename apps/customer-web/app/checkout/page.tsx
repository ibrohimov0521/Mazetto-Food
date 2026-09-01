"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { BranchPicker } from "../../components/branch-picker";
import { CustomerAuthPanel } from "../../components/customer-auth-panel";
import { AnimatedMoney, MotionDiv, hapticTap, pageMotion, sectionMotion } from "../../components/motion-primitives";
import { MediaImage } from "../../components/media-image";
import { SiteShell } from "../../components/site-shell";
import { apiFetch } from "../../lib/api";
import { localizeMenuName } from "../../lib/customer-display";
import { useCart } from "../../lib/cart";
import type { Branch } from "../../lib/types";

type OrderResult = { customerOrder: { id: string }; order: { orderNumber: string; id?: string } | null };
type OrderType = "DELIVERY" | "PICKUP";
type PaymentMethod = "CASH";
type CheckoutQuote = {
  subtotal: string;
  deliveryFee: string;
  total: string;
  paymentMethods: { code: PaymentMethod; label: string; status: "AVAILABLE" }[];
};
type FormErrors = Partial<Record<"name" | "phone" | "address" | "branchId" | "items" | "customer", string>>;
const branchStorageKey = "mazetto.customer.branchId";
const checkoutAttemptKey = "mazetto.customer.checkoutAttemptId";
const checkoutAttemptPayloadKey = "mazetto.customer.checkoutAttemptPayload";

const paymentOptions: { value: PaymentMethod; label: string; hint: string }[] = [
  { value: "CASH", label: "Naqd", hint: "Kuryerga yoki kassada" },
];

export default function CheckoutPage() {
  return (
    <SiteShell>
      <CheckoutFlow />
    </SiteShell>
  );
}

function CheckoutFlow() {
  const router = useRouter();
  const { clearCart, customer, items, refreshCustomer, showToast, subtotal } = useCart();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState("");
  const [name, setName] = useState(customer?.name ?? "");
  const [phone, setPhone] = useState(customer?.phone ?? "");
  const [address, setAddress] = useState("");
  const [comment, setComment] = useState("");
  const [type, setType] = useState<OrderType>("DELIVERY");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [quote, setQuote] = useState<CheckoutQuote | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [loadingQuote, setLoadingQuote] = useState(false);
  const [loadingBranches, setLoadingBranches] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const deliveryFee = quote ? Number(quote.deliveryFee) : 0;
  const total = quote ? Number(quote.total) : subtotal;
  const estimatedTime = useMemo(() => `${Math.min(35, 15 + items.length * 5)}-${Math.min(45, 25 + items.length * 5)} daqiqa`, [items.length]);
  const selectedBranch = branches.find((branch) => branch.id === branchId);
  const availablePaymentOptions = useMemo(() => {
    const allowedCodes = new Set((quote?.paymentMethods ?? []).map((method) => method.code));
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
        modifiers: item.modifiers.map((modifier) => ({ modifierId: modifier.modifierId, quantity: 1 })),
      })),
    [items],
  );

  const loadBranches = useCallback(async () => {
    setLoadingBranches(true);
    try {
      const nextBranches = await apiFetch<Branch[]>("/customer/branches");
      const storedBranchId = window.localStorage.getItem(branchStorageKey);
      const nextBranchId =
        nextBranches.find((branch) => branch.id === storedBranchId && canUseBranchForType(branch, type))?.id ??
        nextBranches.find((branch) => canUseBranchForType(branch, type))?.id ??
        nextBranches[0]?.id ??
        "";
      setBranches(nextBranches);
      setBranchId((current) => current || nextBranchId);
      if (nextBranchId) {
        window.localStorage.setItem(branchStorageKey, nextBranchId);
      }
    } finally {
      setLoadingBranches(false);
    }
  }, [type]);

  useEffect(() => {
    void loadBranches();
  }, [loadBranches]);

  useEffect(() => {
    if (customer) {
      setName(customer.name);
      setPhone(customer.phone);
    }
  }, [customer]);

  const loadQuote = useCallback(async () => {
    if (!customer?.accessToken || !branchId || !items.length) {
      setQuote(null);
      setQuoteError(null);
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
        nextQuote = await apiFetch<CheckoutQuote>("/customer/checkout/quote", request);
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

      setQuote(nextQuote);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Narxni hisoblab bo'lmadi";
      setQuote(null);
      setQuoteError(message);
    } finally {
      setLoadingQuote(false);
    }
  }, [branchId, customer?.accessToken, items.length, orderItemsPayload, refreshCustomer, type]);

  useEffect(() => {
    void loadQuote();
  }, [loadQuote]);

  function validate() {
    const nextErrors: FormErrors = {};

    if (!customer?.accessToken) {
      nextErrors.customer = "Buyurtma berish uchun telefon raqamingizni tasdiqlang.";
    }

    if (!items.length) {
      nextErrors.items = "Savatingiz bo'sh.";
    }

    if (!branchId) {
      nextErrors.branchId = "Filialni tanlang.";
    }

    if (branchId && !selectedBranch) {
      nextErrors.branchId = "Tanlangan filial topilmadi. Qaytadan tanlang.";
    }

    if (selectedBranch && !selectedBranch.acceptsOrders) {
      nextErrors.branchId = "Bu filial hozir buyurtma qabul qilmayapti.";
    }

    if (selectedBranch && type === "DELIVERY" && !selectedBranch.deliveryEnabled) {
      nextErrors.branchId = "Bu filialda yetkazib berish mavjud emas.";
    }

    if (selectedBranch && type === "PICKUP" && !selectedBranch.pickupEnabled) {
      nextErrors.branchId = "Bu filialdan olib ketish mavjud emas.";
    }

    if (!name.trim()) {
      nextErrors.name = "Ismingizni kiriting.";
    }

    if (!phone.trim() || phone.trim().replace(/[^\d+]/g, "").length < 7) {
      nextErrors.phone = "Telefon raqamni to'g'ri kiriting.";
    }

    if (type === "DELIVERY" && !address.trim()) {
      nextErrors.address = "Yetkazib berish manzilini kiriting.";
    }

    setErrors(nextErrors);
    return !Object.keys(nextErrors).length;
  }

  function selectBranch(nextBranchId: string) {
    setBranchId(nextBranchId);
    window.localStorage.setItem(branchStorageKey, nextBranchId);
  }

  function selectType(nextType: OrderType) {
    setType(nextType);
    const firstAllowed = branches.find((branch) => canUseBranchForType(branch, nextType));
    if (branchId && selectedBranch && canUseBranchForType(selectedBranch, nextType)) {
      return;
    }

    if (firstAllowed) {
      selectBranch(firstAllowed.id);
    }
  }

  async function submitOrder() {
    if (!validate() || !customer?.accessToken) {
      showToast("Ma'lumotlarni tekshirib chiqing");
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    try {
      const orderPayload = {
        branchId,
        name: name.trim(),
        phone: phone.trim(),
        type,
        address: type === "DELIVERY" ? address.trim() : undefined,
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
      const message = error instanceof Error ? error.message : "Buyurtmani yuborib bo'lmadi";
      setSubmitError(message);
      showToast(message);
    } finally {
      setSubmitting(false);
    }
  }

  if (!customer?.accessToken) {
    return (
      <section className="mx-auto max-w-3xl px-4 py-10">
        <div className="mf-checkout-card p-8">
          <p className="text-sm font-black uppercase text-[#0B7F75]">Rasmiylashtirish</p>
          <CustomerAuthPanel
            description="Buyurtmani yakunlash uchun telefon raqamingizni shu yerda tasdiqlang. Tasdiqlangandan keyin checkout sahifasi saqlanib qoladi."
            title="Telefonni tasdiqlang"
          />
        </div>
      </section>
    );
  }

  return (
    <MotionDiv {...pageMotion} className="mx-auto grid w-full max-w-6xl gap-6 px-4 pb-[calc(11rem+env(safe-area-inset-bottom))] pt-6 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,390px)] lg:pb-8">
      <div className="grid min-w-0 gap-4">
        <div className="mf-checkout-card p-5">
          <p className="text-sm font-black uppercase text-[#0B7F75]">Rasmiylashtirish</p>
          <h1 className="mt-1 text-3xl font-black text-[#17314A]">Buyurtmani yakunlash</h1>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <StepBadge number="1" label="Filial" active />
            <StepBadge number="2" label="Manzil" active={type === "DELIVERY"} />
            <StepBadge number="3" label="To'lov" active />
          </div>

          <div className="mt-5 grid gap-3">
            <FieldError message={errors.customer} />
            <label className="grid gap-2 text-sm font-black text-[#17314A]/76">
              Ism va familiya
              <motion.input className={inputClass(Boolean(errors.name))} placeholder="Masalan: Javohir Aliyev" value={name} onChange={(event) => setName(event.target.value)} whileFocus={{ scale: 1.01 }} transition={{ type: "spring", stiffness: 420, damping: 30 }} />
              <FieldError message={errors.name} />
            </label>
            <label className="grid gap-2 text-sm font-black text-[#17314A]/76">
              Telefon raqam
              <motion.input className={inputClass(Boolean(errors.phone))} placeholder="+998 90 123 45 67" value={phone} onChange={(event) => setPhone(event.target.value)} whileFocus={{ scale: 1.01 }} transition={{ type: "spring", stiffness: 420, damping: 30 }} />
              <FieldError message={errors.phone} />
            </label>
            <label className="grid gap-2 text-sm font-black text-[#17314A]/76">
              Filial
              {loadingBranches ? (
                <div className="skeleton h-12 rounded-2xl" />
              ) : (
                <BranchPicker branches={branches} onChange={selectBranch} orderType={type} value={branchId} />
              )}
              <FieldError message={errors.branchId} />
              {selectedBranch?.address ? <p className="text-xs font-bold text-[#17314A]/56">{selectedBranch.address}{branchLabelSuffix(selectedBranch, type)}</p> : null}
            </label>

            <div className="grid min-w-0 grid-cols-2 gap-2">
              <button className={choiceClass(type === "DELIVERY")} onClick={() => selectType("DELIVERY")} type="button">Yetkazib berish</button>
              <button className={choiceClass(type === "PICKUP")} onClick={() => selectType("PICKUP")} type="button">Olib ketish</button>
            </div>

            {type === "DELIVERY" ? (
              <label className="grid gap-2 text-sm font-black text-[#17314A]/76">
                Yetkazib berish manzili
                <motion.textarea className={`${inputClass(Boolean(errors.address))} min-h-28`} placeholder="Ko'cha, uy, mo'ljal" value={address} onChange={(event) => setAddress(event.target.value)} whileFocus={{ scale: 1.01 }} transition={{ type: "spring", stiffness: 420, damping: 30 }} />
                <FieldError message={errors.address} />
              </label>
            ) : null}

            <label className="grid gap-2 text-sm font-black text-[#17314A]/76">
              Buyurtma izohi
              <motion.textarea className={`${inputClass(false)} min-h-24`} placeholder="Masalan: piyozsiz, qo'ng'iroq qilmang" value={comment} onChange={(event) => setComment(event.target.value)} whileFocus={{ scale: 1.01 }} transition={{ type: "spring", stiffness: 420, damping: 30 }} />
            </label>
          </div>
        </div>

        <MotionDiv {...sectionMotion} className="mf-checkout-card p-5">
          <h2 className="text-2xl font-black text-[#17314A]">To'lov turi</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {availablePaymentOptions.map((option) => (
              <motion.button className={`pressable ripple mf-payment-option rounded-2xl px-4 py-4 text-left ${paymentMethod === option.value ? "is-active" : ""}`} key={option.value} layout onClick={() => { hapticTap(8); setPaymentMethod(option.value); }} type="button" whileTap={{ scale: 0.97 }}>
                <span className="block font-black text-[#17314A]">{option.label}</span>
                <span className="mt-1 block text-xs font-bold text-[#17314A]/58">{option.hint}</span>
              </motion.button>
            ))}
          </div>
          <p className="mt-3 text-xs font-bold text-[#17314A]/58">
            Click va Payme real integratsiyasi yoqilgandan keyin ko'rsatiladi.
          </p>
        </MotionDiv>
      </div>

      <aside className="mf-checkout-card min-w-0 h-fit p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-black uppercase text-[#0B7F75]">Buyurtma</p>
            <h2 className="mt-1 text-2xl font-black text-[#17314A]">Xulosa</h2>
          </div>
          <span className="rounded-full bg-[#0B7F75]/10 px-3 py-2 text-xs font-black text-[#0B7F75]">{estimatedTime}</span>
        </div>

        <div className="mt-4 grid gap-3">
          {items.length ? items.map((item) => (
            <div className="mf-cart-row grid min-w-0 grid-cols-[58px_minmax(0,1fr)] gap-3 p-2" key={item.key}>
              <MediaImage
                alt={item.productName}
                aspectClassName="h-14 w-14"
                className="rounded-xl"
                sizes="56px"
                src={item.imageUrl}
              />
              <div className="min-w-0">
                <p className="truncate font-black text-[#17314A]">{item.quantity}x {localizeMenuName(item.productName)}</p>
                <p className="text-xs font-semibold text-[#17314A]/56">{localizeMenuName(item.variantName) || "Oddiy"}</p>
              </div>
            </div>
          )) : <FieldError message={errors.items ?? "Savat bo'sh."} />}
        </div>

        <div className="mf-card-soft mt-5 grid gap-3 p-4">
          <div className="flex min-w-0 justify-between gap-3 text-sm font-bold text-[#17314A]/62">
            <span>Mahsulotlar</span>
            <span className="min-w-0 break-words text-right"><AnimatedMoney value={quote ? Number(quote.subtotal) : subtotal} /></span>
          </div>
          <div className="flex min-w-0 justify-between gap-3 text-sm font-bold text-[#17314A]/62">
            <span>Yetkazib berish</span>
            <span className="min-w-0 break-words text-right">{loadingQuote ? "Hisoblanmoqda..." : deliveryFee ? <AnimatedMoney value={deliveryFee} /> : "Bepul"}</span>
          </div>
          <div className="h-px bg-[#0B7F75]/12" />
          <div className="flex min-w-0 justify-between gap-3 text-lg font-black text-[#17314A]">
            <span>Jami</span>
            <span className="min-w-0 break-words text-right"><AnimatedMoney value={total} /></span>
          </div>
        </div>

        {submitError ? <p className="mt-4 rounded-2xl bg-red-500/12 px-4 py-3 text-sm font-bold text-red-300">{submitError}</p> : null}
        {quoteError ? <p className="mt-4 rounded-2xl bg-red-500/12 px-4 py-3 text-sm font-bold text-red-300">{quoteError}</p> : null}

        <button className="pressable ripple mf-button-primary mt-4 w-full px-5 py-4 font-black disabled:opacity-50" disabled={submitting || loadingBranches || loadingQuote || Boolean(quoteError)} onClick={() => void submitOrder()} type="button">
          {submitting ? "Yuborilmoqda..." : "Buyurtmani tasdiqlash"}
        </button>
      </aside>

      <div className="mf-mobile-action-bar mazetto-glass fixed inset-x-3 z-30 rounded-[1.5rem] p-3 lg:hidden">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase text-white/50">Jami</p>
            <p className="text-lg font-black text-white"><AnimatedMoney value={total} /></p>
          </div>
          <button className="pressable ripple mf-button-primary rounded-2xl px-5 py-4 font-black disabled:opacity-50" disabled={submitting || loadingBranches || loadingQuote || Boolean(quoteError)} onClick={() => void submitOrder()} type="button">
            {submitting ? "Yuborilmoqda..." : "Tasdiqlash"}
          </button>
        </div>
      </div>
    </MotionDiv>
  );
}

function inputClass(error: boolean): string {
  return `mf-input px-4 py-3 font-semibold ${error ? "border-red-400 bg-red-500/10" : ""}`;
}

function choiceClass(active: boolean): string {
  return `pressable ripple rounded-2xl px-4 py-3 text-sm font-bold ${active ? "mf-button-primary" : "mf-button-secondary"}`;
}

function FieldError({ message }: { message: string | undefined }) {
  return message ? <p className="text-xs font-bold text-red-600">{message}</p> : null;
}

function StepBadge({ active, label, number }: { active: boolean; label: string; number: string }) {
  return (
    <div className={`mf-checkout-step ${active ? "is-active" : ""}`}>
      <span>{number}</span>
      <p>{label}</p>
    </div>
  );
}

function canUseBranchForType(branch: Branch, type: OrderType): boolean {
  if (branch.acceptsOrders === false) {
    return false;
  }

  return type === "DELIVERY" ? branch.deliveryEnabled !== false : branch.pickupEnabled !== false;
}

function branchLabelSuffix(branch: Branch, type: OrderType): string {
  if (!branch.acceptsOrders) {
    return " - hozir yopiq";
  }

  if (type === "DELIVERY" && !branch.deliveryEnabled) {
    return " - yetkazish yo'q";
  }

  if (type === "PICKUP" && !branch.pickupEnabled) {
    return " - olib ketish yo'q";
  }

  return "";
}

function getCheckoutAttemptId(payloadSignature: string): string {
  const storedSignature = window.localStorage.getItem(checkoutAttemptPayloadKey);
  const storedAttemptId = window.localStorage.getItem(checkoutAttemptKey);

  if (storedAttemptId && storedSignature === payloadSignature) {
    return storedAttemptId;
  }

  const nextAttemptId = createClientId();
  window.localStorage.setItem(checkoutAttemptKey, nextAttemptId);
  window.localStorage.setItem(checkoutAttemptPayloadKey, payloadSignature);
  return nextAttemptId;
}

function clearCheckoutAttempt() {
  window.localStorage.removeItem(checkoutAttemptKey);
  window.localStorage.removeItem(checkoutAttemptPayloadKey);
}

function isCustomerSessionError(error: unknown): boolean {
  return error instanceof Error && error.message.includes("Sessiya muddati tugagan");
}

function createClientId(): string {
  if (typeof window.crypto?.randomUUID === "function") {
    return window.crypto.randomUUID();
  }

  return `checkout-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
