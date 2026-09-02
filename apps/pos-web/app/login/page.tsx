"use client";

import { FormEvent, useState } from "react";
import { useAuth } from "../../components/auth/auth-provider";

export default function LoginPage() {
  const { login } = useAuth();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await login(identifier, password);
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Kirish amalga oshmadi");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-6 py-10">
      <section className="grid w-full max-w-5xl overflow-hidden rounded-3xl border border-emerald-100 bg-white shadow-[0_24px_80px_rgba(15,118,110,0.14)] lg:grid-cols-[1fr_0.9fr]">
        <div className="flex min-h-[520px] flex-col justify-between bg-emerald-700 p-8 text-white sm:p-10">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-100">
              MAZETTO FOOD
            </p>
            <h1 className="mt-8 max-w-md text-4xl font-semibold tracking-normal sm:text-5xl">
              Xodimlar uchun xavfsiz boshqaruv paneli.
            </h1>
          </div>
          <div className="grid gap-3 text-sm text-emerald-50">
            <p>Filial bo'yicha cheklangan kirish</p>
            <p>Rol va permission bilan himoyalangan ish joylari</p>
            <p>JWT va refresh session xavfsizligi</p>
          </div>
        </div>

        <form className="flex flex-col justify-center gap-5 p-8 sm:p-10" onSubmit={handleSubmit}>
          <div>
            <p className="text-sm font-semibold text-emerald-700">Xavfsiz kirish</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-normal text-neutral-950">
              Xush kelibsiz
            </h2>
            <p className="mt-2 text-sm text-neutral-500">
              Davom etish uchun xodim emaili yoki telefon raqamini kiriting.
            </p>
          </div>

          <label className="grid gap-2 text-sm font-medium text-neutral-700">
            Email yoki telefon
            <input
              className="rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-base text-neutral-950 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              autoComplete="username"
              required
            />
          </label>

          <label className="grid gap-2 text-sm font-medium text-neutral-700">
            Parol
            <input
              className="rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-base text-neutral-950 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              autoComplete="current-password"
              required
            />
          </label>

          {error ? (
            <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <button
            className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(5,150,105,0.30)] transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? "Kirilmoqda..." : "Kirish"}
          </button>
        </form>
      </section>
    </main>
  );
}
