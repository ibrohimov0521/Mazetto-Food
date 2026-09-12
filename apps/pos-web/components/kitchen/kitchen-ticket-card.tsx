"use client";

import {
  Check,
  ChevronDown,
  ChevronUp,
  ShoppingBag,
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

export function KitchenTicketCard({
  ticket,
  now,
  expanded,
  busy,
  error,
  showBranch,
  onToggle,
  onAction,
}: {
  ticket: KitchenTicket;
  now: number;
  expanded: boolean;
  busy: boolean;
  error?: string | undefined;
  showBranch: boolean;
  onToggle: () => void;
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
  const shownItems = expanded
    ? ticket.order.items
    : ticket.order.items.slice(0, 1);
  const canCancel =
    hasPermission(user, "KITCHEN_STATUS_UPDATE") &&
    ["NEW", "ACCEPTED", "COOKING"].includes(ticket.status);
  const number = ticket.order.displayOrderNumber ?? ticket.order.orderNumber;
  const place = ticket.order.table
    ? (ticket.order.table.name ?? `Stol ${ticket.order.table.number ?? ""}`)
    : ticket.order.type === "DELIVERY"
      ? "Yetkazish"
      : "Olib ketish";
  const note = ticket.order.kitchenComment ?? ticket.order.notes;

  return (
    <article className={styles.ticket} data-urgency={urgency}>
      <div className={styles.ticketHeader}>
        <h3 className={styles.ticketNumber}>#{number}</h3>
        <span
          className={styles.ticketTime}
          data-urgency={urgency}
          title={kitchenUrgencyLabels[urgency]}
        >
          <Timer size={22} aria-hidden="true" />
          {elapsed} daq
        </span>
      </div>
      <div className={styles.ticketMeta}>
        {ticket.priority > 0 && (
          <span className={styles.ticketPriority}>
            <Zap size={16} aria-hidden="true" />
            Ustuvor
          </span>
        )}
        <span className={styles.badge}>
          {ticket.order.type === "DELIVERY" ? (
            <Truck size={16} aria-hidden="true" />
          ) : (
            <ShoppingBag size={16} aria-hidden="true" />
          )}
          {place}
        </span>
        <span className={styles.badge}>
          {sourceLabels[ticket.order.source]}
        </span>
      </div>
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
      {ticket.order.items.length > 0 && (
        <button
          className={styles.detailsButton}
          aria-expanded={expanded}
          onClick={onToggle}
          type="button"
        >
          {expanded ? (
            <ChevronUp size={18} aria-hidden="true" />
          ) : (
            <ChevronDown size={18} aria-hidden="true" />
          )}
          {expanded
            ? "Yig'ish"
            : ticket.order.items.length > 1
              ? `Batafsil · ${ticket.order.items.length} ta mahsulot`
              : "Batafsil"}
        </button>
      )}
      {expanded && note && <p className={styles.note}>{note}</p>}
      <div className={styles.ticketActions}>
        {action && (
          <button
            className={`${styles.primary} ${styles.ticketPrimary}`}
            disabled={busy}
            onClick={() => onAction(action.action)}
            type="button"
          >
            <Check size={20} aria-hidden="true" />
            {busy ? "Saqlanmoqda..." : action.label}
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
      {showBranch && (
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
