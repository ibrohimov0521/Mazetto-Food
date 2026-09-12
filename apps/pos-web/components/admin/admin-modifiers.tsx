"use client";

import { useMemo, useState } from "react";
import { apiFetch, SessionExpiredError } from "../../lib/api";
import { hasPermission } from "../../lib/auth";
import { formatMoney } from "../../lib/order-display";
import { useApiResource } from "../../lib/use-api-resource";
import { useAuth } from "../auth/auth-provider";
import { Badge } from "../admin-ui/badge";
import { Button } from "../admin-ui/button";
import { Card, CardHeader } from "../admin-ui/card";
import {
  DataTable,
  RowAction,
  type DataTableColumn,
} from "../admin-ui/data-table";
import { ErrorState } from "../admin-ui/feedback";
import {
  Checkbox,
  FilterBar,
  focusFirstInvalidField,
  FormField,
  Select,
  TextInput,
} from "../admin-ui/form";
import { Modal } from "../admin-ui/modal";
import { useToast } from "../admin-ui/toast";

/*
 * Qo'shimchalar (modifier) katalogi.
 *
 * O'chirish endpoint'i yo'q va ataylab qo'shilmadi: modifier buyurtma
 * tarixidagi `modifierSnapshot` bilan bog'liq. Uni nofaol qilish
 * (`isActive: false`) tarixiy yaxlitlikni saqlaydi.
 *
 * Bu qayta ishlashda tuzatilganlar:
 *   - "Nofaol qilish" QIZIL `danger` tugma edi. U qaytariladigan amal —
 *     qizil faqat buzuvchi harakatlar uchun. Endi u qator amali
 *     (ikonka + `aria-label`), neytral ohangda.
 *   - Amallar oddiy ustunda edi, ya'ni mobil kartochkada "Holat: [tugma]"
 *     ko'rinishida chiqardi. Endi `DataTable` ning `rowActions` i.
 *   - Har o'zgarishdan keyin jadval to'liq skeletonga aylanardi; endi
 *     oldingi ma'lumot ko'rinib turadi.
 *   - Katalog o'sib borishi uchun qidiruv va holat filtri qo'shildi.
 *   - Forma tugmalari `<form>` dan tashqarida, oynaning tanasida edi; endi
 *     `Modal` ning `footer` slotida.
 */

type Modifier = {
  id: string;
  code: string;
  name: string;
  price: string;
  isActive: boolean;
  sortOrder: number;
  _count?: { products: number };
};

type ModifierForm = {
  name: string;
  price: string;
  sortOrder: string;
  isActive: boolean;
};

const emptyForm: ModifierForm = {
  name: "",
  price: "0",
  sortOrder: "0",
  isActive: true,
};

