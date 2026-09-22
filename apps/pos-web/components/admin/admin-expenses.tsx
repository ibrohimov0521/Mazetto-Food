"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiFetch, SessionExpiredError } from "../../lib/api";
import { useApiResource } from "../../lib/use-api-resource";
import { canSwitchBranch } from "../../lib/admin-nav";
import { hasPermission } from "../../lib/auth";
import { formatDateTime, formatMoney } from "../../lib/order-display";
import { useAuth } from "../auth/auth-provider";
import { Badge } from "../admin-ui/badge";
import { Button } from "../admin-ui/button";
import { Card, CardBody, CardHeader } from "../admin-ui/card";
import { DataTable, RowAction, type DataTableColumn } from "../admin-ui/data-table";
import { ErrorState } from "../admin-ui/feedback";
import {
  FilterBar,
  focusFirstInvalidField,
  FormField,
  Select,
  TextInput,
  Textarea,
} from "../admin-ui/form";
import { Modal } from "../admin-ui/modal";
import { Pagination } from "../admin-ui/pagination";
import { InfoBox, StatGrid } from "../admin-ui/stat-box";
import { useToast } from "../admin-ui/toast";
import { moneyCell, numberCell } from "./admin-report-views";

/*
 * Xarajatlar.
 *
 * Backend faqat UCHTA route beradi: `GET /expenses`, `GET
 * /expenses/categories`, `POST /expenses`. `GET /expenses/:id`, `PATCH`,
 * `DELETE` va tasdiqlash (approve/reject) YO'Q — `Expense` modelida holat
 * ustuni ham yo'q. Shuning uchun bu ekranda tahrirlash va o'chirish tugmasi
 * ATAYLAB qo'yilmagan: ular 404 beradigan tugmalar bo'lardi.
 *
 * Xarajat ochiq smenaga bog'lansa, u kassa hisob-kitobiga kiradi
 * (`Shift.expensesTotal`). Backend yopilgan smenaga xarajat qo'shishni
 * rad etadi — aks holda yakunlangan hisob buziladi.
 *
 * TUZATILGAN NUQSON (tugma ishlamasdi). `CreateExpenseDto` da `branchId`
 * bor va backend uni `resolveRequiredBranchScope` orqali yechadi: GLOBAL
 * qamrovli rol (SUPER_ADMIN, ACCOUNTANT) uchun filial KO'RSATILISHI SHART,
 * aks holda 403 "Bu amal uchun filial tanlanishi shart". Formada filial
 * maydoni umuman yo'q edi, ya'ni bosh administrator uchun "Yozish" tugmasi
 * HAR DOIM xato qaytarardi. Endi filial tanlagichi bor va global qamrovli
 * rol uchun majburiy.
 */

type Branch = { id: string; code: string; name: string };

type Expense = {
  id: string;
  category: string;
  amount: string;
  description?: string | null;
  expenseDate: string;
  shiftId?: string | null;
  branch?: Branch | null;
  employee?: { id: string; firstName: string; lastName?: string | null } | null;
};

type ExpenseCategory = {
  id: string;
  name: string;
  branchId: string;
  branch?: Branch | null;
};

type Shift = {
  id: string;
  shiftNumber: number;
  status: "OPEN" | "CLOSED";
  branch?: { id: string; name: string } | null;
  employee?: { firstName: string; lastName?: string | null } | null;
};

type ExpenseForm = {
  branchId: string;
  category: string;
  amount: string;
  expenseDate: string;
  description: string;
  shiftId: string;
};

type ExpenseErrors = Partial<Record<keyof ExpenseForm, string>>;

const pageSize = 50;

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

const emptyForm = (): ExpenseForm => ({
  branchId: "",
  category: "",
  amount: "",
  expenseDate: today(),
  description: "",
  shiftId: "",
});

