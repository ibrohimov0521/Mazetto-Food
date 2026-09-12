"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../../lib/api";
import { useApiResource } from "../../lib/use-api-resource";
import { canSwitchBranch } from "../../lib/admin-nav";
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
import { FilterBar, FormField, Select, TextInput } from "../admin-ui/form";
import { Modal } from "../admin-ui/modal";
import { Pagination } from "../admin-ui/pagination";
import { InfoBox, StatGrid } from "../admin-ui/stat-box";
import { moneyCell } from "./admin-report-views";

/*
 * To'lovlar — MOLIYAVIY DAFTAR (ledger).
 *
 * BU EKRAN ATAYLAB MUTATSIYA YUBORMAYDI, va bu TO'G'RI.
 *
 * MONEY_PATH: "Refund, cancel or void must never silently rewrite an
 * existing money record; they need their own reversal entry with an actor
 * and a reason." Ya'ni to'lov yozuvini tahrirlash yoki o'chirish qoidaga
 * KO'RA taqiqlangan — daftar faqat qo'shiladi.
 *
 * QAYTARISH (refund) esa alohida masala va uni BACKEND QO'LLAB-QUVVATLAMAYDI.
 * Tekshirildi: `payments.controller.ts` da uchta route bor —
 * `GET /payments`, `POST /payments`, `POST /payments/process`. Butun
 * backend bo'ylab `PaymentStatus.REFUNDED` yoki `PARTIALLY_REFUNDED`
 * hech qayerda YOZILMAYDI, `Payment.refundedAt` ustuni o'lik, va
 * `CashTransactionType.REFUND` faqat O'QILADI (`Shift.refundsTotal`
 * shuning uchun doim nol). `/reports/sales` ham shuni ochiq aytadi:
 * `refundHandling: { supported: false }`.
 *
 * Shuning uchun bu yerda "Qaytarish" tugmasi YO'Q: bosilganda 404 beradigan
 * tugma qo'yish — ayni shu panelning asosiy nuqsoni. Kerakli endpoint va
 * uning teskari (reversal) yozuvi hisobotda aniq ko'rsatilgan.
 *
 * Holat filtrida `REFUNDED` qoladi — backend uni filtr sifatida qabul
 * qiladi, lekin bugun natija doim bo'sh bo'ladi. Ekran shuni ochiq aytadi.
 *
 * ORTIQCHA TO'LOV. Backend `processOrderPayment` da
 * `requestTotal <= outstanding` tekshiruvi bor, ya'ni buyurtma summasidan
 * ortiq to'lov YOZILMAYDI — mijozning qaytimi tushum sifatida qayd
 * etilmaydi. Bu yerda hech narsa qurish kerak emas; detal oynasi
 * buyurtma summasi va to'langan summani yonma-yon ko'rsatadi, shunda
 * nomuvofiqlik ko'zga tashlanadi.
 */

type Branch = { id: string; code: string; name: string };

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
 * Backend'da to'lov usullarini qaytaradigan endpoint YO'Q
 * (`components/payment/payment-methods.ts` shuni batafsil yozadi va
 * `paymentMethod.findMany` butun backend bo'ylab chaqirilmaydi). Shuning
 * uchun ro'yxat `prisma/seed.ts` dagi seed bilan mos qo'lda saqlanadi.
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
  const showBranchFilter = canSwitchBranch(user);

  const [branches, setBranches] = useState<Branch[]>([]);
  const [status, setStatus] = useState("");
  const [branchId, setBranchId] = useState("");
  const [methodCode, setMethodCode] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [offset, setOffset] = useState(0);
  const [detail, setDetail] = useState<Payment | null>(null);

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
              : status === "REFUNDED" || status === "PARTIALLY_REFUNDED"
                ? "Qaytarish hali qurilmagan — bu holatda yozuv bo'lishi mumkin emas."
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
          description="Nima ishlaydi, nima hali yo'q"
          title="Qaytarish (refund)"
        />
        <CardBody>
          <p className="text-sm text-mz-text">
            Admin panelda qaytarish tugmasi <strong>ataylab yo&apos;q</strong>:
            backend&apos;da qaytarish endpoint&apos;i mavjud emas. Hech qanday
            kod <code className="tabular-nums">REFUNDED</code> holatini
            yozmaydi, shuning uchun holat filtri bu qiymatda bo&apos;sh natija
            beradi.
          </p>
          <p className="mt-2 text-sm text-mz-text-muted">
            Qaytarish qo&apos;shilganda u mavjud to&apos;lov yozuvini
            O&apos;ZGARTIRMASLIGI kerak — kim, qachon va nima sababdan
            qaytarganini ko&apos;rsatadigan alohida teskari yozuv, naqd
            qaytarishda esa kassa qutisidan chiqim bo&apos;lishi shart.
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
