"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Banknote,
  Check,
  Clock3,
  History,
  Minus,
  Plus,
  ReceiptText,
  Search,
  ShoppingBag,
  Trash2,
  Utensils,
  X,
} from "lucide-react";
import { PermissionGuard } from "../../../components/auth/permission-guard";
import { RoleGuard } from "../../../components/auth/role-guard";
import { useAuth } from "../../../components/auth/auth-provider";
import {
  StaffDialog,
  StaffEmpty,
  StaffShell,
} from "../../../components/staff/staff-shell";
import styles from "../../../components/staff/staff.module.css";
import { apiFetch } from "../../../lib/api";
import { handleProductImageError, productImage } from "../../../lib/media";
import {
  orderStatusLabels,
  type OrderStatus,
} from "../../../lib/order-display";

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
type PaymentMethodOption = { code: string; name: string; active?: boolean };
type PosTable = {
  id: string;
  code: string;
  name: string;
  number?: number | null;
  capacity?: number | null;
  status: string;
  hall?: { id: string; name: string } | null;
};
type Catalog = {
  branchId: string;
  categories: { id: string; name: string }[];
  products: Product[];
  /*
   * Server filialning sozlangan usullarini qaytaradi. Eski server
   * javobida bo'lmasligi mumkin, shuning uchun ixtiyoriy — bunda
   * naqdga qaytiladi.
   */
  paymentMethods?: PaymentMethodOption[];
  tables?: PosTable[];
};
type CartLine = {
  key: string;
  product: Product;
  variant?: Variant;
  modifiers: Modifier[];
  quantity: number;
};
/** Savatni sessiyada saqlash uchun ixcham shakl — narxlar katalogdan qayta olinadi. */
type StoredCartLine = {
  key: string;
  productId: string;
  variantId?: string | null;
  modifierIds: string[];
  quantity: number;
};
type OrderType = "TAKEAWAY" | "DINE_IN";
type PosOrderResult = {
  order: {
    id?: string;
    orderNumber: string;
    displayOrderNumber?: string | null;
    total: string;
    receipts?: { id: string; receiptNumber: string }[];
  };
  payment: {
    cashReceived: string;
    change: string;
    method?: string;
    methods?: { code: string; amount: string }[];
  };
};
type CurrentShift = {
  id: string;
  shiftNumber?: number;
  status: "OPEN" | "CLOSED";
  openedAt?: string;
  branch?: { name?: string | null } | null;
};
type StatusHistoryEntry = {
  id: string;
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus;
  reason?: string | null;
  createdAt: string;
  changedByEmployee?: {
    firstName: string;
    lastName?: string | null;
    employeeCode?: string | null;
  } | null;
  changedByUser?: {
    displayName?: string | null;
    email?: string | null;
  } | null;
};
type ShiftHistoryOrder = {
  id: string;
  orderNumber: string;
  displayOrderNumber?: string | null;
  status: OrderStatus;
  total: string;
  createdAt: string;
  items: {
    id: string;
    productName: string;
    quantity: string;
    totalPrice: string;
  }[];
  statusHistory?: StatusHistoryEntry[];
};
const formatter = new Intl.NumberFormat("uz-UZ");
const createCheckoutKey = () =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
/*
 * O'zbekistonda amalda yuradigan nominallar. Ilgari faqat +50 000 va
 * +100 000 bor edi, shuning uchun kassir 20 000 yoki 5 000 ni qo'lda
 * terishga majbur bo'lardi.
 */
