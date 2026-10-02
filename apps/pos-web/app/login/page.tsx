"use client";

import { FormEvent, useEffect, useState } from "react";
import { useAuth } from "../../components/auth/auth-provider";
import { getPrimaryRedirect } from "../../lib/auth";
import { useRouter } from "next/navigation";
import { PhoneInput } from "../../components/phone-input";
import { Mail, Phone, Trash2 } from "lucide-react";
import { DesktopEnrollmentBadge } from "../../components/auth/desktop-enrollment";

function sameLoginIdentifier(left: string, right: string): boolean {
  const normalizedLeft = left.trim();
  const normalizedRight = right.trim();
  if (normalizedLeft.includes("@") || normalizedRight.includes("@")) {
    return normalizedLeft.toLowerCase() === normalizedRight.toLowerCase();
  }
  const leftDigits = normalizedLeft.replace(/\D/g, "");
  const rightDigits = normalizedRight.replace(/\D/g, "");
  return (
    leftDigits.length > 0 && leftDigits.slice(-9) === rightDigits.slice(-9)
  );
}

export default function LoginPage() {
  const { isReady, login, session } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isReady && session) {
      router.replace(getPrimaryRedirect(session.user));
    }
  }, [isReady, router, session]);
  const [identifier, setIdentifier] = useState("");
  const [phone, setPhone] = useState("");
  const [mode, setMode] = useState<"phone" | "email">("phone");
  const [password, setPassword] = useState("");
  const [hasDesktopCredentialStore, setHasDesktopCredentialStore] =
    useState(false);
  const [savedIdentifiers, setSavedIdentifiers] = useState<string[]>([]);
  const [selectedSavedIdentifier, setSelectedSavedIdentifier] = useState("");
  const [rememberDesktopCredentials, setRememberDesktopCredentials] =
    useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const credentials = window.mazettoDesktop?.auth?.credentials;
    if (!credentials) return;

    let active = true;
    setHasDesktopCredentialStore(true);
    void credentials
      .list()
      .then((identifiers) => {
        if (active) setSavedIdentifiers(identifiers);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  async function selectSavedAccount(identifier: string) {
    setSelectedSavedIdentifier(identifier);
    setError(null);
    if (!identifier) {
      setRememberDesktopCredentials(false);
      return;
    }

    const credentials = window.mazettoDesktop?.auth?.credentials;
    if (!credentials) return;
    try {
      const saved = await credentials.get(identifier);
      if (!saved) return;
      if (saved.identifier.includes("@")) {
        setMode("email");
        setIdentifier(saved.identifier);
      } else {
        const digits = saved.identifier.replace(/\D/g, "");
        setMode("phone");
        setPhone(digits.length > 9 ? digits.slice(-9) : digits);
      }
      setPassword(saved.password);
      setRememberDesktopCredentials(true);
    } catch {
      setError("Saqlangan loginni o'qib bo'lmadi.");
    }
  }

  async function removeSavedAccount() {
    const credentials = window.mazettoDesktop?.auth?.credentials;
    if (!credentials || !selectedSavedIdentifier) return;
    try {
      const nextIdentifiers = await credentials.remove(selectedSavedIdentifier);
      setSavedIdentifiers(nextIdentifiers);
      setSelectedSavedIdentifier("");
      setPassword("");
      setRememberDesktopCredentials(false);
    } catch {
      setError("Saqlangan loginni o'chirib bo'lmadi.");
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting || (mode === "phone" && phone.length !== 9)) return;
    setError(null);
    setIsSubmitting(true);

    try {
      await login(
        mode === "phone" ? "+998" + phone : identifier.trim(),
        password,
        rememberDesktopCredentials,
        selectedSavedIdentifier || null,
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
                  setSelectedSavedIdentifier("");
                  setRememberDesktopCredentials(false);
                  setError(null);
                }}
                className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-bold transition ${mode === value ? "bg-[#004f55] text-white shadow-sm" : "text-[#004f55] hover:bg-[#dbece2]"}`}
              >
                {value === "phone" ? <Phone size={16} /> : <Mail size={16} />}
                {value === "phone" ? "Telefon" : "Email"}
              </button>
            ))}
          </div>
          {hasDesktopCredentialStore && savedIdentifiers.length > 0 ? (
            <div className="flex items-end gap-2">
              <label className="grid min-w-0 flex-1 gap-2 text-sm font-medium text-neutral-700">
                Saqlangan hisob
                <select
                  className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-3 text-sm text-neutral-900 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                  value={selectedSavedIdentifier}
                  disabled={isSubmitting}
                  onChange={(event) =>
                    void selectSavedAccount(event.target.value)
                  }
                >
                  <option value="">Hisobni tanlang</option>
                  {savedIdentifiers.map((savedIdentifier) => (
                    <option key={savedIdentifier} value={savedIdentifier}>
                      {savedIdentifier}
                    </option>
                  ))}
                </select>
              </label>
              {selectedSavedIdentifier ? (
                <button
                  type="button"
                  title="Saqlangan hisobni o'chirish"
                  aria-label="Saqlangan hisobni o'chirish"
                  disabled={isSubmitting}
                  className="mb-0.5 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-neutral-200 text-neutral-600 hover:border-red-200 hover:text-red-700"
                  onClick={() => void removeSavedAccount()}
                >
                  <Trash2 size={17} />
                </button>
              ) : null}
            </div>
          ) : null}
          {mode === "phone" ? (
            <PhoneInput
              value={phone}
              name="username"
              autoComplete="username"
              onChange={(value) => {
                setPhone(value);
                if (
                  selectedSavedIdentifier &&
                  !sameLoginIdentifier(value, selectedSavedIdentifier)
                ) {
                  setSelectedSavedIdentifier("");
                  setRememberDesktopCredentials(false);
                }
              }}
              disabled={isSubmitting}
            />
          ) : (
            <label className="grid gap-2 text-sm font-medium text-neutral-700">
              Email
              <input
                className="rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-base text-neutral-950 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                value={identifier}
                type="email"
                name="username"
                disabled={isSubmitting}
                onChange={(event) => {
                  const value = event.target.value;
                  setIdentifier(value);
                  if (
                    selectedSavedIdentifier &&
                    !sameLoginIdentifier(value, selectedSavedIdentifier)
                  ) {
                    setSelectedSavedIdentifier("");
                    setRememberDesktopCredentials(false);
                  }
                }}
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
              name="password"
              autoComplete="current-password"
              required
            />
          </label>

          {hasDesktopCredentialStore ? (
            <label className="flex items-center gap-2 text-sm text-neutral-700">
              <input
                type="checkbox"
                checked={rememberDesktopCredentials}
                onChange={(event) =>
                  setRememberDesktopCredentials(event.target.checked)
                }
                disabled={isSubmitting}
                className="h-4 w-4 accent-[#007a68]"
              />
              Shu qurilmada login va parolni eslab qolish
            </label>
          ) : null}

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
          <div className="flex flex-wrap items-center justify-center gap-2">
            <DesktopEnrollmentBadge />
          </div>
        </form>
      </section>
    </main>
  );
}
