"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { apiFetch, SessionExpiredError } from "../../lib/api";
import { formatDateTime } from "../../lib/order-display";
import { Badge } from "../admin-ui/badge";
import { Button } from "../admin-ui/button";
import { Card, CardHeader } from "../admin-ui/card";
import { DataTable, type DataTableColumn } from "../admin-ui/data-table";
import { ErrorState } from "../admin-ui/feedback";
import { FormField, TextInput, Textarea } from "../admin-ui/form";
import { Modal } from "../admin-ui/modal";
import { useToast } from "../admin-ui/toast";

/*
 * Mijoz saytining bosh sahifasi: hero slaydlar va aksiyalar.
 *
 * Backend `/homepage/hero-slides` va `/homepage/promotions` to'liq CRUD bilan
 * tayyor edi, lekin admin panelda ekrani yo'q edi — bu kontent faqat
 * ma'lumotlar bazasi orqali boshqarilardi.
 *
 * DIQQAT: bu yerdagi o'zgarishlar mijozlarga DARHOL ko'rinadi.
 * Shuning uchun o'chirish tasdiqlash oynasi orqali bajariladi.
 */

type HeroSlide = {
  id: string;
  title: string;
  subtitle?: string | null;
  imageUrl?: string | null;
  ctaLabel?: string | null;
  badge?: string | null;
  sortOrder: number;
  isActive: boolean;
  startAt?: string | null;
  endAt?: string | null;
};

type Promotion = {
  id: string;
  title: string;
  description?: string | null;
  imageUrl?: string | null;
  ctaLabel?: string | null;
  badge?: string | null;
  sortOrder: number;
  isActive: boolean;
  startAt?: string | null;
  endAt?: string | null;
};

type EntityKind = "hero" | "promotion";

type FormState = {
  title: string;
  body: string;
  imageUrl: string;
  ctaLabel: string;
  badge: string;
  sortOrder: string;
  isActive: boolean;
};

const emptyForm: FormState = {
  title: "",
  body: "",
  imageUrl: "",
  ctaLabel: "",
  badge: "",
  sortOrder: "0",
  isActive: true,
};

const endpoints: Record<EntityKind, string> = {
  hero: "/homepage/hero-slides",
  promotion: "/homepage/promotions",
};

/**
 * Hero slaydda matn maydoni `subtitle`, aksiyada `description` deb ataladi.
 * Ikkalasi ham ixtiyoriy, shuning uchun strukturaviy tip orqali o'qiymiz.
 */
function bodyText(item: {
  subtitle?: string | null;
  description?: string | null;
}): string | null {
  return item.subtitle ?? item.description ?? null;
}

