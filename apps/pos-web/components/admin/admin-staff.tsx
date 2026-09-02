"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { EmptyState, PrimaryButton, TextInput } from "../erp/erp-ui";
import { apiFetch } from "../../lib/api";

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

  useEffect(() => {
    void apiFetch<Staff[]>("/staff")
      .then(setStaff)
      .catch(() => setError("Xodimlar ro'yxatini yuklab bo'lmadi."));
  }, []);

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

  return (
    <div className="grid gap-5">
      {error ? <Notice tone="danger">{error}</Notice> : null}
      <section className="grid gap-3 rounded-3xl border border-white/70 bg-white p-4 shadow-[0_18px_60px_rgba(0,84,77,0.10)] lg:grid-cols-[1fr_180px_auto]">
        <TextInput
          placeholder="Ism, telefon, email yoki rol"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <Select value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="ALL">Barcha holatlar</option>
          <option value="ACTIVE">Faol</option>
          <option value="BLOCKED">Bloklangan</option>
        </Select>
        <Link
          className="inline-flex items-center justify-center rounded-2xl bg-[#f7c948] px-4 py-3 text-sm font-black text-[#06433d]"
          href="/admin/staff/new"
        >
          Yangi xodim
        </Link>
      </section>

      <section className="overflow-hidden rounded-3xl border border-white/70 bg-white shadow-[0_18px_60px_rgba(0,84,77,0.10)]">
        <div className="grid grid-cols-[1.4fr_130px_150px_130px_100px] gap-3 border-b border-slate-100 px-4 py-3 text-xs font-black uppercase tracking-wide text-slate-500 max-lg:hidden">
          <span>Xodim</span>
          <span>Rol</span>
          <span>Filial</span>
          <span>Holat</span>
          <span />
        </div>
        {filtered.length ? (
          filtered.map((item) => (
            <article
              className="grid gap-3 border-b border-slate-100 px-4 py-4 last:border-b-0 lg:grid-cols-[1.4fr_130px_150px_130px_100px] lg:items-center"
              key={item.id}
            >
              <div className="min-w-0">
                <h3 className="truncate text-base font-black text-[#083f39]">
                  {item.displayName ?? item.email ?? item.phone ?? "Xodim"}
                </h3>
                <p className="truncate text-xs font-semibold text-slate-500">
                  {[item.email, item.phone].filter(Boolean).join(" · ") || "Login kiritilmagan"}
                </p>
                <p className="mt-1 text-xs font-semibold text-slate-400">
                  Yaratilgan: {formatDate(item.createdAt)}
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {item.roles.map((role) => (
                  <Badge key={role.id} tone={role.code === "SUPER_ADMIN" ? "gold" : "teal"}>
                    {role.code}
                  </Badge>
                ))}
              </div>
              <span className="text-sm font-bold text-slate-600">
                {item.employee?.branch?.name ?? "Global"}
              </span>
              <Badge tone={item.isActive ? "green" : "red"}>
                {item.isActive ? "Faol" : "Bloklangan"}
              </Badge>
              <Link
                className="rounded-2xl border border-[#0c6b60]/20 px-4 py-2 text-center text-sm font-black text-[#0c6b60] hover:bg-[#e6f4ef]"
                href={`/admin/staff/${item.id}`}
              >
                Ochish
              </Link>
            </article>
          ))
        ) : (
          <div className="p-5">
            <EmptyState title="Mos xodim topilmadi." />
          </div>
        )}
      </section>
      <OwnPasswordPanel />
    </div>
  );
}

