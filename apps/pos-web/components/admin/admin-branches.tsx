"use client";

import { useMemo, useState } from "react";
import { apiFetch, SessionExpiredError } from "../../lib/api";
import { useApiResource } from "../../lib/use-api-resource";
import { hasPermission } from "../../lib/auth";
import { useAuth } from "../auth/auth-provider";
import { Badge } from "../admin-ui/badge";
import { Button } from "../admin-ui/button";
import { Card, CardBody, CardHeader } from "../admin-ui/card";
import {
  DataTable,
  RowAction,
  type DataTableColumn,
} from "../admin-ui/data-table";
import { EmptyState, ErrorState, Skeleton } from "../admin-ui/feedback";
import { FormField, TextInput } from "../admin-ui/form";
import { Icon } from "../admin-ui/icon";
import { Modal } from "../admin-ui/modal";
import { Toggle } from "../admin-ui/toggle";
import { useToast } from "../admin-ui/toast";

/*
 * Filiallar.
 *
 * Backend `POST /branches`, `PATCH /branches/:id` va
 * `PATCH /branches/:id/working-hours` ni qo'llab-quvvatlaydi. O'CHIRISH
 * endpoint'i YO'Q va shuning uchun bu ekranda ham o'chirish tugmasi yo'q —
 * filial ishdan chiqarilganda "Faol" o'chiriladi.
 *
 * `PATCH /branches/:id/product-availability` bu yerda TAKRORLANMAYDI —
 * u mahsulot tahrirlagichida, mahsulot kontekstida turadi.
 *
 * MIJOZGA TA'SIR. "Faol", "Buyurtma qabul qiladi", "Yetkazib berish",
 * "Olib ketish" va "Vaqtincha yopiq" — bularning hammasi mijoz saytida
 * DARHOL ko'rinadi. Cheklovchi tomonga o'zgartirish TASDIQLASH oynasidan
 * o'tadi va oyna aynan nima o'chayotganini sanab beradi.
 */

export const weekDays = [
  { key: "MONDAY", label: "Dushanba" },
  { key: "TUESDAY", label: "Seshanba" },
  { key: "WEDNESDAY", label: "Chorshanba" },
  { key: "THURSDAY", label: "Payshanba" },
  { key: "FRIDAY", label: "Juma" },
  { key: "SATURDAY", label: "Shanba" },
  { key: "SUNDAY", label: "Yakshanba" },
] as const;

type WorkingHour = {
  dayOfWeek: string;
  opensAt?: string | null;
  closesAt?: string | null;
  isClosed: boolean;
};

type Branch = {
  id: string;
  code: string;
  name: string;
  address?: string | null;
  phone?: string | null;
  timezone?: string | null;
  sortOrder?: number;
  isActive: boolean;
  isTemporarilyClosed?: boolean;
  acceptsOrders: boolean;
  deliveryEnabled: boolean;
  pickupEnabled: boolean;
  workingHours?: WorkingHour[];
  /** Faqat ro'yxat/bitta filial javobida keladi (yaratish/yangilashda yo'q). */
  isOpen?: boolean;
  _count?: {
    employees: number;
    printers: number;
    devices: number;
    products: number;
  };
};

type BranchDraft = {
  code: string;
  name: string;
  address: string;
  phone: string;
  sortOrder: string;
  isActive: boolean;
  isTemporarilyClosed: boolean;
  acceptsOrders: boolean;
  deliveryEnabled: boolean;
  pickupEnabled: boolean;
};

const emptyDraft: BranchDraft = {
  code: "",
  name: "",
  address: "",
  phone: "",
  sortOrder: "0",
  isActive: true,
  isTemporarilyClosed: false,
  acceptsOrders: true,
  deliveryEnabled: true,
  pickupEnabled: true,
};

function draftFrom(branch: Branch): BranchDraft {
  return {
    code: branch.code,
    name: branch.name,
    address: branch.address ?? "",
    phone: branch.phone ?? "",
    sortOrder: String(branch.sortOrder ?? 0),
    isActive: branch.isActive,
    isTemporarilyClosed: branch.isTemporarilyClosed ?? false,
    acceptsOrders: branch.acceptsOrders,
    deliveryEnabled: branch.deliveryEnabled,
    pickupEnabled: branch.pickupEnabled,
  };
}

