"use client";

import { useRouter } from "next/navigation";

export default function AccessDeniedPage() {
  const router = useRouter();

  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-6">
      <section className="w-full max-w-xl rounded-3xl border border-emerald-100 bg-white p-8 text-center shadow-[0_24px_80px_rgba(15,118,110,0.12)]">
        <p className="text-sm font-semibold text-emerald-700">Access denied</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-normal text-neutral-950">
          This area is not available for your role.
        </h1>
        <p className="mt-4 text-sm leading-6 text-neutral-500">
          Your account is active, but it does not include the role or permission required for this
          workspace.
        </p>
        <button
          className="mt-8 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(5,150,105,0.28)] transition hover:bg-emerald-700"
          type="button"
          onClick={() => router.replace("/login")}
        >
          Return to login
        </button>
      </section>
    </main>
  );
}
