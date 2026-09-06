"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch, SessionExpiredError } from "../../lib/api";
import { hasPermission } from "../../lib/auth";
import { useAuth } from "../auth/auth-provider";
import { Badge } from "../admin-ui/badge";
import { Button } from "../admin-ui/button";
import { Card, CardHeader } from "../admin-ui/card";
import {
  DataTable,
  RowAction,
  type DataTableColumn,
} from "../admin-ui/data-table";
import { ErrorState, SkeletonRows } from "../admin-ui/feedback";
import { FormField, TextInput } from "../admin-ui/form";
import { Icon } from "../admin-ui/icon";
import { Modal } from "../admin-ui/modal";
import { Toggle } from "../admin-ui/toggle";
import { useToast } from "../admin-ui/toast";

/*
 * Kategoriyalar.
 *
 * Ilgari ekran faqat YARATA olardi — `PATCH /menu/categories/:id` va
 * `DELETE /menu/categories/:id` tayyor bo'lsa ham ishlatilmasdi, ya'ni nom
 * yoki tartibni tuzatish uchun bazaga kirish kerak edi.
 *
 * MUHIM: backend'dagi `DELETE` haqiqiy o'chirish EMAS —
 * `menu.service.ts:deleteCategory` `isActive: false` qo'yadi. Shuning uchun
 * bu yerda "o'chirish" emas, "arxivlash" deyiladi: tasdiqlash oynasi
 * foydalanuvchiga aslida nima bo'lishini aytishi kerak.
 */

type Category = {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  isActive?: boolean;
  sortOrder: number;
  _count?: { products: number };
};

type CategoryDraft = {
  name: string;
  description: string;
  image: string;
  sortOrder: string;
  isActive: boolean;
};

const emptyDraft: CategoryDraft = {
  name: "",
  description: "",
  image: "",
  sortOrder: "0",
  isActive: true,
};

