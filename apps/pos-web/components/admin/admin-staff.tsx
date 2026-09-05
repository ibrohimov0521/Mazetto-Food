"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "../admin-ui/button";
import { TextInput } from "../admin-ui/form";
import { apiFetch, SessionExpiredError } from "../../lib/api";
import { isSuperAdminStaff, resolveStaffActionBlock } from "../../lib/staff-guards";
import { useAuth } from "../auth/auth-provider";
import { Badge as UiBadge } from "../admin-ui/badge";
import { ButtonLink, GuardedButton } from "../admin-ui/button";
import { Card } from "../admin-ui/card";
import { DataTable, type DataTableColumn } from "../admin-ui/data-table";
import { ErrorState } from "../admin-ui/feedback";
import { FilterBar } from "../admin-ui/form";
import { useToast } from "../admin-ui/toast";

type Role = {
  id: string;
  code: string;
  name: string;
};

type Branch = {
  id: string;
  code: string;
  name: string;
  address?: string | null;
};

type Staff = {
  id: string;
  email?: string | null;
  phone?: string | null;
  displayName?: string | null;
  isActive: boolean;
  lastLoginAt?: string | null;
  createdAt: string;
  employee?: {
    id: string;
    branchId: string;
    employeeCode: string;
    status: string;
    branch?: Branch | null;
  } | null;
  roles: Role[];
};

type StaffFormState = {
  name: string;
  email: string;
  phone: string;
  password: string;
  roleCode: string;
  branchId: string;
  isActive: boolean;
};

const branchScopedRoles = new Set(["ADMIN", "BRANCH_MANAGER", "CASHIER", "WAITER", "KITCHEN"]);
const formatter = new Intl.DateTimeFormat("uz-UZ", { dateStyle: "medium", timeStyle: "short" });

export function AdminStaffPage() {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("ALL");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      setStaff(await apiFetch<Staff[]>("/staff"));
    } catch (caught) {
      if (caught instanceof SessionExpiredError) {
        return;
      }

      setError("Xodimlar ro'yxatini yuklab bo'lmadi.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return staff.filter((item) => {
      const identity = [
        item.displayName,
        item.email,
        item.phone,
        item.roles.map((role) => role.code).join(" "),
        item.employee?.branch?.name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      const matchesStatus =
        status === "ALL" ||
        (status === "ACTIVE" && item.isActive) ||
        (status === "BLOCKED" && !item.isActive);

      return (!needle || identity.includes(needle)) && matchesStatus;
    });
  }, [query, staff, status]);

  const columns: DataTableColumn<Staff>[] = [
    {
      key: "staff",
      header: "Xodim",
      primary: true,
      render: (item) => (
        <div className="min-w-0">
          <p className="truncate font-semibold text-mz-text">
            {item.displayName ?? item.email ?? item.phone ?? "Xodim"}
          </p>
          <p className="truncate text-xs text-mz-text-muted">
            {[item.email, item.phone].filter(Boolean).join(" · ") || "Login kiritilmagan"}
          </p>
        </div>
      ),
    },
    {
      key: "roles",
      header: "Rol",
      render: (item) => (
        <div className="flex flex-wrap justify-end gap-1 md:justify-start">
          {item.roles.map((role) => (
            <UiBadge key={role.id} tone={role.code === "SUPER_ADMIN" ? "warning" : "info"}>
              {role.code}
            </UiBadge>
          ))}
        </div>
      ),
    },
    {
      key: "branch",
      header: "Filial",
      render: (item) => item.employee?.branch?.name ?? "Global",
    },
    {
      key: "status",
      header: "Holat",
      render: (item) => (
        <UiBadge tone={item.isActive ? "success" : "danger"} withDot>
          {item.isActive ? "Faol" : "Bloklangan"}
        </UiBadge>
      ),
    },
    {
      key: "created",
      header: "Yaratilgan",
      hideOnMobile: true,
      render: (item) => (
        <span className="text-xs text-mz-text-muted">{formatDate(item.createdAt)}</span>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (item) => (
        <ButtonLink href={`/admin/staff/${item.id}`} size="sm" variant="ghost">
          Ochish
        </ButtonLink>
      ),
    },
  ];

  return (
    <div className="grid gap-5">
      {error ? <ErrorState message={error} onRetry={() => void load()} /> : null}

      <Card>
        <FilterBar>
          <div className="min-w-52 flex-1">
            <TextInput
              aria-label="Xodimlarni qidirish"
              placeholder="Ism, telefon, email yoki rol"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <div className="w-44">
            <Select
              aria-label="Holat bo'yicha filtr"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="ALL">Barcha holatlar</option>
              <option value="ACTIVE">Faol</option>
              <option value="BLOCKED">Bloklangan</option>
            </Select>
          </div>
          <ButtonLink href="/admin/staff/new">Yangi xodim</ButtonLink>
        </FilterBar>

        <DataTable
          caption="Xodimlar ro'yxati"
          columns={columns}
          emptyDescription="Qidiruv yoki filtrni o'zgartirib ko'ring."
          emptyTitle="Mos xodim topilmadi"
          getRowKey={(item) => item.id}
          isLoading={isLoading}
          rows={filtered}
        />
      </Card>

      <OwnPasswordPanel />
    </div>
  );
}

