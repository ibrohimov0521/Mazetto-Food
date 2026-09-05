"use client";

import { authStorageKey, type AuthSession } from "./auth";

/*
 * Sessiya saqlash — yagona manba.
 *
 * `api.ts` (token yangilash paytida) va `auth-provider.tsx` (React state) ikkalasi
 * ham shu modul orqali ishlaydi. Shuning uchun api.ts dagi yangilash provider'ga
 * darhol ko'rinadi.
 *
 * `localStorage` bloklangan yoki buzilgan bo'lishi mumkin (private rejim,
 * tozalangan sayt ma'lumotlari, buzilgan JSON) — har bir o'qish/yozish himoyalangan.
 */

type SessionListener = (session: AuthSession | null) => void;

const listeners = new Set<SessionListener>();

export function readSession(): AuthSession | null {
  if (typeof window === "undefined") {
    return null;
  }

  let raw: string | null;

  try {
    raw = window.localStorage.getItem(authStorageKey);
  } catch {
    return null;
  }

  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    return isAuthSession(parsed) ? parsed : null;
  } catch {
    // Buzilgan yozuv — oq ekran bermaslik uchun tozalaymiz.
    clearStoredSession();
    return null;
  }
}

export function writeSession(session: AuthSession | null): void {
  if (typeof window !== "undefined") {
    try {
      if (session) {
        window.localStorage.setItem(authStorageKey, JSON.stringify(session));
      } else {
        window.localStorage.removeItem(authStorageKey);
      }
    } catch {
      // Saqlab bo'lmadi (masalan, kvota to'lgan) — xotiradagi holat baribir yangilanadi.
    }
  }

  for (const listener of listeners) {
    listener(session);
  }
}

export function subscribeToSession(listener: SessionListener): () => void {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

function clearStoredSession(): void {
  try {
    window.localStorage.removeItem(authStorageKey);
  } catch {
    // e'tiborsiz
  }
}

function isAuthSession(value: unknown): value is AuthSession {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<AuthSession>;

  return (
    typeof candidate.user === "object" &&
    candidate.user !== null &&
    Array.isArray(candidate.user.roles) &&
    Array.isArray(candidate.user.permissions) &&
    typeof candidate.tokens === "object" &&
    candidate.tokens !== null &&
    typeof candidate.tokens.accessToken === "string" &&
    typeof candidate.tokens.refreshToken === "string"
  );
}