export function AdminCategoriesPage() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [editing, setEditing] = useState<Category | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [draft, setDraft] = useState<CategoryDraft>(emptyDraft);
  const [pendingArchive, setPendingArchive] = useState<Category | null>(null);

  const canCreate = hasPermission(user, "MENU_CREATE");
  const canEdit = hasPermission(user, "MENU_EDIT");
  const canArchive = hasPermission(user, "MENU_DELETE");

  const load = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      setCategories(
        await apiFetch<Category[]>("/menu/categories?includeInactive=true"),
      );
    } catch (caught) {
      if (caught instanceof SessionExpiredError) {
        return;
      }

      setError(
        caught instanceof Error
          ? caught.message
          : "Kategoriyalarni yuklab bo'lmadi.",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function closeAll(): void {
    setIsCreating(false);
    setEditing(null);
    setPendingArchive(null);
  }

  async function save(): Promise<void> {
    if (!draft.name.trim()) {
      showToast("Kategoriya nomi kerak.", "danger");
      return;
    }

    setIsSaving(true);

    const body = {
      name: draft.name.trim(),
      ...(draft.description.trim()
        ? { description: draft.description.trim() }
        : {}),
      ...(draft.image.trim() ? { image: draft.image.trim() } : {}),
      sortOrder: Number(draft.sortOrder) || 0,
      ...(editing ? { isActive: draft.isActive } : {}),
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

      closeAll();
      await load();
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

  async function archive(): Promise<void> {
    if (!pendingArchive) {
      return;
    }

    setIsSaving(true);

    try {
      await apiFetch(`/menu/categories/${pendingArchive.id}`, {
        method: "DELETE",
      });
      showToast("Kategoriya arxivlandi.", "success");
      closeAll();
      await load();
    } catch (caught) {
      if (caught instanceof SessionExpiredError) {
        return;
      }

      showToast(
        caught instanceof Error ? caught.message : "Arxivlab bo'lmadi.",
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
        <div className="min-w-0">
          <p className="truncate font-semibold text-mz-text">{category.name}</p>
          <p className="truncate text-xs text-mz-text-muted">{category.code}</p>
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

  if (isLoading) {
    return <SkeletonRows rows={6} />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={() => void load()} />;
  }

  return (
    <div className="grid gap-4">
      {canCreate ? (
        <div className="flex justify-end">
          <Button
            onClick={() => {
              setDraft(emptyDraft);
              setIsCreating(true);
            }}
          >
            <Icon className="h-4 w-4" name="plus" />
            Yangi kategoriya
          </Button>
        </div>
      ) : null}

      <Card>
        <CardHeader
          description={`${categories.length} ta kategoriya`}
          title="Kategoriyalar"
        />
        <DataTable
          columns={columns}
          emptyDescription="Birinchi kategoriyani qo'shing."
          emptyIcon="folder"
          emptyTitle="Kategoriya yo'q"
          getRowKey={(category) => category.id}
          rows={categories}
          {...(canEdit || canArchive
            ? {
                rowActions: (category: Category) => (
                  <>
                    {canEdit ? (
                      <RowAction
                        icon="pencil"
                        label={`${category.name} — tahrirlash`}
                        onClick={() => {
                          setDraft({
                            name: category.name,
                            description: category.description ?? "",
                            image: category.imageUrl ?? "",
                            sortOrder: String(category.sortOrder),
                            isActive: category.isActive !== false,
                          });
                          setEditing(category);
                        }}
                      />
                    ) : null}
                    {canArchive && category.isActive !== false ? (
                      <RowAction
                        icon="trash"
                        label={`${category.name} — arxivlash`}
                        onClick={() => setPendingArchive(category)}
                        tone="danger"
                      />
                    ) : null}
                  </>
                ),
              }
            : {})}
        />
      </Card>

      <Modal
        footer={
          <>
            <Button onClick={closeAll} variant="ghost">
              Bekor qilish
            </Button>
            <Button disabled={isSaving} onClick={() => void save()}>
              {isSaving ? "Saqlanmoqda…" : "Saqlash"}
            </Button>
          </>
        }
        isOpen={isCreating || editing !== null}
        onClose={closeAll}
        title={editing ? `${editing.name} — tahrirlash` : "Yangi kategoriya"}
      >
        <div className="grid gap-3">
          <FormField label="Nomi" required>
            {(props) => (
              <TextInput
                {...props}
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

          <FormField label="Tavsif">
            {(props) => (
              <TextInput
                {...props}
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

          <FormField hint="Masalan /categories/lavash.webp" label="Rasm yo'li">
            {(props) => (
              <TextInput
                {...props}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    image: event.target.value,
                  }))
                }
                value={draft.image}
              />
            )}
          </FormField>

          <FormField
            hint="Kichik raqam yuqorida turadi"
            label="Saralash tartibi"
          >
            {(props) => (
              <TextInput
                {...props}
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

          {editing ? (
            <div className="border-t border-mz-border pt-3">
              <Toggle
                checked={draft.isActive}
                description="Nofaol kategoriya menyuda ko'rinmaydi"
                label="Faol"
                onChange={(checked) =>
                  setDraft((current) => ({ ...current, isActive: checked }))
                }
              />
            </div>
          ) : null}
        </div>
      </Modal>

      <Modal
        description="Kategoriya o'chirilmaydi — nofaol holatga o'tadi. Undagi mahsulotlar va buyurtma tarixi saqlanadi, lekin menyuda ko'rinmaydi. Uni tahrirlash oynasidan qayta yoqish mumkin."
        footer={
          <>
            <Button onClick={closeAll} variant="ghost">
              Bekor qilish
            </Button>
            <Button
              disabled={isSaving}
              onClick={() => void archive()}
              variant="danger"
            >
              {isSaving ? "Arxivlanmoqda…" : "Arxivlash"}
            </Button>
          </>
        }
        isOpen={pendingArchive !== null}
        onClose={closeAll}
        title={
          pendingArchive ? `${pendingArchive.name} arxivlansinmi?` : "Arxivlash"
        }
      >
        {pendingArchive && (pendingArchive._count?.products ?? 0) > 0 ? (
          <p className="text-sm text-mz-text">
            Bu kategoriyada <b>{pendingArchive._count?.products} ta mahsulot</b>{" "}
            bor. Ular o'chirilmaydi, lekin kategoriya bilan birga menyudan
            chiqadi.
          </p>
        ) : null}
      </Modal>
    </div>
  );
}
