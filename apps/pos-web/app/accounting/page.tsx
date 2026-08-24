"use client";

import { AuthShell, DashboardCards } from "../../components/auth/auth-shell";
import { RoleGuard } from "../../components/auth/role-guard";

export default function AccountingPage() {
  return (
    <RoleGuard roles={["ACCOUNTANT", "SUPER_ADMIN"]}>
      <AuthShell eyebrow="Finance" title="Accounting workspace">
        <DashboardCards
          items={[
            { label: "Reports", value: "View" },
            { label: "Revenue", value: "Analyze" },
            { label: "Expenses", value: "Track" },
          ]}
        />
      </AuthShell>
    </RoleGuard>
  );
}
