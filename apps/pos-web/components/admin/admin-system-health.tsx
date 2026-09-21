"use client";

import { apiFetch } from "../../lib/api";
import { useApiResource } from "../../lib/use-api-resource";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  ErrorState,
  SkeletonRows,
} from "../admin-ui";

type BackupEvidence = {
  status: "verified" | "stale" | "unavailable" | "not_configured";
  verifiedAt: string | null;
  archiveName: string | null;
  bytes: number | null;
  archiveEntries: number | null;
  verification: "pg_restore_list" | null;
  restoreTested: false;
};

type HealthSnapshot = {
  status: "ok" | "attention";
  checkedAt: string;
  database: { status: "ok" | "error" };
  redis: { status: "ready" | "degraded" };
  dependencies: {
    geocoding: { status: "ready" | "degraded" };
    media: { status: "ready" | "degraded" | "unconfigured" };
  };
  operations: {
    deadPrintJobs: number;
    staleDevices: number;
    deviceStaleAfterMinutes: number;
  };
  cors: {
    source: "environment" | "default";
    originCount: number;
    fingerprint: string;
  };
  backup: BackupEvidence;
};

const backupLabels: Record<BackupEvidence["status"], string> = {
  verified: "Arxiv tekshirilgan",
  stale: "Eskirgan",
  unavailable: "Dalil mavjud emas",
  not_configured: "Ulanmagan",
};

export function AdminSystemHealth() {
  const { data, isLoading, error, reload } = useApiResource<HealthSnapshot>(
    () => apiFetch<HealthSnapshot>("/system/health-metrics"),
    [],
    "Tizim holatini yuklab bo'lmadi.",
  );

  if (isLoading && !data) return <SkeletonRows rows={4} />;
  if (error && !data) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return null;

  const backup = data.backup;
  return (
    <div className="grid gap-4">
      {error ? <ErrorState message={error} onRetry={reload} /> : null}
      <Card>
        <CardHeader
          title="Xizmatlar holati"
          description={`Tekshirildi: ${new Date(data.checkedAt).toLocaleString("uz-UZ")}`}
          actions={
            <Button onClick={reload} variant="secondary">
              Yangilash
            </Button>
          }
        />
        <CardBody className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <HealthItem
            label="PostgreSQL"
            status={data.database.status === "ok" ? "Ishlayapti" : "Xato"}
            tone={data.database.status === "ok" ? "success" : "danger"}
          />
          <HealthItem
            label="Geokodlash"
            status={data.dependencies.geocoding.status === "ready" ? "Ulangan" : "Degradatsiya"}
            tone={data.dependencies.geocoding.status === "ready" ? "success" : "warning"}
          />
          <HealthItem
            label="Media saqlash"
            status={data.dependencies.media.status === "ready" ? "Ulangan" : "Degradatsiya"}
            tone={data.dependencies.media.status === "ready" ? "success" : "warning"}
          />
          <HealthItem
            label="Chop etish dead-letter"
            status={`${data.operations.deadPrintJobs} ta`}
            tone={data.operations.deadPrintJobs === 0 ? "success" : "danger"}
          />
          <HealthItem
            label="Aloqasiz qurilmalar"
            status={`${data.operations.staleDevices} ta`}
            tone={data.operations.staleDevices === 0 ? "success" : "warning"}
          />
          <HealthItem
            label="Redis"
            status={data.redis.status === "ready" ? "Ulangan" : "Zaxira rejim"}
            tone={data.redis.status === "ready" ? "success" : "warning"}
          />
          <HealthItem
            label="PostgreSQL backup"
            status={backupLabels[backup.status]}
            tone={backup.status === "verified" ? "success" : "warning"}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Runtime konfiguratsiya" description="Maxfiy qiymatlarsiz drift nazorati" />
        <CardBody>
          <dl className="grid gap-x-6 gap-y-3 text-[13px] sm:grid-cols-3">
            <Detail label="CORS manbasi" value={data.cors.source === "environment" ? "Environment" : "Standart"} />
            <Detail label="Originlar" value={`${data.cors.originCount} ta`} />
            <Detail label="CORS fingerprint" value={data.cors.fingerprint} />
          </dl>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="So'nggi backup dalili" />
        <CardBody>
          {backup.verifiedAt ? (
            <dl className="grid gap-x-6 gap-y-3 text-[13px] sm:grid-cols-2">
              <Detail
                label="Tekshirilgan vaqt"
                value={new Date(backup.verifiedAt).toLocaleString("uz-UZ")}
              />
              <Detail label="Arxiv" value={backup.archiveName ?? "—"} />
              <Detail
                label="Hajm"
                value={
                  backup.bytes === null
                    ? "—"
                    : `${(backup.bytes / 1024).toFixed(1)} KB`
                }
              />
              <Detail
                label="Arxiv yozuvlari"
                value={String(backup.archiveEntries ?? "—")}
              />
              <Detail label="Arxivni o'qish" value="pg_restore --list: o'tdi" />
              <Detail label="Tiklash sinovi" value="Bajarilmagan" />
            </dl>
          ) : (
            <p className="text-[13px] text-mz-text-muted">
              Backup tekshiruvi dalili ulanmagan. Bu holat backup yo'qligini
              ham, borligini ham tasdiqlamaydi.
            </p>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function HealthItem({
  label,
  status,
  tone,
}: {
  label: string;
  status: string;
  tone: "success" | "warning" | "danger";
}) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-2 border-b border-mz-border pb-3 last:border-0 sm:border-b-0 sm:pb-0">
      <span className="min-w-0 text-[13px] font-semibold text-mz-text">
        {label}
      </span>
      <Badge tone={tone}>{status}</Badge>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-mz-text-muted">{label}</dt>
      <dd className="mt-0.5 break-words font-semibold text-mz-text">{value}</dd>
    </div>
  );
}
