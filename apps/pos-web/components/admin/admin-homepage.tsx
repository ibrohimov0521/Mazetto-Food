"use client";

import { FormEvent, useState } from "react";
import { apiFetch, SessionExpiredError } from "../../lib/api";
import { useApiResource } from "../../lib/use-api-resource";
import { formatDateTime } from "../../lib/order-display";
import { productImage } from "../../lib/media";
import { Badge } from "../admin-ui/badge";
import { Button } from "../admin-ui/button";
import { Card, CardHeader } from "../admin-ui/card";
import { DataTable, RowAction, type DataTableColumn } from "../admin-ui/data-table";
import { ErrorState, Skeleton } from "../admin-ui/feedback";
import { Checkbox, FormField, TextInput, Textarea } from "../admin-ui/form";
import { ImageDropzone } from "../admin-ui/image-dropzone";
import { Modal } from "../admin-ui/modal";
import { Tabs, type TabItem } from "../admin-ui/tabs";
import { useToast } from "../admin-ui/toast";

/*
 * Mijoz saytining bosh sahifasi: hero slaydlar va aksiyalar.
 *
 * DIQQAT: bu yerdagi o'zgarishlar mijozlarga DARHOL ko'rinadi.
 * Shuning uchun o'chirish tasdiqlash oynasi orqali bajariladi.
 *
 * UCHTA TUZATISH:
 *
 *  1. RASM. Maydon oddiy matn edi: admin `/homepage/banner.webp` kabi yo'lni
 *     qo'lda yozardi va faylni serverga ALOHIDA joylashtirishi kerak
 *     bo'lardi — ya'ni qator bazada bo'lib, rasm hech qachon chiqmasligi
 *     mumkin edi. `ImageDropzone` `folder="homepage"` ni qabul qiladi va
 *     allaqachon mavjud edi, lekin bu ekranda ishlatilmasdi. Matn maydoni
 *     SAQLANADI (mavjud yo'llar allaqachon yozilgan) — yuklash uni
 *     to'ldiradi, almashtirmaydi.
 *
 *  2. MUDDAT. Jadvalda "Muddat" ustuni bor edi va `startAt`/`endAt` ni
 *     ko'rsatardi, lekin formada bu maydonlar YO'Q edi — ya'ni ustun hech
 *     qachon to'lmaydigan qiymatni ko'rsatib turardi. Endi ikkisi ham
 *     tahrirlanadi.
 *
 *  3. MAYDONNI BO'SHATISH. Forma bo'sh maydonni `undefined` qilib yuborardi,
 *     `JSON.stringify` esa `undefined` ni TASHLAB KETADI — natijada backend
 *     `dto.subtitle !== undefined` tekshiruvidan o'tmaydi va bir marta
 *     yozilgan qo'shimcha matnni, rasmni yoki belgini QAYTA O'CHIRIB
 *     BO'LMASDI. Endi bo'sh maydon `null` bilan yuboriladi — backend
 *     (`homepage.service.ts` dagi `heroData`) aynan shuni kutadi.
 */

type HomepageItem = {
  id: string;
  title: string;
  subtitle?: string | null;
  description?: string | null;
  imageUrl?: string | null;
  targetUrl?: string | null;
  ctaLabel?: string | null;
  badge?: string | null;
  discountPercent?: string | number | null;
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
  targetUrl: string;
  ctaLabel: string;
  badge: string;
  discountPercent: string;
  sortOrder: string;
  startAt: string;
  endAt: string;
  isActive: boolean;
};

const emptyForm: FormState = {
  title: "",
  body: "",
  imageUrl: "",
  targetUrl: "",
  ctaLabel: "",
  badge: "",
  discountPercent: "",
  sortOrder: "0",
  startAt: "",
  endAt: "",
  isActive: true,
};

const endpoints: Record<EntityKind, string> = {
  hero: "/homepage/hero-slides",
  promotion: "/homepage/promotions",
};

const tabs: TabItem[] = [
  { key: "hero", label: "Hero slaydlar", icon: "monitor" },
  { key: "promotion", label: "Aksiyalar", icon: "megaphone" },
];

/**
 * Hero slaydda matn maydoni `subtitle`, aksiyada `description` deb ataladi.
 * Ikkalasi ham ixtiyoriy, shuning uchun strukturaviy tip orqali o'qiymiz.
 */
function bodyText(item: HomepageItem): string | null {
  return item.subtitle ?? item.description ?? null;
}

