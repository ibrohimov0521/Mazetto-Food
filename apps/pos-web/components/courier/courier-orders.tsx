"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch, SessionExpiredError } from "../../lib/api";
import {
  formatDateTime,
  formatMoney,
  orderStatusLabels,
  orderStatusTone,
  type OrderStatus,
} from "../../lib/order-display";
import { Badge } from "../admin-ui/badge";
import { Button } from "../admin-ui/button";
import { Card, CardBody, CardHeader } from "../admin-ui/card";
import { ErrorState } from "../admin-ui/feedback";

type DeliveryPoint = {
  lat?: number;
  lng?: number;
  latitude?: number;
  longitude?: number;
  lon?: number;
  accuracy?: number;
  label?: string;
  address?: string;
};

type CourierOrder = {
  id: string;
  status: OrderStatus;
  deliveryAddress?: string | null;
  deliveryLocation?: DeliveryPoint | null;
  notes?: string | null;
  createdAt: string;
  customer?: { name: string; phone: string } | null;
  branch?: { name: string; address?: string | null } | null;
  order?: {
    orderNumber: string;
    displayOrderNumber?: string | null;
    status: OrderStatus;
    total: string;
    items: {
      id: string;
      productName: string;
      quantity: string;
      totalPrice: string;
    }[];
  } | null;
};

const pageSize = 100;
const refreshMs = 12000;

