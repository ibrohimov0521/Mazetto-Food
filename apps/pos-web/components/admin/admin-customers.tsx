"use client";

import { useMemo, useState } from "react";
import { apiFetch } from "../../lib/api";
import { useApiResource } from "../../lib/use-api-resource";
import {
  formatDateTime,
  formatMoney,
  maskPhone,
} from "../../lib/order-display";
import { Badge } from "../admin-ui/badge";
import { Button } from "../admin-ui/button";
import { Card } from "../admin-ui/card";
import { DataTable, type DataTableColumn } from "../admin-ui/data-table";
import { ErrorState } from "../admin-ui/feedback";
import { FilterBar, Select, TextInput } from "../admin-ui/form";
import { Pagination } from "../admin-ui/pagination";
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
 * SAHIFALASH: `/customers` endi `limit`/`offset` qabul qiladi. Qidiruv va
 * kanal filtri esa BRAUZERDA, ya'ni faqat joriy sahifa ichida ishlaydi —
 * server tomonda qidiruv yo'q. Yorliqlar shuni ochiq aytadi, aks holda
 * foydalanuvchi butun bazada qidiryapman deb o'ylardi.
 */

const pageSize = 50;

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
  const [query, setQuery] = useState("");
  const [channel, setChannel] = useState("");
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set());
  const [offset, setOffset] = useState(0);

  const {
    data,
    isLoading,
    error,
    reload: load,
  } = useApiResource(
    () =>
      Promise.all([
        apiFetch<Customer[]>(`/customers?limit=${pageSize}&offset=${offset}`),
        apiFetch<CustomerStats>("/customers/statistics"),
      ]),
    [offset],
    "Mijozlarni yuklab bo'lmadi.",
  );
  const customers = data?.[0] ?? [];
  const stats = data?.[1] ?? null;

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
            <p className="truncate text-xs text-mz-text-muted">
              {customer.email}
            </p>
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
            <span className="text-mz-text-muted">
              {maskPhone(customer.phone)}
            </span>
            <Button
              onClick={() => revealPhone(customer.id)}
              size="sm"
              variant="ghost"
            >
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
        <span className="text-xs text-mz-text-muted">
          {formatDateTime(customer.createdAt)}
        </span>
      ),
    },
  ];

  return (
    <div className="grid gap-5">
      {error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : null}

      {stats ? (
        <StatGrid>
          <InfoBox
            icon="users"
            label="Jami mijoz"
            tone="brand"
            value={`${stats.customers} ta`}
          />
          <InfoBox
            icon="globe"
            label="Online buyurtmalar"
            value={`${stats.onlineOrders} ta`}
          />
          <InfoBox
            icon="wallet"
            label="Bonus majburiyati"
            tone="warning"
            value={formatMoney(stats.bonusLiability)}
          />
          <InfoBox
            icon="send"
            label="Telegram orqali"
            value={`${customers.filter((customer) => customer.telegramUserId).length} ta`}
          />
        </StatGrid>
      ) : null}

      <Card>
        <FilterBar>
          <div className="min-w-52 flex-1">
            <TextInput
              aria-label="Shu sahifada mijoz qidirish"
              placeholder="Shu sahifada: ism, telefon yoki email"
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

        <Pagination
          count={customers.length}
          isLoading={isLoading}
          noun="mijoz"
          offset={offset}
          onOffsetChange={setOffset}
          pageSize={pageSize}
        />
      </Card>
    </div>
  );
}
