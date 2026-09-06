"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch, SessionExpiredError } from "../../lib/api";
import { canSwitchBranch } from "../../lib/admin-nav";
import { hasPermission } from "../../lib/auth";
import { formatDateTime, formatMoney } from "../../lib/order-display";
import { useAuth } from "../auth/auth-provider";
import { Button } from "../admin-ui/button";
import { Card, CardHeader } from "../admin-ui/card";
import { DataTable, type DataTableColumn } from "../admin-ui/data-table";
import { ErrorState } from "../admin-ui/feedback";
import { FilterBar, FormField, Select, TextInput, Textarea } from "../admin-ui/form";
import { Modal } from "../admin-ui/modal";
import { InfoBox, StatGrid } from "../admin-ui/stat-box";
import { useToast } from "../admin-ui/toast";

/*
 * Xarajatlar.
 *
 * `Expense` modeli va `/reports/expenses` hisoboti bor edi, lekin xarajat
 * YOZISH uchun endpoint yo'q edi — ma'lumot faqat bazaga qo'lda kiritilishi
 * mumkin edi. 4-bosqichda `GET /expenses` va `POST /expenses` qo'shildi.
 *
 * Xarajat ochiq smenaga bog'lansa, u kassa hisob-kitobiga kiradi
 * (`Shift.expensesTotal`). Backend yopilgan smenaga xarajat qo'shishni
 * rad etadi — aks holda yakunlangan hisob buziladi.
 */

type Branch = { id: string; code: string; name: string };

type Expense = {
  id: string;
  category: string;
  amount: string;
  description?: string | null;
  expenseDate: string;
  shiftId?: string | null;
  branch?: { id: string; code: string; name: string } | null;
  employee?: { id: string; firstName: string; lastName?: string | null } | null;
};

type Shift = {
  id: string;
  shiftNumber: number;
  status: "OPEN" | "CLOSED";
  employee?: { firstName: string; lastName?: string | null } | null;
};

const pageSize = 50;

