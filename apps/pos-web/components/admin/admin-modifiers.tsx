"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { apiFetch, SessionExpiredError } from "../../lib/api";
import { formatMoney } from "../../lib/order-display";
import { Badge } from "../admin-ui/badge";
import { Button } from "../admin-ui/button";
import { Card, CardHeader } from "../admin-ui/card";
import { DataTable, type DataTableColumn } from "../admin-ui/data-table";
import { ErrorState } from "../admin-ui/feedback";
import { FormField, TextInput } from "../admin-ui/form";
import { Modal } from "../admin-ui/modal";
import { useToast } from "../admin-ui/toast";

/*
 * Qo'shimchalar (modifier) katalogi.
 *
 * Backend'da faqat `POST /menu/modifiers` bor edi — ro'yxat ham, tahrirlash ham
 * yo'q edi. Katalog 2-bosqichida `GET /menu/modifiers` va
 * `PATCH /menu/modifiers/:id` qo'shildi.
 *
 * O'chirish endpoint'i yo'q va ataylab qo'shilmadi: modifier buyurtma
 * tarixidagi `modifierSnapshot` bilan bog'liq. Uni nofaol qilish
 * (`isActive: false`) tarixiy yaxlitlikni saqlaydi — bu
 * `policy_decisions_to_finalize.MENU_DELETE` dagi arxivlash tavsiyasiga mos.
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
  const { showToast } = useToast();
  const [modifiers, setModifiers] = useState<Modifier[]>([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ModifierForm>(emptyForm);
  const [isSaving, setIsSaving] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      setModifiers(
        await apiFetch<Modifier[]>("/menu/modifiers?includeInactive=true"),
      );
    } catch (caught) {
      if (caught instanceof SessionExpiredError) {
        return;
      }

      setError(
        caught instanceof Error
          ? caught.message
          : "Qo'shimchalarni yuklab bo'lmadi.",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate(): void {
    setEditingId(null);
    setForm(emptyForm);
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
    setIsEditorOpen(true);
  }

  async function save(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    const price = Number(form.price);

    if (!Number.isFinite(price) || price < 0) {
      showToast("Narx noto'g'ri.", "danger");
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
            sortOrder: Number(form.sortOrder) || 0,
            isActive: form.isActive,
          }),
        });
        showToast("Qo'shimcha yangilandi.", "success");
      } else {
        // Yaratish endpoint'i faqat nom va narxni qabul qiladi.
        await apiFetch("/menu/modifiers", {
          method: "POST",
          body: JSON.stringify({ name: form.name.trim(), price }),
        });
        showToast("Qo'shimcha yaratildi.", "success");
      }

      setIsEditorOpen(false);
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

  async function toggleActive(modifier: Modifier): Promise<void> {
    try {
      await apiFetch(`/menu/modifiers/${modifier.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !modifier.isActive }),
      });
      showToast(
        modifier.isActive ? "Nofaol qilindi." : "Faollashtirildi.",
        "success",
      );
      await load();
    } catch (caught) {
      if (caught instanceof SessionExpiredError) {
        return;
      }

      showToast(
        caught instanceof Error ? caught.message : "O'zgartirib bo'lmadi.",
        "danger",
      );
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
          <code className="text-xs text-mz-text-muted">{modifier.code}</code>
        </div>
      ),
    },
    {
      key: "price",
      header: "Narx",
      align: "right",
      render: (modifier) => formatMoney(modifier.price),
    },
    {
      key: "products",
      header: "Mahsulotlarda",
      align: "right",
      render: (modifier) => `${modifier._count?.products ?? 0} ta`,
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
    {
      key: "actions",
      header: "",
      align: "right",
      render: (modifier) => (
        <span className="inline-flex gap-2">
          <Button onClick={() => openEdit(modifier)} size="sm" variant="ghost">
            Tahrir
          </Button>
          <Button
            onClick={() => void toggleActive(modifier)}
            size="sm"
            variant={modifier.isActive ? "danger" : "secondary"}
          >
            {modifier.isActive ? "Nofaol qilish" : "Faollashtirish"}
          </Button>
        </span>
      ),
    },
  ];

  return (
    <div className="grid gap-5">
      {error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : null}

      <Card>
        <CardHeader
          actions={<Button onClick={openCreate}>Yangi qo&apos;shimcha</Button>}
          description="Qo'shimchalar mahsulot tahrirlash sahifasida biriktiriladi"
          title="Qo'shimchalar katalogi"
        />
        <DataTable
          caption="Modifier katalogi"
          columns={columns}
          emptyDescription="Qo'shimcha yarating, so'ng uni mahsulotlarga biriktiring."
          emptyTitle="Qo'shimcha yo'q"
          getRowKey={(modifier) => modifier.id}
          isLoading={isLoading}
          rows={modifiers}
        />
        <p className="border-t border-mz-border px-4 py-2.5 text-xs text-mz-text-muted">
          Qo&apos;shimchalar o&apos;chirilmaydi — ular buyurtma tarixidagi
          qo&apos;shimcha nusxalari bilan bog&apos;liq. Ishlatilmaydigan
          qo&apos;shimchani nofaol qiling.
        </p>
      </Card>

      <Modal
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        title={editingId ? "Qo'shimchani tahrirlash" : "Yangi qo'shimcha"}
      >
        <form className="grid gap-3" id="modifier-form" onSubmit={save}>
          <FormField label="Nomi" required>
            {(props) => (
              <TextInput
                {...props}
                maxLength={80}
                required
                value={form.name}
                onChange={(event) =>
                  setForm({ ...form, name: event.target.value })
                }
              />
            )}
          </FormField>
          <FormField hint="0 bo'lsa qo'shimcha bepul" label="Narx">
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
              <FormField label="Saralash tartibi">
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
              <label className="inline-flex w-fit items-center gap-2 rounded-mz-control border border-mz-border px-3 py-2 text-sm font-semibold text-mz-text">
                <input
                  checked={form.isActive}
                  className="h-4 w-4 accent-mz-accent"
                  type="checkbox"
                  onChange={(event) =>
                    setForm({ ...form, isActive: event.target.checked })
                  }
                />
                Faol
              </label>
            </>
          ) : (
            <p className="text-xs text-mz-text-muted">
              Saralash va faollik yaratilgandan keyin tahrirlanadi.
            </p>
          )}
        </form>

        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <Button onClick={() => setIsEditorOpen(false)} variant="ghost">
            Bekor qilish
          </Button>
          <Button disabled={isSaving} form="modifier-form" type="submit">
            {isSaving ? "Saqlanmoqda..." : "Saqlash"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
