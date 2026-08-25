"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { AnimatedMoney, MotionDiv, hapticTap, pageMotion, sectionMotion } from "../../components/motion-primitives";
import { SiteShell } from "../../components/site-shell";
import { apiFetch } from "../../lib/api";
import { productImage, useCart } from "../../lib/cart";

type Branch = { id: string; name: string; address?: string | null };
type OrderResult = { customerOrder: { id: string }; order: { orderNumber: string; id?: string } | null };
type OrderType = "DELIVERY" | "PICKUP";
type PaymentMethod = "CASH" | "CLICK" | "PAYME" | "CARD";
type FormErrors = Partial<Record<"name" | "phone" | "address" | "branchId" | "items" | "customer", string>>;

const paymentOptions: { value: PaymentMethod; label: string; hint: string }[] = [
  { value: "CASH", label: "Naqd", hint: "Kuryerga yoki kassada" },
  { value: "CLICK", label: "Click", hint: "Masofadan to'lov" },
  { value: "PAYME", label: "Payme", hint: "Masofadan to'lov" },
  { value: "CARD", label: "Karta", hint: "Terminal orqali" },
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
  const { clearCart, customer, items, showToast, subtotal } = useCart();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState("");
  const [name, setName] = useState(customer?.name ?? "");
  const [phone, setPhone] = useState(customer?.phone ?? "");
  const [address, setAddress] = useState("");
  const [comment, setComment] = useState("");
  const [type, setType] = useState<OrderType>("DELIVERY");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [errors, setErrors] = useState<FormErrors>({});
  const [loadingBranches, setLoadingBranches] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const deliveryFee = type === "DELIVERY" && subtotal > 0 ? 12000 : 0;
  const total = subtotal + deliveryFee;
  const estimatedTime = useMemo(() => `${Math.min(35, 15 + items.length * 5)}-${Math.min(45, 25 + items.length * 5)} daqiqa`, [items.length]);

  const loadBranches = useCallback(async () => {
    setLoadingBranches(true);
    try {
      const nextBranches = await apiFetch<Branch[]>("/customer/branches");
      setBranches(nextBranches);
      setBranchId((current) => current || nextBranches[0]?.id || "");
    } finally {
      setLoadingBranches(false);
    }
  }, []);

  useEffect(() => {
    void loadBranches();
  }, [loadBranches]);

  useEffect(() => {
    if (customer) {
      setName(customer.name);
      setPhone(customer.phone);
    }
  }, [customer]);

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

  async function submitOrder() {
    if (!validate() || !customer?.accessToken) {
      showToast("Ma'lumotlarni tekshirib chiqing");
      return;
    }

    setSubmitting(true);
    try {
      const result = await apiFetch<OrderResult>("/customer/orders", {
        method: "POST",
        accessToken: customer.accessToken,
        body: JSON.stringify({
          branchId,
          name: name.trim(),
          phone: phone.trim(),
          type,
          address: type === "DELIVERY" ? address.trim() : undefined,
          paymentMethod,
          notes: comment.trim() || undefined,
          items: items.map((item) => ({
            productId: item.productId,
            variantId: item.variantId,
            quantity: item.quantity,
            notes: item.notes,
            modifiers: item.modifiers.map((modifier) => ({ modifierId: modifier.modifierId, quantity: 1 })),
          })),
        }),
      });
      clearCart();
      hapticTap([18, 36, 18]);
      showToast("Buyurtma muvaffaqiyatli yuborildi");
      router.push(`/order-success/${result.customerOrder.id}`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Buyurtmani yuborib bo'lmadi");
    } finally {
      setSubmitting(false);
    }
  }

  if (!customer?.accessToken) {
    return (
      <section className="mx-auto max-w-3xl px-4 py-10 text-center">
        <div className="mf-card p-8">
          <p className="text-sm font-black uppercase text-[#67E8F9]">Rasmiylashtirish</p>
          <h1 className="mt-2 text-3xl font-black text-white">Telefonni tasdiqlang</h1>
          <p className="mt-3 text-white/60">Buyurtmani rasmiylashtirish uchun avval telefon raqamingizni tasdiqlang.</p>
          <Link className="pressable ripple mf-button-primary mt-5 inline-flex px-5 py-3 font-bold" href="/">
            Telefonni tasdiqlash
          </Link>
        </div>
      </section>
    );
  }

  return (
    <MotionDiv {...pageMotion} className="mx-auto grid max-w-6xl gap-6 px-4 pb-28 pt-6 lg:grid-cols-[1fr_390px] lg:pb-8">
      <div className="grid gap-5">
        <div className="mf-card p-5">
          <p className="text-sm font-black uppercase text-[#67E8F9]">Rasmiylashtirish</p>
          <h1 className="mt-1 text-3xl font-black text-white">Yetkazish ma'lumotlari</h1>

          <div className="mt-5 grid gap-3">
            <FieldError message={errors.customer} />
            <label className="grid gap-2 text-sm font-black text-white/76">
              Ism va familiya
              <motion.input className={inputClass(Boolean(errors.name))} placeholder="Masalan: Javohir Aliyev" value={name} onChange={(event) => setName(event.target.value)} whileFocus={{ scale: 1.01 }} transition={{ type: "spring", stiffness: 420, damping: 30 }} />
              <FieldError message={errors.name} />
            </label>
            <label className="grid gap-2 text-sm font-black text-white/76">
              Telefon raqam
              <motion.input className={inputClass(Boolean(errors.phone))} placeholder="+998 90 123 45 67" value={phone} onChange={(event) => setPhone(event.target.value)} whileFocus={{ scale: 1.01 }} transition={{ type: "spring", stiffness: 420, damping: 30 }} />
              <FieldError message={errors.phone} />
            </label>
            <label className="grid gap-2 text-sm font-black text-white/76">
              Filial
              {loadingBranches ? (
                <div className="skeleton h-12 rounded-2xl" />
              ) : (
                <motion.select className={inputClass(Boolean(errors.branchId))} value={branchId} onChange={(event) => setBranchId(event.target.value)} whileFocus={{ scale: 1.01 }} transition={{ type: "spring", stiffness: 420, damping: 30 }}>
                  {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
                </motion.select>
              )}
              <FieldError message={errors.branchId} />
            </label>

            <div className="grid grid-cols-2 gap-2">
              <button className={choiceClass(type === "DELIVERY")} onClick={() => setType("DELIVERY")} type="button">Yetkazib berish</button>
              <button className={choiceClass(type === "PICKUP")} onClick={() => setType("PICKUP")} type="button">Olib ketish</button>
            </div>

            {type === "DELIVERY" ? (
              <label className="grid gap-2 text-sm font-black text-white/76">
                Yetkazib berish manzili
                <motion.textarea className={`${inputClass(Boolean(errors.address))} min-h-28`} placeholder="Ko'cha, uy, mo'ljal" value={address} onChange={(event) => setAddress(event.target.value)} whileFocus={{ scale: 1.01 }} transition={{ type: "spring", stiffness: 420, damping: 30 }} />
                <FieldError message={errors.address} />
              </label>
            ) : null}

            <label className="grid gap-2 text-sm font-black text-white/76">
              Buyurtma izohi
              <motion.textarea className={`${inputClass(false)} min-h-24`} placeholder="Masalan: piyozsiz, qo'ng'iroq qilmang" value={comment} onChange={(event) => setComment(event.target.value)} whileFocus={{ scale: 1.01 }} transition={{ type: "spring", stiffness: 420, damping: 30 }} />
            </label>
          </div>
        </div>

        <MotionDiv {...sectionMotion} className="mf-card p-5">
          <h2 className="text-2xl font-black text-white">To'lov turi</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {paymentOptions.map((option) => (
              <motion.button className={`pressable ripple rounded-2xl border px-4 py-4 text-left ${paymentMethod === option.value ? "border-[#22C55E]/70 bg-[#22C55E]/16 shadow-[0_12px_28px_rgba(34,197,94,0.18)]" : "border-white/10 bg-white/6 hover:border-[#22C55E]/36"}`} key={option.value} layout onClick={() => { hapticTap(8); setPaymentMethod(option.value); }} type="button" whileTap={{ scale: 0.97 }}>
                <span className="block font-black text-white">{option.label}</span>
                <span className="mt-1 block text-xs font-bold text-white/52">{option.hint}</span>
              </motion.button>
            ))}
          </div>
        </MotionDiv>
      </div>

      <aside className="mf-card h-fit p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-black uppercase text-[#67E8F9]">Buyurtma</p>
            <h2 className="mt-1 text-2xl font-black text-white">Xulosa</h2>
          </div>
          <span className="rounded-full bg-[#22C55E]/16 px-3 py-2 text-xs font-black text-[#67E8F9]">{estimatedTime}</span>
        </div>

        <div className="mt-4 grid gap-3">
          {items.length ? items.map((item) => (
            <div className="mf-card-soft grid grid-cols-[58px_1fr] gap-3 p-2" key={item.key}>
              <img alt={item.productName} className="h-14 w-14 rounded-xl object-cover" src={productImage(item.imageUrl)} />
              <div>
                <p className="font-black text-white">{item.quantity}x {item.productName}</p>
                <p className="text-xs font-semibold text-white/52">{item.variantName ?? "Oddiy"}</p>
              </div>
            </div>
          )) : <FieldError message={errors.items ?? "Savat bo'sh."} />}
        </div>

        <div className="mf-card-soft mt-5 grid gap-3 p-4">
          <div className="flex justify-between text-sm font-bold text-white/60">
            <span>Mahsulotlar</span>
            <span><AnimatedMoney value={subtotal} /></span>
          </div>
          <div className="flex justify-between text-sm font-bold text-white/60">
            <span>Yetkazib berish</span>
            <span>{deliveryFee ? <AnimatedMoney value={deliveryFee} /> : "Bepul"}</span>
          </div>
          <div className="h-px bg-white/10" />
          <div className="flex justify-between text-lg font-black text-white">
            <span>Jami</span>
            <span><AnimatedMoney value={total} /></span>
          </div>
        </div>

        <button className="pressable ripple mf-button-primary mt-4 w-full px-5 py-4 font-black disabled:opacity-50" disabled={submitting || loadingBranches} onClick={() => void submitOrder()} type="button">
          {submitting ? "Yuborilmoqda..." : "Buyurtmani tasdiqlash"}
        </button>
      </aside>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-white/10 bg-[#0B0B0B]/92 p-3 shadow-[0_-12px_30px_rgba(0,0,0,0.35)] backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase text-white/50">Jami</p>
            <p className="text-lg font-black text-white"><AnimatedMoney value={total} /></p>
          </div>
          <button className="pressable ripple mf-button-primary rounded-2xl px-5 py-4 font-black disabled:opacity-50" disabled={submitting || loadingBranches} onClick={() => void submitOrder()} type="button">
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
  return `pressable ripple rounded-2xl px-4 py-3 text-sm font-bold ${active ? "mf-button-primary" : "bg-white/10 text-white/76"}`;
}

function FieldError({ message }: { message: string | undefined }) {
  return message ? <p className="text-xs font-bold text-red-600">{message}</p> : null;
}
