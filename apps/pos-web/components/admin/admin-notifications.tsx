"use client";

import { useState } from "react";
import { apiFetch, SessionExpiredError } from "../../lib/api";
import { formatDateTime } from "../../lib/order-display";
import { useApiResource } from "../../lib/use-api-resource";
import { Button } from "../admin-ui/button";
import { Card, CardBody, CardHeader } from "../admin-ui/card";
import { DataTable, RowAction, type DataTableColumn } from "../admin-ui/data-table";
import { ErrorState } from "../admin-ui/feedback";
import { Modal } from "../admin-ui/modal";
import { useToast } from "../admin-ui/toast";

type DeadLetter = {
  messageId: string;
  kind: string;
  orderId: string;
  error: string;
  failedAt: string;
  attempts: number;
};

function safeErrorSummary(value: string): string {
  return value
    .replace(/(https?:\/\/api\.telegram\.org\/bot)[^/\s]+/gi, "$1[redacted]")
    .replace(/\b\d{6,}:[A-Za-z0-9_-]{20,}\b/g, "[token yashirildi]")
    .replace(/\b(Bearer\s+)[A-Za-z0-9._~+/=-]+/gi, "$1[redacted]")
    .slice(0, 280);
}

export function AdminNotificationsPage() {
  const { showToast } = useToast();
  const [retryTarget, setRetryTarget] = useState<DeadLetter | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const {
    data,
    isLoading,
    error,
    reload,
    reloadAndWait,
  } = useApiResource(
    () => apiFetch<DeadLetter[]>("/notifications/dead-letters?limit=100"),
    [],
    "Telegram xabarlari yuklanmadi.",
  );
  const rows = data ?? [];

  const columns: DataTableColumn<DeadLetter>[] = [
    {
      key: "order",
      header: "Buyurtma",
      primary: true,
      render: (entry) => (
        <a
          className="font-semibold text-mz-info underline-offset-2 hover:underline"
          href={"/admin/orders/" + encodeURIComponent(entry.orderId)}
          title={entry.orderId}
        >
          #{entry.orderId.slice(-8)}
        </a>
      ),
    },
    {
      key: "kind",
      header: "Xabar turi",
      render: (entry) =>
        entry.kind === "staff_new_order" ? "Yangi buyurtma" : "Boshqa xabar",
    },
    {
      key: "error",
      header: "Natija",
      render: (entry) => {
        const summary = safeErrorSummary(entry.error);
        return (
          <span className="block max-w-md truncate text-mz-text-muted" title={summary}>
            {summary}
          </span>
        );
      },
    },
    {
      key: "attempts",
      header: "Urinish",
      render: (entry) => entry.attempts,
    },
    {
      key: "failedAt",
      header: "Vaqti",
      hideOnMobile: true,
      render: (entry) => formatDateTime(entry.failedAt),
    },
  ];

  async function retry(): Promise<void> {
    const entry = retryTarget;
    if (!entry || retryingId) return;

    setRetryingId(entry.messageId);
    try {
      await apiFetch(
        "/notifications/dead-letters/" +
          encodeURIComponent(entry.messageId) +
          "/retry",
        { method: "POST" },
      );
      setRetryTarget(null);
      showToast("Telegram xabari qayta yuborildi.", "success");
      await reloadAndWait();
    } catch (caught) {
      if (caught instanceof SessionExpiredError) return;
      showToast(
        caught instanceof Error
          ? caught.message
          : "Telegram xabarini qayta yuborib bo'lmadi.",
        "danger",
      );
    } finally {
      setRetryingId(null);
    }
  }

  return (
    <>
      <Card>
        <CardHeader
          title="Yetkazilmagan Telegram xabarlari"
          description="Faqat shu restoranga tegishli buyurtma xabarlari ko'rsatiladi."
          actions={
            <Button onClick={reload} size="sm" variant="ghost">
              Yangilash
            </Button>
          }
        />
        <CardBody className="p-0">
          {error ? (
            <div className="p-4">
              <ErrorState message={error} onRetry={reload} />
            </div>
          ) : (
            <DataTable
              caption="Yetkazilmagan Telegram xabarlari"
              columns={columns}
              getRowKey={(entry) => entry.messageId}
              isLoading={isLoading}
              rows={rows}
              emptyTitle="Yetkazilmagan xabar yo'q"
              emptyDescription="Yangi xabar xatolari shu yerda ko'rinadi."
              rowActions={(entry) =>
                entry.kind === "staff_new_order" && !retryingId ? (
                  <RowAction
                    icon="send"
                    label="Xabarni qayta yuborish"
                    onClick={() => setRetryTarget(entry)}
                  />
                ) : null
              }
            />
          )}
        </CardBody>
      </Card>

      <Modal
        isOpen={retryTarget !== null}
        title="Telegram xabarini qayta yuborish"
        description="Qayta yuborish mavjud buyurtmaning hozirgi holatidan yangi xabar tuzadi."
        onClose={() => {
          if (!retryingId) setRetryTarget(null);
        }}
        dismissOnBackdrop={!retryingId}
        footer={
          <>
            <Button
              disabled={retryingId !== null}
              onClick={() => setRetryTarget(null)}
              variant="ghost"
            >
              Bekor qilish
            </Button>
            <Button isLoading={retryingId !== null} onClick={() => void retry()}>
              Qayta yuborish
            </Button>
          </>
        }
      >
        <div className="rounded-mz-control border border-mz-warning bg-mz-warning-bg p-3 text-sm text-mz-warning">
          Telegram oldingi xabarni olgan bo'lishi mumkin. Qayta yuborish takroriy
          xabar chiqarishi ehtimoli bor.
        </div>
        {retryTarget ? (
          <p className="mt-3 text-sm text-mz-text-muted">
            Buyurtma: <span className="font-semibold text-mz-text">#{retryTarget.orderId.slice(-8)}</span>
          </p>
        ) : null}
      </Modal>
    </>
  );
}
