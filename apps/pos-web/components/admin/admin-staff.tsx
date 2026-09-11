"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { apiFetch, SessionExpiredError } from "../../lib/api";
import {
  isSuperAdminStaff,
  resolveStaffActionBlock,
} from "../../lib/staff-guards";
import { useAuth } from "../auth/auth-provider";
import { Badge as UiBadge } from "../admin-ui/badge";
import { Button, ButtonLink, GuardedButton } from "../admin-ui/button";
import { Card } from "../admin-ui/card";
import { DataTable, type DataTableColumn } from "../admin-ui/data-table";
import { ErrorState, SkeletonRows } from "../admin-ui/feedback";
import {
  Checkbox,
  CheckboxGroup,
  FilterBar,
  focusFirstInvalidField,
  FormField,
  Select,
  TextInput,
} from "../admin-ui/form";
import { Modal } from "../admin-ui/modal";
import { useToast } from "../admin-ui/toast";

/*
 * MAHALLIY PRIMITIVLAR O'CHIRILDI.
 *
 * Bu fayl o'zining `Field`, `Check`, `Select` va `Notice` komponentlarini
 * saqlardi va ularning o'lchamlari `admin-ui` dan boshqacha edi: `py-2`
 * `TextInput` yonida `py-3` mahalliy `select` turardi, checkbox esa 16px
 * edi. Endi hammasi `admin-ui/form` dan keladi.
 */

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
  roleCodes: string[];
  branchId: string;
  isActive: boolean;
};

