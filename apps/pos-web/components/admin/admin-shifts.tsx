"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiFetch, SessionExpiredError } from "../../lib/api";
import { useApiResource } from "../../lib/use-api-resource";
import { canSwitchBranch } from "../../lib/admin-nav";
import { hasPermission } from "../../lib/auth";
import { formatDateTime, formatMoney } from "../../lib/order-display";
import { useAuth } from "../auth/auth-provider";
import { Badge, type BadgeTone } from "../admin-ui/badge";
import { Button, GuardedButton } from "../admin-ui/button";
import { Card, CardBody, CardHeader } from "../admin-ui/card";
import {
  DataTable,
  RowAction,
  type DataTableColumn,
} from "../admin-ui/data-table";
import { EmptyState, ErrorState, SkeletonRows } from "../admin-ui/feedback";
import {
  FilterBar,
  focusFirstInvalidField,
  FormField,
  Select,
  TextInput,
} from "../admin-ui/form";
import { Modal } from "../admin-ui/modal";
import { Pagination } from "../admin-ui/pagination";
import { InfoBox, StatGrid } from "../admin-ui/stat-box";
import { useToast } from "../admin-ui/toast";
import { moneyCell, numberCell } from "./admin-report-views";

/*
 * Xodimlarning umumiy kassasi va smena solishtiruvi.
 *
 * BU EKRAN ENDI FAQAT O'QISH UCHUN EMAS.
 *
 * Oldingi holat: ekran birorta mutatsiya yubormasdi. Ro'yxat ekrani uchun
 * bu to'g'ri, lekin bitta HAQIQIY bo'shliq bor edi — ochiq smenani YOPISH.
 * Backend'da `POST /shifts/:id/close` bor va `SUPER_ADMIN`/`BRANCH_MANAGER`
 * boshqa xodim smenasini yopishi mumkin (`canManageBranchShift`), ya'ni
 * kassir smenasini yopmasdan ketib qolganda admin qo'lidan hech narsa
 * kelmasdi va `expectedCash`/`cashDifference` hech qachon hisoblanmasdi.
 *
 * MONEY_PATH qoidalari shu ekranda:
 *   · Smena BIR MARTA yopiladi — yopilgan smenada tugma ko'rsatilmaydi
 *     (`GuardedButton` sababini aytadi), backend ham ikkinchi urinishni rad
 *     etadi.
 *   · Kutilgan, topshirilgan va farq UCHTA ALOHIDA qiymat sifatida
 *     ko'rsatiladi — bittasini ikkinchisidan chiqarib tashlamaydi.
 *   · Kamomad hech qachon yashil emas.
 *
 * NIMA QO'SHILMADI va NEGA. Kassa topshirish (`POST /cash-register/transfers`)
 * FAQAT chaqiruvchining o'z ochiq smenasidan ishlaydi — admin boshqa
 * xodimning kassasidan pul topshira olmaydi. Shuning uchun bu ekranda
 * topshirish yaratish tugmasi YO'Q. Topshiruvlar RO'YXATINI beradigan
 * admin endpoint'i ham yo'q (`/cash-register/transfers/pending` ham
 * chaqiruvchining ochiq smenasini talab qiladi) — kassa harakatlari
 * jadvalida topshirishga bog'langan yozuv belgilanadi, lekin kimdan kimga
 * ekanini ayta olmaydi. Kerakli endpoint hisobotda ko'rsatilgan.
 */

type Branch = { id: string; code: string; name: string };

type Employee = {
  id: string;
  firstName: string;
  lastName?: string | null;
} | null;

type Shift = {
  id: string;
  shiftNumber: number;
  status: "OPEN" | "CLOSED";
  openedAt: string;
  closedAt?: string | null;
  openingBalance: string;
  closingBalance?: string | null;
  expectedCash?: string | null;
  cashDifference?: string | null;
  salesTotal: string;
  cashTotal: string;
  terminalTotal?: string | null;
  clickTotal?: string | null;
  paymeTotal?: string | null;
  otherPaymentTotal?: string | null;
  refundsTotal?: string | null;
  cancellationsTotal?: string | null;
  expensesTotal?: string | null;
  incomeTotal?: string | null;
  orderCount: number;
  branch?: Branch | null;
  employee?: Employee;
  device?: { id: string; name: string } | null;
};