/** Kunlarni to'liq haftaga to'ldiradi — backend faqat o'rnatilganlarini qaytaradi. */
function fullWeek(hours: WorkingHour[] | undefined): WorkingHour[] {
  return weekDays.map((day) => {
    const existing = hours?.find((hour) => hour.dayOfWeek === day.key);

    return (
      existing ?? {
        dayOfWeek: day.key,
        opensAt: "09:00",
        closesAt: "23:00",
        isClosed: false,
      }
    );
  });
}

/*
 * Mijozga ko'rinadigan bayroqlar. Har biri uchun: qaysi yo'nalish CHEKLOVCHI
 * va o'chirilganda mijoz nimani yo'qotadi.
 */
const customerFacingFlags = [
  {
    key: "isActive" as const,
    restrictiveWhen: false,
    consequence: "Filial mijoz saytida va Telegram botda butunlay ko'rinmaydi.",
  },
  {
    key: "isTemporarilyClosed" as const,
    restrictiveWhen: true,
    consequence:
      "Filial ro'yxatda qoladi, lekin mijoz undan buyurtma bera olmaydi.",
  },
  {
    key: "acceptsOrders" as const,
    restrictiveWhen: false,
    consequence: "Bu filialga yangi buyurtma qabul qilinmaydi.",
  },
  {
    key: "deliveryEnabled" as const,
    restrictiveWhen: false,
    consequence: "Mijoz bu filialdan yetkazib berishni tanlay olmaydi.",
  },
  {
    key: "pickupEnabled" as const,
    restrictiveWhen: false,
    consequence: "Mijoz bu filialdan olib ketishni tanlay olmaydi.",
  },
];

/** Cheklovchi tomonga o'zgargan bayroqlarning oqibatlari ro'yxati. */
function restrictiveChanges(
  before: BranchDraft | null,
  after: BranchDraft,
): string[] {
  return customerFacingFlags
    .filter((flag) => {
      const next = after[flag.key];

      if (next !== flag.restrictiveWhen) {
        return false;
      }

      // Yangi filialda "oldingi holat" yo'q — faqat cheklov o'rnatilgani muhim.
      return before === null || before[flag.key] !== next;
    })
    .map((flag) => flag.consequence);
}

const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

