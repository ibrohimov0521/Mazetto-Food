"use client";

import { useMemo, useState } from "react";
import { apiFetch } from "../../lib/api";
import { useApiResource } from "../../lib/use-api-resource";
import { Badge } from "../admin-ui/badge";
import { ButtonLink } from "../admin-ui/button";
import { Card, CardBody, CardHeader } from "../admin-ui/card";
import { EmptyState, ErrorState, Skeleton } from "../admin-ui/feedback";
import { FilterBar, FormField, Select, TextInput } from "../admin-ui/form";
import { Icon } from "../admin-ui/icon";
import { StatGrid, InfoBox } from "../admin-ui/stat-box";
import { roleCodeLabel } from "./people-branch-labels";

/*
 * Rollar va permissionlar — FAQAT O'QISH, va bu backend cheklovi.
 *
 * TEKSHIRILDI (apps/backend/src/modules/roles/roles.controller.ts): butun
 * modulda ikkita marshrut bor — `GET /roles` va `GET /permissions`. Rol
 * yaratish, o'zgartirish, o'chirish yoki rolga permission biriktirish
 * endpoint'i YO'Q, boshqa modullarda ham yo'q. Ya'ni "view-only" izohi
 * to'g'ri: rol matritsasi hozir faqat seed orqali o'zgaradi.
 *
 * SHUNING UCHUN bu ekranning vazifasi boshqa: mavjud matritsani
 * O'QILADIGAN qilish. Ilgari u rol kartochkalarida xom permission kodlarini
 * chip qilib to'kardi (SUPER_ADMIN kartochkasida bitta `*`), permission
 * jadvalida esa faqat "nechta rolda" sanog'i bor edi — ya'ni "kassirga
 * buyurtmani bekor qilish huquqi bormi?" degan savolga javob bermasdi.
 *
 * Endi ROL × PERMISSION MATRITSASI bor: satr — permission, ustun — rol,
 * kesishma — huquq bor/yo'q. Aynan shu ko'rinish rol sozlashni tushunarli
 * qiladi.
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
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("");

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
    <div className="grid gap-5">
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
                Bu ekran faqat ko&apos;rish uchun
              </p>
              <p className="mt-1 text-[13px] text-mz-text-muted">
                Serverda rol va permissionni o&apos;zgartiradigan endpoint
                yo&apos;q — mavjudi faqat{" "}
                <code className="rounded bg-mz-surface-sunken px-1">
                  GET /roles
                </code>{" "}
                va{" "}
                <code className="rounded bg-mz-surface-sunken px-1">
                  GET /permissions
                </code>
                . Matritsa hozir seed bilan belgilanadi. Xodimga rol{" "}
                <span className="font-semibold text-mz-text">biriktirish</span>{" "}
                esa ishlaydi va xodim kartasida bajariladi.
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
          value={`${roles.filter((role) => branchScopedRoleCodes.has(role.code)).length} ta`}
        />
        <InfoBox
          description="Barcha filialni ko'radi"
          icon="globe"
          label="Global rol"
          value={`${roles.filter((role) => !branchScopedRoleCodes.has(role.code)).length} ta`}
        />
      </StatGrid>

      {/* --- Rol xulosalari ------------------------------------------------ */}
      <Card>
        <CardHeader
          description="Har rolning huquq hajmi va doirasi"
          title="Rollar"
        />
        <CardBody className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {roles.map((role) => {
            const isWildcard = roleHasWildcard.get(role.id) ?? false;
            const isBranchScoped = branchScopedRoleCodes.has(role.code);

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
                  <Badge tone={isBranchScoped ? "info" : "neutral"}>
                    {isBranchScoped ? "Filial doirasida" : "Global doira"}
                  </Badge>
                  <Badge tone={isWildcard ? "warning" : "neutral"}>
                    {isWildcard
                      ? "Barcha huquqlar"
                      : `${role.permissions.length} ta huquq`}
                  </Badge>
                </div>
              </div>
            );
          })}
        </CardBody>
      </Card>

      {/* --- Matritsa ------------------------------------------------------ */}
      <Card>
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
          <div className="mz-thin-scrollbar max-h-[70vh] overflow-auto">
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
        )}
      </Card>
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
