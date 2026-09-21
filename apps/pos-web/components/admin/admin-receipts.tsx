"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch, SessionExpiredError } from "../../lib/api";
import { useApiResource } from "../../lib/use-api-resource";
import { canSwitchBranch } from "../../lib/admin-nav";
import {
  formatDateTime,
  formatMoney,
  orderSourceLabels,
  orderStatusLabels,
  orderStatusTone,
  type OrderSource,
  type OrderStatus,
  type PaymentStatus,
} from "../../lib/order-display";
import { useAuth } from "../auth/auth-provider";
import { hasPermission } from "../../lib/auth";
import { Badge } from "../admin-ui/badge";
import { Button, ButtonLink } from "../admin-ui/button";
import { Card, CardHeader } from "../admin-ui/card";
import {
  DataTable,
  RowAction,
  type DataTableColumn,
} from "../admin-ui/data-table";
import { ErrorState, SkeletonRows } from "../admin-ui/feedback";
import { FilterBar, FormField, Select, TextInput } from "../admin-ui/form";
import { Modal } from "../admin-ui/modal";
import { Pagination } from "../admin-ui/pagination";
import { InfoBox, StatGrid } from "../admin-ui/stat-box";
import { useToast } from "../admin-ui/toast";
import { moneyCell, numberCell } from "./admin-report-views";

/*
 * Cheklar ro'yxati.
 *
 * `GET /receipts` 4-bosqichda qo'shildi. Ro'yxat chek MAZMUNINI qaytarmaydi —
 * `content` va ESC/POS satri faqat bitta chek so'ralganda keladi.
 *
 * Detal `GET /receipts/:id` dan keladi va chek tarkibini beradi.
 *
 * Chek detalidagi "Qayta chop etish" durable printer navbatiga yangi ish
 * qo'yadi. Desktop agent uni o'zida tanlangan Windows printeriga yuboradi.
 * Brauzer chop etishi alohida zaxira yo'l bo'lib qoladi.
 *
 * TUZATILGAN NUQSON: "chop etilgan" filtri FAQAT joriy sahifa ichida
 * ishlardi, sahifalash esa filtrlanmagan sonni ko'rsatardi — jadvalda uch
 * qator turib, pastda "1–50-chek" yozilardi. `ListReceiptsDto` da
 * `printed?: boolean` allaqachon bor edi (`from`/`to` ham), ya'ni filtr
 * mijoz tomonida bo'lishi umuman shart emasdi. Endi u SERVERGA yuboriladi
 * va sahifalash haqiqiy natijani sanaydi.
 */

type Branch = { id: string; code: string; name: string };

type Receipt = {
  id: string;
  documentType: string;
  receiptNumber: string;
  total: string;
  printed: boolean;
  printedAt?: string | null;
  createdAt: string;
  orderId: string;
  branch?: { id: string; code: string; name: string } | null;
  order?: {
    id: string;
    orderNumber: string;
    displayOrderNumber?: string | null;
    status: OrderStatus;
    paymentStatus: PaymentStatus;
    source: OrderSource;
  } | null;
};

type ReceiptDetail = Receipt & {
  content?: unknown;
  order?: {
    id: string;
    orderNumber: string;
    status: OrderStatus;
    paymentStatus: PaymentStatus;
    source: OrderSource;
    items?: {
      id: string;
      productName: string;
      variantName?: string | null;
      quantity: string;
      totalPrice: string;
    }[];
    payments?: {
      id: string;
      amount: string;
      method?: { code: string; name: string } | null;
    }[];
  } | null;
};


type PrintJob = {
  id: string;
  status: "PENDING" | "PROCESSING" | "PRINTED" | "DEAD_LETTER" | "CANCELLED";
  attemptCount: number;
  maxAttempts: number;
  nextAttemptAt: string;
  leaseExpiresAt?: string | null;
  lastError?: string | null;
  printedAt?: string | null;
  createdAt: string;
  branch: { id: string; name: string; code: string };
  receipt: { id: string; receiptNumber: string; total: string; content?: unknown; order?: { orderNumber: string; displayOrderNumber?: string | null } | null };
  printer?: { id: string; name: string; type: string; metadata?: unknown } | null;
  attempts: Array<{ agentId: string; outcome: string; startedAt: string; completedAt?: string | null }>;
};

const printJobStatusLabels: Record<PrintJob["status"], string> = {
  PENDING: "Navbatda", PROCESSING: "Printerda", PRINTED: "Chop etildi", DEAD_LETTER: "Xato bilan to'xtadi", CANCELLED: "Bekor qilingan",
};