export function AdminBranchesPage() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [isSaving, setIsSaving] = useState(false);

  const [editing, setEditing] = useState<Branch | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [draft, setDraft] = useState<BranchDraft>(emptyDraft);
  const [baseline, setBaseline] = useState<BranchDraft | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pendingConsequences, setPendingConsequences] = useState<
    string[] | null
  >(null);

  const [hoursFor, setHoursFor] = useState<Branch | null>(null);
  const [hours, setHours] = useState<WorkingHour[]>([]);
  const [hourErrors, setHourErrors] = useState<Record<string, string>>({});

  const canCreate = hasPermission(user, "BRANCH_CREATE");
  const canEdit = hasPermission(user, "BRANCH_EDIT");

  const {
    data,
    isLoading,
    error,
    reload: load,
  } = useApiResource<Branch[]>(
    () => apiFetch<Branch[]>("/branches"),
    [],
    "Filiallarni yuklab bo'lmadi.",
  );

  const branches = useMemo(
    () =>
      [...(data ?? [])].sort(
        (left, right) =>
          (left.sortOrder ?? 0) - (right.sortOrder ?? 0) ||
          left.name.localeCompare(right.name, "uz"),
      ),
    [data],
  );

  function openCreate(): void {
    setDraft(emptyDraft);
    setBaseline(null);
    setErrors({});
    setIsCreating(true);
  }

  function openEdit(branch: Branch): void {
    const next = draftFrom(branch);
    setDraft(next);
    setBaseline(next);
    setErrors({});
    setEditing(branch);
  }

  function openHours(branch: Branch): void {
    setHours(fullWeek(branch.workingHours));
    setHourErrors({});
    setHoursFor(branch);
  }

  function closeAll(): void {
    setIsCreating(false);
    setEditing(null);
    setHoursFor(null);
    setPendingConsequences(null);
    setErrors({});
    setHourErrors({});
  }

  function validateDraft(): Record<string, string> {
    const next: Record<string, string> = {};

    if (!draft.name.trim()) {
      next.name = "Filial nomi kiritilishi shart.";
    } else if (draft.name.trim().length > 120) {
      next.name = "Nom 120 belgidan oshmasligi kerak.";
    }

    if (draft.code.trim().length > 60) {
      next.code = "Kod 60 belgidan oshmasligi kerak.";
    }

    if (draft.address.trim().length > 500) {
      next.address = "Manzil 500 belgidan oshmasligi kerak.";
    }

    if (draft.phone.trim().length > 40) {
      next.phone = "Telefon 40 belgidan oshmasligi kerak.";
    }

    const sortOrder = Number(draft.sortOrder);

    if (!Number.isInteger(sortOrder) || sortOrder < 0) {
      next.sortOrder =
        "Tartib raqami 0 yoki undan katta butun son bo'lishi kerak.";
    }

    return next;
  }

  /** Saqlashni boshlaydi: avval validatsiya, keyin kerak bo'lsa tasdiqlash. */
  function requestSave(): void {
    const nextErrors = validateDraft();
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    const consequences = restrictiveChanges(baseline, draft);

    if (consequences.length > 0) {
      setPendingConsequences(consequences);
      return;
    }

    void saveBranch();
  }

  async function saveBranch(): Promise<void> {
    setIsSaving(true);

    /*
     * Backend `forbidNonWhitelisted: true` bilan ishlaydi — DTO'da yo'q
     * maydon 400 beradi. Shuning uchun tana AYNAN DTO maydonlaridan iborat.
     */
    const body = {
      name: draft.name.trim(),
      ...(draft.code.trim() ? { code: draft.code.trim() } : {}),
      ...(draft.address.trim() ? { address: draft.address.trim() } : {}),
      ...(draft.phone.trim() ? { phone: draft.phone.trim() } : {}),
      sortOrder: Number(draft.sortOrder),
      isActive: draft.isActive,
      isTemporarilyClosed: draft.isTemporarilyClosed,
      acceptsOrders: draft.acceptsOrders,
      deliveryEnabled: draft.deliveryEnabled,
      pickupEnabled: draft.pickupEnabled,
    };

    try {
      if (editing) {
        await apiFetch(`/branches/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
        showToast(
          "Filial yangilandi. O'zgarish mijozga darhol ko'rinadi.",
          "success",
        );
      } else {
        await apiFetch("/branches", {
          method: "POST",
          body: JSON.stringify(body),
        });
        showToast("Filial yaratildi.", "success");
      }

      closeAll();
      load();
    } catch (caught) {
      if (caught instanceof SessionExpiredError) {
        return;
      }

      setPendingConsequences(null);
      showToast(
        caught instanceof Error ? caught.message : "Saqlab bo'lmadi.",
        "danger",
      );
    } finally {
      setIsSaving(false);
    }
  }

  function validateHours(): Record<string, string> {
    const next: Record<string, string> = {};

    for (const hour of hours) {
      if (hour.isClosed) {
        continue;
      }

      const opensAt = hour.opensAt ?? "";
      const closesAt = hour.closesAt ?? "";

      if (!timePattern.test(opensAt) || !timePattern.test(closesAt)) {
        next[hour.dayOfWeek] =
          "Vaqt 24 soatlik HH:MM ko'rinishida bo'lishi kerak (masalan 09:00).";
        continue;
      }

      /*
       * Tunga o'tadigan smena (22:00–02:00) HAQIQIY holat, shuning uchun
       * `opensAt >= closesAt` xato deb hisoblanmaydi. Faqat AYNI qiymat
       * xato: u nol uzunlikdagi ish vaqti degani.
       */
      if (opensAt === closesAt) {
        next[hour.dayOfWeek] =
          "Ochilish va yopilish vaqti bir xil bo'lmasligi kerak. Kun yopiq bo'lsa \"Yopiq\" ni yoqing.";
      }
    }

    return next;
  }

  async function saveHours(): Promise<void> {
    if (!hoursFor) {
      return;
    }

    const nextErrors = validateHours();
    setHourErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setIsSaving(true);

    try {
      await apiFetch(`/branches/${hoursFor.id}/working-hours`, {
        method: "PATCH",
        body: JSON.stringify({
          hours: hours.map((hour) => ({
            dayOfWeek: hour.dayOfWeek,
            isClosed: hour.isClosed,
            ...(hour.isClosed
              ? {}
              : {
                  ...(hour.opensAt ? { opensAt: hour.opensAt } : {}),
                  ...(hour.closesAt ? { closesAt: hour.closesAt } : {}),
                }),
          })),
        }),
      });

      showToast("Ish vaqti yangilandi.", "success");
      closeAll();
      load();
    } catch (caught) {
      if (caught instanceof SessionExpiredError) {
        return;
      }

      showToast(
        caught instanceof Error ? caught.message : "Saqlab bo'lmadi.",
        "danger",
      );
    } finally {
      setIsSaving(false);
    }
  }

  const columns: DataTableColumn<Branch>[] = [
    {
      key: "branch",
      header: "Filial",
      primary: true,
      render: (branch) => (
        <div className="min-w-0">
          <p className="truncate font-semibold text-mz-text">{branch.name}</p>
          <p className="truncate text-[13px] text-mz-text-muted">
            {branch.code}
            {branch.address ? ` · ${branch.address}` : ""}
          </p>
        </div>
      ),
    },
    {
      key: "state",
      header: "Mijoz uchun holat",
      render: (branch) => (
        <div className="flex flex-wrap justify-end gap-1 md:justify-start">
          <Badge tone={branch.isActive ? "success" : "danger"} withDot>
            {branch.isActive ? "Faol" : "Faol emas"}
          </Badge>
          {branch.isTemporarilyClosed ? (
            <Badge tone="warning">Vaqtincha yopiq</Badge>
          ) : null}
          <Badge tone={branch.acceptsOrders ? "success" : "warning"}>
            {branch.acceptsOrders ? "Buyurtma oladi" : "Buyurtma olmaydi"}
          </Badge>
          {branch.isOpen === undefined ? null : (
            <Badge tone={branch.isOpen ? "info" : "neutral"}>
              {branch.isOpen ? "Hozir ish vaqtida" : "Ish vaqtidan tashqari"}
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: "channels",
      header: "Xizmat turlari",
      render: (branch) => (
        <div className="flex flex-wrap justify-end gap-1 md:justify-start">
          <Badge tone={branch.deliveryEnabled ? "info" : "neutral"}>
            {branch.deliveryEnabled ? "Yetkazish yoqilgan" : "Yetkazish o'chiq"}
          </Badge>
          <Badge tone={branch.pickupEnabled ? "info" : "neutral"}>
            {branch.pickupEnabled
              ? "Olib ketish yoqilgan"
              : "Olib ketish o'chiq"}
          </Badge>
        </div>
      ),
    },
    {
      key: "resources",
      header: "Xodim / kassa / printer",
      align: "right",
      hideOnMobile: true,
      render: (branch) => (
        <span className="text-[13px] text-mz-text-muted">
          {branch._count
            ? `${branch._count.employees} · ${branch._count.devices} · ${branch._count.printers}`
            : "—"}
        </span>
      ),
    },
    {
      key: "phone",
      header: "Telefon",
      align: "right",
      hideOnMobile: true,
      render: (branch) => branch.phone ?? "—",
    },
  ];

  // Skelet FAQAT birinchi yuklashda. Saqlashdan keyingi qayta yuklashda
  // butun sahifani skeletga aylantirish maketni sakratardi va ochiq
  // kartochkalarni yo'q qilardi.
  if (isLoading && !data) {
    return (
      <div aria-busy="true" className="grid gap-4">
        <span className="sr-only">Yuklanmoqda</span>
        <Skeleton className="h-11 w-44" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error) {
    return <ErrorState message={error} onRetry={load} />;
  }

  return (
    <div className="grid gap-5">
      <Card>
        <CardBody>
          <p className="text-[13px] text-mz-text-muted">
            Bu ekrandagi holat o&apos;zgarishlari mijoz saytida va Telegram
            botda <span className="font-semibold text-mz-text">darhol</span>{" "}
            ko&apos;rinadi. Filialni o&apos;chirib tashlash imkoni yo&apos;q —
            ishdan chiqqan filialda &laquo;Faol&raquo; o&apos;chiriladi va
            tarixi saqlanib qoladi.
          </p>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          actions={
            canCreate ? (
              <Button onClick={openCreate} size="lg">
                <Icon className="h-4 w-4" name="plus" />
                Yangi filial
              </Button>
            ) : null
          }
          description={`${branches.length} ta filial · ustunlar: xodim · kassa qurilmasi · printer`}
          title="Filiallar"
        />
        <DataTable
          caption="Filiallar ro'yxati"
          columns={columns}
          emptyDescription="Birinchi filialni qo'shing — mahsulot, xodim va kassa shundan keyin biriktiriladi."
          emptyIcon="building"
          emptyTitle="Filial yo'q"
          getRowKey={(branch) => branch.id}
          rows={branches}
          rowActions={(branch: Branch) => (
            <>
              <RowAction
                href={`/admin/branches/${branch.id}`}
                icon="eye"
                label={`${branch.name} - ochish`}
              />
              {canEdit ? (
                <>
                  <Button
                    onClick={() => openHours(branch)}
                    size="sm"
                    variant="ghost"
                  >
                    <Icon className="h-4 w-4" name="clock" />
                    Ish vaqti
                  </Button>
                  <Button
                    onClick={() => openEdit(branch)}
                    size="sm"
                    variant="ghost"
                  >
                    <Icon className="h-4 w-4" name="pencil" />
                    Tahrirlash
                  </Button>
                </>
              ) : null}
            </>
          )}
        />
      </Card>

      {/* Ish vaqtini bir ko'rishda taqqoslash uchun jadval. */}
      {branches.length > 0 ? (
        <Card>
          <CardHeader
            description="Barcha filiallarning haftalik jadvali"
            title="Ish vaqti"
          />
          <CardBody className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {branches.map((branch) => (
              <div
                className="rounded-mz-control border border-mz-border p-3"
                key={branch.id}
              >
                <p className="mb-2 truncate text-sm font-semibold text-mz-text">
                  {branch.name}
                </p>
                <dl className="grid gap-0.5 text-[13px]">
                  {fullWeek(branch.workingHours).map((hour) => {
                    const day = weekDays.find(
                      (item) => item.key === hour.dayOfWeek,
                    );

                    return (
                      <div
                        className="flex justify-between gap-4"
                        key={hour.dayOfWeek}
                      >
                        <dt className="text-mz-text-muted">
                          {day?.label ?? hour.dayOfWeek}
                        </dt>
                        <dd
                          className={
                            hour.isClosed
                              ? "font-semibold text-mz-danger"
                              : "text-mz-text"
                          }
                        >
                          {hour.isClosed
                            ? "Yopiq"
                            : `${hour.opensAt ?? "--:--"} – ${hour.closesAt ?? "--:--"}`}
                        </dd>
                      </div>
                    );
                  })}
                </dl>
              </div>
            ))}
          </CardBody>
        </Card>
      ) : null}

      {/* --- Filial formasi ------------------------------------------------ */}
      <Modal
        /*
         * `dismissOnBackdrop={false}`: bu FORMA oynasi. Fonni beparvo bosish
         * terilgan ma'lumotni ogohlantirmasdan yo'q qilib yuborardi.
         */
        dismissOnBackdrop={false}
        footer={
          <>
            <Button onClick={closeAll} variant="ghost">
              Bekor qilish
            </Button>
            <Button isLoading={isSaving} onClick={requestSave} size="lg">
              Saqlash
            </Button>
          </>
        }
        isOpen={
          (isCreating || editing !== null) && pendingConsequences === null
        }
        onClose={closeAll}
        title={editing ? `${editing.name} — tahrirlash` : "Yangi filial"}
      >
        <div className="grid gap-3">
          <FormField
            label="Nomi"
            required
            {...(errors.name ? { error: errors.name } : {})}
          >
            {(props) => (
              <TextInput
                {...props}
                maxLength={120}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                value={draft.name}
              />
            )}
          </FormField>

          <div className="grid gap-3 sm:grid-cols-2">
            <FormField
              hint="Bo'sh qoldirilsa server o'zi hosil qiladi"
              label="Kod"
              {...(errors.code ? { error: errors.code } : {})}
            >
              {(props) => (
                <TextInput
                  {...props}
                  maxLength={60}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      code: event.target.value,
                    }))
                  }
                  value={draft.code}
                />
              )}
            </FormField>

            <FormField
              hint="Kichik raqam ro'yxatda yuqorida turadi"
              label="Tartib raqami"
              {...(errors.sortOrder ? { error: errors.sortOrder } : {})}
            >
              {(props) => (
                <TextInput
                  {...props}
                  inputMode="numeric"
                  min={0}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      sortOrder: event.target.value,
                    }))
                  }
                  type="number"
                  value={draft.sortOrder}
                />
              )}
            </FormField>
          </div>

          <FormField
            label="Manzil"
            {...(errors.address ? { error: errors.address } : {})}
          >
            {(props) => (
              <TextInput
                {...props}
                maxLength={500}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    address: event.target.value,
                  }))
                }
                value={draft.address}
              />
            )}
          </FormField>

          <FormField
            hint="Mijoz filialga bog'lanish uchun ishlatadi"
            label="Telefon"
            {...(errors.phone ? { error: errors.phone } : {})}
          >
            {(props) => (
              <TextInput
                {...props}
                maxLength={40}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    phone: event.target.value,
                  }))
                }
                type="tel"
                value={draft.phone}
              />
            )}
          </FormField>

          <div className="grid gap-3 border-t border-mz-border pt-3">
            <p className="text-[13px] font-semibold text-mz-text">
              Mijozga ko&apos;rinadigan holat
            </p>
            <Toggle
              checked={draft.isActive}
              description="O'chirilsa filial mijoz saytida va botda umuman ko'rinmaydi"
              label="Faol"
              onChange={(checked) =>
                setDraft((current) => ({ ...current, isActive: checked }))
              }
            />
            <Toggle
              checked={draft.isTemporarilyClosed}
              description="Filial ro'yxatda qoladi, lekin hozir buyurtma qabul qilmaydi (ta'mir, texnik tanaffus)"
              label="Vaqtincha yopiq"
              onChange={(checked) =>
                setDraft((current) => ({
                  ...current,
                  isTemporarilyClosed: checked,
                }))
              }
            />
            <Toggle
              checked={draft.acceptsOrders}
              description="O'chirilsa yangi buyurtma qabul qilinmaydi, mavjudlari ishlanadi"
              label="Buyurtma qabul qiladi"
              onChange={(checked) =>
                setDraft((current) => ({ ...current, acceptsOrders: checked }))
              }
            />
            <Toggle
              checked={draft.deliveryEnabled}
              description="Mijoz checkout'da yetkazib berishni tanlay oladimi"
              label="Yetkazib berish"
              onChange={(checked) =>
                setDraft((current) => ({
                  ...current,
                  deliveryEnabled: checked,
                }))
              }
            />
            <Toggle
              checked={draft.pickupEnabled}
              description="Mijoz buyurtmani o'zi olib keta oladimi"
              label="Olib ketish"
              onChange={(checked) =>
                setDraft((current) => ({ ...current, pickupEnabled: checked }))
              }
            />
          </div>
        </div>
      </Modal>

      {/* --- Mijozga ta'sir qiladigan o'zgarishni tasdiqlash --------------- */}
      <Modal
        footer={
          <>
            <Button
              onClick={() => setPendingConsequences(null)}
              variant="ghost"
            >
              Orqaga
            </Button>
            <Button
              isLoading={isSaving}
              onClick={() => void saveBranch()}
              size="lg"
              variant="danger"
            >
              Tasdiqlayman va saqlayman
            </Button>
          </>
        }
        isOpen={pendingConsequences !== null}
        onClose={() => setPendingConsequences(null)}
        title="Mijozga ko'rinadigan o'zgarish"
      >
        <div className="grid gap-2">
          <p className="text-sm text-mz-text">
            Saqlangandan keyin quyidagilar{" "}
            <span className="font-semibold">darhol</span> kuchga kiradi:
          </p>
          <ul className="grid gap-1.5">
            {(pendingConsequences ?? []).map((consequence) => (
              <li
                className="flex items-start gap-2 rounded-mz-control bg-mz-warning-bg px-3 py-2 text-[13px] font-medium text-mz-warning"
                key={consequence}
              >
                <Icon className="mt-0.5 h-4 w-4 shrink-0" name="alert" />
                {consequence}
              </li>
            ))}
          </ul>
        </div>
      </Modal>

      {/* --- Ish vaqti ----------------------------------------------------- */}
      <Modal
        description="Vaqt 24 soatlik formatda (masalan 09:00). Tunga o'tadigan smena mumkin: 22:00 – 02:00."
        dismissOnBackdrop={false}
        footer={
          <>
            <Button onClick={closeAll} variant="ghost">
              Bekor qilish
            </Button>
            <Button
              isLoading={isSaving}
              onClick={() => void saveHours()}
              size="lg"
            >
              Saqlash
            </Button>
          </>
        }
        isOpen={hoursFor !== null}
        onClose={closeAll}
        title={hoursFor ? `${hoursFor.name} — ish vaqti` : "Ish vaqti"}
      >
        {hours.length === 0 ? (
          <EmptyState title="Kunlar yuklanmadi" />
        ) : (
          <div className="grid gap-2">
            {hours.map((hour, index) => {
              const day = weekDays.find((item) => item.key === hour.dayOfWeek);
              const dayLabel = day?.label ?? hour.dayOfWeek;
              const hourError = hourErrors[hour.dayOfWeek];

              return (
                <div
                  /*
                   * Mobilda ustunga yig'iladi. `grid-cols-[1fr_auto]` da ikkita
                   * `type="time"` input (brauzerda ~120px) kun nomi bilan yonma-yon
                   * turib 320px ekranga sig'masdi — DESIGN_RULES gorizontal
                   * overflow'ni taqiqlaydi.
                   */
                  className="grid gap-2 border-b border-mz-border pb-3 last:border-b-0 sm:grid-cols-[8rem_1fr_auto] sm:items-center sm:gap-3 sm:pb-2"
                  key={hour.dayOfWeek}
                >
                  <span className="text-sm font-semibold text-mz-text">
                    {dayLabel}
                  </span>

                  <div className="flex min-w-0 items-center gap-2">
                    <TextInput
                      aria-invalid={hourError ? true : undefined}
                      aria-label={`${dayLabel} ochilish vaqti`}
                      className="min-w-0 flex-1"
                      disabled={hour.isClosed}
                      onChange={(event) =>
                        setHours((current) =>
                          current.map((item, position) =>
                            position === index
                              ? { ...item, opensAt: event.target.value }
                              : item,
                          ),
                        )
                      }
                      type="time"
                      value={hour.opensAt ?? ""}
                    />
                    <span className="text-mz-text-faint">–</span>
                    <TextInput
                      aria-invalid={hourError ? true : undefined}
                      aria-label={`${dayLabel} yopilish vaqti`}
                      className="min-w-0 flex-1"
                      disabled={hour.isClosed}
                      onChange={(event) =>
                        setHours((current) =>
                          current.map((item, position) =>
                            position === index
                              ? { ...item, closesAt: event.target.value }
                              : item,
                          ),
                        )
                      }
                      type="time"
                      value={hour.closesAt ?? ""}
                    />
                  </div>

                  <Toggle
                    checked={hour.isClosed}
                    label="Yopiq"
                    onChange={(checked) =>
                      setHours((current) =>
                        current.map((item, position) =>
                          position === index
                            ? { ...item, isClosed: checked }
                            : item,
                        ),
                      )
                    }
                  />

                  {hourError ? (
                    <p
                      className="text-[13px] font-medium text-mz-danger sm:col-span-3"
                      role="alert"
                    >
                      {hourError}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </Modal>
    </div>
  );
}
