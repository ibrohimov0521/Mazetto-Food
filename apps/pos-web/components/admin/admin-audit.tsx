"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../../lib/api";
import { useApiResource } from "../../lib/use-api-resource";
import { formatDateTime } from "../../lib/order-display";
import { Badge, type BadgeTone } from "../admin-ui/badge";
import { Button } from "../admin-ui/button";
import { Card, CardBody } from "../admin-ui/card";
import { DataTable, type DataTableColumn } from "../admin-ui/data-table";
import { ErrorState } from "../admin-ui/feedback";
import { FilterBar, FormField, Select, TextInput } from "../admin-ui/form";
import { Pagination } from "../admin-ui/pagination";
import {
  auditActionLabel,
  auditEntityLabel,
  hasAuditActionLabel,
} from "./people-branch-labels";

/*
 * Xavfsizlik audit jurnali.
 *
 * BU EKRAN ATAYLAB FAQAT O'QISH UCHUN va shunday qolishi kerak. Audit
 * jurnalining butun qiymati uning O'ZGARTIRILMASLIGIDA: agar admin panel
 * yozuvni tahrirlay yoki o'chira olsa, jurnal hech narsani isbotlamaydi.
 * Backend ham shunga mos — `/audit-logs` da faqat `GET` bor. Bu "mutation
 * yo'q" nuqsoni EMAS, balki talab.
 *
 * NIMA TUZATILDI:
 *   - `from`/`to` sana filtrlari. Ular `ListAuditLogsDto` da BOR edi, lekin
 *     interfeysda yo'q edi — hodisani qidirish uchun 50 talab varaqlash kerak
 *     bo'lardi.
 *   - Amal va obyekt nomlari o'zbekcha. Ilgari foydalanuvchiga
 *     `STAFF_ROLE_CHANGED` ko'rsatilardi. Kod YO'QOLMAYDI — u yozuv ichida
 *     qoladi, chunki audit izida aniq kod muhim.
 *   - "Filtrlarni tozalash" tugmasi: to'rtta filtrni bittalab qaytarish
 *     kerak bo'lardi.
 *
 * Jurnal global (`AuditLog` da `branchId` yo'q), shuning uchun `AUDIT_VIEW`
 * faqat global rolga beriladi va bu ekranda filial filtri yo'q.
 */

type AuditLog = {
  id: string;
  action: string;
  entity: string;
  entityId?: string | null;
  metadata?: unknown;
  createdAt: string;
  user?: {
    id: string;
    displayName?: string | null;
    email?: string | null;
    phone?: string | null;
  } | null;
};

type AuditFacets = {
  actions: string[];
  entities: string[];
};

const pageSize = 50;

/*
 * Amal turini rangga solish. DESIGN_RULES: qizil FAQAT buzuvchi amallar uchun.
 * Bloklash va parol reseti — jiddiy xavfsizlik hodisalari.
 */
function actionTone(action: string): BadgeTone {
  if (
    action.includes("BLOCKED") ||
    action.includes("DELETED") ||
    action.includes("FAILED")
  ) {
    return "danger";
  }

  if (action.includes("PASSWORD") || action.includes("ROLE_CHANGED")) {
    return "warning";
  }

  if (action.includes("CREATED") || action.includes("ACTIVATED")) {
    return "success";
  }

  return "info";
}

function actorName(user: AuditLog["user"]): string {
  if (!user) {
    return "Tizim";
  }

  return user.displayName ?? user.email ?? user.phone ?? "Noma'lum";
}

/** `<input type="date">` qiymatini kun boshi/oxiri ISO vaqtiga aylantiradi. */
function toIsoBoundary(day: string, edge: "start" | "end"): string {
  return `${day}T${edge === "start" ? "00:00:00.000" : "23:59:59.999"}Z`;
}