/** `CashTransactionType` — schema.prisma dagi to'liq ro'yxat. */
type CashTransactionType =
  | "OPENING"
  | "OPENING_BALANCE"
  | "SALE"
  | "REFUND"
  | "EXPENSE"
  | "WITHDRAW"
  | "INCOME"
  | "CASH_IN"
  | "CASH_OUT"
  | "CLOSING"
  | "CLOSING_BALANCE";

type CashTransaction = {
  id: string;
  type: CashTransactionType;
  amount: string;
  reason?: string | null;
  occurredAt: string;
  cashTransferId?: string | null;
  employee?: { firstName: string; lastName?: string | null } | null;
  order?: { id: string; orderNumber: string } | null;
};

const cashTypeLabels: Record<CashTransactionType, string> = {
  OPENING: "Boshlang'ich",
  OPENING_BALANCE: "Boshlang'ich qoldiq",
  SALE: "Sotuv",
  REFUND: "Qaytarish",
  EXPENSE: "Xarajat",
  WITHDRAW: "Chiqarildi",
  INCOME: "Kirim",
  CASH_IN: "Naqd qabul qilindi",
  CASH_OUT: "Naqd topshirildi",
  CLOSING: "Yopilish",
  CLOSING_BALANCE: "Yopilish qoldig'i",
};

/*
 * Kassa qoldig'iga TA'SIRI — backend `calculateCashBalance` bilan bir xil.
 * Yopilish yozuvlari qoldiqqa qo'shilmaydi (ular faqat qayd).
 */
const cashTypeSign: Record<CashTransactionType, -1 | 0 | 1> = {
  OPENING: 1,
  OPENING_BALANCE: 1,
  SALE: 1,
  INCOME: 1,
  CASH_IN: 1,
  REFUND: -1,
  EXPENSE: -1,
  WITHDRAW: -1,
  CASH_OUT: -1,
  CLOSING: 0,
  CLOSING_BALANCE: 0,
};

function cashTypeTone(type: CashTransactionType): BadgeTone {
  const sign = cashTypeSign[type];

  if (type === "REFUND") return "danger";
  if (sign === -1) return "warning";
  if (sign === 0) return "neutral";
  return "success";
}

const pageSize = 25;

function employeeName(employee: Employee | undefined): string {
  if (!employee) {
    return "—";
  }

  return [employee.firstName, employee.lastName].filter(Boolean).join(" ");
}

/**
 * Kassa farqi.
 *
 * DESIGN_RULES: KAMOMAD hech qachon muvaffaqiyat rangida ko'rsatilmaydi.
 * Ortiqcha pul ham "yaxshi" emas — u ham qayd etilmagan tushum yoki
 * sanoq xatosi belgisi, shuning uchun OGOHLANTIRISH rangida.
 */
function differenceTone(difference: number): {
  className: string;
  label: string;
} {
  if (Math.abs(difference) < 0.01) {
    return { className: "text-mz-success", label: "To'g'ri" };
  }

  if (difference < 0) {
    return {
      className: "font-semibold text-mz-danger",
      label: `Kamomad ${formatMoney(Math.abs(difference))}`,
    };
  }

  return {
    className: "font-semibold text-mz-warning",
    label: `Ortiqcha ${formatMoney(difference)}`,
  };
}