export function AdminHomepagePage() {
  const { showToast } = useToast();
  const [slides, setSlides] = useState<HeroSlide[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const [editorKind, setEditorKind] = useState<EntityKind | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [isSaving, setIsSaving] = useState(false);

  const [pendingDelete, setPendingDelete] = useState<
    { kind: EntityKind; id: string; title: string } | null
  >(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const [nextSlides, nextPromotions] = await Promise.all([
        apiFetch<HeroSlide[]>(endpoints.hero),
        apiFetch<Promotion[]>(endpoints.promotion),
      ]);
      setSlides(nextSlides);
      setPromotions(nextPromotions);
    } catch (caught) {
      if (caught instanceof SessionExpiredError) {
        return;
      }

      setError(caught instanceof Error ? caught.message : "Bosh sahifa kontentini yuklab bo'lmadi.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate(kind: EntityKind): void {
    setEditorKind(kind);
    setEditingId(null);
    setForm(emptyForm);
  }

  function openEdit(kind: EntityKind, item: HeroSlide | Promotion): void {
    setEditorKind(kind);
    setEditingId(item.id);
    setForm({
      title: item.title,
      body: bodyText(item) ?? "",
      imageUrl: item.imageUrl ?? "",
      ctaLabel: item.ctaLabel ?? "",
      badge: item.badge ?? "",
      sortOrder: String(item.sortOrder),
      isActive: item.isActive,
    });
  }

  function closeEditor(): void {
    setEditorKind(null);
    setEditingId(null);
  }

  async function save(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    if (!editorKind) {
      return;
    }

    setIsSaving(true);

    /*
     * Hero slaydda matn maydoni `subtitle`, aksiyada `description` deb ataladi —
     * formada bitta `body` maydoni ishlatiladi va yuborishdan oldin moslanadi.
     */
    const payload: Record<string, unknown> = {
      title: form.title.trim(),
      [editorKind === "hero" ? "subtitle" : "description"]: form.body.trim() || undefined,
      imageUrl: form.imageUrl.trim() || undefined,
      ctaLabel: form.ctaLabel.trim() || undefined,
      badge: form.badge.trim() || undefined,
      sortOrder: Number(form.sortOrder) || 0,
      isActive: form.isActive,
    };

    try {
      if (editingId) {
        await apiFetch(`${endpoints[editorKind]}/${editingId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        showToast("Saqlandi. O'zgarish mijoz saytida darhol ko'rinadi.", "success");
      } else {
        await apiFetch(endpoints[editorKind], {
          method: "POST",
          body: JSON.stringify(payload),
        });
        showToast("Yaratildi. O'zgarish mijoz saytida darhol ko'rinadi.", "success");
      }

      closeEditor();
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
      await apiFetch(`${endpoints[pendingDelete.kind]}/${pendingDelete.id}`, { method: "DELETE" });
      showToast("O'chirildi.", "success");
      setPendingDelete(null);
      await load();
    } catch (caught) {
      if (caught instanceof SessionExpiredError) {
        return;
      }

      showToast(caught instanceof Error ? caught.message : "O'chirib bo'lmadi.", "danger");
    }
  }

  function buildColumns<T extends HeroSlide | Promotion>(
    kind: EntityKind,
  ): DataTableColumn<T>[] {
    return [
      {
        key: "title",
        header: "Sarlavha",
        primary: true,
        render: (item) => (
          <div className="min-w-0">
            <p className="truncate font-semibold text-mz-text">{item.title}</p>
            <p className="truncate text-xs text-mz-text-muted">
              {bodyText(item) ?? "—"}
            </p>
          </div>
        ),
      },
      {
        key: "status",
        header: "Holat",
        render: (item) => (
          <Badge tone={item.isActive ? "success" : "neutral"} withDot>
            {item.isActive ? "Faol" : "O'chirilgan"}
          </Badge>
        ),
      },
      {
        key: "window",
        header: "Muddat",
        hideOnMobile: true,
        render: (item) =>
          item.startAt || item.endAt
            ? `${formatDateTime(item.startAt)} — ${formatDateTime(item.endAt)}`
            : "Cheklovsiz",
      },
      {
        key: "sort",
        header: "Tartib",
        align: "right",
        render: (item) => String(item.sortOrder),
      },
      {
        key: "actions",
        header: "",
        align: "right",
        render: (item) => (
          <span className="inline-flex gap-2">
            <Button onClick={() => openEdit(kind, item)} size="sm" variant="ghost">
              Tahrir
            </Button>
            <Button
              onClick={() => setPendingDelete({ kind, id: item.id, title: item.title })}
              size="sm"
              variant="danger"
            >
              O&apos;chirish
            </Button>
          </span>
        ),
      },
    ];
  }

  return (
    <div className="grid gap-5">
      {error ? <ErrorState message={error} onRetry={() => void load()} /> : null}

      <Card>
        <CardHeader
          actions={<Button onClick={() => openCreate("hero")}>Yangi slayd</Button>}
          description="Mijoz saytining yuqorisidagi aylanuvchi banner"
          title="Hero slaydlar"
        />
        <DataTable
          caption="Hero slaydlar"
          columns={buildColumns<HeroSlide>("hero")}
          emptyDescription="Slayd qo'shilmagan bo'lsa, bosh sahifada standart kontent ko'rinadi."
          emptyTitle="Slayd yo'q"
          getRowKey={(item) => item.id}
          isLoading={isLoading}
          rows={slides}
        />
      </Card>

      <Card>
        <CardHeader
          actions={<Button onClick={() => openCreate("promotion")}>Yangi aksiya</Button>}
          description="Faol aksiya bo'lmasa, bo'lim mijoz saytida avtomatik yashiriladi"
          title="Aksiyalar"
        />
        <DataTable
          caption="Aksiyalar"
          columns={buildColumns<Promotion>("promotion")}
          emptyDescription="Aksiya qo'shilmagan — mijoz saytida bu bo'lim ko'rinmaydi."
          emptyTitle="Aksiya yo'q"
          getRowKey={(item) => item.id}
          isLoading={isLoading}
          rows={promotions}
        />
      </Card>

      <Modal
        description="O'zgarish saqlangandan keyin mijoz saytida darhol ko'rinadi."
        isOpen={editorKind !== null}
        onClose={closeEditor}
        title={
          editingId
            ? editorKind === "hero"
              ? "Slaydni tahrirlash"
              : "Aksiyani tahrirlash"
            : editorKind === "hero"
              ? "Yangi slayd"
              : "Yangi aksiya"
        }
      >
        <form className="grid gap-3" id="homepage-form" onSubmit={save}>
          <FormField label="Sarlavha" required>
            {(props) => (
              <TextInput
                {...props}
                maxLength={120}
                required
                value={form.title}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
              />
            )}
          </FormField>

          <FormField label={editorKind === "hero" ? "Qo'shimcha matn" : "Tavsif"}>
            {(props) => (
              <Textarea
                {...props}
                maxLength={500}
                value={form.body}
                onChange={(event) => setForm({ ...form, body: event.target.value })}
              />
            )}
          </FormField>

          <FormField hint="Media serveridagi nisbiy yo'l, masalan /products/lavash.webp" label="Rasm manzili">
            {(props) => (
              <TextInput
                {...props}
                value={form.imageUrl}
                onChange={(event) => setForm({ ...form, imageUrl: event.target.value })}
              />
            )}
          </FormField>

          <div className="grid gap-3 sm:grid-cols-3">
            <FormField label="Tugma matni">
              {(props) => (
                <TextInput
                  {...props}
                  maxLength={40}
                  value={form.ctaLabel}
                  onChange={(event) => setForm({ ...form, ctaLabel: event.target.value })}
                />
              )}
            </FormField>
            <FormField label="Belgi">
              {(props) => (
                <TextInput
                  {...props}
                  maxLength={40}
                  value={form.badge}
                  onChange={(event) => setForm({ ...form, badge: event.target.value })}
                />
              )}
            </FormField>
            <FormField label="Tartib raqami">
              {(props) => (
                <TextInput
                  {...props}
                  min={0}
                  type="number"
                  value={form.sortOrder}
                  onChange={(event) => setForm({ ...form, sortOrder: event.target.value })}
                />
              )}
            </FormField>
          </div>

          <label className="inline-flex w-fit items-center gap-2 rounded-mz-control border border-mz-border px-3 py-2 text-sm font-semibold text-mz-text">
            <input
              checked={form.isActive}
              className="h-4 w-4 accent-mz-accent"
              type="checkbox"
              onChange={(event) => setForm({ ...form, isActive: event.target.checked })}
            />
            Faol (mijoz saytida ko&apos;rinadi)
          </label>
        </form>

        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <Button onClick={closeEditor} variant="ghost">
            Bekor qilish
          </Button>
          <Button disabled={isSaving} form="homepage-form" type="submit">
            {isSaving ? "Saqlanmoqda..." : "Saqlash"}
          </Button>
        </div>
      </Modal>

      <Modal
        description="Bu amalni orqaga qaytarib bo'lmaydi. O'zgarish mijoz saytida darhol ko'rinadi."
        footer={
          <>
            <Button onClick={() => setPendingDelete(null)} variant="ghost">
              Bekor qilish
            </Button>
            <Button onClick={() => void confirmDelete()} variant="danger">
              O&apos;chirish
            </Button>
          </>
        }
        isOpen={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        title="O'chirishni tasdiqlang"
      >
        <p className="text-sm text-mz-text">
          <span className="font-semibold">{pendingDelete?.title}</span> o&apos;chiriladi.
        </p>
      </Modal>
    </div>
  );
}