export function AdminExpensesPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const showBranchFilter = canSwitchBranch(user);
  const canCreate = hasPermission(user, "EXPENSE_CREATE");
  const canSeeShifts = hasPermission(user, "SHIFT_VIEW_BRANCH");

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [openShifts, setOpenShifts] = useState<Shift[]>([]);
  const [category, setCategory] = useState("");
  const [branchId, setBranchId] = useState("");
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState({
    category: "",
    amount: "",
    description: "",
    shiftId: "",
  });

  useEffect(() => {
    if (showBranchFilter) {
      void apiFetch<Branch[]>("/branches")
        .then(setBranches)
        .catch(() => undefined);
    }

    void apiFetch<string[]>("/expenses/categories")
      .then(setCategories)
      .catch(() => undefined);

    /*
     * Ochiq smenalar ro'yxati — xarajatni smenaga bog'lash uchun.
     * SHIFT_VIEW_BRANCH bo'lmasa bu bo'lim ko'rsatilmaydi.
     */
    if (canSeeShifts) {
      void apiFetch<Shift[]>("/shifts?status=OPEN&limit=50")
        .then(setOpenShifts)
        .catch(() => undefined);
    }
  }, [canSeeShifts, showBranchFilter]);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError("");

    const params = new URLSearchParams({
      limit: String(pageSize),
      offset: String(offset),
    });

    if (category) params.set("category", category);
    if (branchId) params.set("branchId", branchId);

    try {
      setExpenses(await apiFetch<Expense[]>(`/expenses?${params.toString()}`));
    } catch (caught) {
      if (caught instanceof SessionExpiredError) {
        return;
      }

      setError(caught instanceof Error ? caught.message : "Xarajatlarni yuklab bo'lmadi.");
    } finally {
      setIsLoading(false);
    }
  }, [branchId, category, offset]);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = useMemo(() => {
    const total = expenses.reduce((sum, expense) => sum + Number(expense.amount ?? 0), 0);
    const linkedToShift = expenses.filter((expense) => expense.shiftId).length;
    const uniqueCategories = new Set(expenses.map((expense) => expense.category)).size;

    return { total, linkedToShift, uniqueCategories, count: expenses.length };
  }, [expenses]);

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    const amount = Number(form.amount);

    if (!Number.isFinite(amount) || amount <= 0) {
      showToast("Summa musbat son bo'lishi kerak.", "danger");
      return;
    }

    setIsSaving(true);

    try {
      await apiFetch("/expenses", {
        method: "POST",
        body: JSON.stringify({
          category: form.category.trim(),
          amount,
          description: form.description.trim() || undefined,
          ...(form.shiftId ? { shiftId: form.shiftId } : {}),
        }),
      });
      showToast("Xarajat yozildi.", "success");
      setIsFormOpen(false);
      setForm({ category: "", amount: "", description: "", shiftId: "" });
      setOffset(0);
      await load();
    } catch (caught) {
      if (caught instanceof SessionExpiredError) {
        return;
      }

      showToast(caught instanceof Error ? caught.message : "Xarajat yozilmadi.", "danger");
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
          <p className="truncate font-semibold text-mz-text">{expense.category}</p>
          <p className="truncate text-xs text-mz-text-muted">
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
          ? [expense.employee.firstName, expense.employee.lastName].filter(Boolean).join(" ")
          : "—",
    },
    {
      key: "shift",
      header: "Smena",
      render: (expense) => (expense.shiftId ? "Bog'langan" : "—"),
    },
    {
      key: "amount",
      header: "Summa",
      align: "right",
      render: (expense) => (
        <span className="font-semibold text-mz-text">{formatMoney(expense.amount)}</span>
      ),
    },
  ];

  return (
    <div className="grid gap-5">
      {error ? <ErrorState message={error} onRetry={() => void load()} /> : null}

      <StatGrid>
        <InfoBox label="Ko'rsatilgan xarajat" value={`${stats.count} ta`} />
        <InfoBox label="Summa (sahifada)" tone="brand" value={formatMoney(stats.total)} />
        <InfoBox label="Smenaga bog'langan" value={`${stats.linkedToShift} ta`} />
        <InfoBox label="Kategoriya" value={`${stats.uniqueCategories} ta`} />
      </StatGrid>

      <Card>
        <CardHeader
          actions={
            canCreate ? <Button onClick={() => setIsFormOpen(true)}>Xarajat qo&apos;shish</Button> : undefined
          }
          description="Filial xarajatlari; ochiq smenaga bog'langani kassa hisobiga kiradi"
          title="Xarajatlar"
        />

        <FilterBar>
          <div className="w-56">
            <Select
              aria-label="Kategoriya bo'yicha filtr"
              value={category}
              onChange={(event) => {
                setCategory(event.target.value);
                setOffset(0);
              }}
            >
              <option value="">Barcha kategoriyalar</option>
              {categories.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </Select>
          </div>

          {showBranchFilter ? (
            <div className="w-56">
              <Select
                aria-label="Filial bo'yicha filtr"
                value={branchId}
                onChange={(event) => {
                  setBranchId(event.target.value);
                  setOffset(0);
                }}
              >
                <option value="">Barcha filiallar</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </Select>
            </div>
          ) : null}
        </FilterBar>

        <DataTable
          caption="Xarajatlar ro'yxati"
          columns={columns}
          emptyDescription="Filtrni o'zgartiring yoki yangi xarajat qo'shing."
          emptyTitle="Xarajat topilmadi"
          getRowKey={(expense) => expense.id}
          isLoading={isLoading}
          rows={expenses}
        />

        <div className="flex items-center justify-between gap-3 border-t border-mz-border px-4 py-3">
          <p className="text-xs text-mz-text-muted">
            {offset + 1}–{offset + expenses.length}-xarajat
          </p>
          <div className="flex gap-2">
            <Button
              disabled={offset === 0 || isLoading}
              onClick={() => setOffset((current) => Math.max(0, current - pageSize))}
              size="sm"
              variant="ghost"
            >
              Oldingi
            </Button>
            <Button
              disabled={expenses.length < pageSize || isLoading}
              onClick={() => setOffset((current) => current + pageSize)}
              size="sm"
              variant="ghost"
            >
              Keyingi
            </Button>
          </div>
        </div>
      </Card>

      <Modal
        description="Xarajat yozilgandan keyin o'zgartirilmaydi — moliyaviy yozuvlar yaxlitligi uchun."
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title="Yangi xarajat"
      >
        <form className="grid gap-3" id="expense-form" onSubmit={submit}>
          <FormField hint="Masalan: Kommunal, Transport, Ta'mirlash" label="Kategoriya" required>
            {(props) => (
              <TextInput
                {...props}
                list="expense-categories"
                maxLength={80}
                required
                value={form.category}
                onChange={(event) => setForm({ ...form, category: event.target.value })}
              />
            )}
          </FormField>
          <datalist id="expense-categories">
            {categories.map((value) => (
              <option key={value} value={value} />
            ))}
          </datalist>

          <FormField label="Summa" required>
            {(props) => (
              <TextInput
                {...props}
                min={1}
                required
                type="number"
                value={form.amount}
                onChange={(event) => setForm({ ...form, amount: event.target.value })}
              />
            )}
          </FormField>

          {canSeeShifts && openShifts.length > 0 ? (
            <FormField
              hint="Smena bo'yicha hisobot uchun. Kassa chiqimi alohida qayd etiladi."
              label="Smena"
            >
              {(props) => (
                <Select
                  {...props}
                  value={form.shiftId}
                  onChange={(event) => setForm({ ...form, shiftId: event.target.value })}
                >
                  <option value="">Bog&apos;lanmasin</option>
                  {openShifts.map((shift) => (
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

          <FormField label="Izoh">
            {(props) => (
              <Textarea
                {...props}
                maxLength={500}
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
              />
            )}
          </FormField>
        </form>

        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <Button onClick={() => setIsFormOpen(false)} variant="ghost">
            Bekor qilish
          </Button>
          <Button disabled={isSaving} form="expense-form" type="submit">
            {isSaving ? "Yozilmoqda..." : "Yozish"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