export function AdminAuditPage() {
  const [facets, setFacets] = useState<AuditFacets>({
    actions: [],
    entities: [],
  });
  const [action, setAction] = useState("");
  const [entity, setEntity] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [offset, setOffset] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    void apiFetch<AuditFacets>("/audit-logs/facets")
      .then(setFacets)
      .catch(() => {
        // Filtr tanlagichlari ixtiyoriy — jurnal baribir yuklanadi.
      });
  }, []);

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
      if (action) params.set("action", action);
      if (entity) params.set("entity", entity);
      if (from) params.set("from", toIsoBoundary(from, "start"));
      if (to) params.set("to", toIsoBoundary(to, "end"));
      return apiFetch<AuditLog[]>(`/audit-logs?${params.toString()}`);
    },
    [action, entity, from, to, offset],
    "Audit jurnalini yuklab bo'lmadi.",
  );
  const logs = data ?? [];

  const hasFilters = Boolean(action || entity || from || to);

  /** Sana oralig'i teskari bo'lsa server bo'sh natija beradi — oldin aytamiz. */
  const rangeError = useMemo(
    () => (from && to && from > to ? "Boshlanish sanasi tugash sanasidan keyin." : ""),
    [from, to],
  );

  function resetFilters(): void {
    setAction("");
    setEntity("");
    setFrom("");
    setTo("");
    setOffset(0);
  }

  const columns: DataTableColumn<AuditLog>[] = [
    {
      key: "action",
      header: "Amal",
      primary: true,
      render: (log) => (
        <div className="min-w-0">
          <Badge tone={actionTone(log.action)} withDot>
            {auditActionLabel(log.action)}
          </Badge>
          {/*
            Kod yorliq ostida QOLADI: audit izida aniq amal kodi zarur
            (qo'llanma, ticket va log korrelatsiyasi shu kod bo'yicha).
          */}
          {hasAuditActionLabel(log.action) ? (
            <p className="mt-1 truncate font-mono text-[13px] text-mz-text-faint">
              {log.action}
            </p>
          ) : null}
          <p className="mt-1 truncate text-[13px] text-mz-text-muted">
            {formatDateTime(log.createdAt)}
          </p>
        </div>
      ),
    },
    {
      key: "actor",
      header: "Kim bajardi",
      render: (log) => actorName(log.user),
    },
    {
      key: "entity",
      header: "Obyekt",
      render: (log) => (
        <span className="text-[13px]">
          {auditEntityLabel(log.entity)}
          {log.entityId ? (
            <code className="ml-1 rounded bg-mz-surface-sunken px-1 text-[13px]">
              {log.entityId.slice(0, 8)}
            </code>
          ) : null}
        </span>
      ),
    },
    {
      key: "details",
      header: "Tafsilot",
      align: "right",
      render: (log) =>
        log.metadata ? (
          <Button
            aria-expanded={expandedId === log.id}
            onClick={() =>
              setExpandedId((current) => (current === log.id ? null : log.id))
            }
            variant="ghost"
          >
            {expandedId === log.id ? "Yopish" : "Tafsilot"}
          </Button>
        ) : (
          <span className="text-[13px] text-mz-text-faint">—</span>
        ),
    },
  ];

  const expanded = logs.find((log) => log.id === expandedId);

  return (
    <div className="grid gap-5">
      {error ? <ErrorState message={error} onRetry={load} /> : null}

      <Card>
        <CardBody>
          <p className="text-[13px] text-mz-text-muted">
            Jurnal butun tizim bo&apos;yicha — filial bo&apos;yicha
            ajratilmaydi. Yozuvlar faqat qo&apos;shiladi:{" "}
            <span className="font-semibold text-mz-text">
              bu ekrandan o&apos;chirib yoki o&apos;zgartirib bo&apos;lmaydi
            </span>{" "}
            va shunday bo&apos;lishi jurnalning ma&apos;nosi.
          </p>
        </CardBody>
      </Card>

      <Card>
        <FilterBar>
          <div className="w-full sm:w-64">
            <FormField label="Amal">
              {(props) => (
                <Select
                  {...props}
                  onChange={(event) => {
                    setAction(event.target.value);
                    setOffset(0);
                  }}
                  value={action}
                >
                  <option value="">Barcha amallar</option>
                  {facets.actions.map((value) => (
                    <option key={value} value={value}>
                      {auditActionLabel(value)}
                    </option>
                  ))}
                </Select>
              )}
            </FormField>
          </div>

          <div className="w-full sm:w-52">
            <FormField label="Obyekt">
              {(props) => (
                <Select
                  {...props}
                  onChange={(event) => {
                    setEntity(event.target.value);
                    setOffset(0);
                  }}
                  value={entity}
                >
                  <option value="">Barcha obyektlar</option>
                  {facets.entities.map((value) => (
                    <option key={value} value={value}>
                      {auditEntityLabel(value)}
                    </option>
                  ))}
                </Select>
              )}
            </FormField>
          </div>

          <div className="w-full sm:w-44">
            <FormField
              label="Sanadan"
              {...(rangeError ? { error: rangeError } : {})}
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

          <div className="w-full sm:w-44">
            <FormField label="Sanagacha">
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

          {hasFilters ? (
            <Button onClick={resetFilters} variant="ghost">
              Filtrlarni tozalash
            </Button>
          ) : null}
        </FilterBar>

        <DataTable
          caption="Xavfsizlik audit jurnali"
          columns={columns}
          emptyDescription={
            hasFilters
              ? "Tanlangan filtrlarga mos yozuv yo'q. Sana oralig'ini kengaytirib ko'ring."
              : "Jurnal xodim boshqaruvi, sozlama va kirish amallarida to'ldiriladi."
          }
          emptyIcon={hasFilters ? "search" : "clipboard"}
          emptyTitle={hasFilters ? "Yozuv topilmadi" : "Jurnal hali bo'sh"}
          getRowKey={(log) => log.id}
          isLoading={isLoading}
          rows={logs}
        />

        {expanded?.metadata ? (
          <div className="border-t border-mz-border p-4">
            <p className="mb-2 text-[13px] font-semibold text-mz-text-muted">
              {auditActionLabel(expanded.action)} ·{" "}
              {formatDateTime(expanded.createdAt)} ·{" "}
              {actorName(expanded.user)}
            </p>
            <pre className="mz-thin-scrollbar overflow-x-auto rounded-mz-control bg-mz-surface-sunken p-3 text-[13px] text-mz-text">
              {JSON.stringify(expanded.metadata, null, 2)}
            </pre>
          </div>
        ) : null}

        <Pagination
          count={logs.length}
          isLoading={isLoading}
          noun="yozuv"
          offset={offset}
          onOffsetChange={setOffset}
          pageSize={pageSize}
        />
      </Card>
    </div>
  );
}
