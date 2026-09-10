"use client";

import { useMemo, useState } from "react";
import { apiFetch, SessionExpiredError } from "../../lib/api";
import { useApiResource } from "../../lib/use-api-resource";
import {
  formatDateTime,
  formatMoney,
  maskPhone,
  orderStatusLabels,
  orderStatusTone,
  type OrderStatus,
} from "../../lib/order-display";
import { Badge } from "../admin-ui/badge";
import { Card, CardHeader } from "../admin-ui/card";
import { DataTable, type DataTableColumn } from "../admin-ui/data-table";
import { ErrorState } from "../admin-ui/feedback";
import { FilterBar, Select, TextInput } from "../admin-ui/form";
import { InfoBox, StatGrid } from "../admin-ui/stat-box";

/*
 * Kuryerlar nazorati (5.5).
 *
 * MUAMMO: kuryer buyurtmani O'ZI olardi (birinchi kelgan oladi) va shundan
 * keyin uni faqat o'sha kuryer o'zgartira olardi. Agar uning telefoni
 * o'chsa, smenasi tugasa yoki kasal bo'lib qolsa, buyurtma o'sha kuryerga
 * biriktirilgan holda MUZLAB qolardi va hech kim buni ko'rmasdi ham —
 * admin panelda kuryer degan tushuncha umuman yo'q edi.
 *
 * Bu sahifa ikkita savolga javob beradi: kim nima olib ketyapti, va
 * biriktirishni qanday o'zgartirish mumkin.
 */

type Courier = {
  id: string;
  firstName: string;
  lastName?: string | null;
  phone?: string | null;
  employeeCode: string;
  branch?: { id: string; name: string } | null;
  activeDeliveries: number;
  completedToday: number;
};

type DeliveryOrder = {
  id: string;
  status: OrderStatus | "READY";
  deliveryAddress?: string | null;
  distanceKm?: number | null;
  createdAt: string;
  customer?: { id: string; name: string; phone: string } | null;
  branch?: { id: string; name: string } | null;
  order?: {
    id: string;
    orderNumber: string;
    displayOrderNumber?: string | null;
    status: OrderStatus;
    total: string;
    servedById?: string | null;
  } | null;
};

function courierName(courier: Courier): string {
  return [courier.firstName, courier.lastName].filter(Boolean).join(" ");
}

