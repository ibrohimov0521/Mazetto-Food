"use client";

import {
  ChefHat,
  ClipboardList,
  Minus,
  Pencil,
  Plus,
  ReceiptText,
  Trash2,
  TriangleAlert,
  Users,
  Utensils,
} from "lucide-react";
import { StaffEmpty } from "../staff/staff-shell";
import styles from "../staff/staff.module.css";
import {
  formatDateTime,
  formatMoney,
  orderStatusLabels,
} from "../../lib/order-display";
import {
  activeLines,
  canRequestPayment,
  canSendToKitchen,
  isOrderEditable,
  lineQuantity,
  lineSubtitle,
  maxGuestCount,
  orderLabel,
  orderTone,
  tableOpenBlockReason,
  tableStatusLabels,
  tableStatusTones,
  totalQuantity,
  type OrderLine,
  type TableOrder,
  type WaiterTable,
} from "./waiter-model";

export type WaiterAction = "open" | "line" | "kitchen" | "payment";

export function OrderPanel({
  table,
  orders,
  order,
  detailError,
  guestCount,
  openNote,
  pendingAction,
  busyLineId,
  actionError,
  onSelectOrder,
  onGuestCountChange,
  onOpenNoteChange,
  onOpenTable,
  onGoToMenu,
  onEditLine,
  onChangeQuantity,
  onRemoveLine,
  onSendKitchen,
  onRequestPayment,
}: {
  table: WaiterTable | null;
  orders: TableOrder[];
  order: TableOrder | null;
  detailError: string | null;
  guestCount: number;
  openNote: string;
  pendingAction: WaiterAction | null;
  busyLineId: string | null;
  actionError: string | null;
  onSelectOrder: (orderId: string) => void;
  onGuestCountChange: (next: number) => void;
  onOpenNoteChange: (next: string) => void;
  onOpenTable: () => void;
  onGoToMenu: () => void;
  onEditLine: (line: OrderLine) => void;
  onChangeQuantity: (line: OrderLine, delta: number) => void;
  onRemoveLine: (line: OrderLine) => void;
  onSendKitchen: () => void;
  onRequestPayment: () => void;
}) {
  if (!table) {
    return (
      <div className={styles.waiterAsideBody}>
        <StaffEmpty title="Stol tanlanmagan">
          Buyurtma ochish yoki ko&apos;rish uchun zal xaritasidan stolni
          tanlang.
        </StaffEmpty>
      </div>
    );
  }

  const busy = pendingAction !== null;
  const lines = activeLines(order);
  const blockReason = tableOpenBlockReason(table, orders);

  return (
    <>
      <div className={styles.waiterOrderHead}>
        <div className={styles.waiterOrderTitle}>
          <h2>{table.name}</h2>
          <span
            className={`${styles.badge} ${styles.tableStatus}`}
            data-tone={tableStatusTones[table.status]}
          >
            {tableStatusLabels[table.status]}
          </span>
        </div>
        <p className={styles.waiterOrderFacts}>
          <span>
            <Users size={14} aria-hidden="true" /> {table.capacity ?? 0}{" "}
            o&apos;rin
          </span>
          {table.hall?.name && <span>{table.hall.name}</span>}
        </p>
      </div>

      <div className={styles.waiterAsideBody}>
        {detailError && (
          <p className={`${styles.note} ${styles.waiterNote}`} role="alert">
            {detailError}
          </p>
        )}

        {orders.length > 1 && (
          <div className={styles.waiterOrderSwitch}>
            <p className={styles.waiterHint}>
              Bu stolda {orders.length} ta ochiq buyurtma bor:
            </p>
            <div className={styles.segments} role="group">
              {orders.map((entry) => (
                <button
                  className={styles.segment}
                  key={entry.id}
                  aria-pressed={entry.id === order?.id}
                  disabled={busy}
                  onClick={() => onSelectOrder(entry.id)}
                  type="button"
                >
                  #{orderLabel(entry)}
                </button>
              ))}
            </div>
          </div>
        )}

        {order ? (
          <>
            <dl className={styles.waiterFacts}>
              <div>
                <dt>Buyurtma</dt>
                <dd>#{orderLabel(order)}</dd>
              </div>
              <div>
                <dt>Holat</dt>
                <dd>
                  <span
                    className={`${styles.badge} ${styles.tableStatus}`}
                    data-tone={orderTone(order.status)}
                  >
                    {orderStatusLabels[order.status]}
                  </span>
                </dd>
              </div>
              <div>
                <dt>Mehmonlar</dt>
                <dd>{order.guestCount ?? "—"}</dd>
              </div>
              <div>
                <dt>Ochilgan</dt>
                <dd>{formatDateTime(order.createdAt)}</dd>
              </div>
            </dl>

            {order.notes && (
              <p className={`${styles.note} ${styles.waiterNote}`}>
                Buyurtma izohi: {order.notes}
              </p>
            )}

            {lines.length ? (
              <div className={styles.waiterLines}>
                {lines.map((line) => {
                  const lineBusy = busyLineId === line.id;
                  const subtitle = lineSubtitle(line);
                  const quantity = lineQuantity(line);

                  return (
                    <div className={styles.waiterLine} key={line.id}>
                      <div className={styles.waiterLineTop}>
                        <div>
                          <strong>{line.productName}</strong>
                          {subtitle && (
                            <p className={styles.waiterLineMeta}>{subtitle}</p>
                          )}
                        </div>
                        <div className={styles.waiterLineActions}>
                          <button
                            className={styles.iconButton}
                            aria-label={`${line.productName} qatorini tahrirlash`}
                            title="Tahrirlash"
                            disabled={busy || !isOrderEditable(order)}
                            onClick={() => onEditLine(line)}
                            type="button"
                          >
                            <Pencil size={17} />
                          </button>
                          <button
                            className={`${styles.iconButton} ${styles.waiterRemove}`}
                            aria-label={`${line.productName} qatorini o'chirish`}
                            title="O'chirish"
                            disabled={busy || !isOrderEditable(order)}
                            onClick={() => onRemoveLine(line)}
                            type="button"
                          >
                            <Trash2 size={17} />
                          </button>
                        </div>
                      </div>

                      {line.notes && (
                        <p className={`${styles.note} ${styles.waiterNote}`}>
                          {line.notes}
                        </p>
                      )}

                      <div className={styles.waiterLineBottom}>
                        <div className={styles.waiterQty}>
                          <button
                            aria-label={`${line.productName} sonini kamaytirish`}
                            title="Kamaytirish"
                            disabled={busy || !isOrderEditable(order)}
                            onClick={() => onChangeQuantity(line, -1)}
                            type="button"
                          >
                            <Minus size={17} />
                          </button>
                          <span>{lineBusy ? "..." : quantity}</span>
                          <button
                            aria-label={`${line.productName} sonini ko'paytirish`}
                            title="Ko'paytirish"
                            disabled={busy || !isOrderEditable(order)}
                            onClick={() => onChangeQuantity(line, 1)}
                            type="button"
                          >
                            <Plus size={17} />
                          </button>
                        </div>
                        <strong className={styles.waiterLineTotal}>
                          {formatMoney(line.totalPrice)}
                        </strong>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <StaffEmpty title="Buyurtma bo'sh">
                Menyudan mahsulot tanlab qo&apos;shing.
              </StaffEmpty>
            )}
          </>
        ) : (
          <div className={styles.waiterOpenForm}>
            {blockReason ? (
              <p
                className={`${styles.note} ${styles.waiterNote}`}
                role="status"
              >
                <TriangleAlert size={15} aria-hidden="true" /> {blockReason}
              </p>
            ) : (
              <p className={styles.waiterHint}>
                Stolni ochib, mehmonlar sonini kiriting.
              </p>
            )}

            <div className={styles.field}>
              <span id="waiter-guest-count-label">Mehmonlar soni</span>
              <div
                className={styles.waiterQty}
                role="group"
                aria-labelledby="waiter-guest-count-label"
              >
                <button
                  aria-label="Mehmonlar sonini kamaytirish"
                  title="Kamaytirish"
                  disabled={busy || guestCount <= 1}
                  onClick={() => onGuestCountChange(guestCount - 1)}
                  type="button"
                >
                  <Minus size={17} />
                </button>
                <span aria-live="polite">{guestCount}</span>
                <button
                  aria-label="Mehmonlar sonini ko'paytirish"
                  title="Ko'paytirish"
                  disabled={busy || guestCount >= maxGuestCount}
                  onClick={() => onGuestCountChange(guestCount + 1)}
                  type="button"
                >
                  <Plus size={17} />
                </button>
              </div>
            </div>

            <label className={styles.field}>
              <span>Buyurtma izohi (ixtiyoriy)</span>
              <textarea
                className={styles.waiterTextarea}
                maxLength={1000}
                disabled={busy}
                placeholder="Masalan: tug'ilgan kun dasturxoni"
                value={openNote}
                onChange={(event) => onOpenNoteChange(event.target.value)}
              />
            </label>
          </div>
        )}
      </div>

      <div className={styles.waiterFooter}>
        {actionError && (
          <p className={styles.error} role="alert">
            {actionError}
          </p>
        )}

        {order ? (
          <>
            <div className={styles.totalRow}>
              <span>Jami · {totalQuantity(order)} ta</span>
              <strong>{formatMoney(order.total)}</strong>
            </div>

            <div className={styles.waiterActions}>
              <button
                className={`${styles.button} ${styles.tall} ${styles.full}`}
                disabled={busy || !isOrderEditable(order)}
                onClick={onGoToMenu}
                type="button"
              >
                <Utensils size={18} aria-hidden="true" />
                Mahsulot qo&apos;shish
              </button>
              <button
                className={`${styles.primary} ${styles.tall} ${styles.full}`}
                disabled={busy || !canSendToKitchen(order)}
                onClick={onSendKitchen}
                type="button"
              >
                <ChefHat size={18} aria-hidden="true" />
                {pendingAction === "kitchen"
                  ? "Yuborilmoqda..."
                  : "Oshxonaga yuborish"}
              </button>
              <button
                className={`${styles.secondary} ${styles.tall} ${styles.full}`}
                disabled={busy || !canRequestPayment(order)}
                onClick={onRequestPayment}
                type="button"
              >
                <ReceiptText size={18} aria-hidden="true" />
                {pendingAction === "payment"
                  ? "Yuborilmoqda..."
                  : "Hisob so'rash"}
              </button>
            </div>

            <p className={styles.waiterHint}>{orderHint(order)}</p>
          </>
        ) : (
          <button
            className={`${styles.primary} ${styles.tall} ${styles.full}`}
            disabled={busy || blockReason !== null}
            onClick={onOpenTable}
            type="button"
          >
            <ClipboardList size={18} aria-hidden="true" />
            {pendingAction === "open" ? "Ochilmoqda..." : "Stolni ochish"}
          </button>
        )}
      </div>
    </>
  );
}

function orderHint(order: TableOrder): string {
  if (order.status === "NEW") {
    return 'Buyurtma hali oshxonaga yuborilmagan. "Hisob so\'rash" tasdiqlangandan keyin ochiladi.';
  }

  if (canRequestPayment(order)) {
    return "Buyurtma oshxonada. Mehmon hisob so'rasa, \"Hisob so'rash\" ni bosing.";
  }

  if (order.status === "SERVED") {
    return "Hisob so'raldi — to'lovni kassir yakunlaydi.";
  }

  return "Buyurtma yopilgan.";
}
