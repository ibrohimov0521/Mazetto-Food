"use client";

import { canSwitchBranch } from "../../lib/admin-nav";
import type { AuthUser } from "../../lib/auth";

/*
 * Filial ko'rsatkichi.
 *
 * KRITIK QOIDA (RBAC JSON core_rules + developer_rules.frontend):
 * Branch-scoped rollar (ADMIN, BRANCH_MANAGER) boshqa filialga o'ta OLMAYDI.
 * Ularga bu yerda faqat o'qish uchun belgi ko'rsatiladi — tanlagich emas.
 *
 * Filial tanlagichi faqat global scope rollar (SUPER_ADMIN, ACCOUNTANT) uchun
 * mazmunli. Tanlagichning o'zi keyingi bosqichda qo'shiladi; hozir global rol
 * "Barcha filiallar" belgisini ko'radi.
 *
 * Eslatma: bu UX qatlami. Haqiqiy cheklov backend'ning branch-scope resolver'ida.
 */

export function BranchScopeBadge({ user }: { user: AuthUser | null }) {
  if (!user) {
    return null;
  }

  const isGlobal = canSwitchBranch(user);

  return (
    <span
      className="hidden items-center gap-2 rounded-mz-pill border border-mz-shell-border bg-mz-shell-raised px-3 py-1.5 text-xs font-semibold text-mz-shell-fg sm:inline-flex"
      title={
        isGlobal
          ? "Global ko'rish huquqi — barcha filiallar"
          : "Siz faqat biriktirilgan filialingiz ma'lumotlarini ko'rasiz"
      }
    >
      <span
        aria-hidden="true"
        className={`h-1.5 w-1.5 rounded-mz-pill ${isGlobal ? "bg-mz-primary" : "bg-mz-teal-300"}`}
      />
      {isGlobal ? "Barcha filiallar" : "Filial"}
    </span>
  );
}
