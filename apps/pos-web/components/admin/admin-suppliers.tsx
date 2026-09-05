"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch, SessionExpiredError } from "../../lib/api";
import { Button } from "../admin-ui/button";
import { Card, CardHeader } from "../admin-ui/card";
import { DataTable, type DataTableColumn } from "../admin-ui/data-table";
import { ErrorState } from "../admin-ui/feedback";
import { FilterBar, FormField, TextInput } from "../admin-ui/form";
import { Modal } from "../admin-ui/modal";
import { useToast } from "../admin-ui/toast";

/*
 * Yetkazib beruvchilar.
 *
 * Backend `/suppliers` to'liq CRUD bilan tayyor edi, lekin admin panelda
 * ekrani yo'q edi.
 *
 * ESLATMA: backend `DELETE /suppliers/:id` ni qo'llab-quvvatlaydi, lekin
 * `listSuppliers` faqat `isActive: true` yozuvlarni qaytaradi — ya'ni
 * o'chirish amalda arxivlash. Bu `policy_decisions_to_finalize.MENU_DELETE`
 * dagi "hard delete o'rniga archive" tavsiyasiga mos.
 */

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
};

const emptyForm: SupplierForm = { name: "", phone: "", address: "" };

export function AdminSuppliersPage() {
  const { showToast } = useToast();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<SupplierForm>(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Supplier | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      setSuppliers(await apiFetch<Supplier[]>("/suppliers"));
    } catch (caught) {
      if (caught instanceof SessionExpiredError) {
        return;
      }

      setError(caught instanceof Error ? caught.message : "Yetkazib beruvchilarni yuklab bo'lmadi.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

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

  function openCreate(): void {
    setEditingId(null);
    setForm(emptyForm);
    setIsEditorOpen(true);
  }

  function openEdit(supplier: Supplier): void {
    setEditingId(supplier.id);
    setForm({
      name: supplier.name,
      phone: supplier.phone ?? "",
      address: supplier.address ?? "",
    });
    setIsEditorOpen(true);
  }

  async function save(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setIsSaving(true);

    const payload = {
      name: form.name.trim(),
      phone: form.phone.trim() || undefined,
      address: form.address.trim() || undefined,
    };

    try {
      if (editingId) {
        await apiFetch(`/suppliers/${editingId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        showToast("Yetkazib beruvchi yangilandi.", "success");
      } else {
        await apiFetch("/suppliers", { method: "POST", body: JSON.stringify(payload) });
        showToast("Yetkazib beruvchi qo'shildi.", "success");
      }

      setIsEditorOpen(false);
      await load();
    } catch (caught) {
      if (caught instanceof SessionExpiredError) {
        return;
      }

      showToast(caught instanceof Error ? caught.message : "Saqlab bo'lmadi.", "danger");
    } finally {
      setIsSaving(false);
    }
  }

  async function confirmDelete(): Promise<void> {
    if (!pendingDelete) {
      return;
    }

    try {
      await apiFetch(`/suppliers/${pendingDelete.id}`, { method: "DELETE" });
      showToast("Yetkazib beruvchi ro'yxatdan olib tashlandi.", "success");
      setPendingDelete(null);
      await load();
    } catch (caught) {
      if (caught instanceof SessionExpiredError) {
        return;
      }

      showToast(caught instanceof Error ? caught.message : "O'chirib bo'lmadi.", "danger");
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
    { key: "phone", header: "Telefon", render: (supplier) => supplier.phone ?? "—" },
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
      render: (supplier) => (supplier.branchId ? "Filial" : "Umumiy"),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (supplier) => (
        <span className="inline-flex gap-2">
          <Button onClick={() => openEdit(supplier)} size="sm" variant="ghost">
            Tahrir
          </Button>
          <Button onClick={() => setPendingDelete(supplier)} size="sm" variant="danger">
            Olib tashlash
          </Button>
        </span>
      ),
    },
  ];

  return (
    <div className="grid gap-5">
      {error ? <ErrorState message={error} onRetry={() => void load()} /> : null}

      <Card>
        <CardHeader
          actions={<Button onClick={openCreate}>Yangi yetkazib beruvchi</Button>}
          description="Faol yetkazib beruvchilar ro'yxati"
          title="Yetkazib beruvchilar"
        />

        <FilterBar>
          <div className="min-w-52 flex-1">
            <TextInput
              aria-label="Yetkazib beruvchi qidirish"
              placeholder="Nomi, telefoni yoki manzili"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
        </FilterBar>

        <DataTable
          caption="Yetkazib beruvchilar"
          columns={columns}
          emptyDescription="Qidiruvni o'zgartiring yoki yangi yetkazib beruvchi qo'shing."
          emptyTitle="Yetkazib beruvchi topilmadi"
          getRowKey={(supplier) => supplier.id}
          isLoading={isLoading}
          rows={filtered}
        />
      </Card>

      <Modal
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        title={editingId ? "Yetkazib beruvchini tahrirlash" : "Yangi yetkazib beruvchi"}
      >
        <form className="grid gap-3" id="supplier-form" onSubmit={save}>
          <FormField label="Nomi" required>
            {(props) => (
              <TextInput
                {...props}
                required
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
              />
            )}
          </FormField>
          <FormField label="Telefon">
            {(props) => (
              <TextInput
                {...props}
                placeholder="+998901234567"
                value={form.phone}
                onChange={(event) => setForm({ ...form, phone: event.target.value })}
              />
            )}
          </FormField>
          <FormField label="Manzil">
            {(props) => (
              <TextInput
                {...props}
                value={form.address}
                onChange={(event) => setForm({ ...form, address: event.target.value })}
              />
            )}
          </FormField>
        </form>

        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <Button onClick={() => setIsEditorOpen(false)} variant="ghost">
            Bekor qilish
          </Button>
          <Button disabled={isSaving} form="supplier-form" type="submit">
            {isSaving ? "Saqlanmoqda..." : "Saqlash"}
          </Button>
        </div>
      </Modal>

      <Modal
        description="Yetkazib beruvchi ro'yxatdan olib tashlanadi. Mavjud zaxira harakatlari saqlanib qoladi."
        footer={
          <>
            <Button onClick={() => setPendingDelete(null)} variant="ghost">
              Bekor qilish
            </Button>
            <Button onClick={() => void confirmDelete()} variant="danger">
              Olib tashlash
            </Button>
          </>
        }
        isOpen={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        title="Tasdiqlang"
      >
        <p className="text-sm text-mz-text">
          <span className="font-semibold">{pendingDelete?.name}</span> olib tashlanadi.
        </p>
      </Modal>
    </div>
  );
}