export function CourierOrdersPage() {
  const [orders, setOrders] = useState<CourierOrder[]>([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setError("");

    try {
      const params = new URLSearchParams({
        limit: String(pageSize),
        offset: "0",
      });
      setOrders(
        await apiFetch<CourierOrder[]>(`/courier/orders?${params.toString()}`),
      );
      setUpdatedAt(new Date());
    } catch (caught) {
      if (caught instanceof SessionExpiredError) {
        return;
      }

      setError(
        caught instanceof Error
          ? caught.message
          : "Kuryer buyurtmalari yuklanmadi.",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const timer = window.setInterval(() => void load(), refreshMs);
    return () => window.clearInterval(timer);
  }, [load]);

  const stats = useMemo(
    () => ({
      active: orders.length,
      ready: orders.filter(
        (order) => order.status === "READY" || order.order?.status === "READY",
      ).length,
      total: orders.reduce(
        (sum, order) => sum + Number(order.order?.total ?? 0),
        0,
      ),
    }),
    [orders],
  );

  async function updateStatus(
    order: CourierOrder,
    status: "READY" | "COMPLETED" | "CANCELLED",
  ) {
    setBusyOrderId(order.id);
    setError("");

    try {
      await apiFetch(`/courier/orders/${order.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      await load();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Status yangilanmadi.",
      );
    } finally {
      setBusyOrderId(null);
    }
  }

  return (
    <div className="grid gap-5">
      {error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : null}

      <section className="grid gap-3 sm:grid-cols-3">
        <Stat label="Faol yetkazishlar" value={`${stats.active} ta`} />
        <Stat label="Tayyor" value={`${stats.ready} ta`} />
        <Stat label="Jami summa" value={formatMoney(stats.total)} />
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold text-mz-text-muted">
          {updatedAt
            ? `Yangilandi: ${formatDateTime(updatedAt.toISOString())}`
            : "Yuklanmoqda..."}
        </p>
        <Button
          disabled={isLoading}
          onClick={() => void load()}
          variant="ghost"
        >
          Yangilash
        </Button>
      </div>

      {isLoading ? (
        <Card>
          <CardBody>
            <p className="text-sm font-bold text-mz-text-muted">
              Kuryer buyurtmalari yuklanmoqda...
            </p>
          </CardBody>
        </Card>
      ) : orders.length ? (
        <section className="grid gap-4 xl:grid-cols-2">
          {orders.map((order) => (
            <CourierOrderCard
              busy={busyOrderId === order.id}
              key={order.id}
              order={order}
              onStatus={(status) => void updateStatus(order, status)}
            />
          ))}
        </section>
      ) : (
        <Card>
          <CardBody className="py-10 text-center">
            <p className="text-lg font-black text-mz-text">
              Hozircha yetkazish buyurtmasi yo'q
            </p>
            <p className="mt-2 text-sm text-mz-text-muted">
              Yangi online delivery kelganda shu yerda ko'rinadi.
            </p>
          </CardBody>
        </Card>
      )}
    </div>
  );
}

function CourierOrderCard({
  order,
  busy,
  onStatus,
}: {
  order: CourierOrder;
  busy: boolean;
  onStatus: (status: "READY" | "COMPLETED" | "CANCELLED") => void;
}) {
  const point = resolvePoint(order.deliveryLocation);
  const status = order.order?.status ?? order.status;
  const title =
    order.order?.displayOrderNumber ?? order.order?.orderNumber ?? "Buyurtma";
  const maps = point ? buildMapLinks(point) : null;

  return (
    <Card as="article" className="overflow-hidden">
      <CardHeader
        title={title}
        description={`${formatDateTime(order.createdAt)} · ${order.branch?.name ?? "Filial"}`}
        actions={
          <Badge tone={orderStatusTone(status)} withDot>
            {orderStatusLabels[status] ?? status}
          </Badge>
        }
      />
      <CardBody className="grid gap-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Info label="Mijoz" value={order.customer?.name ?? "Mijoz"} />
          {order.customer?.phone ? (
            <Info
              label="Telefon"
              value={order.customer.phone}
              href={`tel:${order.customer.phone}`}
            />
          ) : (
            <Info label="Telefon" value="—" />
          )}
          <Info
            label="Manzil"
            value={
              order.deliveryAddress ??
              point?.label ??
              point?.address ??
              "Manzil kiritilmagan"
            }
            wide
          />
          <Info label="Summa" value={formatMoney(order.order?.total)} />
        </div>

        {order.notes ? (
          <div className="rounded-mz-control bg-mz-warning-bg px-3 py-2 text-sm font-semibold text-mz-warning">
            Izoh: {order.notes}
          </div>
        ) : null}

        {order.order?.items?.length ? (
          <div className="rounded-mz-control border border-mz-border bg-mz-surface-sunken p-3">
            <p className="text-xs font-black uppercase text-mz-text-muted">
              Tarkib
            </p>
            <ul className="mt-2 grid gap-1.5">
              {order.order.items.map((item) => (
                <li
                  className="flex justify-between gap-3 text-sm text-mz-text"
                  key={item.id}
                >
                  <span className="min-w-0 truncate">{item.productName}</span>
                  <span className="shrink-0 font-bold">
                    x{formatQuantity(item.quantity)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="grid gap-2 sm:grid-cols-2">
          {maps ? (
            <>
              <a
                className="inline-flex justify-center rounded-mz-control bg-mz-accent px-4 py-3 text-sm font-black text-white transition hover:bg-mz-teal-600"
                href={maps.google}
                rel="noreferrer"
                target="_blank"
              >
                Google Maps
              </a>
              <a
                className="inline-flex justify-center rounded-mz-control border border-mz-border bg-white px-4 py-3 text-sm font-black text-mz-text transition hover:bg-mz-surface-sunken"
                href={maps.yandex}
                rel="noreferrer"
                target="_blank"
              >
                Yandex Maps
              </a>
            </>
          ) : (
            <div className="rounded-mz-control bg-mz-danger-bg px-3 py-2 text-sm font-bold text-mz-danger sm:col-span-2">
              Koordinata yo'q. Mijoz bilan telefon orqali aniqlashtiring.
            </div>
          )}
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-mz-border pt-3">
          <Button
            disabled={busy || status === "READY"}
            onClick={() => onStatus("READY")}
            size="sm"
            variant="ghost"
          >
            Tayyor
          </Button>
          <Button
            disabled={busy}
            onClick={() => onStatus("COMPLETED")}
            size="sm"
            variant="secondary"
          >
            Yetkazildi
          </Button>
          <Button
            disabled={busy}
            onClick={() => onStatus("CANCELLED")}
            size="sm"
            variant="danger"
          >
            Bekor qilish
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardBody>
        <p className="text-xs font-black uppercase text-mz-text-muted">
          {label}
        </p>
        <p className="mt-2 text-2xl font-black text-mz-text">{value}</p>
      </CardBody>
    </Card>
  );
}

function Info({
  label,
  value,
  href,
  wide = false,
}: {
  label: string;
  value: string;
  href?: string;
  wide?: boolean;
}) {
  const content = href ? (
    <a
      className="font-black text-mz-accent underline-offset-2 hover:underline"
      href={href}
    >
      {value}
    </a>
  ) : (
    <span className="font-semibold text-mz-text">{value}</span>
  );

  return (
    <div className={wide ? "sm:col-span-2" : ""}>
      <p className="text-xs font-black uppercase text-mz-text-muted">{label}</p>
      <p className="mt-1 break-words text-sm">{content}</p>
    </div>
  );
}

function resolvePoint(
  location: DeliveryPoint | null | undefined,
): { lat: number; lng: number; label?: string; address?: string } | null {
  if (!location || typeof location !== "object") {
    return null;
  }

  const lat = Number(location.lat ?? location.latitude);
  const lng = Number(location.lng ?? location.lon ?? location.longitude);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  return {
    lat,
    lng,
    ...(location.label ? { label: location.label } : {}),
    ...(location.address ? { address: location.address } : {}),
  };
}

function buildMapLinks(point: { lat: number; lng: number }) {
  const destination = `${point.lat},${point.lng}`;

  return {
    google: `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`,
    yandex: `https://yandex.com/maps/?rtext=~${encodeURIComponent(destination)}&rtt=auto`,
  };
}

function formatQuantity(value: string): string {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric.toLocaleString("uz-UZ") : value;
}
