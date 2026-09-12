"use client";

import { useMemo, useState } from "react";
import { AdminPageHeader } from "../../../../components/admin-shell/admin-page-header";
import { Badge, type BadgeTone } from "../../../../components/admin-ui/badge";
import { Button } from "../../../../components/admin-ui/button";
import {
  Card,
  CardBody,
  CardHeader,
} from "../../../../components/admin-ui/card";
import {
  DataTable,
  RowAction,
  type DataTableColumn,
} from "../../../../components/admin-ui/data-table";
import {
  ErrorState,
  Skeleton,
} from "../../../../components/admin-ui/feedback";
import {
  FilterBar,
  FormField,
  Select,
  TextInput,
} from "../../../../components/admin-ui/form";
import { Icon } from "../../../../components/admin-ui/icon";
import { Modal } from "../../../../components/admin-ui/modal";
import { Toggle } from "../../../../components/admin-ui/toggle";
import { useToast } from "../../../../components/admin-ui/toast";
import { useAuth } from "../../../../components/auth/auth-provider";
import {
  printerStatusLabel,
  printerTypeLabel,
} from "../../../../components/admin/people-branch-labels";
import { apiFetch, SessionExpiredError } from "../../../../lib/api";
import { canSwitchBranch } from "../../../../lib/admin-nav";
import { useApiResource } from "../../../../lib/use-api-resource";

/*
 * Printerlar.
 *
 * OLDINGI HOLAT. Butun ekran INGLIZCHA edi ("Add printer", "Configured
 * printers", "Create printer"), maydonlarda yorliq o'rniga faqat placeholder
 * turardi ("Branch ID", "Printer name") — ya'ni admin filialning UUID sini
 * qo'lda yozishi kerak edi. Jadval xom `<table>` bo'lib `overflow-hidden`
 * ichida turardi va 375px da o'ng ustunlar KESILARDI. Yuqori o'ng burchakda
 * esa "ESC/POS ready" degan yashil chip bor edi.
 *
 * ENG MUHIM TUZATISH — HALOL HOLAT.
 *
 * Tizim printerga ULANMAYDI: `PrintersService` faqat baza qatorini yozadi va
 * `metadata.ready` ni printer TURIGA qarab hisoblaydi, hech qanday qurilma
 * so'roqlanmaydi. Shuning uchun:
 *
 *   - "ESC/POS ready" chipi OLIB TASHLANDI. U printer ulangan degan ma'noni
 *     berardi, holbuki hech narsa tekshirilmagan.
 *   - Holat yorliqlari "Ishlayapti" emas, "Ishlayapti deb BELGILANGAN"
 *     (`people-branch-labels.ts`). Bu qiymat qo'lda kiritiladi va qurilma
 *     haqiqatan ishlayotganini isbotlamaydi.
 *   - Ekranda buni ochiq aytadigan izoh bor.
 *
 * O'CHIRISH tugmasi yo'q: backendda `DELETE /printers/:id` YO'Q. Printer
 * ishdan chiqqanda "Faol" o'chiriladi (`PATCH` `isActive`).
 *
 * ADMIN roli ataylab yo'q: RBAC spetsifikatsiyasida unga hech qanday
 * `RECEIPT_*` permission berilmagan va printer boshqaruvi uning vazifalari
 * orasida emas.
 */

type PrinterType = "RECEIPT" | "KITCHEN" | "BAR" | "THERMAL" | "A4" | "OTHER";
type PrinterStatus = "ONLINE" | "OFFLINE" | "ERROR";

type Printer = {
  id: string;
  branchId: string;
  name: string;
  type: PrinterType;
  status: PrinterStatus;
  isActive: boolean;
  branch?: { id: string; name: string } | null;
};

type Branch = {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
};

const printerTypes: PrinterType[] = [
  "THERMAL",
  "RECEIPT",
  "KITCHEN",
  "BAR",
  "A4",
  "OTHER",
];

const printerStatuses: PrinterStatus[] = ["ONLINE", "OFFLINE", "ERROR"];

