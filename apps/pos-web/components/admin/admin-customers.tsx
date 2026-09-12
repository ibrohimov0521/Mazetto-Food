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
import { Card, CardBody, CardHeader } from "../admin-ui/card";
import { DataTable, RowAction, type DataTableColumn } from "../admin-ui/data-table";
import { ErrorState, Skeleton } from "../admin-ui/feedback";
import { FilterBar, FormField, Select, TextInput } from "../admin-ui/form";
import { Modal } from "../admin-ui/modal";
import { Pagination } from "../admin-ui/pagination";
import { InfoBox, StatGrid } from "../admin-ui/stat-box";

/*
 * Mijozlar ro'yxati.
 *
 * BU EKRAN FAQAT O'QISH — va bu backend holati, tanlov emas.
 * `apps/backend/src/modules/customers/customers.controller.ts` da admin
 * tomoni uchun faqat `GET /customers` va `GET /customers/statistics` bor.
 * Mijozni bloklash, ma'lumotini tahrirlash, izoh qo'shish yoki bonusni
 * qo'lda o'zgartirish endpoint'i YO'Q (bonus faqat buyurtma oqimida
 * hisoblanadi). Shuning uchun bu yerda hech qanday "saqlash" tugmasi yo'q —
 * ishlamaydigan tugma qo'yish yomonroq bo'lardi. Kerakli endpointlar
 * hisobotda sanab o'tilgan.
 *
 * PII. Telefon raqamlari ro'yxatda qisman yashirilgan. To'liq ko'rish uchun
 * qatordagi tugma bosiladi — ochish harakati ONGLI bo'lishi uchun.
 *
 * SAHIFALASH VA QIDIRUV. `/customers` faqat `limit`/`offset` qabul qiladi;
 * server tomonda qidiruv YO'Q. Shuning uchun qidiruv va kanal filtri
 * BRAUZERDA, faqat joriy sahifa ichida ishlaydi va yorliqlar shuni ochiq
 * aytadi — aks holda foydalanuvchi butun bazada qidiryapman deb o'ylardi.
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
  const [detail, setDetail] = useState<Customer | null>(null);

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

  const hasFilters = Boolean(query.trim() || channel);

  function togglePhone(id: string): void {
    setRevealedIds((current) => {
      const next = new Set(current);

      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }

      return next;
    });
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
            <p className="truncate text-[13px] text-mz-text-muted">
              {customer.email}
            </p>
          ) : null}
        </div>
      ),
    },
    {
      key: "phone",
      header: "Telefon",
      render: (customer) => {
        const isRevealed = revealedIds.has(customer.id);

        return (
          <span className="inline-flex items-center gap-2">
            <span className={isRevealed ? "text-mz-text" : "text-mz-text-muted"}>
              {isRevealed ? customer.phone : maskPhone(customer.phone)}
            </span>
            <Button
              /*
               * `aria-label` da mijoz ismi bor: jadvalda 50 ta bir xil
               * "Ko'rsatish" tugmasi ekran o'quvchi uchun farqlanmasdi.
               */
              aria-label={
                isRevealed
                  ? `${customer.name} raqamini yashirish`
                  : `${customer.name} to'liq raqamini ko'rsatish`
              }
              aria-pressed={isRevealed}
              onClick={() => togglePhone(customer.id)}
              variant="ghost"
            >
              {isRevealed ? "Yashirish" : "Ko'rsatish"}
            </Button>
          </span>
        );
      },
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
      render: (customer) => (
        <span className="font-semibold text-mz-primary-hover">
          {formatMoney(customer.bonusBalance)}
        </span>
      ),
    },
    {
      key: "created",
      header: "Ro'yxatdan o'tgan",
      align: "right",
      hideOnMobile: true,
      render: (customer) => (
        <span className="text-[13px] text-mz-text-muted">
          {formatDateTime(customer.createdAt)}
        </span>
      ),
    },
  ];

  if (isLoading && !data) {
    return (
      <div aria-busy="true" className="grid gap-5">
        <span className="sr-only">Yuklanmoqda</span>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((index) => (
            <Skeleton className="h-20 w-full" key={index} />
          ))}
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="grid gap-5">
      {error ? <ErrorState message={error} onRetry={load} /> : null}

      {stats ? (
        <StatGrid>
          <InfoBox
            description="Butun baza bo'yicha"
            icon="users"
            label="Jami mijoz"
            tone="brand"
            value={`${stats.customers} ta`}
          />
          <InfoBox
            description="Butun baza bo'yicha"
            icon="globe"
            label="Online buyurtmalar"
            value={`${stats.onlineOrders} ta`}
          />
          <InfoBox
            description="To'lanmagan bonus qoldig'i"
            icon="wallet"
            label="Bonus majburiyati"
            tone="warning"
            value={formatMoney(stats.bonusLiability)}
          />
          <InfoBox
            /*
             * Bu son FAQAT joriy sahifadan hisoblanadi — serverda kanal
             * bo'yicha sanoq yo'q. Tavsif buni ochiq aytadi.
             */
            description="Faqat shu sahifadagi yozuvlar"
            icon="send"
            label="Telegram orqali"
            value={`${customers.filter((customer) => customer.telegramUserId).length} ta`}
          />
        </StatGrid>
      ) : null}

      <Card>
        <CardHeader
          description="Mijoz yozuvlari faqat o'qish uchun: serverda admin tomonidan tahrirlash, bloklash yoki bonusni o'zgartirish imkoni yo'q."
          title="Mijozlar bazasi"
        />

        <FilterBar>
          <div className="min-w-52 flex-1">
            <FormField
              hint="Qidiruv faqat shu sahifadagi 50 yozuv ichida ishlaydi"
              label="Qidirish"
            >
              {(props) => (
                <TextInput
                  {...props}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Ism, telefon yoki email"
                  value={query}
                />
              )}
            </FormField>
          </div>
          <div className="w-full sm:w-48">
            <FormField label="Kanal">
              {(props) => (
                <Select
                  {...props}
                  onChange={(event) => setChannel(event.target.value)}
                  value={channel}
                >
                  <option value="">Barcha kanallar</option>
                  <option value="TELEGRAM">Telegram</option>
                  <option value="WEB">Sayt</option>
                </Select>
              )}
            </FormField>
          </div>
          {hasFilters ? (
            <Button
              onClick={() => {
                setQuery("");
                setChannel("");
              }}
              variant="ghost"
            >
              Tozalash
            </Button>
          ) : null}
        </FilterBar>

        <DataTable
          caption="Mijozlar ro'yxati"
          columns={columns}
          emptyDescription={
            hasFilters
              ? "Qidiruv faqat shu sahifada ishlaydi — keyingi sahifaga o'tib ko'ring yoki filtrni tozalang."
              : "Bu sahifada mijoz yozuvi yo'q."
          }
          emptyIcon={hasFilters ? "search" : "users"}
          emptyTitle={hasFilters ? "Mijoz topilmadi" : "Mijoz yo'q"}
          getRowKey={(customer) => customer.id}
          isLoading={isLoading}
          rowActions={(customer) => (
            <RowAction
              icon="eye"
              label={`${customer.name} kartasini ochish`}
              onClick={() => setDetail(customer)}
            />
          )}
          rows={filtered}
        />

        <Pagination
          count={customers.length}
          isLoading={isLoading}
          noun="mijoz"
          offset={offset}
          onOffsetChange={setOffset}
          pageSize={pageSize}
          {...(stats ? { total: stats.customers } : {})}
        />
      </Card>

      <Modal
        description="Faqat ko'rish. Bu ma'lumotni admin panelidan o'zgartirib bo'lmaydi."
        isOpen={detail !== null}
        onClose={() => setDetail(null)}
        title={detail?.name ?? "Mijoz"}
      >
        {detail ? (
          <dl className="grid gap-2 text-sm">
            <DetailRow label="Telefon" value={detail.phone} />
            <DetailRow label="Email" value={detail.email ?? "Kiritilmagan"} />
            <DetailRow
              label="Kanal"
              value={detail.telegramUserId ? "Telegram" : "Sayt"}
            />
            {detail.telegramLinkedAt ? (
              <DetailRow
                label="Telegram bog'langan"
                value={formatDateTime(detail.telegramLinkedAt)}
              />
            ) : null}
            <DetailRow
              label="Buyurtmalar"
              value={`${detail._count?.customerOrders ?? 0} ta`}
            />
            <DetailRow
              label="Sevimlilar"
              value={`${detail._count?.favorites ?? 0} ta`}
            />
            <DetailRow
              label="Bonus qoldig'i"
              value={formatMoney(detail.bonusBalance)}
            />
            <DetailRow
              label="Ro'yxatdan o'tgan"
              value={formatDateTime(detail.createdAt)}
            />
          </dl>
        ) : null}
      </Modal>

      <Card>
        <CardBody>
          <p className="text-[13px] text-mz-text-muted">
            Telefon raqamlari ataylab yashirilgan holda ko&apos;rsatiladi.
            Raqamni ochish — ongli harakat va u shaxsiy ma&apos;lumot
            hisoblanadi.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-mz-border pb-2 last:border-0 last:pb-0">
      <dt className="text-[13px] font-semibold text-mz-text-muted">{label}</dt>
      <dd className="text-right text-mz-text">{value}</dd>
    </div>
  );
}