export function AdminStaffEditor({ staffId }: { staffId?: string }) {
  const isNew = !staffId;
  const router = useRouter();
  const [roles, setRoles] = useState<Role[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
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
      const [nextRoles, nextBranches] = await Promise.all([
        apiFetch<Role[]>("/roles"),
        apiFetch<Branch[]>("/branches"),
      ]);
      setRoles(nextRoles);
      setBranches(nextBranches);

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
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : "Parol reset qilinmadi.");
    }
  }

  return (
    <div className="grid gap-5">
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {message ? <Notice>{message}</Notice> : null}
      <form className="grid gap-5 lg:grid-cols-[1fr_320px]" onSubmit={save}>
        <section className="grid gap-4 rounded-3xl border border-white/70 bg-white p-5 shadow-[0_18px_60px_rgba(0,84,77,0.10)]">
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
              <Select value={form.roleCode} onChange={(event) => setForm({ ...form, roleCode: event.target.value })}>
                {roles.map((role) => (
                  <option key={role.id} value={role.code}>
                    {role.name} ({role.code})
                  </option>
                ))}
              </Select>
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
          <Check
            checked={form.isActive}
            label={form.isActive ? "Faol account" : "Bloklangan account"}
            onChange={(checked) => setForm({ ...form, isActive: checked })}
          />
        </section>

        <aside className="grid content-start gap-4">
          <section className="rounded-3xl border border-white/70 bg-white p-5 shadow-[0_18px_60px_rgba(0,84,77,0.10)]">
            <p className="text-sm font-black text-[#06433d]">Xavfsizlik</p>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Parol hash ko'rinishida saqlanadi. Bu sahifada parol hash yoki token ko'rsatilmaydi.
            </p>
          </section>
          {!isNew ? (
            <section className="grid gap-3 rounded-3xl border border-white/70 bg-white p-5 shadow-[0_18px_60px_rgba(0,84,77,0.10)]">
              <p className="text-sm font-black text-[#06433d]">Parol reset</p>
              <TextInput
                minLength={8}
                placeholder="Yangi vaqtinchalik parol"
                type="password"
                value={passwordReset}
                onChange={(event) => setPasswordReset(event.target.value)}
              />
              <button
                className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-black text-amber-800"
                type="button"
                onClick={() => void resetPassword()}
              >
                Parolni reset qilish
              </button>
            </section>
          ) : null}
        </aside>

        <div className="flex flex-wrap justify-end gap-3 lg:col-span-2">
          <Link className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-black text-slate-600" href="/admin/staff">
            Bekor qilish
          </Link>
          <PrimaryButton type="submit">Saqlash</PrimaryButton>
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
    <form className="grid gap-3 rounded-3xl border border-white/70 bg-white p-5 shadow-[0_18px_60px_rgba(0,84,77,0.10)] lg:grid-cols-[1fr_1fr_1fr_auto]" onSubmit={submit}>
      <TextInput placeholder="Joriy parol" type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required />
      <TextInput placeholder="Yangi parol" type="password" minLength={8} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required />
      <TextInput placeholder="Yangi parolni takrorlang" type="password" minLength={8} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} required />
      <PrimaryButton type="submit">Parolni yangilash</PrimaryButton>
      {message ? <p className="text-sm font-bold text-emerald-700 lg:col-span-4">{message}</p> : null}
      {error ? <p className="text-sm font-bold text-red-700 lg:col-span-4">{error}</p> : null}
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
    <label className="grid gap-2 text-sm font-black text-[#083f39]">
      {label}
      {children}
    </label>
  );
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-black text-[#083f39]">
      <input checked={checked} className="h-4 w-4 accent-emerald-600" type="checkbox" onChange={(event) => onChange(event.target.checked)} />
      {label}
    </label>
  );
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className="w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm font-bold text-neutral-950 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
    />
  );
}

function Badge({ children, tone }: { children: React.ReactNode; tone: "green" | "red" | "teal" | "gold" }) {
  const tones = {
    green: "bg-emerald-100 text-emerald-800",
    red: "bg-red-100 text-red-700",
    teal: "bg-teal-100 text-teal-800",
    gold: "bg-[#fff2b8] text-[#836100]",
  };

  return <span className={`rounded-full px-3 py-1 text-xs font-black ${tones[tone]}`}>{children}</span>;
}

function Notice({ children, tone = "success" }: { children: React.ReactNode; tone?: "success" | "danger" }) {
  return (
    <div className={`rounded-2xl px-4 py-3 text-sm font-bold ${tone === "danger" ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-800"}`}>
      {children}
    </div>
  );
}
