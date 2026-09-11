"use client";

import { useMemo } from "react";
import { Users } from "lucide-react";
import { StaffEmpty } from "../staff/staff-shell";
import styles from "../staff/staff.module.css";
import { formatMoney } from "../../lib/order-display";
import {
  tableStatusLabels,
  tableStatusTones,
  unassignedHallName,
  type TableStatus,
  type WaiterTable,
} from "./waiter-model";

const legendOrder: TableStatus[] = [
  "AVAILABLE",
  "OCCUPIED",
  "RESERVED",
  "CLEANING",
];

export function TableMap({
  tables,
  selectedTableId,
  disabled,
  onSelect,
}: {
  tables: WaiterTable[];
  selectedTableId: string | null;
  disabled: boolean;
  onSelect: (tableId: string) => void;
}) {
  const halls = useMemo(() => groupByHall(tables), [tables]);

  return (
    <div>
      <ul className={styles.legend} aria-label="Stol holatlari izohi">
        {legendOrder.map((status) => (
          <li className={styles.legendItem} key={status}>
            <span
              className={styles.legendDot}
              data-status={status}
              aria-hidden="true"
            />
            {tableStatusLabels[status]}
          </li>
        ))}
      </ul>

      {halls.length ? (
        halls.map((hall) => (
          <section className={styles.hallSection} key={hall.name}>
            <h2 className={styles.hallHeading}>
              {hall.name}
              <span className={styles.badge}>{hall.tables.length} ta stol</span>
            </h2>
            <div className={styles.tableGrid}>
              {hall.tables.map((table) => {
                const order = table.orders[0] ?? null;

                return (
                  <button
                    className={styles.tableCard}
                    key={table.id}
                    data-status={table.status}
                    aria-pressed={selectedTableId === table.id}
                    disabled={disabled}
                    onClick={() => onSelect(table.id)}
                    type="button"
                  >
                    <span className={styles.tableName}>{table.name}</span>
                    <span className={styles.tableMeta}>
                      <Users size={15} aria-hidden="true" />
                      {table.capacity ?? 0} o'rin
                    </span>
                    <span
                      className={`${styles.badge} ${styles.tableStatus}`}
                      data-tone={tableStatusTones[table.status]}
                    >
                      {tableStatusLabels[table.status]}
                    </span>
                    {order && (
                      <span className={styles.tableOrderRow}>
                        <span className={styles.muted}>Ochiq buyurtma</span>
                        <strong>{formatMoney(order.total)}</strong>
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </section>
        ))
      ) : (
        <StaffEmpty title="Stol topilmadi">
          Sizga biriktirilgan zallarda hozircha faol stol yo&apos;q.
        </StaffEmpty>
      )}
    </div>
  );
}

function groupByHall(
  tables: WaiterTable[],
): { name: string; tables: WaiterTable[] }[] {
  const halls: { name: string; tables: WaiterTable[] }[] = [];

  for (const table of tables) {
    const name = table.hall?.name?.trim() || unassignedHallName;
    const existing = halls.find((hall) => hall.name === name);

    if (existing) {
      existing.tables.push(table);
    } else {
      halls.push({ name, tables: [table] });
    }
  }

  return halls;
}