export function AdminShiftsPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const showBranchFilter = canSwitchBranch(user);
  const canClose = hasPermission(user, "SHIFT_CLOSE");

  const [branches, setBranches] = useState<Branch[]>([]);
  const [status, setStatus] = useState("");
  const [branchId, setBranchId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [offset, setOffset] = useState(0);

  const [detail, setDetail] = useState<Shift | null>(null);
  const [closing, setClosing] = useState<Shift | null>(null);
  const [closingBalance, setClosingBalance] = useState("");
  const [closeError, setCloseError] = useState("");
  const [isClosing, setIsClosing] = useState(false);
  const closeFormRef = useRef<HTMLFormElement>(null);

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
        return Promise.resolve<Shift[]>([]);
      }

      const params = new URLSearchParams({
        limit: String(pageSize),
        offset: String(offset),
      });
      if (status) params.set("status", status);
      if (branchId) params.set("branchId", branchId);
      /* Backend `from`/`to` ni `openedAt` bo'yicha ISO8601 kutadi. */
      if (from) params.set("from", `${from}T00:00:00.000Z`);
      if (to) params.set("to", `${to}T23:59:59.999Z`);
      return apiFetch<Shift[]>(`/shifts?${params.toString()}`);
    },
    [branchId, offset, status, from, to, rangeError],
    "Smenalarni yuklab bo'lmadi.",
  );
  const shifts = data ?? [];

  const stats = useMemo(() => {
    const open = shifts.filter((shift) => shift.status === "OPEN").length;
    const sales = shifts.reduce(
      (sum, shift) => sum + Number(shift.salesTotal ?? 0),
      0,
    );
    const shortage = shifts.reduce((sum, shift) => {
      const difference = Number(shift.cashDifference ?? 0);
      return difference < -0.01 ? sum + Math.abs(difference) : sum;
    }, 0);
    const mismatched = shifts.filter(
      (shift) =>
        shift.cashDifference != null &&
        Math.abs(Number(shift.cashDifference)) > 0.01,
    ).length;

    return { open, sales, mismatched, shortage, total: shifts.length };
  }, [shifts]);

  const openCloseDialog = useCallback((shift: Shift) => {
    setClosing(shift);
    setCloseError("");
    setClosingBalance("");
  }, []);

  async function submitClose(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!closing) {
      return;
    }

    const amount = Number(closingBalance);

    if (closingBalance.trim() === "" || !Number.isFinite(amount) || amount < 0) {
      setCloseError("Sanab olingan naqd summani kiriting (0 yoki katta son).");
      /*
       * Inline xato + birinchi noto'g'ri maydonga fokus. Ilgari butun panel
       * bo'ylab validatsiya 5 soniyalik toast'ga ketardi va qaysi maydon
       * aybdor ekani aytilmasdi.
       */
      requestAnimationFrame(() =>
        focusFirstInvalidField(closeFormRef.current),
      );
      return;
    }

    setIsClosing(true);
    setCloseError("");

    try {
      const closed = await apiFetch<Shift>(`/shifts/${closing.id}/close`, {
        method: "POST",
        body: JSON.stringify({ closingBalance: amount }),
      });

      showToast(
        `#${closed.shiftNumber} smena yopildi. Farq: ${formatMoney(closed.cashDifference)}`,
        "success",
      );
      setClosing(null);
      setDetail(closed);
      load();
    } catch (caught) {
      if (caught instanceof SessionExpiredError) {
        return;
      }

      /*
       * Server rad etishi ham INLINE ko'rsatiladi: sabablar aniq va
       * amal qilinadigan ("topshirish tasdiqlanmagan", "xodim bu filialda
       * faol emas"), toast esa ularni 10 soniyada olib ketardi.
       */
      setCloseError(
        caught instanceof Error ? caught.message : "Smenani yopib bo'lmadi.",
      );
    } finally {
      setIsClosing(false);
    }
  }

  const columns: DataTableColumn<Shift>[] = [
    {
      key: "shift",
      header: "Smena",
      primary: true,
      render: (shift) => (
        <div className="min-w-0">
          <p className="truncate font-semibold text-mz-text">
            #{shift.shiftNumber} · {employeeName(shift.employee)}
          </p>
          <p className="truncate text-[13px] text-mz-text-muted">
            {formatDateTime(shift.openedAt)}
            {shift.closedAt ? ` — ${formatDateTime(shift.closedAt)}` : ""}
          </p>
        </div>
      ),
    },
    {
      key: "branch",
      header: "Filial",
      hideOnMobile: true,
      render: (shift) => shift.branch?.name ?? "—",
    },
    {
      key: "orders",
      header: "Buyurtma",
      align: "right",
      hideOnMobile: true,
      render: (shift) => (
        <span className={numberCell}>{shift.orderCount} ta</span>
      ),
    },
    {
      key: "sales",
      header: "Savdo",
      align: "right",
      render: (shift) => (
        <span className={moneyCell}>{formatMoney(shift.salesTotal)}</span>
      ),
    },
    {
      key: "expected",
      header: "Kutilgan naqd",
      align: "right",
      hideOnMobile: true,
      render: (shift) => (
        <span className={numberCell}>{formatMoney(shift.expectedCash)}</span>
      ),
    },
    {
      key: "actual",
      header: "Topshirilgan",
      align: "right",
      hideOnMobile: true,
      render: (shift) => (
        <span className={numberCell}>{formatMoney(shift.closingBalance)}</span>
      ),
    },
    {
      key: "difference",
      header: "Farq",
      align: "right",
      render: (shift) => {
        if (shift.cashDifference == null) {
          return <span className="text-mz-text-faint">—</span>;
        }

        const difference = Number(shift.cashDifference);
        const tone = differenceTone(difference);

        return (
          <span className={`tabular-nums ${tone.className}`}>{tone.label}</span>
        );
      },
    },
    {
      key: "status",
      header: "Holat",
      align: "right",
      render: (shift) => (
        <Badge tone={shift.status === "OPEN" ? "info" : "neutral"} withDot>
          {shift.status === "OPEN" ? "Ochiq" : "Yopilgan"}
        </Badge>
      ),
    },
  ];

  return (
    <div className="grid gap-5">
      {error ? <ErrorState message={error} onRetry={() => load()} /> : null}

      <StatGrid>
        <InfoBox
          icon="clipboard"
          label="Ko'rsatilgan smena"
          value={`${stats.total} ta`}
        />
        <InfoBox
          icon="clock"
          label="Ochiq smena"
          tone={stats.open > 0 ? "warning" : "neutral"}
          value={`${stats.open} ta`}
        />
        <InfoBox
          description="Sahifadagi smenalar bo'yicha"
          icon="wallet"
          label="Savdo"
          tone="brand"
          value={formatMoney(stats.sales)}
        />
        <InfoBox
          description={
            stats.shortage > 0
              ? `Jami kamomad ${formatMoney(stats.shortage)}`
              : "Kamomad yo'q"
          }
          icon="alert"
          label="Kassa farqi bor"
          tone={stats.mismatched > 0 ? "danger" : "success"}
          value={`${stats.mismatched} ta`}
        />
      </StatGrid>

      <Card>
        <CardHeader
          description="Kutilgan, topshirilgan va farq alohida ko'rsatiladi"
          title="Smenalar"
        />

        <FilterBar>
          <div className="w-44">
            <FormField label="Holat">
              {(props) => (
                <Select
                  {...props}
                  onChange={(event) => {
                    setStatus(event.target.value);
                    setOffset(0);
                  }}
                  value={status}
                >
                  <option value="">Barcha holatlar</option>
                  <option value="OPEN">Ochiq</option>
                  <option value="CLOSED">Yopilgan</option>
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
            <FormField error={rangeError} label="Ochilgan (dan)">
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
            <FormField label="Ochilgan (gacha)">
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
          caption="Xodim smenalari"
          columns={columns}
          emptyDescription={
            rangeError
              ? "Sana oralig'ini to'g'rilang."
              : "Filtrni o'zgartirib ko'ring yoki boshqa sahifaga o'ting."
          }
          emptyTitle={rangeError ? "Oraliq noto'g'ri" : "Smena topilmadi"}
          getRowKey={(shift) => shift.id}
          isLoading={isLoading}
          rowActions={(shift) => (
            <>
              <RowAction
                icon="eye"
                label={`#${shift.shiftNumber} smenani ochish`}
                onClick={() => setDetail(shift)}
              />
              {/*
               * Yopilgan smenada tugma UMUMAN chizilmaydi. `RowAction` da
               * `disabled` yo'q, shuning uchun uni `onClick` siz chizish
               * bosiladigan, lekin hech narsa qilmaydigan tugma berardi —
               * aynan shu ekran tuzatmoqchi bo'lgan nuqson.
               */}
              {canClose && shift.status === "OPEN" ? (
                <RowAction
                  icon="check"
                  label={`#${shift.shiftNumber} smenani yopish`}
                  onClick={() => openCloseDialog(shift)}
                />
              ) : null}
            </>
          )}
          rows={shifts}
        />

        <Pagination
          count={shifts.length}
          isLoading={isLoading}
          noun="smena"
          offset={offset}
          onOffsetChange={setOffset}
          pageSize={pageSize}
        />
      </Card>

      <ShiftDetailModal
        canClose={canClose}
        onClose={() => setDetail(null)}
        onRequestShiftClose={openCloseDialog}
        shift={detail}
      />

      <Modal
        description="Smena BIR MARTA yopiladi va keyin o'zgartirilmaydi. Kutilgan naqd, topshirilgan naqd va farq alohida yoziladi."
        dismissOnBackdrop={false}
        footer={
          <>
            <Button onClick={() => setClosing(null)} variant="ghost">
              Bekor qilish
            </Button>
            <Button
              form="shift-close-form"
              isLoading={isClosing}
              size="lg"
              type="submit"
            >
              Smenani yopish
            </Button>
          </>
        }
        isOpen={closing !== null}
        onClose={() => setClosing(null)}
        title={
          closing
            ? `#${closing.shiftNumber} smenani yopish`
            : "Smenani yopish"
        }
      >
        {closing ? (
          <form
            className="grid gap-4"
            id="shift-close-form"
            onSubmit={submitClose}
            ref={closeFormRef}
          >
            <dl className="grid gap-2 rounded-mz-control border border-mz-border bg-mz-surface-sunken p-3 text-sm">
              <Row label="Kassir" value={employeeName(closing.employee)} />
              <Row label="Filial" value={closing.branch?.name ?? "—"} />
              <Row
                label="Boshlang'ich qoldiq"
                numeric
                value={formatMoney(closing.openingBalance)}
              />
              <Row
                label="Naqd sotuv"
                numeric
                value={formatMoney(closing.cashTotal)}
              />
            </dl>

            <FormField
              error={closeError}
              hint="Kutilgan naqd va farq shu summadan serverda hisoblanadi — bu yerda qo'lda kiritilmaydi."
              label="Sanab olingan naqd (topshirilgan)"
              required
            >
              {(props) => (
                <TextInput
                  {...props}
                  inputMode="decimal"
                  min={0}
                  onChange={(event) => setClosingBalance(event.target.value)}
                  step="0.01"
                  type="number"
                  value={closingBalance}
                />
              )}
            </FormField>
          </form>
        ) : null}
      </Modal>
    </div>
  );
}

function Row({
  label,
  numeric = false,
  value,
}: {
  label: string;
  numeric?: boolean;
  value: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-[13px] text-mz-text-muted">{label}</dt>
      <dd
        className={`text-right text-sm ${numeric ? moneyCell : "font-semibold text-mz-text"}`}
      >
        {value}
      </dd>
    </div>
  );
}

/**
 * Smena detali.
 *
 * Kutilgan / topshirilgan / farq — uchta alohida blok. Pastda esa kassa
 * qutisining harakatlar tarixi (`GET /cash-register/shift/:id/transactions`),
 * ya'ni kutilgan summa QAYERDAN kelganini ko'rsatadi. Ilgari ekranda faqat
 * farq raqami bor edi va uni tekshirishning yo'li yo'q edi.
 */
function ShiftDetailModal({
  canClose,
  onClose,
  onRequestShiftClose,
  shift,
}: {
  canClose: boolean;
  onClose: () => void;
  onRequestShiftClose: (shift: Shift) => void;
  shift: Shift | null;
}) {
  const shiftId = shift?.id ?? "";

  const {
    data: transactions,
    isLoading,
    error,
    reload,
  } = useApiResource<CashTransaction[]>(
    () =>
      shiftId
        ? apiFetch<CashTransaction[]>(
            `/cash-register/shift/${shiftId}/transactions`,
          )
        : Promise.resolve([]),
    /*
     * `closedAt` ham bog'liqlik: smena yopilgandan keyin oyna AYNI shu
     * `id` bilan qayta ochiladi, lekin kassa daftariga `CLOSING_BALANCE`
     * yozuvi qo'shilgan bo'ladi. Faqat `shiftId` ga tayansak, jadval
     * yopilishdan oldingi holatni ko'rsatib turardi.
     */
    [shiftId, shift?.closedAt ?? ""],
    "Kassa harakatlarini yuklab bo'lmadi.",
  );

  const rows = transactions ?? [];

  const columns: DataTableColumn<CashTransaction>[] = [
    {
      key: "type",
      header: "Turi",
      primary: true,
      render: (row) => (
        <div className="min-w-0">
          <Badge tone={cashTypeTone(row.type)}>
            {cashTypeLabels[row.type] ?? row.type}
          </Badge>
          <p className="mt-1 truncate text-[13px] text-mz-text-muted">
            {formatDateTime(row.occurredAt)}
            {row.cashTransferId ? " · topshirish" : ""}
          </p>
        </div>
      ),
    },
    {
      key: "reason",
      header: "Sabab",
      hideOnMobile: true,
      render: (row) => (
        <span className="text-[13px] text-mz-text-muted">
          {row.reason ?? row.order?.orderNumber ?? "—"}
        </span>
      ),
    },
    {
      key: "amount",
      header: "Summa",
      align: "right",
      render: (row) => {
        const sign = cashTypeSign[row.type] ?? 0;
        const amount = Number(row.amount);

        return (
          <span
            className={`tabular-nums font-semibold ${
              sign === -1 ? "text-mz-danger" : "text-mz-text"
            }`}
          >
            {sign === -1 ? "−" : sign === 1 ? "+" : ""}
            {formatMoney(amount)}
          </span>
        );
      },
    },
  ];

  const difference =
    shift?.cashDifference == null ? null : Number(shift.cashDifference);
  const tone = difference === null ? null : differenceTone(difference);

  return (
    <Modal
      footer={
        <>
          <Button onClick={onClose} variant="ghost">
            Yopish
          </Button>
          {canClose && shift ? (
            <GuardedButton
              blockedReason={
                shift.status === "CLOSED"
                  ? "Smena allaqachon yopilgan — smena bir marta yopiladi."
                  : null
              }
              onClick={() => onRequestShiftClose(shift)}
              size="lg"
            >
              Smenani yopish
            </GuardedButton>
          ) : null}
        </>
      }
      isOpen={shift !== null}
      onClose={onClose}
      title={shift ? `#${shift.shiftNumber} smena` : "Smena"}
    >
      {shift ? (
        <div className="grid gap-4">
          <div className="flex flex-wrap gap-2">
            <Badge tone={shift.status === "OPEN" ? "info" : "neutral"} withDot>
              {shift.status === "OPEN" ? "Ochiq" : "Yopilgan"}
            </Badge>
            {shift.branch ? (
              <Badge tone="neutral">{shift.branch.name}</Badge>
            ) : null}
            {shift.device ? (
              <Badge tone="neutral">{shift.device.name}</Badge>
            ) : null}
          </div>

          {/*
           * Uchta ALOHIDA blok — MONEY_PATH: "expected, actual and
           * difference are each shown separately".
           */}
          <div className="grid gap-3 sm:grid-cols-3">
            <Figure
              label="Kutilgan naqd"
              value={formatMoney(shift.expectedCash)}
            />
            <Figure
              label="Topshirilgan naqd"
              value={formatMoney(shift.closingBalance)}
            />
            <Figure
              className={tone?.className ?? "text-mz-text-faint"}
              label="Farq"
              value={
                difference === null
                  ? "Smena yopilmagan"
                  : (tone?.label ?? formatMoney(difference))
              }
            />
          </div>

          <dl className="grid gap-2">
            <Row label="Kassir" value={employeeName(shift.employee)} />
            <Row label="Ochilgan" value={formatDateTime(shift.openedAt)} />
            <Row
              label="Yopilgan"
              value={
                shift.closedAt ? formatDateTime(shift.closedAt) : "Hali ochiq"
              }
            />
            <Row
              label="Boshlang'ich qoldiq"
              numeric
              value={formatMoney(shift.openingBalance)}
            />
            <Row label="Buyurtma" value={`${shift.orderCount} ta`} />
            <Row label="Savdo" numeric value={formatMoney(shift.salesTotal)} />
            <Row label="Naqd" numeric value={formatMoney(shift.cashTotal)} />
            <Row
              label="Terminal"
              numeric
              value={formatMoney(shift.terminalTotal)}
            />
            <Row label="Click" numeric value={formatMoney(shift.clickTotal)} />
            <Row label="Payme" numeric value={formatMoney(shift.paymeTotal)} />
            <Row
              label="Boshqa to'lov"
              numeric
              value={formatMoney(shift.otherPaymentTotal)}
            />
            <Row
              label="Xarajat"
              numeric
              value={formatMoney(shift.expensesTotal)}
            />
            <Row label="Kirim" numeric value={formatMoney(shift.incomeTotal)} />
            <Row
              label="Qaytarish"
              numeric
              value={formatMoney(shift.refundsTotal)}
            />
          </dl>

          <Card>
            <CardHeader
              description="Kutilgan naqd shu yozuvlardan hisoblanadi"
              title="Kassa harakatlari"
            />
            {error ? (
              <CardBody>
                <ErrorState message={error} onRetry={() => reload()} />
              </CardBody>
            ) : isLoading ? (
              <CardBody>
                <SkeletonRows rows={4} />
              </CardBody>
            ) : (
              <DataTable
                caption="Kassa harakatlari"
                columns={columns}
                emptyDescription="Bu smenada kassa qutisi harakati qayd etilmagan."
                emptyIcon="wallet"
                emptyTitle="Harakat yo'q"
                getRowKey={(row) => row.id}
                rows={rows}
                scrollHeightClass="max-h-72"
              />
            )}
          </Card>

          {rows.some((row) => row.cashTransferId) ? (
            <p className="rounded-mz-control border border-mz-border border-l-4 border-l-mz-info bg-mz-surface px-3 py-2 text-[13px] text-mz-text-muted">
              Topshirish yozuvlari ko&apos;rinadi, lekin KIMDAN KIMGA
              topshirilgani bu yerda yo&apos;q: topshiruvlar ro&apos;yxatini
              beradigan admin endpoint&apos;i hali qurilmagan.
            </p>
          ) : null}
        </div>
      ) : (
        <EmptyState icon="clock" title="Smena tanlanmagan" />
      )}
    </Modal>
  );
}

function Figure({
  className = "text-mz-text",
  label,
  value,
}: {
  className?: string;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-mz-control border border-mz-border bg-mz-surface-sunken p-3">
      <p className="text-[13px] font-semibold uppercase tracking-wide text-mz-text-muted">
        {label}
      </p>
      <p className={`mt-1 text-lg font-bold tabular-nums ${className}`}>
        {value}
      </p>
    </div>
  );
}