const branchScopedRoles = new Set([
  "ADMIN",
  "BRANCH_MANAGER",
  "CASHIER",
  "WAITER",
  "KITCHEN",
  "COURIER",
]);
const formatter = new Intl.DateTimeFormat("uz-UZ", {
  dateStyle: "medium",
  timeStyle: "short",
});

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
            {[item.email, item.phone].filter(Boolean).join(" · ") ||
              "Login kiritilmagan"}
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
            <UiBadge
              key={role.id}
              tone={role.code === "SUPER_ADMIN" ? "warning" : "info"}
            >
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
        <span className="text-xs text-mz-text-muted">
          {formatDate(item.createdAt)}
        </span>
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
      {error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : null}

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
  const formRef = useRef<HTMLFormElement>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [allStaff, setAllStaff] = useState<Staff[]>([]);
  const [staff, setStaff] = useState<Staff | null>(null);
  const [passwordReset, setPasswordReset] = useState("");
  const [error, setError] = useState("");
  /*
   * YUKLANISH HOLATI.
   *
   * Ilgari yo'q edi: bo'sh forma darhol render bo'lardi va `/roles`,
   * `/branches` javobi kelmasdan ham "Saqlash" bosilishi mumkin edi —
   * rollar ro'yxati bo'sh, filial tanlanmagan holda POST ketardi.
   */
  const [isLoading, setIsLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [baseline, setBaseline] = useState("");
  const [isDiscardOpen, setIsDiscardOpen] = useState(false);
  const [form, setForm] = useState<StaffFormState>({
    name: "",
    email: "",
    phone: "",
    password: "",
    roleCodes: ["CASHIER"],
    branchId: "",
    isActive: true,
  });

  useEffect(() => {
    async function load() {
      setIsLoading(true);
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
        const nextForm: StaffFormState = {
          name: nextStaff.displayName ?? "",
          email: nextStaff.email ?? "",
          phone: nextStaff.phone ?? "",
          password: "",
          roleCodes: nextStaff.roles.map((role) => role.code),
          branchId: nextStaff.employee?.branchId ?? "",
          isActive: nextStaff.isActive,
        };

        setStaff(nextStaff);
        setForm(nextForm);
        setBaseline(snapshotStaffForm(nextForm));
      } else {
        setForm((current) => {
          const nextForm = {
            ...current,
            branchId: nextBranches[0]?.id ?? "",
          };
          setBaseline(snapshotStaffForm(nextForm));
          return nextForm;
        });
      }
    }

    void load()
      .catch(() => setError("Forma ma'lumotlarini yuklab bo'lmadi."))
      .finally(() => setIsLoading(false));
  }, [reloadKey, staffId]);

  const isDirty = baseline !== "" && snapshotStaffForm(form) !== baseline;

  useEffect(() => {
    if (!isDirty) {
      return;
    }

    function warn(event: BeforeUnloadEvent): void {
      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", warn);

    return () => window.removeEventListener("beforeunload", warn);
  }, [isDirty]);

  /*
   * Validatsiya INLINE — xato aynan aybdor maydon yonida turadi.
   * Toast faqat SERVER javobi uchun.
   */
  function validate(): Record<string, string> {
    const next: Record<string, string> = {};

    if (!form.name.trim()) {
      next.name = "Ism familiya kiritilishi shart.";
    }

    if (isNew && form.password.length < 8) {
      next.password = "Parol kamida 8 belgidan iborat bo'lishi kerak.";
    }

    if (form.roleCodes.length === 0) {
      next.roleCodes = "Kamida bitta rol tanlanishi kerak.";
    }

    if (needsBranch(form.roleCodes) && !form.branchId) {
      next.branchId = "Bu rol uchun filial tanlanishi kerak.";
    }

    return next;
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const nextErrors = validate();
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      window.requestAnimationFrame(() =>
        focusFirstInvalidField(formRef.current),
      );
      return;
    }

    setIsSaving(true);

    try {
      if (isNew) {
        const created = await apiFetch<Staff>("/staff", {
          method: "POST",
          body: JSON.stringify({
            name: form.name.trim(),
            email: form.email.trim() || undefined,
            phone: form.phone.trim() || undefined,
            password: form.password,
            roleCodes: form.roleCodes,
            branchId: needsBranch(form.roleCodes) ? form.branchId : undefined,
            isActive: form.isActive,
          }),
        });
        setStaff(created);
        setBaseline(snapshotStaffForm(form));
        showToast("Xodim yaratildi.", "success");
        router.replace(`/admin/staff/${created.id}`);
        return;
      }

      if (!staff) {
        throw new Error("Xodim ma'lumotlari hali yuklanmagan.");
      }

      let nextStaff: Staff = staff;
      const currentRoles = staff.roles.map((role) => role.code);

      if (!sameRoles(currentRoles, form.roleCodes)) {
        nextStaff = await apiFetch<Staff>(`/staff/${staffId}/role`, {
          method: "PATCH",
          body: JSON.stringify({
            roleCodes: form.roleCodes,
            branchId: needsBranch(form.roleCodes) ? form.branchId : null,
          }),
        });
      }

      nextStaff = await apiFetch<Staff>(`/staff/${staffId}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim() || null,
          phone: form.phone.trim() || null,
          branchId: sameRoles(currentRoles, form.roleCodes)
            ? needsBranch(form.roleCodes)
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
      setBaseline(snapshotStaffForm(form));
      showToast("Xodim ma'lumotlari saqlandi.", "success");
    } catch (saveError) {
      if (saveError instanceof SessionExpiredError) {
        return;
      }

      showToast(
        saveError instanceof Error
          ? saveError.message
          : "Saqlashda xatolik yuz berdi.",
        "danger",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function resetPassword() {
    if (!staffId) {
      return;
    }

    if (passwordReset.length < 8) {
      setErrors((current) => ({
        ...current,
        passwordReset: "Yangi parol kamida 8 belgidan iborat bo'lishi kerak.",
      }));
      window.requestAnimationFrame(() =>
        focusFirstInvalidField(formRef.current),
      );
      return;
    }

    setErrors((current) =>
      Object.fromEntries(
        Object.entries(current).filter(([key]) => key !== "passwordReset"),
      ),
    );
    setIsResetting(true);

    try {
      await apiFetch(`/staff/${staffId}/password-reset`, {
        method: "POST",
        body: JSON.stringify({ newPassword: passwordReset }),
      });
      setPasswordReset("");
      showToast(
        "Parol reset qilindi. Xodimning barcha sessiyalari bekor qilindi.",
        "success",
      );
    } catch (resetError) {
      if (resetError instanceof SessionExpiredError) {
        return;
      }

      showToast(
        resetError instanceof Error
          ? resetError.message
          : "Parol reset qilinmadi.",
        "danger",
      );
    } finally {
      setIsResetting(false);
    }
  }

  /*
   * RBAC staff_security_contract — UI qatlami.
   * Haqiqiy cheklov backend'da; bu yerda foydalanuvchi sababni oldindan ko'radi.
   */
  const roleChangeBlock = staff
    ? resolveStaffActionBlock({
        actor: user,
        target: staff,
        action: "role",
        allStaff,
      })
    : null;
  const statusChangeBlock = staff
    ? resolveStaffActionBlock({
        actor: user,
        target: staff,
        action: "status",
        allStaff,
      })
    : null;
  const passwordResetBlock = staff
    ? resolveStaffActionBlock({
        actor: user,
        target: staff,
        action: "password",
        allStaff,
      })
    : null;
  const isProtectedSuperAdmin = staff ? isSuperAdminStaff(staff) : false;

  if (isLoading) {
    return <SkeletonRows rows={8} />;
  }

  return (
    <div className="grid gap-5">
      {error ? (
        <ErrorState
          message={error}
          onRetry={() => {
            setError("");
            setReloadKey((current) => current + 1);
          }}
        />
      ) : null}
      <form className="space-y-5" onSubmit={save} ref={formRef}>
        <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
          <section className="grid gap-4 rounded-mz-card border border-mz-border bg-mz-surface p-5 shadow-mz-card">
            <FormField
              label="Ism familiya"
              required
              {...(errors.name ? { error: errors.name } : {})}
            >
              {(props) => (
                <TextInput
                  {...props}
                  required
                  value={form.name}
                  onChange={(event) =>
                    setForm({ ...form, name: event.target.value })
                  }
                />
              )}
            </FormField>
            <div className="grid gap-4 md:grid-cols-2">
              <FormField label="Email">
                {(props) => (
                  <TextInput
                    {...props}
                    type="email"
                    value={form.email}
                    onChange={(event) =>
                      setForm({ ...form, email: event.target.value })
                    }
                  />
                )}
              </FormField>
              <FormField label="Telefon">
                {(props) => (
                  <TextInput
                    {...props}
                    placeholder="+998901234567"
                    value={form.phone}
                    onChange={(event) =>
                      setForm({ ...form, phone: event.target.value })
                    }
                  />
                )}
              </FormField>
            </div>
            {isNew ? (
              <FormField
                hint="Kamida 8 belgi"
                label="Boshlang'ich parol"
                required
                {...(errors.password ? { error: errors.password } : {})}
              >
                {(props) => (
                  <TextInput
                    {...props}
                    minLength={8}
                    required
                    type="password"
                    value={form.password}
                    onChange={(event) =>
                      setForm({ ...form, password: event.target.value })
                    }
                  />
                )}
              </FormField>
            ) : null}
            <div className="grid gap-4 md:grid-cols-2">
              {/*
              `<fieldset>` + `<legend>`.

              Ilgari bu guruh `<label>` (mahalliy `Field`) ichida edi va
              ichida yana `<label>` lar turardi: yaroqsiz HTML, va tashqi
              yorliqni bosish birinchi checkbox'ni almashtirib yuborardi.
            */}
              <CheckboxGroup
                legend="Rollar"
                {...(errors.roleCodes ? { error: errors.roleCodes } : {})}
                {...(roleChangeBlock
                  ? { hint: roleChangeBlock }
                  : !isNew
                    ? {
                        hint: "Rol o'zgarsa, xodimning barcha sessiyalari bekor qilinadi.",
                      }
                    : {})}
              >
                <div className="grid gap-1 rounded-mz-control border border-mz-border bg-mz-surface-sunken p-2 sm:grid-cols-2">
                  {roles.map((role) => (
                    <Checkbox
                      checked={form.roleCodes.includes(role.code)}
                      disabled={Boolean(roleChangeBlock)}
                      key={role.id}
                      label={`${role.name} (${role.code})`}
                      onChange={(checked) =>
                        setForm((current) =>
                          toggleRole(current, role.code, checked),
                        )
                      }
                    />
                  ))}
                </div>
              </CheckboxGroup>
              <FormField
                label="Filial"
                {...(errors.branchId ? { error: errors.branchId } : {})}
              >
                {(props) => (
                  <Select
                    {...props}
                    disabled={!needsBranch(form.roleCodes)}
                    value={form.branchId}
                    onChange={(event) =>
                      setForm({ ...form, branchId: event.target.value })
                    }
                  >
                    <option value="">Global</option>
                    {branches.map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name} · {branch.address ?? branch.code}
                      </option>
                    ))}
                  </Select>
                )}
              </FormField>
            </div>
            <Checkbox
              boxed
              checked={form.isActive}
              disabled={Boolean(statusChangeBlock)}
              label={form.isActive ? "Faol account" : "Bloklangan account"}
              onChange={(checked) => setForm({ ...form, isActive: checked })}
              {...(statusChangeBlock
                ? { description: statusChangeBlock }
                : !isNew
                  ? {
                      description:
                        "Bloklansa, xodimning barcha sessiyalari bekor qilinadi.",
                    }
                  : {})}
            />
          </section>

          <aside className="grid content-start gap-4">
            <section className="rounded-mz-card border border-mz-border bg-mz-surface p-5 shadow-mz-card">
              <p className="text-sm font-black text-mz-text">Xavfsizlik</p>
              <p className="mt-2 text-sm leading-6 text-mz-text-muted">
                Parol hash ko'rinishida saqlanadi. Bu sahifada parol hash yoki
                token ko'rsatilmaydi.
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
                <FormField
                  label="Yangi vaqtinchalik parol"
                  {...(errors.passwordReset
                    ? { error: errors.passwordReset }
                    : passwordResetBlock
                      ? { hint: passwordResetBlock }
                      : {
                          hint: "Reset qilinsa, xodimning barcha sessiyalari bekor qilinadi.",
                        })}
                >
                  {(props) => (
                    <TextInput
                      {...props}
                      disabled={Boolean(passwordResetBlock)}
                      minLength={8}
                      type="password"
                      value={passwordReset}
                      onChange={(event) => setPasswordReset(event.target.value)}
                    />
                  )}
                </FormField>
                <GuardedButton
                  blockedReason={passwordResetBlock}
                  isLoading={isResetting}
                  onClick={() => void resetPassword()}
                  variant="ghost"
                >
                  Parolni reset qilish
                </GuardedButton>
              </section>
            ) : null}
          </aside>
        </div>

        {/*
        `position: sticky` uchun MUHIM: yopishqoq element GRID ELEMENTI
        bo'lmasligi kerak. Grid elementining yopishqoq "idishi" — uning
        o'z grid maydoni, ya'ni o'z balandligidagi qator; bunda siljish
        uchun joy qolmaydi va `bottom-0` hech narsa qilmaydi. Shu sababli
        forma oddiy blok konteyner, ustunli setka esa ichki `div`.
      */}
        {/* Yopishqoq harakat paneli + iflos holat ko'rsatkichi. */}
        <div className="sticky bottom-0 z-20 flex flex-wrap items-center justify-end gap-3 rounded-mz-card border border-mz-border bg-mz-surface px-4 py-3 shadow-mz-overlay">
          <p
            aria-live="polite"
            className="mr-auto flex items-center gap-2 text-xs font-medium text-mz-text-muted"
          >
            {isDirty ? (
              <>
                <span
                  aria-hidden="true"
                  className="h-2 w-2 rounded-mz-pill bg-mz-warning-accent"
                />
                Saqlanmagan o&apos;zgarishlar bor
              </>
            ) : (
              "Barcha o'zgarishlar saqlangan"
            )}
          </p>

          <Button
            onClick={() => {
              if (isDirty) {
                setIsDiscardOpen(true);
                return;
              }

              router.push("/admin/staff");
            }}
            variant="ghost"
          >
            Bekor qilish
          </Button>
          <Button
            disabled={!isDirty}
            isLoading={isSaving}
            size="lg"
            type="submit"
          >
            {isSaving ? "Saqlanmoqda" : "Saqlash"}
          </Button>
        </div>
      </form>

      <Modal
        description="Kiritilgan o'zgarishlar saqlanmaydi."
        footer={
          <>
            <Button onClick={() => setIsDiscardOpen(false)} variant="ghost">
              Tahrirlashda qolish
            </Button>
            <Button
              onClick={() => {
                setIsDiscardOpen(false);
                router.push("/admin/staff");
              }}
              variant="danger"
            >
              O&apos;zgarishlarni tashlab ketish
            </Button>
          </>
        }
        isOpen={isDiscardOpen}
        onClose={() => setIsDiscardOpen(false)}
        title="O'zgarishlarni bekor qilasizmi?"
      />
    </div>
  );
}

function OwnPasswordPanel() {
  const { showToast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextErrors: Record<string, string> = {};

    if (newPassword.length < 8) {
      nextErrors.newPassword = "Parol kamida 8 belgidan iborat bo'lishi kerak.";
    }

    if (newPassword !== confirmation) {
      nextErrors.confirmation = "Takroriy parol mos kelmadi.";
    }

    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      window.requestAnimationFrame(() =>
        focusFirstInvalidField(formRef.current),
      );
      return;
    }

    setIsSaving(true);

    try {
      await apiFetch("/staff/me/password", {
        method: "POST",
        body: JSON.stringify({ currentPassword, newPassword, confirmation }),
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmation("");
      showToast(
        "Parolingiz yangilandi. Keyingi kirishda yangi paroldan foydalaning.",
        "success",
      );
    } catch (passwordError) {
      if (passwordError instanceof SessionExpiredError) {
        return;
      }

      showToast(
        passwordError instanceof Error
          ? passwordError.message
          : "Parol o'zgartirilmadi.",
        "danger",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form
      className="grid items-end gap-3 rounded-mz-card border border-mz-border bg-mz-surface p-5 shadow-mz-card lg:grid-cols-[1fr_1fr_1fr_auto]"
      onSubmit={submit}
      ref={formRef}
    >
      <FormField label="Joriy parol" required>
        {(props) => (
          <TextInput
            {...props}
            required
            type="password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
          />
        )}
      </FormField>
      <FormField
        label="Yangi parol"
        required
        {...(errors.newPassword ? { error: errors.newPassword } : {})}
      >
        {(props) => (
          <TextInput
            {...props}
            minLength={8}
            required
            type="password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
          />
        )}
      </FormField>
      <FormField
        label="Yangi parolni takrorlang"
        required
        {...(errors.confirmation ? { error: errors.confirmation } : {})}
      >
        {(props) => (
          <TextInput
            {...props}
            minLength={8}
            required
            type="password"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
          />
        )}
      </FormField>
      <Button isLoading={isSaving} type="submit">
        {isSaving ? "Yangilanmoqda" : "Parolni yangilash"}
      </Button>
    </form>
  );
}

function needsBranch(roleCodes: string[] | string): boolean {
  const codes = Array.isArray(roleCodes) ? roleCodes : [roleCodes];
  return codes.some((roleCode) => branchScopedRoles.has(roleCode));
}

function sameRoles(left: string[], right: string[]): boolean {
  return (
    left.length === right.length && left.every((role) => right.includes(role))
  );
}

function toggleRole(
  form: StaffFormState,
  roleCode: string,
  checked: boolean,
): StaffFormState {
  const nextRoles = checked
    ? [...new Set([...form.roleCodes, roleCode])]
    : form.roleCodes.filter((item) => item !== roleCode);

  return {
    ...form,
    roleCodes: nextRoles.length ? nextRoles : form.roleCodes,
  };
}

function formatDate(value?: string | null): string {
  return value ? formatter.format(new Date(value)) : "Mavjud emas";
}

/** Iflos (saqlanmagan) holatni aniqlash uchun formaning barqaror surati. */
function snapshotStaffForm(form: StaffFormState): string {
  return JSON.stringify({ ...form, roleCodes: [...form.roleCodes].sort() });
}
