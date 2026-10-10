"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Banknote,
  BellRing,
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
import { useAuth } from "../../../components/auth/auth-provider";
import { hasPermission } from "../../../lib/auth";
import { useKitchenChime } from "../../../components/kitchen/use-kitchen-chime";
import type { KitchenQueueResponse } from "../../../components/kitchen/kitchen-types";
import {
  StaffDialog,
  StaffEmpty,
  StaffShell,
  StaffSync,
} from "../../../components/staff/staff-shell";
import styles from "../../../components/staff/staff.module.css";
import { ApiRequestError, apiFetch } from "../../../lib/api";
import { sanitizeCashInput } from "../../../lib/cash-entry.mjs";
import { readOfflinePosCatalogSnapshot } from "../../../lib/offline-pos-bootstrap.mjs";
import {
  parsePosCheckoutDraft,
  serializePosCheckoutDraft,
} from "../../../lib/pos-checkout-draft.mjs";
import { useStaffRealtime } from "../../../lib/use-staff-realtime";
import { handleProductImageError, productImage } from "../../../lib/media";
import { paymentMethodLabel } from "../../../components/payment/payment-methods";
import { CashierWorkspaceNavigation } from "../../../components/staff/staff-panel-navigation";

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
type OrderType = "TAKEAWAY" | "DINE_IN";
type PosOrderResult = {
  offlineQueued?: boolean;
  payLater?: boolean;
  message?: string;
  order: {
    id?: string;
    orderNumber: string;
    displayOrderNumber?: string | null;
    total: string;
    receipts?: { id: string; receiptNumber: string; documentType?: string }[];
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
  branchId?: string;
  shiftNumber?: number;
  status: "OPEN" | "CLOSED";
  openedAt?: string;
  branch?: { name?: string | null } | null;
};
const formatter = new Intl.NumberFormat("uz-UZ");
const createCheckoutKey = () =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
const cashMethodCode = "CASH";
const fallbackPaymentMethods: PaymentMethodOption[] = [
  { code: cashMethodCode, name: paymentMethodLabel(cashMethodCode) },
];
const cartStorageKey = (shiftId: string) => `mazetto.pos.cart.${shiftId}`;

export default function PosPage() {
  return (
    <PermissionGuard permission="POS_USE">
      <PosTerminal />
    </PermissionGuard>
  );
}

function PosTerminal() {
  const router = useRouter();
  const { user, logout, session } = useAuth();
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [catalogOffline, setCatalogOffline] = useState(false);
  const [currentShift, setCurrentShift] = useState<CurrentShift | null>(null);
  const [isCheckingShift, setIsCheckingShift] = useState(true);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
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
  const [checkoutAttempt, setCheckoutAttempt] = useState<{
    key: string;
    payloadSignature: string | null;
  }>(() => ({ key: createCheckoutKey(), payloadSignature: null }));
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<PosOrderResult | null>(null);
  const [mobileView, setMobileView] = useState("menu");
  const [orderType, setOrderType] = useState<OrderType>("DINE_IN");
  const [payLater, setPayLater] = useState(false);
  const [tableId, setTableId] = useState("");
  const [paymentCode, setPaymentCode] = useState(cashMethodCode);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [newOnlineOrders, setNewOnlineOrders] = useState(0);
  const [onlineOrdersError, setOnlineOrdersError] = useState(false);
  const onlineOrdersLoading = useRef(false);
  const submissionLock = useRef(false);
  const loadRequest = useRef<AbortController | null>(null);
  /*
   * Savat sessiyadan TIKLANDIMI. Tiklanmagan holda saqlash effekti
   * bo'sh savatni yozib, saqlangan savatni o'chirib yuborardi.
   */
  const cartRestored = useRef<string | null>(null);
  const draftRestorePending = useRef<string | null>(null);

  const loadTerminal = useCallback(async (): Promise<boolean> => {
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
      if (controller.signal.aborted) return false;
      if (!shift || shift.status !== "OPEN") {
        setCurrentShift(null);
        router.replace("/shift");
        return true;
      }
      setCurrentShift(shift);
      let data: Catalog;
      let catalogUpdatedAt = new Date();
      let offlineSnapshotUsed = false;
      try {
        data = await apiFetch<Catalog>("/pos/catalog", { signal });
      } catch (catalogError) {
        const offlineStatusCodes = new Set([502, 503, 504, 521, 522, 523, 524]);
        if (
          !window.mazettoDesktop?.api ||
          !(catalogError instanceof ApiRequestError) ||
          !offlineStatusCodes.has(catalogError.status)
        ) {
          throw catalogError;
        }

        try {
          const snapshot = await apiFetch<unknown>("/realtime/bootstrap", {
            signal,
          });
          const restored = readOfflinePosCatalogSnapshot(
            snapshot,
            shift.branchId || user?.branchId || null,
          );
          if (!restored) throw catalogError;
          data = restored.catalog as Catalog;
          catalogUpdatedAt = new Date(restored.generatedAt);
          offlineSnapshotUsed = true;
        } catch {
          throw catalogError;
        }
      }
      if (!controller.signal.aborted) {
        setCatalog(data);
        setCatalogOffline(offlineSnapshotUsed);
        setLastUpdatedAt(catalogUpdatedAt);
      }
      return true;
    } catch (caught) {
      if (controller.signal.aborted) return false;
      if (
        caught instanceof Error &&
        /invalid or expired access token|unauthorized|jwt/i.test(caught.message)
      ) {
        void logout();
        return false;
      }
      setError(caught instanceof Error ? caught.message : "Katalog yuklanmadi");
      return false;
    } finally {
      if (!controller.signal.aborted) setIsCheckingShift(false);
    }
  }, [logout, router]);

  useEffect(() => {
    void loadTerminal();
    return () => loadRequest.current?.abort();
  }, [loadTerminal]);

  const loadOnlineOrders = useCallback(async () => {
    if (!hasPermission(user, "KITCHEN_VIEW") || onlineOrdersLoading.current)
      return;
    onlineOrdersLoading.current = true;
    try {
      const queue = await apiFetch<KitchenQueueResponse>("/kitchen/orders", {
        cache: "no-store",
        signal: AbortSignal.timeout(10000),
      });
      setNewOnlineOrders(
        queue.items.filter(
          (ticket) =>
            ticket.status === "NEW" &&
            (ticket.order.source === "WEB" ||
              ticket.order.source === "TELEGRAM"),
        ).length,
      );
      setOnlineOrdersError(false);
    } catch {
      setOnlineOrdersError(true);
    } finally {
      onlineOrdersLoading.current = false;
    }
  }, [user]);

  useEffect(() => {
    void loadOnlineOrders();
    const refresh = () => void loadOnlineOrders();
    const timer = window.setInterval(refresh, 5000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [loadOnlineOrders]);

  const onlineChime = useKitchenChime({
    soundOn: true,
    alerting: newOnlineOrders > 0,
  });

  const realtimeState = useStaffRealtime({
    accessToken: session?.tokens.accessToken,
    cursorScope: (user?.id ?? "staff") + ":pos",
    bootstrapSnapshot: true,
    onEvent: () => {
      void loadOnlineOrders();
      return loadTerminal();
    },
  });

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
  const availablePaymentMethods = catalog?.paymentMethods;
  const paymentMethods =
    availablePaymentMethods === undefined
      ? fallbackPaymentMethods
      : availablePaymentMethods
          .filter((method) => !catalogOffline || method.code === cashMethodCode)
          .map((method) => ({
            ...method,
            name: paymentMethodLabel(method.code),
          }));
  const isCashPayment = paymentCode === cashMethodCode;
  const tables = catalog?.tables ?? [];
  const isDineIn = orderType === "DINE_IN";
  const deferPayment = isDineIn && payLater;
  /*
   * Yuborish sharti to'lov usuliga QARAB o'zgaradi: naqd bo'lmaganda
   * "qabul qilingan naqd" degan tushuncha yo'q, shuning uchun uni talab
   * qilish kartani bloklab qo'yardi.
   */
  const canSubmit =
    cart.length > 0 &&
    (deferPayment ||
      (paymentMethods.length > 0 && (!isCashPayment || validCash)));

  /*
   * Server tanlagan usulni bilmasa (masalan sozlamadan o'chirilgan),
   * mavjud birinchisiga o'tiladi — aks holda kassir yo'q usul bilan
   * yuborib, faqat serverdan xato olardi.
   */
  useEffect(() => {
    if (paymentMethods.some((method) => method.code === paymentCode)) return;
    setPaymentCode(paymentMethods[0]?.code ?? "");
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
        deferPayment,
        tableId: isDineIn ? tableId : null,
        paymentCode: deferPayment ? null : paymentCode,
        cashReceived: !deferPayment && isCashPayment ? received : null,
        total,
        items: cart.map((line) => [
          line.product.id,
          line.variant?.id ?? null,
          line.quantity,
          line.modifiers.map((modifier) => modifier.modifier.id).sort(),
        ]),
      }),
    [
      orderType,
      deferPayment,
      tableId,
      isDineIn,
      paymentCode,
      isCashPayment,
      received,
      cart,
    ],
  );

  useEffect(() => {
    setCheckoutAttempt((current) =>
      current.payloadSignature === payloadSignature
        ? current
        : { key: createCheckoutKey(), payloadSignature },
    );
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
    let draft: ReturnType<typeof parsePosCheckoutDraft> = null;
    try {
      const raw = window.sessionStorage.getItem(cartStorageKey(shiftId));
      if (raw) draft = parsePosCheckoutDraft(raw);
    } catch {
      // Buzilgan yozuv savatni bloklamasligi kerak — bo'sh savat bilan boshlanadi.
      return;
    }
    if (!draft) return;

    setOrderType(draft.orderType);
    setPayLater(draft.payLater);
    setTableId(draft.tableId);
    setPaymentCode(draft.paymentCode);
    setCashReceived(draft.cashReceived);
    if (draft.checkoutAttempt) setCheckoutAttempt(draft.checkoutAttempt);
    const restored = draft.lines.flatMap((line) => {
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
    if (restored.length) {
      draftRestorePending.current = shiftId;
      setCart(restored);
    }
  }, [catalog, currentShift?.id]);

  useEffect(() => {
    const shiftId = currentShift?.id;
    if (!shiftId || cartRestored.current !== shiftId) return;
    if (draftRestorePending.current === shiftId) {
      draftRestorePending.current = null;
      return;
    }
    const key = cartStorageKey(shiftId);
    try {
      if (!cart.length) {
        window.sessionStorage.removeItem(key);
        return;
      }
      if (checkoutAttempt.payloadSignature !== payloadSignature) return;
      window.sessionStorage.setItem(
        key,
        serializePosCheckoutDraft({
          lines: cart.map((line) => ({
            key: line.key,
            productId: line.product.id,
            variantId: line.variant?.id ?? null,
            modifierIds: line.modifiers.map((modifier) => modifier.modifier.id),
            quantity: line.quantity,
          })),
          checkoutAttempt: {
            key: checkoutAttempt.key,
            payloadSignature: checkoutAttempt.payloadSignature,
          },
          orderType,
          payLater,
          tableId: isDineIn ? tableId : "",
          paymentCode,
          cashReceived,
        }),
      );
    } catch {
      // Xotira to'lgan bo'lsa sotuvni to'xtatmaslik kerak.
    }
  }, [
    cart,
    currentShift?.id,
    checkoutAttempt,
    payloadSignature,
    orderType,
    payLater,
    tableId,
    paymentCode,
    cashReceived,
  ]);

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
    setSuccess(null);
  }

  function openCheckout() {
    if (!cart.length || isSubmitting) return;
    setError(null);
    if (!deferPayment && isCashPayment && !cashReceived)
      setCashReceived(String(total));
    setCheckoutOpen(true);
  }

  async function submitOrder() {
    if (submissionLock.current) return;
    setError(null);
    if (!cart.length) {
      setError("Buyurtma bo'sh");
      return;
    }
    if (!deferPayment && isCashPayment && !validCash) {
      setError("Qabul qilingan naqd summani tekshiring");
      return;
    }
    submissionLock.current = true;
    setIsSubmitting(true);
    const attempt =
      checkoutAttempt.payloadSignature === payloadSignature
        ? checkoutAttempt
        : { key: createCheckoutKey(), payloadSignature };
    setCheckoutAttempt(attempt);
    try {
      if (currentShift?.id) {
        try {
          window.sessionStorage.setItem(
            cartStorageKey(currentShift.id),
            serializePosCheckoutDraft({
              lines: cart.map((line) => ({
                key: line.key,
                productId: line.product.id,
                variantId: line.variant?.id ?? null,
                modifierIds: line.modifiers.map(
                  (modifier) => modifier.modifier.id,
                ),
                quantity: line.quantity,
              })),
              checkoutAttempt: {
                key: attempt.key,
                payloadSignature,
              },
              orderType,
              payLater,
              tableId: isDineIn ? tableId : "",
              paymentCode,
              cashReceived,
            }),
          );
        } catch {
          // Sessiya xotirasi sotuvni to'xtatmasligi kerak.
        }
      }
      const result = await apiFetch<PosOrderResult>("/pos/orders", {
        method: "POST",
        signal: AbortSignal.timeout(20000),
        body: JSON.stringify({
          idempotencyKey: attempt.key,
          type: orderType,
          payLater: deferPayment,
          offlineEstimatedTotal: total,
          ...(isDineIn && tableId ? { tableId } : {}),
          /*
           * Bo'lak summasi buyurtma summasiga TENG yuboriladi. Mijoz
           * bergan ortiqcha naqd `cashReceived` da qoladi va qaytim
           * sifatida qaytariladi — ortiqcha pul daromad deb yozilmaydi.
           */
          ...(!deferPayment
            ? { payments: [{ paymentMethodCode: paymentCode, amount: total }] }
            : {}),
          ...(!deferPayment && isCashPayment ? { cashReceived: received } : {}),
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
      setSuccess({ ...result, payLater: deferPayment });
      setCart([]);
      setPayLater(false);
      setCashReceived("");
      setTableId("");
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
      sidebar
      actions={<CashierWorkspaceNavigation user={user} />}
    >
      <div className={styles.overview}>
        <h2 className={styles.pageHeading}>Buyurtma qabul qilish</h2>
        <StaffSync
          updatedAt={lastUpdatedAt}
          connectionState={realtimeState}
          error={Boolean(error)}
          refreshing={isCheckingShift || isSubmitting}
          onRefresh={() => void loadTerminal()}
        />
      </div>
      {hasPermission(user, "KITCHEN_VIEW") &&
      (newOnlineOrders > 0 || onlineOrdersError) ? (
        <div className={styles.posOnlineAlert} role="status">
          <BellRing size={20} aria-hidden="true" />
          <strong>
            {onlineOrdersError
              ? "Onlayn buyurtmalar navbatini tekshirib bo'lmadi"
              : `${newOnlineOrders} ta yangi onlayn buyurtma`}
          </strong>
          {newOnlineOrders > 0 && !onlineChime.unlocked ? (
            <button
              className={styles.button}
              onClick={onlineChime.unlock}
              type="button"
            >
              Ovozni yoqish
            </button>
          ) : null}
          <button
            className={styles.button}
            onClick={() => router.push("/kitchen")}
            type="button"
          >
            Oshxonani ochish
          </button>
        </div>
      ) : null}
      {catalog && !isCheckingShift ? (
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
      ) : null}
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
          title={isDineIn ? "Zal buyurtmasi" : "Olib ketish va to'lov"}
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
                  aria-pressed={isDineIn}
                  disabled={isSubmitting}
                  onClick={() => setOrderType("DINE_IN")}
                  type="button"
                >
                  <Utensils size={16} />
                  Zal
                </button>
                <button
                  className={styles.segment}
                  aria-pressed={orderType === "TAKEAWAY"}
                  disabled={isSubmitting}
                  onClick={() => {
                    setOrderType("TAKEAWAY");
                    setPayLater(false);
                    if (!cashReceived) setCashReceived(String(total));
                  }}
                  type="button"
                >
                  <ShoppingBag size={16} />
                  Olib ketish
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
              {isDineIn ? (
                <div className={styles.checkoutSheetSection}>
                  <span className={styles.checkoutLabel}>
                    To'lov qachon olinadi?
                  </span>
                  <div
                    className={styles.segments}
                    role="group"
                    aria-label="To'lov vaqti"
                  >
                    <button
                      aria-pressed={!payLater}
                      className={styles.segment}
                      disabled={isSubmitting}
                      onClick={() => {
                        setPayLater(false);
                        if (!cashReceived) setCashReceived(String(total));
                      }}
                      type="button"
                    >
                      Hozir to'lash
                    </button>
                    <button
                      aria-pressed={payLater}
                      className={styles.segment}
                      disabled={isSubmitting}
                      onClick={() => setPayLater(true)}
                      type="button"
                    >
                      Chiqishda to'lash
                    </button>
                  </div>
                </div>
              ) : null}
              {deferPayment ? (
                <p className={styles.muted}>
                  Hozir faqat oshxona cheki chiqadi. Mijoz chiqayotganda to'lov
                  kassada qabul qilinadi.
                </p>
              ) : null}
            </div>

            {!deferPayment && paymentMethods.length > 0 ? (
              <div className={styles.checkoutSheetSection}>
                <span className={styles.checkoutLabel}>To'lov turi</span>
                {paymentMethods.length === 1 ? (
                  <strong>{paymentMethodLabel(paymentCode)}</strong>
                ) : (
                  <select
                    aria-label="To'lov turi"
                    className={styles.input}
                    disabled={isSubmitting}
                    onChange={(event) => setPaymentCode(event.target.value)}
                    value={paymentCode}
                  >
                    {paymentMethods.map((method) => (
                      <option key={method.code} value={method.code}>
                        {method.name}
                      </option>
                    ))}
                  </select>
                )}
                {!isCashPayment ? (
                  <p className={styles.note}>
                    Naqd bo'lmagan to'lovni terminal yoki bank SMSidan
                    tekshiring. Tizim to'lovni provayder orqali avtomatik
                    tasdiqlamaydi.
                  </p>
                ) : null}
              </div>
            ) : null}
            {!deferPayment && paymentMethods.length === 0 ? (
              <p className={styles.pendingSync} role="alert">
                Hozir internet uzilgan va naqd to'lov usuli yoqilmagan. Smena
                buyurtmasini to'lov usuli mavjud bo'lganda qabul qiling.
              </p>
            ) : null}

            {!deferPayment && isCashPayment && (
              <div className={styles.checkoutSheetSection}>
                <label className={styles.field}>
                  <span>Qabul qilingan naqd pul</span>
                  <input
                    className={styles.input}
                    inputMode="numeric"
                    type="text"
                    maxLength={12}
                    pattern="[0-9]*"
                    placeholder="0"
                    disabled={isSubmitting}
                    value={cashReceived}
                    onChange={(event) =>
                      setCashReceived(sanitizeCashInput(event.target.value))
                    }
                  />
                </label>
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
                {deferPayment ? <Utensils size={19} /> : <Banknote size={19} />}
                {isSubmitting
                  ? "Tasdiqlanmoqda..."
                  : deferPayment
                    ? "Oshxonaga yuborish"
                    : "To'lov va buyurtmani tasdiqlash"}
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
          title={
            success.offlineQueued
              ? "Buyurtma qurilmada saqlandi"
              : "Buyurtma qabul qilindi"
          }
          onClose={() => setSuccess(null)}
        >
          <p className={styles.ticketNumber}>
            #{success.order.displayOrderNumber ?? success.order.orderNumber}
          </p>
          {success.offlineQueued ? (
            <div className={styles.pendingSync} role="status">
              {success.payLater
                ? "Internet ulanmagani sababli buyurtma va oshxona cheki qurilmadagi navbatga saqlandi. To'lovni sinxronlangandan keyin qabul qiling."
                : "Internet ulanmagani sababli buyurtma va chek qurilmadagi navbatga saqlandi. Serverga internet tiklangach avtomatik yuboriladi."}
            </div>
          ) : null}
          {success.payLater ? (
            <p className={styles.muted} role="status">
              To'lov hali olinmadi. Mijoz chiqayotganda kassada qabul qiling.
            </p>
          ) : (
            <div className={styles.change} role="status">
              <span>Qaytim</span>
              <strong>{money(success.payment.change)}</strong>
            </div>
          )}
          <div className={styles.totalRow}>
            <span>Buyurtma summasi</span>
            <strong>{money(success.order.total)}</strong>
          </div>
          <div className={styles.dialogActions}>
            {success.payLater && !success.offlineQueued && success.order.id ? (
              <button
                className={styles.button}
                onClick={() =>
                  router.push(
                    `/pos/payment?orderId=${encodeURIComponent(success.order.id!)}`,
                  )
                }
                type="button"
              >
                <Banknote size={18} />
                To'lovlar
              </button>
            ) : null}
            {success.order.receipts?.find(
              (receipt) =>
                receipt.documentType === "RECEIPT" || !receipt.documentType,
            )?.id ? (
              <button
                className={styles.button}
                onClick={() =>
                  router.push(
                    `/pos/receipt/${success.order.receipts!.find((receipt) => receipt.documentType === "RECEIPT" || !receipt.documentType)!.id}`,
                  )
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
