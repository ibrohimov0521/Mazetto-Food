"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PermissionGuard } from "../../components/auth/permission-guard";
import { RoleGuard } from "../../components/auth/role-guard";
import { useAuth } from "../../components/auth/auth-provider";
import { apiFetch } from "../../lib/api";
import { handleProductImageError, productImage } from "../../lib/media";

type Variant = { id: string; name: string; sellingPrice: string; isDefault: boolean };
type Modifier = { isRequired: boolean; modifier: { id: string; name: string; price: string } };
type Product = {
  id: string;
  categoryId: string;
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  sellingPrice: string;
  preparationTime?: number | null;
  isCombo: boolean;
  variants: Variant[];
  modifiers: Modifier[];
  bundleItems?: { componentName: string; quantity: string; unitLabel?: string | null }[];
};
type Category = { id: string; name: string };
type Catalog = { branchId: string; categories: Category[]; products: Product[] };
type CartLine = {
  key: string;
  product: Product;
  variant?: Variant;
  modifiers: Modifier[];
  quantity: number;
};
type PosOrderResult = {
  order: { orderNumber: string; total: string; branch?: { name?: string | null } | null };
  payment: { cashReceived: string; change: string };
};
type CurrentShift = {
  id: string;
  shiftNumber?: number;
  status: "OPEN" | "CLOSED";
  openedAt?: string;
  branch?: { name?: string | null; address?: string | null } | null;
  employee?: { firstName?: string | null; lastName?: string | null } | null;
};

const formatter = new Intl.NumberFormat("uz-UZ");

function createCheckoutKey() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}

export default function PosPage() {
  return (
    <RoleGuard roles={["CASHIER", "SUPER_ADMIN", "BRANCH_MANAGER"]}>
      <PermissionGuard permission="POS_USE">
        <PosTerminal />
      </PermissionGuard>
    </RoleGuard>
  );
}

