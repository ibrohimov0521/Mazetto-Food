"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { hasPermission } from "../../lib/auth";
import { apiFetch, SessionExpiredError } from "../../lib/api";
import { useApiResource } from "../../lib/use-api-resource";
import { useAuth } from "../auth/auth-provider";
import { AdminPageHeader } from "../admin-shell/admin-page-header";
import { Badge, type BadgeTone } from "../admin-ui/badge";
import { Button, ButtonLink } from "../admin-ui/button";
import { Card, CardBody, CardFooter, CardHeader } from "../admin-ui/card";
import {
  DataTable,
  RowAction,
  type DataTableColumn,
} from "../admin-ui/data-table";
import { EmptyState, ErrorState, Skeleton } from "../admin-ui/feedback";
import { FormField, TextInput, Textarea } from "../admin-ui/form";
import { Icon } from "../admin-ui/icon";
import { Modal } from "../admin-ui/modal";
import { useToast } from "../admin-ui/toast";

type TableStatus = "AVAILABLE" | "OCCUPIED" | "RESERVED" | "CLEANING";

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
  isActive: boolean;
  isTemporarilyClosed?: boolean;
  acceptsOrders: boolean;
  deliveryEnabled: boolean;
  pickupEnabled: boolean;
  workingHours?: WorkingHour[];
  _count?: {
    employees: number;
    printers: number;
    devices: number;
    products: number;
  };
};

type HallListItem = {
  id: string;
  branchId: string;
  code: string;
  name: string;
  description?: string | null;
  isActive: boolean;
  sortOrder: number;
  _count?: { tables: number };
};

type TableSummary = {
  id: string;
  branchId: string;
  hallId: string | null;
  number: number | null;
  name: string;
  capacity: number | null;
  seats: number | null;
  status: TableStatus;
  isActive: boolean;
  sortOrder: number;
  orders?: Array<{ id: string }>;
};

type HallDetail = HallListItem & {
  branch: Pick<Branch, "id" | "code" | "name" | "isActive">;
  tables: TableSummary[];
};

type TableDetail = Omit<TableSummary, "orders"> & {
  branch?: { id: string; name: string } | null;
  hall?: { id: string; name: string } | null;
  orders: Array<{
    id: string;
    orderNumber: string;
    displayOrderNumber?: number | null;
    status: string;
    createdAt: string;
    waiter?: { fullName?: string | null } | null;
  }>;
};

type HallDraft = {
  name: string;
  description: string;
  sortOrder: string;
};

type TableDraft = {
  name: string;
  number: string;
  capacity: string;
  sortOrder: string;
};

const statusLabels: Record<TableStatus, string> = {
  AVAILABLE: "Bo'sh",
  OCCUPIED: "Band",
  RESERVED: "Bron qilingan",
  CLEANING: "Tozalanmoqda",
};

const statusTones: Record<TableStatus, BadgeTone> = {
  AVAILABLE: "success",
  OCCUPIED: "info",
  RESERVED: "warning",
  CLEANING: "neutral",
};

function messageOf(caught: unknown, fallback: string): string {
  return caught instanceof Error ? caught.message : fallback;
}

function currentBranchState(branch: Branch): {
  label: string;
  tone: BadgeTone;
} {
  if (!branch.isActive) {
    return { label: "Faol emas", tone: "neutral" };
  }

  if (branch.isTemporarilyClosed) {
    return { label: "Vaqtincha yopiq", tone: "warning" };
  }

  return branch.acceptsOrders
    ? { label: "Buyurtma qabul qiladi", tone: "success" }
    : { label: "Buyurtma qabul qilmaydi", tone: "warning" };
}

function toHallDraft(
  hall: Pick<HallDetail, "name" | "description" | "sortOrder">,
): HallDraft {
  return {
    name: hall.name,
    description: hall.description ?? "",
    sortOrder: String(hall.sortOrder),
  };
}

function toTableDraft(table: TableSummary): TableDraft {
  return {
    name: table.name,
    number: String(table.number ?? ""),
    capacity: String(table.capacity ?? table.seats ?? ""),
    sortOrder: String(table.sortOrder),
  };
}

function resourceLoading() {
  return (
    <div aria-busy="true" className="grid gap-5">
      <span className="sr-only">Yuklanmoqda</span>
      <Skeleton className="h-20 w-full" />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <Skeleton className="h-56 w-full" />
        <Skeleton className="h-56 w-full" />
      </div>
      <Skeleton className="h-80 w-full" />
    </div>
  );
}

/**
 * Filial ichidagi ish maydoni. Bu ro'yxatdan keyingi kontekst sahifa:
 * filial -> zal -> stol, ya'ni stol tanlash endi umumiy select ichida yo'q.
 */
