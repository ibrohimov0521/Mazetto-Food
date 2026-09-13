"use client";

import { useMemo, useState } from "react";
import { apiFetch, SessionExpiredError } from "../../lib/api";
import { hasPermission } from "../../lib/auth";
import { useApiResource } from "../../lib/use-api-resource";
import { useAuth } from "../auth/auth-provider";
import { Badge } from "../admin-ui/badge";
import { Button, ButtonLink } from "../admin-ui/button";
import { Card, CardBody, CardHeader } from "../admin-ui/card";
import { EmptyState, ErrorState, Skeleton } from "../admin-ui/feedback";
import {
  Checkbox,
  FilterBar,
  FormField,
  Select,
  Textarea,
  TextInput,
} from "../admin-ui/form";
import { Icon } from "../admin-ui/icon";
import { Modal } from "../admin-ui/modal";
import { StatGrid, InfoBox } from "../admin-ui/stat-box";
import { useToast } from "../admin-ui/toast";
import { roleCodeLabel } from "./people-branch-labels";

/*
 * Tizim rollari seed bilan boshqariladi va o'zgartirilmaydi. SUPER_ADMIN
 * alohida nomlangan custom rollarni yaratadi, ularga permission va filial
 * doirasini biriktiradi. Matritsa esa barcha rollarni yonma-yon tekshirish
 * uchun qoladi.
 */

type Permission = {
  id: string;
  code: string;
  name: string;
  description?: string | null;
};

type Role = {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  isSystem: boolean;
  isBranchScoped: boolean;
  permissions: { permission: Permission }[];
};

/*
 * Filial doirasidagi rollar (RBAC core_rules.branch_scoped_roles).
 * Bu ro'yxat `lib/admin-nav.ts` va backend `staff-role-codes.ts` bilan bir xil.
 */
const branchScopedRoleCodes = new Set([
  "ADMIN",
  "BRANCH_MANAGER",
  "CASHIER",
  "WAITER",
  "KITCHEN",
  "COURIER",
]);

/** Permission kodining oldingi bo'lagi — modul bo'yicha guruhlash uchun. */
function permissionGroup(code: string): string {
  if (code === "*") {
    return "BARCHASI";
  }

  return code.split("_")[0] ?? code;
}