function PosTerminal() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [currentShift, setCurrentShift] = useState<CurrentShift | null>(null);
  const [isCheckingShift, setIsCheckingShift] = useState(true);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [categoryId, setCategoryId] = useState("ALL");
  const [query, setQuery] = useState("");
  const [cashReceived, setCashReceived] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [selectedModifierIds, setSelectedModifierIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checkoutKey, setCheckoutKey] = useState(createCheckoutKey);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<PosOrderResult | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadTerminal() {
      try {
        const currentShift = await apiFetch<CurrentShift | null>("/cash-register/shift");

        if (!isMounted) {
          return;
        }

        if (!currentShift || currentShift.status !== "OPEN") {
          setCurrentShift(null);
          router.replace("/shift");
          return;
        }

        setCurrentShift(currentShift);
        setCatalog(await apiFetch<Catalog>("/pos/catalog"));
      } catch (loadError) {
        if (isMounted) {
          if (isAuthenticationError(loadError)) {
            void logout();
            return;
          }

          setError(loadError instanceof Error ? loadError.message : "Katalog yuklanmadi");
        }
      } finally {
        if (isMounted) {
          setIsCheckingShift(false);
        }
      }
    }

    void loadTerminal();

    return () => {
      isMounted = false;
    };
  }, [logout, router]);

  const products = catalog?.products ?? [];
  const filteredProducts = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return products.filter((product) => {
      const matchesCategory = categoryId === "ALL" || product.categoryId === categoryId;
      const matchesSearch = !normalized || product.name.toLowerCase().includes(normalized);
      return matchesCategory && matchesSearch;
    });
  }, [categoryId, products, query]);
  const total = cart.reduce((sum, line) => sum + lineTotal(line), 0);
  const received = Number(cashReceived || 0);
  const change = Math.max(0, received - total);

  function addProduct(product: Product) {
    const hasChoices = product.variants.length > 1 || product.modifiers.length > 0;
    if (hasChoices) {
      setSelectedProduct(product);
      setSelectedVariantId(product.variants.find((variant) => variant.isDefault)?.id ?? product.variants[0]?.id ?? null);
      setSelectedModifierIds([]);
      return;
    }
    addLine(product);
  }

  function addLine(product: Product, variant?: Variant, modifiers: Modifier[] = []) {
    const key = [product.id, variant?.id ?? "base", ...modifiers.map((item) => item.modifier.id).sort()].join(":");
    setCart((current) => {
      const existing = current.find((line) => line.key === key);
      if (existing) {
        return current.map((line) => (line.key === key ? { ...line, quantity: line.quantity + 1 } : line));
      }
      return [...current, { key, product, ...(variant ? { variant } : {}), modifiers, quantity: 1 }];
    });
    setCheckoutKey(createCheckoutKey());
    setSuccess(null);
  }

  function changeQuantity(key: string, delta: number) {
    setCart((current) =>
      current
        .map((line) => (line.key === key ? { ...line, quantity: line.quantity + delta } : line))
        .filter((line) => line.quantity > 0),
    );
    setCheckoutKey(createCheckoutKey());
    setSuccess(null);
  }

  async function submitOrder() {
    setError(null);
    if (!cart.length) {
      setError("Savat bo'sh");
      return;
    }
    if (received < total) {
      setError("Qabul qilingan naqd pul jami summadan kam");
      return;
    }
    setIsSubmitting(true);
    try {
      const result = await apiFetch<PosOrderResult>("/pos/orders", {
        method: "POST",
        body: JSON.stringify({
          idempotencyKey: checkoutKey,
          cashReceived: received,
          items: cart.map((line) => ({
            productId: line.product.id,
            variantId: line.variant?.id,
            quantity: line.quantity,
            modifiers: line.modifiers.map((modifier) => ({ modifierId: modifier.modifier.id, quantity: 1 })),
          })),
        }),
      });
      setSuccess(result);
      setCart([]);
      setCashReceived("");
      setCheckoutKey(createCheckoutKey());
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Buyurtma yaratilmadi");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#062d2b] text-[#10233a] lg:h-screen lg:overflow-hidden">
      <div className="flex min-h-screen flex-col lg:h-screen">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-[#073f3b] px-4 py-3 text-white sm:px-5">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#ffd52e]">MAZETTO FOOD</p>
            <h1 className="text-2xl font-black">Kassa</h1>
          </div>
          <div className="flex min-w-0 flex-wrap items-center justify-end gap-2 text-sm font-bold sm:gap-3">
            <button
              className="flex min-h-11 items-center gap-2 rounded-full border border-[#ffd52e]/50 bg-[#ffd52e] px-4 py-2 text-left font-black text-[#10233a] shadow-[0_8px_22px_rgba(255,213,46,0.22)] transition hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(255,213,46,0.30)]"
              onClick={() => router.push("/shift")}
              type="button"
            >
              <span aria-hidden="true">●</span>
              <span className="grid leading-tight">
                <span>Smena ochiq</span>
                <span className="text-[11px] font-black text-[#00685f]">{currentShift?.openedAt ? `Boshlangan: ${formatTime(currentShift.openedAt)}` : "Smena sahifasi"}</span>
              </span>
            </button>
            <span className="max-w-[180px] truncate text-right text-white/85">{user?.email ?? user?.phone ?? "Xodim"}</span>
            <button className="rounded-full bg-white/10 px-4 py-2" onClick={() => void logout()} type="button">
              Chiqish
            </button>
          </div>
        </header>

        {isCheckingShift ? (
          <div className="grid flex-1 place-items-center p-6">
            <p className="rounded-3xl bg-[#fffaf0] px-6 py-4 text-base font-black text-[#10233a] shadow-2xl">
              Smena tekshirilmoqda...
            </p>
          </div>
        ) : (
        <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_390px] gap-4 p-4 max-md:grid-cols-1">
          <section className="min-h-0 min-w-0 overflow-hidden rounded-[28px] bg-[#fffaf0] p-4 shadow-2xl">
            <div className="flex flex-wrap items-center gap-3">
              <input
                className="min-h-12 flex-1 rounded-2xl border border-[#d8e5df] px-4 text-base font-bold outline-none focus:border-[#008678]"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Qidirish"
                value={query}
              />
              <span className="rounded-full bg-[#ffe86b] px-4 py-3 text-sm font-black">{products.length} ta mahsulot</span>
            </div>

            <div className="no-scrollbar mt-4 flex gap-2 overflow-x-auto pb-2">
              <button className={tabClass(categoryId === "ALL")} onClick={() => setCategoryId("ALL")} type="button">
                Barchasi
              </button>
              {catalog?.categories.map((category) => (
                <button className={tabClass(categoryId === category.id)} key={category.id} onClick={() => setCategoryId(category.id)} type="button">
                  {category.name}
                </button>
              ))}
            </div>

            <div className="mt-4 grid max-h-[calc(100vh-190px)] grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-3 overflow-y-auto pr-1">
              {filteredProducts.map((product) => (
                <button
                  className="group overflow-hidden rounded-[22px] border border-[#dce8df] bg-white text-left shadow-[0_10px_30px_rgba(0,0,0,0.08)] transition active:scale-[0.98]"
                  key={product.id}
                  onClick={() => addProduct(product)}
                  type="button"
                >
                  <div className="aspect-[4/3] bg-[#073f3b]">
                    <img
                      alt=""
                      className="h-full w-full object-cover"
                      loading="lazy"
                      onError={(event) => handleProductImageError(event.currentTarget)}
                      src={productImage(product.imageUrl)}
                    />
                  </div>
                  <div className="p-3">
                    <h2 className="line-clamp-2 min-h-10 text-base font-black">{product.name}</h2>
                    <p className="mt-1 text-sm font-black text-[#008678]">{money(basePrice(product))}</p>
                    <p className="mt-1 text-xs font-bold text-slate-500">{product.isCombo ? "Set" : `${product.preparationTime ?? 10} daq`}</p>
                  </div>
                </button>
              ))}
            </div>
          </section>

          <aside className="flex max-h-[calc(100vh-120px)] min-h-0 min-w-0 flex-col overflow-hidden rounded-[28px] bg-[#fffaf0] p-4 shadow-2xl max-md:max-h-[calc(100vh-140px)]">
            <div className="flex shrink-0 items-center justify-between">
              <h2 className="text-2xl font-black">Savat</h2>
              <span className="rounded-full bg-[#ffe86b] px-3 py-2 text-sm font-black">{cart.length} qator</span>
            </div>
            <div className="no-scrollbar mt-4 min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain pr-1">
              {cart.length ? cart.map((line) => (
                <div className="rounded-2xl bg-white p-3 shadow-sm" key={line.key}>
                  <div className="flex justify-between gap-2">
                    <div>
                      <p className="font-black">{line.product.name}</p>
                      <p className="text-xs font-bold text-slate-500">{line.variant?.name ?? "Standart"}</p>
                    </div>
                    <p className="font-black text-[#008678]">{money(lineTotal(line))}</p>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button className="h-9 w-9 rounded-full bg-[#eef7f1] font-black" onClick={() => changeQuantity(line.key, -1)} type="button">-</button>
                      <span className="w-8 text-center font-black">{line.quantity}</span>
                      <button className="h-9 w-9 rounded-full bg-[#ffe03a] font-black" onClick={() => changeQuantity(line.key, 1)} type="button">+</button>
                    </div>
                    <button className="text-sm font-bold text-red-500" onClick={() => changeQuantity(line.key, -999)} type="button">O'chirish</button>
                  </div>
                </div>
              )) : <div className="grid min-h-full place-items-center rounded-2xl bg-white p-6 text-center text-sm font-bold text-slate-500">Mahsulot tanlang.</div>}
            </div>
            <div className="mt-4 shrink-0 space-y-3 border-t border-[#d8e5df] pt-4">
              <div className="flex justify-between text-xl font-black"><span>Jami</span><span>{money(total)}</span></div>
              <input className="min-h-12 w-full rounded-2xl border border-[#d8e5df] px-4 text-lg font-black outline-none" inputMode="numeric" onChange={(event) => setCashReceived(event.target.value)} placeholder="Qabul qilingan naqd pul" value={cashReceived} />
              <div className="flex justify-between font-black text-[#008678]"><span>Qaytim</span><span>{money(change)}</span></div>
              {error ? <p className="rounded-2xl bg-red-50 p-3 text-sm font-bold text-red-600">{error}</p> : null}
              {success ? <p className="rounded-2xl bg-emerald-50 p-3 text-sm font-black text-emerald-700">Qabul qilindi: {success.order.orderNumber}</p> : null}
              <button className="min-h-14 w-full rounded-2xl bg-[#ffd52e] text-base font-black shadow-[0_12px_28px_rgba(255,213,46,0.35)] disabled:opacity-50" disabled={isSubmitting || !cart.length} onClick={() => void submitOrder()} type="button">
                {isSubmitting ? "Tasdiqlanmoqda..." : "Buyurtmani tasdiqlash"}
              </button>
            </div>
          </aside>
        </div>
        )}
      </div>

      {selectedProduct ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-[28px] bg-[#fffaf0] p-5 shadow-2xl">
            <h2 className="text-2xl font-black">{selectedProduct.name}</h2>
            {selectedProduct.variants.length > 1 ? (
              <div className="mt-4 grid gap-2">
                {selectedProduct.variants.map((variant) => (
                  <button className={choiceClass(selectedVariantId === variant.id)} key={variant.id} onClick={() => setSelectedVariantId(variant.id)} type="button">
                    <span>{variant.name}</span><span>{money(Number(variant.sellingPrice))}</span>
                  </button>
                ))}
              </div>
            ) : null}
            {selectedProduct.modifiers.length ? (
              <div className="mt-4 grid gap-2">
                {selectedProduct.modifiers.map((modifier) => (
                  <label className={choiceClass(selectedModifierIds.includes(modifier.modifier.id))} key={modifier.modifier.id}>
                    <span>{modifier.modifier.name}</span>
                    <span>{money(Number(modifier.modifier.price))}</span>
                    <input className="sr-only" type="checkbox" checked={selectedModifierIds.includes(modifier.modifier.id)} onChange={(event) => {
                      setSelectedModifierIds((current) => event.target.checked ? [...current, modifier.modifier.id] : current.filter((id) => id !== modifier.modifier.id));
                    }} />
                  </label>
                ))}
              </div>
            ) : null}
            <div className="mt-5 flex gap-3">
              <button className="min-h-12 flex-1 rounded-2xl bg-slate-100 font-black" onClick={() => setSelectedProduct(null)} type="button">Bekor qilish</button>
              <button className="min-h-12 flex-1 rounded-2xl bg-[#ffd52e] font-black" onClick={() => {
                const variant = selectedProduct.variants.find((item) => item.id === selectedVariantId);
                const modifiers = selectedProduct.modifiers.filter((item) => selectedModifierIds.includes(item.modifier.id));
                addLine(selectedProduct, variant, modifiers);
                setSelectedProduct(null);
              }} type="button">Savatga qo'shish</button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function basePrice(product: Product): number {
  const defaultVariant = product.variants.find((variant) => variant.isDefault);
  return Number(defaultVariant?.sellingPrice ?? product.sellingPrice);
}

function lineTotal(line: CartLine): number {
  const modifierTotal = line.modifiers.reduce((sum, modifier) => sum + Number(modifier.modifier.price), 0);
  return (Number(line.variant?.sellingPrice ?? line.product.sellingPrice) + modifierTotal) * line.quantity;
}

function money(value: number | string): string {
  return `${formatter.format(Math.round(Number(value || 0)))} so'm`;
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat("uz-UZ", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Tashkent",
  }).format(new Date(value));
}

function tabClass(active: boolean): string {
  return `shrink-0 rounded-full px-4 py-2 text-sm font-black transition ${active ? "bg-[#ffd52e] text-[#10233a]" : "bg-white text-[#00796f]"}`;
}

function choiceClass(active: boolean): string {
  return `flex min-h-12 items-center justify-between rounded-2xl border px-4 text-sm font-black ${active ? "border-[#ffd52e] bg-[#fff3a3]" : "border-[#d8e5df] bg-white"}`;
}

function isAuthenticationError(error: unknown): boolean {
  return error instanceof Error && /invalid or expired access token|unauthorized|jwt/i.test(error.message);
}
