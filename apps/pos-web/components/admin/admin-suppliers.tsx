"use client";

import { FormEvent, useMemo, useRef, useState } from "react";
import { apiFetch, SessionExpiredError } from "../../lib/api";
import { useApiResource } from "../../lib/use-api-resource";
import { canSwitchBranch } from "../../lib/admin-nav";
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
import { ErrorState } from "../admin-ui/feedback";
import {
  FilterBar,
  focusFirstInvalidField,
  FormField,
  Select,
  TextInput,
} from "../admin-ui/form";
import { Modal } from "../admin-ui/modal";
import { InfoBox, StatGrid } from "../admin-ui/stat-box";
import { useToast } from "../admin-ui/toast";

/*
 * Yetkazib beruvchilar.
 *
 * Backend `/suppliers` list / create / update / soft-delete beradi.
 * `GET /suppliers/:id` YO'Q, xarid buyurtmasi, yetkazish hujjati va
 * yetkazib beruvchi qarzi ham YO'Q — `Supplier` modelida faqat aloqa
 * ma'lumoti bor va `StockMovement` da `supplierId` mavjud emas, ya'ni
 * kelgan zaxirani yetkazib beruvchiga bog'lash imkoni yo'q. Shuning uchun
 * bu ekran ATAYLAB aloqa kartotekasi: "Xarid buyurtmasi" yoki "Qarz"
 * bo'limi bo'lsa, u bo'sh tugmalardan iborat bo'lardi.
 *
 * `DELETE /suppliers/:id` — `isActive: false`, ya'ni ARXIVLASH. Ro'yxat
 * esa faqat faol yozuvlarni qaytaradi, ya'ni arxivlangandan keyin uni
 * qaytarishning yo'li yo'q: `PATCH { isActive: true }` mavjud, lekin
 * arxivlangan yozuvni KO'RSATADIGAN endpoint yo'q. Tasdiqlash oynasi
 * shuni ochiq aytadi.
 *
 * Sahifalash yo'q: backend `take: 200` ni qotirib qo'ygan va `offset`
 * qabul qilmaydi. 200 qator kelganda ekran ogohlantiradi — jimgina
 * kesib tashlash noto'g'ri son ko'rsatardi.
 */

const HARD_LIMIT = 200;

type Supplier = {
  id: string;
  branchId?: string | null;
  name: string;
  phone?: string | null;
  address?: string | null;
  isActive: boolean;
};

type SupplierForm = {
  name: string;
  phone: string;
  address: string;
  branchId: string;
};

type SupplierErrors = Partial<Record<keyof SupplierForm, string>>;

type Branch = { id: string; code: string; name: string };

const emptyForm: SupplierForm = {
  name: "",
  phone: "",
  address: "",
  branchId: "",
};