export function AdminRolesPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const canManage = hasPermission(user, "ROLE_MANAGE");
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("");
  const [editing, setEditing] = useState<Role | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [roleName, setRoleName] = useState("");
  const [roleDescription, setRoleDescription] = useState("");
  const [isBranchScoped, setIsBranchScoped] = useState(true);
  const [selectedPermissionIds, setSelectedPermissionIds] = useState<string[]>(
    [],
  );
  const [editorQuery, setEditorQuery] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [pendingArchive, setPendingArchive] = useState<Role | null>(null);

  const {
    data,
    isLoading,
    error,
    reload: load,
  } = useApiResource(
    () =>
      Promise.all([
        apiFetch<Role[]>("/roles"),
        apiFetch<Permission[]>("/permissions"),
      ]),
    [],
    "Rollarni yuklab bo'lmadi.",
  );

  const roles = data?.[0] ?? [];
  const permissions = data?.[1] ?? [];

  /*
   * `*` — joker permission (SUPER_ADMIN). U matritsada alohida satr bo'lib
   * turishi noto'g'ri bo'lardi: u BARCHA satrlarni qamrab oladi. Shuning
   * uchun rol bo'yicha joker bayrog'i sifatida saqlanadi va matritsada
   * o'sha ustunning hamma kesishmasi belgilangan bo'ladi.
   */
  const roleHasWildcard = useMemo(
    () =>
      new Map(
        roles.map((role) => [
          role.id,
          role.permissions.some((item) => item.permission.code === "*"),
        ]),
      ),
    [roles],
  );

  const rolePermissionCodes = useMemo(
    () =>
      new Map(
        roles.map((role) => [
          role.id,
          new Set(role.permissions.map((item) => item.permission.code)),
        ]),
      ),
    [roles],
  );

  const groups = useMemo(() => {
    const seen = new Set<string>();

    for (const permission of permissions) {
      if (permission.code !== "*") {
        seen.add(permissionGroup(permission.code));
      }
    }

    return [...seen].sort();
  }, [permissions]);

  const filteredPermissions = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return permissions
      .filter((permission) => permission.code !== "*")
      .filter((permission) => {
        const matchesGroup =
          !group || permissionGroup(permission.code) === group;
        const matchesQuery =
          !needle ||
          [permission.code, permission.name, permission.description]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(needle);

        return matchesGroup && matchesQuery;
      });
  }, [group, permissions, query]);

  const hasFilters = Boolean(query.trim() || group);
  const editorPermissions = permissions
    .filter((permission) => permission.code !== "*")
    .filter((permission) => {
      const needle = editorQuery.trim().toLowerCase();
      return (
        !needle ||
        [permission.name, permission.code, permission.description]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(needle)
      );
    });

  function openCreate(): void {
    setEditing(null);
    setRoleName("");
    setRoleDescription("");
    setIsBranchScoped(true);
    setSelectedPermissionIds([]);
    setEditorQuery("");
    setIsCreating(true);
  }

  function openEdit(role: Role): void {
    setEditing(role);
    setRoleName(role.name);
    setRoleDescription(role.description ?? "");
    setIsBranchScoped(role.isBranchScoped);
    setSelectedPermissionIds(
      role.permissions
        .filter((entry) => entry.permission.code !== "*")
        .map((entry) => entry.permission.id),
    );
    setEditorQuery("");
  }

  function closeEditor(): void {
    if (isSaving) return;
    setEditing(null);
    setIsCreating(false);
  }

  function togglePermission(permissionId: string): void {
    setSelectedPermissionIds((current) =>
      current.includes(permissionId)
        ? current.filter((id) => id !== permissionId)
        : [...current, permissionId],
    );
  }

  async function saveRole(): Promise<void> {
    if (!roleName.trim()) {
      showToast("Rol nomini kiriting.", "danger");
      return;
    }
    setIsSaving(true);
    try {
      const body = JSON.stringify({
        name: roleName.trim(),
        description: roleDescription.trim(),
        permissionIds: selectedPermissionIds,
        isBranchScoped,
      });
      await apiFetch(editing ? `/roles/${editing.id}` : "/roles", {
        method: editing ? "PATCH" : "POST",
        body,
      });
      showToast(editing ? "Maxsus rol yangilandi." : "Maxsus rol yaratildi.", "success");
      setEditing(null);
      setIsCreating(false);
      load();
    } catch (caught) {
      if (caught instanceof SessionExpiredError) return;
      showToast(
        caught instanceof Error ? caught.message : "Rolni saqlab bo'lmadi.",
        "danger",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function archiveRole(): Promise<void> {
    if (!pendingArchive) return;
    setIsSaving(true);
    try {
      await apiFetch(`/roles/${pendingArchive.id}`, { method: "DELETE" });
      showToast("Maxsus rol arxivlandi.", "success");
      setPendingArchive(null);
      load();
    } catch (caught) {
      if (caught instanceof SessionExpiredError) return;
      showToast(
        caught instanceof Error ? caught.message : "Rolni arxivlab bo'lmadi.",
        "danger",
      );
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <div aria-busy="true" className="grid gap-5">
        <span className="sr-only">Yuklanmoqda</span>
        <Skeleton className="h-24 w-full" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((index) => (
            <Skeleton className="h-20 w-full" key={index} />
          ))}
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (error) {
    return <ErrorState message={error} onRetry={load} />;
  }

  return (
    <div className="grid min-w-0 gap-5">
      {/*
        FAQAT O'QISH sababi ANIQ aytiladi. Ilgari izoh "keyingi bosqichda
        qo'shiladi" deb turardi va o'quvchi buni interfeys nuqsoni deb
        o'ylashi mumkin edi.
      */}
      <Card>
        <CardBody>
          <div className="flex flex-wrap items-start gap-3">
            <span
              aria-hidden="true"
              className="mt-0.5 shrink-0 text-mz-info"
            >
              <Icon className="h-5 w-5" name="shield" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-mz-text">
                {canManage
                  ? "Tizim rollari himoyalangan, maxsus rollar boshqariladi"
                  : "Bu ekran faqat ko'rish uchun"}
              </p>
              <p className="mt-1 text-[13px] text-mz-text-muted">
                {canManage
                  ? "Kassir va oshxona kabi tizim rollari o'zgarmaydi. Aniq vazifa uchun kerakli huquqlardan maxsus rol tuzing va uni xodim kartasida biriktiring."
                  : "Rol matritsasini ko'rishingiz mumkin. Maxsus rol yaratish va tahrirlash faqat bosh administratorga ochiq."}
              </p>
            </div>
            <ButtonLink href="/admin/staff" variant="ghost">
              Xodimlarga o&apos;tish
            </ButtonLink>
          </div>
        </CardBody>
      </Card>

      {/*
        BIZNES QOIDALARI ko'rinadigan holga keltirilgan. Rol sozlayotgan odam
        aynan shu uchta qoidani bilishi kerak, aks holda u kassirga global
        rol berib qo'yadi yoki ikkinchi kassa kutadi.
      */}
      <Card>
        <CardHeader
          description="Rol biriktirishda amal qiladigan uchta qoida"
          title="Rol, filial va kassa qoidalari"
        />
        <CardBody className="grid gap-3 md:grid-cols-3">
          <RuleNote
            icon="users"
            text="Bitta login bir vaqtda bir nechta rolni tashishi mumkin — kassir, oshxona, kuryer va ofitsiant birga bo'lishi normal holat."
            title="Bir login, ko'p rol"
          />
          <RuleNote
            icon="building"
            text="Filial doirasidagi rol uchun filial MAJBURIY va xodim boshqa filial ma'lumotini ko'rmaydi. Global rol (bosh administrator, buxgalter) barcha filialni ko'radi."
            title="Filial doirasi"
          />
          <RuleNote
            icon="wallet"
            text="Xodimning filialda bitta ochiq smenasi bo'ladi va u barcha vazifalari uchun umumiy kassa hisoblanadi — kuryer va kassir ishi uchun alohida kassa ochilmaydi."
            title="Bitta umumiy kassa"
          />
        </CardBody>
      </Card>

      <StatGrid>
        <InfoBox
          icon="shield"
          label="Rollar"
          tone="brand"
          value={`${roles.length} ta`}
        />
        <InfoBox
          icon="check"
          label="Permissionlar"
          value={`${permissions.length} ta`}
        />
        <InfoBox
          description="Filial biriktirilishi shart"
          icon="building"
          label="Filial doirasidagi rol"
          value={`${roles.filter((role) => role.isBranchScoped || branchScopedRoleCodes.has(role.code)).length} ta`}
        />
        <InfoBox
          description="Barcha filialni ko'radi"
          icon="globe"
          label="Global rol"
          value={`${roles.filter((role) => !role.isBranchScoped && !branchScopedRoleCodes.has(role.code)).length} ta`}
        />
      </StatGrid>

      {/* --- Rol xulosalari ------------------------------------------------ */}
      <Card className="min-w-0">
        <CardHeader
          actions={
            canManage ? (
              <Button onClick={openCreate}>
                <Icon className="h-4 w-4" name="plus" />
                Yangi maxsus rol
              </Button>
            ) : null
          }
          description="Har rolning huquq hajmi va doirasi"
          title="Rollar"
        />
        <CardBody className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {roles.map((role) => {
            const isWildcard = roleHasWildcard.get(role.id) ?? false;
            const isRoleBranchScoped =
              role.isBranchScoped || branchScopedRoleCodes.has(role.code);

            return (
              <div
                className="grid gap-2 rounded-mz-control border border-mz-border p-3"
                key={role.id}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-mz-text">
                      {roleCodeLabel(role.code)}
                    </p>
                    <p className="truncate font-mono text-[13px] text-mz-text-faint">
                      {role.code}
                    </p>
                  </div>
                  {role.isSystem ? (
                    <Badge tone="warning">Tizim roli</Badge>
                  ) : null}
                </div>

                {role.description ? (
                  <p className="text-[13px] text-mz-text-muted">
                    {role.description}
                  </p>
                ) : null}

                <div className="flex flex-wrap gap-1.5">
                  <Badge tone={isRoleBranchScoped ? "info" : "neutral"}>
                    {isRoleBranchScoped ? "Filial doirasida" : "Global doira"}
                  </Badge>
                  <Badge tone={isWildcard ? "warning" : "neutral"}>
                    {isWildcard
                      ? "Barcha huquqlar"
                      : `${role.permissions.length} ta huquq`}
                  </Badge>
                </div>
                {canManage && !role.isSystem ? (
                  <div className="mt-1 flex flex-wrap gap-2 border-t border-mz-border pt-2">
                    <Button
                      onClick={() => openEdit(role)}
                      size="sm"
                      variant="ghost"
                    >
                      <Icon className="h-4 w-4" name="pencil" />
                      Tahrirlash
                    </Button>
                    <Button
                      onClick={() => setPendingArchive(role)}
                      size="sm"
                      variant="danger"
                    >
                      <Icon className="h-4 w-4" name="trash" />
                      Arxivlash
                    </Button>
                  </div>
                ) : null}
              </div>
            );
          })}
        </CardBody>
      </Card>

      {/* --- Matritsa ------------------------------------------------------ */}
      <Card className="min-w-0">
        <CardHeader
          description="Satr — huquq, ustun — rol. Belgi qo'yilgan kesishmada rolda o'sha huquq bor."
          title="Rol × permission matritsasi"
        />

        <FilterBar>
          <div className="min-w-52 flex-1">
            <FormField label="Huquqni qidirish">
              {(props) => (
                <TextInput
                  {...props}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Masalan: buyurtma, ORDER, bekor"
                  value={query}
                />
              )}
            </FormField>
          </div>
          <div className="w-full sm:w-56">
            <FormField label="Modul">
              {(props) => (
                <Select
                  {...props}
                  onChange={(event) => setGroup(event.target.value)}
                  value={group}
                >
                  <option value="">Barcha modullar</option>
                  {groups.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </Select>
              )}
            </FormField>
          </div>
          <p className="ml-auto text-[13px] text-mz-text-muted">
            {filteredPermissions.length} ta huquq ko&apos;rsatilmoqda
          </p>
        </FilterBar>

        {filteredPermissions.length === 0 ? (
          <EmptyState
            description={
              hasFilters
                ? "Qidiruv yoki modul filtrini o'zgartirib ko'ring."
                : "Serverdan permission ro'yxati kelmadi."
            }
            icon={hasFilters ? "search" : "inbox"}
            title={hasFilters ? "Huquq topilmadi" : "Permission yo'q"}
          />
        ) : (
          /*
           * Matritsa KENG bo'lishi mumkin (8 rol × ustun). DESIGN_RULES
           * jadvalga o'z `overflow-x` konteynerini ruxsat beradi — sahifa
           * o'zi gorizontal siljimaydi.
           */
          <>
            <div className="grid gap-2 p-3 md:hidden">
              {filteredPermissions.map((permission) => {
                const grantedRoles = roles.filter(
                  (role) =>
                    (roleHasWildcard.get(role.id) ?? false) ||
                    (rolePermissionCodes
                      .get(role.id)
                      ?.has(permission.code) ??
                      false),
                );

                return (
                  <div
                    className="min-w-0 border-b border-mz-border pb-3 last:border-b-0"
                    key={permission.id}
                  >
                    <p className="break-words text-sm font-semibold text-mz-text">
                      {permission.name}
                    </p>
                    <p className="break-all font-mono text-[13px] text-mz-text-faint">
                      {permission.code}
                    </p>
                    <div className="mt-2 flex min-w-0 flex-wrap gap-1.5">
                      {grantedRoles.length ? (
                        grantedRoles.map((role) => (
                          <Badge key={role.id} tone="success">
                            {roleCodeLabel(role.code)}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-[13px] text-mz-text-muted">
                          Hech qaysi rolda yo&apos;q
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mz-thin-scrollbar hidden max-h-[70vh] max-w-full overflow-auto md:block">
            <table className="w-full border-collapse text-sm">
              <caption className="sr-only">
                Rollar va permissionlar matritsasi
              </caption>
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-mz-border bg-mz-surface-sunken">
                  <th
                    className="sticky left-0 z-20 min-w-56 border-b border-mz-border bg-mz-surface-sunken px-3 py-2.5 text-left text-[13px] font-bold uppercase tracking-wide text-mz-text-muted"
                    scope="col"
                  >
                    Huquq
                  </th>
                  {roles.map((role) => (
                    <th
                      className="border-b border-mz-border bg-mz-surface-sunken px-2 py-2.5 text-center text-[13px] font-bold text-mz-text-muted"
                      key={role.id}
                      scope="col"
                    >
                      <span className="block max-w-24 truncate">
                        {roleCodeLabel(role.code)}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredPermissions.map((permission) => (
                  <tr
                    className="border-b border-mz-border last:border-b-0 hover:bg-mz-surface-sunken"
                    key={permission.id}
                  >
                    <th
                      className="sticky left-0 z-10 bg-mz-surface px-3 py-2.5 text-left align-middle font-normal"
                      scope="row"
                    >
                      <span className="block text-sm font-semibold text-mz-text">
                        {permission.name}
                      </span>
                      <span className="block font-mono text-[13px] text-mz-text-faint">
                        {permission.code}
                      </span>
                      {permission.description ? (
                        <span className="block text-[13px] text-mz-text-muted">
                          {permission.description}
                        </span>
                      ) : null}
                    </th>
                    {roles.map((role) => {
                      const granted =
                        (roleHasWildcard.get(role.id) ?? false) ||
                        (rolePermissionCodes
                          .get(role.id)
                          ?.has(permission.code) ??
                          false);

                      return (
                        <td
                          className="px-2 py-2.5 text-center align-middle"
                          key={role.id}
                        >
                          {granted ? (
                            <span
                              className="inline-grid h-6 w-6 place-items-center rounded-mz-control bg-mz-success-bg text-mz-success"
                              title={`${roleCodeLabel(role.code)}: ${permission.name} — bor`}
                            >
                              <Icon className="h-4 w-4" name="check" />
                              <span className="sr-only">Bor</span>
                            </span>
                          ) : (
                            <span
                              className="text-mz-text-faint"
                              title={`${roleCodeLabel(role.code)}: ${permission.name} — yo'q`}
                            >
                              <span aria-hidden="true">·</span>
                              <span className="sr-only">Yo&apos;q</span>
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </>
        )}
      </Card>

      <Modal
        dismissOnBackdrop={false}
        footer={
          <>
            <Button disabled={isSaving} onClick={closeEditor} variant="ghost">
              Bekor qilish
            </Button>
            <Button isLoading={isSaving} onClick={() => void saveRole()}>
              Saqlash
            </Button>
          </>
        }
        isOpen={isCreating || editing !== null}
        onClose={closeEditor}
        title={editing ? `${editing.name} — tahrirlash` : "Yangi maxsus rol"}
      >
        <div className="grid gap-4">
          <FormField label="Rol nomi" required>
            {(props) => (
              <TextInput
                {...props}
                maxLength={80}
                onChange={(event) => setRoleName(event.target.value)}
                value={roleName}
              />
            )}
          </FormField>
          <FormField label="Tavsif">
            {(props) => (
              <Textarea
                {...props}
                maxLength={500}
                onChange={(event) => setRoleDescription(event.target.value)}
                value={roleDescription}
              />
            )}
          </FormField>
          <FormField label="Huquqlarni qidirish">
            {(props) => (
              <TextInput
                {...props}
                onChange={(event) => setEditorQuery(event.target.value)}
                placeholder="Nomi yoki kodi"
                value={editorQuery}
              />
            )}
          </FormField>
          <Checkbox
            boxed
            checked={isBranchScoped}
            description="Bu rol xodimga berilganda filial tanlash majburiy bo'ladi"
            label="Filial doirasidagi rol"
            onChange={setIsBranchScoped}
          />
          <div className="mz-thin-scrollbar grid max-h-[42vh] gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
            {editorPermissions.map((permission) => (
              <Checkbox
                boxed
                checked={selectedPermissionIds.includes(permission.id)}
                description={permission.code}
                key={permission.id}
                label={permission.name}
                onChange={() => togglePermission(permission.id)}
              />
            ))}
          </div>
          <p className="text-[13px] text-mz-text-muted">
            {selectedPermissionIds.length} ta huquq tanlandi. Barcha huquqlar
            jokeri maxsus rolga berilmaydi.
          </p>
        </div>
      </Modal>

      <Modal
        description="Rol faqat hech bir xodimga biriktirilmagan bo'lsa arxivlanadi."
        footer={
          <>
            <Button
              disabled={isSaving}
              onClick={() => setPendingArchive(null)}
              variant="ghost"
            >
              Bekor qilish
            </Button>
            <Button
              isLoading={isSaving}
              onClick={() => void archiveRole()}
              variant="danger"
            >
              Arxivlash
            </Button>
          </>
        }
        isOpen={pendingArchive !== null}
        onClose={() => setPendingArchive(null)}
        title={pendingArchive ? `${pendingArchive.name} arxivlansinmi?` : "Rolni arxivlash"}
      />
    </div>
  );
}

function RuleNote({
  title,
  text,
  icon,
}: {
  title: string;
  text: string;
  icon: "users" | "building" | "wallet";
}) {
  return (
    <div className="grid gap-1.5 rounded-mz-control border border-mz-border bg-mz-surface-sunken p-3">
      <p className="flex items-center gap-2 text-sm font-semibold text-mz-text">
        <span aria-hidden="true" className="text-mz-accent">
          <Icon className="h-4 w-4" name={icon} />
        </span>
        {title}
      </p>
      <p className="text-[13px] text-mz-text-muted">{text}</p>
    </div>
  );
}
