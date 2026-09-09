"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  AccessDeniedPanel,
  UnknownRoutePanel,
} from "../../components/admin-shell/access-denied-panel";
import { AdminLayout } from "../../components/admin-shell/admin-layout";
import { ShellContentSkeleton } from "../../components/admin-shell/shell-content-skeleton";
import { useAuth } from "../../components/auth/auth-provider";
import { getPrimaryRedirect } from "../../lib/auth";
import { checkRouteAccess } from "../../lib/route-access";

/*
 * Admin qobig'i — barcha panel ekranlari uchun BITTA layout (PHASE 6 A1–A4).
 *
 * `(shell)` — route guruhi: qavs ichidagi papka URL yo'liga kirmaydi, ya'ni
 * hech bir manzil o'zgarmadi. Fayllar ko'chdi, yo'llar emas.
 *
 * NIMA HAL BO'LDI. Ilgari `AdminLayout` oddiy komponent edi va 31 sahifaning
 * har birida qo'lda chaqirilardi, guardlar esa undan TASHQARIDA turardi.
 * Uchta oqibati bor edi:
 *
 *   1. Guard qaror qabul qilayotgan paytda hech narsa sidebar'ni render
 *      qilmasdi — oq ekran.
 *   2. Har navigatsiyada butun daraxt unmount/remount bo'lardi: yig'ilgan
 *      sidebar ochilib-yopilardi, `ToastProvider` state'i o'lardi.
 *   3. Rad etilganda foydalanuvchi qobig'i yo'q `/access-denied` ga uchardi.
 *
 * Next hujjati (`node_modules/next/dist/docs/.../layout.md`) aytadi: layoutlar
 * navigatsiyada QAYTA RENDER QILINMAYDI va klientda keshlanadi. Aynan shu
 * xususiyat sidebar'ni joyida ushlab turadi.
 *
 * Bu yerda `<html>`/`<body>` YO'Q — root layout (`app/layout.tsx`) o'z joyida
 * qoladi, ya'ni bu ildiz layout emas va guruhlar orasida o'tish to'liq sahifa
 * qayta yuklanishiga olib kelmaydi.
 */
export default function ShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { isReady, user } = useAuth();

  useEffect(() => {
    if (isReady && !user) {
      router.replace("/login");
    }
  }, [isReady, user, router]);

  // Sessiya tiklanmaguncha qobiq CHIZILADI, faqat kontent joyi skeleton
  // bo'ladi. Ilgari bu payt butunlay oq ekran edi.
  if (!isReady || !user) {
    return (
      <AdminLayout>
        <ShellContentSkeleton />
      </AdminLayout>
    );
  }

  const verdict = checkRouteAccess(user, pathname);

  if (verdict === "unknown-route") {
    return (
      <AdminLayout>
        <UnknownRoutePanel pathname={pathname} />
      </AdminLayout>
    );
  }

  if (verdict === "denied") {
    return (
      <AdminLayout>
        <AccessDeniedPanel homeHref={getPrimaryRedirect(user.roles)} />
      </AdminLayout>
    );
  }

  return <AdminLayout>{children}</AdminLayout>;
}