export function AdminStaffEditor({ staffId }: { staffId?: string }) {
  const isNew = !staffId;
  const router = useRouter();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [roles, setRoles] = useState<Role[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [allStaff, setAllStaff] = useState<Staff[]>([]);
  const [staff, setStaff] = useState<Staff | null>(null);
  const [passwordReset, setPasswordReset] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [form, setForm] = useState<StaffFormState>({
    name: "",
    email: "",
    phone: "",
    password: "",
    roleCode: "CASHIER",
    branchId: "",
    isActive: true,
  });

  useEffect(() => {
    async function load() {
      /*
       * `/staff` ham yuklanadi: "oxirgi faol SUPER_ADMIN" qoidasini
       * tekshirish uchun umumiy ro'yxat kerak (lib/staff-guards.ts).
       */
      const [nextRoles, nextBranches, nextAllStaff] = await Promise.all([
        apiFetch<Role[]>("/roles"),
        apiFetch<Branch[]>("/branches"),
        apiFetch<Staff[]>("/staff"),
      ]);
      setRoles(nextRoles);
      setBranches(nextBranches);
      setAllStaff(nextAllStaff);

      if (staffId) {
        const nextStaff = await apiFetch<Staff>(`/staff/${staffId}`);
        const primaryRole = nextStaff.roles[0]?.code ?? "CASHIER";
        setStaff(nextStaff);
        setForm({
          name: nextStaff.displayName ?? "",
          email: nextStaff.email ?? "",
          phone: nextStaff.phone ?? "",
          password: "",
          roleCode: primaryRole,
          branchId: nextStaff.employee?.branchId ?? "",
          isActive: nextStaff.isActive,
        });
      } else {
        setForm((current) => ({
          ...current,
          branchId: nextBranches[0]?.id ?? "",
        }));
      }
    }

    void load().catch(() => setError("Forma ma'lumotlarini yuklab bo'lmadi."));
  }, [staffId]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("Saqlanmoqda...");

    try {
      if (isNew) {
        const created = await apiFetch<Staff>("/staff", {
          method: "POST",
          body: JSON.stringify({
            name: form.name.trim(),
            email: form.email.trim() || undefined,
            phone: form.phone.trim() || undefined,
            password: form.password,
            roleCode: form.roleCode,
            branchId: needsBranch(form.roleCode) ? form.branchId : undefined,
            isActive: form.isActive,
          }),
        });
        setMessage("Xodim yaratildi.");
        setStaff(created);
        router.replace(`/admin/staff/${created.id}`);
        return;
      }

      if (!staff) {
        throw new Error("Xodim ma'lumotlari hali yuklanmagan.");
      }

      let nextStaff: Staff = staff;
      const currentRole = staff?.roles[0]?.code;

      if (currentRole && currentRole !== form.roleCode) {
        nextStaff = await apiFetch<Staff>(`/staff/${staffId}/role`, {
          method: "PATCH",
          body: JSON.stringify({
            roleCode: form.roleCode,
            branchId: needsBranch(form.roleCode) ? form.branchId : null,
          }),
        });
      }

      nextStaff = await apiFetch<Staff>(`/staff/${staffId}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim() || null,
          phone: form.phone.trim() || null,
          branchId:
            currentRole === form.roleCode
              ? needsBranch(form.roleCode)
                ? form.branchId
                : null
              : undefined,
        }),
      });

      if (nextStaff.isActive !== form.isActive) {
        nextStaff = await apiFetch<Staff>(`/staff/${staffId}/status`, {
          method: "PATCH",
          body: JSON.stringify({ isActive: form.isActive }),
        });
      }

      setStaff(nextStaff);
      setMessage("Xodim ma'lumotlari saqlandi.");
    } catch (saveError) {
      setMessage("");
      setError(saveError instanceof Error ? saveError.message : "Saqlashda xatolik yuz berdi.");
    }
  }

  async function resetPassword() {
    if (!staffId || passwordReset.length < 8) {
      setError("Yangi parol kamida 8 belgidan iborat bo'lishi kerak.");
      return;
    }

    try {
      await apiFetch(`/staff/${staffId}/password-reset`, {
        method: "POST",
        body: JSON.stringify({ newPassword: passwordReset }),
      });
      setPasswordReset("");
      setMessage("Parol reset qilindi. Xodim yangi parol bilan qayta kiradi.");
      showToast("Parol reset qilindi. Xodimning barcha sessiyalari bekor qilindi.", "success");
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : "Parol reset qilinmadi.");
    }
  }

  /*
   * RBAC staff_security_contract — UI qatlami.
   * Haqiqiy cheklov backend'da; bu yerda foydalanuvchi sababni oldindan ko'radi.
   */
  const roleChangeBlock = staff
    ? resolveStaffActionBlock({ actor: user, target: staff, action: "role", allStaff })
    : null;
  const statusChangeBlock = staff
    ? resolveStaffActionBlock({ actor: user, target: staff, action: "status", allStaff })
    : null;
  const passwordResetBlock = staff
    ? resolveStaffActionBlock({ actor: user, target: staff, action: "password", allStaff })
    : null;
  const isProtectedSuperAdmin = staff ? isSuperAdminStaff(staff) : false;

  return (
    <div className="grid gap-5">
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {message ? <Notice>{message}</Notice> : null}
      <form className="grid gap-5 lg:grid-cols-[1fr_320px]" onSubmit={save}>
        <section className="grid gap-4 rounded-mz-card border border-mz-border bg-mz-surface p-5 shadow-mz-card">
          <Field label="Ism familiya">
            <TextInput value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
          </Field>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Email">
              <TextInput type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
            </Field>
            <Field label="Telefon">
              <TextInput placeholder="+998901234567" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
            </Field>
          </div>
          {isNew ? (
            <Field label="Boshlang'ich parol">
              <TextInput minLength={8} type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required />
            </Field>
          ) : null}
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Rol">
              <Select
                disabled={Boolean(roleChangeBlock)}
                value={form.roleCode}
                onChange={(event) => setForm({ ...form, roleCode: event.target.value })}
              >
                {roles.map((role) => (
                  <option key={role.id} value={role.code}>
                    {role.name} ({role.code})
                  </option>
                ))}
              </Select>
              {roleChangeBlock ? (
                <p className="text-xs font-semibold text-mz-warning">{roleChangeBlock}</p>
              ) : !isNew ? (
                <p className="text-xs font-normal text-mz-text-muted">
                  Rol o'zgarsa, xodimning barcha sessiyalari bekor qilinadi.
                </p>
              ) : null}
            </Field>
            <Field label="Filial">
              <Select
                disabled={!needsBranch(form.roleCode)}
                value={form.branchId}
                onChange={(event) => setForm({ ...form, branchId: event.target.value })}
              >
                <option value="">Global</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name} · {branch.address ?? branch.code}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="grid gap-1.5">
            <Check
              checked={form.isActive}
              disabled={Boolean(statusChangeBlock)}
              label={form.isActive ? "Faol account" : "Bloklangan account"}
              onChange={(checked) => setForm({ ...form, isActive: checked })}
            />
            {statusChangeBlock ? (
              <p className="text-xs font-semibold text-mz-warning">{statusChangeBlock}</p>
            ) : !isNew ? (
              <p className="text-xs text-mz-text-muted">
                Bloklansa, xodimning barcha sessiyalari bekor qilinadi.
              </p>
            ) : null}
          </div>
        </section>

        <aside className="grid content-start gap-4">
          <section className="rounded-mz-card border border-mz-border bg-mz-surface p-5 shadow-mz-card">
            <p className="text-sm font-black text-mz-text">Xavfsizlik</p>
            <p className="mt-2 text-sm leading-6 text-mz-text-muted">
              Parol hash ko'rinishida saqlanadi. Bu sahifada parol hash yoki token ko'rsatilmaydi.
            </p>
            {isProtectedSuperAdmin ? (
              <div className="mt-3 rounded-mz-control bg-mz-warning-bg px-3 py-2">
                <p className="text-xs font-bold text-mz-warning">
                  Bu SUPER_ADMIN accounti — himoyalangan qoidalar amal qiladi.
                </p>
              </div>
            ) : null}
          </section>
          {!isNew ? (
            <section className="grid gap-3 rounded-mz-card border border-mz-border bg-mz-surface p-5 shadow-mz-card">
              <p className="text-sm font-black text-mz-text">Parol reset</p>
              <TextInput
                disabled={Boolean(passwordResetBlock)}
                minLength={8}
                placeholder="Yangi vaqtinchalik parol"
                type="password"
                value={passwordReset}
                onChange={(event) => setPasswordReset(event.target.value)}
              />
              <GuardedButton
                blockedReason={passwordResetBlock}
                onClick={() => void resetPassword()}
                size="sm"
                variant="ghost"
              >
                Parolni reset qilish
              </GuardedButton>
              {passwordResetBlock ? (
                <p className="text-xs font-semibold text-mz-warning">{passwordResetBlock}</p>
              ) : (
                <p className="text-xs text-mz-text-muted">
                  Reset qilinsa, xodimning barcha sessiyalari bekor qilinadi.
                </p>
              )}
            </section>
          ) : null}
        </aside>

        <div className="flex flex-wrap justify-end gap-3 lg:col-span-2">
          <Link className="rounded-mz-control border border-mz-border px-5 py-3 text-sm font-black text-mz-text-muted" href="/admin/staff">
            Bekor qilish
          </Link>
          <Button type="submit">Saqlash</Button>
        </div>
      </form>
    </div>
  );
}

function OwnPasswordPanel() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    try {
      await apiFetch("/staff/me/password", {
        method: "POST",
        body: JSON.stringify({ currentPassword, newPassword, confirmation }),
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmation("");
      setMessage("Parolingiz yangilandi. Keyingi kirishda yangi paroldan foydalaning.");
    } catch (passwordError) {
      setError(passwordError instanceof Error ? passwordError.message : "Parol o'zgartirilmadi.");
    }
  }

  return (
    <form className="grid gap-3 rounded-mz-card border border-mz-border bg-mz-surface p-5 shadow-mz-card lg:grid-cols-[1fr_1fr_1fr_auto]" onSubmit={submit}>
      <TextInput placeholder="Joriy parol" type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required />
      <TextInput placeholder="Yangi parol" type="password" minLength={8} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required />
      <TextInput placeholder="Yangi parolni takrorlang" type="password" minLength={8} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} required />
      <Button type="submit">Parolni yangilash</Button>
      {message ? <p className="text-sm font-bold text-mz-info lg:col-span-4">{message}</p> : null}
      {error ? <p className="text-sm font-bold text-mz-danger lg:col-span-4">{error}</p> : null}
    </form>
  );
}

function needsBranch(roleCode: string): boolean {
  return branchScopedRoles.has(roleCode);
}

function formatDate(value?: string | null): string {
  return value ? formatter.format(new Date(value)) : "Mavjud emas";
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-2 text-sm font-black text-mz-text">
      {label}
      {children}
    </label>
  );
}

function Check({
  label,
  checked,
  onChange,
  disabled = false,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label
      className={`inline-flex w-fit items-center gap-2 rounded-mz-control border border-mz-border px-4 py-3 text-sm font-black text-mz-text ${
        disabled ? "cursor-not-allowed opacity-60" : ""
      }`}
    >
      <input
        checked={checked}
        className="h-4 w-4 accent-mz-accent"
        disabled={disabled}
        type="checkbox"
        onChange={(event) => onChange(event.target.checked)}
      />
      {label}
    </label>
  );
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className="w-full rounded-mz-control border border-mz-border bg-mz-surface px-4 py-3 text-sm font-bold text-mz-text outline-none transition focus:border-mz-accent focus:ring-4 focus:ring-mz-info-bg disabled:cursor-not-allowed disabled:bg-mz-surface-sunken disabled:text-mz-text-faint"
    />
  );
}


function Notice({ children, tone = "success" }: { children: React.ReactNode; tone?: "success" | "danger" }) {
  return (
    <div className={`rounded-mz-control px-4 py-3 text-sm font-bold ${tone === "danger" ? "bg-mz-danger-bg text-mz-danger" : "bg-mz-info-bg text-mz-info"}`}>
      {children}
    </div>
  );
}
