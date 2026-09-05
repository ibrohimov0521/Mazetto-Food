"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch, SessionExpiredError } from "../../lib/api";
import { formatDateTime, formatMoney, maskPhone } from "../../lib/order-display";
import { Badge } from "../admin-ui/badge";
import { Button } from "../admin-ui/button";
import { Card } from "../admin-ui/card";
import { DataTable, type DataTableColumn } from "../admin-ui/data-table";
import { ErrorState } from "../admin-ui/feedback";
import { FilterBar, Select, TextInput } from "../admin-ui/form";
import { InfoBox, StatGrid } from "../admin-ui/stat-box";

/*
 * Mijozlar ro'yxati.
 *
 * Backend `/customers` va `/customers/statistics` tayyor edi, lekin admin
 * panelda ekrani yo'q edi — mijoz bazasi umuman ko'rinmasdi.
 *
 * PII: telefon raqamlari ro'yxatda qisman yashirilgan. To'liq ko'rish uchun
 * qatordagi tugma bosiladi — bu ochish harakati ongli bo'lishi uchun.
 *
 * ESLATMA: `/customers` pagination'ni qo'llab-quvvatlamaydi. Baza o'sganda
 * backend'ga `limit`/`offset` qo'shilishi kerak.
 */

type Customer = {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  telegramUserId?: string | null;
  telegramLinkedAt?: string | null;
  bonusBalance: string;
  createdAt: string;
  _count?: { customerOrders: number; favorites: number };
};

type CustomerStats = {
  customers: number;
  onlineOrders: number;
  bonusLiability: string;
};

export function AdminCustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [stats, setStats] = useState<CustomerStats | null>(null);
  const [query, setQuery] = useState("");
  const [channel, setChannel] = useState("");
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const [nextCustomers, nextStats] = await Promise.all([
        apiFetch<Customer[]>("/customers"),
        apiFetch<CustomerStats>("/customers/statistics"),
      ]);
      setCustomers(nextCustomers);
      setStats(nextStats);
    } catch (caught) {
      if (caught instanceof SessionExpiredError) {
        return;
      }

      setError(caught instanceof Error ? caught.message : "Mijozlarni yuklab bo'lmadi.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return customers.filter((customer) => {
      const identity = [customer.name, customer.phone, customer.email]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      const matchesChannel =
        !channel ||
        (channel === "TELEGRAM" && Boolean(customer.telegramUserId)) ||
        (channel === "WEB" && !customer.telegramUserId);

      return (!needle || identity.includes(needle)) && matchesChannel;
    });
  }, [channel, customers, query]);

  function revealPhone(id: string): void {
    setRevealedIds((current) => new Set(current).add(id));
  }

  const columns: DataTableColumn<Customer>[] = [
    {
      key: "customer",
      header: "Mijoz",
      primary: true,
      render: (customer) => (
        <div className="min-w-0">
          <p className="truncate font-semibold text-mz-text">{customer.name}</p>
          {customer.email ? (
            <p className="truncate text-xs text-mz-text-muted">{customer.email}</p>
          ) : null}
        </div>
      ),
    },
    {
      key: "phone",
      header: "Telefon",
      render: (customer) =>
        revealedIds.has(customer.id) ? (
          <span className="text-mz-text">{customer.phone}</span>
        ) : (
          <span className="inline-flex items-center gap-2">
            <span className="text-mz-text-muted">{maskPhone(customer.phone)}</span>
            <Button onClick={() => revealPhone(customer.id)} size="sm" variant="ghost">
              Ko&apos;rsatish
            </Button>
          </span>
        ),
    },
    {
      key: "channel",
      header: "Kanal",
      render: (customer) =>
        customer.telegramUserId ? (
          <Badge tone="info">Telegram</Badge>
        ) : (
          <Badge tone="neutral">Sayt</Badge>
        ),
    },
    {
      key: "orders",
      header: "Buyurtma",
      align: "right",
      render: (customer) => `${customer._count?.customerOrders ?? 0} ta`,
    },
    {
      key: "bonus",
      header: "Bonus",
      align: "right",
      hideOnMobile: true,
      render: (customer) => formatMoney(customer.bonusBalance),
    },
    {
      key: "created",
      header: "Ro'yxatdan o'tgan",
      align: "right",
      hideOnMobile: true,
      render: (customer) => (
        <span className="text-xs text-mz-text-muted">{formatDateTime(customer.createdAt)}</span>
      ),
    },
  ];

  return (
    <div className="grid gap-5">
      {error ? <ErrorState message={error} onRetry={() => void load()} /> : null}

      {stats ? (
        <StatGrid>
          <InfoBox label="Jami mijoz" tone="brand" value={`${stats.customers} ta`} />
          <InfoBox label="Online buyurtmalar" value={`${stats.onlineOrders} ta`} />
          <InfoBox
            label="Bonus majburiyati"
            tone="warning"
            value={formatMoney(stats.bonusLiability)}
          />
          <InfoBox
            label="Telegram orqali"
            value={`${customers.filter((customer) => customer.telegramUserId).length} ta`}
          />
        </StatGrid>
      ) : null}

      <Card>
        <FilterBar>
          <div className="min-w-52 flex-1">
            <TextInput
              aria-label="Mijoz qidirish"
              placeholder="Ism, telefon yoki email"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <div className="w-44">
            <Select
              aria-label="Kanal bo'yicha filtr"
              value={channel}
              onChange={(event) => setChannel(event.target.value)}
            >
              <option value="">Barcha kanallar</option>
              <option value="TELEGRAM">Telegram</option>
              <option value="WEB">Sayt</option>
            </Select>
          </div>
        </FilterBar>

        <DataTable
          caption="Mijozlar ro'yxati"
          columns={columns}
          emptyDescription="Qidiruv yoki filtrni o'zgartirib ko'ring."
          emptyTitle="Mijoz topilmadi"
          getRowKey={(customer) => customer.id}
          isLoading={isLoading}
          rows={filtered}
        />
      </Card>
    </div>
  );
}
