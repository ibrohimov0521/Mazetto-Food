"use client";

import { useState } from "react";
import { apiFetch } from "../../lib/api";
import { useApiResource } from "../../lib/use-api-resource";
import { Badge } from "../admin-ui/badge";
import { Button } from "../admin-ui/button";
import { Card, CardHeader } from "../admin-ui/card";
import { DataTable, RowAction, type DataTableColumn } from "../admin-ui/data-table";
import { ErrorState, Skeleton } from "../admin-ui/feedback";
import { Modal } from "../admin-ui/modal";
import { AdminPageHeader } from "../admin-shell/admin-page-header";
import { useToast } from "../admin-ui/toast";

type Device = {
  id: string;
  name: string;
  type: string;
  branch: { id: string; name: string; code: string };
  isActive: boolean;
  enrolledAt?: string | null;
  lastSeenAt?: string | null;
  softwareVersion?: string | null;
};

type EnrollmentInfo = { deviceId: string; code: string; expiresAt: string };

const typeLabels: Record<string, string> = {
  POS_TERMINAL: "Kassa terminali",
  KITCHEN_DISPLAY: "Oshxona ekrani",
  PRINT_AGENT: "Printer agenti",
  ADMIN_DEVICE: "Admin qurilmasi",
  OTHER: "Boshqa",
};

export function AdminDevices() {
  const { showToast } = useToast();
  const [enrollmentInfo, setEnrollmentInfo] = useState<EnrollmentInfo | null>(null);
  const resource = useApiResource<Device[]>(() => apiFetch<Device[]>("/devices"), [], "Qurilmalarni yuklab bo'lmadi.");

  async function rotateCode(device: Device): Promise<void> {
    try {
      const result = await apiFetch<{ deviceId: string; enrollmentCode: string; expiresAt: string }>(
        `/devices/${device.id}/enrollment-code`,
        { method: "POST" },
      );
      setEnrollmentInfo({ deviceId: result.deviceId, code: result.enrollmentCode, expiresAt: result.expiresAt });
      resource.reload();
    } catch (caught) {
      showToast(caught instanceof Error ? caught.message : "Ulash kodi olinmadi.", "danger");
    }
  }

  const columns: DataTableColumn<Device>[] = [
    { key: "name", header: "Qurilma", primary: true, render: (device) => <div><p className="font-semibold text-mz-text">{device.name}</p><p className="text-[12px] text-mz-text-muted">{device.branch.name}</p></div> },
    { key: "type", header: "Turi", render: (device) => typeLabels[device.type] ?? device.type },
    { key: "version", header: "Versiya", hideOnMobile: true, render: (device) => device.softwareVersion ?? "—" },
    { key: "seen", header: "Oxirgi ulanish", hideOnMobile: true, render: (device) => device.lastSeenAt ? new Date(device.lastSeenAt).toLocaleString("uz-UZ") : "Hali ulanmagan" },
    { key: "status", header: "Holat", align: "right", render: (device) => <Badge tone={device.isActive ? "success" : "neutral"} withDot>{device.isActive ? (device.enrolledAt ? "Ulangan" : "Kutilmoqda") : "Bloklangan"}</Badge> },
  ];

  if (resource.isLoading && !resource.data) return <Skeleton className="h-64 w-full" />;
  if (resource.error) return <ErrorState message={resource.error} onRetry={resource.reload} />;

  return <>
    <AdminPageHeader breadcrumbs={[{ label: "Qurilmalar" }]} description="Barcha filial qurilmalarini ulash va nazorat qilish" title="Qurilmalar" />
    <Card>
      <CardHeader description="Kodni qayta chiqarish eski kodni darhol bekor qiladi." title={`${resource.data?.length ?? 0} ta qurilma`} />
      <DataTable caption="Barcha qurilmalar" columns={columns} emptyDescription="Avval filial ichidan yangi qurilma yarating." emptyIcon="monitor" emptyTitle="Qurilmalar yo'q" getRowKey={(device) => device.id} rowActions={(device) => <>
        <RowAction icon="shield" label={`${device.name} uchun yangi ulash kodi`} onClick={() => void rotateCode(device)} />
        <RowAction icon="pencil" label={`${device.name} tahrirlash`} href={`/admin/branches/${device.branch.id}/devices`} />
      </>} rows={resource.data ?? []} />
    </Card>
    <Modal footer={<Button onClick={() => setEnrollmentInfo(null)} size="lg">Tayyor</Button>} isOpen={enrollmentInfo !== null} onClose={() => setEnrollmentInfo(null)} title="Qurilmani ulash kodi">
      {enrollmentInfo ? <div className="grid gap-3"><p className="text-sm text-mz-text-muted">Bu kod 15 daqiqa amal qiladi va bir marta ishlatiladi.</p><div className="rounded-mz-card border border-mz-border bg-mz-surface-sunken p-4 text-center"><p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-mz-text-muted">Ulanish kodi</p><p className="mt-2 font-mono text-2xl font-bold tracking-[0.2em] text-mz-info">{enrollmentInfo.code}</p></div><p className="text-[12px] text-mz-text-muted">Qurilma ID: {enrollmentInfo.deviceId}</p></div> : null}
    </Modal>
  </>;
}
