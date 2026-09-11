"use client";

import { FormEvent, useState } from "react";
import { useAuth } from "../../components/auth/auth-provider";
import { PhoneInput } from "../../components/phone-input";
import { Mail, Phone } from "lucide-react";

export default function LoginPage() {
  const { login } = useAuth();
  const [identifier, setIdentifier] = useState("");
  const [phone, setPhone] = useState("");
  const [mode, setMode] = useState<"phone" | "email">("phone");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting || (mode === "phone" && phone.length !== 9)) return;
    setError(null);
    setIsSubmitting(true);

    try {
      await login(
        mode === "phone" ? "+998" + phone : identifier.trim(),
        password,
      );
    } catch (loginError) {
      setError(
        loginError instanceof Error
          ? loginError.message
          : "Kirish amalga oshmadi",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-6 py-10">
      <section className="grid w-full max-w-5xl overflow-hidden rounded-3xl border border-emerald-100 bg-white shadow-[0_24px_80px_rgba(15,118,110,0.14)] lg:grid-cols-[1fr_0.9fr]">
        <div className="flex flex-col justify-between bg-[#004f55] p-5 text-white lg:min-h-[440px] lg:p-10">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-100">
              MAZETTO FOOD
            </p>
            <h1 className="mt-3 max-w-md text-2xl font-bold lg:mt-8 lg:text-4xl">
              Xodimlar paneli
            </h1>
          </div>
          <div className="hidden gap-3 text-sm text-emerald-50 lg:grid">
            <p>Filial bo'yicha cheklangan kirish</p>
            <p>Rol va permission bilan himoyalangan ish joylari</p>
            <p>JWT va refresh session xavfsizligi</p>
          </div>
        </div>

        <form
          className="flex min-w-0 flex-col justify-center gap-5 p-5 sm:p-8"
          onSubmit={handleSubmit}
        >
          <div>
            <p className="text-sm font-semibold text-emerald-700">
              Xavfsiz kirish
            </p>
            <h2 className="mt-2 text-3xl font-semibold tracking-normal text-neutral-950">
              Xush kelibsiz
            </h2>
            <p className="mt-2 text-sm text-neutral-500">
              Davom etish uchun xodim emaili yoki telefon raqamini kiriting.
            </p>
          </div>

          <div
            className="flex gap-1 rounded-lg bg-[#edf5f0] p-1"
            role="tablist"
            aria-label="Kirish usuli"
          >
            {(["phone", "email"] as const).map((value) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={mode === value}
                disabled={isSubmitting}
                onClick={() => {
                  setMode(value);
                  setError(null);
                }}
                className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-bold transition ${mode === value ? "bg-[#004f55] text-white shadow-sm" : "text-[#004f55] hover:bg-[#dbece2]"}`}
              >
                {value === "phone" ? <Phone size={16} /> : <Mail size={16} />}
                {value === "phone" ? "Telefon" : "Email"}
              </button>
            ))}
          </div>
          {mode === "phone" ? (
            <PhoneInput
              value={phone}
              onChange={setPhone}
              disabled={isSubmitting}
            />
          ) : (
            <label className="grid gap-2 text-sm font-medium text-neutral-700">
              Email
              <input
                className="rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-base text-neutral-950 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                value={identifier}
                type="email"
                disabled={isSubmitting}
                onChange={(event) => setIdentifier(event.target.value)}
                autoComplete="username"
                required
              />
            </label>
          )}

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
            <div
              role="alert"
              className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700"
            >
              {error}
            </div>
          ) : null}

          <button
            className="rounded-lg bg-[#ffd52e] px-5 py-3 text-sm font-bold text-[#07373a] shadow-sm transition hover:bg-[#f4c916] active:bg-[#e7bb0e] disabled:cursor-not-allowed disabled:opacity-60"
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
