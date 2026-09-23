"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../../lib/api";
import { useApiResource } from "../../lib/use-api-resource";
import { canSwitchBranch } from "../../lib/admin-nav";
import { hasPermission } from "../../lib/auth";
import {
  formatDateTime,
  formatMoney,
  orderSourceLabels,
  orderStatusLabels,
  orderStatusTone,
  paymentStatusLabels,
  paymentStatusTone,
  type OrderSource,
  type OrderStatus,
  type PaymentStatus,
} from "../../lib/order-display";
import { paymentMethodLabel } from "../payment/payment-methods";
import { useAuth } from "../auth/auth-provider";
import { Badge } from "../admin-ui/badge";
import { Button, ButtonLink } from "../admin-ui/button";
import { Card, CardBody, CardHeader } from "../admin-ui/card";
import {
  DataTable,
  RowAction,
  type DataTableColumn,
} from "../admin-ui/data-table";
import { ErrorState } from "../admin-ui/feedback";
import {
  FilterBar,
  FormField,
  Select,
  Textarea,
  TextInput,
} from "../admin-ui/form";
import { Modal } from "../admin-ui/modal";
import { Pagination } from "../admin-ui/pagination";
import { InfoBox, StatGrid } from "../admin-ui/stat-box";
import { useToast } from "../admin-ui/toast";
import { moneyCell } from "./admin-report-views";

/* To'lovlar immutable ledger: qaytarish asl yozuvni o'chirmaydi, alohida
 * reversal, kassa chiqimi, audit yozuvi va refund cheki yaratadi. */

type Branch = { id: string; code: string; name: string };
type OpenShift = {
  id: string;
  branchId: string;
  employee?: { firstName: string; lastName?: string | null } | null;
};

type Payment = {
  id: string;
  amount: string;
  status: PaymentStatus;
  methodCode?: string | null;
  reference?: string | null;
  paidAt?: string | null;
  createdAt: string;
  method?: { id: string; code: string; name: string } | null;
  acceptedBy?: {
    id: string;
    firstName: string;
    lastName?: string | null;
  } | null;
  refund?: {
    id: string;
    amount: string;
    reason: string;
    createdAt: string;
  } | null;
  order?: {
    id: string;
    orderNumber: string;
    displayOrderNumber?: string | null;
    source: OrderSource;
    status?: OrderStatus | null;
    total: string;
    branch?: Branch | null;
  } | null;
};

/*
 * Filtr uchun to'lov usuli kodlari.
 *
 * Backend'da to'lov usullarini boshqaradigan katalog endpoint'i yo'q
 * (`components/payment/payment-methods.ts` kassadagi tenderlar uchun ishlaydi).
 * Shuning uchun ro'yxat `prisma/seed.ts` dagi seed bilan mos qo'lda saqlanadi.
 * Bu DAFTAR filtri, kassaga tender taklifi emas — shuning uchun hali
 * ishlatilmayotgan kodlar ham bor: tarixda ular uchrashi mumkin.
 */
const filterableMethodCodes = [
  "CASH",
  "CARD",
  "UZCARD",
  "HUMO",
  "CLICK",
  "PAYME",
  "ONLINE",
];

/** Naqd to'lov kassa qutisiga yoziladi, qolganlari faqat tushumga. */
function touchesCashDrawer(payment: Payment): boolean {
  return (payment.method?.code ?? payment.methodCode) === "CASH";
}

const pageSize = 25;

