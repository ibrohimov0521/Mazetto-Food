"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { DesktopEnrollmentBadge } from "../../components/auth/desktop-enrollment";
import { useAuth } from "../../components/auth/auth-provider";

export default function DeviceEnrollmentPage() {
  const router = useRouter();
  const { isReady, user } = useAuth();

  useEffect(() => {
    if (isReady && !user) router.replace("/login");
  }, [isReady, router, user]);

  if (!isReady || !user) return null;

  return (
    <main className="min-h-screen bg-mz-surface-sunken px-4 py-10">
      <section className="mx-auto grid max-w-xl gap-5 rounded-mz-card border border-mz-border bg-mz-surface p-6 shadow-mz-card">
        <div>
          <p className="text-sm font-semibold text-mz-info">Desktop qurilmasi</p>
          <h1 className="mt-1 text-2xl font-bold text-mz-text">Qurilmani tasdiqlang</h1>
          <p className="mt-2 text-sm text-mz-text-muted">
            Login muvaffaqiyatli bajarildi. Ishni davom ettirish uchun admin panelda yaratilgan bir martalik kodni kiriting.
          </p>
        </div>
        <div className="flex items-center justify-between rounded-mz-card border border-mz-border bg-mz-surface-sunken p-4">
          <span className="text-sm font-medium text-mz-text">Qurilmani ulash oynasi</span>
          <DesktopEnrollmentBadge onEnrolled={() => router.replace("/workspace")} openOnUnenrolled />
        </div>
        <p className="text-xs text-mz-text-muted">Tasdiqlangandan keyin sahifa avtomatik ravishda sizning ish panelingizga qaytadi.</p>
      </section>
    </main>
  );
}