/**
 * ISO vaqt → `datetime-local` qiymati (mahalliy vaqt mintaqasida).
 *
 * `<input type="datetime-local">` MAHALLIY vaqt kutadi; ISO satrni
 * to'g'ridan-to'g'ri berish input'ni bo'sh qoldiradi.
 */
function toLocalInput(value: string | null | undefined): string {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const offsetMs = date.getTimezoneOffset() * 60_000;

  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

/**
 * `datetime-local` qiymati → to'liq ISO.
 *
 * Mintaqa siljishi ATAYLAB brauzerda hisoblanadi: xom `2026-09-12T10:30`
 * yuborilsa uni `new Date()` SERVER mintaqasida o'qiydi va aksiya admin
 * kutgan vaqtda emas, boshqa vaqtda yonardi.
 */
function toIso(value: string): string | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function AdminHomepagePage() {
  const { showToast } = useToast();

  const [tab, setTab] = useState<EntityKind>("hero");
  const [editorKind, setEditorKind] = useState<EntityKind | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  const [pendingDelete, setPendingDelete] = useState<{
    kind: EntityKind;
    id: string;
    title: string;
  } | null>(null);

  const {
    data,
    isLoading,
    error,
    reload: load,
  } = useApiResource(
    () =>
      Promise.all([
        apiFetch<HomepageItem[]>(endpoints.hero),
        apiFetch<HomepageItem[]>(endpoints.promotion),
      ]),
    [],
    "Bosh sahifa kontentini yuklab bo'lmadi.",
  );

  const slides = data?.[0] ?? [];
  const promotions = data?.[1] ?? [];
  const rows = tab === "hero" ? slides : promotions;

  function openCreate(kind: EntityKind): void {
    setEditorKind(kind);
    setEditingId(null);
    setErrors({});
    setForm(emptyForm);
  }

  function openEdit(kind: EntityKind, item: HomepageItem): void {
    setEditorKind(kind);
    setEditingId(item.id);
    setErrors({});
    setForm({
      title: item.title,
      body: bodyText(item) ?? "",
      imageUrl: item.imageUrl ?? "",
      targetUrl: item.targetUrl ?? "",
      ctaLabel: item.ctaLabel ?? "",
      badge: item.badge ?? "",
      discountPercent:
        item.discountPercent === null || item.discountPercent === undefined
          ? ""
          : String(item.discountPercent),
      sortOrder: String(item.sortOrder),
      startAt: toLocalInput(item.startAt),
      endAt: toLocalInput(item.endAt),
      isActive: item.isActive,
    });
  }

  function closeEditor(): void {
    setEditorKind(null);
    setEditingId(null);
    setErrors({});
  }

  function validate(): Record<string, string> {
    const next: Record<string, string> = {};

    if (!form.title.trim()) {
      next.title = "Sarlavha kiritilishi shart.";
    }

    const sortOrder = Number(form.sortOrder);

    if (!Number.isInteger(sortOrder) || sortOrder < 0) {
      next.sortOrder = "Tartib raqami 0 yoki undan katta butun son bo'lishi kerak.";
    }

    if (form.discountPercent.trim()) {
      const discount = Number(form.discountPercent);

      if (!Number.isFinite(discount) || discount < 0 || discount > 100) {
        next.discountPercent = "Chegirma 0–100 oralig'ida bo'lishi kerak.";
      }
    }

    if (form.startAt && form.endAt && form.startAt > form.endAt) {
      next.endAt = "Tugash vaqti boshlanish vaqtidan keyin bo'lishi kerak.";
    }

    return next;
  }

  async function save(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    if (!editorKind) {
      return;
    }

    const nextErrors = validate();
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setIsSaving(true);

    /*
     * Bo'sh maydon `null` bilan yuboriladi, `undefined` bilan EMAS —
     * fayl boshidagi 3-izohga qarang. `forbidNonWhitelisted: true`
     * bo'lgani uchun tana faqat DTO maydonlaridan iborat.
     */
    const payload: Record<string, unknown> = {
      title: form.title.trim(),
      [editorKind === "hero" ? "subtitle" : "description"]:
        form.body.trim() || null,
      imageUrl: form.imageUrl.trim() || null,
      targetUrl: form.targetUrl.trim() || null,
      ctaLabel: form.ctaLabel.trim() || null,
      badge: form.badge.trim() || null,
      sortOrder: Number(form.sortOrder),
      isActive: form.isActive,
      startAt: toIso(form.startAt),
      endAt: toIso(form.endAt),
    };

    /*
     * `discountPercent` faqat aksiyada bor. Bo'sh qoldirilsa 0 yuboriladi:
     * backend `new Prisma.Decimal(dto.discountPercent)` chaqiradi va `null`
     * bilan ishlamaydi, 0 esa "chegirma yo'q" degani.
     */
    if (editorKind === "promotion") {
      payload.discountPercent = form.discountPercent.trim()
        ? Number(form.discountPercent)
        : 0;
    }

    try {
      if (editingId) {
        await apiFetch(`${endpoints[editorKind]}/${editingId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        showToast(
          "Saqlandi. O'zgarish mijoz saytida darhol ko'rinadi.",
          "success",
        );
      } else {
        await apiFetch(endpoints[editorKind], {
          method: "POST",
          body: JSON.stringify(payload),
        });
        showToast(
          "Yaratildi. O'zgarish mijoz saytida darhol ko'rinadi.",
          "success",
        );
      }

      closeEditor();
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

  async function confirmDelete(): Promise<void> {
    if (!pendingDelete) {
      return;
    }

    setIsSaving(true);

    try {
      await apiFetch(`${endpoints[pendingDelete.kind]}/${pendingDelete.id}`, {
        method: "DELETE",
      });
      showToast("O'chirildi. Mijoz saytida darhol yo'qoladi.", "success");
      setPendingDelete(null);
      load();
    } catch (caught) {
      if (caught instanceof SessionExpiredError) {
        return;
      }

      showToast(
        caught instanceof Error ? caught.message : "O'chirib bo'lmadi.",
        "danger",
      );
    } finally {
      setIsSaving(false);
    }
  }

  const columns: DataTableColumn<HomepageItem>[] = [
    {
      key: "title",
      header: "Sarlavha",
      primary: true,
      render: (item) => (
        <div className="flex min-w-0 items-center gap-3">
          {item.imageUrl ? (
            // `next/image` tashqi manzil uchun sozlama talab qiladi va 40px
            // eskiz uchun hech narsa qo'shmaydi.
            <img
              alt=""
              className="h-10 w-10 shrink-0 rounded-mz-control border border-mz-border object-cover"
              src={productImage(item.imageUrl)}
            />
          ) : (
            <span className="h-10 w-10 shrink-0 rounded-mz-control border border-dashed border-mz-border-strong" />
          )}
          <div className="min-w-0">
            <p className="truncate font-semibold text-mz-text">{item.title}</p>
            <p className="truncate text-[13px] text-mz-text-muted">
              {bodyText(item) ?? "Qo'shimcha matn yo'q"}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: "status",
      header: "Holat",
      render: (item) => (
        <Badge tone={item.isActive ? "success" : "neutral"} withDot>
          {item.isActive ? "Mijozga ko'rinadi" : "Ko'rinmaydi"}
        </Badge>
      ),
    },
    {
      key: "window",
      header: "Muddat",
      hideOnMobile: true,
      render: (item) =>
        item.startAt || item.endAt ? (
          <span className="text-[13px]">
            {item.startAt ? formatDateTime(item.startAt) : "Boshidan"} —{" "}
            {item.endAt ? formatDateTime(item.endAt) : "Cheksiz"}
          </span>
        ) : (
          <span className="text-[13px] text-mz-text-muted">Cheklovsiz</span>
        ),
    },
    {
      key: "sort",
      header: "Tartib",
      align: "right",
      render: (item) => String(item.sortOrder),
    },
  ];

  if (isLoading && !data) {
    return (
      <div aria-busy="true" className="grid gap-5">
        <span className="sr-only">Yuklanmoqda</span>
        <Skeleton className="h-12 w-72" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="grid gap-5">
      {error ? <ErrorState message={error} onRetry={load} /> : null}

      {/*
        IKKI RO'YXAT TAB'GA AJRATILDI.

        Ilgari ikkita kartochka ustma-ust turardi va HAR BIRIDA o'z oltin
        "Yangi ..." tugmasi bor edi — bir ekranda ikkita asosiy harakat.
        Endi bitta asosiy tugma bor va u faol tab uchun ishlaydi.
      */}
      <Card>
        <CardHeader
          actions={
            <Button onClick={() => openCreate(tab)} size="lg">
              {tab === "hero" ? "Yangi slayd" : "Yangi aksiya"}
            </Button>
          }
          description={
            tab === "hero"
              ? "Mijoz saytining yuqorisidagi aylanuvchi banner. Slayd qo'shilmasa sayt standart kontentni ko'rsatadi."
              : "Aksiyalar bo'limi. Faol aksiya bo'lmasa bo'lim mijoz saytida avtomatik yashiriladi."
          }
          title="Bosh sahifa kontenti"
        />

        <div className="border-b border-mz-border bg-mz-surface-sunken px-4 py-3">
          <Tabs
            active={tab}
            items={tabs}
            label="Bosh sahifa bo'limlari"
            onChange={(key) => setTab(key as EntityKind)}
            panelId="homepage-panel"
          />
        </div>

        <div id="homepage-panel" role="tabpanel">
          <DataTable
            caption={tab === "hero" ? "Hero slaydlar" : "Aksiyalar"}
            columns={columns}
            emptyDescription={
              tab === "hero"
                ? "Slayd qo'shilmagan — bosh sahifada standart kontent ko'rinadi."
                : "Aksiya qo'shilmagan — mijoz saytida bu bo'lim ko'rinmaydi."
            }
            emptyIcon={tab === "hero" ? "monitor" : "megaphone"}
            emptyTitle={tab === "hero" ? "Slayd yo'q" : "Aksiya yo'q"}
            getRowKey={(item) => item.id}
            isLoading={isLoading}
            rowActions={(item) => (
              <>
                <RowAction
                  icon="pencil"
                  label={`${item.title} — tahrirlash`}
                  onClick={() => openEdit(tab, item)}
                />
                <RowAction
                  icon="trash"
                  label={`${item.title} — o'chirish`}
                  onClick={() =>
                    setPendingDelete({
                      id: item.id,
                      kind: tab,
                      title: item.title,
                    })
                  }
                  tone="danger"
                />
              </>
            )}
            rows={rows}
          />
        </div>
      </Card>

      {/* --- Tahrirlash formasi -------------------------------------------- */}
      <Modal
        description="O'zgarish saqlangandan keyin mijoz saytida darhol ko'rinadi."
        dismissOnBackdrop={false}
        footer={
          <>
            <Button onClick={closeEditor} variant="ghost">
              Bekor qilish
            </Button>
            <Button
              form="homepage-form"
              isLoading={isSaving}
              size="lg"
              type="submit"
            >
              Saqlash
            </Button>
          </>
        }
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
          <FormField
            label="Sarlavha"
            required
            {...(errors.title ? { error: errors.title } : {})}
          >
            {(props) => (
              <TextInput
                {...props}
                maxLength={120}
                onChange={(event) =>
                  setForm({ ...form, title: event.target.value })
                }
                value={form.title}
              />
            )}
          </FormField>

          <FormField
            label={editorKind === "hero" ? "Qo'shimcha matn" : "Tavsif"}
          >
            {(props) => (
              <Textarea
                {...props}
                maxLength={500}
                onChange={(event) =>
                  setForm({ ...form, body: event.target.value })
                }
                value={form.body}
              />
            )}
          </FormField>

          {/*
            Rasm: yuklash ZONASI + yo'l maydoni. Yuklash yo'lni to'ldiradi,
            shuning uchun mavjud qo'lda yozilgan yo'llar ham ishlayveradi.
          */}
          {/*
            `FormField` ISHLATILMAYDI: u `<label htmlFor>` chiqaradi va
            `ImageDropzone` ichida bog'lanadigan yagona boshqaruv yashirin
            `<input type="file">`. Yorliq unga ishora qilsa ham foydasi yo'q,
            bog'lanmasa esa yaroqsiz `<label>` qoladi. Dropzone o'zining
            `aria-describedby` izohini beradi, shuning uchun bu yerda oddiy
            sarlavha yetarli.
          */}
          <div className="grid gap-1">
            <p className="text-[13px] font-semibold text-mz-text">Rasm</p>
            <ImageDropzone
              folder="homepage"
              onUploaded={(url) =>
                setForm((current) => ({ ...current, imageUrl: url }))
              }
              value={form.imageUrl ? productImage(form.imageUrl) : ""}
            />
          </div>

          <FormField
            hint="Media serveridagi nisbiy yo'l, masalan /homepage/banner.webp. Bo'sh qoldirilsa rasm o'chiriladi"
            label="Rasm manzili"
          >
            {(props) => (
              <TextInput
                {...props}
                onChange={(event) =>
                  setForm({ ...form, imageUrl: event.target.value })
                }
                value={form.imageUrl}
              />
            )}
          </FormField>

          <FormField
            hint="Bosilganda mijoz qaysi sahifaga o'tadi. Bo'sh bo'lsa havola bo'lmaydi"
            label="Havola manzili"
          >
            {(props) => (
              <TextInput
                {...props}
                onChange={(event) =>
                  setForm({ ...form, targetUrl: event.target.value })
                }
                value={form.targetUrl}
              />
            )}
          </FormField>

          <div className="grid gap-3 sm:grid-cols-3">
            <FormField label="Tugma matni">
              {(props) => (
                <TextInput
                  {...props}
                  maxLength={40}
                  onChange={(event) =>
                    setForm({ ...form, ctaLabel: event.target.value })
                  }
                  value={form.ctaLabel}
                />
              )}
            </FormField>
            <FormField hint="Masalan: Yangi, -20%" label="Belgi">
              {(props) => (
                <TextInput
                  {...props}
                  maxLength={40}
                  onChange={(event) =>
                    setForm({ ...form, badge: event.target.value })
                  }
                  value={form.badge}
                />
              )}
            </FormField>
            <FormField
              hint="Kichik raqam oldinda turadi"
              label="Tartib raqami"
              {...(errors.sortOrder ? { error: errors.sortOrder } : {})}
            >
              {(props) => (
                <TextInput
                  {...props}
                  min={0}
                  onChange={(event) =>
                    setForm({ ...form, sortOrder: event.target.value })
                  }
                  type="number"
                  value={form.sortOrder}
                />
              )}
            </FormField>
          </div>

          {editorKind === "promotion" ? (
            <FormField
              hint="0–100. Bo'sh qoldirilsa chegirma yo'q deb saqlanadi"
              label="Chegirma foizi"
              {...(errors.discountPercent
                ? { error: errors.discountPercent }
                : {})}
            >
              {(props) => (
                <TextInput
                  {...props}
                  max={100}
                  min={0}
                  onChange={(event) =>
                    setForm({ ...form, discountPercent: event.target.value })
                  }
                  type="number"
                  value={form.discountPercent}
                />
              )}
            </FormField>
          ) : null}

          {/*
            Muddat oynasi. Vaqt SIZNING mintaqangizda kiritiladi va serverga
            to'liq ISO ko'rinishida yuboriladi.
          */}
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField
              hint="Bo'sh — darhol boshlanadi"
              label="Boshlanish vaqti"
            >
              {(props) => (
                <TextInput
                  {...props}
                  onChange={(event) =>
                    setForm({ ...form, startAt: event.target.value })
                  }
                  type="datetime-local"
                  value={form.startAt}
                />
              )}
            </FormField>
            <FormField
              hint="Bo'sh — muddatsiz"
              label="Tugash vaqti"
              {...(errors.endAt ? { error: errors.endAt } : {})}
            >
              {(props) => (
                <TextInput
                  {...props}
                  onChange={(event) =>
                    setForm({ ...form, endAt: event.target.value })
                  }
                  type="datetime-local"
                  value={form.endAt}
                />
              )}
            </FormField>
          </div>

          <Checkbox
            boxed
            checked={form.isActive}
            description="O'chirilsa yozuv saqlanadi, lekin mijoz saytida ko'rinmaydi"
            label="Mijoz saytida ko'rinadi"
            onChange={(checked) => setForm({ ...form, isActive: checked })}
          />
        </form>
      </Modal>

      {/* --- O'chirishni tasdiqlash ---------------------------------------- */}
      <Modal
        description="Bu amalni orqaga qaytarib bo'lmaydi. O'zgarish mijoz saytida darhol ko'rinadi."
        footer={
          <>
            <Button onClick={() => setPendingDelete(null)} variant="ghost">
              Bekor qilish
            </Button>
            <Button
              isLoading={isSaving}
              onClick={() => void confirmDelete()}
              size="lg"
              variant="danger"
            >
              O&apos;chirish
            </Button>
          </>
        }
        isOpen={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        title="O'chirishni tasdiqlang"
      >
        <p className="text-sm text-mz-text">
          <span className="font-semibold">{pendingDelete?.title}</span>{" "}
          o&apos;chiriladi va mijoz saytidan darhol yo&apos;qoladi.
        </p>
      </Modal>
    </div>
  );
}
