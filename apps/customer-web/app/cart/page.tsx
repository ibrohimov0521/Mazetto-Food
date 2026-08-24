"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { SiteShell } from "../../components/site-shell";
import { apiFetch } from "../../lib/api";
import { formatMoney, productImage, useCart } from "../../lib/cart";

type Branch = { id: string; name: string; address?: string | null };
type OrderResult = { customerOrder: { id: string }; order: { orderNumber: string } | null };
type OrderType = "DELIVERY" | "PICKUP";
type PaymentMethod = "CASH" | "CLICK" | "PAYME" | "CARD";

export default function CartPage() {
  return (
    <SiteShell>
      <Checkout />
    </SiteShell>
  );
}

function Checkout() {
  const { customer, items, updateQuantity, removeItem, clearCart, subtotal } = useCart();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState("");
  const [name, setName] = useState(customer?.name ?? "");
  const [phone, setPhone] = useState(customer?.phone ?? "");
  const [address, setAddress] = useState("");
  const [type, setType] = useState<OrderType>("DELIVERY");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [message, setMessage] = useState<string | null>(null);
  const deliveryFee = type === "DELIVERY" && subtotal > 0 ? 12000 : 0;
  const total = subtotal + deliveryFee;

  const loadBranches = useCallback(async () => {
    const nextBranches = await apiFetch<Branch[]>("/customer/branches");
    setBranches(nextBranches);
    setBranchId((current) => current || nextBranches[0]?.id || "");
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

  async function submitOrder() {
    if (!customer?.accessToken) {
      setMessage("Please verify your phone from the home page before checkout.");
      return;
    }

    const result = await apiFetch<OrderResult>("/customer/orders", {
      method: "POST",
      accessToken: customer.accessToken,
      body: JSON.stringify({
        branchId,
        name,
        phone,
        type,
        address: type === "DELIVERY" ? address : undefined,
        paymentMethod,
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
    setMessage(`Order ${result.order?.orderNumber ?? result.customerOrder.id} sent to kitchen.`);
  }

  return (
    <section className="mx-auto grid max-w-6xl gap-6 px-4 pb-28 pt-6 lg:grid-cols-[1fr_420px] lg:pb-6">
      <div className="grid gap-4">
        <div className="rounded-xl bg-white p-5 shadow-[0_16px_55px_rgba(15,118,110,0.12)]">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-sm font-black uppercase text-emerald-700">Checkout</p>
              <h1 className="mt-1 text-3xl font-black text-neutral-950">Your cart</h1>
            </div>
            <span className="rounded-xl bg-emerald-50 px-4 py-2 text-sm font-black text-emerald-700">{items.length} items</span>
          </div>
          {items.length ? (
            <div className="mt-5 grid gap-3">
              {items.map((item) => (
                <div className="grid grid-cols-[86px_1fr] gap-3 rounded-xl border border-neutral-100 p-3 shadow-[0_10px_30px_rgba(17,24,39,0.04)]" key={item.key}>
                  <img alt={item.productName} className="h-24 w-24 rounded-2xl object-cover" src={productImage(item.imageUrl)} />
                  <div>
                    <div className="flex justify-between gap-3">
                      <div>
                        <h2 className="font-bold text-neutral-950">{item.productName}</h2>
                        <p className="text-sm text-neutral-500">{item.variantName ?? "Regular"}</p>
                      </div>
                      <button className="text-sm font-bold text-red-600" onClick={() => removeItem(item.key)} type="button">Remove</button>
                    </div>
                    {item.modifiers.length ? <p className="mt-1 text-sm font-semibold text-emerald-700">{item.modifiers.map((modifier) => modifier.name).join(", ")}</p> : null}
                    {item.notes ? <p className="mt-1 text-xs font-semibold text-neutral-500">Note: {item.notes}</p> : null}
                    <div className="mt-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <button className="h-9 w-9 rounded-full bg-neutral-100 font-bold" onClick={() => updateQuantity(item.key, item.quantity - 1)} type="button">-</button>
                        <span className="w-8 text-center font-bold">{item.quantity}</span>
                        <button className="h-9 w-9 rounded-full bg-neutral-100 font-bold" onClick={() => updateQuantity(item.key, item.quantity + 1)} type="button">+</button>
                      </div>
                      <span className="font-black text-emerald-700">{formatMoney((Number(item.unitPrice) + item.modifiers.reduce((sum, modifier) => sum + Number(modifier.price), 0)) * item.quantity)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-5 rounded-xl bg-emerald-50 p-8 text-center">
              <p className="font-bold text-emerald-800">Your cart is empty.</p>
              <Link className="mt-4 inline-flex rounded-2xl bg-emerald-600 px-5 py-3 font-bold text-white" href="/menu">Open menu</Link>
            </div>
          )}
        </div>
      </div>

      <aside className="h-fit rounded-xl bg-white p-5 shadow-[0_16px_55px_rgba(15,118,110,0.12)]">
        <h2 className="text-2xl font-black text-neutral-950">Checkout</h2>
        <div className="mt-4 grid gap-3">
          <input className="rounded-2xl border border-neutral-200 px-4 py-3 outline-none focus:border-emerald-500" placeholder="Name" value={name} onChange={(event) => setName(event.target.value)} />
          <input className="rounded-2xl border border-neutral-200 px-4 py-3 outline-none focus:border-emerald-500" placeholder="Phone" value={phone} onChange={(event) => setPhone(event.target.value)} />
          <select className="rounded-2xl border border-neutral-200 px-4 py-3 font-semibold outline-none focus:border-emerald-500" value={branchId} onChange={(event) => setBranchId(event.target.value)}>
            {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <button className={choiceClass(type === "DELIVERY")} onClick={() => setType("DELIVERY")} type="button">Delivery</button>
            <button className={choiceClass(type === "PICKUP")} onClick={() => setType("PICKUP")} type="button">Pickup</button>
          </div>
          {type === "DELIVERY" ? (
            <textarea className="min-h-24 rounded-2xl border border-neutral-200 px-4 py-3 outline-none focus:border-emerald-500" placeholder="Delivery address" value={address} onChange={(event) => setAddress(event.target.value)} />
          ) : null}
          <select className="rounded-2xl border border-neutral-200 px-4 py-3 font-semibold outline-none focus:border-emerald-500" value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)}>
            <option value="CASH">Cash</option>
            <option value="CLICK">Click</option>
            <option value="PAYME">Payme</option>
            <option value="CARD">Card</option>
          </select>
        </div>
        <div className="mt-5 grid gap-3 rounded-xl bg-emerald-50 p-4">
          <div className="flex justify-between text-sm font-bold text-neutral-600">
            <span>Subtotal</span>
            <span>{formatMoney(subtotal)}</span>
          </div>
          <div className="flex justify-between text-sm font-bold text-neutral-600">
            <span>Delivery fee</span>
            <span>{deliveryFee ? formatMoney(deliveryFee) : "Free"}</span>
          </div>
          <div className="h-px bg-emerald-100" />
          <div className="flex justify-between text-lg font-black text-neutral-950">
            <span>Total</span>
            <span>{formatMoney(total)}</span>
          </div>
        </div>
        <button className="mt-4 w-full rounded-2xl bg-emerald-600 px-5 py-4 font-black text-white disabled:opacity-50" disabled={!items.length || !branchId || !customer?.accessToken || !name || !phone || (type === "DELIVERY" && !address)} onClick={() => void submitOrder()} type="button">
          Send order
        </button>
        {message ? <p className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">{message}</p> : null}
      </aside>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-emerald-100 bg-white/95 p-3 shadow-[0_-12px_30px_rgba(17,24,39,0.10)] backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase text-neutral-500">Total</p>
            <p className="text-lg font-black text-neutral-950">{formatMoney(total)}</p>
          </div>
          <button className="rounded-xl bg-[#16A34A] px-5 py-4 font-black text-white disabled:opacity-50" disabled={!items.length || !branchId || !customer?.accessToken || !name || !phone || (type === "DELIVERY" && !address)} onClick={() => void submitOrder()} type="button">
            Checkout
          </button>
        </div>
      </div>
    </section>
  );
}

function choiceClass(active: boolean): string {
  return `rounded-xl px-4 py-3 text-sm font-bold ${active ? "bg-[#16A34A] text-white" : "bg-emerald-50 text-emerald-800"}`;
}
