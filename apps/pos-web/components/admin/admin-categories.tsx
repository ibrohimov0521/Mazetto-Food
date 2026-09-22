"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch, SessionExpiredError } from "../../lib/api";
import { hasPermission } from "../../lib/auth";
import { useApiResource } from "../../lib/use-api-resource";
import { useAuth } from "../auth/auth-provider";
import { Badge } from "../admin-ui/badge";
import { Button, ButtonLink } from "../admin-ui/button";
import { Card, CardHeader } from "../admin-ui/card";
import {
  DataTable,
  RowAction,
  type DataTableColumn,
} from "../admin-ui/data-table";
import { ErrorState } from "../admin-ui/feedback";
import {
  focusFirstInvalidField,
  FormField,
  Select,
  TextInput,
} from "../admin-ui/form";
import { Icon } from "../admin-ui/icon";
import { ImageDropzone } from "../admin-ui/image-dropzone";
import { Modal } from "../admin-ui/modal";
import { Toggle } from "../admin-ui/toggle";
import { useToast } from "../admin-ui/toast";

/*
 * Kategoriyalar.
 *
 * MUHIM: backend'dagi `DELETE` haqiqiy o'chirish EMAS —
 * `menu.service.ts:deleteCategory` `isActive: false` qo'yadi. Shuning uchun
 * bu yerda "o'chirish" emas, "arxivlash" deyiladi.
 *
 * Bu qayta ishlashda tuzatilganlar:
 *   - Rasm maydoni oddiy matn edi; endi `ImageDropzone folder="categories"`
 *     (yo'lni qo'lda kiritish ham qoldi, chunki mavjud qatorlarda yo'llar
 *     allaqachon yozilgan).
 *   - Har mutatsiyadan keyin butun ekran skeletonga aylanardi
 *     (`await load()` + `if (isLoading) return <SkeletonRows/>`). Endi
 *     `useApiResource` ishlatiladi va jadval faqat BIRINCHI yuklashda
 *     skeleton ko'rsatadi; qayta yuklash paytida oldingi ma'lumot turadi.
 *   - Arxivlangan kategoriyani qaytarish faqat tahrirlash oynasidagi
 *     "Faol" tugmasi orqali mumkin edi; endi qator amali ham bor.
 *   - Nom bo'shligi `danger` toast bilan aytilardi; endi maydon yonida.
 */

type Category = {
  id: string;
  parentId?: string | null;
  code: string;
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  isActive?: boolean;
  sortOrder: number;
  _count?: { products: number; children?: number };
  depth?: number;
};

type CategoryDraft = {
  name: string;
  description: string;
  image: string;
  parentId: string;
  sortOrder: string;
  isActive: boolean;
};

type PendingAction = { category: Category; mode: "archive" | "restore" | "permanent" };

const emptyDraft: CategoryDraft = {
  name: "",
  description: "",
  image: "",
  parentId: "",
  sortOrder: "0",
  isActive: true,
};

