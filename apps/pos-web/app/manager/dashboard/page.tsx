"use client";

import { AuthShell, DashboardCards } from "../../../components/auth/auth-shell";
import { RoleGuard } from "../../../components/auth/role-guard";

export default function ManagerDashboardPage() {
  return (
    <RoleGuard roles={["BRANCH_MANAGER"]}>
      <AuthShell eyebrow="Branch operations" title="Manager dashboard">
        <DashboardCards
          items={[
            { label: "Access scope", value: "Assigned branch" },
            { label: "Orders", value: "Manage" },
            { label: "Global finance", value: "Restricted" },
          ]}
        />
      </AuthShell>
    </RoleGuard>
  );
}