export function AdminBranchWorkspace({ branchId }: { branchId: string }) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const canViewTables = hasPermission(user, "TABLE_VIEW");
  const canCreateTables = hasPermission(user, "TABLE_CREATE");
  const [isCreateHallOpen, setIsCreateHallOpen] = useState(false);
  const [hallDraft, setHallDraft] = useState<HallDraft>({
    name: "",
    description: "",
    sortOrder: "0",
  });
  const [isSavingHall, setIsSavingHall] = useState(false);

  const resource = useApiResource<[Branch, HallListItem[]]>(
    () =>
      Promise.all([
        apiFetch<Branch>(`/branches/${branchId}`),
        canViewTables
          ? apiFetch<HallListItem[]>(`/halls?branchId=${branchId}`)
          : Promise.resolve([] as HallListItem[]),
      ]),
    [branchId, canViewTables],
    "Filial ma'lumotlarini yuklab bo'lmadi.",
  );

  const branch = resource.data?.[0] ?? null;
  const halls = resource.data?.[1] ?? [];
  const totalTables = useMemo(
    () => halls.reduce((sum, hall) => sum + (hall._count?.tables ?? 0), 0),
    [halls],
  );

  function openCreateHall(): void {
    setHallDraft({
      name: "",
      description: "",
      sortOrder: String(halls.length),
    });
    setIsCreateHallOpen(true);
  }

  async function createHall(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const name = hallDraft.name.trim();

    if (!name) {
      showToast("Zal nomini kiriting.", "danger");
      return;
    }

    const sortOrder = Number(hallDraft.sortOrder);

    if (!Number.isInteger(sortOrder) || sortOrder < 0) {
      showToast(
        "Tartib raqami 0 yoki undan katta butun son bo'lishi kerak.",
        "danger",
      );
      return;
    }

    setIsSavingHall(true);
    try {
      await apiFetch("/halls", {
        method: "POST",
        body: JSON.stringify({
          branchId,
          name,
          ...(hallDraft.description.trim()
            ? { description: hallDraft.description.trim() }
            : {}),
          sortOrder,
        }),
      });
      setIsCreateHallOpen(false);
      showToast(
        "Zal yaratildi. Endi zal ichidan stol qo'shishingiz mumkin.",
        "success",
      );
      resource.reload();
    } catch (caught) {
      if (caught instanceof SessionExpiredError) {
        return;
      }

      showToast(messageOf(caught, "Zalni yaratib bo'lmadi."), "danger");
    } finally {
      setIsSavingHall(false);
    }
  }

  if (resource.isLoading && !resource.data) {
    return resourceLoading();
  }

  if (resource.error || !branch) {
    return (
      <ErrorState
        message={resource.error || "Filial topilmadi."}
        onRetry={resource.reload}
      />
    );
  }

  const state = currentBranchState(branch);

  return (
    <>
      <AdminPageHeader
        actions={
          canCreateTables ? (
            <Button onClick={openCreateHall} size="lg">
              <Icon className="h-4 w-4" name="plus" />
              Yangi zal
            </Button>
          ) : null
        }
        backHref="/admin/branches"
        breadcrumbs={[
          { label: "Bosh sahifa", href: "/admin/dashboard" },
          { label: "Filiallar", href: "/admin/branches" },
          { label: branch.name },
        ]}
        description="Filial ichidagi zallar, stollar va asosiy resurslar"
        title={branch.name}
      />

      {resource.error ? (
        <ErrorState message={resource.error} onRetry={resource.reload} />
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <Card>
          <CardHeader
            description={`Kod: ${branch.code}`}
            title="Filial haqida"
          />
          <CardBody>
            <dl className="grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-[13px] font-medium text-mz-text-muted">
                  Manzil
                </dt>
                <dd className="mt-1 text-sm font-semibold text-mz-text">
                  {branch.address ?? "Kiritilmagan"}
                </dd>
              </div>
              <div>
                <dt className="text-[13px] font-medium text-mz-text-muted">
                  Telefon
                </dt>
                <dd className="mt-1 text-sm font-semibold text-mz-text">
                  {branch.phone ?? "Kiritilmagan"}
                </dd>
              </div>
              <div>
                <dt className="text-[13px] font-medium text-mz-text-muted">
                  Xizmatlar
                </dt>
                <dd className="mt-1 flex flex-wrap gap-1.5">
                  <Badge tone={branch.deliveryEnabled ? "info" : "neutral"}>
                    Yetkazish{" "}
                    {branch.deliveryEnabled ? "yoqilgan" : "ochiq emas"}
                  </Badge>
                  <Badge tone={branch.pickupEnabled ? "info" : "neutral"}>
                    Olib ketish{" "}
                    {branch.pickupEnabled ? "yoqilgan" : "ochiq emas"}
                  </Badge>
                </dd>
              </div>
              <div>
                <dt className="text-[13px] font-medium text-mz-text-muted">
                  Resurslar
                </dt>
                <dd className="mt-1 text-sm font-semibold text-mz-text">
                  {branch._count
                    ? `${branch._count.employees} xodim, ${branch._count.devices} qurilma, ${branch._count.printers} printer`
                    : "Hisoblanmoqda"}
                </dd>
              </div>
            </dl>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Hozirgi holat" />
          <CardBody className="grid content-start gap-4">
            <Badge tone={state.tone} withDot>
              {state.label}
            </Badge>
            <dl className="grid grid-cols-2 gap-3">
              <div>
                <dt className="text-[13px] text-mz-text-muted">Zallar</dt>
                <dd className="mt-0.5 text-2xl font-bold text-mz-text">
                  {halls.length}
                </dd>
              </div>
              <div>
                <dt className="text-[13px] text-mz-text-muted">Stollar</dt>
                <dd className="mt-0.5 text-2xl font-bold text-mz-text">
                  {totalTables}
                </dd>
              </div>
            </dl>
            {hasPermission(user, "RECEIPT_PRINT") ? (
              <ButtonLink
                className="w-full"
                href={`/admin/printers?branchId=${encodeURIComponent(branch.id)}`}
                variant="ghost"
              >
                <Icon className="h-4 w-4" name="printer" />
                Qurilmalar va printerlar
              </ButtonLink>
            ) : null}
          </CardBody>
        </Card>
      </div>

      <section className="mt-5" id="halls">
        <Card>
          <CardHeader
            actions={
              canCreateTables ? (
                <Button onClick={openCreateHall} variant="ghost">
                  <Icon className="h-4 w-4" name="plus" />
                  Zal qo'shish
                </Button>
              ) : null
            }
            description={
              canViewTables
                ? `${halls.length} ta zal. Stol faqat tegishli zal ichidan qo'shiladi.`
                : "Bu foydalanuvchida zal sxemasini ko'rish huquqi yo'q."
            }
            title="Zallar"
          />
          {canViewTables ? (
            halls.length ? (
              <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,22rem),1fr))] gap-3 p-4">
                {halls.map((hall) => (
                  <article
                    className="flex min-h-44 flex-col rounded-mz-card border border-mz-border bg-mz-surface p-4"
                    key={hall.id}
                  >
                    <div className="flex min-w-0 items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium text-mz-text-muted">
                          {hall.code}
                        </p>
                        <h2 className="mt-1 truncate text-base font-semibold text-mz-text">
                          {hall.name}
                        </h2>
                      </div>
                      <Badge
                        tone={hall.isActive ? "success" : "neutral"}
                        withDot
                      >
                        {hall.isActive ? "Faol" : "Arxiv"}
                      </Badge>
                    </div>
                    <p className="mt-3 line-clamp-2 text-sm text-mz-text-muted">
                      {hall.description || "Tavsif kiritilmagan."}
                    </p>
                    <div className="mt-auto flex items-center justify-between gap-3 border-t border-mz-border pt-3">
                      <span className="text-[13px] font-semibold text-mz-text-muted">
                        {hall._count?.tables ?? 0} ta stol
                      </span>
                      <ButtonLink
                        href={`/admin/branches/${branch.id}/halls/${hall.id}`}
                        size="sm"
                        variant="ghost"
                      >
                        Zalni ochish
                        <Icon className="h-4 w-4" name="chevronRight" />
                      </ButtonLink>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState
                action={
                  canCreateTables ? (
                    <Button onClick={openCreateHall}>
                      <Icon className="h-4 w-4" name="plus" />
                      Birinchi zalni yaratish
                    </Button>
                  ) : undefined
                }
                description="Zal yaratilgach, uning ichidan stol qo'shiladi va tartib bilan boshqariladi."
                icon="grid"
                title="Hali zal yo'q"
              />
            )
          ) : (
            <CardBody>
              <p className="text-sm text-mz-text-muted">
                Zallar va stollar filial ichidagi operatsion ma'lumotdir. Uni
                ko'rish uchun tegishli ruxsat kerak.
              </p>
            </CardBody>
          )}
        </Card>
      </section>

      <Modal
        dismissOnBackdrop={false}
        footer={
          <>
            <Button
              disabled={isSavingHall}
              onClick={() => setIsCreateHallOpen(false)}
              variant="ghost"
            >
              Bekor qilish
            </Button>
            <Button
              form="create-hall-form"
              isLoading={isSavingHall}
              type="submit"
            >
              Zalni yaratish
            </Button>
          </>
        }
        isOpen={isCreateHallOpen}
        onClose={() => setIsCreateHallOpen(false)}
        title="Yangi zal"
      >
        <form
          className="grid gap-3"
          id="create-hall-form"
          onSubmit={(event) => void createHall(event)}
        >
          <FormField label="Zal nomi" required>
            {(props) => (
              <TextInput
                {...props}
                maxLength={100}
                onChange={(event) =>
                  setHallDraft((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                placeholder="Asosiy zal"
                required
                value={hallDraft.name}
              />
            )}
          </FormField>
          <FormField label="Tavsif">
            {(props) => (
              <Textarea
                {...props}
                maxLength={500}
                onChange={(event) =>
                  setHallDraft((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                placeholder="Masalan: birinchi qavat, oilaviy zona"
                value={hallDraft.description}
              />
            )}
          </FormField>
          <FormField hint="Kichik raqam avval turadi." label="Tartib raqami">
            {(props) => (
              <TextInput
                {...props}
                min="0"
                onChange={(event) =>
                  setHallDraft((current) => ({
                    ...current,
                    sortOrder: event.target.value,
                  }))
                }
                type="number"
                value={hallDraft.sortOrder}
              />
            )}
          </FormField>
        </form>
      </Modal>
    </>
  );
}

export function AdminHallWorkspace({
  branchId,
  hallId,
}: {
  branchId: string;
  hallId: string;
}) {
  const { user } = useAuth();
  const router = useRouter();
  const { showToast } = useToast();
  const canCreateTables = hasPermission(user, "TABLE_CREATE");
  const canEditTables = hasPermission(user, "TABLE_EDIT");
  const [isHallEditorOpen, setIsHallEditorOpen] = useState(false);
  const [isCreateTableOpen, setIsCreateTableOpen] = useState(false);
  const [isArchiveHallOpen, setIsArchiveHallOpen] = useState(false);
  const [hallDraft, setHallDraft] = useState<HallDraft>({
    name: "",
    description: "",
    sortOrder: "0",
  });
  const [tableDraft, setTableDraft] = useState<TableDraft>({
    name: "",
    number: "1",
    capacity: "4",
    sortOrder: "1",
  });
  const [isSaving, setIsSaving] = useState(false);

  const resource = useApiResource<HallDetail>(
    () => apiFetch<HallDetail>(`/halls/${hallId}`),
    [hallId],
    "Zal ma'lumotlarini yuklab bo'lmadi.",
  );
  const hall = resource.data;

  useEffect(() => {
    if (hall) {
      setHallDraft(toHallDraft(hall));
    }
  }, [hall]);

  function openTableCreator(): void {
    const nextNumber =
      Math.max(...(hall?.tables.map((table) => table.number ?? 0) ?? [0])) + 1;

    setTableDraft({
      name: `Stol ${nextNumber}`,
      number: String(nextNumber),
      capacity: "4",
      sortOrder: String(nextNumber),
    });
    setIsCreateTableOpen(true);
  }

  async function saveHall(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const name = hallDraft.name.trim();
    const sortOrder = Number(hallDraft.sortOrder);

    if (!name) {
      showToast("Zal nomini kiriting.", "danger");
      return;
    }

    if (!Number.isInteger(sortOrder) || sortOrder < 0) {
      showToast("Tartib raqami noto'g'ri.", "danger");
      return;
    }

    setIsSaving(true);
    try {
      await apiFetch(`/halls/${hallId}`, {
        method: "PATCH",
        body: JSON.stringify({
          name,
          description: hallDraft.description,
          sortOrder,
        }),
      });
      setIsHallEditorOpen(false);
      showToast("Zal ma'lumotlari yangilandi.", "success");
      resource.reload();
    } catch (caught) {
      if (caught instanceof SessionExpiredError) {
        return;
      }

      showToast(messageOf(caught, "Zalni saqlab bo'lmadi."), "danger");
    } finally {
      setIsSaving(false);
    }
  }

  async function createTable(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const number = Number(tableDraft.number);
    const capacity = Number(tableDraft.capacity);
    const sortOrder = Number(tableDraft.sortOrder);

    if (!tableDraft.name.trim()) {
      showToast("Stol nomini kiriting.", "danger");
      return;
    }

    if (
      !Number.isInteger(number) ||
      number < 1 ||
      !Number.isInteger(capacity) ||
      capacity < 1
    ) {
      showToast(
        "Stol raqami va sig'imi 1 yoki undan katta butun son bo'lishi kerak.",
        "danger",
      );
      return;
    }

    if (!Number.isInteger(sortOrder) || sortOrder < 0) {
      showToast("Tartib raqami noto'g'ri.", "danger");
      return;
    }

    setIsSaving(true);
    try {
      await apiFetch("/tables", {
        method: "POST",
        body: JSON.stringify({
          branchId,
          hallId,
          name: tableDraft.name.trim(),
          number,
          capacity,
          sortOrder,
        }),
      });
      setIsCreateTableOpen(false);
      showToast("Stol shu zalga qo'shildi.", "success");
      resource.reload();
    } catch (caught) {
      if (caught instanceof SessionExpiredError) {
        return;
      }

      showToast(messageOf(caught, "Stolni yaratib bo'lmadi."), "danger");
    } finally {
      setIsSaving(false);
    }
  }

  async function archiveHall(): Promise<void> {
    setIsSaving(true);
    try {
      await apiFetch(`/halls/${hallId}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: false }),
      });
      setIsArchiveHallOpen(false);
      showToast("Zal arxivga olindi.", "success");
      router.replace(`/admin/branches/${branchId}`);
    } catch (caught) {
      if (caught instanceof SessionExpiredError) {
        return;
      }

      showToast(messageOf(caught, "Zalni arxivlab bo'lmadi."), "danger");
    } finally {
      setIsSaving(false);
    }
  }

  if (resource.isLoading && !hall) {
    return resourceLoading();
  }

  if (resource.error || !hall) {
    return (
      <ErrorState
        message={resource.error || "Zal topilmadi."}
        onRetry={resource.reload}
      />
    );
  }

  if (hall.branchId !== branchId) {
    return (
      <ErrorState
        message="Bu zal URLdagi filialga tegishli emas."
        onRetry={resource.reload}
      />
    );
  }

  const columns: DataTableColumn<TableSummary>[] = [
    {
      key: "table",
      header: "Stol",
      primary: true,
      render: (table) => (
        <div className="min-w-0">
          <p className="truncate font-semibold text-mz-text">{table.name}</p>
          <p className="text-[13px] text-mz-text-muted">
            Raqam: {table.number ?? "-"}
          </p>
        </div>
      ),
    },
    {
      key: "capacity",
      header: "Sig'imi",
      render: (table) => `${table.capacity ?? table.seats ?? 0} o'rin`,
    },
    {
      key: "status",
      header: "Holat",
      render: (table) => (
        <Badge tone={statusTones[table.status]} withDot>
          {statusLabels[table.status]}
        </Badge>
      ),
    },
    {
      key: "orders",
      header: "Ochiq buyurtma",
      hideOnMobile: true,
      render: (table) => (table.orders?.length ? "Bor" : "Yo'q"),
    },
  ];

  return (
    <>
      <AdminPageHeader
        actions={
          canCreateTables ? (
            <Button onClick={openTableCreator} size="lg">
              <Icon className="h-4 w-4" name="plus" />
              Yangi stol
            </Button>
          ) : null
        }
        backHref={`/admin/branches/${branchId}`}
        breadcrumbs={[
          { label: "Bosh sahifa", href: "/admin/dashboard" },
          { label: "Filiallar", href: "/admin/branches" },
          { label: hall.branch.name, href: `/admin/branches/${branchId}` },
          { label: hall.name },
        ]}
        description="Stollar faqat shu zal ichida yaratiladi va tartiblanadi"
        title={hall.name}
      />

      {resource.error ? (
        <ErrorState message={resource.error} onRetry={resource.reload} />
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <Card>
          <CardHeader
            actions={
              canEditTables ? (
                <Button
                  onClick={() => setIsHallEditorOpen(true)}
                  variant="ghost"
                >
                  <Icon className="h-4 w-4" name="pencil" />
                  Tahrirlash
                </Button>
              ) : null
            }
            description={`Kod: ${hall.code}`}
            title="Zal haqida"
          />
          <CardBody>
            <p className="text-sm text-mz-text-muted">
              {hall.description || "Tavsif kiritilmagan."}
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Zal holati" />
          <CardBody className="grid content-start gap-4">
            <Badge tone={hall.isActive ? "success" : "neutral"} withDot>
              {hall.isActive ? "Faol" : "Arxiv"}
            </Badge>
            <p className="text-sm text-mz-text-muted">
              {hall.tables.length} ta faol stol. Zal arxivga olinishidan avval
              ichidagi stollar arxivlanishi kerak.
            </p>
            {canEditTables ? (
              <Button
                disabled={hall.tables.length > 0}
                onClick={() => setIsArchiveHallOpen(true)}
                title={
                  hall.tables.length > 0
                    ? "Avval shu zaldagi stollarni arxivlang"
                    : "Zalni arxivlash"
                }
                variant="danger"
              >
                <Icon className="h-4 w-4" name="trash" />
                Zalni arxivlash
              </Button>
            ) : null}
          </CardBody>
        </Card>
      </div>

      <Card className="mt-5">
        <CardHeader
          actions={
            canCreateTables ? (
              <Button onClick={openTableCreator} variant="ghost">
                <Icon className="h-4 w-4" name="plus" />
                Stol qo'shish
              </Button>
            ) : null
          }
          description={`${hall.tables.length} ta faol stol`}
          title="Stollar"
        />
        <DataTable
          caption={`${hall.name} zali stollari`}
          columns={columns}
          emptyAction={
            canCreateTables ? (
              <Button onClick={openTableCreator}>
                <Icon className="h-4 w-4" name="plus" />
                Birinchi stolni qo'shish
              </Button>
            ) : undefined
          }
          emptyDescription="Bu zalda hali stol yo'q. Stol shu kontekstda yaratiladi, boshqa zal tanlanmaydi."
          emptyIcon="grid"
          emptyTitle="Stol yo'q"
          getRowKey={(table) => table.id}
          rowActions={(table) => (
            <RowAction
              href={`/admin/branches/${branchId}/halls/${hallId}/tables/${table.id}`}
              icon="eye"
              label={`${table.name} - ochish`}
            />
          )}
          rows={hall.tables}
        />
      </Card>

      <Modal
        dismissOnBackdrop={false}
        footer={
          <>
            <Button
              disabled={isSaving}
              onClick={() => setIsHallEditorOpen(false)}
              variant="ghost"
            >
              Bekor qilish
            </Button>
            <Button form="edit-hall-form" isLoading={isSaving} type="submit">
              Saqlash
            </Button>
          </>
        }
        isOpen={isHallEditorOpen}
        onClose={() => setIsHallEditorOpen(false)}
        title={`${hall.name} - tahrirlash`}
      >
        <form
          className="grid gap-3"
          id="edit-hall-form"
          onSubmit={(event) => void saveHall(event)}
        >
          <FormField label="Zal nomi" required>
            {(props) => (
              <TextInput
                {...props}
                maxLength={100}
                onChange={(event) =>
                  setHallDraft((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                required
                value={hallDraft.name}
              />
            )}
          </FormField>
          <FormField label="Tavsif">
            {(props) => (
              <Textarea
                {...props}
                maxLength={500}
                onChange={(event) =>
                  setHallDraft((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                value={hallDraft.description}
              />
            )}
          </FormField>
          <FormField hint="Kichik raqam avval turadi." label="Tartib raqami">
            {(props) => (
              <TextInput
                {...props}
                min="0"
                onChange={(event) =>
                  setHallDraft((current) => ({
                    ...current,
                    sortOrder: event.target.value,
                  }))
                }
                type="number"
                value={hallDraft.sortOrder}
              />
            )}
          </FormField>
        </form>
      </Modal>

      <Modal
        dismissOnBackdrop={false}
        footer={
          <>
            <Button
              disabled={isSaving}
              onClick={() => setIsCreateTableOpen(false)}
              variant="ghost"
            >
              Bekor qilish
            </Button>
            <Button form="create-table-form" isLoading={isSaving} type="submit">
              Stolni yaratish
            </Button>
          </>
        }
        isOpen={isCreateTableOpen}
        onClose={() => setIsCreateTableOpen(false)}
        title={`Yangi stol - ${hall.name}`}
      >
        <form
          className="grid gap-3"
          id="create-table-form"
          onSubmit={(event) => void createTable(event)}
        >
          <FormField label="Stol nomi" required>
            {(props) => (
              <TextInput
                {...props}
                maxLength={100}
                onChange={(event) =>
                  setTableDraft((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                required
                value={tableDraft.name}
              />
            )}
          </FormField>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Stol raqami" required>
              {(props) => (
                <TextInput
                  {...props}
                  min="1"
                  onChange={(event) =>
                    setTableDraft((current) => ({
                      ...current,
                      number: event.target.value,
                    }))
                  }
                  required
                  type="number"
                  value={tableDraft.number}
                />
              )}
            </FormField>
            <FormField label="Sig'imi" required>
              {(props) => (
                <TextInput
                  {...props}
                  min="1"
                  onChange={(event) =>
                    setTableDraft((current) => ({
                      ...current,
                      capacity: event.target.value,
                    }))
                  }
                  required
                  type="number"
                  value={tableDraft.capacity}
                />
              )}
            </FormField>
          </div>
          <FormField hint="Kichik raqam avval turadi." label="Tartib raqami">
            {(props) => (
              <TextInput
                {...props}
                min="0"
                onChange={(event) =>
                  setTableDraft((current) => ({
                    ...current,
                    sortOrder: event.target.value,
                  }))
                }
                type="number"
                value={tableDraft.sortOrder}
              />
            )}
          </FormField>
        </form>
      </Modal>

      <Modal
        footer={
          <>
            <Button
              disabled={isSaving}
              onClick={() => setIsArchiveHallOpen(false)}
              variant="ghost"
            >
              Bekor qilish
            </Button>
            <Button
              isLoading={isSaving}
              onClick={() => void archiveHall()}
              variant="danger"
            >
              Arxivlash
            </Button>
          </>
        }
        isOpen={isArchiveHallOpen}
        onClose={() => setIsArchiveHallOpen(false)}
        title="Zalni arxivlash"
      >
        <p className="text-sm text-mz-text">
          {hall.name} mijoz va ofitsiant ekranlarida ko'rinmaydi. Ma'lumotlar
          o'chirilmaydi, lekin qayta faollashtirish uchun tizim administratori
          kerak bo'ladi.
        </p>
      </Modal>
    </>
  );
}

export function AdminTableWorkspace({
  branchId,
  hallId,
  tableId,
}: {
  branchId: string;
  hallId: string;
  tableId: string;
}) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const canEditTables = hasPermission(user, "TABLE_EDIT");
  const [draft, setDraft] = useState<TableDraft>({
    name: "",
    number: "",
    capacity: "",
    sortOrder: "0",
  });
  const [status, setStatus] = useState<TableStatus>("AVAILABLE");
  const [isSaving, setIsSaving] = useState(false);
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);

  const resource = useApiResource<TableDetail>(
    () => apiFetch<TableDetail>(`/tables/${tableId}`),
    [tableId],
    "Stol ma'lumotlarini yuklab bo'lmadi.",
  );
  const table = resource.data;

  useEffect(() => {
    if (table) {
      setDraft(toTableDraft(table));
      setStatus(table.status);
    }
  }, [table]);

  async function saveTable(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const number = Number(draft.number);
    const capacity = Number(draft.capacity);
    const sortOrder = Number(draft.sortOrder);

    if (!draft.name.trim()) {
      showToast("Stol nomini kiriting.", "danger");
      return;
    }

    if (
      !Number.isInteger(number) ||
      number < 1 ||
      !Number.isInteger(capacity) ||
      capacity < 1
    ) {
      showToast(
        "Stol raqami va sig'imi 1 yoki undan katta butun son bo'lishi kerak.",
        "danger",
      );
      return;
    }

    if (!Number.isInteger(sortOrder) || sortOrder < 0) {
      showToast("Tartib raqami noto'g'ri.", "danger");
      return;
    }

    setIsSaving(true);
    try {
      await apiFetch(`/tables/${tableId}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: draft.name.trim(),
          number,
          capacity,
          sortOrder,
        }),
      });
      showToast("Stol ma'lumotlari yangilandi.", "success");
      resource.reload();
    } catch (caught) {
      if (caught instanceof SessionExpiredError) {
        return;
      }

      showToast(messageOf(caught, "Stolni saqlab bo'lmadi."), "danger");
    } finally {
      setIsSaving(false);
    }
  }

  async function saveStatus(): Promise<void> {
    if (!table || status === table.status) {
      return;
    }

    setIsSaving(true);
    try {
      await apiFetch(`/tables/${tableId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      showToast("Stol holati yangilandi.", "success");
      resource.reload();
    } catch (caught) {
      if (caught instanceof SessionExpiredError) {
        return;
      }

      showToast(messageOf(caught, "Stol holatini saqlab bo'lmadi."), "danger");
    } finally {
      setIsSaving(false);
    }
  }

  async function setArchiveState(isActive: boolean): Promise<void> {
    setIsSaving(true);
    try {
      await apiFetch(`/tables/${tableId}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive }),
      });
      setIsArchiveOpen(false);
      showToast(
        isActive ? "Stol qayta faollashtirildi." : "Stol arxivga olindi.",
        "success",
      );
      resource.reload();
    } catch (caught) {
      if (caught instanceof SessionExpiredError) {
        return;
      }

      showToast(
        messageOf(caught, "Stol holatini o'zgartirib bo'lmadi."),
        "danger",
      );
    } finally {
      setIsSaving(false);
    }
  }

  if (resource.isLoading && !table) {
    return resourceLoading();
  }

  if (resource.error || !table) {
    return (
      <ErrorState
        message={resource.error || "Stol topilmadi."}
        onRetry={resource.reload}
      />
    );
  }

  if (table.branchId !== branchId || table.hallId !== hallId) {
    return (
      <ErrorState
        message="Bu stol URLdagi filial yoki zalga tegishli emas."
        onRetry={resource.reload}
      />
    );
  }

  const hallHref = `/admin/branches/${branchId}/halls/${hallId}`;
  const activeOrderCount = table.orders.length;

  return (
    <>
      <AdminPageHeader
        backHref={hallHref}
        breadcrumbs={[
          { label: "Bosh sahifa", href: "/admin/dashboard" },
          { label: "Filiallar", href: "/admin/branches" },
          {
            label: table.branch?.name ?? "Filial",
            href: `/admin/branches/${branchId}`,
          },
          { label: table.hall?.name ?? "Zal", href: hallHref },
          { label: table.name },
        ]}
        description="Stolning nomi, sig'imi, tartibi va operatsion holati"
        title={table.name}
      />

      {resource.error ? (
        <ErrorState message={resource.error} onRetry={resource.reload} />
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <Card className="self-start">
          <CardHeader
            description="Bu o'zgarishlar ofitsiant va kassa ekranlariga aks etadi."
            title="Stol sozlamalari"
          />
          <form onSubmit={(event) => void saveTable(event)}>
            <CardBody className="grid gap-4">
              <FormField label="Stol nomi" required>
                {(props) => (
                  <TextInput
                    {...props}
                    disabled={!canEditTables}
                    maxLength={100}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                    required
                    value={draft.name}
                  />
                )}
              </FormField>
              <div className="grid gap-3 sm:grid-cols-3">
                <FormField label="Raqam" required>
                  {(props) => (
                    <TextInput
                      {...props}
                      disabled={!canEditTables}
                      min="1"
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          number: event.target.value,
                        }))
                      }
                      required
                      type="number"
                      value={draft.number}
                    />
                  )}
                </FormField>
                <FormField label="Sig'imi" required>
                  {(props) => (
                    <TextInput
                      {...props}
                      disabled={!canEditTables}
                      min="1"
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          capacity: event.target.value,
                        }))
                      }
                      required
                      type="number"
                      value={draft.capacity}
                    />
                  )}
                </FormField>
                <FormField label="Tartib">
                  {(props) => (
                    <TextInput
                      {...props}
                      disabled={!canEditTables}
                      min="0"
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
            </CardBody>
            {canEditTables ? (
              <CardFooter>
                <Button isLoading={isSaving} type="submit">
                  Saqlash
                </Button>
              </CardFooter>
            ) : null}
          </form>
        </Card>

        <div className="grid content-start gap-5">
          <Card>
            <CardHeader title="Operatsion holat" />
            <CardBody className="grid gap-4">
              <Badge
                tone={table.isActive ? statusTones[table.status] : "neutral"}
                withDot
              >
                {table.isActive ? statusLabels[table.status] : "Arxivda"}
              </Badge>
              {canEditTables && table.isActive ? (
                <>
                  <FormField label="Holat">
                    {(props) => (
                      <select
                        {...props}
                        className="min-h-10 w-full rounded-mz-control border border-mz-border-strong bg-mz-surface px-3 text-sm text-mz-text outline-none focus:border-mz-focus"
                        onChange={(event) =>
                          setStatus(event.target.value as TableStatus)
                        }
                        value={status}
                      >
                        {Object.entries(statusLabels).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    )}
                  </FormField>
                  <Button
                    disabled={isSaving || status === table.status}
                    onClick={() => void saveStatus()}
                    variant="ghost"
                  >
                    Holatni saqlash
                  </Button>
                </>
              ) : null}
              {canEditTables ? (
                table.isActive ? (
                  <Button
                    disabled={activeOrderCount > 0}
                    onClick={() => setIsArchiveOpen(true)}
                    title={
                      activeOrderCount > 0
                        ? "Ochiq buyurtmali stolni arxivlab bo'lmaydi"
                        : "Stolni arxivlash"
                    }
                    variant="danger"
                  >
                    <Icon className="h-4 w-4" name="trash" />
                    Stolni arxivlash
                  </Button>
                ) : (
                  <Button
                    isLoading={isSaving}
                    onClick={() => void setArchiveState(true)}
                    variant="secondary"
                  >
                    <Icon className="h-4 w-4" name="check" />
                    Qayta faollashtirish
                  </Button>
                )
              ) : null}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Ochiq buyurtmalar" />
            <CardBody>
              {activeOrderCount ? (
                <ul className="space-y-2">
                  {table.orders.map((order) => (
                    <li
                      className="flex items-center justify-between gap-3 border-b border-mz-border pb-2 last:border-b-0 last:pb-0"
                      key={order.id}
                    >
                      <span className="min-w-0 truncate text-sm font-semibold text-mz-text">
                        #{order.displayOrderNumber ?? order.orderNumber}
                      </span>
                      <Badge tone="info">{order.status}</Badge>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-mz-text-muted">
                  Ochiq buyurtma yo'q.
                </p>
              )}
            </CardBody>
          </Card>
        </div>
      </div>

      <Modal
        footer={
          <>
            <Button
              disabled={isSaving}
              onClick={() => setIsArchiveOpen(false)}
              variant="ghost"
            >
              Bekor qilish
            </Button>
            <Button
              isLoading={isSaving}
              onClick={() => void setArchiveState(false)}
              variant="danger"
            >
              Arxivlash
            </Button>
          </>
        }
        isOpen={isArchiveOpen}
        onClose={() => setIsArchiveOpen(false)}
        title="Stolni arxivlash"
      >
        <p className="text-sm text-mz-text">
          {table.name} yangi buyurtma uchun tanlanmaydi. Oldingi buyurtmalar va
          moliyaviy tarix saqlanadi.
        </p>
      </Modal>
    </>
  );
}
