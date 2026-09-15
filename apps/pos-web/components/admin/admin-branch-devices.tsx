"use client";

import { useState } from "react";
import { apiFetch, SessionExpiredError } from "../../lib/api";
import { hasPermission } from "../../lib/auth";
import { useApiResource } from "../../lib/use-api-resource";
import { AdminPageHeader } from "../admin-shell/admin-page-header";
import { Badge } from "../admin-ui/badge";
import { Button } from "../admin-ui/button";
import { Card, CardHeader } from "../admin-ui/card";
import {
  DataTable,
  RowAction,
  type DataTableColumn,
} from "../admin-ui/data-table";
import { ErrorState, Skeleton } from "../admin-ui/feedback";
import { FormField, Select, TextInput } from "../admin-ui/form";
import { Icon } from "../admin-ui/icon";
import { Modal } from "../admin-ui/modal";
import { Toggle } from "../admin-ui/toggle";
import { useToast } from "../admin-ui/toast";
import { useAuth } from "../auth/auth-provider";

type DeviceType =
  | "POS_TERMINAL"
  | "KITCHEN_DISPLAY"
  | "PRINT_AGENT"
  | "ADMIN_DEVICE"
  | "OTHER";

type Branch = { id: string; code: string; name: string };

type Device = {
  id: string;
  branchId: string;
  name: string;
  type: DeviceType;
  os?: string | null;
  ipAddress?: string | null;
  softwareVersion?: string | null;
  isActive: boolean;
  lastSeenAt?: string | null;
  lastEmployee?: {
    firstName: string;
    lastName?: string | null;
    employeeCode: string;
  } | null;
};

type DeviceDraft = {
  id?: string;
  name: string;
  type: DeviceType;
  os: string;
  ipAddress: string;
  softwareVersion: string;
  isActive: boolean;
};

const deviceTypes: { value: DeviceType; label: string }[] = [
  { value: "POS_TERMINAL", label: "Kassa terminali" },
  { value: "KITCHEN_DISPLAY", label: "Oshxona ekrani" },
  { value: "PRINT_AGENT", label: "Printer agenti" },
  { value: "ADMIN_DEVICE", label: "Admin qurilmasi" },
  { value: "OTHER", label: "Boshqa" },
];

const emptyDraft: DeviceDraft = {
  name: "",
  type: "POS_TERMINAL",
  os: "",
  ipAddress: "",
  softwareVersion: "",
  isActive: true,
};

function draftFrom(device: Device): DeviceDraft {
  return {
    id: device.id,
    name: device.name,
    type: device.type,
    os: device.os ?? "",
    ipAddress: device.ipAddress ?? "",
    softwareVersion: device.softwareVersion ?? "",
    isActive: device.isActive,
  };
}

function typeLabel(type: DeviceType): string {
  return deviceTypes.find((item) => item.value === type)?.label ?? type;
}