function printJobTone(status: PrintJob["status"]): "success" | "warning" | "danger" | "info" | "neutral" {
  if (status === "PRINTED") return "success";
  if (status === "DEAD_LETTER") return "danger";
  if (status === "PROCESSING") return "info";
  if (status === "PENDING") return "warning";
  return "neutral";
}
const pageSize = 25;

export function AdminReceiptsPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const canMarkPrinted = hasPermission(user, "RECEIPT_PRINT");
  const [detail, setDetail] = useState<ReceiptDetail | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isMarking, setIsMarking] = useState(false);
  const showBranchFilter = canSwitchBranch(user);

  const [branches, setBranches] = useState<Branch[]>([]);
  const [printed, setPrinted] = useState("");
  const [branchId, setBranchId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [offset, setOffset] = useState(0);
  const [printJobStatus, setPrintJobStatus] = useState("");
  const [busyPrintJobId, setBusyPrintJobId] = useState<string | null>(null);

  useEffect(() => {
    if (!showBranchFilter) {
      return;
    }

    void apiFetch<Branch[]>("/branches")
      .then(setBranches)
      .catch(() => {
        // Filial ro'yxati ixtiyoriy.
      });
  }, [showBranchFilter]);

  const openDetail = useCallback(
    async (receiptId: string) => {
      setDetailId(receiptId);
      setDetail(null);
      setIsDetailLoading(true);

      try {
        setDetail(await apiFetch<ReceiptDetail>(`/receipts/${receiptId}`));
      } catch (caught) {
        if (caught instanceof SessionExpiredError) {
          return;
        }

        showToast(
          caught instanceof Error ? caught.message : "Chekni yuklab bo'lmadi.",
          "danger",
        );
        setDetailId(null);
      } finally {
        setIsDetailLoading(false);
      }
    },
    [showToast],
  );

  const rangeError =
    from && to && from > to
      ? "Boshlanish sanasi tugash sanasidan keyin bo'lmasligi kerak."
      : "";

  const {
    data,
    isLoading,
    error,
    reload: load,
  } = useApiResource(
    () => {
      if (rangeError) {
        return Promise.resolve<Receipt[]>([]);
      }

      const params = new URLSearchParams({
        limit: String(pageSize),
        offset: String(offset),
      });
      if (branchId) params.set("branchId", branchId);
      /* Serverdagi filtr — sahifalash bilan mos keladi. */
      if (printed) params.set("printed", printed === "PRINTED" ? "true" : "false");
      if (from) params.set("from", `${from}T00:00:00.000Z`);
      if (to) params.set("to", `${to}T23:59:59.999Z`);
      return apiFetch<Receipt[]>(`/receipts?${params.toString()}`);
    },
    [branchId, offset, printed, from, to, rangeError],
    "Cheklarni yuklab bo'lmadi.",
  );
  const receipts = data ?? [];
  const { data: printJobData, isLoading: isPrintJobsLoading, error: printJobsError, reload: reloadPrintJobs } = useApiResource(
    () => {
      const params = new URLSearchParams({ limit: "25" });
      if (branchId) params.set("branchId", branchId);
      if (printJobStatus) params.set("status", printJobStatus);
      return apiFetch<PrintJob[]>(`/receipts/print-jobs?${params.toString()}`);
    },
    [branchId, printJobStatus],
    "Chop navbatini yuklab bo'lmadi.",
  );
  const printJobs = printJobData ?? [];
  const printJobColumns: DataTableColumn<PrintJob>[] = [
    { key: "receipt", header: "Chek", primary: true, render: (job) => <div className="min-w-0"><p className="font-semibold text-mz-text">{job.receipt.receiptNumber}</p><p className="truncate text-[13px] text-mz-text-muted">{job.receipt.order?.displayOrderNumber ?? job.receipt.order?.orderNumber ?? "Buyurtma"} · {job.branch.name}</p>{job.lastError ? <p className="mt-1 max-w-80 truncate text-[12px] text-mz-danger" title={job.lastError}>{job.lastError}</p> : null}</div> },
    { key: "status", header: "Holat", render: (job) => <Badge tone={printJobTone(job.status)} withDot>{printJobStatusLabels[job.status]}</Badge> },
    { key: "attempts", header: "Urinish", hideOnMobile: true, render: (job) => `${job.attemptCount}/${job.maxAttempts}` },
    { key: "printer", header: "Printer", hideOnMobile: true, render: (job) => job.printer?.name ?? "Zaxira printer" },
    { key: "agent", header: "Agent", hideOnMobile: true, render: (job) => job.attempts[0]?.agentId ?? "—" },
    { key: "next", header: "Keyingi amal", hideOnMobile: true, render: (job) => job.status === "PRINTED" && job.printedAt ? formatDateTime(job.printedAt) : formatDateTime(job.nextAttemptAt) },
  ];

  async function retryPrintJob(job: PrintJob): Promise<void> {
    setBusyPrintJobId(job.id);
    try {
      await apiFetch(`/receipts/print-jobs/${job.id}/retry`, { method: "POST" });
      showToast("Chop ishi qayta navbatga qo'yildi.", "success");
      await reloadPrintJobs();
    } catch (caught) {
      if (caught instanceof SessionExpiredError) return;
      showToast(caught instanceof Error ? caught.message : "Chop ishini qayta yuborib bo'lmadi.", "danger");
    } finally {
      setBusyPrintJobId(null);
    }
  }


  async function reprintReceipt(): Promise<void> {
    if (!detail) return;
    setIsMarking(true);
    try {
      setDetail(await apiFetch<ReceiptDetail>(`/receipts/${detail.id}/reprint`, { method: "POST" }));
      showToast("Chek chop navbatiga qayta yuborildi.", "success");
      await Promise.all([load(), reloadPrintJobs()]);
    } catch (caught) {
      if (caught instanceof SessionExpiredError) return;
      showToast(caught instanceof Error ? caught.message : "Qayta chop etib bo'lmadi.", "danger");
    } finally {
      setIsMarking(false);
    }
  }

  const stats = useMemo(() => {
    const printedCount = receipts.filter((receipt) => receipt.printed).length;
    const amount = receipts.reduce(
      (sum, receipt) => sum + Number(receipt.total ?? 0),
      0,
    );

    return { printedCount, amount, total: receipts.length };
  }, [receipts]);

  const columns: DataTableColumn<Receipt>[] = [
    {
      key: "receipt",
      header: "Chek",
      primary: true,
      render: (receipt) => (
        <div className="min-w-0">
          <p className="truncate font-semibold text-mz-text">
            {receipt.receiptNumber}
          </p>
          <p className="truncate text-[13px] text-mz-text-muted">
            {formatDateTime(receipt.createdAt)}
            {receipt.order
              ? ` · ${orderSourceLabels[receipt.order.source]}`
              : ""}
          </p>
        </div>
      ),
    },
    {
      key: "order",
      header: "Buyurtma",
      render: (receipt) =>
        receipt.order
          ? (receipt.order.displayOrderNumber ?? receipt.order.orderNumber)
          : "—",
    },
    {
      key: "documentType",
      header: "Hujjat turi",
      hideOnMobile: true,
      render: (receipt) => (
        <Badge tone="neutral">
          {receipt.documentType === "KITCHEN"
            ? "Oshxona"
            : receipt.documentType === "CANCELLATION"
              ? "Bekor qilish"
              : receipt.documentType.startsWith("REFUND")
                ? "Pul qaytarish"
                : "Mijoz cheki"}
        </Badge>
      ),
    },
    {
      key: "orderStatus",
      header: "Buyurtma holati",
      hideOnMobile: true,
      render: (receipt) =>
        receipt.order ? (
          <Badge tone={orderStatusTone(receipt.order.status)}>
            {orderStatusLabels[receipt.order.status]}
          </Badge>
        ) : (
          "—"
        ),
    },
    {
      key: "branch",
      header: "Filial",
      hideOnMobile: true,
      render: (receipt) => receipt.branch?.name ?? "—",
    },
    {
      key: "printed",
      header: "Chop etilgan",
      render: (receipt) => (
        <Badge tone={receipt.printed ? "success" : "neutral"} withDot>
          {receipt.printed ? "Ha" : "Yo'q"}
        </Badge>
      ),
    },
    {
      key: "total",
      header: "Summa",
      align: "right",
      render: (receipt) => (
        <span className={moneyCell}>{formatMoney(receipt.total)}</span>
      ),
    },
  ];

  return (
    <div className="grid gap-5">
      {error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : null}

      <StatGrid>
        <InfoBox
          icon="scroll"
          label="Ko'rsatilgan chek"
          value={`${stats.total} ta`}
        />
        <InfoBox
          description="Shu sahifada"
          icon="printer"
          label="Chop etilgan"
          tone="success"
          value={`${stats.printedCount} ta`}
        />
        <InfoBox
          description="Shu sahifada"
          icon="alert"
          label="Chop etilmagan"
          tone={stats.total - stats.printedCount > 0 ? "warning" : "neutral"}
          value={`${stats.total - stats.printedCount} ta`}
        />
        <InfoBox
          icon="banknote"
          label="Summa (sahifada)"
          tone="brand"
          value={formatMoney(stats.amount)}
        />
      </StatGrid>

      <Card>
        <CardHeader
          actions={<Button onClick={() => void reloadPrintJobs()} size="sm" variant="secondary">Yangilash</Button>}
          description="Yangi printer agentining navbati va oxirgi urinishlari"
          title="Chop navbati"
        />
        <FilterBar><div className="w-56"><FormField label="Navbat holati">{(props) => <Select {...props} value={printJobStatus} onChange={(event) => setPrintJobStatus(event.target.value)}><option value="">Barcha holatlar</option><option value="PENDING">Navbatda</option><option value="PROCESSING">Printerda</option><option value="PRINTED">Chop etildi</option><option value="DEAD_LETTER">Xato bilan to'xtadi</option></Select>}</FormField></div></FilterBar>
        {printJobsError ? <ErrorState message={printJobsError} onRetry={() => void reloadPrintJobs()} /> : <DataTable caption="Chop etish ishlari" columns={printJobColumns} emptyDescription="Yangi chek yaratilganda u shu yerda ko‘rinadi." emptyTitle="Chop navbati bo‘sh" getRowKey={(job) => job.id} isLoading={isPrintJobsLoading} rowActions={(job) => job.status === "DEAD_LETTER" || job.status === "PENDING" || (job.status === "PROCESSING" && Boolean(job.leaseExpiresAt) && new Date(job.leaseExpiresAt!).getTime() <= Date.now()) ? <RowAction icon="send" label={busyPrintJobId === job.id ? "Qayta yuborilmoqda" : `${job.receipt.receiptNumber} — qayta navbatga yuborish`} onClick={() => void retryPrintJob(job)} /> : null} rows={printJobs} />}
      </Card>
      <Card>
        <CardHeader
          description="Cheklar, brauzer chop etishi va ishonchli printer navbati"
          title="Cheklar"
        />

        <FilterBar>
          <div className="w-48">
            <FormField label="Chop etilish holati">
              {(props) => (
                <Select
                  {...props}
                  onChange={(event) => {
                    setPrinted(event.target.value);
                    setOffset(0);
                  }}
                  value={printed}
                >
                  <option value="">Barchasi</option>
                  <option value="PRINTED">Chop etilgan</option>
                  <option value="NOT_PRINTED">Chop etilmagan</option>
                </Select>
              )}
            </FormField>
          </div>

          {showBranchFilter ? (
            <div className="w-56">
              <FormField label="Filial">
                {(props) => (
                  <Select
                    {...props}
                    onChange={(event) => {
                      setBranchId(event.target.value);
                      setOffset(0);
                    }}
                    value={branchId}
                  >
                    <option value="">Barcha filiallar</option>
                    {branches.map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name}
                      </option>
                    ))}
                  </Select>
                )}
              </FormField>
            </div>
          ) : null}

          <div className="w-44">
            <FormField error={rangeError} label="Sana (dan)">
              {(props) => (
                <TextInput
                  {...props}
                  onChange={(event) => {
                    setFrom(event.target.value);
                    setOffset(0);
                  }}
                  type="date"
                  value={from}
                />
              )}
            </FormField>
          </div>

          <div className="w-44">
            <FormField label="Sana (gacha)">
              {(props) => (
                <TextInput
                  {...props}
                  onChange={(event) => {
                    setTo(event.target.value);
                    setOffset(0);
                  }}
                  type="date"
                  value={to}
                />
              )}
            </FormField>
          </div>
        </FilterBar>

        <DataTable
          caption="Cheklar ro'yxati"
          columns={columns}
          emptyDescription={
            rangeError
              ? "Sana oralig'ini to'g'rilang."
              : "Filtrni o'zgartirib ko'ring yoki boshqa sahifaga o'ting."
          }
          emptyTitle={rangeError ? "Oraliq noto'g'ri" : "Chek topilmadi"}
          getRowKey={(receipt) => receipt.id}
          isLoading={isLoading}
          rowActions={(receipt) => (
            <>
              <RowAction
                icon="eye"
                label={`${receipt.receiptNumber} — ochish`}
                onClick={() => void openDetail(receipt.id)}
              />
              <RowAction
                href={`/admin/orders/${receipt.orderId}`}
                icon="externalLink"
                label={`${receipt.receiptNumber} — buyurtmani ochish`}
              />
            </>
          )}
          rows={receipts}
        />

        <Pagination
          count={receipts.length}
          isLoading={isLoading}
          noun="chek"
          offset={offset}
          onOffsetChange={setOffset}
          pageSize={pageSize}
        />
      </Card>

      <Modal
        footer={
          <>
            <Button onClick={() => setDetailId(null)} variant="ghost">
              Yopish
            </Button>
            {/*
             * HAQIQIY chop etish — kassa chek ekrani (`window.print()`).
             * Bu ekranning o'zida printer integratsiyasi yo'q, shuning
             * uchun havola aynan shu nom bilan turadi.
             */}
            {canMarkPrinted && detail ? (
              <ButtonLink
                href={`/pos/receipt/${detail.id}`}
                target="_blank"
                variant="secondary"
              >
                Brauzerda chop etish
              </ButtonLink>
            ) : null}
            {canMarkPrinted && detail ? (
              <Button isLoading={isMarking} onClick={() => void reprintReceipt()} size="lg">
                Qayta chop etish
              </Button>
            ) : null}
          </>
        }
        isOpen={detailId !== null}
        onClose={() => setDetailId(null)}
        title={detail ? detail.receiptNumber : "Chek"}
      >
        {isDetailLoading || !detail ? (
          <SkeletonRows rows={5} />
        ) : (
          <div className="grid gap-4 text-sm">
            <div className="flex flex-wrap gap-2">
              <Badge tone={detail.printed ? "success" : "warning"} withDot>
                {detail.printed ? "Chop etilgan" : "Chop etilmagan"}
              </Badge>
              {detail.branch ? (
                <Badge tone="neutral">{detail.branch.name}</Badge>
              ) : null}
              {detail.order ? (
                <Badge tone={orderStatusTone(detail.order.status)}>
                  {orderStatusLabels[detail.order.status]}
                </Badge>
              ) : null}
            </div>

            <dl className="grid gap-1 text-[13px]">
              <div className="flex justify-between gap-4">
                <dt className="text-mz-text-muted">Buyurtma</dt>
                <dd className="font-semibold text-mz-text">
                  {detail.order?.orderNumber ?? "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-mz-text-muted">Yaratilgan</dt>
                <dd className="text-mz-text">
                  {formatDateTime(detail.createdAt)}
                </dd>
              </div>
              {detail.printedAt ? (
                <div className="flex justify-between gap-4">
                  <dt className="text-mz-text-muted">Chop etilgan</dt>
                  <dd className="text-mz-text">
                    {formatDateTime(detail.printedAt)}
                  </dd>
                </div>
              ) : null}
            </dl>

            {detail.order?.items && detail.order.items.length > 0 ? (
              <div className="rounded-mz-control border border-mz-border">
                <p className="border-b border-mz-border bg-mz-surface-sunken px-3 py-2 text-[13px] font-bold uppercase tracking-wide text-mz-text-muted">
                  Tarkib
                </p>
                <ul className="divide-y divide-mz-border">
                  {detail.order.items.map((item) => (
                    <li
                      className="flex items-baseline gap-3 px-3 py-2"
                      key={item.id}
                    >
                      <span className="min-w-0 flex-1 truncate text-mz-text">
                        {item.productName}
                        {item.variantName ? ` · ${item.variantName}` : ""}
                      </span>
                      <span className="shrink-0 text-[13px] text-mz-text-muted">
                        ×<span className={numberCell}>{Number(item.quantity)}</span>
                      </span>
                      <span className={`shrink-0 ${moneyCell}`}>
                        {formatMoney(item.totalPrice)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {detail.order?.payments && detail.order.payments.length > 0 ? (
              <dl className="grid gap-1 text-[13px]">
                {detail.order.payments.map((payment) => (
                  <div className="flex justify-between gap-4" key={payment.id}>
                    <dt className="text-mz-text-muted">
                      {payment.method?.name ?? payment.method?.code ?? "To'lov"}
                    </dt>
                    <dd className={moneyCell}>{formatMoney(payment.amount)}</dd>
                  </div>
                ))}
              </dl>
            ) : null}

            <div className="flex items-baseline justify-between border-t border-mz-border pt-3">
              <span className="font-semibold text-mz-text">Jami</span>
              <span className="text-lg font-bold tabular-nums text-mz-text">
                {formatMoney(detail.total)}
              </span>
            </div>

            <p className="rounded-mz-control border border-mz-border border-l-4 border-l-mz-info bg-mz-surface px-3 py-2 text-[13px] text-mz-text-muted">
              Qayta chop etish chekning yangi printer navbatini yaratadi. Desktop agent navbatni olib, tanlangan printerga yuboradi; bekor qilish cheki ham shu oqimda ishlaydi.
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
}