export function AdminCategoriesPage() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [isSaving, setIsSaving] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [draft, setDraft] = useState<CategoryDraft>(emptyDraft);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const canCreate = hasPermission(user, "MENU_CREATE");
  const canEdit = hasPermission(user, "MENU_EDIT");
  const canArchive = hasPermission(user, "MENU_DELETE");

  const {
    data,
    isLoading,
    error,
    reload: load,
  } = useApiResource(
    () => apiFetch<Category[]>("/menu/categories?includeInactive=true"),
    [],
    "Kategoriyalarni yuklab bo'lmadi.",
  );
  const categories = data ?? [];
  const categoryById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories],
  );
  const categoryRows = useMemo(() => {
    const byParent = new Map<string | null, Category[]>();
    const visited = new Set<string>();
    const rows: Category[] = [];

    for (const category of categories) {
      const parentId =
        category.parentId && categoryById.has(category.parentId)
          ? category.parentId
          : null;
      const siblings = byParent.get(parentId) ?? [];
      siblings.push(category);
      byParent.set(parentId, siblings);
    }
    for (const siblings of byParent.values()) {
      siblings.sort(
        (left, right) =>
          left.sortOrder - right.sortOrder ||
          left.name.localeCompare(right.name, "uz"),
      );
    }

    function append(parentId: string | null, depth: number): void {
      for (const category of byParent.get(parentId) ?? []) {
        if (visited.has(category.id)) continue;
        visited.add(category.id);
        rows.push({ ...category, depth });
        append(category.id, depth + 1);
      }
    }

    append(null, 0);
    for (const category of categories) {
      if (!visited.has(category.id)) rows.push({ ...category, depth: 0 });
    }
    return rows;
  }, [categories, categoryById]);
  const isFormOpen = isCreating || editing !== null;

  // Oyna yopilganda xato belgilari qolib ketmasin.
  useEffect(() => {
    if (!isFormOpen) {
      setErrors({});
    }
  }, [isFormOpen]);

  function closeForm(): void {
    setIsCreating(false);
    setEditing(null);
  }

  function openCreate(): void {
    setDraft(emptyDraft);
    setIsCreating(true);
  }

  function openEdit(category: Category): void {
    setDraft({
      name: category.name,
      description: category.description ?? "",
      image: category.imageUrl ?? "",
      parentId: category.parentId ?? "",
      sortOrder: String(category.sortOrder),
      isActive: category.isActive !== false,
    });
    setEditing(category);
  }

  async function save(): Promise<void> {
    const nextErrors: Record<string, string> = {};

    if (!draft.name.trim()) {
      nextErrors.name = "Kategoriya nomi kiritilishi shart.";
    }

    const sortOrder = Number(draft.sortOrder);

    if (!Number.isFinite(sortOrder) || sortOrder < 0) {
      nextErrors.sortOrder = "Tartib 0 yoki undan katta son bo'lishi kerak.";
    }

    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      window.requestAnimationFrame(() =>
        focusFirstInvalidField(document.getElementById("category-form")),
      );
      return;
    }

    setIsSaving(true);

    /*
     * `description` va `image` BO'SH SATR bilan ham yuboriladi (tahrirlashda):
     * `updateCategory` `undefined` bo'lmagan maydonni yozadi, ya'ni bu
     * tavsifni yoki rasmni O'CHIRISH imkonini beradi. Yaratishda esa bo'sh
     * maydon umuman yuborilmaydi.
     */
    const body = editing
      ? {
          name: draft.name.trim(),
          description: draft.description.trim(),
          image: draft.image.trim(),
          parentId: draft.parentId || null,
          sortOrder,
          isActive: draft.isActive,
        }
      : {
          name: draft.name.trim(),
          ...(draft.description.trim()
            ? { description: draft.description.trim() }
            : {}),
          ...(draft.image.trim() ? { image: draft.image.trim() } : {}),
          ...(draft.parentId ? { parentId: draft.parentId } : {}),
          sortOrder,
        };

    try {
      if (editing) {
        await apiFetch(`/menu/categories/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
        showToast("Kategoriya yangilandi.", "success");
      } else {
        await apiFetch("/menu/categories", {
          method: "POST",
          body: JSON.stringify(body),
        });
        showToast("Kategoriya qo'shildi.", "success");
      }

      closeForm();
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

  async function confirmPending(): Promise<void> {
    if (!pending) {
      return;
    }

    setIsSaving(true);

    try {
      if (pending.mode === "permanent") {
        await apiFetch("/menu/categories/bulk/permanent", {
          method: "DELETE",
          body: JSON.stringify({ ids: [pending.category.id] }),
        });
        showToast("Kategoriya bazadan butunlay o'chirildi.", "success");
      } else if (pending.mode === "archive") {
        await apiFetch(`/menu/categories/${pending.category.id}`, {
          method: "DELETE",
        });
        showToast("Kategoriya arxivlandi.", "success");
      } else {
        await apiFetch(`/menu/categories/${pending.category.id}`, {
          method: "PATCH",
          body: JSON.stringify({ isActive: true }),
        });
        showToast("Kategoriya menyuga qaytarildi.", "success");
      }

      setPending(null);
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
      setIsSaving(false);
    }
  }

  async function permanentlyDeleteSelected(): Promise<void> {
    if (!selectedIds.length) return;
    if (!window.confirm(`${selectedIds.length} ta kategoriyani bazadan butunlay o'chirishni tasdiqlaysizmi?`)) return;

    setIsSaving(true);
    try {
      await apiFetch("/menu/categories/bulk/permanent", {
        method: "DELETE",
        body: JSON.stringify({ ids: selectedIds }),
      });
      setSelectedIds([]);
      showToast(`${selectedIds.length} ta kategoriya o'chirildi.`, "success");
      load();
    } catch (caught) {
      showToast(
        caught instanceof Error ? caught.message : "Kategoriyalarni o'chirib bo'lmadi.",
        "danger",
      );
    } finally {
      setIsSaving(false);
    }
  }

  const columns: DataTableColumn<Category>[] = [
    {
      key: "name",
      header: "Nomi",
      primary: true,
      render: (category) => (
        <div
          className="min-w-0"
          style={{ paddingLeft: `${Math.min(category.depth ?? 0, 4) * 16}px` }}
        >
          <p className="truncate font-semibold text-mz-text">{category.name}</p>
          <p className="truncate text-[13px] text-mz-text-muted">
            {category.depth ? "Quyi bo'lim · " : ""}
            {category.code}
          </p>
        </div>
      ),
    },
    {
      key: "description",
      header: "Tavsif",
      hideOnMobile: true,
      render: (category) => (
        <span className="text-mz-text-muted">
          {category.description ?? "—"}
        </span>
      ),
    },
    {
      key: "image",
      header: "Rasm",
      hideOnMobile: true,
      render: (category) =>
        category.imageUrl ? (
          <Badge tone="info">Bor</Badge>
        ) : (
          <Badge tone="neutral">Yo&apos;q</Badge>
        ),
    },
    {
      key: "products",
      header: "Mahsulot",
      align: "right",
      render: (category) => `${category._count?.products ?? 0} ta`,
    },
    {
      key: "sortOrder",
      header: "Tartib",
      align: "right",
      render: (category) => category.sortOrder,
    },
    {
      key: "status",
      header: "Holat",
      render: (category) => (
        <Badge
          tone={category.isActive === false ? "neutral" : "success"}
          withDot
        >
          {category.isActive === false ? "Arxivda" : "Faol"}
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
            isLoading
              ? "Yangilanmoqda…"
              : `${categories.length} ta kategoriya · ${
                  categories.filter((category) => category.isActive !== false)
                    .length
                } ta faol`
          }
          title="Kategoriyalar"
          actions={
            <div className="flex flex-wrap gap-2">
              {canArchive && selectedIds.length ? (
                <Button onClick={() => void permanentlyDeleteSelected()} size="lg" variant="danger">
                  {selectedIds.length} ta o&apos;chirish
                </Button>
              ) : null}
              {canCreate ? (
                <Button onClick={openCreate} size="lg">
                  <Icon className="h-4 w-4" name="plus" />
                  Yangi kategoriya
                </Button>
              ) : null}
            </div>
          }
        />
        <DataTable
          caption="Kategoriyalar ro'yxati"
          columns={columns}
          emptyDescription="Birinchi kategoriyani qo'shing — mahsulot kategoriyasiz saqlanmaydi."
          emptyIcon="folder"
          emptyTitle="Kategoriya yo'q"
          getRowKey={(category) => category.id}
          isLoading={isLoading && !data}
          rows={categoryRows}
          selectable={canArchive}
          selectedKeys={selectedIds}
          onSelectionChange={setSelectedIds}
          selectionDisabled={(category: Category) =>
            Boolean(category._count?.products || category._count?.children)
          }
          {...(canCreate
            ? {
                emptyAction: (
                  <Button onClick={openCreate} variant="ghost">
                    <Icon className="h-4 w-4" name="plus" />
                    Yangi kategoriya
                  </Button>
                ),
              }
            : {})}
          rowActions={(category: Category) => (
            <>
              <ButtonLink
                href={`/admin/products?categoryId=${encodeURIComponent(category.id)}`}
                size="sm"
                variant="ghost"
              >
                Mahsulotlar
              </ButtonLink>
              {canEdit || canArchive ? (
                <>
                    {canEdit ? (
                      <RowAction
                        icon="pencil"
                        label={`${category.name} — tahrirlash`}
                        onClick={() => openEdit(category)}
                      />
                    ) : null}
                    {canArchive ? (
                      category.isActive !== false ? (
                        <RowAction
                          icon="trash"
                          label={`${category.name} — arxivlash`}
                          onClick={() => setPending({ category, mode: "archive" })}
                          tone="danger"
                        />
                      ) : (
                        <RowAction
                          icon="check"
                          label={`${category.name} — menyuga qaytarish`}
                          onClick={() => setPending({ category, mode: "restore" })}
                        />
                      )
                    ) : null}
                    {canArchive && !category._count?.products && !category._count?.children ? (
                      <RowAction
                        icon="trash"
                        label={`${category.name} — bazadan butunlay o'chirish`}
                        onClick={() => setPending({ category, mode: "permanent" })}
                        tone="danger"
                      />
                    ) : null}
                </>
              ) : null}
            </>
          )}
        />
      </Card>

      {/*
        `dismissOnBackdrop={false}` — forma oynasida fonni beparvo bosish
        kiritilgan matnni ogohlantirmasdan yo'q qilib yuborardi.
      */}
      <Modal
        dismissOnBackdrop={false}
        footer={
          <>
            <Button onClick={closeForm} variant="ghost">
              Bekor qilish
            </Button>
            <Button isLoading={isSaving} onClick={() => void save()} size="lg">
              Saqlash
            </Button>
          </>
        }
        isOpen={isFormOpen}
        onClose={closeForm}
        title={editing ? `${editing.name} — tahrirlash` : "Yangi kategoriya"}
      >
        <div className="grid gap-3" id="category-form">
          <FormField
            label="Nomi"
            required
            {...(errors.name ? { error: errors.name } : {})}
          >
            {(props) => (
              <TextInput
                {...props}
                maxLength={80}
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

          <FormField
            hint="Mijoz saytida kategoriya ostida ko'rinadi"
            label="Tavsif"
          >
            {(props) => (
              <TextInput
                {...props}
                maxLength={500}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                value={draft.description}
              />
            )}
          </FormField>

          <FormField
            hint="Bo'sh qoldirilsa yuqori darajada turadi"
            label="Ota kategoriya"
          >
            {(props) => (
              <Select
                {...props}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    parentId: event.target.value,
                  }))
                }
                value={draft.parentId}
              >
                <option value="">Yuqori daraja</option>
                {categories
                  .filter((category) => category.id !== editing?.id)
                  .map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.parentId ? "— " : ""}
                      {category.name}
                    </option>
                  ))}
              </Select>
            )}
          </FormField>

          <FormField label="Rasm">
            {(props) => (
              <div className="flex flex-col gap-2">
                <ImageDropzone
                  folder="categories"
                  onUploaded={(url) =>
                    setDraft((current) => ({ ...current, image: url }))
                  }
                  value={draft.image}
                />
                {/*
                  Matn maydoni ATAYLAB qoldirilgan: mavjud kategoriyalarning
                  yo'llari allaqachon yozilgan. Yuklash bu maydonni
                  to'ldiradi, uni almashtirmaydi.
                */}
                <TextInput
                  {...props}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      image: event.target.value,
                    }))
                  }
                  placeholder="/categories/lavash.webp"
                  value={draft.image}
                />
              </div>
            )}
          </FormField>

          <FormField
            hint="Kichik raqam yuqorida turadi"
            label="Saralash tartibi"
            {...(errors.sortOrder ? { error: errors.sortOrder } : {})}
          >
            {(props) => (
              <TextInput
                {...props}
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

          {editing ? (
            <div className="border-t border-mz-border pt-3">
              <Toggle
                checked={draft.isActive}
                description="Nofaol kategoriya menyuda va mijoz saytida ko'rinmaydi"
                label="Faol"
                onChange={(checked) =>
                  setDraft((current) => ({ ...current, isActive: checked }))
                }
              />
            </div>
          ) : (
            <p className="text-[13px] text-mz-text-muted">
              Yangi kategoriya darhol faol bo&apos;ladi.
            </p>
          )}
        </div>
      </Modal>

      <Modal
        description={
          pending?.mode === "permanent"
            ? "Kategoriya bazadan butunlay o'chiriladi. Bu amalni qaytarib bo'lmaydi."
            : pending?.mode === "archive"
            ? "Kategoriya o'chirilmaydi — nofaol holatga o'tadi. Undagi mahsulotlar va buyurtma tarixi saqlanadi, lekin menyuda ko'rinmaydi."
            : "Kategoriya menyuga qaytadi va mijoz saytida darhol ko'rinadi."
        }
        footer={
          <>
            <Button onClick={() => setPending(null)} variant="ghost">
              Bekor qilish
            </Button>
            <Button
              isLoading={isSaving}
              onClick={() => void confirmPending()}
              variant={pending?.mode === "restore" ? "primary" : "danger"}
            >
              {pending?.mode === "permanent" ? "Butunlay o'chirish" : pending?.mode === "archive" ? "Arxivlash" : "Qaytarish"}
            </Button>
          </>
        }
        isOpen={pending !== null}
        onClose={() => setPending(null)}
        title={
          pending
            ? pending.mode === "permanent"
              ? `${pending.category.name} butunlay o'chirilsinmi?`
              : pending.mode === "archive"
              ? `${pending.category.name} arxivlansinmi?`
              : `${pending.category.name} qaytarilsinmi?`
            : "Tasdiqlash"
        }
      >
        {pending?.mode === "archive" &&
        (pending.category._count?.products ?? 0) > 0 ? (
          <p className="text-sm text-mz-text">
            Bu kategoriyada{" "}
            <b>{pending.category._count?.products} ta mahsulot</b> bor. Ular
            o&apos;chirilmaydi, lekin kategoriya bilan birga menyudan chiqadi.
          </p>
        ) : null}
      </Modal>
    </div>
  );
}