export function AdminBranchDevices({ branchId }: { branchId: string }) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const canManage = hasPermission(user, "DEVICE_MANAGE");
  const [editor, setEditor] = useState<DeviceDraft | null>(null);
  const [enrollmentInfo, setEnrollmentInfo] = useState<{
    deviceId: string;
    code: string;
    expiresAt: string;
  } | null>(null);
  const [nameError, setNameError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const resource = useApiResource<[Branch, Device[]]>(
    () =>
      Promise.all([
        apiFetch<Branch>(`/branches/${branchId}`),
        apiFetch<Device[]>(
          `/devices?branchId=${encodeURIComponent(branchId)}`,
        ),
      ]),
    [branchId],
    "Filial qurilmalarini yuklab bo'lmadi.",
  );

  const branch = resource.data?.[0] ?? null;
  const devices = resource.data?.[1] ?? [];

  async function save(): Promise<void> {
    if (!editor) return;
    const name = editor.name.trim();
    if (!name) {
      setNameError("Qurilma nomini kiriting.");
      return;
    }

    setIsSaving(true);
    try {
      const body = {
        name,
        type: editor.type,
        os: editor.os.trim(),
        ipAddress: editor.ipAddress.trim(),
        softwareVersion: editor.softwareVersion.trim(),
        ...(editor.id ? { isActive: editor.isActive } : { branchId }),
      };
      const result = await apiFetch<{
    id?: string;
    deviceId?: string;
    enrollmentCode?: string;
    enrollmentExpiresAt?: string;
    expiresAt?: string;
      }>(editor.id ? `/devices/${editor.id}` : "/devices", {
        method: editor.id ? "PATCH" : "POST",
        body: JSON.stringify(body),
      });
      showToast(
        editor.id ? "Qurilma yangilandi." : "Qurilma qaydga olindi.",
        "success",
      );
      setEditor(null);
      if (result.enrollmentCode && result.id) {
        setEnrollmentInfo({
          deviceId: result.id,
          code: result.enrollmentCode,
          expiresAt:
            result.enrollmentExpiresAt ??
            result.expiresAt ??
          new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        });
      } else if (!editor.id) {
        showToast("Qurilma yaratildi, lekin ulash kodi olinmadi. Qayta urinib ko'ring.", "danger");
      }
      resource.reload();
    } catch (caught) {
      if (caught instanceof SessionExpiredError) return;
      showToast(
        caught instanceof Error ? caught.message : "Qurilmani saqlab bo'lmadi.",
        "danger",
      );
    } finally {
      setIsSaving(false);
    }
  }

  const columns: DataTableColumn<Device>[] = [
    {
      key: "device",
      header: "Qurilma",
      primary: true,
      render: (device) => (
        <div className="min-w-0">
          <p className="truncate font-semibold text-mz-text">{device.name}</p>
          <p className="truncate text-[13px] text-mz-text-muted">
            {device.ipAddress || "IP kiritilmagan"}
          </p>
        </div>
      ),
    },
    {
      key: "type",
      header: "Turi",
      render: (device) => typeLabel(device.type),
    },
    {
      key: "software",
      header: "Tizim",
      hideOnMobile: true,
      render: (device) =>
        [device.os, device.softwareVersion].filter(Boolean).join(" · ") || "—",
    },
    {
      key: "employee",
      header: "Oxirgi xodim",
      hideOnMobile: true,
      render: (device) =>
        device.lastEmployee
          ? [device.lastEmployee.firstName, device.lastEmployee.lastName]
              .filter(Boolean)
              .join(" ")
          : "—",
    },
    {
      key: "status",
      header: "Holat",
      align: "right",
      render: (device) => (
        <Badge tone={device.isActive ? "success" : "neutral"} withDot>
          {device.isActive ? "Foydalanishda" : "O'chirilgan"}
        </Badge>
      ),
    },
  ];

  if (resource.isLoading && !resource.data) {
    return (
      <div className="grid gap-4">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (resource.error || !branch) {
    return (
      <ErrorState
        message={resource.error || "Filial topilmadi."}
        onRetry={resource.reload}
      />
    );
  }

  return (
    <>
      <AdminPageHeader
        actions={
          canManage ? (
            <Button onClick={() => setEditor({ ...emptyDraft })} size="lg">
              <Icon className="h-4 w-4" name="plus" />
              Yangi qurilma
            </Button>
          ) : null
        }
        backHref={`/admin/branches/${branch.id}`}
        breadcrumbs={[
          { label: "Filiallar", href: "/admin/branches" },
          { label: branch.name, href: `/admin/branches/${branch.id}` },
          { label: "Qurilmalar" },
        ]}
        description="Kassa terminallari, oshxona ekranlari va printer agentlari"
        title="Qurilmalar"
      />

      <Card>
        <CardHeader
          description="Bu ro'yxat fizik qurilma inventari. Qurilmani o'chirish tarixni saqlaydi."
          title={branch.name}
        />
        <DataTable
          caption="Filial qurilmalari"
          columns={columns}
          emptyDescription="Kassa terminali yoki boshqa qurilmani qaydga oling."
          emptyIcon="monitor"
          emptyTitle="Qurilma yo'q"
          getRowKey={(device) => device.id}
          {...(canManage
            ? {
                rowActions: (device: Device) => (
                  <RowAction
                    icon="pencil"
                    label={`${device.name} - tahrirlash`}
                    onClick={() => {
                      setNameError("");
                      setEditor(draftFrom(device));
                    }}
                  />
                ),
              }
            : {})}
          rows={devices}
        />
      </Card>

      <Modal
        dismissOnBackdrop={false}
        footer={
          <>
            <Button onClick={() => setEditor(null)} variant="ghost">
              Bekor qilish
            </Button>
            <Button isLoading={isSaving} onClick={() => void save()} size="lg">
              Saqlash
            </Button>
          </>
        }
        isOpen={editor !== null}
        onClose={() => setEditor(null)}
        title={editor?.id ? "Qurilmani tahrirlash" : "Yangi qurilma"}
      >
        {editor ? (
          <div className="grid gap-3">
            <FormField
              label="Qurilma nomi"
              required
              {...(nameError ? { error: nameError } : {})}
            >
              {(props) => (
                <TextInput
                  {...props}
                  maxLength={120}
                  onChange={(event) => {
                    setNameError("");
                    setEditor({ ...editor, name: event.target.value });
                  }}
                  value={editor.name}
                />
              )}
            </FormField>
            <FormField label="Turi">
              {(props) => (
                <Select
                  {...props}
                  onChange={(event) =>
                    setEditor({
                      ...editor,
                      type: event.target.value as DeviceType,
                    })
                  }
                  value={editor.type}
                >
                  {deviceTypes.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </Select>
              )}
            </FormField>
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label="Operatsion tizim">
                {(props) => (
                  <TextInput
                    {...props}
                    maxLength={120}
                    onChange={(event) =>
                      setEditor({ ...editor, os: event.target.value })
                    }
                    placeholder="Windows, Android"
                    value={editor.os}
                  />
                )}
              </FormField>
              <FormField label="Dastur versiyasi">
                {(props) => (
                  <TextInput
                    {...props}
                    maxLength={80}
                    onChange={(event) =>
                      setEditor({
                        ...editor,
                        softwareVersion: event.target.value,
                      })
                    }
                    placeholder="1.4.0"
                    value={editor.softwareVersion}
                  />
                )}
              </FormField>
            </div>
            <FormField label="IP manzil">
              {(props) => (
                <TextInput
                  {...props}
                  maxLength={64}
                  onChange={(event) =>
                    setEditor({ ...editor, ipAddress: event.target.value })
                  }
                  placeholder="192.168.1.20"
                  value={editor.ipAddress}
                />
              )}
            </FormField>
            {editor.id ? (
              <Toggle
                checked={editor.isActive}
                description="O'chirilsa yangi smenaga biriktirilmaydi, tarixi saqlanadi"
                label="Foydalanishda"
                onChange={(checked) =>
                  setEditor({ ...editor, isActive: checked })
                }
              />
            ) : null}
          </div>
        ) : null}
      </Modal>

      <Modal
        footer={
          <Button onClick={() => setEnrollmentInfo(null)} size="lg">
            Tayyor
          </Button>
        }
        isOpen={enrollmentInfo !== null}
        onClose={() => setEnrollmentInfo(null)}
        title="Qurilmani ulash kodi"
      >
        {enrollmentInfo ? (
          <div className="grid gap-3">
            <p className="text-sm text-mz-text-muted">
              Bu kodni qurilmadagi ulash oynasiga 15 daqiqa ichida kiriting.
              Kod bir marta ishlatiladi.
            </p>
            <div className="rounded-mz-card border border-mz-border bg-mz-surface-sunken p-4 text-center">
              <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-mz-text-muted">
                Ulanish kodi
              </p>
              <p className="mt-2 font-mono text-2xl font-bold tracking-[0.2em] text-mz-info">
                {enrollmentInfo.code}
              </p>
            </div>
            <p className="text-[12px] text-mz-text-muted">
              Qurilma ID: {enrollmentInfo.deviceId}
            </p>
          </div>
        ) : null}
      </Modal>
    </>
  );
}
