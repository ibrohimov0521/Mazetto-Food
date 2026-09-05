"use client";

import { useRouter } from "next/navigation";

export default function AccessDeniedPage() {
  const router = useRouter();

  return (
    <main className="flex min-h-screen items-center justify-center bg-mz-surface px-6">
      <section className="w-full max-w-xl rounded-mz-card border border-mz-border bg-mz-surface p-8 text-center shadow-mz-overlay">
        <p className="text-sm font-semibold text-mz-info">Kirish cheklangan</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-normal text-mz-text">
          Bu bo'lim sizning rolingiz uchun ochilmagan.
        </h1>
        <p className="mt-4 text-sm leading-6 text-mz-text-muted">
          Account faol bo'lishi mumkin, lekin bu ish joyi uchun kerakli rol yoki permission
          berilmagan.
        </p>
        <button
          className="mt-8 rounded-mz-control bg-mz-accent px-5 py-3 text-sm font-semibold text-white shadow-mz-card transition hover:bg-mz-accent"
          type="button"
          onClick={() => router.replace("/login")}
        >
          Login sahifasiga qaytish
        </button>
      </section>
    </main>
  );
}