/** Qizil FAQAT nosozlik uchun (DESIGN_RULES). */
function statusTone(status: PrinterStatus): BadgeTone {
  if (status === "ERROR") {
    return "danger";
  }

  return status === "ONLINE" ? "success" : "neutral";
}

export default function PrintersPage() {
  return (
    <>
      <AdminPageHeader
        breadcrumbs={[
          { label: "Admin", href: "/admin/dashboard" },
          { label: "Sozlamalar" },
          { label: "Printerlar" },
        ]}
        description="Chek va oshxona printerlarining ro'yxati va qo'lda belgilangan holati"
        title="Printerlar"
      />
      <PrintersConsole />
    </>
  );
}

type EditorState = {
  id: string | null;
  branchId: string;
  name: string;
  type: PrinterType;
  status: PrinterStatus;
  isActive: boolean;
};

function emptyEditor(branchId: string): EditorState {
  return {
    id: null,
    branchId,
    name: "",
    type: "THERMAL",
    status: "OFFLINE",
    isActive: true,
  };
}

function PrintersConsole() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const isGlobalScope = canSwitchBranch(user);
  /*
   * Branch-scoped rol uchun filial QULFLANGAN. Backend `createPrinter` da
   * `resolveRequiredBranchScope` bilan baribir foydalanuvchining filialini
   * qo'yadi — tanlagich ko'rsatish printer boshqa filialga tushganda
   * foydalanuvchini chalg'itardi.
   */
  const lockedBranchId = isGlobalScope ? "" : (user?.branchId ?? "");

  const [filterBranchId, setFilterBranchId] = useState("");
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [pendingDeactivate, setPendingDeactivate] = useState<Printer | null>(
    null,
  );

  const branchesResource = useApiResource<Branch[]>(
    () => apiFetch<Branch[]>("/branches"),
    [],
    "Filiallarni yuklab bo'lmadi.",
  );

  const printersResource = useApiResource<Printer[]>(
    () =>
      apiFetch<Printer[]>(
        filterBranchId ? `/printers?branchId=${filterBranchId}` : "/printers",
      ),
    [filterBranchId],
    "Printerlarni yuklab bo'lmadi.",
  );

  const branches = branchesResource.data ?? [];
  const printers = printersResource.data ?? [];

  const branchName = useMemo(() => {
    const map = new Map(branches.map((branch) => [branch.id, branch.name]));

    return (printer: Printer) =>
      printer.branch?.name ?? map.get(printer.branchId) ?? "Noma'lum filial";
  }, [branches]);

  function openCreate(): void {
    setErrors({});
    setEditor(emptyEditor(lockedBranchId || branches[0]?.id || ""));
  }

  function openEdit(printer: Printer): void {
    setErrors({});
    setEditor({
      id: printer.id,
      branchId: printer.branchId,
      name: printer.name,
      type: printer.type,
      status: printer.status,
      isActive: printer.isActive,
    });
  }

  function validate(state: EditorState): Record<string, string> {
    const next: Record<string, string> = {};

    if (!state.name.trim()) {
      next.name = "Printer nomi kiritilishi shart.";
    } else if (state.name.trim().length > 120) {
      next.name = "Nom 120 belgidan oshmasligi kerak.";
    }

    // Filial faqat YARATISHDA kerak: `UpdatePrinterDto` da `branchId` yo'q.
    if (!state.id && !state.branchId) {
      next.branchId = "Filial tanlanishi shart.";
    }

    return next;
  }

  async function save(): Promise<void> {
    if (!editor) {
      return;
    }

    const nextErrors = validate(editor);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setIsSaving(true);

    try {
      if (editor.id) {
        /*
         * `UpdatePrinterDto`: name, type, status, isActive. `branchId` YO'Q —
         * `forbidNonWhitelisted: true` bo'lgani uchun uni yuborish 400 beradi.
         */
        await apiFetch(`/printers/${editor.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            name: editor.name.trim(),
            type: editor.type,
            status: editor.status,
            isActive: editor.isActive,
          }),
        });
        showToast("Printer ma'lumotlari saqlandi.", "success");
      } else {
        await apiFetch("/printers", {
          method: "POST",
          body: JSON.stringify({
            branchId: editor.branchId,
            name: editor.name.trim(),
            type: editor.type,
            status: editor.status,
          }),
        });
        showToast("Printer qo'shildi.", "success");
      }

      setEditor(null);
      printersResource.reload();
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

  /** Holatni jadval qatoridan almashtirish — eng ko'p qilinadigan amal. */
  async function updateStatus(
    printer: Printer,
    status: PrinterStatus,
  ): Promise<void> {
    try {
      await apiFetch(`/printers/${printer.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      showToast(
        `${printer.name}: ${printerStatusLabel(status).toLowerCase()}.`,
        "success",
      );
      printersResource.reload();
    } catch (caught) {
      if (caught instanceof SessionExpiredError) {
        return;
      }

      showToast(
        caught instanceof Error ? caught.message : "Holatni saqlab bo'lmadi.",
        "danger",
      );
      printersResource.reload();
    }
  }

  async function confirmDeactivate(): Promise<void> {
    if (!pendingDeactivate) {
      return;
    }

    setIsSaving(true);

    try {
      await apiFetch(`/printers/${pendingDeactivate.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: false }),
      });
      showToast(`${pendingDeactivate.name} ishdan chiqarildi.`, "success");
      setPendingDeactivate(null);
      printersResource.reload();
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

  const columns: DataTableColumn<Printer>[] = [
    {
      key: "name",
      header: "Printer",
      primary: true,
      render: (printer) => (
        <div className="min-w-0">
          <p className="truncate font-semibold text-mz-text">{printer.name}</p>
          <p className="truncate text-[13px] text-mz-text-muted">
            {printerTypeLabel(printer.type)}
          </p>
        </div>
      ),
    },
    {
      key: "branch",
      header: "Filial",
      render: (printer) => branchName(printer),
    },
    {
      key: "active",
      header: "Ro'yxatda",
      render: (printer) => (
        <Badge tone={printer.isActive ? "info" : "neutral"} withDot>
          {printer.isActive ? "Foydalanishda" : "Ishdan chiqarilgan"}
        </Badge>
      ),
    },
    {
      key: "status",
      header: "Qo'lda belgilangan holat",
      render: (printer) => (
        <div className="flex flex-col items-end gap-1.5 md:items-start">
          <Badge tone={statusTone(printer.status)} withDot>
            {printerStatusLabel(printer.status)}
          </Badge>
          <div className="w-full sm:w-56">
            <Select
              aria-label={`${printer.name} holatini o'zgartirish`}
              onChange={(event) =>
                void updateStatus(printer, event.target.value as PrinterStatus)
              }
              value={printer.status}
            >
              {printerStatuses.map((status) => (
                <option key={status} value={status}>
                  {printerStatusLabel(status)}
                </option>
              ))}
            </Select>
          </div>
        </div>
      ),
    },
  ];

  // Skelet FAQAT birinchi yuklashda; filtr almashganda jadval o'zining
  // `isLoading` holatini ko'rsatadi va filtr qatori joyida qoladi.
  if (
    (branchesResource.isLoading && !branchesResource.data) ||
    (printersResource.isLoading && !printersResource.data)
  ) {
    return (
      <div aria-busy="true" className="grid gap-5">
        <span className="sr-only">Yuklanmoqda</span>
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }

  return (
    <div className="grid gap-5">
      {branchesResource.error ? (
        <ErrorState
          message={branchesResource.error}
          onRetry={branchesResource.reload}
        />
      ) : null}
      {printersResource.error ? (
        <ErrorState
          message={printersResource.error}
          onRetry={printersResource.reload}
        />
      ) : null}

      {/*
        HALOLLIK IZOHI. Bu ekran printerni tekshirmaydi va shuni aytadi.
      */}
      <Card>
        <CardBody>
          <div className="flex flex-wrap items-start gap-3">
            <span aria-hidden="true" className="mt-0.5 shrink-0 text-mz-warning">
              <Icon className="h-5 w-5" name="alert" />
            </span>
            <p className="min-w-0 flex-1 text-[13px] text-mz-text-muted">
              <span className="font-semibold text-mz-text">
                Tizim printerga ulanmaydi.
              </span>{" "}
              Bu ro&apos;yxat — qurilmalarning qaydnomasi, holat esa{" "}
              <span className="font-semibold text-mz-text">qo&apos;lda</span>{" "}
              belgilanadi: u qurilma haqiqatan ishlayotganini isbotlamaydi va
              bu yerdan chek yuborilmaydi. Haqiqiy chop etish integratsiyasi
              (chek agenti va qurilma so&apos;rovi) hali ulanmagan.
            </p>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          actions={
            <Button onClick={openCreate} size="lg">
              <Icon className="h-4 w-4" name="plus" />
              Yangi printer
            </Button>
          }
          description={`${printers.length} ta qurilma qaydga olingan`}
          title="Qaydga olingan printerlar"
        />

        {isGlobalScope ? (
          <FilterBar>
            <div className="w-full sm:w-72">
              <FormField label="Filial bo'yicha filtr">
                {(props) => (
                  <Select
                    {...props}
                    onChange={(event) => setFilterBranchId(event.target.value)}
                    value={filterBranchId}
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
            {filterBranchId ? (
              <Button onClick={() => setFilterBranchId("")} variant="ghost">
                Tozalash
              </Button>
            ) : null}
          </FilterBar>
        ) : (
          <div className="border-b border-mz-border bg-mz-surface-sunken px-4 py-3">
            <p className="text-[13px] text-mz-text-muted">
              Siz faqat biriktirilgan filialingiz printerlarini ko&apos;rasiz va
              qo&apos;shasiz.
            </p>
          </div>
        )}

        <DataTable
          caption="Qaydga olingan printerlar"
          columns={columns}
          emptyDescription="Birinchi printerni qo'shing: filial, nom va tur kiritiladi. Bu qayd chek chiqarishni yoqmaydi."
          emptyIcon="printer"
          emptyTitle="Printer qaydga olinmagan"
          getRowKey={(printer) => printer.id}
          isLoading={printersResource.isLoading}
          rowActions={(printer) => (
            <>
              <RowAction
                icon="pencil"
                label={`${printer.name} — tahrirlash`}
                onClick={() => openEdit(printer)}
              />
              {printer.isActive ? (
                <RowAction
                  icon="close"
                  label={`${printer.name} — ishdan chiqarish`}
                  onClick={() => setPendingDeactivate(printer)}
                  tone="danger"
                />
              ) : null}
            </>
          )}
          rows={printers}
        />
      </Card>

      {/* --- Printer formasi ----------------------------------------------- */}
      <Modal
        dismissOnBackdrop={false}
        footer={
          <>
            <Button onClick={() => setEditor(null)} variant="ghost">
              Bekor qilish
            </Button>
            <Button isLoading={isSaving} onClick={() => void save()} size="lg">
              Saqlash
            </Button>
          </>
        }
        isOpen={editor !== null}
        onClose={() => setEditor(null)}
        title={editor?.id ? `${editor.name} — tahrirlash` : "Yangi printer"}
      >
        {editor ? (
          <div className="grid gap-3">
            <FormField
              hint="Xodim tanib oladigan nom, masalan: Kassa 1 — chek"
              label="Printer nomi"
              required
              {...(errors.name ? { error: errors.name } : {})}
            >
              {(props) => (
                <TextInput
                  {...props}
                  maxLength={120}
                  onChange={(event) =>
                    setEditor({ ...editor, name: event.target.value })
                  }
                  value={editor.name}
                />
              )}
            </FormField>

            {editor.id ? (
              /*
               * Filialni KO'CHIRISH mumkin emas: `UpdatePrinterDto` da
               * `branchId` yo'q. Shuning uchun tahrirlashda u faqat
               * ko'rsatiladi va sababi aytiladi.
               */
              <FormField
                hint="Printerni boshqa filialga ko'chirish serverda qo'llab-quvvatlanmaydi — yangi qayd yaratiladi"
                label="Filial"
              >
                {(props) => (
                  <TextInput
                    {...props}
                    disabled
                    readOnly
                    value={
                      branches.find((branch) => branch.id === editor.branchId)
                        ?.name ?? editor.branchId
                    }
                  />
                )}
              </FormField>
            ) : isGlobalScope ? (
              <FormField
                label="Filial"
                required
                {...(errors.branchId ? { error: errors.branchId } : {})}
              >
                {(props) => (
                  <Select
                    {...props}
                    onChange={(event) =>
                      setEditor({ ...editor, branchId: event.target.value })
                    }
                    value={editor.branchId}
                  >
                    <option value="">Tanlanmagan</option>
                    {branches.map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name}
                      </option>
                    ))}
                  </Select>
                )}
              </FormField>
            ) : (
              <FormField
                hint="Filial sizning huquqingizga qarab avtomatik biriktiriladi"
                label="Filial"
              >
                {(props) => (
                  <TextInput
                    {...props}
                    disabled
                    readOnly
                    value={
                      branches.find((branch) => branch.id === lockedBranchId)
                        ?.name ?? "Biriktirilgan filial"
                    }
                  />
                )}
              </FormField>
            )}

            <FormField
              hint="Chek printeri kassada, oshxona printeri tayyorlash zonasida ishlatiladi"
              label="Turi"
            >
              {(props) => (
                <Select
                  {...props}
                  onChange={(event) =>
                    setEditor({
                      ...editor,
                      type: event.target.value as PrinterType,
                    })
                  }
                  value={editor.type}
                >
                  {printerTypes.map((type) => (
                    <option key={type} value={type}>
                      {printerTypeLabel(type)}
                    </option>
                  ))}
                </Select>
              )}
            </FormField>

            <FormField
              hint="Qo'lda kiritiladigan qayd. Tizim qurilmani tekshirmaydi"
              label="Holat"
            >
              {(props) => (
                <Select
                  {...props}
                  onChange={(event) =>
                    setEditor({
                      ...editor,
                      status: event.target.value as PrinterStatus,
                    })
                  }
                  value={editor.status}
                >
                  {printerStatuses.map((status) => (
                    <option key={status} value={status}>
                      {printerStatusLabel(status)}
                    </option>
                  ))}
                </Select>
              )}
            </FormField>

            {editor.id ? (
              <Toggle
                checked={editor.isActive}
                description="O'chirilsa printer ro'yxatda qoladi, lekin foydalanishdan chiqariladi"
                label="Foydalanishda"
                onChange={(checked) =>
                  setEditor({ ...editor, isActive: checked })
                }
              />
            ) : null}
          </div>
        ) : null}
      </Modal>

      {/* --- Ishdan chiqarishni tasdiqlash --------------------------------- */}
      <Modal
        footer={
          <>
            <Button onClick={() => setPendingDeactivate(null)} variant="ghost">
              Bekor qilish
            </Button>
            <Button
              isLoading={isSaving}
              onClick={() => void confirmDeactivate()}
              size="lg"
              variant="danger"
            >
              Ishdan chiqarish
            </Button>
          </>
        }
        isOpen={pendingDeactivate !== null}
        onClose={() => setPendingDeactivate(null)}
        title="Printerni ishdan chiqarish"
      >
        <p className="text-sm text-mz-text">
          <span className="font-semibold">{pendingDeactivate?.name}</span>{" "}
          foydalanishdan chiqariladi. Qayd va tarixi saqlanadi — printer
          butunlay o&apos;chirilmaydi va keyin qayta yoqilishi mumkin.
        </p>
      </Modal>
    </div>
  );
}