export function AdminCouriersPage() {
  const [query, setQuery] = useState("");
  const [assignFilter, setAssignFilter] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState("");

  /*
   * Ikkala ro'yxat PARALLEL: ular bir-biriga bog'liq emas va ketma-ket
   * kutish sahifani ikki barobar sekinlashtirardi.
   */
  const {
    data,
    isLoading,
    error: loadError,
    reload,
  } = useApiResource(
    () =>
      Promise.all([
        apiFetch<Courier[]>("/couriers"),
        apiFetch<DeliveryOrder[]>("/couriers/deliveries"),
      ]),
    [],
    "Kuryerlar ro'yxatini yuklab bo'lmadi.",
  );
  const couriers = data?.[0] ?? [];
  const orders = data?.[1] ?? [];
  const error = saveError || loadError;
  const load = reload;

  const courierById = useMemo(
    () => new Map(couriers.map((courier) => [courier.id, courier])),
    [couriers],
  );

  /*
   * Server allaqachon faqat FAOL yetkazishlarni qaytaradi, shuning uchun
   * bu yerda qayta filtrlanmaydi.
   *
   * Xususan, manzili bo'sh buyurtma YASHIRILMAYDI: aynan shunday buyurtma
   * admin ko'rishi kerak bo'lgan muammo, uni ro'yxatdan olib tashlash esa
   * muammoni ko'rinmas qilardi.
   */
  const activeDeliveries = orders;

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return activeDeliveries.filter((item) => {
      const servedById = item.order?.servedById ?? null;

      if (assignFilter === "unassigned" && servedById) return false;
      if (assignFilter === "assigned" && !servedById) return false;
      if (
        assignFilter &&
        assignFilter !== "unassigned" &&
        assignFilter !== "assigned" &&
        servedById !== assignFilter
      ) {
        return false;
      }

      if (!needle) return true;

      return [
        item.order?.orderNumber,
        item.order?.displayOrderNumber,
        item.customer?.name,
        item.customer?.phone,
        item.deliveryAddress,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [activeDeliveries, assignFilter, query]);

  const stats = useMemo(() => {
    const unassigned = activeDeliveries.filter(
      (item) => !item.order?.servedById,
    ).length;
    const completedToday = couriers.reduce(
      (sum, courier) => sum + courier.completedToday,
      0,
    );
    /*
     * "Bo'sh kuryer" — faol yetkazishi yo'q. Bu buyurtma tarqatishda eng
     * kerakli raqam: navbatda buyurtma turgani holda bo'sh kuryer bo'lsa,
     * demak biriktirish qo'lda qilinishi kerak.
     */
    const idle = couriers.filter(
      (courier) => courier.activeDeliveries === 0,
    ).length;

    return { unassigned, completedToday, idle, total: couriers.length };
  }, [activeDeliveries, couriers]);

  async function assign(customerOrderId: string, employeeId: string | null) {
    setSavingId(customerOrderId);
    setSaveError("");

    try {
      await apiFetch(`/courier/orders/${customerOrderId}/assign`, {
        method: "PATCH",
        body: JSON.stringify({ employeeId }),
      });
      // Statistikalar ham o'zgargani uchun ikkala ro'yxat qayta o'qiladi.
      await load();
    } catch (caught) {
      if (caught instanceof SessionExpiredError) {
        return;
      }
      setSaveError(
        caught instanceof Error
          ? caught.message
          : "Biriktirishni saqlab bo'lmadi.",
      );
    } finally {
      setSavingId(null);
    }
  }

  const courierColumns: DataTableColumn<Courier>[] = [
    {
      key: "name",
      header: "Kuryer",
      primary: true,
      render: (item) => (
        <div className="min-w-0">
          <p className="truncate font-semibold text-mz-text">
            {courierName(item)}
          </p>
          <p className="truncate text-xs text-mz-text-muted">
            {item.employeeCode}
            {item.phone ? ` · ${maskPhone(item.phone)}` : ""}
          </p>
        </div>
      ),
    },
    {
      key: "branch",
      header: "Filial",
      hideOnMobile: true,
      render: (item) => item.branch?.name ?? "—",
    },
    {
      key: "active",
      header: "Yo'lda",
      align: "right",
      render: (item) => (
        <Badge tone={item.activeDeliveries ? "warning" : "neutral"} withDot>
          {item.activeDeliveries} ta
        </Badge>
      ),
    },
    {
      key: "completed",
      header: "Bugun yakunlagan",
      align: "right",
      render: (item) => (
        <span className="font-semibold text-mz-text">
          {item.completedToday} ta
        </span>
      ),
    },
  ];

  const orderColumns: DataTableColumn<DeliveryOrder>[] = [
    {
      key: "order",
      header: "Buyurtma",
      primary: true,
      render: (item) => (
        <div className="min-w-0">
          <p className="truncate font-semibold text-mz-text">
            {item.order?.displayOrderNumber ??
              item.order?.orderNumber ??
              "Raqamsiz"}
          </p>
          <p className="truncate text-xs text-mz-text-muted">
            {formatDateTime(item.createdAt)}
          </p>
        </div>
      ),
    },
    {
      key: "address",
      header: "Manzil",
      render: (item) => (
        <div className="min-w-0">
          <p className="truncate text-sm text-mz-text">
            {item.deliveryAddress ?? "—"}
          </p>
          <p className="truncate text-xs text-mz-text-muted">
            {item.customer?.name ?? "Mijoz"}
            {typeof item.distanceKm === "number"
              ? ` · ~${item.distanceKm} km`
              : ""}
          </p>
        </div>
      ),
    },
    {
      key: "status",
      header: "Holat",
      render: (item) => (
        <Badge tone={orderStatusTone(item.status as OrderStatus)} withDot>
          {orderStatusLabels[item.status as OrderStatus] ?? item.status}
        </Badge>
      ),
    },
    {
      key: "total",
      header: "Summa",
      align: "right",
      hideOnMobile: true,
      render: (item) => (
        <span className="font-semibold text-mz-text">
          {formatMoney(item.order?.total)}
        </span>
      ),
    },
    {
      key: "courier",
      header: "Kuryer",
      render: (item) => {
        const servedById = item.order?.servedById ?? "";
        const assigned = servedById ? courierById.get(servedById) : undefined;

        /*
         * Boshqa filialning kuryeri ro'yxatda bo'lmaydi, lekin buyurtma unga
         * biriktirilgan bo'lishi mumkin (filial filtri o'zgargan holat).
         * Bunday qiymatni `<select>` ga qo'ymasak, u jimgina "biriktirilmagan"
         * ga tushib qolardi — ya'ni ekran yolg'on gapirardi.
         */
        const unknownAssignee = servedById && !assigned;

        return (
          <Select
            aria-label="Kuryerni biriktirish"
            disabled={savingId === item.id}
            value={servedById}
            onChange={(event) =>
              void assign(item.id, event.target.value || null)
            }
          >
            <option value="">Biriktirilmagan</option>
            {unknownAssignee ? (
              <option value={servedById}>Boshqa filial kuryeri</option>
            ) : null}
            {couriers.map((courier) => (
              <option key={courier.id} value={courier.id}>
                {courierName(courier)}
                {courier.activeDeliveries
                  ? ` (${courier.activeDeliveries} yo'lda)`
                  : ""}
              </option>
            ))}
          </Select>
        );
      },
    },
  ];

  return (
    <div className="grid gap-5">
      {error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : null}

      <StatGrid>
        <InfoBox icon="truck" label="Faol kuryer" value={`${stats.total} ta`} />
        <InfoBox
          icon="clock"
          label="Biriktirilmagan"
          tone={stats.unassigned ? "warning" : "brand"}
          value={`${stats.unassigned} ta`}
        />
        <InfoBox icon="users" label="Bo'sh kuryer" value={`${stats.idle} ta`} />
        <InfoBox
          icon="check"
          label="Bugun yakunlangan"
          tone="brand"
          value={`${stats.completedToday} ta`}
        />
      </StatGrid>

      <Card>
        <CardHeader
          description="COURIER rolidagi faol xodimlar"
          title="Kuryerlar"
        />
        <DataTable
          caption="Kuryerlar"
          columns={courierColumns}
          emptyDescription="Xodimga COURIER roli berilganini tekshiring."
          emptyTitle="Bu filialda kuryer yo'q"
          getRowKey={(item) => item.id}
          isLoading={isLoading}
          rows={couriers}
        />
      </Card>

      <Card>
        <CardHeader
          description="Faol yetkazish buyurtmalari va ularning kuryeri"
          title="Yo'ldagi yetkazishlar"
        />
        <FilterBar>
          <div className="min-w-52 flex-1">
            <TextInput
              aria-label="Yetkazishlar orasida qidirish"
              placeholder="Buyurtma raqami, mijoz yoki manzil"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>

          <div className="w-56">
            <Select
              aria-label="Biriktirish bo'yicha filtr"
              value={assignFilter}
              onChange={(event) => setAssignFilter(event.target.value)}
            >
              <option value="">Barchasi</option>
              <option value="unassigned">Biriktirilmagan</option>
              <option value="assigned">Biriktirilgan</option>
              {couriers.map((courier) => (
                <option key={courier.id} value={courier.id}>
                  {courierName(courier)}
                </option>
              ))}
            </Select>
          </div>
        </FilterBar>

        <DataTable
          caption="Yo'ldagi yetkazishlar"
          columns={orderColumns}
          emptyDescription="Qidiruv yoki filtrni o'zgartirib ko'ring."
          emptyTitle="Yo'lda yetkazish yo'q"
          getRowKey={(item) => item.id}
          isLoading={isLoading}
          rows={filtered}
        />
      </Card>
    </div>
  );
}
