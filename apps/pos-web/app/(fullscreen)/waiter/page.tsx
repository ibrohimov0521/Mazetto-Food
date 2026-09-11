"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import {
  ChefHat,
  LayoutGrid,
  ReceiptText,
  Trash2,
  Utensils,
} from "lucide-react";
import { PermissionGuard } from "../../../components/auth/permission-guard";
import { RoleGuard } from "../../../components/auth/role-guard";
import { useAuth } from "../../../components/auth/auth-provider";
import {
  StaffDialog,
  StaffShell,
  StaffSync,
} from "../../../components/staff/staff-shell";
import styles from "../../../components/staff/staff.module.css";
import { ItemDialog } from "../../../components/waiter/item-dialog";
import { MenuPicker } from "../../../components/waiter/menu-picker";
import {
  OrderPanel,
  type WaiterAction,
} from "../../../components/waiter/order-panel";
import { TableMap } from "../../../components/waiter/table-map";
import {
  activeLines,
  canRequestPayment,
  canSendToKitchen,
  defaultVariant,
  isOrderEditable,
  lineModifierIds,
  lineQuantity,
  lineSubtitle,
  maxGuestCount,
  maxLineQuantity,
  orderLabel,
  totalQuantity,
  type LineDraft,
  type MenuCategory,
  type MenuProduct,
  type OrderLine,
  type TableOrder,
  type WaiterTable,
} from "../../../components/waiter/waiter-model";
import { apiFetch, SessionExpiredError } from "../../../lib/api";
import { getApiBaseUrl } from "../../../lib/auth";
import { formatMoney } from "../../../lib/order-display";
import { readSession } from "../../../lib/session";

type Confirmation =
  | { kind: "kitchen" }
  | { kind: "payment" }
  | { kind: "remove"; line: OrderLine };

const removeReason = "Ofitsiant qatorni o'chirdi";

export default function WaiterPage() {
  return (
    <RoleGuard roles={["WAITER", "SUPER_ADMIN", "BRANCH_MANAGER"]}>
      <PermissionGuard permission="TABLE_VIEW">
        <StaffShell title="Ofitsiant">
          <WaiterFloor />
        </StaffShell>
      </PermissionGuard>
    </RoleGuard>
  );
}

