"use client";

import { AuthShell, DashboardCards } from "../../../components/auth/auth-shell";
import { RoleGuard } from "../../../components/auth/role-guard";

export default function AdminDashboardPage() {
  return (
    <RoleGuard roles={["SUPER_ADMIN"]}>
      <AuthShell eyebrow="Global control" title="Admin dashboard">
        <DashboardCards
          items={[
            { label: "Access scope", value: "All branches" },
            { label: "Finance", value: "Enabled" },
            { label: "Permissions", value: "Full access" },
          ]}
        />
      </AuthShell>
    </RoleGuard>
  );
}