export function AdminModifiersPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const canCreate = hasPermission(user, "MENU_CREATE");
  const canEdit = hasPermission(user, "MENU_EDIT");

  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("ALL");

  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ModifierForm>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  /** Qaysi qator hozir serverga yozilmoqda — takroriy bosishni to'sadi. */
  const [busyId, setBusyId] = useState<string | null>(null);

  const {
    data,
    isLoading,
    error,
    reload: load,
  } = useApiResource(
    () => apiFetch<Modifier[]>("/menu/modifiers?includeInactive=true"),
    [],
    "Qo'shimchalarni yuklab bo'lmadi.",
  );
  const modifiers = data ?? [];

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return modifiers.filter((modifier) => {
      const matchesSearch =
        !needle ||
        modifier.name.toLowerCase().includes(needle) ||
        modifier.code.toLowerCase().includes(needle);
      const matchesStatus =
        status === "ALL" ||
        (status === "ACTIVE" ? modifier.isActive : !modifier.isActive);

      return matchesSearch && matchesStatus;
    });
  }, [modifiers, query, status]);

  const isFiltered = query.trim() !== "" || status !== "ALL";

  function openCreate(): void {
    setEditingId(null);
    setForm(emptyForm);
    setErrors({});
    setIsEditorOpen(true);
  }

  function openEdit(modifier: Modifier): void {
    setEditingId(modifier.id);
    setForm({
      name: modifier.name,
      price: String(modifier.price),
      sortOrder: String(modifier.sortOrder),
      isActive: modifier.isActive,
    });
    setErrors({});
    setIsEditorOpen(true);
  }

  async function save(): Promise<void> {
    const nextErrors: Record<string, string> = {};
    const price = Number(form.price);
    const sortOrder = Number(form.sortOrder);

    if (!form.name.trim()) {
      nextErrors.name = "Qo'shimcha nomi kiritilishi shart.";
    }

    if (form.price === "" || !Number.isFinite(price) || price < 0) {
      nextErrors.price = "Narx 0 yoki undan katta son bo'lishi kerak.";
    }

    if (editingId && (!Number.isFinite(sortOrder) || sortOrder < 0)) {
      nextErrors.sortOrder = "Tartib 0 yoki undan katta son bo'lishi kerak.";
    }

    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      window.requestAnimationFrame(() =>
        focusFirstInvalidField(document.getElementById("modifier-form")),
      );
      return;
    }

    setIsSaving(true);

    try {
      if (editingId) {
        await apiFetch(`/menu/modifiers/${editingId}`, {
          method: "PATCH",
          body: JSON.stringify({
            name: form.name.trim(),
            price,
            sortOrder,
            isActive: form.isActive,
          }),
        });
        showToast("Qo'shimcha yangilandi.", "success");
      } else {
        /*
         * `CreateModifierDto` FAQAT `name` va `price` ni qabul qiladi
         * (`main.ts` da `forbidNonWhitelisted: true`, ya'ni ortiqcha maydon
         * 400 beradi). Shuning uchun tartib va faollik yaratilgandan keyin
         * tahrirlanadi — forma ham shuni aytadi.
         */
        await apiFetch("/menu/modifiers", {
          method: "POST",
          body: JSON.stringify({ name: form.name.trim(), price }),
        });
        showToast("Qo'shimcha yaratildi.", "success");
      }

      setIsEditorOpen(false);
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

  /*
   * Faollikni almashtirish QAYTARILADIGAN amal — tasdiqlash oynasi kerak
   * emas, lekin natija ko'rinishi shart: qator band bo'lganda ikkinchi
   * bosish o'tmaydi va javob toast bilan aytiladi.
   */
  async function toggleActive(modifier: Modifier): Promise<void> {
    if (busyId) {
      return;
    }

    setBusyId(modifier.id);

    try {
      await apiFetch(`/menu/modifiers/${modifier.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !modifier.isActive }),
      });
      showToast(
        modifier.isActive
          ? `${modifier.name} nofaol qilindi.`
          : `${modifier.name} faollashtirildi.`,
        "success",
      );
      load();
    } catch (caught) {
      if (caught instanceof SessionExpiredError) {
        return;
      }

      showToast(
        caught instanceof Error ? caught.message : "O'zgartirib bo'lmadi.",
        "danger",
      );
    } finally {
      setBusyId(null);
    }
  }

  const columns: DataTableColumn<Modifier>[] = [
    {
      key: "name",
      header: "Nomi",
      primary: true,
      render: (modifier) => (
        <div className="min-w-0">
          <p className="truncate font-semibold text-mz-text">{modifier.name}</p>
          <p className="truncate text-[13px] text-mz-text-muted">
            {modifier.code}
          </p>
        </div>
      ),
    },
    {
      key: "price",
      header: "Narx",
      align: "right",
      render: (modifier) =>
        Number(modifier.price) > 0 ? (
          <span className="font-semibold text-mz-text">
            {formatMoney(modifier.price)}
          </span>
        ) : (
          <span className="text-mz-text-muted">Bepul</span>
        ),
    },
    {
      key: "products",
      header: "Mahsulotlarda",
      align: "right",
      render: (modifier) => `${modifier._count?.products ?? 0} ta`,
    },
    {
      key: "sortOrder",
      header: "Tartib",
      align: "right",
      hideOnMobile: true,
      render: (modifier) => modifier.sortOrder,
    },
    {
      key: "status",
      header: "Holat",
      render: (modifier) => (
        <Badge tone={modifier.isActive ? "success" : "neutral"} withDot>
          {modifier.isActive ? "Faol" : "Nofaol"}
        </Badge>
      ),
    },
  ];

  return (
    <div className="grid gap-4">
      {error ? <ErrorState message={error} onRetry={() => load()} /> : null}

      <Card>
        <CardHeader
          description={
            isLoading || busyId
              ? "Yangilanmoqda…"
              : `${filtered.length} / ${modifiers.length} ta qo'shimcha`
          }
          title="Qo'shimchalar katalogi"
          {...(canCreate
            ? {
                actions: (
                  <Button onClick={openCreate} size="lg">
                    Yangi qo&apos;shimcha
                  </Button>
                ),
              }
            : {})}
        />

        <FilterBar>
          <div className="min-w-52 flex-1">
            <FormField label="Qidiruv">
              {(props) => (
                <TextInput
                  {...props}
                  placeholder="Nomi yoki kodi"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              )}
            </FormField>
          </div>
          <div className="w-full sm:w-44">
            <FormField label="Holat">
              {(props) => (
                <Select
                  {...props}
                  value={status}
                  onChange={(event) => setStatus(event.target.value)}
                >
                  <option value="ALL">Barchasi</option>
                  <option value="ACTIVE">Faol</option>
                  <option value="INACTIVE">Nofaol</option>
                </Select>
              )}
            </FormField>
          </div>
          {isFiltered ? (
            <Button
              onClick={() => {
                setQuery("");
                setStatus("ALL");
              }}
              variant="ghost"
            >
              Tozalash
            </Button>
          ) : null}
        </FilterBar>

        <DataTable
          caption="Modifier katalogi"
          columns={columns}
          emptyDescription={
            isFiltered
              ? "Qidiruv yoki holat filtrini o'zgartirib ko'ring."
              : "Qo'shimcha yarating, so'ng uni mahsulot tahrirlash sahifasida biriktiring."
          }
          emptyIcon={isFiltered ? "search" : "inbox"}
          emptyTitle={
            isFiltered ? "Mos qo'shimcha topilmadi" : "Qo'shimcha yo'q"
          }
          getRowKey={(modifier) => modifier.id}
          isLoading={isLoading && !data}
          rows={filtered}
          {...(canEdit
            ? {
                rowActions: (modifier: Modifier) => (
                  <>
                    <RowAction
                      icon="pencil"
                      label={`${modifier.name} — tahrirlash`}
                      onClick={() => openEdit(modifier)}
                    />
                    <RowAction
                      icon={modifier.isActive ? "close" : "check"}
                      label={
                        modifier.isActive
                          ? `${modifier.name} — nofaol qilish`
                          : `${modifier.name} — faollashtirish`
                      }
                      onClick={() => void toggleActive(modifier)}
                    />
                  </>
                ),
              }
            : {})}
        />
        <p className="border-t border-mz-border px-4 py-2.5 text-[13px] text-mz-text-muted">
          Qo&apos;shimchalar o&apos;chirilmaydi — ular buyurtma tarixidagi
          qo&apos;shimcha nusxalari bilan bog&apos;liq. Ishlatilmaydigan
          qo&apos;shimchani nofaol qiling: u yangi buyurtmalarda
          ko&apos;rinmaydi, tarix esa buzilmaydi.
        </p>
      </Card>

      <Modal
        dismissOnBackdrop={false}
        footer={
          <>
            <Button onClick={() => setIsEditorOpen(false)} variant="ghost">
              Bekor qilish
            </Button>
            <Button isLoading={isSaving} onClick={() => void save()} size="lg">
              Saqlash
            </Button>
          </>
        }
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        title={editingId ? "Qo'shimchani tahrirlash" : "Yangi qo'shimcha"}
      >
        <div className="grid gap-3" id="modifier-form">
          <FormField
            label="Nomi"
            required
            {...(errors.name ? { error: errors.name } : {})}
          >
            {(props) => (
              <TextInput
                {...props}
                maxLength={80}
                value={form.name}
                onChange={(event) =>
                  setForm({ ...form, name: event.target.value })
                }
              />
            )}
          </FormField>

          <FormField
            hint="0 bo'lsa qo'shimcha bepul"
            label="Narx (so'm)"
            {...(errors.price ? { error: errors.price } : {})}
          >
            {(props) => (
              <TextInput
                {...props}
                min={0}
                type="number"
                value={form.price}
                onChange={(event) =>
                  setForm({ ...form, price: event.target.value })
                }
              />
            )}
          </FormField>

          {editingId ? (
            <>
              <FormField
                hint="Kichik raqam yuqorida turadi"
                label="Saralash tartibi"
                {...(errors.sortOrder ? { error: errors.sortOrder } : {})}
              >
                {(props) => (
                  <TextInput
                    {...props}
                    min={0}
                    type="number"
                    value={form.sortOrder}
                    onChange={(event) =>
                      setForm({ ...form, sortOrder: event.target.value })
                    }
                  />
                )}
              </FormField>
              <Checkbox
                boxed
                checked={form.isActive}
                description="Nofaol qo'shimcha yangi buyurtmalarda tanlanmaydi"
                label="Faol"
                onChange={(checked) => setForm({ ...form, isActive: checked })}
              />
            </>
          ) : (
            <p className="text-[13px] text-mz-text-muted">
              Saralash tartibi va faollik yaratilgandan keyin tahrirlanadi —
              yaratish endpoint&apos;i faqat nom va narxni qabul qiladi.
            </p>
          )}
        </div>
      </Modal>
    </div>
  );
}
