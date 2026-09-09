"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Banknote,
  Check,
  Clock3,
  Minus,
  Plus,
  ReceiptText,
  Search,
  ShoppingBag,
  Trash2,
  X,
} from "lucide-react";
import { PermissionGuard } from "../../components/auth/permission-guard";
import { RoleGuard } from "../../components/auth/role-guard";
import { useAuth } from "../../components/auth/auth-provider";
import {
  StaffDialog,
  StaffEmpty,
  StaffShell,
} from "../../components/staff/staff-shell";
import styles from "../../components/staff/staff.module.css";
import { apiFetch } from "../../lib/api";
import { handleProductImageError, productImage } from "../../lib/media";

type Variant = {
  id: string;
  name: string;
  sellingPrice: string;
  isDefault: boolean;
};
type Modifier = {
  isRequired: boolean;
  modifier: { id: string; name: string; price: string };
};
type Product = {
  id: string;
  categoryId: string;
  name: string;
  imageUrl?: string | null;
  sellingPrice: string;
  preparationTime?: number | null;
  isCombo: boolean;
  variants: Variant[];
  modifiers: Modifier[];
};
type Catalog = {
  branchId: string;
  categories: { id: string; name: string }[];
  products: Product[];
};
type CartLine = {
  key: string;
  product: Product;
  variant?: Variant;
  modifiers: Modifier[];
  quantity: number;
};
type PosOrderResult = {
  order: {
    orderNumber: string;
    displayOrderNumber?: string | null;
    total: string;
  };
  payment: { cashReceived: string; change: string };
};
type CurrentShift = {
  id: string;
  shiftNumber?: number;
  status: "OPEN" | "CLOSED";
  openedAt?: string;
  branch?: { name?: string | null } | null;
};
const formatter = new Intl.NumberFormat("uz-UZ");
const createCheckoutKey = () =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;

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
  const { logout } = useAuth();
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [currentShift, setCurrentShift] = useState<CurrentShift | null>(null);
  const [isCheckingShift, setIsCheckingShift] = useState(true);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [categoryId, setCategoryId] = useState("ALL");
  const [query, setQuery] = useState("");
  const [cashReceived, setCashReceived] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(
    null,
  );
  const [selectedModifierIds, setSelectedModifierIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checkoutKey, setCheckoutKey] = useState(createCheckoutKey);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<PosOrderResult | null>(null);
  const [mobileView, setMobileView] = useState("menu");
  const submissionLock = useRef(false);
  const loadRequest = useRef<AbortController | null>(null);

  const loadTerminal = useCallback(async () => {
    loadRequest.current?.abort();
    const controller = new AbortController();
    loadRequest.current = controller;
    setIsCheckingShift(true);
    setError(null);
    try {
      const signal = AbortSignal.any([
        controller.signal,
        AbortSignal.timeout(12000),
      ]);
      const shift = await apiFetch<CurrentShift | null>(
        "/cash-register/shift",
        { signal },
      );
      if (controller.signal.aborted) return;
      if (!shift || shift.status !== "OPEN") {
        setCurrentShift(null);
        router.replace("/shift");
        return;
      }
      setCurrentShift(shift);
      const data = await apiFetch<Catalog>("/pos/catalog", { signal });
      if (!controller.signal.aborted) setCatalog(data);
    } catch (caught) {
      if (controller.signal.aborted) return;
      if (
        caught instanceof Error &&
        /invalid or expired access token|unauthorized|jwt/i.test(caught.message)
      ) {
        void logout();
        return;
      }
      setError(caught instanceof Error ? caught.message : "Katalog yuklanmadi");
    } finally {
      if (!controller.signal.aborted) setIsCheckingShift(false);
    }
  }, [logout, router]);

  useEffect(() => {
    void loadTerminal();
    return () => loadRequest.current?.abort();
  }, [loadTerminal]);

  const filteredProducts = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return (catalog?.products ?? []).filter(
      (product) =>
        (categoryId === "ALL" || product.categoryId === categoryId) &&
        (!normalized || product.name.toLowerCase().includes(normalized)),
    );
  }, [categoryId, catalog, query]);
  const total = cart.reduce((sum, line) => sum + lineTotal(line), 0);
  const itemCount = cart.reduce((sum, line) => sum + line.quantity, 0);
  const received = Number(cashReceived || 0);
  const validCash =
    Number.isFinite(received) && received >= total && received >= 0;
  const change = Number.isFinite(received) ? Math.max(0, received - total) : 0;

  function addProduct(product: Product) {
    if (submissionLock.current) return;
    if (product.variants.length > 1 || product.modifiers.length > 0) {
      setSelectedProduct(product);
      setSelectedVariantId(
        product.variants.find((variant) => variant.isDefault)?.id ??
          product.variants[0]?.id ??
          null,
      );
      setSelectedModifierIds(
        product.modifiers
          .filter((item) => item.isRequired)
          .map((item) => item.modifier.id),
      );
      return;
    }
    addLine(
      product,
      product.variants.find((variant) => variant.isDefault) ??
        product.variants[0],
    );
  }

  function addLine(
    product: Product,
    variant?: Variant,
    modifiers: Modifier[] = [],
  ) {
    if (submissionLock.current) return;
    const key = [
      product.id,
      variant?.id ?? "base",
      ...modifiers.map((item) => item.modifier.id).sort(),
    ].join(":");
    setCart((current) =>
      current.some((line) => line.key === key)
        ? current.map((line) =>
            line.key === key ? { ...line, quantity: line.quantity + 1 } : line,
          )
        : [
            ...current,
            {
              key,
              product,
              ...(variant ? { variant } : {}),
              modifiers,
              quantity: 1,
            },
          ],
    );
    setCheckoutKey(createCheckoutKey());
    setSuccess(null);
    setError(null);
  }

  function changeQuantity(key: string, delta: number) {
    if (submissionLock.current) return;
    setCart((current) =>
      current
        .map((line) =>
          line.key === key
            ? { ...line, quantity: line.quantity + delta }
            : line,
        )
        .filter((line) => line.quantity > 0),
    );
    setCheckoutKey(createCheckoutKey());
    setSuccess(null);
  }

  async function submitOrder() {
    if (submissionLock.current) return;
    setError(null);
    if (!cart.length) {
      setError("Buyurtma bo'sh");
      return;
    }
    if (!validCash) {
      setError("Qabul qilingan naqd summani tekshiring");
      return;
    }
    submissionLock.current = true;
    setIsSubmitting(true);
    try {
      const result = await apiFetch<PosOrderResult>("/pos/orders", {
        method: "POST",
        signal: AbortSignal.timeout(20000),
        body: JSON.stringify({
          idempotencyKey: checkoutKey,
          cashReceived: received,
          items: cart.map((line) => ({
            productId: line.product.id,
            variantId: line.variant?.id,
            quantity: line.quantity,
            modifiers: line.modifiers.map((modifier) => ({
              modifierId: modifier.modifier.id,
              quantity: 1,
            })),
          })),
        }),
      });
      setSuccess(result);
      setCart([]);
      setCashReceived("");
      setCheckoutKey(createCheckoutKey());
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Buyurtma yaratilmadi",
      );
    } finally {
      submissionLock.current = false;
      setIsSubmitting(false);
    }
  }

  return (
    <StaffShell
      title="Kassa"
      terminal
      actions={
        <button
          className={styles.shiftLink}
          title="Kassa smenasi"
          aria-label="Kassa smenasi"
          onClick={() => router.push("/shift")}
          disabled={isSubmitting}
          type="button"
        >
          <Clock3 size={17} />
          <span>
            {currentShift
              ? `Smena #${currentShift.shiftNumber ?? ""}`
              : "Smena"}
          </span>
        </button>
      }
    >
      <div className={styles.mobilePosNav}>
        <div className={styles.segments}>
          <button
            className={styles.segment}
            aria-pressed={mobileView === "menu"}
            onClick={() => setMobileView("menu")}
            type="button"
          >
            <ShoppingBag size={17} />
            Menyu
          </button>
          <button
            className={styles.segment}
            aria-pressed={mobileView === "cart"}
            onClick={() => setMobileView("cart")}
            type="button"
          >
            <ReceiptText size={17} />
            Buyurtma<span>{itemCount}</span>
          </button>
        </div>
      </div>
      {isCheckingShift ? (
        <StaffEmpty title="Kassa yuklanmoqda..." />
      ) : !catalog ? (
        <div className={styles.content}>
          <div className={styles.error} role="alert">
            {error ?? "Katalog topilmadi"}
            <button
              className={styles.button}
              onClick={() => void loadTerminal()}
              type="button"
            >
              Qayta urinish
            </button>
          </div>
        </div>
      ) : (
        <div className={styles.posBody}>
          <section
            className={styles.catalog}
            data-hidden={mobileView !== "menu"}
            aria-label="Mahsulotlar katalogi"
          >
            <div className={styles.catalogBar}>
              <label className={styles.search}>
                <Search size={19} />
                <input
                  placeholder="Mahsulot qidirish..."
                  aria-label="Mahsulot qidirish"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
                {query && (
                  <button
                    type="button"
                    aria-label="Qidiruvni tozalash"
                    onClick={() => setQuery("")}
                  >
                    <X size={18} />
                  </button>
                )}
              </label>
              <span className={styles.muted}>
                {filteredProducts.length} ta mahsulot
              </span>
            </div>
            <nav
              className={styles.categoryNav}
              aria-label="Mahsulot kategoriyalari"
            >
              <button
                aria-pressed={categoryId === "ALL"}
                onClick={() => setCategoryId("ALL")}
                type="button"
              >
                Barchasi
              </button>
              {catalog.categories.map((category) => (
                <button
                  key={category.id}
                  aria-pressed={categoryId === category.id}
                  onClick={() => setCategoryId(category.id)}
                  type="button"
                >
                  {category.name}
                </button>
              ))}
            </nav>
            {filteredProducts.length ? (
              <div className={styles.productGrid}>
                {filteredProducts.map((product) => (
                  <button
                    className={styles.product}
                    key={product.id}
                    onClick={() => addProduct(product)}
                    disabled={isSubmitting}
                    aria-label={`${product.name}, ${money(basePrice(product))}, qo'shish`}
                    type="button"
                  >
                    <div className={styles.productImage}>
                      <img
                        src={productImage(product.imageUrl)}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        onError={(event) =>
                          handleProductImageError(event.currentTarget)
                        }
                      />
                      <span className={styles.productAdd}>
                        <Plus size={20} />
                      </span>
                    </div>
                    <div className={styles.productInfo}>
                      <h2>{product.name}</h2>
                      <p>{money(basePrice(product))}</p>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <StaffEmpty title="Mahsulot topilmadi">
                Qidiruv yoki kategoriyani o'zgartiring.
              </StaffEmpty>
            )}
          </section>
          <aside
            className={styles.receipt}
            data-hidden={mobileView !== "cart"}
            aria-label="Joriy buyurtma"
          >
            <div className={styles.receiptHeader}>
              <h2>Yangi buyurtma</h2>
              <span className={styles.badge}>{itemCount} ta</span>
            </div>
            <div className={styles.cartLines}>
              {success && (
                <div className={styles.success} role="status">
                  <strong>
                    #
                    {success.order.displayOrderNumber ??
                      success.order.orderNumber}{" "}
                    qabul qilindi
                  </strong>
                  <p>Qaytim: {money(success.payment.change)}</p>
                </div>
              )}
              {cart.length ? (
                cart.map((line) => (
                  <div className={styles.cartLine} key={line.key}>
                    <div className={styles.cartLineHeader}>
                      <div>
                        <strong>{line.product.name}</strong>
                        <p className={styles.muted}>
                          {line.variant?.name ?? "Standart"}
                          {line.modifiers.length
                            ? ` · ${line.modifiers.map((item) => item.modifier.name).join(", ")}`
                            : ""}
                        </p>
                      </div>
                      <button
                        className={styles.iconButton}
                        disabled={isSubmitting}
                        aria-label={`${line.product.name}ni o'chirish`}
                        title="O'chirish"
                        onClick={() => changeQuantity(line.key, -line.quantity)}
                        type="button"
                      >
                        <Trash2 size={17} />
                      </button>
                    </div>
                    <div className={styles.cartLineBottom}>
                      <div className={styles.quantity}>
                        <button
                          aria-label={`${line.product.name}ni kamaytirish`}
                          disabled={isSubmitting}
                          onClick={() => changeQuantity(line.key, -1)}
                          type="button"
                        >
                          <Minus size={16} />
                        </button>
                        <span>{line.quantity}</span>
                        <button
                          aria-label={`${line.product.name}ni ko'paytirish`}
                          disabled={isSubmitting}
                          onClick={() => changeQuantity(line.key, 1)}
                          type="button"
                        >
                          <Plus size={16} />
                        </button>
                      </div>
                      <strong>{money(lineTotal(line))}</strong>
                    </div>
                  </div>
                ))
              ) : (
                <StaffEmpty title="Buyurtma bo'sh">
                  Menyudan mahsulot tanlang.
                </StaffEmpty>
              )}
            </div>
            <div className={styles.checkout}>
              <div className={styles.totalRow}>
                <span>Jami</span>
                <strong>{money(total)}</strong>
              </div>
              <label className={styles.field}>
                <span>Qabul qilingan naqd pul</span>
                <input
                  className={styles.input}
                  inputMode="numeric"
                  type="number"
                  min="0"
                  step="1"
                  placeholder="0"
                  disabled={isSubmitting || !cart.length}
                  value={cashReceived}
                  onChange={(event) => setCashReceived(event.target.value)}
                />
              </label>
              <div className={styles.quickCash}>
                <button
                  disabled={isSubmitting || !cart.length}
                  onClick={() => setCashReceived(String(total))}
                  type="button"
                >
                  Aniq summa
                </button>
                {[50000, 100000].map((amount) => (
                  <button
                    key={amount}
                    disabled={isSubmitting || !cart.length}
                    onClick={() =>
                      setCashReceived(
                        String(
                          (Number.isFinite(received) ? received : 0) + amount,
                        ),
                      )
                    }
                    type="button"
                  >
                    +{formatter.format(amount)}
                  </button>
                ))}
              </div>
              <div className={styles.change}>
                <span>{received < total ? "Yetishmayapti" : "Qaytim"}</span>
                <strong>
                  {money(received < total ? total - received : change)}
                </strong>
              </div>
              {error && (
                <p className={styles.error} role="alert">
                  {error}
                </p>
              )}
              <button
                className={`${styles.primary} ${styles.full} ${styles.desktopPay}`}
                disabled={isSubmitting || !cart.length || !validCash}
                onClick={() => void submitOrder()}
                type="button"
              >
                <Banknote size={19} />
                {isSubmitting ? "Tasdiqlanmoqda..." : "Buyurtmani tasdiqlash"}
              </button>
            </div>
          </aside>
        </div>
      )}
      {catalog && (
        <div className={styles.mobilePaybar}>
          <div>
            <small>{itemCount} ta mahsulot</small>
            <strong>{money(total)}</strong>
          </div>
          <button
            className={styles.primary}
            disabled={
              isSubmitting ||
              !cart.length ||
              (mobileView === "cart" && !validCash)
            }
            onClick={() =>
              mobileView === "menu" ? setMobileView("cart") : void submitOrder()
            }
            type="button"
          >
            {mobileView === "menu" ? (
              <>
                Buyurtma
                <ArrowRight size={18} />
              </>
            ) : (
              <>
                <Check size={18} />
                {isSubmitting ? "Saqlanmoqda" : "Tasdiqlash"}
              </>
            )}
          </button>
        </div>
      )}
      {selectedProduct && (
        <StaffDialog
          title={selectedProduct.name}
          onClose={() => setSelectedProduct(null)}
        >
          {selectedProduct.variants.length > 1 && (
            <fieldset className={styles.choices}>
              <legend className={styles.subheading}>Mahsulot turi</legend>
              {selectedProduct.variants.map((variant) => (
                <label className={styles.choice} key={variant.id}>
                  <input
                    type="radio"
                    name="product-variant"
                    checked={selectedVariantId === variant.id}
                    onChange={() => setSelectedVariantId(variant.id)}
                  />
                  <span>{variant.name}</span>
                  <strong>{money(variant.sellingPrice)}</strong>
                </label>
              ))}
            </fieldset>
          )}
          {!!selectedProduct.modifiers.length && (
            <fieldset className={styles.choices}>
              <legend className={styles.subheading}>Qo'shimchalar</legend>
              {selectedProduct.modifiers.map((modifier) => (
                <label className={styles.choice} key={modifier.modifier.id}>
                  <input
                    type="checkbox"
                    checked={selectedModifierIds.includes(modifier.modifier.id)}
                    disabled={modifier.isRequired}
                    onChange={(event) =>
                      setSelectedModifierIds((current) =>
                        event.target.checked
                          ? [...current, modifier.modifier.id]
                          : current.filter((id) => id !== modifier.modifier.id),
                      )
                    }
                  />
                  <span>
                    {modifier.modifier.name}
                    {modifier.isRequired ? " (majburiy)" : ""}
                  </span>
                  <strong>{money(modifier.modifier.price)}</strong>
                </label>
              ))}
            </fieldset>
          )}
          <div className={styles.dialogActions}>
            <button
              className={styles.button}
              onClick={() => setSelectedProduct(null)}
              type="button"
            >
              Bekor qilish
            </button>
            <button
              className={styles.primary}
              onClick={() => {
                addLine(
                  selectedProduct,
                  selectedProduct.variants.find(
                    (item) => item.id === selectedVariantId,
                  ),
                  selectedProduct.modifiers.filter((item) =>
                    selectedModifierIds.includes(item.modifier.id),
                  ),
                );
                setSelectedProduct(null);
              }}
              type="button"
            >
              <Plus size={18} />
              Qo'shish
            </button>
          </div>
        </StaffDialog>
      )}
    </StaffShell>
  );
}

function basePrice(product: Product): number {
  return Number(
    (
      product.variants.find((variant) => variant.isDefault) ??
      product.variants[0]
    )?.sellingPrice ?? product.sellingPrice,
  );
}
function lineTotal(line: CartLine): number {
  return (
    (Number(line.variant?.sellingPrice ?? line.product.sellingPrice) +
      line.modifiers.reduce(
        (sum, item) => sum + Number(item.modifier.price),
        0,
      )) *
    line.quantity
  );
}
function money(value: number | string): string {
  return `${formatter.format(Math.round(Number(value || 0)))} so'm`;
}