export function AdminPaymentsPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const showBranchFilter = canSwitchBranch(user);
  const canRefund = hasPermission(user, "PAYMENT_REFUND");

  const [branches, setBranches] = useState<Branch[]>([]);
  const [status, setStatus] = useState("");
  const [branchId, setBranchId] = useState("");
  const [methodCode, setMethodCode] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [offset, setOffset] = useState(0);
  const [detail, setDetail] = useState<Payment | null>(null);
  const [refundTarget, setRefundTarget] = useState<Payment | null>(null);
  const [openShifts, setOpenShifts] = useState<OpenShift[]>([]);
  const [refundShiftId, setRefundShiftId] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [refundError, setRefundError] = useState("");
  const [isRefunding, setIsRefunding] = useState(false);

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
        return Promise.resolve<Payment[]>([]);
      }

      const params = new URLSearchParams({
        limit: String(pageSize),
        offset: String(offset),
      });
      if (status) params.set("status", status);
      if (branchId) params.set("branchId", branchId);
      if (methodCode) params.set("methodCode", methodCode);
      /*
       * `from`/`to` backend'da `paidAt` bo'yicha ishlaydi — ya'ni oraliq
       * berilganda TO'LANMAGAN yozuvlar tushmaydi. Bu kutilgan xatti-harakat
       * va yorliqda shunday yozilgan.
       */
      if (from) params.set("from", `${from}T00:00:00.000Z`);
      if (to) params.set("to", `${to}T23:59:59.999Z`);
      return apiFetch<Payment[]>(`/payments?${params.toString()}`);
    },
    [branchId, offset, status, methodCode, from, to, rangeError],
    "To'lovlarni yuklab bo'lmadi.",
  );
  const payments = data ?? [];

  const stats = useMemo(() => {
    const successful = payments.filter(
      (payment) => payment.status === "PAID" || payment.status === "SUCCESS",
    );
    const amount = successful.reduce(
      (sum, payment) => sum + Number(payment.amount ?? 0),
      0,
    );
    const cash = successful
      .filter(touchesCashDrawer)
      .reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0);

    return {
      successful: successful.length,
      amount,
      cash,
      cashless: amount - cash,
      total: payments.length,
    };
  }, [payments]);

  async function openRefund(payment: Payment) {
    const paymentBranchId = payment.order?.branch?.id;
    if (!paymentBranchId) return;
    setRefundTarget(payment);
    setRefundReason("");
    setRefundShiftId("");
    setRefundError("");
    try {
      const shifts = await apiFetch<OpenShift[]>(
        `/shifts?status=OPEN&branchId=${encodeURIComponent(paymentBranchId)}&limit=100`,
      );
      setOpenShifts(shifts);
      if (shifts.length === 1 && shifts[0]) setRefundShiftId(shifts[0].id);
    } catch (loadError) {
      setOpenShifts([]);
      setRefundError(
        loadError instanceof Error
          ? loadError.message
          : "Ochiq smenalarni yuklab bo'lmadi.",
      );
    }
  }

  async function submitRefund() {
    if (!refundTarget || !refundShiftId || refundReason.trim().length < 3) {
      setRefundError("Ochiq smena va kamida 3 belgili sababni kiriting.");
      return;
    }
    setIsRefunding(true);
    setRefundError("");
    try {
      await apiFetch(`/payments/${refundTarget.id}/refund`, {
        method: "POST",
        body: JSON.stringify({
          shiftId: refundShiftId,
          reason: refundReason.trim(),
          idempotencyKey: `refund:${refundTarget.id}:${crypto.randomUUID()}`,
        }),
      });
      setRefundTarget(null);
      setDetail(null);
      showToast("To'lov qaytarildi va qaytarish cheki navbatga qo'yildi.", "success");
      await load();
    } catch (refundFailure) {
      setRefundError(
        refundFailure instanceof Error
          ? refundFailure.message
          : "To'lovni qaytarib bo'lmadi.",
      );
    } finally {
      setIsRefunding(false);
    }
  }

  const isRefundable = (payment: Payment) =>
    canRefund &&
    touchesCashDrawer(payment) &&
    (payment.status === "SUCCESS" || payment.status === "PAID") &&
    !payment.refund;

  const columns: DataTableColumn<Payment>[] = [
    {
      key: "payment",
      header: "To'lov",
      primary: true,
      render: (payment) => (
        <div className="min-w-0">
          <p className="truncate font-semibold text-mz-text">
            {payment.order
              ? (payment.order.displayOrderNumber ?? payment.order.orderNumber)
              : "Buyurtmasiz"}
          </p>
          <p className="truncate text-[13px] text-mz-text-muted">
            {formatDateTime(payment.paidAt ?? payment.createdAt)}
            {payment.order
              ? ` · ${orderSourceLabels[payment.order.source]}`
              : ""}
          </p>
        </div>
      ),
    },
    {
      key: "method",
      header: "Usul",
      render: (payment) => (
        <div className="min-w-0">
          <p className="truncate text-mz-text">
            {payment.method?.name ??
              paymentMethodLabel(payment.methodCode ?? "") ??
              "—"}
          </p>
          <p className="truncate text-[13px] text-mz-text-muted">
            {touchesCashDrawer(payment) ? "Kassa qutisi" : "Faqat tushum"}
          </p>
        </div>
      ),
    },
    {
      key: "branch",
      header: "Filial",
      hideOnMobile: true,
      render: (payment) => payment.order?.branch?.name ?? "—",
    },
    {
      key: "accepted",
      header: "Qabul qilgan",
      hideOnMobile: true,
      render: (payment) =>
        payment.acceptedBy
          ? [payment.acceptedBy.firstName, payment.acceptedBy.lastName]
              .filter(Boolean)
              .join(" ")
          : "—",
    },
    {
      key: "status",
      header: "Holat",
      render: (payment) => (
        <Badge tone={paymentStatusTone(payment.status)} withDot>
          {paymentStatusLabels[payment.status]}
        </Badge>
      ),
    },
    {
      key: "amount",
      header: "Summa",
      align: "right",
      render: (payment) => (
        <span className={moneyCell}>{formatMoney(payment.amount)}</span>
      ),
    },
  ];

  return (
    <div className="grid gap-5">
      {error ? <ErrorState message={error} onRetry={() => load()} /> : null}

      <StatGrid>
        <InfoBox
          icon="wallet"
          label="Ko'rsatilgan to'lov"
          value={`${stats.total} ta`}
        />
        <InfoBox
          icon="check"
          label="Muvaffaqiyatli"
          tone="success"
          value={`${stats.successful} ta`}
        />
        <InfoBox
          description="Kassa qutisiga yozilgan"
          icon="banknote"
          label="Naqd (sahifada)"
          tone="brand"
          value={formatMoney(stats.cash)}
        />
        <InfoBox
          description="Karta va onlayn — qutiga tegmaydi"
          icon="globe"
          label="Naqdsiz (sahifada)"
          value={formatMoney(stats.cashless)}
        />
      </StatGrid>

      <Card>
        <CardHeader
          description="Faqat o'qish uchun daftar — moliyaviy yozuv tahrirlanmaydi"
          title="To'lovlar"
        />

        <FilterBar>
          <div className="w-48">
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
                  {Object.entries(paymentStatusLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              )}
            </FormField>
          </div>

          <div className="w-44">
            <FormField label="To'lov usuli">
              {(props) => (
                <Select
                  {...props}
                  onChange={(event) => {
                    setMethodCode(event.target.value);
                    setOffset(0);
                  }}
                  value={methodCode}
                >
                  <option value="">Barcha usullar</option>
                  {filterableMethodCodes.map((code) => (
                    <option key={code} value={code}>
                      {paymentMethodLabel(code)}
                    </option>
                  ))}
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
            <FormField
              error={rangeError}
              hint="To'langan sana bo'yicha"
              label="Sana (dan)"
            >
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
          caption="To'lovlar ro'yxati"
          columns={columns}
          emptyDescription={
            rangeError
              ? "Sana oralig'ini to'g'rilang."
              : "Filtrni o'zgartirib ko'ring yoki boshqa sahifaga o'ting."
          }
          emptyTitle={rangeError ? "Oraliq noto'g'ri" : "To'lov topilmadi"}
          getRowKey={(payment) => payment.id}
          isLoading={isLoading}
          rowActions={(payment) => (
            <>
              <RowAction
                icon="eye"
                label="To'lov ma'lumotini ochish"
                onClick={() => setDetail(payment)}
              />
              {payment.order ? (
                <RowAction
                  href={`/admin/orders/${payment.order.id}`}
                  icon="externalLink"
                  label="Buyurtmani ochish"
                />
              ) : null}
              {isRefundable(payment) ? (
                <RowAction
                  icon="receipt"
                  label="Naqd to'lovni qaytarish"
                  onClick={() => void openRefund(payment)}
                />
              ) : null}
            </>
          )}
          rows={payments}
        />

        <Pagination
          count={payments.length}
          isLoading={isLoading}
          noun="to'lov"
          offset={offset}
          onOffsetChange={setOffset}
          pageSize={pageSize}
        />
      </Card>

      <Card>
        <CardHeader
          description="Moliyaviy yozuv o'chirilmaydi: teskari yozuv, kassa chiqimi, audit va chek yaratiladi"
          title="Qaytarish (refund)"
        />
        <CardBody>
          <p className="text-sm text-mz-text">
            Muvaffaqiyatli <strong>naqd to&apos;lov</strong> detalidan to&apos;liq
            qaytarish mumkin. Amal uchun ochiq smena va sabab talab qilinadi;
            qaytarish cheki avtomatik chop navbatiga tushadi.
          </p>
          <p className="mt-2 text-sm text-mz-text-muted">
            Karta, Click va Payme qaytarishlari provayder integratsiyasi va
            reconciliation tayyor bo&apos;lmaguncha bloklangan.
          </p>
        </CardBody>
      </Card>

      <Modal
        footer={
          <>
            <Button onClick={() => setDetail(null)} variant="ghost">
              Yopish
            </Button>
            {detail?.order ? (
              <ButtonLink
                href={`/admin/orders/${detail.order.id}`}
                variant="secondary"
              >
                Buyurtmani ochish
              </ButtonLink>
            ) : null}
            {detail && isRefundable(detail) ? (
              <Button
                onClick={() => void openRefund(detail)}
                variant="danger"
              >
                To&apos;lovni qaytarish
              </Button>
            ) : null}
          </>
        }
        isOpen={detail !== null}
        onClose={() => setDetail(null)}
        title="To'lov ma'lumoti"
      >
        {detail ? (
          <div className="grid gap-4">
            <div className="flex flex-wrap gap-2">
              <Badge tone={paymentStatusTone(detail.status)} withDot>
                {paymentStatusLabels[detail.status]}
              </Badge>
              <Badge tone={touchesCashDrawer(detail) ? "warning" : "info"}>
                {touchesCashDrawer(detail)
                  ? "Kassa qutisiga yozilgan"
                  : "Faqat tushum — qutiga tegmaydi"}
              </Badge>
              {detail.order?.status ? (
                <Badge tone={orderStatusTone(detail.order.status)}>
                  {orderStatusLabels[detail.order.status]}
                </Badge>
              ) : null}
            </div>

            <dl className="grid gap-2 text-sm">
              <DetailRow
                label="To'lov summasi"
                numeric
                value={formatMoney(detail.amount)}
              />
              <DetailRow
                label="Buyurtma summasi"
                numeric
                value={formatMoney(detail.order?.total)}
              />
              <DetailRow
                label="Usul"
                value={
                  detail.method?.name ??
                  paymentMethodLabel(detail.methodCode ?? "—")
                }
              />
              <DetailRow
                label="To'langan"
                value={formatDateTime(detail.paidAt ?? detail.createdAt)}
              />
              <DetailRow
                label="Filial"
                value={detail.order?.branch?.name ?? "—"}
              />
              <DetailRow
                label="Qabul qilgan"
                value={
                  detail.acceptedBy
                    ? [detail.acceptedBy.firstName, detail.acceptedBy.lastName]
                        .filter(Boolean)
                        .join(" ")
                    : "—"
                }
              />
              <DetailRow label="Havola" value={detail.reference ?? "—"} />
            </dl>

            <p className="rounded-mz-control border border-mz-border border-l-4 border-l-mz-info bg-mz-surface px-3 py-2 text-[13px] text-mz-text-muted">
              Server buyurtma qoldig&apos;idan ortiq to&apos;lov yozishni rad
              etadi, shuning uchun mijozning qaytimi tushum sifatida qayd
              etilmaydi.
            </p>
          </div>
        ) : null}
      </Modal>

      <Modal
        footer={
          <>
            <Button
              disabled={isRefunding}
              onClick={() => setRefundTarget(null)}
              variant="ghost"
            >
              Bekor qilish
            </Button>
            <Button
              disabled={!refundShiftId || refundReason.trim().length < 3}
              isLoading={isRefunding}
              onClick={() => void submitRefund()}
              variant="danger"
            >
              Qaytarishni tasdiqlash
            </Button>
          </>
        }
        isOpen={refundTarget !== null}
        onClose={() => setRefundTarget(null)}
        title="Naqd to'lovni qaytarish"
      >
        {refundTarget ? (
          <div className="grid gap-4">
            <p className="text-sm text-mz-text-muted">
              {refundTarget.order?.displayOrderNumber ??
                refundTarget.order?.orderNumber} uchun {formatMoney(refundTarget.amount)}
              kassa qutisidan chiqim qilinadi. Bu amalni ortga qaytarib
              bo&apos;lmaydi.
            </p>
            <FormField
              {...(openShifts.length === 0
                ? { error: "Filialda ochiq smena topilmadi." }
                : {})}
              label="Ochiq smena"
              required
            >
              {(props) => (
                <Select
                  {...props}
                  onChange={(event) => setRefundShiftId(event.target.value)}
                  value={refundShiftId}
                >
                  <option value="">Smenani tanlang</option>
                  {openShifts.map((shift) => (
                    <option key={shift.id} value={shift.id}>
                      {shift.employee
                        ? [shift.employee.firstName, shift.employee.lastName]
                            .filter(Boolean)
                            .join(" ")
                        : shift.id}
                    </option>
                  ))}
                </Select>
              )}
            </FormField>
            <FormField label="Qaytarish sababi" required>
              {(props) => (
                <Textarea
                  {...props}
                  maxLength={500}
                  onChange={(event) => setRefundReason(event.target.value)}
                  placeholder="Masalan: mijoz buyurtmani to'liq qaytardi"
                  value={refundReason}
                />
              )}
            </FormField>
            {refundError ? (
              <p className="text-sm font-medium text-mz-danger" role="alert">
                {refundError}
              </p>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

function DetailRow({
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
        className={`text-right ${numeric ? moneyCell : "font-semibold text-mz-text"}`}
      >
        {value}
      </dd>
    </div>
  );
}
