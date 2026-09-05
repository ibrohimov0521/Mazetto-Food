import { hasRole, type AuthUser } from "./auth";

/*
 * Xodim boshqaruvining xavfsizlik qoidalari.
 *
 * Manba: malumot/admin_roles/mazetto_admin_roles_rbac_plan.json
 *        → staff_security_contract.super_admin
 *
 *   "SUPER_ADMIN accountini faqat SUPER_ADMIN boshqaradi."
 *   "SUPER_ADMIN parolini faqat SUPER_ADMIN reset qiladi."
 *   "Oxirgi active SUPER_ADMIN deactivate yoki demote qilinmaydi."
 *
 * MUHIM: bu FAQAT UX qatlami. Haqiqiy cheklov backend'ning StaffService'ida.
 * Bu yerdagi maqsad — foydalanuvchi tugmani bosib server xatosini kutmasligi,
 * balki nima uchun mumkin emasligini oldindan ko'rishi.
 */

export type StaffRoleRef = { code: string };

export type StaffLike = {
  id: string;
  isActive: boolean;
  roles: StaffRoleRef[];
};

export type StaffAction = "edit" | "role" | "status" | "password";

export function isSuperAdminStaff(staff: StaffLike): boolean {
  return staff.roles.some((role) => role.code === "SUPER_ADMIN");
}

export function countActiveSuperAdmins(allStaff: StaffLike[]): number {
  return allStaff.filter((item) => item.isActive && isSuperAdminStaff(item)).length;
}

/**
 * Amal bloklangan bo'lsa — sababini qaytaradi, aks holda `null`.
 *
 * `allStaff` berilmagan bo'lsa "oxirgi SUPER_ADMIN" qoidasi tekshirilmaydi
 * (ro'yxat hali yuklanmagan holat) — backend baribir rad etadi.
 */
export function resolveStaffActionBlock({
  actor,
  target,
  action,
  allStaff,
}: {
  actor: AuthUser | null;
  target: StaffLike;
  action: StaffAction;
  allStaff?: StaffLike[];
}): string | null {
  const actorIsSuperAdmin = hasRole(actor, ["SUPER_ADMIN"]);
  const targetIsSuperAdmin = isSuperAdminStaff(target);

  if (targetIsSuperAdmin && !actorIsSuperAdmin) {
    return action === "password"
      ? "SUPER_ADMIN parolini faqat SUPER_ADMIN reset qila oladi."
      : "SUPER_ADMIN accountini faqat SUPER_ADMIN boshqara oladi.";
  }

  if (!targetIsSuperAdmin || !allStaff) {
    return null;
  }

  const isLastActiveSuperAdmin = target.isActive && countActiveSuperAdmins(allStaff) === 1;

  if (!isLastActiveSuperAdmin) {
    return null;
  }

  if (action === "status") {
    return "Bu tizimdagi oxirgi faol SUPER_ADMIN — uni bloklab bo'lmaydi.";
  }

  if (action === "role") {
    return "Bu tizimdagi oxirgi faol SUPER_ADMIN — uning rolini o'zgartirib bo'lmaydi.";
  }

  return null;
}
