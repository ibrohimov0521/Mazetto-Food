"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "../../lib/api";
import { hasPermission } from "../../lib/auth";
import { useApiResource } from "../../lib/use-api-resource";
import {
  formatDateTime,
  formatMoney,
  maskPhone,
} from "../../lib/order-display";
import { Badge } from "../admin-ui/badge";
import { Button } from "../admin-ui/button";
import { Card, CardBody, CardHeader } from "../admin-ui/card";
import {
  DataTable,
  RowAction,
  type DataTableColumn,
} from "../admin-ui/data-table";
import { ErrorState, Skeleton } from "../admin-ui/feedback";
import { FilterBar, FormField, Select, TextInput } from "../admin-ui/form";
import { Modal } from "../admin-ui/modal";
import { Pagination } from "../admin-ui/pagination";
import { InfoBox, StatGrid } from "../admin-ui/stat-box";
import { useAuth } from "../auth/auth-provider";
import { useToast } from "../admin-ui/toast";

/*
 * Restoran mijozlari katalogi.
 *
 * Bir xil, tasdiqlangan telefon raqami tenant ichida bitta Customer profiliga
 * mos keladi. Shu profil web va Telegramdan ishlatilsa, kanallar bitta qatorda
 * ko'rsatiladi. Faqat Telegram botiga yozgan, lekin telefonini bog'lamagan
 * akkauntlar mijoz profili hisoblanmaydi va Telegram statistikasi ichida qoladi.
 *
 * PII. Telefon raqamlari qisman yashiriladi; to'liq ko'rish uchun alohida
 * tugma bosiladi. Server javobida parol xeshi yoki Telegram ID berilmaydi.
 * Qidiruv, kanal filtri va sahifalash serverda, butun tenant doirasida ishlaydi.
 */

const pageSize = 50;

type Customer = {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  telegramLinkedAt?: string | null;
  webLastSeenAt?: string | null;
  channels: Array<"WEB" | "TELEGRAM">;
  bonusBalance: string;
  createdAt: string;
  _count?: { customerOrders: number; favorites: number };
};

type CustomerPage = {
  items: Customer[];
  total: number;
  limit: number;
  offset: number;
};

type CustomerStats = {
  customers: number;
  webCustomers: number;
  telegramCustomers: number;
  multiChannelCustomers: number;
  onlineOrders: number;
  bonusLiability: string;
};

