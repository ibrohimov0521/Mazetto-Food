"use client";

import { FormEvent, useState } from "react";
import { AdminPageHeader } from "../../../../components/admin-shell/admin-page-header";
import { Badge, type BadgeTone } from "../../../../components/admin-ui/badge";
import { Button } from "../../../../components/admin-ui/button";
import { Card, CardHeader } from "../../../../components/admin-ui/card";
import {
  EmptyState,
  ErrorState,
  SkeletonRows,
} from "../../../../components/admin-ui/feedback";
import {
  FormField,
  Select,
  TextInput,
} from "../../../../components/admin-ui/form";
import { Modal } from "../../../../components/admin-ui/modal";
import { useToast } from "../../../../components/admin-ui/toast";
import { apiFetch, SessionExpiredError } from "../../../../lib/api";
import { useApiResource } from "../../../../lib/use-api-resource";

type TableStatus = "AVAILABLE" | "OCCUPIED" | "RESERVED" | "CLEANING";
type Table = {
  id: string;
  branchId: string;
  hallId: string | null;
  number: number | null;
  name: string;
  capacity: number | null;
  status: TableStatus;
  hall?: { id: string; name: string } | null;
};
type Branch = {
  id: string;
  name: string;
  address?: string | null;
};
type Hall = {
  id: string;
  branchId: string;
  name: string;
  sortOrder: number;
};

const statusLabels: Record<TableStatus, string> = {
  AVAILABLE: "Bo'sh",
  OCCUPIED: "Band",
  RESERVED: "Bron qilingan",
  CLEANING: "Tozalanmoqda",
};

/*
 * RANG SEMANTIKASI.
 *
 * Ilgari OCCUPIED QIZIL edi — ya'ni to'la ishlayotgan restoran zali
 * butunlay xatolik rangida ko'rinardi, qizil esa dizayn qoidasida FAQAT
 * buzuvchi/xato holat uchun. Band stol — normal ish holati:
 *   bo'sh          yashil (muvaffaqiyat, sotishga tayyor)
 *   band           teal (ma'lumot, jarayonda)
 *   bron qilingan  sariq (diqqat, kutilmoqda)
 *   tozalanmoqda   neytral
 */
const statusTones: Record<TableStatus, BadgeTone> = {
  AVAILABLE: "success",
  OCCUPIED: "info",
  RESERVED: "warning",
  CLEANING: "neutral",
};

const statusOrder: TableStatus[] = [
  "AVAILABLE",
  "RESERVED",
  "CLEANING",
  "OCCUPIED",
];

export default function AdminTablesPage() {
  return (
    <>
      <AdminPageHeader
        breadcrumbs={[
          { label: "Admin", href: "/admin/dashboard" },
          { label: "Operatsiya" },
          { label: "Stollar" },
        ]}
        description="Zal tuzilmasi va stol holati"
        title="Stollar va zallar"
      />
      <TableManagement />
    </>
  );
}

