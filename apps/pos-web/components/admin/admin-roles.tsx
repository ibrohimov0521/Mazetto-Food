"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch, SessionExpiredError } from "../../lib/api";
import { Badge } from "../admin-ui/badge";
import { Card, CardBody, CardHeader } from "../admin-ui/card";
import { DataTable, type DataTableColumn } from "../admin-ui/data-table";
import { ErrorState, SkeletonRows } from "../admin-ui/feedback";
import { FilterBar, TextInput } from "../admin-ui/form";

/*
 * Rollar va permissionlar — FAQAT O'QISH.
 *
 * Backend `/roles` va `/permissions` tayyor, lekin rol/permission YARATISH yoki
 * O'ZGARTIRISH endpoint'i yo'q — hozircha ular faqat seed orqali boshqariladi.
 *
 * Boshqaruv 4-bosqichda `ROLE_MANAGE` / `PERMISSION_MANAGE` permissionlari
 * bilan birga qo'shiladi (RBAC JSON future_permission_plan.security_audit).
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

export function AdminRolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const [nextRoles, nextPermissions] = await Promise.all([
        apiFetch<Role[]>("/roles"),
        apiFetch<Permission[]>("/permissions"),
      ]);
      setRoles(nextRoles);
      setPermissions(nextPermissions);
    } catch (caught) {
      if (caught instanceof SessionExpiredError) {
        return;
      }

      setError(caught instanceof Error ? caught.message : "Rollarni yuklab bo'lmadi.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredPermissions = useMemo(() => {
    const needle = query.trim().toLowerCase();

    if (!needle) {
      return permissions;
    }

    return permissions.filter((permission) =>
      [permission.code, permission.name, permission.description]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [permissions, query]);

  const permissionColumns: DataTableColumn<Permission>[] = [
    {
      key: "code",
      header: "Kod",
      primary: true,
      render: (permission) => (
        <code className="rounded bg-mz-surface-sunken px-1.5 py-0.5 text-xs font-semibold text-mz-text">
          {permission.code}
        </code>
      ),
    },
    { key: "name", header: "Nomi", render: (permission) => permission.name },
    {
      key: "description",
      header: "Tavsif",
      hideOnMobile: true,
      render: (permission) => (
        <span className="text-xs text-mz-text-muted">{permission.description ?? "—"}</span>
      ),
    },
    {
      key: "roles",
      header: "Rollarda",
      align: "right",
      render: (permission) => {
        const count = roles.filter((role) =>
          role.permissions.some((item) => item.permission.code === permission.code),
        ).length;

        return `${count} ta`;
      },
    },
  ];

  if (isLoading) {
    return <SkeletonRows rows={8} />;
  }

  return (
    <div className="grid gap-5">
      {error ? <ErrorState message={error} onRetry={() => void load()} /> : null}

      <Card>
        <CardBody>
          <p className="text-xs text-mz-text-muted">
            Bu ekran faqat ko&apos;rish uchun. Rollar va permissionlar hozircha seed orqali
            boshqariladi; boshqaruv interfeysi keyingi bosqichda{" "}
            <code className="rounded bg-mz-surface-sunken px-1">ROLE_MANAGE</code> permission&apos;i
            bilan qo&apos;shiladi.
          </p>
        </CardBody>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {roles.map((role) => (
          <Card key={role.id}>
            <CardHeader
              title={`${role.name} · ${role.code}`}
              {...(role.description ? { description: role.description } : {})}
              {...(role.isSystem
                ? { actions: <Badge tone="warning">Tizim roli</Badge> }
                : {})}
            />
            <CardBody>
              <p className="mb-2 text-xs font-semibold text-mz-text-muted">
                {role.permissions.length} ta permission
              </p>
              <div className="flex flex-wrap gap-1">
                {role.permissions.map((item) => (
                  <Badge
                    key={item.permission.id}
                    tone={item.permission.code === "*" ? "warning" : "neutral"}
                  >
                    {item.permission.code}
                  </Badge>
                ))}
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader
          description={`Tizimda ${permissions.length} ta permission mavjud`}
          title="Permission katalogi"
        />
        <FilterBar>
          <div className="min-w-52 flex-1">
            <TextInput
              aria-label="Permission qidirish"
              placeholder="Kod, nomi yoki tavsifi"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
        </FilterBar>
        <DataTable
          caption="Permission katalogi"
          columns={permissionColumns}
          emptyTitle="Permission topilmadi"
          getRowKey={(permission) => permission.id}
          rows={filteredPermissions}
        />
      </Card>
    </div>
  );
}
