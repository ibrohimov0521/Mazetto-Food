"use client";

import { ButtonLink } from "../admin-ui/button";
import { Icon } from "../admin-ui/icon";

/*
 * Ruxsat rad etilgan holat — QOBIQ ICHIDA (PHASE 6 A3).
 *
 * Ilgari guard rad etsa `router.replace("/access-denied")` ishlardi va u
 * sahifada `AdminLayout` yo'q edi: sidebar butunlay yo'qolardi, yagona tugma
 * esa "Login sahifasiga qaytish" bo'lib, foydalanuvchini TIZIMDAN CHIQARIB
 * yuborardi. Ochilmaydigan bitta bo'lim butun sessiyani tugatardi.
 *
 * Endi bu shunchaki kontent joyidagi holat. Sidebar joyida qoladi, ya'ni
 * foydalanuvchi o'ziga ochiq bo'lgan boshqa bo'limga bir bosishda o'tadi.
 */
export function AccessDeniedPanel({ homeHref }: { homeHref: string }) {
  return (
    <section className="mx-auto max-w-xl rounded-mz-card border border-mz-border bg-mz-surface p-8 text-center shadow-mz-card">
      <span
        aria-hidden="true"
        className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-mz-info-bg text-mz-info"
      >
        <Icon name="shield" />
      </span>

      <p className="mt-4 text-sm font-black uppercase tracking-widest text-mz-info">
        Kirish cheklangan
      </p>

      <h1 className="mt-2 text-2xl font-semibold tracking-normal text-mz-text">
        Bu bo&apos;lim sizning rolingiz uchun ochilmagan
      </h1>

      <p className="mt-3 text-sm leading-6 text-mz-text-muted">
        Account faol, lekin bu ekran uchun kerakli rol yoki permission berilmagan.
        Chapdagi menyuda sizga ochiq bo&apos;limlar ko&apos;rsatilgan.
      </p>

      <div className="mt-6 flex justify-center">
        <ButtonLink href={homeHref} variant="primary">
          <Icon className="h-4 w-4" name="gauge" />
          Bosh sahifaga
        </ButtonLink>
      </div>
    </section>
  );
}

/**
 * Qobiq ichida qoidasi topilmagan route.
 *
 * Bu foydalanuvchi xatosi emas — konfiguratsiya nuqsoni: `(shell)` ichiga
 * sahifa qo'shilgan, lekin `lib/route-access.ts` ga qoida yozilmagan. Ochiq
 * qoldirishdan ko'ra yopiq ko'rsatiladi, va matn nima qilish kerakligini
 * aytadi.
 */
export function UnknownRoutePanel({ pathname }: { pathname: string }) {
  return (
    <section className="mx-auto max-w-xl rounded-mz-card border border-mz-danger-accent bg-mz-surface p-8 text-center shadow-mz-card">
      <p className="text-sm font-black uppercase tracking-widest text-mz-danger">
        Sozlanmagan sahifa
      </p>

      <h1 className="mt-2 text-2xl font-semibold tracking-normal text-mz-text">
        Bu yo&apos;l uchun ruxsat qoidasi yo&apos;q
      </h1>

      <p className="mt-3 text-sm leading-6 text-mz-text-muted">
        <code className="rounded bg-mz-canvas px-1.5 py-0.5 font-mono text-xs">
          {pathname}
        </code>{" "}
        qobiq ichida, lekin{" "}
        <code className="rounded bg-mz-canvas px-1.5 py-0.5 font-mono text-xs">
          lib/route-access.ts
        </code>{" "}
        da qoidasi e&apos;lon qilinmagan. Ruxsat aniqlanmagani uchun sahifa
        ochilmadi.
      </p>
    </section>
  );
}
