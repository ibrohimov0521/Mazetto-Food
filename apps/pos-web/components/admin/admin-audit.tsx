"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch, SessionExpiredError } from "../../lib/api";
import { formatDateTime } from "../../lib/order-display";
import { Badge, type BadgeTone } from "../admin-ui/badge";
import { Button } from "../admin-ui/button";
import { Card, CardBody } from "../admin-ui/card";
import { DataTable, type DataTableColumn } from "../admin-ui/data-table";
import { ErrorState } from "../admin-ui/feedback";
import { FilterBar, Select } from "../admin-ui/form";

/*
 * Xavfsizlik audit jurnali.
 *
 * `AuditLog` modeli va unga yozish (`StaffService`) allaqachon bor edi —
 * STAFF_CREATED, STAFF_ROLE_CHANGED, STAFF_BLOCKED, STAFF_PASSWORD_RESET
 * va boshqalar yozilardi, lekin ularni ko'rish uchun hech qanday yo'l yo'q edi.
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
  if (action.includes("BLOCKED") || action.includes("DELETED")) {
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

export function AdminAuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [facets, setFacets] = useState<AuditFacets>({
    actions: [],
    entities: [],
  });
  const [action, setAction] = useState("");
  const [entity, setEntity] = useState("");
  const [offset, setOffset] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    void apiFetch<AuditFacets>("/audit-logs/facets")
      .then(setFacets)
      .catch(() => {
        // Filtr tanlagichlari ixtiyoriy — jurnal baribir yuklanadi.
      });
  }, []);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError("");

    const params = new URLSearchParams({
      limit: String(pageSize),
      offset: String(offset),
    });

    if (action) params.set("action", action);
    if (entity) params.set("entity", entity);

    try {
      setLogs(await apiFetch<AuditLog[]>(`/audit-logs?${params.toString()}`));
    } catch (caught) {
      if (caught instanceof SessionExpiredError) {
        return;
      }

      setError(
        caught instanceof Error
          ? caught.message
          : "Audit jurnalini yuklab bo'lmadi.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [action, entity, offset]);

  useEffect(() => {
    void load();
  }, [load]);

  const columns: DataTableColumn<AuditLog>[] = [
    {
      key: "action",
      header: "Amal",
      primary: true,
      render: (log) => (
        <div className="min-w-0">
          <Badge tone={actionTone(log.action)} withDot>
            {log.action}
          </Badge>
          <p className="mt-1 truncate text-xs text-mz-text-muted">
            {formatDateTime(log.createdAt)}
          </p>
        </div>
      ),
    },
    {
      key: "actor",
      header: "Kim",
      render: (log) => actorName(log.user),
    },
    {
      key: "entity",
      header: "Obyekt",
      render: (log) => (
        <span className="text-xs">
          {log.entity}
          {log.entityId ? (
            <code className="ml-1 rounded bg-mz-surface-sunken px-1 text-[11px]">
              {log.entityId.slice(0, 8)}
            </code>
          ) : null}
        </span>
      ),
    },
    {
      key: "details",
      header: "",
      align: "right",
      render: (log) =>
        log.metadata ? (
          <Button
            onClick={() =>
              setExpandedId((current) => (current === log.id ? null : log.id))
            }
            size="sm"
            variant="ghost"
          >
            {expandedId === log.id ? "Yopish" : "Tafsilot"}
          </Button>
        ) : null,
    },
  ];

  const expanded = logs.find((log) => log.id === expandedId);

  return (
    <div className="grid gap-5">
      {error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : null}

      <Card>
        <CardBody>
          <p className="text-xs text-mz-text-muted">
            Jurnal butun tizim bo&apos;yicha — filial bo&apos;yicha
            ajratilmaydi. Yozuvlar faqat qo&apos;shiladi; bu ekrandan
            o&apos;chirib yoki o&apos;zgartirib bo&apos;lmaydi.
          </p>
        </CardBody>
      </Card>

      <Card>
        <FilterBar>
          <div className="w-64">
            <Select
              aria-label="Amal bo'yicha filtr"
              value={action}
              onChange={(event) => {
                setAction(event.target.value);
                setOffset(0);
              }}
            >
              <option value="">Barcha amallar</option>
              {facets.actions.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </Select>
          </div>
          <div className="w-48">
            <Select
              aria-label="Obyekt bo'yicha filtr"
              value={entity}
              onChange={(event) => {
                setEntity(event.target.value);
                setOffset(0);
              }}
            >
              <option value="">Barcha obyektlar</option>
              {facets.entities.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </Select>
          </div>
        </FilterBar>

        <DataTable
          caption="Xavfsizlik audit jurnali"
          columns={columns}
          emptyDescription="Filtrni o'zgartirib ko'ring. Jurnal xodim boshqaruvi amallarida to'ldiriladi."
          emptyTitle="Yozuv topilmadi"
          getRowKey={(log) => log.id}
          isLoading={isLoading}
          rows={logs}
        />

        {expanded?.metadata ? (
          <div className="border-t border-mz-border p-4">
            <p className="mb-2 text-xs font-semibold text-mz-text-muted">
              {expanded.action} · {formatDateTime(expanded.createdAt)}
            </p>
            <pre className="mz-thin-scrollbar overflow-x-auto rounded-mz-control bg-mz-surface-sunken p-3 text-xs text-mz-text">
              {JSON.stringify(expanded.metadata, null, 2)}
            </pre>
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-3 border-t border-mz-border px-4 py-3">
          <p className="text-xs text-mz-text-muted">
            {offset + 1}–{offset + logs.length}-yozuv
          </p>
          <div className="flex gap-2">
            <Button
              disabled={offset === 0 || isLoading}
              onClick={() =>
                setOffset((current) => Math.max(0, current - pageSize))
              }
              size="sm"
              variant="ghost"
            >
              Oldingi
            </Button>
            <Button
              disabled={logs.length < pageSize || isLoading}
              onClick={() => setOffset((current) => current + pageSize)}
              size="sm"
              variant="ghost"
            >
              Keyingi
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