function TableManagement() {
  const { showToast } = useToast();
  const [branchId, setBranchId] = useState("");
  const [hallName, setHallName] = useState("");
  const [hallId, setHallId] = useState("");
  const [tableName, setTableName] = useState("");
  const [number, setNumber] = useState("1");
  const [capacity, setCapacity] = useState("4");
  const [isSavingHall, setIsSavingHall] = useState(false);
  const [isSavingTable, setIsSavingTable] = useState(false);
  /*
   * Stol holatini o'zgartirish TASDIQLANADI.
   *
   * Ilgari kartochkadagi tugma bosilishi bilan holat o'zgarardi. "Bo'sh"
   * ni tasodifan bosish ofitsiantdan band stolni tortib olishga teng
   * (`PATCH /tables/:id/status` bu yerda hech qanday shart qo'ymaydi va
   * ortga qaytarish tarixi ham yo'q), shuning uchun bir qadam kerak.
   */
  const [pending, setPending] = useState<{
    table: Table;
    status: TableStatus;
  } | null>(null);
  const [isSavingStatus, setIsSavingStatus] = useState(false);

  /*
   * `useApiResource` — filial tez almashtirilganda SEKINROQ javob
   * oxirgi bo'lib kelib boshqa filialning stollarini ko'rsatib
   * qo'ymasligi uchun (hook navbat raqami bilan eskirgan javobni
   * tashlaydi). Ilgari bu ekranda qo'lda yozilgan try/catch turardi.
   */
  const {
    data,
    isLoading,
    error,
    reload: load,
  } = useApiResource(
    () =>
      Promise.all([
        apiFetch<Branch[]>("/branches"),
        apiFetch<Table[]>(
          branchId
            ? `/tables?branchId=${encodeURIComponent(branchId)}`
            : "/tables",
        ),
        apiFetch<Hall[]>(
          branchId
            ? `/halls?branchId=${encodeURIComponent(branchId)}`
            : "/halls",
        ),
      ]),
    [branchId],
    "Ma'lumotlarni yuklab bo'lmadi.",
  );
  const branches = data?.[0] ?? [];
  const tables = data?.[1] ?? [];
  const halls = data?.[2] ?? [];

  async function createHall(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!branchId) {
      showToast("Avval filialni tanlang.", "danger");
      return;
    }
    setIsSavingHall(true);
    try {
      await apiFetch("/halls", {
        method: "POST",
        body: JSON.stringify({ branchId, name: hallName }),
      });
      setHallName("");
      showToast("Zal qo'shildi.", "success");
      load();
    } catch (caught) {
      if (caught instanceof SessionExpiredError) return;
      showToast(
        caught instanceof Error ? caught.message : "Zal qo'shib bo'lmadi.",
        "danger",
      );
    } finally {
      setIsSavingHall(false);
    }
  }

  async function createTable(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!branchId) {
      showToast("Avval filialni tanlang.", "danger");
      return;
    }
    if (!hallId) {
      showToast("Avval zalni tanlang.", "danger");
      return;
    }
    setIsSavingTable(true);
    try {
      await apiFetch("/tables", {
        method: "POST",
        body: JSON.stringify({
          branchId,
          hallId,
          number: Number(number),
          name: tableName,
          capacity: Number(capacity),
        }),
      });
      setTableName("");
      showToast("Stol qo'shildi.", "success");
      load();
    } catch (caught) {
      if (caught instanceof SessionExpiredError) return;
      showToast(
        caught instanceof Error ? caught.message : "Stol qo'shib bo'lmadi.",
        "danger",
      );
    } finally {
      setIsSavingTable(false);
    }
  }

  async function applyStatus() {
    if (!pending) return;
    setIsSavingStatus(true);
    try {
      await apiFetch(`/tables/${pending.table.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: pending.status }),
      });
      showToast(
        `${pending.table.name}: ${statusLabels[pending.status].toLowerCase()}.`,
        "success",
      );
      setPending(null);
      load();
    } catch (caught) {
      if (caught instanceof SessionExpiredError) return;
      showToast(
        caught instanceof Error ? caught.message : "Holatni yangilab bo'lmadi.",
        "danger",
      );
    } finally {
      setIsSavingStatus(false);
    }
  }

  return (
    <div className="grid gap-5">
      {error ? <ErrorState message={error} onRetry={() => load()} /> : null}

      <div className="grid gap-5 xl:grid-cols-[360px_1fr]">
        <aside className="grid gap-4">
          <Card>
            <CardHeader
              title="Filial"
              description="Zal va stollar shu filial uchun ko'rsatiladi"
            />
            <div className="p-4">
              <FormField label="Filial">
                {(props) => (
                  <Select
                    {...props}
                    value={branchId}
                    onChange={(event) => {
                      setBranchId(event.target.value);
                      setHallId("");
                    }}
                  >
                    <option value="">Filialni tanlang</option>
                    {branches.map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name}
                      </option>
                    ))}
                  </Select>
                )}
              </FormField>
            </div>
          </Card>

          <Card as="div">
            <CardHeader title="Yangi zal" />
            <form className="grid gap-3 p-4" onSubmit={createHall}>
              <FormField label="Zal nomi" required>
                {(props) => (
                  <TextInput
                    {...props}
                    value={hallName}
                    onChange={(event) => setHallName(event.target.value)}
                    placeholder="Asosiy zal"
                    required
                  />
                )}
              </FormField>
              {/*
               * Ikkinchi darajali harakat: bu ekranda bitta asosiy
               * (oltin) tugma bo'lishi kerak — "Stol qo'shish".
               */}
              <Button
                disabled={!branchId}
                isLoading={isSavingHall}
                type="submit"
                variant="secondary"
              >
                Zal qo&apos;shish
              </Button>
            </form>
          </Card>

          <Card as="div">
            <CardHeader title="Yangi stol" />
            <form className="grid gap-3 p-4" onSubmit={createTable}>
              <FormField label="Zal" required>
                {(props) => (
                  <Select
                    {...props}
                    value={hallId}
                    onChange={(event) => setHallId(event.target.value)}
                    required
                  >
                    <option value="">Zalni tanlang</option>
                    {halls.map((hall) => (
                      <option key={hall.id} value={hall.id}>
                        {hall.name}
                      </option>
                    ))}
                  </Select>
                )}
              </FormField>
              <FormField label="Stol nomi" required>
                {(props) => (
                  <TextInput
                    {...props}
                    value={tableName}
                    onChange={(event) => setTableName(event.target.value)}
                    placeholder="Stol 1"
                    required
                  />
                )}
              </FormField>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Raqami">
                  {(props) => (
                    <TextInput
                      {...props}
                      value={number}
                      onChange={(event) => setNumber(event.target.value)}
                      type="number"
                      min="1"
                    />
                  )}
                </FormField>
                <FormField label="Sig'imi">
                  {(props) => (
                    <TextInput
                      {...props}
                      value={capacity}
                      onChange={(event) => setCapacity(event.target.value)}
                      type="number"
                      min="1"
                    />
                  )}
                </FormField>
              </div>
              <Button
                disabled={!branchId}
                isLoading={isSavingTable}
                size="lg"
                type="submit"
              >
                Stol qo&apos;shish
              </Button>
            </form>
          </Card>
        </aside>

        <Card as="div">
          <CardHeader
            title="Zal sxemasi"
            description={
              isLoading ? "Yuklanmoqda..." : `${tables.length} ta stol`
            }
          />
          <div className="p-4">
            {isLoading ? (
              <SkeletonRows rows={6} />
            ) : tables.length ? (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {tables.map((table) => (
                  <article
                    className="rounded-mz-card border border-mz-border bg-mz-surface p-5 shadow-mz-card"
                    key={table.id}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase text-mz-info">
                          {table.hall?.name ?? "Zalsiz"}
                        </p>
                        {/*
                         * `h3` — `CardHeader` `h2` ishlatadi, ya'ni bu
                         * yerda `h4` sarlavha darajasini sakratardi
                         * (WCAG 1.3.1 tuzilma).
                         */}
                        <h3 className="mt-2 truncate text-xl font-semibold text-mz-text">
                          {table.name}
                        </h3>
                        <p className="mt-1 text-sm text-mz-text-muted">
                          {table.capacity ?? 0} o&apos;rin
                        </p>
                      </div>
                      <Badge tone={statusTones[table.status]} withDot>
                        {statusLabels[table.status]}
                      </Badge>
                    </div>
                    <div className="mt-5 grid grid-cols-2 gap-2">
                      {statusOrder.map((nextStatus) => (
                        <Button
                          disabled={table.status === nextStatus}
                          key={nextStatus}
                          onClick={() =>
                            setPending({ table, status: nextStatus })
                          }
                          variant="ghost"
                        >
                          {statusLabels[nextStatus]}
                        </Button>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState
                title="Hali stol yo'q"
                description="Zal sxemasini boshlash uchun avval zal, so'ng stol qo'shing."
              />
            )}
          </div>
        </Card>
      </div>

      <Modal
        description="Stol holati ofitsiant va kassa ekranlarida darhol ko'rinadi."
        footer={
          <>
            <Button
              disabled={isSavingStatus}
              onClick={() => setPending(null)}
              variant="ghost"
            >
              Ortga
            </Button>
            <Button
              isLoading={isSavingStatus}
              onClick={() => void applyStatus()}
            >
              Holatni o&apos;zgartirish
            </Button>
          </>
        }
        isOpen={pending !== null}
        onClose={() => setPending(null)}
        title={
          pending
            ? `${pending.table.name} → ${statusLabels[pending.status]}`
            : "Stol holati"
        }
      >
        <p className="text-sm text-mz-text">
          {pending
            ? `Hozirgi holat: ${statusLabels[pending.table.status]}.`
            : ""}
          {pending?.table.status === "OCCUPIED" &&
          pending.status === "AVAILABLE"
            ? " Band stolni bo'sh qilish ochiq xizmatni uzib qo'yishi mumkin."
            : ""}
        </p>
      </Modal>
    </div>
  );
}