export function AdminExpensesPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const isGlobalScope = canSwitchBranch(user);
  const canCreate = hasPermission(user, "EXPENSE_CREATE");
  const canSeeShifts = hasPermission(user, "SHIFT_VIEW_BRANCH");

  const [categories, setCategories] = useState<string[]>([]);
  const [categoryRecords, setCategoryRecords] = useState<ExpenseCategory[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [openShifts, setOpenShifts] = useState<Shift[]>([]);
  const [category, setCategory] = useState("");
  const [branchId, setBranchId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [offset, setOffset] = useState(0);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isCategorySaving, setIsCategorySaving] = useState(false);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [form, setForm] = useState<ExpenseForm>(emptyForm);
  const [categoryForm, setCategoryForm] = useState({ id: "", branchId: "", name: "" });
  const [categoryError, setCategoryError] = useState("");
  const [errors, setErrors] = useState<ExpenseErrors>({});
  const formRef = useRef<HTMLFormElement>(null);

  const loadCategoryData = useCallback(() => {
    void Promise.all([
      apiFetch<string[]>("/expenses/categories"),
      apiFetch<ExpenseCategory[]>("/expenses/category-records"),
    ]).then(([names, records]) => {
      setCategories(names);
      setCategoryRecords(records);
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (isGlobalScope) {
      void apiFetch<Branch[]>("/branches")
        .then(setBranches)
        .catch(() => undefined);
    }

    /*
     * Ochiq smenalar ro'yxati — xarajatni smenaga bog'lash uchun.
     * SHIFT_VIEW_BRANCH bo'lmasa bu bo'lim ko'rsatilmaydi.
     */
    if (canSeeShifts) {
      void apiFetch<Shift[]>("/shifts?status=OPEN&limit=50")
        .then(setOpenShifts)
        .catch(() => undefined);
    }
  }, [canSeeShifts, isGlobalScope]);

  useEffect(() => {
    loadCategoryData();
  }, [loadCategoryData]);

  const rangeError =
    from && to && from > to
      ? "Boshlanish sanasi tugash sanasidan keyin bo'lmasligi kerak."
      : "";

  const {
    data,
    isLoading,
    error,
    reload: load,
  } = useApiResource(
    () => {
      if (rangeError) {
        return Promise.resolve<Expense[]>([]);
      }

      const params = new URLSearchParams({
        limit: String(pageSize),
        offset: String(offset),
      });
      if (category) params.set("category", category);
      if (branchId) params.set("branchId", branchId);
      if (from) params.set("from", `${from}T00:00:00.000Z`);
      if (to) params.set("to", `${to}T23:59:59.999Z`);
      return apiFetch<Expense[]>(`/expenses?${params.toString()}`);
    },
    [branchId, category, offset, from, to, rangeError],
    "Xarajatlarni yuklab bo'lmadi.",
  );
  const expenses = data ?? [];

  const stats = useMemo(() => {
    const total = expenses.reduce(
      (sum, expense) => sum + Number(expense.amount ?? 0),
      0,
    );
    const linkedToShift = expenses.filter((expense) => expense.shiftId).length;
    const uniqueCategories = new Set(
      expenses.map((expense) => expense.category),
    ).size;

    return { total, linkedToShift, uniqueCategories, count: expenses.length };
  }, [expenses]);

  /** Ochiq smenalar faqat tanlangan filial uchun — boshqasi backend'da rad etiladi. */
  const selectableShifts = useMemo(() => {
    if (!form.branchId) {
      return openShifts;
    }

    return openShifts.filter(
      (shift) => !shift.branch || shift.branch.id === form.branchId,
    );
  }, [form.branchId, openShifts]);

  const selectableExpenseCategories = useMemo(
    () => [
      ...new Set(
        categoryRecords
          .filter((item) => !form.branchId || item.branchId === form.branchId)
          .map((item) => item.name),
      ),
    ],
    [categoryRecords, form.branchId],
  );

  function openForm(): void {
    setForm({
      ...emptyForm(),
      /* Bitta filialga bog'langan rol uchun tanlov yo'q — server o'zi biladi. */
      branchId: isGlobalScope ? (branches[0]?.id ?? "") : "",
    });
    setErrors({});
    setIsFormOpen(true);
  }

  function openCategoryForm(categoryRecord?: ExpenseCategory): void {
    setCategoryForm({
      id: categoryRecord?.id ?? "",
      branchId: categoryRecord?.branchId ?? branchId ?? branches[0]?.id ?? "",
      name: categoryRecord?.name ?? "",
    });
    setCategoryError("");
    setIsCategoryOpen(true);
  }

  async function saveCategory(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const name = categoryForm.name.trim();
    if (!name) {
      setCategoryError("Kategoriya nomini kiriting.");
      return;
    }
    if (isGlobalScope && !categoryForm.id && !categoryForm.branchId) {
      setCategoryError("Filialni tanlang.");
      return;
    }
    setIsCategorySaving(true);
    setCategoryError("");
    try {
      await apiFetch(
        categoryForm.id
          ? `/expenses/categories/${categoryForm.id}`
          : "/expenses/categories",
        {
          method: categoryForm.id ? "PATCH" : "POST",
          body: JSON.stringify({
            name,
            ...(!categoryForm.id && categoryForm.branchId
              ? { branchId: categoryForm.branchId }
              : {}),
          }),
        },
      );
      showToast(categoryForm.id ? "Kategoriya yangilandi." : "Kategoriya qo'shildi.", "success");
      setIsCategoryOpen(false);
      loadCategoryData();
    } catch (caught) {
      if (caught instanceof SessionExpiredError) return;
      setCategoryError(caught instanceof Error ? caught.message : "Kategoriya saqlanmadi.");
    } finally {
      setIsCategorySaving(false);
    }
  }

  async function archiveCategory(categoryRecord: ExpenseCategory): Promise<void> {
    if (!window.confirm(`“${categoryRecord.name}” kategoriyasi arxivga olinsinmi?`)) return;
    try {
      await apiFetch(`/expenses/categories/${categoryRecord.id}`, { method: "DELETE" });
      showToast("Kategoriya arxivga olindi.", "success");
      if (category === categoryRecord.name) setCategory("");
      loadCategoryData();
    } catch (caught) {
      if (caught instanceof SessionExpiredError) return;
      showToast(caught instanceof Error ? caught.message : "Kategoriya arxivlanmadi.", "danger");
    }
  }

  async function permanentlyDeleteCategories(): Promise<void> {
    if (!selectedCategoryIds.length) return;
    if (!window.confirm(`${selectedCategoryIds.length} ta xarajat kategoriyasini bazadan butunlay o'chirishni tasdiqlaysizmi?`)) return;
    try {
      await apiFetch("/expenses/categories/bulk/permanent", { method: "DELETE", body: JSON.stringify({ ids: selectedCategoryIds }) });
      showToast("Tanlangan kategoriyalar o'chirildi.", "success");
      setSelectedCategoryIds([]);
      loadCategoryData();
    } catch (caught) {
      if (caught instanceof SessionExpiredError) return;
      showToast(caught instanceof Error ? caught.message : "Kategoriyalarni o'chirib bo'lmadi.", "danger");
    }
  }

  function validate(draft: ExpenseForm): ExpenseErrors {
    const next: ExpenseErrors = {};
    const amount = Number(draft.amount);

    if (isGlobalScope && !draft.branchId) {
      next.branchId = "Filialni tanlang — xarajat filialga yoziladi.";
    }

    if (!draft.category.trim()) {
      next.category = "Kategoriya kerak.";
    } else if (draft.category.trim().length > 80) {
      next.category = "Kategoriya 80 belgidan oshmasligi kerak.";
    }

    if (draft.amount.trim() === "") {
      next.amount = "Summani kiriting.";
    } else if (!Number.isFinite(amount) || amount <= 0) {
      next.amount = "Summa musbat son bo'lishi kerak.";
    }

    if (!draft.expenseDate) {
      next.expenseDate = "Sanani tanlang.";
    }

    if (draft.description.length > 500) {
      next.description = "Izoh 500 belgidan oshmasligi kerak.";
    }

    return next;
  }

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    const nextErrors = validate(form);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      /*
       * Xato MAYDON YONIDA ko'rsatiladi va fokus birinchi noto'g'ri
       * maydonga o'tadi. Ilgari hamma narsa 5 soniyalik toast'ga ketardi:
       * u qaysi maydon aybdorligini aytmasdi va o'qishga ulgurmasdan
       * yo'qolardi.
       */
      requestAnimationFrame(() => focusFirstInvalidField(formRef.current));
      return;
    }

    setIsSaving(true);

    try {
      await apiFetch("/expenses", {
        method: "POST",
        body: JSON.stringify({
          ...(form.branchId ? { branchId: form.branchId } : {}),
          category: form.category.trim(),
          amount: Number(form.amount),
          expenseDate: new Date(`${form.expenseDate}T12:00:00`).toISOString(),
          ...(form.description.trim()
            ? { description: form.description.trim() }
            : {}),
          ...(form.shiftId ? { shiftId: form.shiftId } : {}),
        }),
      });
      showToast("Xarajat yozildi.", "success");
      setIsFormOpen(false);
      setForm(emptyForm());
      setErrors({});
      setOffset(0);
      load();

      /* Yangi kategoriya ro'yxatga faqat birinchi yozuvdan keyin tushadi. */
      loadCategoryData();
    } catch (caught) {
      if (caught instanceof SessionExpiredError) {
        return;
      }

      const message =
        caught instanceof Error ? caught.message : "Xarajat yozilmadi.";

      /*
       * Server rad etishi ham formada ko'rinadi. "Filial tanlanishi shart"
       * va "yopilgan smena" — ikkalasi ham aynan bitta maydonga tegishli.
       */
      if (message.toLowerCase().includes("filial")) {
        setErrors({ branchId: message });
      } else if (message.toLowerCase().includes("shift")) {
        setErrors({ shiftId: message });
      } else {
        setErrors({ amount: message });
      }

      requestAnimationFrame(() => focusFirstInvalidField(formRef.current));
    } finally {
      setIsSaving(false);
    }
  }

  const columns: DataTableColumn<Expense>[] = [
    {
      key: "expense",
      header: "Xarajat",
      primary: true,
      render: (expense) => (
        <div className="min-w-0">
          <p className="truncate font-semibold text-mz-text">
            {expense.category}
          </p>
          <p className="truncate text-[13px] text-mz-text-muted">
            {formatDateTime(expense.expenseDate)}
            {expense.description ? ` · ${expense.description}` : ""}
          </p>
        </div>
      ),
    },
    {
      key: "branch",
      header: "Filial",
      hideOnMobile: true,
      render: (expense) => expense.branch?.name ?? "—",
    },
    {
      key: "employee",
      header: "Kim yozgan",
      hideOnMobile: true,
      render: (expense) =>
        expense.employee
          ? [expense.employee.firstName, expense.employee.lastName]
              .filter(Boolean)
              .join(" ")
          : "—",
    },
    {
      key: "shift",
      header: "Smena",
      render: (expense) =>
        expense.shiftId ? (
          <Badge tone="info">Kassa hisobida</Badge>
        ) : (
          <span className="text-mz-text-faint">Bog&apos;lanmagan</span>
        ),
    },
    {
      key: "amount",
      header: "Summa",
      align: "right",
      render: (expense) => (
        <span className={moneyCell}>{formatMoney(expense.amount)}</span>
      ),
    },
  ];

  return (
    <div className="grid gap-5">
      {error ? <ErrorState message={error} onRetry={() => load()} /> : null}

      <StatGrid>
        <InfoBox
          icon="banknote"
          label="Ko'rsatilgan xarajat"
          value={`${stats.count} ta`}
        />
        <InfoBox
          description="Shu sahifadagi yozuvlar"
          icon="wallet"
          label="Summa"
          tone="brand"
          value={formatMoney(stats.total)}
        />
        <InfoBox
          description="Kutilgan naqdni kamaytiradi"
          icon="clock"
          label="Smenaga bog'langan"
          value={`${stats.linkedToShift} ta`}
        />
        <InfoBox
          icon="folder"
          label="Kategoriya"
          value={`${stats.uniqueCategories} ta`}
        />
      </StatGrid>

      <Card>
        <CardHeader
          actions={canCreate ? (
            <div className="flex flex-wrap justify-end gap-2">
              <Button onClick={() => openCategoryForm()} variant="ghost">
                Kategoriyalar
              </Button>
              <Button onClick={openForm} size="lg">
                Xarajat qo&apos;shish
              </Button>
            </div>
          ) : undefined}
          description="Ochiq smenaga bog'langan xarajat kassa hisobiga kiradi"
          title="Xarajatlar"
        />

        <FilterBar>
          <div className="w-56">
            <FormField label="Kategoriya">
              {(props) => (
                <Select
                  {...props}
                  onChange={(event) => {
                    setCategory(event.target.value);
                    setOffset(0);
                  }}
                  value={category}
                >
                  <option value="">Barcha kategoriyalar</option>
                  {categories.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </Select>
              )}
            </FormField>
          </div>

          {isGlobalScope ? (
            <div className="w-56">
              <FormField label="Filial">
                {(props) => (
                  <Select
                    {...props}
                    onChange={(event) => {
                      setBranchId(event.target.value);
                      setOffset(0);
                    }}
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

          <div className="w-44">
            <FormField error={rangeError} label="Sana (dan)">
              {(props) => (
                <TextInput
                  {...props}
                  onChange={(event) => {
                    setFrom(event.target.value);
                    setOffset(0);
                  }}
                  type="date"
                  value={from}
                />
              )}
            </FormField>
          </div>

          <div className="w-44">
            <FormField label="Sana (gacha)">
              {(props) => (
                <TextInput
                  {...props}
                  onChange={(event) => {
                    setTo(event.target.value);
                    setOffset(0);
                  }}
                  type="date"
                  value={to}
                />
              )}
            </FormField>
          </div>
        </FilterBar>

        <DataTable
          caption="Xarajatlar ro'yxati"
          columns={columns}
          emptyDescription={
            rangeError
              ? "Sana oralig'ini to'g'rilang."
              : "Filtrni o'zgartiring yoki yangi xarajat qo'shing."
          }
          emptyIcon="banknote"
          emptyTitle={rangeError ? "Oraliq noto'g'ri" : "Xarajat topilmadi"}
          getRowKey={(expense) => expense.id}
          isLoading={isLoading}
          rows={expenses}
        />

        <Pagination
          count={expenses.length}
          isLoading={isLoading}
          noun="xarajat"
          offset={offset}
          onOffsetChange={setOffset}
          pageSize={pageSize}
        />
      </Card>

      <Card>
        <CardHeader actions={canCreate && selectedCategoryIds.length ? <Button onClick={() => void permanentlyDeleteCategories()} variant="danger">{selectedCategoryIds.length} ta o'chirish</Button> : undefined} description="Faol kategoriyalar; arxivlash eski xarajatlarni o'zgartirmaydi" title="Xarajat kategoriyalari" />
        <DataTable
          caption="Xarajat kategoriyalari"
          selectable={canCreate}
          selectedKeys={selectedCategoryIds}
          onSelectionChange={setSelectedCategoryIds}
          columns={[
            { key: "name", header: "Nomi", primary: true, render: (item: ExpenseCategory) => item.name },
            { key: "branch", header: "Filial", render: (item: ExpenseCategory) => item.branch?.name ?? "—" },
          ]}
          emptyDescription="Yangi xarajat yozishdan oldin kategoriya qo'shing."
          emptyIcon="folder"
          emptyTitle="Faol kategoriya yo'q"
          getRowKey={(item) => item.id}
          {...(canCreate ? { rowActions: (item: ExpenseCategory) => (
            <>
              <RowAction icon="pencil" label="Kategoriyani tahrirlash" onClick={() => openCategoryForm(item)} />
              <RowAction icon="trash" label="Kategoriyani arxivlash" onClick={() => void archiveCategory(item)} tone="danger" />
            </>
          ) } : {})}
          rows={categoryRecords}
        />
        <CardBody>
          <p className="text-sm text-mz-text-muted">
            Xarajat yozuvlari moliyaviy tarix sifatida o&apos;zgarmaydi. Kategoriya
            nomini tahrirlash yoki arxivlash oldingi xarajatlardagi snapshot nomini saqlaydi.
          </p>
        </CardBody>
      </Card>

      <Modal
        description="Xarajat yozilgandan keyin o'zgartirilmaydi — moliyaviy yozuvlar yaxlitligi uchun."
        dismissOnBackdrop={false}
        footer={
          <>
            <Button onClick={() => setIsFormOpen(false)} variant="ghost">
              Bekor qilish
            </Button>
            <Button
              form="expense-form"
              isLoading={isSaving}
              size="lg"
              type="submit"
            >
              Yozish
            </Button>
          </>
        }
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title="Yangi xarajat"
      >
        <form
          className="grid gap-3"
          id="expense-form"
          onSubmit={submit}
          ref={formRef}
        >
          {isGlobalScope ? (
            <FormField
              {...(errors.branchId ? { error: errors.branchId } : {})}
              hint="Xarajat shu filialning hisobiga yoziladi."
              label="Filial"
              required
            >
              {(props) => (
                <Select
                  {...props}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      branchId: event.target.value,
                      /* Filial o'zgarsa, boshqa filial smenasi yaroqsiz. */
                      shiftId: "",
                      category: "",
                    })
                  }
                  value={form.branchId}
                >
                  <option value="">Tanlang…</option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </Select>
              )}
            </FormField>
          ) : null}

          <FormField
            {...(errors.category ? { error: errors.category } : {})}
            hint={selectableExpenseCategories.length ? "Faqat shu filialning faol kategoriyalari" : "Avval Kategoriyalar bo'limida kategoriya qo'shing"}
            label="Kategoriya"
            required
          >
            {(props) => (
              <Select
                {...props}
                onChange={(event) =>
                  setForm({ ...form, category: event.target.value })
                }
                value={form.category}
              >
                <option value="">Tanlang…</option>
                {selectableExpenseCategories.map((value) => (
                  <option key={value} value={value}>{value}</option>
                ))}
              </Select>
            )}
          </FormField>

          <div className="grid gap-3 sm:grid-cols-2">
            <FormField
              {...(errors.amount ? { error: errors.amount } : {})}
              label="Summa"
              required
            >
              {(props) => (
                <TextInput
                  {...props}
                  inputMode="decimal"
                  min={1}
                  onChange={(event) =>
                    setForm({ ...form, amount: event.target.value })
                  }
                  step="0.01"
                  type="number"
                  value={form.amount}
                />
              )}
            </FormField>

            <FormField
              {...(errors.expenseDate ? { error: errors.expenseDate } : {})}
              label="Xarajat sanasi"
              required
            >
              {(props) => (
                <TextInput
                  {...props}
                  onChange={(event) =>
                    setForm({ ...form, expenseDate: event.target.value })
                  }
                  type="date"
                  value={form.expenseDate}
                />
              )}
            </FormField>
          </div>

          {canSeeShifts && selectableShifts.length > 0 ? (
            <FormField
              {...(errors.shiftId ? { error: errors.shiftId } : {})}
              hint="Faqat OCHIQ smena tanlanadi — yopilgan smenaga xarajat qo'shilmaydi."
              label="Smena"
            >
              {(props) => (
                <Select
                  {...props}
                  onChange={(event) =>
                    setForm({ ...form, shiftId: event.target.value })
                  }
                  value={form.shiftId}
                >
                  <option value="">Bog&apos;lanmasin</option>
                  {selectableShifts.map((shift) => (
                    <option key={shift.id} value={shift.id}>
                      #{shift.shiftNumber}
                      {shift.employee
                        ? ` · ${[shift.employee.firstName, shift.employee.lastName].filter(Boolean).join(" ")}`
                        : ""}
                    </option>
                  ))}
                </Select>
              )}
            </FormField>
          ) : null}

          <FormField
            {...(errors.description ? { error: errors.description } : {})}
            label="Izoh"
          >
            {(props) => (
              <Textarea
                {...props}
                maxLength={500}
                onChange={(event) =>
                  setForm({ ...form, description: event.target.value })
                }
                value={form.description}
              />
            )}
          </FormField>

          <p className={`text-[13px] text-mz-text-muted ${numberCell}`}>
            {form.amount && Number(form.amount) > 0
              ? `Yoziladigan summa: ${formatMoney(form.amount)}`
              : ""}
          </p>
        </form>
      </Modal>

      <Modal
        description="Kategoriya filialga tegishli; arxivlangan nom yangi xarajatlarda tanlanmaydi."
        footer={
          <>
            <Button onClick={() => setIsCategoryOpen(false)} variant="ghost">Bekor qilish</Button>
            <Button form="expense-category-form" isLoading={isCategorySaving} type="submit">Saqlash</Button>
          </>
        }
        isOpen={isCategoryOpen}
        onClose={() => setIsCategoryOpen(false)}
        title={categoryForm.id ? "Kategoriyani tahrirlash" : "Yangi kategoriya"}
      >
        <form className="grid gap-3" id="expense-category-form" onSubmit={saveCategory}>
          {isGlobalScope && !categoryForm.id ? (
            <FormField label="Filial" required>
              {(props) => (
                <Select {...props} onChange={(event) => setCategoryForm({ ...categoryForm, branchId: event.target.value })} value={categoryForm.branchId}>
                  <option value="">Tanlang…</option>
                  {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
                </Select>
              )}
            </FormField>
          ) : null}
          <FormField {...(categoryError ? { error: categoryError } : {})} label="Kategoriya nomi" required>
            {(props) => (
              <TextInput {...props} autoFocus maxLength={80} onChange={(event) => setCategoryForm({ ...categoryForm, name: event.target.value })} value={categoryForm.name} />
            )}
          </FormField>
        </form>
      </Modal>
    </div>
  );
}
