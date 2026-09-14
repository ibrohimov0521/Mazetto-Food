"use client";

import {
  Check,
  Maximize2,
  Minimize2,
  ShoppingBag,
  Utensils,
  Timer,
  Truck,
  X,
  Zap,
} from "lucide-react";
import { useAuth } from "../auth/auth-provider";
import { hasPermission } from "../../lib/auth";
import styles from "../staff/staff.module.css";
import {
  kitchenElapsedMinutes,
  kitchenUrgency,
  kitchenUrgencyLabels,
} from "./kitchen-prefs";
import {
  kitchenPrimaryAction,
  type KitchenAction,
  type KitchenTicket,
} from "./kitchen-types";

const sourceLabels: Record<KitchenTicket["order"]["source"], string> = {
  POS: "Kassa",
  WEB: "Sayt",
  TELEGRAM: "Telegram",
};

const compactActionLabels: Record<KitchenAction, string> = {
  accept: "Qabul",
  start: "Boshlash",
  ready: "Tayyor",
  complete: "Topshirish",
  cancel: "Bekor",
};

export function KitchenTicketCard({
  ticket,
  now,
  busy,
  error,
  showBranch,
  isCompact,
  onToggleCompact,
  onAction,
}: {
  ticket: KitchenTicket;
  now: number;
  busy: boolean;
  error?: string | undefined;
  showBranch: boolean;
  isCompact: boolean;
  onToggleCompact: () => void;
  onAction: (action: KitchenAction) => void;
}) {
  const { user } = useAuth();
  const elapsed = kitchenElapsedMinutes(ticket, now);
  const urgency = kitchenUrgency(ticket.status, elapsed);
  const canAct = hasPermission(
    user,
    ticket.status === "NEW" ? "KITCHEN_ACCEPT" : "KITCHEN_STATUS_UPDATE",
  );
  const action = canAct ? kitchenPrimaryAction(ticket.status) : null;
  const shownItems = ticket.items?.length ? ticket.items : ticket.order.items;
  const canCancel =
    hasPermission(user, "KITCHEN_STATUS_UPDATE") &&
    ["NEW", "ACCEPTED", "COOKING"].includes(ticket.status);
  const number = ticket.order.displayOrderNumber ?? ticket.order.orderNumber;
  const place = ticket.order.table
    ? (ticket.order.table.name ?? `Stol ${ticket.order.table.number ?? ""}`)
    : ticket.order.type === "DELIVERY"
      ? "Yetkazish"
      : ticket.order.type === "DINE_IN"
        ? "Zal · stolsiz"
        : "Olib ketish";
  const note = ticket.order.kitchenComment ?? ticket.order.notes;

  return (
    <article
      className={styles.ticket}
      data-compact={isCompact}
      data-urgency={urgency}
    >
      <div className={styles.ticketHeader}>
        <h3 className={styles.ticketNumber}>#{number}</h3>
        <button
          aria-expanded={!isCompact}
          aria-label={
            isCompact
              ? `#${number} buyurtma ma'lumotlarini ko'rsatish`
              : `#${number} buyurtmani qisqartirish`
          }
          className={styles.ticketCollapse}
          onClick={onToggleCompact}
          title={isCompact ? "Ko'rsatish" : "Qisqartirish"}
          type="button"
        >
          {isCompact ? (
            <Maximize2 size={15} aria-hidden="true" />
          ) : (
            <Minimize2 size={15} aria-hidden="true" />
          )}
        </button>
      </div>
      <div className={styles.ticketTiming}>
        <span
          className={styles.ticketTime}
          data-urgency={urgency}
          title={kitchenUrgencyLabels[urgency]}
        >
          <Timer size={14} aria-hidden="true" />
          {elapsed} daq
        </span>
        {ticket.priority > 0 && (
          <span className={styles.ticketPriority}>
            <Zap size={16} aria-hidden="true" />
            Ustuvor
          </span>
        )}
      </div>
      <div className={styles.ticketMeta}>
        {(ticket.isSupplement || ticket.order.isSupplemental) && (
          <span className={styles.ticketPriority}>
            Qo&apos;shimcha #
            {ticket.revisionNumber ?? ticket.order.supplementNumber ?? 1}
          </span>
        )}
        <span className={styles.badge}>
          {ticket.order.type === "DELIVERY" ? (
            <Truck size={16} aria-hidden="true" />
          ) : ticket.order.type === "DINE_IN" ? (
            <Utensils size={16} aria-hidden="true" />
          ) : (
            <ShoppingBag size={16} aria-hidden="true" />
          )}
          {place}
        </span>
        {!isCompact && (
          <span className={styles.badge}>
            {sourceLabels[ticket.order.source]}
          </span>
        )}
      </div>
      {isCompact ? (
        <p className={styles.ticketCompactSummary}>
          {shownItems.length} xil mahsulot
        </p>
      ) : (
        <>
          <ul className={styles.itemList}>
            {shownItems.map((item) => (
              <li key={item.id}>
                <span className={styles.itemQuantity}>
                  {Number(item.quantity)}x
                </span>
                <div className={styles.itemName}>
                  {item.productName}
                  {item.variantName && <small>{item.variantName}</small>}
                  <Modifiers value={item.modifierSnapshot} />
                  {item.notes && <p className={styles.note}>{item.notes}</p>}
                </div>
              </li>
            ))}
          </ul>
          {note && <p className={styles.note}>{note}</p>}
        </>
      )}
      <div className={styles.ticketActions}>
        {action && (
          <button
            className={`${styles.primary} ${styles.ticketPrimary}`}
            aria-label={busy ? "Saqlanmoqda..." : action.label}
            title={action.label}
            disabled={busy}
            onClick={() => onAction(action.action)}
            type="button"
          >
            <Check size={20} aria-hidden="true" />
            {busy ? (
              <span className={styles.ticketBusyLabel}>Saqlanmoqda...</span>
            ) : (
              <>
                <span className={styles.ticketPrimaryFullLabel}>
                  {action.label}
                </span>
                <span className={styles.ticketPrimaryShortLabel}>
                  {compactActionLabels[action.action]}
                </span>
              </>
            )}
          </button>
        )}
        {canCancel && (
          <button
            className={`${styles.iconButton} ${styles.ticketCancel}`}
            title="Buyurtmani bekor qilish"
            aria-label={`#${number} buyurtmani bekor qilish`}
            disabled={busy}
            onClick={() => onAction("cancel")}
            type="button"
          >
            <X size={22} aria-hidden="true" />
          </button>
        )}
      </div>
      {/* Xato chiptaning O'ZIDA ko'rinadi: to'rt ustunli ekranda sahifa
          tepasidagi banner oshpazdan 800 px uzoqda bo'lishi mumkin. */}
      {error && (
        <p className={styles.ticketError} role="alert">
          {error}
        </p>
      )}
      {!isCompact && showBranch && (
        <p className={styles.ticketBranch}>
          {ticket.order.branch?.name ?? "Filial"}
        </p>
      )}
    </article>
  );
}

function Modifiers({ value }: { value: unknown }) {
  if (!Array.isArray(value)) return null;

  return (
    <>
      {value
        .filter(
          (item): item is { name?: string; quantity?: string } =>
            !!item && typeof item === "object",
        )
        .map((item, index) => (
          <small key={index}>
            + {item.name ?? "Qo'shimcha"}
            {Number(item.quantity) > 1 ? ` x${item.quantity}` : ""}
          </small>
        ))}
    </>
  );
}
