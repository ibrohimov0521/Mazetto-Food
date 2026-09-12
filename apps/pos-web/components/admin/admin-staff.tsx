"use client";

import {
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { apiFetch, SessionExpiredError } from "../../lib/api";
import { useApiResource } from "../../lib/use-api-resource";
import { canSwitchBranch } from "../../lib/admin-nav";
import {
  isSuperAdminStaff,
  resolveStaffActionBlock,
} from "../../lib/staff-guards";
import { useAuth } from "../auth/auth-provider";
import { Badge as UiBadge } from "../admin-ui/badge";
import { Button, ButtonLink, GuardedButton } from "../admin-ui/button";
import { Card, CardHeader } from "../admin-ui/card";
import { DataTable, type DataTableColumn } from "../admin-ui/data-table";
import { ErrorState, Skeleton, SkeletonRows } from "../admin-ui/feedback";
import { Icon } from "../admin-ui/icon";
import { hasPermission } from "../../lib/auth";
import {
  employeeStatusLabel,
  roleCodeLabel,
  shiftTypeLabel,
} from "./people-branch-labels";
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

/*
 * Xodimning ochiq smenasi = uning KASSASI.
 *
 * BIZNES QOIDASI: bitta xodimda filialda BITTA ochiq smena bo'ladi va u
 * barcha vazifalari (kassir, kuryer, ofitsiant) uchun umumiy kassa
 * hisoblanadi. Backend buni `findFirst({ employeeId, status: OPEN })` bilan
 * ta'minlaydi — smena turi ikkinchi kassa ochish huquqini bermaydi.
 *
 * Bu ma'lumot xodim kartasida FAQAT KO'RISH uchun: smena kassa ekranidan
 * ochiladi va yopiladi, xodim tahrirlagichidan emas.
 */
type OpenShift = {
  id: string;
  shiftNumber: number;
  type: string;
  status: "OPEN" | "CLOSED";
  openedAt: string;
  salesTotal?: string | number;
  cashTotal?: string | number;
  branch?: { id: string; name: string } | null;
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
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("ALL");
  const [branchFilter, setBranchFilter] = useState("ALL");
  const [isPasswordOpen, setIsPasswordOpen] = useState(false);

  /*
   * `useApiResource` qo'lda yozilgan `try/catch` o'rniga: u javob TARTIBI
   * qo'riqchisini beradi. Bu yerda filtrlar brauzerda ishlayotgani uchun
   * poyga ehtimoli kichik, lekin "Qayta urinish" va xato matni endi bitta
   * joyda va butun panel bilan bir xil.
   */
  const {
    data,
    isLoading,
    error,
    reload: load,
  } = useApiResource<Staff[]>(
    () => apiFetch<Staff[]>("/staff"),
    [],
    "Xodimlar ro'yxatini yuklab bo'lmadi.",
  );

  const staff = data ?? [];

  /*
   * Filial filtri FAQAT global rol uchun. Branch-scoped rol baribir
   * `/staff` dan o'z filialidagi xodimlarni oladi (serverda
   * `resolveBranchScope`), ya'ni tanlagich bitta variantdan iborat bo'lardi.
   *
   * DIQQAT: `/staff` da `branchId` so'rov parametri YO'Q — u eng yangi 200
   * yozuvni qaytaradi. Shuning uchun bu filtr ham, qidiruv ham SHU 200
   * yozuv ichida ishlaydi va yorliq buni aytadi.
   */
  const canFilterByBranch = canSwitchBranch(user);

  const branchOptions = useMemo(() => {
    const map = new Map<string, string>();

    for (const item of staff) {
      const branch = item.employee?.branch;

      if (branch) {
        map.set(branch.id, branch.name);
      }
    }

    return [...map.entries()].sort((left, right) =>
      left[1].localeCompare(right[1], "uz"),
    );
  }, [staff]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return staff.filter((item) => {
      const identity = [
        item.displayName,
        item.email,
        item.phone,
        // Kod VA o'zbekcha lavozim bo'yicha qidiriladi: admin "kassir" deb
        // yozganda ham topilishi kerak, faqat "CASHIER" emas.
        item.roles.map((role) => `${role.code} ${roleCodeLabel(role.code)}`).join(" "),
        item.employee?.employeeCode,
        item.employee?.branch?.name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      const matchesStatus =
        status === "ALL" ||
        (status === "ACTIVE" && item.isActive) ||
        (status === "BLOCKED" && !item.isActive);
      const matchesBranch =
        branchFilter === "ALL" ||
        (branchFilter === "GLOBAL" && !item.employee?.branchId) ||
        item.employee?.branchId === branchFilter;

      return (
        (!needle || identity.includes(needle)) && matchesStatus && matchesBranch
      );
    });
  }, [branchFilter, query, staff, status]);

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
          <p className="truncate text-[13px] text-mz-text-muted">
            {[item.email, item.phone].filter(Boolean).join(" · ") ||
              "Login kiritilmagan"}
          </p>
        </div>
      ),
    },
    {
      key: "roles",
      header: "Rollar",
      render: (item) => (
        /*
         * Lavozim nomi, KOD EMAS. Ilgari bu yerda `SUPER_ADMIN`,
         * `BRANCH_MANAGER` kabi xom enum'lar chip bo'lib turardi.
         * Bitta login bir nechta rolni tashishi mumkin — shuning uchun
         * hammasi ko'rsatiladi, birinchisi emas.
         */
        <div className="flex flex-wrap justify-end gap-1 md:justify-start">
          {item.roles.length === 0 ? (
            <UiBadge tone="danger">Rol biriktirilmagan</UiBadge>
          ) : (
            item.roles.map((role) => (
              <UiBadge
                key={role.id}
                tone={role.code === "SUPER_ADMIN" ? "warning" : "info"}
              >
                {roleCodeLabel(role.code)}
              </UiBadge>
            ))
          )}
        </div>
      ),
    },
    {
      key: "branch",
      header: "Filial va kassa",
      render: (item) => (
        <div className="min-w-0">
          <p className="truncate text-mz-text">
            {item.employee?.branch?.name ?? "Global (filialsiz)"}
          </p>
          {item.employee ? (
            <p className="truncate text-[13px] text-mz-text-muted">
              Kassa kodi: {item.employee.employeeCode} ·{" "}
              {employeeStatusLabel(item.employee.status)}
            </p>
          ) : null}
        </div>
      ),
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
        <span className="text-[13px] text-mz-text-muted">
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

  const hasFilters =
    Boolean(query.trim()) || status !== "ALL" || branchFilter !== "ALL";

  if (isLoading && !data) {
    return (
      <div aria-busy="true" className="grid gap-5">
        <span className="sr-only">Yuklanmoqda</span>
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="grid gap-5">
      {error ? <ErrorState message={error} onRetry={load} /> : null}

      <Card>
        <CardHeader
          actions={
            <>
              {/*
                O'Z PAROLINI O'ZGARTIRISH — JOYLASHUVI HAQIDA.

                Bu bo'lim ilgari xodimlar RO'YXATI sahifasining PASTIDA,
                jadval ostida, uchta parol maydoni bilan ochiq turardi: ya'ni
                boshqa odamlarni boshqarish ekranida o'zining shaxsiy
                harakati, va u sahifaning eng asosiy mazmunidan keyin.

                To'g'ri joyi — foydalanuvchi menyusidan ochiladigan PROFIL
                ekrani. Uni QO'SHA OLMADIM: qobiq ichidagi har bir yo'l
                `lib/route-access.ts` dagi matritsada e'lon qilinishi shart
                (aks holda layout `UnknownRoutePanel` chizadi), `lib/*` esa
                boshqa muhandisning fayli va `components/admin-shell/admin-navbar.tsx`
                ham tegilmaydigan ro'yxatda. Ikkalasini ham tahrirlash
                kerak bo'lardi.

                Shuning uchun kelishuv: forma sahifa MAZMUNIDAN CHIQARILIB,
                modal oynaga ko'chirildi va uni sahifa sarlavhasidagi
                ikkinchi darajali tugma ochadi. Endi ro'yxat sahifasida
                o'zga-shaxs va o'z-shaxs harakatlari aralashmaydi, forma esa
                bir bosishda joyida. Profil route'i qo'shilganda bu tugma
                shu modalni emas, o'sha ekranni ochishi kerak.
              */}
              <Button
                onClick={() => setIsPasswordOpen(true)}
                variant="ghost"
              >
                <Icon className="h-4 w-4" name="shield" />
                Parolimni o&apos;zgartirish
              </Button>
              <ButtonLink href="/admin/staff/new" size="lg">
                <Icon className="h-4 w-4" name="plus" />
                Yangi xodim
              </ButtonLink>
            </>
          }
          description={`${staff.length} ta yozuv yuklandi (eng yangi 200 tasi). Qidiruv va filtrlar shu yozuvlar ichida ishlaydi.`}
          title="Xodimlar"
        />

        <FilterBar>
          <div className="min-w-52 flex-1">
            <FormField label="Qidirish">
              {(props) => (
                <TextInput
                  {...props}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Ism, telefon, email, lavozim yoki kassa kodi"
                  value={query}
                />
              )}
            </FormField>
          </div>
          <div className="w-full sm:w-44">
            <FormField label="Holat">
              {(props) => (
                <Select
                  {...props}
                  onChange={(event) => setStatus(event.target.value)}
                  value={status}
                >
                  <option value="ALL">Barcha holatlar</option>
                  <option value="ACTIVE">Faol</option>
                  <option value="BLOCKED">Bloklangan</option>
                </Select>
              )}
            </FormField>
          </div>
          {canFilterByBranch ? (
            <div className="w-full sm:w-52">
              <FormField label="Filial">
                {(props) => (
                  <Select
                    {...props}
                    onChange={(event) => setBranchFilter(event.target.value)}
                    value={branchFilter}
                  >
                    <option value="ALL">Barcha filiallar</option>
                    <option value="GLOBAL">Global (filialsiz)</option>
                    {branchOptions.map(([id, name]) => (
                      <option key={id} value={id}>
                        {name}
                      </option>
                    ))}
                  </Select>
                )}
              </FormField>
            </div>
          ) : null}
          {hasFilters ? (
            <Button
              onClick={() => {
                setQuery("");
                setStatus("ALL");
                setBranchFilter("ALL");
              }}
              variant="ghost"
            >
              Tozalash
            </Button>
          ) : null}
        </FilterBar>

        <DataTable
          caption="Xodimlar ro'yxati"
          columns={columns}
          emptyDescription={
            hasFilters
              ? "Qidiruv yoki filtrni o'zgartirib ko'ring."
              : "Birinchi xodimni qo'shing: unga rol va filial biriktiriladi."
          }
          emptyIcon={hasFilters ? "search" : "users"}
          emptyTitle={hasFilters ? "Mos xodim topilmadi" : "Xodim yo'q"}
          getRowKey={(item) => item.id}
          isLoading={isLoading}
          rows={filtered}
        />
      </Card>

      <OwnPasswordModal
        isOpen={isPasswordOpen}
        onClose={() => setIsPasswordOpen(false)}
      />
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
  /** Sessiyani o'ldiradigan o'zgarishlar ro'yxati — tasdiqlash oynasi uchun. */
  const [pendingSave, setPendingSave] = useState<string[] | null>(null);
  const [isResetOpen, setIsResetOpen] = useState(false);
  /** Xodimning ochiq smenasi (kassasi) — faqat ko'rish uchun. */
  const [openShift, setOpenShift] = useState<OpenShift | null>(null);
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

  /*
   * Ochiq smenani (kassani) yuklash.
   *
   * `GET /shifts` `SHIFT_VIEW_BRANCH` talab qiladi — ADMIN rolida u yo'q,
   * shuning uchun so'rov SHARTLI: ruxsat bo'lmasa blok umuman
   * ko'rsatilmaydi (ruxsat yo'qligi sababli 403 olib, uni xato deb
   * ko'rsatish foydalanuvchini chalg'itardi).
   */
  const canViewShifts = hasPermission(user, "SHIFT_VIEW_BRANCH");
  const employeeId = staff?.employee?.id;

  useEffect(() => {
    if (!canViewShifts || !employeeId) {
      setOpenShift(null);
      return;
    }

    let isCurrent = true;

    void apiFetch<OpenShift[]>(
      `/shifts?employeeId=${employeeId}&status=OPEN&limit=1`,
    )
      .then((shifts) => {
        if (isCurrent) {
          setOpenShift(shifts[0] ?? null);
        }
      })
      .catch(() => {
        // Kassa holati qo'shimcha ma'lumot — forma baribir ishlaydi.
        if (isCurrent) {
          setOpenShift(null);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [canViewShifts, employeeId]);

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

  /*
   * SESSIYA O'LDIRADIGAN O'ZGARISHLAR UCHUN TASDIQLASH.
   *
   * Backend rol o'zgarganda VA account bloklanganda xodimning barcha
   * refresh tokenlarini bekor qiladi (`StaffService` → `revokeSessions`).
   * Ya'ni "Saqlash" bosilishi kassirni smena o'rtasida kassadan chiqarib
   * yuborishi mumkin. Ilgari bu hech qanday savolsiz bajarilardi —
   * ogohlantirish faqat maydon tavsifida matn bo'lib turardi.
   */
  function sessionBreakingConsequences(): string[] {
    if (isNew || !staff) {
      return [];
    }

    const consequences: string[] = [];
    const currentRoles = staff.roles.map((role) => role.code);

    if (!sameRoles(currentRoles, form.roleCodes)) {
      consequences.push(
        "Rollar o'zgaradi — xodimning barcha sessiyalari bekor qilinadi va u qaytadan kirishi kerak bo'ladi.",
      );
    }

    if (staff.isActive && !form.isActive) {
      consequences.push(
        "Account bloklanadi — xodim tizimdan darhol chiqariladi va kassa smenasini davom ettira olmaydi.",
      );
    }

    const currentBranchId = staff.employee?.branchId ?? "";
    const nextBranchId = needsBranch(form.roleCodes) ? form.branchId : "";

    if (currentBranchId !== nextBranchId) {
      consequences.push(
        "Filial o'zgaradi — xodimning kassa yozuvi yangi filialga ko'chiriladi va eski filial ma'lumotlari unga ko'rinmay qoladi.",
      );
    }

    return consequences;
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
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

    const consequences = sessionBreakingConsequences();

    if (consequences.length > 0) {
      setPendingSave(consequences);
      return;
    }

    void save();
  }

  async function save() {
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
      setPendingSave(null);
      showToast("Xodim ma'lumotlari saqlandi.", "success");
    } catch (saveError) {
      if (saveError instanceof SessionExpiredError) {
        return;
      }

      setPendingSave(null);
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

  /** Parol reseti ham barcha sessiyalarni o'ldiradi — tasdiqlashdan o'tadi. */
  function requestPasswordReset() {
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
    setIsResetOpen(true);
  }

  async function resetPassword() {
    if (!staffId) {
      return;
    }

    setIsResetting(true);

    try {
      await apiFetch(`/staff/${staffId}/password-reset`, {
        method: "POST",
        body: JSON.stringify({ newPassword: passwordReset }),
      });
      setPasswordReset("");
      setIsResetOpen(false);
      showToast(
        "Parol reset qilindi. Xodimning barcha sessiyalari bekor qilindi.",
        "success",
      );
    } catch (resetError) {
      if (resetError instanceof SessionExpiredError) {
        return;
      }

      setIsResetOpen(false);
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
      <form className="space-y-5" onSubmit={handleSubmit} ref={formRef}>
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
                      /*
                       * Lavozim nomi, xom kod emas. Doira (filial/global)
                       * tavsifda: aynan shu narsa filial maydonining
                       * majburiyligini belgilaydi.
                       */
                      description={
                        branchScopedRoles.has(role.code)
                          ? "Filial doirasida — filial biriktirilishi shart"
                          : "Global doira — barcha filiallar"
                      }
                      disabled={Boolean(roleChangeBlock)}
                      key={role.id}
                      label={roleCodeLabel(role.code)}
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
                  <p className="text-[13px] font-bold text-mz-warning">
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
                  onClick={requestPasswordReset}
                  variant="ghost"
                >
                  Parolni reset qilish
                </GuardedButton>
              </section>
            ) : null}

            {/*
              KASSA VA SMENA — biznes qoidasini ko'rinadigan qiladi.

              Ilgari xodim kartasida kassa haqida BIR OG'IZ SO'Z YO'Q edi,
              holbuki "bitta xodim = bitta umumiy kassa" tizimning asosiy
              qoidasi. Bu blok faqat o'qish uchun: smena kassa ekranidan
              ochiladi va yopiladi.
            */}
            {!isNew && staff ? (
              <section className="grid gap-2 rounded-mz-card border border-mz-border bg-mz-surface p-5 shadow-mz-card">
                <p className="text-sm font-black text-mz-text">
                  Kassa va smena
                </p>

                {staff.employee ? (
                  <dl className="grid gap-1.5 text-[13px]">
                    <div className="flex flex-wrap justify-between gap-2">
                      <dt className="text-mz-text-muted">Xodim kodi</dt>
                      <dd className="font-semibold text-mz-text">
                        {staff.employee.employeeCode}
                      </dd>
                    </div>
                    <div className="flex flex-wrap justify-between gap-2">
                      <dt className="text-mz-text-muted">Filial</dt>
                      <dd className="text-mz-text">
                        {staff.employee.branch?.name ?? "Biriktirilmagan"}
                      </dd>
                    </div>
                    <div className="flex flex-wrap justify-between gap-2">
                      <dt className="text-mz-text-muted">Yozuv holati</dt>
                      <dd className="text-mz-text">
                        {employeeStatusLabel(staff.employee.status)}
                      </dd>
                    </div>
                  </dl>
                ) : (
                  <p className="text-[13px] text-mz-text-muted">
                    Bu login filialga biriktirilmagan, shuning uchun unda kassa
                    yozuvi yo&apos;q. Filial doirasidagi rol berilsa kassa
                    yozuvi avtomatik yaratiladi.
                  </p>
                )}

                {canViewShifts && staff.employee ? (
                  openShift ? (
                    <div className="mt-1 grid gap-1 rounded-mz-control bg-mz-success-bg px-3 py-2">
                      <p className="text-[13px] font-bold text-mz-success">
                        Ochiq smena №{openShift.shiftNumber} ·{" "}
                        {shiftTypeLabel(openShift.type)}
                      </p>
                      <p className="text-[13px] text-mz-success">
                        {formatDate(openShift.openedAt)} dan beri
                      </p>
                    </div>
                  ) : (
                    <p className="mt-1 rounded-mz-control bg-mz-surface-sunken px-3 py-2 text-[13px] text-mz-text-muted">
                      Hozir ochiq smena yo&apos;q.
                    </p>
                  )
                ) : null}

                <p className="text-[13px] text-mz-text-muted">
                  Xodimning filialda bitta ochiq smenasi bo&apos;ladi va u
                  barcha vazifalari uchun umumiy kassa hisoblanadi. Smena kassa
                  ekranidan ochiladi — bu yerdan emas.
                </p>

                {canViewShifts ? (
                  <ButtonLink href="/admin/shifts" variant="ghost">
                    Smenalar tarixi
                  </ButtonLink>
                ) : null}
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
            className="mr-auto flex items-center gap-2 text-[13px] font-medium text-mz-text-muted"
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

      {/*
        SESSIYANI O'LDIRADIGAN O'ZGARISHNI TASDIQLASH.
        Oyna aynan nima sodir bo'lishini sanab beradi — umumiy
        "davom etasizmi?" savolidan foydasi ko'proq.
      */}
      <Modal
        footer={
          <>
            <Button onClick={() => setPendingSave(null)} variant="ghost">
              Orqaga
            </Button>
            <Button
              isLoading={isSaving}
              onClick={() => void save()}
              size="lg"
              variant="danger"
            >
              Tasdiqlayman va saqlayman
            </Button>
          </>
        }
        isOpen={pendingSave !== null}
        onClose={() => setPendingSave(null)}
        title="Bu o'zgarish xodimni tizimdan chiqaradi"
      >
        <div className="grid gap-2">
          <p className="text-sm text-mz-text">
            {staff?.displayName ?? "Xodim"} uchun quyidagilar bajariladi:
          </p>
          <ul className="grid gap-1.5">
            {(pendingSave ?? []).map((consequence) => (
              <li
                className="flex items-start gap-2 rounded-mz-control bg-mz-warning-bg px-3 py-2 text-[13px] font-medium text-mz-warning"
                key={consequence}
              >
                <Icon className="mt-0.5 h-4 w-4 shrink-0" name="alert" />
                {consequence}
              </li>
            ))}
          </ul>
          <p className="text-[13px] text-mz-text-muted">
            Agar xodimning ochiq smenasi bo&apos;lsa, uni oldin kassada yopish
            tavsiya etiladi.
          </p>
        </div>
      </Modal>

      {/* Parol reseti ham barcha sessiyalarni bekor qiladi. */}
      <Modal
        footer={
          <>
            <Button onClick={() => setIsResetOpen(false)} variant="ghost">
              Bekor qilish
            </Button>
            <Button
              isLoading={isResetting}
              onClick={() => void resetPassword()}
              size="lg"
              variant="danger"
            >
              Parolni reset qilish
            </Button>
          </>
        }
        isOpen={isResetOpen}
        onClose={() => setIsResetOpen(false)}
        title="Parolni reset qilishni tasdiqlang"
      >
        <div className="grid gap-2">
          <p className="text-sm text-mz-text">
            {staff?.displayName ?? "Xodim"} uchun yangi vaqtinchalik parol
            o&apos;rnatiladi.
          </p>
          <p className="flex items-start gap-2 rounded-mz-control bg-mz-warning-bg px-3 py-2 text-[13px] font-medium text-mz-warning">
            <Icon className="mt-0.5 h-4 w-4 shrink-0" name="alert" />
            Xodimning barcha sessiyalari bekor qilinadi — u darhol tizimdan
            chiqariladi. Yangi parolni unga o&apos;zingiz yetkazishingiz kerak:
            tizim parolni yubormaydi.
          </p>
        </div>
      </Modal>
    </div>
  );
}

/**
 * O'z parolini o'zgartirish — modal forma.
 *
 * `POST /staff/me/password` permission TALAB QILMAYDI (faqat JWT), ya'ni
 * har qanday xodim o'z parolini o'zgartira oladi. Lekin bu modal xodimlar
 * ro'yxatidan ochiladi va u `STAFF_VIEW` ostida — ya'ni kassir bu formaga
 * yetib bora olmaydi. Bu MAVJUD cheklov (ilgari ham shunday edi) va uni
 * to'g'rilash profil route'ini talab qiladi; hisobotda qayd etilgan.
 */
function OwnPasswordModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
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

    if (currentPassword.length < 8) {
      nextErrors.currentPassword = "Joriy parolni kiriting.";
    }

    if (newPassword.length < 8) {
      nextErrors.newPassword = "Parol kamida 8 belgidan iborat bo'lishi kerak.";
    }

    if (newPassword && newPassword === currentPassword) {
      nextErrors.newPassword = "Yangi parol joriy paroldan farq qilishi kerak.";
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
      setErrors({});
      onClose();
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
    <Modal
      description="Bu faqat SIZNING parolingiz. Boshqa xodim paroli uning kartasidan reset qilinadi."
      dismissOnBackdrop={false}
      footer={
        <>
          <Button onClick={onClose} variant="ghost">
            Bekor qilish
          </Button>
          <Button
            form="own-password-form"
            isLoading={isSaving}
            size="lg"
            type="submit"
          >
            Parolni yangilash
          </Button>
        </>
      }
      isOpen={isOpen}
      onClose={onClose}
      title="Parolimni o'zgartirish"
    >
      <form
        className="grid gap-3"
        id="own-password-form"
        onSubmit={submit}
        ref={formRef}
      >
        <FormField
          label="Joriy parol"
          required
          {...(errors.currentPassword ? { error: errors.currentPassword } : {})}
        >
          {(props) => (
            <TextInput
              {...props}
              autoComplete="current-password"
              required
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
            />
          )}
        </FormField>
        <FormField
          hint="Kamida 8 belgi"
          label="Yangi parol"
          required
          {...(errors.newPassword ? { error: errors.newPassword } : {})}
        >
          {(props) => (
            <TextInput
              {...props}
              autoComplete="new-password"
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
              autoComplete="new-password"
              minLength={8}
              required
              type="password"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
            />
          )}
        </FormField>
      </form>
    </Modal>
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

/*
 * Rol belgisini almashtirish.
 *
 * TUZATILDI: ilgari oxirgi rolni olib tashlash urinishi JIMGINA rad
 * etilardi (`nextRoles.length ? nextRoles : form.roleCodes`) — checkbox
 * bosilardi, lekin belgi joyida qolardi va hech qanday sabab ko'rsatilmasdi.
 * Bu "tugma bor, lekin hech narsa qilmaydi" holatining aynan o'zi. Bundan
 * tashqari `validate()` dagi "Kamida bitta rol tanlanishi kerak" xatosi
 * hech qachon ko'rinmasdi, chunki bo'sh holatga yetib bo'lmasdi.
 *
 * Endi belgi HAR DOIM almashadi va bo'sh ro'yxat forma validatsiyasi orqali
 * maydon yonida aytiladi.
 */
function toggleRole(
  form: StaffFormState,
  roleCode: string,
  checked: boolean,
): StaffFormState {
  return {
    ...form,
    roleCodes: checked
      ? [...new Set([...form.roleCodes, roleCode])]
      : form.roleCodes.filter((item) => item !== roleCode),
  };
}

function formatDate(value?: string | null): string {
  return value ? formatter.format(new Date(value)) : "Mavjud emas";
}

/** Iflos (saqlanmagan) holatni aniqlash uchun formaning barqaror surati. */
function snapshotStaffForm(form: StaffFormState): string {
  return JSON.stringify({ ...form, roleCodes: [...form.roleCodes].sort() });
}