export function AdminSuppliersPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const isGlobalScope = canSwitchBranch(user);
  const canCreate = hasPermission(user, "INVENTORY_CREATE");
  const canEdit = hasPermission(user, "INVENTORY_EDIT");

  const [query, setQuery] = useState("");
  const [branchId, setBranchId] = useState("");

  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<SupplierForm>(emptyForm);
  const [errors, setErrors] = useState<SupplierErrors>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Supplier | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const {
    data,
    isLoading,
    error,
    reload: load,
  } = useApiResource<Supplier[]>(
    () =>
      apiFetch<Supplier[]>(
        `/suppliers${branchId ? `?branchId=${encodeURIComponent(branchId)}` : ""}`,
      ),
    [branchId],
    "Yetkazib beruvchilarni yuklab bo'lmadi.",
  );
  const suppliers = data ?? [];

  const { data: branchData } = useApiResource<Branch[]>(
    () => (isGlobalScope ? apiFetch<Branch[]>("/branches") : Promise.resolve([])),
    [isGlobalScope],
    "Filiallarni yuklab bo'lmadi.",
  );
  const branches = branchData ?? [];

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();

    if (!needle) {
      return suppliers;
    }

    return suppliers.filter((supplier) =>
      [supplier.name, supplier.phone, supplier.address]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [query, suppliers]);

  const stats = useMemo(
    () => ({
      total: suppliers.length,
      withPhone: suppliers.filter((supplier) => supplier.phone).length,
      global: suppliers.filter((supplier) => !supplier.branchId).length,
    }),
    [suppliers],
  );

  function openCreate(): void {
    setEditingId(null);
    setForm({ ...emptyForm, branchId: branchId || "" });
    setErrors({});
    setIsEditorOpen(true);
  }

  function openEdit(supplier: Supplier): void {
    setEditingId(supplier.id);
    setForm({
      name: supplier.name,
      phone: supplier.phone ?? "",
      address: supplier.address ?? "",
      /* Backend `branchId` ni O'ZGARTIRMAYDI — shu sababdan faqat ko'rsatiladi. */
      branchId: supplier.branchId ?? "",
    });
    setErrors({});
    setIsEditorOpen(true);
  }

  function validate(draft: SupplierForm): SupplierErrors {
    const next: SupplierErrors = {};

    if (!draft.name.trim()) {
      next.name = "Nomi kerak.";
    } else if (draft.name.trim().length > 120) {
      next.name = "Nomi 120 belgidan oshmasligi kerak.";
    }

    if (draft.phone.trim().length > 40) {
      next.phone = "Telefon 40 belgidan oshmasligi kerak.";
    }

    if (draft.address.trim().length > 300) {
      next.address = "Manzil 300 belgidan oshmasligi kerak.";
    }

    return next;
  }

  async function save(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    const nextErrors = validate(form);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      requestAnimationFrame(() => focusFirstInvalidField(formRef.current));
      return;
    }

    setIsSaving(true);

    const payload = {
      name: form.name.trim(),
      ...(form.phone.trim() ? { phone: form.phone.trim() } : {}),
      ...(form.address.trim() ? { address: form.address.trim() } : {}),
    };

    try {
      if (editingId) {
        await apiFetch(`/suppliers/${editingId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        showToast("Yetkazib beruvchi yangilandi.", "success");
      } else {
        await apiFetch("/suppliers", {
          method: "POST",
          body: JSON.stringify({
            ...payload,
            /* Filial berilmasa yozuv UMUMIY bo'ladi (`branchId: null`). */
            ...(form.branchId ? { branchId: form.branchId } : {}),
          }),
        });
        showToast("Yetkazib beruvchi qo'shildi.", "success");
      }

      setIsEditorOpen(false);
      load();
    } catch (caught) {
      if (caught instanceof SessionExpiredError) {
        return;
      }

      setErrors({
        name: caught instanceof Error ? caught.message : "Saqlab bo'lmadi.",
      });
      requestAnimationFrame(() => focusFirstInvalidField(formRef.current));
    } finally {
      setIsSaving(false);
    }
  }

  async function confirmArchive(): Promise<void> {
    if (!pendingDelete) {
      return;
    }

    setIsArchiving(true);

    try {
      await apiFetch(`/suppliers/${pendingDelete.id}`, { method: "DELETE" });
      showToast(
        `${pendingDelete.name} arxivlandi va ro'yxatdan chiqdi.`,
        "success",
      );
      setPendingDelete(null);
      load();
    } catch (caught) {
      if (caught instanceof SessionExpiredError) {
        return;
      }

      showToast(
        caught instanceof Error ? caught.message : "Arxivlab bo'lmadi.",
        "danger",
      );
    } finally {
      setIsArchiving(false);
    }
  }

  const columns: DataTableColumn<Supplier>[] = [
    {
      key: "name",
      header: "Nomi",
      primary: true,
      render: (supplier) => (
        <span className="font-semibold text-mz-text">{supplier.name}</span>
      ),
    },
    {
      key: "phone",
      header: "Telefon",
      render: (supplier) =>
        supplier.phone ? (
          <a
            className="tabular-nums text-mz-info underline decoration-dotted"
            href={`tel:${supplier.phone}`}
          >
            {supplier.phone}
          </a>
        ) : (
          <span className="text-mz-text-faint">—</span>
        ),
    },
    {
      key: "address",
      header: "Manzil",
      hideOnMobile: true,
      render: (supplier) => supplier.address ?? "—",
    },
    {
      key: "scope",
      header: "Qamrov",
      hideOnMobile: true,
      render: (supplier) => (
        <Badge tone={supplier.branchId ? "info" : "neutral"}>
          {supplier.branchId ? "Filial" : "Umumiy"}
        </Badge>
      ),
    },
  ];

  return (
    <div className="grid gap-5">
      {error ? <ErrorState message={error} onRetry={() => load()} /> : null}

      <StatGrid>
        <InfoBox
          icon="truck"
          label="Faol yetkazib beruvchi"
          value={`${stats.total} ta`}
        />
        <InfoBox
          icon="bell"
          label="Telefoni bor"
          tone={stats.withPhone < stats.total ? "warning" : "success"}
          value={`${stats.withPhone} ta`}
        />
        <InfoBox
          description="Barcha filiallar uchun"
          icon="building"
          label="Umumiy yozuv"
          value={`${stats.global} ta`}
        />
        <InfoBox
          description="Qidiruvdan keyin"
          icon="filter"
          label="Ko'rsatilgan"
          value={`${filtered.length} ta`}
        />
      </StatGrid>

      <Card>
        <CardHeader
          actions={
            canCreate ? (
              <Button onClick={openCreate} size="lg">
                Yangi yetkazib beruvchi
              </Button>
            ) : undefined
          }
          description="Aloqa kartotekasi — xarid buyurtmasi va qarz hisobi hali yo'q"
          title="Yetkazib beruvchilar"
        />

        <FilterBar>
          <div className="min-w-52 flex-1">
            <FormField label="Qidirish">
              {(props) => (
                <TextInput
                  {...props}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Nomi, telefoni yoki manzili"
                  type="search"
                  value={query}
                />
              )}
            </FormField>
          </div>

          {isGlobalScope ? (
            <div className="w-56">
              <FormField label="Filial">
                {(props) => (
                  <Select
                    {...props}
                    onChange={(event) => setBranchId(event.target.value)}
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
        </FilterBar>

        <DataTable
          caption="Yetkazib beruvchilar"
          columns={columns}
          emptyDescription={
            suppliers.length > 0
              ? "Qidiruvga mos yozuv yo'q."
              : "Yangi yetkazib beruvchi qo'shing."
          }
          emptyIcon="truck"
          emptyTitle="Yetkazib beruvchi topilmadi"
          getRowKey={(supplier) => supplier.id}
          isLoading={isLoading}
          rows={filtered}
          {...(canEdit
            ? {
                rowActions: (supplier: Supplier) => (
                  <>
                    <RowAction
                      icon="pencil"
                      label={`${supplier.name} — tahrirlash`}
                      onClick={() => openEdit(supplier)}
                    />
                    <RowAction
                      icon="trash"
                      label={`${supplier.name} — arxivlash`}
                      onClick={() => setPendingDelete(supplier)}
                      tone="danger"
                    />
                  </>
                ),
              }
            : {})}
        />

        {suppliers.length >= HARD_LIMIT ? (
          <CardBody className="border-t border-mz-border">
            <p className="rounded-mz-control border border-mz-border border-l-4 border-l-mz-warning bg-mz-surface px-3 py-2 text-[13px] text-mz-text-muted">
              Server bir so&apos;rovda ko&apos;pi bilan {HARD_LIMIT} yozuv
              qaytaradi va sahifalashni qo&apos;llab-quvvatlamaydi — ro&apos;yxat
              to&apos;liq bo&apos;lmasligi mumkin. Filial filtri bilan
              toraytirib ko&apos;ring.
            </p>
          </CardBody>
        ) : null}
      </Card>

      <Modal
        dismissOnBackdrop={false}
        footer={
          <>
            <Button onClick={() => setIsEditorOpen(false)} variant="ghost">
              Bekor qilish
            </Button>
            <Button
              form="supplier-form"
              isLoading={isSaving}
              size="lg"
              type="submit"
            >
              Saqlash
            </Button>
          </>
        }
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        title={
          editingId
            ? "Yetkazib beruvchini tahrirlash"
            : "Yangi yetkazib beruvchi"
        }
      >
        <form
          className="grid gap-3"
          id="supplier-form"
          onSubmit={save}
          ref={formRef}
        >
          <FormField
            {...(errors.name ? { error: errors.name } : {})}
            label="Nomi"
            required
          >
            {(props) => (
              <TextInput
                {...props}
                maxLength={120}
                onChange={(event) =>
                  setForm({ ...form, name: event.target.value })
                }
                value={form.name}
              />
            )}
          </FormField>

          <FormField
            {...(errors.phone ? { error: errors.phone } : {})}
            hint="Masalan: +998901234567"
            label="Telefon"
          >
            {(props) => (
              <TextInput
                {...props}
                inputMode="tel"
                maxLength={40}
                onChange={(event) =>
                  setForm({ ...form, phone: event.target.value })
                }
                type="tel"
                value={form.phone}
              />
            )}
          </FormField>

          <FormField
            {...(errors.address ? { error: errors.address } : {})}
            label="Manzil"
          >
            {(props) => (
              <TextInput
                {...props}
                maxLength={300}
                onChange={(event) =>
                  setForm({ ...form, address: event.target.value })
                }
                value={form.address}
              />
            )}
          </FormField>

          {isGlobalScope && !editingId ? (
            <FormField
              hint="Bo'sh qoldirilsa yozuv barcha filiallar uchun umumiy bo'ladi. Keyinchalik o'zgartirilmaydi."
              label="Filial"
            >
              {(props) => (
                <Select
                  {...props}
                  onChange={(event) =>
                    setForm({ ...form, branchId: event.target.value })
                  }
                  value={form.branchId}
                >
                  <option value="">Umumiy (barcha filiallar)</option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </Select>
              )}
            </FormField>
          ) : null}

          {editingId ? (
            <p className="text-[13px] text-mz-text-muted">
              Qamrov (filial yoki umumiy) yaratilgandan keyin
              o&apos;zgartirilmaydi — backend `branchId` ni qabul qilmaydi.
            </p>
          ) : null}
        </form>
      </Modal>

      <Modal
        description="Bu HARD DELETE emas: yozuv arxivlanadi va mavjud zaxira harakatlari saqlanib qoladi."
        footer={
          <>
            <Button onClick={() => setPendingDelete(null)} variant="ghost">
              Bekor qilish
            </Button>
            <Button
              isLoading={isArchiving}
              onClick={() => void confirmArchive()}
              size="lg"
              variant="danger"
            >
              Arxivlash
            </Button>
          </>
        }
        isOpen={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        title="Arxivlashni tasdiqlang"
      >
        <div className="grid gap-3">
          <p className="text-sm text-mz-text">
            <span className="font-semibold">{pendingDelete?.name}</span>{" "}
            arxivlanadi va ro&apos;yxatda ko&apos;rinmaydi.
          </p>
          <p className="rounded-mz-control border border-mz-border border-l-4 border-l-mz-warning bg-mz-surface px-3 py-2 text-[13px] text-mz-text-muted">
            Bu amalni panel orqali QAYTARIB BO&apos;LMAYDI: ro&apos;yxat faqat
            faol yozuvlarni qaytaradi, arxivlanganlarni ko&apos;rsatadigan
            endpoint hali yo&apos;q. Kerak bo&apos;lsa yozuvni qaytadan
            qo&apos;shing.
          </p>
        </div>
      </Modal>
    </div>
  );
}