export function AdminCustomersPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const canDelete = hasPermission(user, "CUSTOMER_DELETE");
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [channel, setChannel] = useState("");
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set());
  const [offset, setOffset] = useState(0);
  const [detail, setDetail] = useState<Customer | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    const timeout = window.setTimeout(() => setSearch(query.trim()), 250);
    return () => window.clearTimeout(timeout);
  }, [query]);

  const {
    data,
    isLoading,
    error,
    reload: load,
  } = useApiResource(
    () => {
      const params = new URLSearchParams({
        limit: String(pageSize),
        offset: String(offset),
      });
      if (search) params.set("search", search);
      if (channel) params.set("channel", channel);

      return Promise.all([
        apiFetch<CustomerPage>(`/customers?${params.toString()}`),
        apiFetch<CustomerStats>("/customers/statistics"),
      ]);
    },
    [offset, search, channel],
    "Mijozlarni yuklab bo'lmadi.",
  );
  const page = data?.[0] ?? null;
  const customers = page?.items ?? [];
  const stats = data?.[1] ?? null;
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

  async function deleteSelected(): Promise<void> {
    if (!selectedIds.length) return;
    if (
      !window.confirm(
        `${selectedIds.length} ta mijozni bazadan butunlay o'chirishni tasdiqlaysizmi? Buyurtma tarixi bor mijozlar o'chirilmaydi.`,
      )
    )
      return;
    try {
      await apiFetch("/customers/bulk", {
        method: "DELETE",
        body: JSON.stringify({ ids: selectedIds }),
      });
      setSelectedIds([]);
      await load();
    } catch (caught) {
      showToast(
        caught instanceof Error
          ? caught.message
          : "Mijozlarni o'chirib bo'lmadi.",
        "danger",
      );
    }
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
            <span
              className={isRevealed ? "text-mz-text" : "text-mz-text-muted"}
            >
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
      render: (customer) => (
        <div className="flex flex-wrap gap-1.5">
          {customer.channels.includes("WEB") ? (
            <Badge tone="neutral">Sayt</Badge>
          ) : null}
          {customer.channels.includes("TELEGRAM") ? (
            <Badge tone="info">Telegram</Badge>
          ) : null}
          {!customer.channels.length ? (
            <Badge tone="neutral">Kanal aniqlanmagan</Badge>
          ) : null}
        </div>
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
            description="Takroriy kanal profillari bitta hisobda"
            icon="users"
            label="Jami mijoz"
            tone="brand"
            value={`${stats.customers} ta`}
          />
          <InfoBox
            description="Saytda tasdiqlangan akkauntlar"
            icon="globe"
            label="Sayt"
            value={`${stats.webCustomers} ta`}
          />
          <InfoBox
            description="Telegram raqami bog'langan profillar"
            icon="send"
            label="Telegram"
            value={`${stats.telegramCustomers} ta`}
          />
          <InfoBox
            description="Sayt va Telegram bitta mijoz profilida"
            icon="users"
            label="Ikkala kanal"
            tone="success"
            value={`${stats.multiChannelCustomers} ta`}
          />
          <InfoBox
            description="Butun baza bo'yicha"
            icon="receipt"
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
        </StatGrid>
      ) : null}

      <Card>
        <CardHeader
          actions={
            canDelete && selectedIds.length ? (
              <Button
                onClick={() => void deleteSelected()}
                size="sm"
                variant="danger"
              >
                {selectedIds.length} ta o&apos;chirish
              </Button>
            ) : undefined
          }
          description="Tasdiqlangan telefon bir mijoz profilini belgilaydi. Sayt va Telegramdan foydalangan odam bitta qatorda, ikkala kanal belgisi bilan ko'rinadi."
          title="Mijozlar ro'yxati"
        />

        <FilterBar>
          <div className="min-w-52 flex-1">
            <FormField
              hint="Butun restoran mijozlari bo'yicha qidiradi"
              label="Qidirish"
            >
              {(props) => (
                <TextInput
                  {...props}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setOffset(0);
                    setSelectedIds([]);
                  }}
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
                  onChange={(event) => {
                    setChannel(event.target.value);
                    setOffset(0);
                    setSelectedIds([]);
                  }}
                  value={channel}
                >
                  <option value="">Barcha kanallar</option>
                  <option value="TELEGRAM">Telegram</option>
                  <option value="WEB">Sayt</option>
                  <option value="BOTH">Sayt + Telegram</option>
                </Select>
              )}
            </FormField>
          </div>
          {hasFilters ? (
            <Button
              onClick={() => {
                setQuery("");
                setSearch("");
                setChannel("");
                setOffset(0);
                setSelectedIds([]);
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
              ? "Qidiruv yoki kanal filtriga mos mijoz topilmadi."
              : "Bu restoranda mijoz profili hali yo'q."
          }
          emptyIcon={hasFilters ? "search" : "users"}
          emptyTitle={hasFilters ? "Mijoz topilmadi" : "Mijoz yo'q"}
          getRowKey={(customer) => customer.id}
          isLoading={isLoading}
          selectable={canDelete}
          selectedKeys={selectedIds}
          onSelectionChange={setSelectedIds}
          selectionDisabled={(customer: Customer) =>
            Boolean(customer._count?.customerOrders)
          }
          rowActions={(customer) => (
            <RowAction
              icon="eye"
              label={`${customer.name} kartasini ochish`}
              onClick={() => setDetail(customer)}
            />
          )}
          rows={customers}
        />

        <Pagination
          count={customers.length}
          isLoading={isLoading}
          noun="mijoz"
          offset={offset}
          onOffsetChange={(nextOffset) => {
            setOffset(nextOffset);
            setSelectedIds([]);
          }}
          pageSize={pageSize}
          total={page?.total ?? 0}
        />
      </Card>

      <Modal
        description="Telefon tasdig'i bo'yicha yagona mijoz profili va unga bog'langan kanallar."
        isOpen={detail !== null}
        onClose={() => setDetail(null)}
        title={detail?.name ?? "Mijoz"}
      >
        {detail ? (
          <dl className="grid gap-2 text-sm">
            <DetailRow label="Telefon" value={detail.phone} />
            <DetailRow label="Email" value={detail.email ?? "Kiritilmagan"} />
            <DetailRow
              label="Ro'yxatdan o'tgan kanallar"
              value={registrationChannelLabel(detail.channels)}
            />
            {detail.webLastSeenAt ? (
              <DetailRow
                label="Saytga oxirgi kirish"
                value={formatDateTime(detail.webLastSeenAt)}
              />
            ) : null}
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

function registrationChannelLabel(channels: Customer["channels"]): string {
  const labels = [
    ...(channels.includes("WEB") ? ["Sayt"] : []),
    ...(channels.includes("TELEGRAM") ? ["Telegram"] : []),
  ];
  return labels.length ? labels.join(" + ") : "Kanal aniqlanmagan";
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-mz-border pb-2 last:border-0 last:pb-0">
      <dt className="text-[13px] font-semibold text-mz-text-muted">{label}</dt>
      <dd className="text-right text-mz-text">{value}</dd>
    </div>
  );
}