function WaiterFloor() {
  const { user, logout } = useAuth();
  const [tables, setTables] = useState<WaiterTable[]>([]);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [products, setProducts] = useState<MenuProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);

  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [tableDetail, setTableDetail] = useState<WaiterTable | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);

  const [pane, setPane] = useState<"tables" | "menu">("tables");
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState("ALL");
  const [guestCount, setGuestCount] = useState(2);
  const [openNote, setOpenNote] = useState("");

  const [addTarget, setAddTarget] = useState<MenuProduct | null>(null);
  const [editTarget, setEditTarget] = useState<OrderLine | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);

  const [pendingAction, setPendingAction] = useState<WaiterAction | null>(null);
  const [busyLineId, setBusyLineId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);

  const actionLock = useRef(false);
  const floorRequest = useRef<AbortController | null>(null);
  const floorVersion = useRef(0);
  const detailRequest = useRef<AbortController | null>(null);
  const detailVersion = useRef(0);
  const asideRef = useRef<HTMLElement | null>(null);
  const selectedTableRef = useRef<string | null>(null);
  const branchQuery = user?.branchId
    ? `?branchId=${encodeURIComponent(user.branchId)}`
    : "";

  const loadFloor = useCallback(async () => {
    floorRequest.current?.abort();
    const controller = new AbortController();
    floorRequest.current = controller;
    const version = ++floorVersion.current;
    setIsRefreshing(true);
    try {
      const signal = AbortSignal.any([
        controller.signal,
        AbortSignal.timeout(15000),
      ]);
      const [nextTables, nextCategories, nextProducts] = await Promise.all([
        apiFetch<WaiterTable[]>(`/tables${branchQuery}`, {
          cache: "no-store",
          signal,
        }),
        apiFetch<MenuCategory[]>(`/menu/categories${branchQuery}`, { signal }),
        apiFetch<MenuProduct[]>(`/menu/products${branchQuery}`, { signal }),
      ]);

      if (version !== floorVersion.current) {
        return;
      }

      setTables(nextTables);
      setCategories(nextCategories);
      setProducts(nextProducts);
      setLoadError(null);
      setLastUpdatedAt(new Date());
    } catch (caught) {
      if (version !== floorVersion.current) {
        return;
      }

      if (caught instanceof SessionExpiredError) {
        void logout();
        return;
      }

      setLoadError(
        caught instanceof Error
          ? caught.message
          : "Zal ma'lumotlarini yuklab bo'lmadi.",
      );
    } finally {
      if (floorRequest.current === controller) {
        floorRequest.current = null;
      }

      if (version === floorVersion.current) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  }, [branchQuery, logout]);

  /*
   * `GET /tables` har stolda FAQAT eng yangi ochiq buyurtmani qaytaradi
   * (`take: 1`). `GET /tables/:id` esa barchasini beradi — shuning uchun
   * tanlangan stol alohida yuklanadi va bir nechta ochiq buyurtma bo'lsa
   * ofitsiant ular orasidan tanlaydi.
   */
  const loadTableDetail = useCallback(
    async (tableId: string) => {
      detailRequest.current?.abort();
      const controller = new AbortController();
      detailRequest.current = controller;
      const version = ++detailVersion.current;
      try {
        const detail = await apiFetch<WaiterTable>(`/tables/${tableId}`, {
          cache: "no-store",
          signal: AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(15000),
          ]),
        });

        if (version !== detailVersion.current) {
          return;
        }

        setTableDetail(detail);
        setDetailError(null);
      } catch (caught) {
        if (version !== detailVersion.current) {
          return;
        }

        if (caught instanceof SessionExpiredError) {
          void logout();
          return;
        }

        setTableDetail(null);
        setDetailError(
          "Stol tafsilotlari yangilanmadi — ro'yxatdagi ma'lumot ko'rsatilmoqda.",
        );
      } finally {
        if (detailRequest.current === controller) {
          detailRequest.current = null;
        }
      }
    },
    [logout],
  );

  useEffect(() => {
    void loadFloor();

    return () => {
      floorVersion.current += 1;
      floorRequest.current?.abort();
      floorRequest.current = null;
    };
  }, [loadFloor]);

  useEffect(() => {
    selectedTableRef.current = selectedTableId;

    if (!selectedTableId) {
      setTableDetail(null);
      setDetailError(null);
      return;
    }

    void loadTableDetail(selectedTableId);

    return () => {
      detailVersion.current += 1;
      detailRequest.current?.abort();
      detailRequest.current = null;
    };
  }, [loadTableDetail, selectedTableId]);

  useEffect(() => {
    const session = readSession();

    if (!session) {
      return;
    }

    const socket = io(getSocketBaseUrl(), {
      auth: { token: session.tokens.accessToken, tokenType: "staff" },
      transports: ["websocket"],
    });
    const refresh = () => {
      if (actionLock.current) {
        return;
      }

      void loadFloor();

      const tableId = selectedTableRef.current;

      if (tableId) {
        void loadTableDetail(tableId);
      }
    };

    socket.on("order.sent_to_kitchen", refresh);
    socket.on("order.status_changed", refresh);

    return () => {
      socket.disconnect();
    };
  }, [loadFloor, loadTableDetail]);

  const selectedTable = useMemo(
    () => tables.find((table) => table.id === selectedTableId) ?? null,
    [selectedTableId, tables],
  );
  const detailMatches = tableDetail?.id === selectedTableId;
  const panelTable = (detailMatches ? tableDetail : selectedTable) ?? null;
  const openOrders = useMemo(() => {
    const source = detailMatches
      ? (tableDetail?.orders ?? [])
      : (selectedTable?.orders ?? []);

    return [...source].sort((left, right) =>
      right.createdAt.localeCompare(left.createdAt),
    );
  }, [detailMatches, selectedTable, tableDetail]);
  const currentOrder: TableOrder | null =
    openOrders.find((order) => order.id === selectedOrderId) ??
    openOrders[0] ??
    null;
  const menuEnabled = Boolean(currentOrder && isOrderEditable(currentOrder));
  const productById = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products],
  );
  const filteredProducts = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    return products.filter(
      (product) =>
        (categoryId === "ALL" || product.categoryId === categoryId) &&
        (!normalized || product.name.toLowerCase().includes(normalized)),
    );
  }, [categoryId, products, query]);
  const usedCategories = useMemo(
    () =>
      categories.filter((category) =>
        products.some((product) => product.categoryId === category.id),
      ),
    [categories, products],
  );

  useEffect(() => {
    if (pane === "menu" && !menuEnabled) {
      setPane("tables");
    }
  }, [menuEnabled, pane]);

  const refreshAfterAction = useCallback(async () => {
    await Promise.all([
      loadFloor(),
      selectedTableId ? loadTableDetail(selectedTableId) : Promise.resolve(),
    ]);
  }, [loadFloor, loadTableDetail, selectedTableId]);

  const runAction = useCallback(
    async (
      kind: WaiterAction,
      request: () => Promise<unknown>,
      fallback: string,
      options?: { lineId?: string; inDialog?: boolean },
    ): Promise<boolean> => {
      if (actionLock.current) {
        return false;
      }

      actionLock.current = true;
      setPendingAction(kind);
      setBusyLineId(options?.lineId ?? null);
      setActionError(null);
      setDialogError(null);
      try {
        await request();
        await refreshAfterAction();
        return true;
      } catch (caught) {
        if (caught instanceof SessionExpiredError) {
          void logout();
          return false;
        }

        const message = caught instanceof Error ? caught.message : fallback;

        if (options?.inDialog) {
          setDialogError(message);
        } else {
          setActionError(message);
        }

        return false;
      } finally {
        actionLock.current = false;
        setPendingAction(null);
        setBusyLineId(null);
      }
    },
    [logout, refreshAfterAction],
  );

  function selectTable(tableId: string) {
    setSelectedTableId(tableId);
    setSelectedOrderId(null);
    setActionError(null);
    setOpenNote("");
    setGuestCount(2);
  }

  async function openTable() {
    if (!panelTable) {
      return;
    }

    const note = openNote.trim();
    const created = await runAction(
      "open",
      () =>
        apiFetch<{ id: string }>(`/tables/${panelTable.id}/orders`, {
          method: "POST",
          signal: AbortSignal.timeout(15000),
          body: JSON.stringify({
            guestCount,
            ...(note ? { notes: note } : {}),
          }),
        }),
      "Stolni ochib bo'lmadi.",
    );

    if (created) {
      setOpenNote("");
      setSelectedOrderId(null);
      setPane("menu");
    }
  }

  async function addLine(product: MenuProduct, draft: LineDraft) {
    if (!currentOrder) {
      return;
    }

    const added = await runAction(
      "line",
      () =>
        apiFetch(`/orders/${currentOrder.id}/items`, {
          method: "POST",
          signal: AbortSignal.timeout(15000),
          body: JSON.stringify({
            productId: product.id,
            ...(draft.variantId ? { variantId: draft.variantId } : {}),
            quantity: draft.quantity,
            modifiers: draft.modifierIds.map((modifierId) => ({
              modifierId,
              quantity: 1,
            })),
            ...(draft.notes.trim() ? { notes: draft.notes.trim() } : {}),
          }),
        }),
      "Mahsulot qo'shilmadi.",
      { inDialog: true },
    );

    if (added) {
      setAddTarget(null);
    }
  }

  async function saveLine(line: OrderLine, draft: LineDraft) {
    if (!currentOrder) {
      return;
    }

    const product = line.productId
      ? (productById.get(line.productId) ?? null)
      : null;
    const currentModifierIds = lineModifierIds(line);
    const modifiersChanged =
      product !== null &&
      (currentModifierIds.length !== draft.modifierIds.length ||
        currentModifierIds.some((id) => !draft.modifierIds.includes(id)));
    const saved = await runAction(
      "line",
      () =>
        apiFetch(`/orders/${currentOrder.id}/items/${line.id}`, {
          method: "PATCH",
          signal: AbortSignal.timeout(15000),
          body: JSON.stringify({
            quantity: draft.quantity,
            notes: draft.notes.trim(),
            ...(modifiersChanged
              ? {
                  modifiers: draft.modifierIds.map((modifierId) => ({
                    modifierId,
                    quantity: 1,
                  })),
                }
              : {}),
          }),
        }),
      "Qator saqlanmadi.",
      { lineId: line.id, inDialog: true },
    );

    if (saved) {
      setEditTarget(null);
    }
  }

  function changeLineQuantity(line: OrderLine, delta: number) {
    if (!currentOrder) {
      return;
    }

    const next = lineQuantity(line) + delta;

    if (next < 1) {
      setConfirmation({ kind: "remove", line });
      return;
    }

    if (next > maxLineQuantity) {
      return;
    }

    void runAction(
      "line",
      () =>
        apiFetch(`/orders/${currentOrder.id}/items/${line.id}`, {
          method: "PATCH",
          signal: AbortSignal.timeout(15000),
          body: JSON.stringify({ quantity: next }),
        }),
      "Sonni o'zgartirib bo'lmadi.",
      { lineId: line.id },
    );
  }

  async function removeLine(line: OrderLine) {
    if (!currentOrder) {
      return;
    }

    const removed = await runAction(
      "line",
      () =>
        apiFetch(`/orders/${currentOrder.id}/items/${line.id}`, {
          method: "PATCH",
          signal: AbortSignal.timeout(15000),
          body: JSON.stringify({
            status: "CANCELLED",
            cancellationReason: removeReason,
          }),
        }),
      "Qatorni o'chirib bo'lmadi.",
      { lineId: line.id },
    );

    if (removed) {
      setConfirmation(null);
    }
  }

  async function changeOrderStatus(kind: "kitchen" | "payment") {
    if (!currentOrder) {
      return;
    }

    const changed = await runAction(
      kind,
      () =>
        apiFetch(`/orders/${currentOrder.id}/status`, {
          method: "PATCH",
          signal: AbortSignal.timeout(20000),
          body: JSON.stringify(
            kind === "kitchen"
              ? {
                  status: "CONFIRMED",
                  reason: "Ofitsiant buyurtmani oshxonaga yubordi",
                }
              : { status: "SERVED", reason: "Ofitsiant hisob so'radi" },
          ),
        }),
      kind === "kitchen"
        ? "Buyurtmani oshxonaga yuborib bo'lmadi."
        : "Hisob so'rovini yuborib bo'lmadi.",
    );

    if (changed) {
      setConfirmation(null);

      if (kind === "kitchen") {
        setPane("tables");
      }
    }
  }

  function scrollToOrder() {
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    asideRef.current?.scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "start",
    });
  }

  const editProduct = editTarget?.productId
    ? (productById.get(editTarget.productId) ?? null)
    : null;
  const busy = pendingAction !== null;

  return (
    <div className={`${styles.content} ${styles.waiterWorkspace}`}>
      <div className={styles.overview}>
        <h1 className={styles.pageHeading}>Zal va buyurtmalar</h1>
        <StaffSync
          error={Boolean(loadError)}
          updatedAt={lastUpdatedAt}
          refreshing={isRefreshing}
          onRefresh={() => void loadFloor()}
        />
      </div>

      {loadError && tables.length > 0 && (
        <div className={styles.error} role="alert">
          {loadError}
          <button
            className={styles.button}
            disabled={isRefreshing}
            onClick={() => void loadFloor()}
            type="button"
          >
            Qayta urinish
          </button>
        </div>
      )}

      {isLoading ? (
        <div className={styles.waiterLoading} aria-busy="true">
          <p className={styles.waiterHint}>Zal yuklanmoqda...</p>
          <div className={styles.skeleton} />
          <div className={styles.skeleton} />
        </div>
      ) : loadError && tables.length === 0 ? (
        <div className={styles.error} role="alert">
          {loadError}
          <button
            className={styles.button}
            disabled={isRefreshing}
            onClick={() => void loadFloor()}
            type="button"
          >
            Qayta urinish
          </button>
        </div>
      ) : (
        <div className={styles.waiterBody}>
          <div className={styles.waiterMain}>
            <div
              className={`${styles.segments} ${styles.waiterViewNav}`}
              role="group"
              aria-label="Ko'rinish"
            >
              <button
                className={styles.segment}
                aria-pressed={pane === "tables"}
                onClick={() => setPane("tables")}
                type="button"
              >
                <LayoutGrid size={17} aria-hidden="true" />
                Stollar
              </button>
              <button
                className={styles.segment}
                aria-pressed={pane === "menu"}
                disabled={!menuEnabled}
                title={
                  menuEnabled
                    ? "Menyu"
                    : "Menyu uchun avval stolni ochish kerak"
                }
                onClick={() => setPane("menu")}
                type="button"
              >
                <Utensils size={17} aria-hidden="true" />
                Menyu
              </button>
            </div>

            {pane === "tables" ? (
              <TableMap
                tables={tables}
                selectedTableId={selectedTableId}
                disabled={busy}
                onSelect={selectTable}
              />
            ) : (
              <MenuPicker
                categories={usedCategories}
                products={filteredProducts}
                query={query}
                categoryId={categoryId}
                disabled={busy}
                onQueryChange={setQuery}
                onCategoryChange={setCategoryId}
                onSelect={setAddTarget}
              />
            )}
          </div>

          <aside
            className={styles.waiterAside}
            aria-label="Joriy buyurtma"
            ref={asideRef}
          >
            <OrderPanel
              table={panelTable}
              orders={openOrders}
              order={currentOrder}
              detailError={detailError}
              guestCount={guestCount}
              openNote={openNote}
              pendingAction={pendingAction}
              busyLineId={busyLineId}
              actionError={actionError}
              onSelectOrder={setSelectedOrderId}
              onGuestCountChange={(next) =>
                setGuestCount(Math.min(maxGuestCount, Math.max(1, next)))
              }
              onOpenNoteChange={setOpenNote}
              onOpenTable={() => void openTable()}
              onGoToMenu={() => setPane("menu")}
              onEditLine={setEditTarget}
              onChangeQuantity={changeLineQuantity}
              onRemoveLine={(line) => setConfirmation({ kind: "remove", line })}
              onSendKitchen={() => setConfirmation({ kind: "kitchen" })}
              onRequestPayment={() => setConfirmation({ kind: "payment" })}
            />
          </aside>
        </div>
      )}

      {currentOrder && (
        <div className={styles.mobilePaybar}>
          <div>
            <small>{totalQuantity(currentOrder)} ta mahsulot</small>
            <strong>{formatMoney(currentOrder.total)}</strong>
          </div>
          <button
            className={styles.primary}
            onClick={scrollToOrder}
            type="button"
          >
            <ReceiptText size={18} aria-hidden="true" />
            Buyurtma
          </button>
        </div>
      )}

      {addTarget && (
        <ItemDialog
          title={addTarget.name}
          product={addTarget}
          initial={{
            variantId: defaultVariant(addTarget)?.id ?? null,
            modifierIds: addTarget.modifiers
              .filter((entry) => entry.isRequired)
              .map((entry) => entry.modifier.id),
            quantity: 1,
            notes: "",
          }}
          allowVariantChange
          variantName={null}
          fallbackUnitPrice={addTarget.sellingPrice}
          submitLabel="Qo'shish"
          busy={busy}
          error={dialogError}
          onClose={() => {
            setAddTarget(null);
            setDialogError(null);
          }}
          onSubmit={(draft) => void addLine(addTarget, draft)}
        />
      )}

      {editTarget && (
        <ItemDialog
          title={editTarget.productName}
          product={editProduct}
          initial={{
            variantId: editTarget.variantId,
            modifierIds: lineModifierIds(editTarget),
            quantity: lineQuantity(editTarget),
            notes: editTarget.notes ?? "",
          }}
          allowVariantChange={false}
          variantName={editTarget.variantName ?? null}
          fallbackUnitPrice={editTarget.unitPrice}
          submitLabel="Saqlash"
          busy={busy}
          error={dialogError}
          onClose={() => {
            setEditTarget(null);
            setDialogError(null);
          }}
          onSubmit={(draft) => void saveLine(editTarget, draft)}
        />
      )}

      {confirmation?.kind === "remove" && (
        <StaffDialog
          title="Qatorni o'chirish"
          busy={busy}
          onClose={() => setConfirmation(null)}
        >
          <p className={styles.waiterHint}>
            <strong>{confirmation.line.productName}</strong> (
            {lineQuantity(confirmation.line)} ta) buyurtmadan o&apos;chiriladi.
            Summa qayta hisoblanadi.
          </p>
          {actionError && (
            <p className={styles.error} role="alert">
              {actionError}
            </p>
          )}
          <div className={styles.dialogActions}>
            <button
              className={styles.button}
              disabled={busy}
              onClick={() => setConfirmation(null)}
              type="button"
            >
              Bekor qilish
            </button>
            <button
              className={styles.danger}
              disabled={busy}
              onClick={() => void removeLine(confirmation.line)}
              type="button"
            >
              <Trash2 size={18} aria-hidden="true" />
              {busy ? "O'chirilmoqda..." : "O'chirish"}
            </button>
          </div>
        </StaffDialog>
      )}

      {confirmation?.kind === "kitchen" && currentOrder && (
        <StaffDialog
          title="Oshxonaga yuborish"
          busy={busy}
          onClose={() => setConfirmation(null)}
        >
          <p className={styles.waiterHint}>
            #{orderLabel(currentOrder)} · {panelTable?.name ?? ""} — quyidagilar
            oshxonaga yuboriladi:
          </p>
          <ul className={styles.confirmList}>
            {activeLines(currentOrder).map((line) => (
              <li key={line.id}>
                <span className={styles.itemQuantity}>
                  {lineQuantity(line)}
                </span>
                <span className={styles.itemName}>
                  {line.productName}
                  {lineSubtitle(line) && <small>{lineSubtitle(line)}</small>}
                  {line.notes && <small>Izoh: {line.notes}</small>}
                </span>
                <strong className={styles.waiterLineTotal}>
                  {formatMoney(line.totalPrice)}
                </strong>
              </li>
            ))}
          </ul>
          <div className={styles.totalRow}>
            <span>Jami</span>
            <strong>{formatMoney(currentOrder.total)}</strong>
          </div>
          <p className={`${styles.note} ${styles.waiterNote}`}>
            Yuborilgandan keyin bu buyurtmani qayta yuborish mumkin emas.
          </p>
          {actionError && (
            <p className={styles.error} role="alert">
              {actionError}
            </p>
          )}
          <div className={styles.dialogActions}>
            <button
              className={styles.button}
              disabled={busy}
              onClick={() => setConfirmation(null)}
              type="button"
            >
              Bekor qilish
            </button>
            <button
              className={styles.primary}
              disabled={busy || !canSendToKitchen(currentOrder)}
              onClick={() => void changeOrderStatus("kitchen")}
              type="button"
            >
              <ChefHat size={18} aria-hidden="true" />
              {busy ? "Yuborilmoqda..." : "Tasdiqlash va yuborish"}
            </button>
          </div>
        </StaffDialog>
      )}

      {confirmation?.kind === "payment" && currentOrder && (
        <StaffDialog
          title="Hisob so'rash"
          busy={busy}
          onClose={() => setConfirmation(null)}
        >
          <p className={styles.waiterHint}>
            #{orderLabel(currentOrder)} · {panelTable?.name ?? ""} buyurtmasi
            &quot;Berildi&quot; holatiga o&apos;tadi va kassir to&apos;lovni
            yakunlaydi.
          </p>
          <div className={styles.totalRow}>
            <span>To&apos;lov summasi</span>
            <strong>{formatMoney(currentOrder.total)}</strong>
          </div>
          {actionError && (
            <p className={styles.error} role="alert">
              {actionError}
            </p>
          )}
          <div className={styles.dialogActions}>
            <button
              className={styles.button}
              disabled={busy}
              onClick={() => setConfirmation(null)}
              type="button"
            >
              Bekor qilish
            </button>
            <button
              className={styles.secondary}
              disabled={busy || !canRequestPayment(currentOrder)}
              onClick={() => void changeOrderStatus("payment")}
              type="button"
            >
              <ReceiptText size={18} aria-hidden="true" />
              {busy ? "Yuborilmoqda..." : "Hisobni so'rash"}
            </button>
          </div>
        </StaffDialog>
      )}
    </div>
  );
}

function getSocketBaseUrl(): string {
  return getApiBaseUrl().replace(/\/api\/v1\/?$/, "");
}
