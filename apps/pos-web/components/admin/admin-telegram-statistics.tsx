"use client";

import { apiFetch } from "../../lib/api";
import { useApiResource } from "../../lib/use-api-resource";
import { formatMoney } from "../../lib/order-display";
import { Badge } from "../admin-ui/badge";
import { Card, CardBody, CardHeader } from "../admin-ui/card";
import { EmptyState, ErrorState, SkeletonRows } from "../admin-ui/feedback";
import { InfoBox, StatBox, StatGrid } from "../admin-ui/stat-box";

type TelegramStatistics = {
  linkedCustomers: number;
  totalBotUsers: number | null;
  botUsers: number | null;
  activeBotUsers30Days: number | null;
  blockedBotUsers: number | null;
  unknownBotUserStatus: number | null;
  telegramOrders: number;
  recentOrders: number;
  recentPaidAmount: string;
  recentStatuses: { status: string; count: number }[];
};

const statusLabels: Record<string, string> = {
  NEW: "Yangi",
  CONFIRMED: "Tasdiqlangan",
  PREPARING: "Tayyorlanmoqda",
  READY: "Tayyor",
  SERVED: "Yetkazildi",
  COMPLETED: "Yakunlangan",
  CANCELLED: "Bekor qilingan",
};

const statusTone: Record<string, "success" | "warning" | "danger" | "neutral"> =
  {
    NEW: "warning",
    CONFIRMED: "warning",
    PREPARING: "warning",
    READY: "success",
    SERVED: "success",
    COMPLETED: "success",
    CANCELLED: "danger",
  };

const numberFormatter = new Intl.NumberFormat("uz-UZ");

function countLabel(value: number): string {
  return `${numberFormatter.format(value)} ta`;
}

export function AdminTelegramStatisticsPage() {
  const { data, isLoading, error, reload } = useApiResource(
    () => apiFetch<TelegramStatistics>("/customers/telegram-statistics"),
    [],
    "Telegram statistikalarini yuklab bo'lmadi.",
  );

  if (isLoading) return <SkeletonRows rows={5} />;
  if (error)
    return <ErrorState message={error} onRetry={() => void reload()} />;
  if (!data) return null;

  const statuses = Object.keys(statusLabels).map((status) => ({
    status,
    count:
      data.recentStatuses.find((entry) => entry.status === status)?.count ?? 0,
  }));
  const totalStatusCount = statuses.reduce(
    (sum, entry) => sum + entry.count,
    0,
  );
  const recentCompletedOrders =
    statuses.find((entry) => entry.status === "COMPLETED")?.count ?? 0;

  return (
    <div className="space-y-5">
      <StatGrid>
        <StatBox
          icon="user"
          label="Bloklamagani qayd qilingan bot foydalanuvchilari"
          value={data.botUsers === null ? "—" : countLabel(data.botUsers)}
          hint={
            data.botUsers === null
              ? "Faqat umumiy admin doirasida ko'rinadi"
              : "Telegram holati tasdiqlangan akkauntlar"
          }
          tone="brand"
        />
        <StatBox
          icon="users"
          label="So'nggi 30 kun faol"
          value={
            data.activeBotUsers30Days === null
              ? "—"
              : countLabel(data.activeBotUsers30Days)
          }
          hint="Oxirgi 30 kunda botga yozganlar"
          tone="neutral"
        />
        <StatBox
          icon="receipt"
          label="Telegram buyurtmalari"
          value={countLabel(data.telegramOrders)}
          hint="Jami tarix davomida"
          tone="neutral"
        />
        <StatBox
          icon="chart"
          label="So'nggi 30 kun buyurtmalari"
          value={countLabel(data.recentOrders)}
          hint={`${countLabel(recentCompletedOrders)} yakunlangan`}
          tone="success"
        />
        <StatBox
          icon="wallet"
          label="Muvaffaqiyatli to'lovlar"
          value={formatMoney(data.recentPaidAmount)}
          hint="So'nggi 30 kun; bekor qilingan va to'lanmagan buyurtmalar kirmaydi"
          tone="brand"
        />
      </StatGrid>

      <Card>
        <CardHeader
          description="Faqat Telegram orqali kelgan buyurtmalar; vaqt oralig'i so'nggi 30 kun"
          title="Telegram buyurtmalari holati"
        />
        <CardBody>
          {totalStatusCount === 0 ? (
            <EmptyState
              description="So'nggi 30 kunda Telegram orqali kelgan buyurtma yo'q."
              title="Hozircha ma'lumot yo'q"
            />
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {statuses.map(({ status, count }) => (
                <div
                  className="flex min-h-14 items-center justify-between gap-3 rounded-mz-control border border-mz-border bg-mz-surface px-3 py-2"
                  key={status}
                >
                  <Badge tone={statusTone[status] ?? "neutral"}>
                    {statusLabels[status] ?? status}
                  </Badge>
                  <span className="text-sm font-semibold text-mz-text">
                    {countLabel(count)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      <InfoBox
        description={`Telefonini bog'lagan mijozlar: ${countLabel(data.linkedCustomers)}. Bloklangani Telegram orqali qayd etilganlar: ${data.blockedBotUsers === null ? "umumiy admin doirasida" : countLabel(data.blockedBotUsers)}. Holati noma'lum eski bog'langanlar: ${data.unknownBotUserStatus === null ? "umumiy admin doirasida" : countLabel(data.unknownBotUserStatus)}. Oldin botdan foydalangan, lekin akkauntini bog'lamaganlar tarixini qayta olish imkoni yo'q. To'lov summasi muvaffaqiyatli to'lovlar bo'yicha, qaytarilgan mablag'lar alohida savdo hisobotida ko'rsatiladi.`}
        icon="alert"
        label="Hisob va tarix chegarasi"
        value={`Jami qayd qilingan: ${data.totalBotUsers === null ? "umumiy admin doirasida" : countLabel(data.totalBotUsers)}`}
        tone="warning"
      />
    </div>
  );
}