const cashDenominations = [1000, 5000, 10000, 20000, 50000, 100000, 200000];
const cashMethodCode = "CASH";
const fallbackPaymentMethods: PaymentMethodOption[] = [
  { code: cashMethodCode, name: "Naqd" },
];
const cartStorageKey = (shiftId: string) => `mazetto.pos.cart.${shiftId}`;

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
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyOrders, setHistoryOrders] = useState<ShiftHistoryOrder[]>([]);
  const [historyStatus, setHistoryStatus] = useState("");
  const [historySearch, setHistorySearch] = useState("");
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [orderType, setOrderType] = useState<OrderType>("TAKEAWAY");
  const [tableId, setTableId] = useState("");
  const [paymentCode, setPaymentCode] = useState(cashMethodCode);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const submissionLock = useRef(false);
  const loadRequest = useRef<AbortController | null>(null);
  /*
   * Savat sessiyadan TIKLANDIMI. Tiklanmagan holda saqlash effekti
   * bo'sh savatni yozib, saqlangan savatni o'chirib yuborardi.
   */
  const cartRestored = useRef<string | null>(null);

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

  function historyActor(entry: StatusHistoryEntry): string {
    const employee = entry.changedByEmployee;
    if (employee) {
      return [employee.firstName, employee.lastName].filter(Boolean).join(" ");
    }
    return (
      entry.changedByUser?.displayName || entry.changedByUser?.email || "Tizim"
    );
  }

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    setHistoryError("");
    const params = new URLSearchParams({ limit: "100", offset: "0" });
    if (historyStatus) params.set("status", historyStatus);
    if (historySearch.trim()) params.set("search", historySearch.trim());
    try {
      setHistoryOrders(
        await apiFetch<ShiftHistoryOrder[]>(
          `/cash-register/shift/orders?${params.toString()}`,
          {
            cache: "no-store",
            signal: AbortSignal.timeout(12000),
          },
        ),
      );
    } catch (caught) {
      setHistoryError(
        caught instanceof Error ? caught.message : "Tarix yuklanmadi.",
      );
    } finally {
      setHistoryLoading(false);
    }
  }, [historySearch, historyStatus]);

  useEffect(() => {
    if (historyOpen) void loadHistory();
  }, [historyOpen, loadHistory]);

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
  const paymentMethods = catalog?.paymentMethods?.length
    ? catalog.paymentMethods
    : fallbackPaymentMethods;
  const isCashPayment = paymentCode === cashMethodCode;
  const tables = catalog?.tables ?? [];
  const isDineIn = orderType === "DINE_IN";
  /*
   * Yuborish sharti to'lov usuliga QARAB o'zgaradi: naqd bo'lmaganda
   * "qabul qilingan naqd" degan tushuncha yo'q, shuning uchun uni talab
   * qilish kartani bloklab qo'yardi.
   */
  const canSubmit = cart.length > 0 && (!isCashPayment || validCash);

  /*
   * Server tanlagan usulni bilmasa (masalan sozlamadan o'chirilgan),
   * mavjud birinchisiga o'tiladi — aks holda kassir yo'q usul bilan
   * yuborib, faqat serverdan xato olardi.
   */
  useEffect(() => {
    if (paymentMethods.some((method) => method.code === paymentCode)) return;
    setPaymentCode(paymentMethods[0]?.code ?? cashMethodCode);
  }, [paymentMethods, paymentCode]);

  /*
   * Zaldan olib ketishga o'tilsa tanlangan stol tozalanadi: server
   * olib ketish buyurtmasida stolni rad etadi.
   */
  useEffect(() => {
    if (!isDineIn && tableId) setTableId("");
  }, [isDineIn, tableId]);

  /*
   * Idempotentlik kaliti so'rov MAZMUNI o'zgarganda yangilanadi.
   *
   * Server `requestHash` ni tur, stol, to'lov usuli va naqd summasidan
   * ham yasaydi. Kalit o'zgarmasa, kassir turni o'zgartirib qayta
   * yuborganda server "boshqa mazmun" deb rad etardi. Mazmun
   * o'zgarmaganda esa kalit SAQLANADI — tarmoq uzilganda qayta urinish
   * shu tufayli ikkinchi buyurtma yaratmaydi.
   */
  const payloadSignature = useMemo(
    () =>
      JSON.stringify({
        orderType,
        tableId: isDineIn ? tableId : null,
        paymentCode,
        cashReceived: isCashPayment ? received : null,
        items: cart.map((line) => [
          line.product.id,
          line.variant?.id ?? null,
          line.quantity,
          line.modifiers.map((modifier) => modifier.modifier.id).sort(),
        ]),
      }),
    [orderType, tableId, isDineIn, paymentCode, isCashPayment, received, cart],
  );

  useEffect(() => {
    setCheckoutKey(createCheckoutKey());
  }, [payloadSignature]);

  /*
   * SAVAT SESSIYADA SAQLANADI.
   *
   * Ilgari savat faqat komponent holatida turardi: kassir "Smena"ga
   * o'tsa, brauzerda orqaga bossa yoki planshet qayta yuklansa, butun
   * savat jimgina yo'qolardi — bu tirbandlikda to'g'ridan-to'g'ri vaqt
   * va pul yo'qotish edi.
   *
   * `sessionStorage` tanlandi, `localStorage` emas: savat SMENAGA
   * tegishli va boshqa kunga o'tib ketmasligi kerak. Kalitga smena id'si
   * kiritilgani uchun boshqa smena boshqa kassirning savatini ko'rmaydi.
   *
   * Mahsulotlar ID bo'yicha saqlanadi va katalogdan QAYTA tiklanadi:
   * shunda narx har doim joriy narx bo'ladi va o'chirilgan mahsulot
   * o'zidan-o'zi tushib qoladi.
   */
  useEffect(() => {
    const shiftId = currentShift?.id;
    if (!shiftId || !catalog || cartRestored.current === shiftId) return;
    cartRestored.current = shiftId;
    let stored: StoredCartLine[] = [];
    try {
      const raw = window.sessionStorage.getItem(cartStorageKey(shiftId));
      if (raw) stored = JSON.parse(raw) as StoredCartLine[];
    } catch {
      // Buzilgan yozuv savatni bloklamasligi kerak — bo'sh savat bilan boshlanadi.
      return;
    }
    if (!Array.isArray(stored) || !stored.length) return;
    const restored = stored.flatMap((line) => {
      const product = catalog.products.find(
        (candidate) => candidate.id === line.productId,
      );
      if (!product || !(line.quantity > 0)) return [];
      const variant = line.variantId
        ? product.variants.find((candidate) => candidate.id === line.variantId)
        : undefined;
      // Saqlangan variant endi mavjud bo'lmasa, qator tiklanmaydi.
      if (line.variantId && !variant) return [];
      const modifiers = product.modifiers.filter((modifier) =>
        line.modifierIds.includes(modifier.modifier.id),
      );
      return [
        {
          key: line.key,
          product,
          ...(variant ? { variant } : {}),
          modifiers,
          quantity: line.quantity,
        } satisfies CartLine,
      ];
    });
    if (restored.length) setCart(restored);
  }, [catalog, currentShift?.id]);

  useEffect(() => {
    const shiftId = currentShift?.id;
    if (!shiftId || cartRestored.current !== shiftId) return;
    const key = cartStorageKey(shiftId);
    try {
      if (!cart.length) {
        window.sessionStorage.removeItem(key);
        return;
      }
      window.sessionStorage.setItem(
        key,
        JSON.stringify(
          cart.map((line) => ({
            key: line.key,
            productId: line.product.id,
            variantId: line.variant?.id ?? null,
            modifierIds: line.modifiers.map((modifier) => modifier.modifier.id),
            quantity: line.quantity,
          })),
        ),
      );
    } catch {
      // Xotira to'lgan bo'lsa sotuvni to'xtatmaslik kerak.
    }
  }, [cart, currentShift?.id]);

  /*
   * Yorliq yopilishi `sessionStorage` ni ham o'chiradi, shuning uchun
   * to'ldirilgan savat bilan chiqishda brauzer ogohlantiradi.
   */
  useEffect(() => {
    if (!cart.length) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [cart.length]);

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

  function openCheckout() {
    if (!cart.length || isSubmitting) return;
    setError(null);
    if (isCashPayment && !cashReceived) setCashReceived(String(total));
    setCheckoutOpen(true);
  }

  async function submitOrder() {
    if (submissionLock.current) return;
    setError(null);
    if (!cart.length) {
      setError("Buyurtma bo'sh");
      return;
    }
    if (isCashPayment && !validCash) {
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
          type: orderType,
          ...(isDineIn && tableId ? { tableId } : {}),
          /*
           * Bo'lak summasi buyurtma summasiga TENG yuboriladi. Mijoz
           * bergan ortiqcha naqd `cashReceived` da qoladi va qaytim
           * sifatida qaytariladi — ortiqcha pul daromad deb yozilmaydi.
           */
          payments: [{ paymentMethodCode: paymentCode, amount: total }],
          ...(isCashPayment ? { cashReceived: received } : {}),
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
      setTableId("");
      setCheckoutKey(createCheckoutKey());
      setCheckoutOpen(false);
      // Mobil'da keyingi mijoz uchun darhol menyuga qaytiladi.
      setMobileView("menu");
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
        <>
          <button
            className={styles.shiftLink}
            title="Smena tarixi"
            aria-label="Smena tarixi"
            onClick={() => setHistoryOpen(true)}
            disabled={isSubmitting}
            type="button"
          >
            <History size={17} />
            <span>Tarix</span>
          </button>
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
        </>
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
            <div className={styles.receiptFooter}>
              <button
                className={styles.checkoutTrigger}
                disabled={isSubmitting || !cart.length}
                onClick={openCheckout}
                type="button"
              >
                <span>Jami</span>
                <strong>{money(total)}</strong>
                <ArrowRight size={20} aria-hidden="true" />
              </button>
            </div>
          </aside>
        </div>
      )}
      {catalog && checkoutOpen && (
        <StaffDialog
          title="To'lov va buyurtma"
          placement="bottom"
          busy={isSubmitting}
          onClose={() => {
            setCheckoutOpen(false);
            setError(null);
          }}
        >
          <div className={styles.checkoutSheetBody}>
            <div className={styles.totalRow}>
              <span>{itemCount} ta mahsulot</span>
              <strong>{money(total)}</strong>
            </div>

            <div className={styles.checkoutSheetSection}>
              <span className={styles.checkoutLabel}>Buyurtma turi</span>
              <div
                className={styles.segments}
                role="group"
                aria-label="Buyurtma turi"
              >
                <button
                  className={styles.segment}
                  aria-pressed={orderType === "TAKEAWAY"}
                  disabled={isSubmitting}
                  onClick={() => setOrderType("TAKEAWAY")}
                  type="button"
                >
                  <ShoppingBag size={16} />
                  Olib ketish
                </button>
                <button
                  className={styles.segment}
                  aria-pressed={isDineIn}
                  disabled={isSubmitting}
                  onClick={() => setOrderType("DINE_IN")}
                  type="button"
                >
                  <Utensils size={16} />
                  Zal
                </button>
              </div>
              {isDineIn && (
                <label className={styles.checkoutTable}>
                  <span>
                    Stol <small>(ixtiyoriy)</small>
                  </span>
                  <select
                    aria-label="Stol (ixtiyoriy)"
                    disabled={isSubmitting || !tables.length}
                    value={tableId}
                    onChange={(event) => setTableId(event.target.value)}
                  >
                    <option value="">Tanlanmagan</option>
                    {tables.map((table) => (
                      <option key={table.id} value={table.id}>
                        {table.hall?.name
                          ? table.hall.name + " · " + table.name
                          : table.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>

            <div className={styles.checkoutSheetSection}>
              <span className={styles.checkoutLabel}>To'lov turi</span>
              <div
                className={styles.paymentOptions}
                role="group"
                aria-label="To'lov usuli"
              >
                {paymentMethods.map((method) => (
                  <button
                    aria-pressed={paymentCode === method.code}
                    className={styles.paymentOption}
                    disabled={isSubmitting}
                    key={method.code}
                    onClick={() => {
                      setPaymentCode(method.code);
                      if (method.code === cashMethodCode && !cashReceived) {
                        setCashReceived(String(total));
                      }
                    }}
                    type="button"
                  >
                    <span className={styles.paymentOptionMark}>
                      {paymentCode === method.code ? <Check size={14} /> : null}
                    </span>
                    <span>{method.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {isCashPayment && (
              <div className={styles.checkoutSheetSection}>
                <label className={styles.field}>
                  <span>Qabul qilingan naqd pul</span>
                  <input
                    className={styles.input}
                    inputMode="numeric"
                    type="number"
                    min="0"
                    step="1"
                    placeholder="0"
                    disabled={isSubmitting}
                    value={cashReceived}
                    onChange={(event) => setCashReceived(event.target.value)}
                  />
                </label>
                <div className={styles.quickCash}>
                  <button
                    disabled={isSubmitting}
                    onClick={() => setCashReceived(String(total))}
                    type="button"
                  >
                    Aniq summa
                  </button>
                  {cashDenominations.map((amount) => (
                    <button
                      key={amount}
                      disabled={isSubmitting}
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
                  <button
                    disabled={isSubmitting || !cashReceived}
                    onClick={() => setCashReceived("")}
                    type="button"
                  >
                    Tozalash
                  </button>
                </div>
                <div className={styles.change} role="status">
                  <span>{received < total ? "Yetishmayapti" : "Qaytim"}</span>
                  <strong>
                    {money(received < total ? total - received : change)}
                  </strong>
                </div>
              </div>
            )}

            {error && (
              <p className={styles.error} role="alert">
                {error}
              </p>
            )}
            <div className={styles.checkoutSheetActions}>
              <button
                className={styles.primary}
                disabled={isSubmitting || !canSubmit}
                onClick={() => void submitOrder()}
                type="button"
              >
                <Banknote size={19} />
                {isSubmitting ? "Tasdiqlanmoqda..." : "Buyurtmani tasdiqlash"}
              </button>
            </div>
          </div>
        </StaffDialog>
      )}
      {catalog && (
        <div className={styles.mobilePaybar}>
          <div>
            <small>{itemCount} ta mahsulot</small>
            <strong>{money(total)}</strong>
          </div>
          <button
            className={styles.primary}
            disabled={isSubmitting || !cart.length}
            onClick={() =>
              mobileView === "menu" ? setMobileView("cart") : openCheckout()
            }
            type="button"
          >
            {mobileView === "menu" ? "Buyurtma" : "To'lov"}
            <ArrowRight size={18} />
          </button>
        </div>
      )}
      {/*
        SOTUVDAN KEYINGI QADAM.
        Ilgari muvaffaqiyat savat ichidagi kichik banner edi: qaytim
        bir qatorda ko'rinardi, chekka o'tish yo'li yo'q edi (chek
        sahifasi bor, lekin unga hech qayerdan havola qilinmagan) va
        mobil'da kassir bo'sh "Buyurtma" ko'rinishida qolib ketardi.
      */}
      {success && (
        <StaffDialog
          title="Buyurtma qabul qilindi"
          onClose={() => setSuccess(null)}
        >
          <p className={styles.ticketNumber}>
            #{success.order.displayOrderNumber ?? success.order.orderNumber}
          </p>
          <div className={styles.change} role="status">
            <span>Qaytim</span>
            <strong>{money(success.payment.change)}</strong>
          </div>
          <div className={styles.totalRow}>
            <span>Buyurtma summasi</span>
            <strong>{money(success.order.total)}</strong>
          </div>
          <div className={styles.dialogActions}>
            {success.order.receipts?.[0]?.id ? (
              <button
                className={styles.button}
                onClick={() =>
                  router.push(`/pos/receipt/${success.order.receipts![0]!.id}`)
                }
                type="button"
              >
                <ReceiptText size={18} />
                Chek
              </button>
            ) : null}
            <button
              className={styles.primary}
              onClick={() => setSuccess(null)}
              type="button"
            >
              <Plus size={18} />
              Yangi buyurtma
            </button>
          </div>
        </StaffDialog>
      )}
      {historyOpen && (
        <StaffDialog
          title="Smena buyurtmalari tarixi"
          busy={historyLoading}
          onClose={() => setHistoryOpen(false)}
        >
          <div className={styles.historyControls}>
            <label className={styles.search}>
              <Search size={17} />
              <input
                aria-label="Smena tarixidan qidirish"
                placeholder="Buyurtma yoki mahsulot"
                value={historySearch}
                onChange={(event) => setHistorySearch(event.target.value)}
              />
            </label>
            <select
              className={styles.historySelect}
              aria-label="Buyurtma holati"
              value={historyStatus}
              onChange={(event) => setHistoryStatus(event.target.value)}
            >
              <option value="">Barcha holatlar</option>
              {Object.entries(orderStatusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <button
              className={styles.button}
              onClick={() => void loadHistory()}
              disabled={historyLoading}
              type="button"
            >
              Yangilash
            </button>
          </div>
          {historyError && (
            <div className={styles.error} role="alert">
              {historyError}
            </div>
          )}
          <div className={styles.historyList}>
            {historyLoading ? (
              <div className={styles.skeleton} />
            ) : historyOrders.length ? (
              historyOrders.map((order) => (
                <article className={styles.historyOrder} key={order.id}>
                  <div>
                    <strong>
                      #{order.displayOrderNumber ?? order.orderNumber}
                    </strong>
                    <span className={styles.muted}>
                      {order.items.length} ta mahsulot ·{" "}
                      {new Date(order.createdAt).toLocaleTimeString("uz-UZ", {
                        hour: "2-digit",
                        minute: "2-digit",
                        timeZone: "Asia/Tashkent",
                      })}
                    </span>
                    {order.statusHistory?.length ? (
                      <details className={styles.deliveryDetails}>
                        <summary>
                          <Clock3 size={14} /> Statuslar tarixi
                        </summary>
                        <ul className={styles.itemList}>
                          {order.statusHistory.map((entry) => (
                            <li key={entry.id}>
                              <span>
                                {orderStatusLabels[entry.toStatus] ??
                                  entry.toStatus}
                              </span>
                              <span className={styles.muted}>
                                {historyActor(entry)} ·{" "}
                                {new Date(entry.createdAt).toLocaleTimeString(
                                  "uz-UZ",
                                  {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                    timeZone: "Asia/Tashkent",
                                  },
                                )}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </details>
                    ) : null}
                  </div>
                  <div className={styles.historyAmount}>
                    <span
                      className={styles.badge}
                      data-tone={
                        order.status === "CANCELLED"
                          ? "late"
                          : order.status === "COMPLETED" ||
                              order.status === "SERVED"
                            ? "ready"
                            : "waiting"
                      }
                    >
                      {orderStatusLabels[order.status]}
                    </span>
                    <strong>{money(order.total)}</strong>
                  </div>
                </article>
              ))
            ) : (
              <StaffEmpty title="Tarix bo'sh">
                Bu smenada qabul qilingan buyurtmalar shu yerda ko'rinadi.
              </StaffEmpty>
            )}
          </div>
        </StaffDialog>
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
