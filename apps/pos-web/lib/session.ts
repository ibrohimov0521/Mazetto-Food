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
let memorySession: AuthSession | null = null;
let hydrated = false;

export async function hydrateSession(): Promise<AuthSession | null> {
  if (hydrated) return memorySession;

  const desktopSession = window.mazettoDesktop?.session;
  if (desktopSession) {
    try {
      const protectedRaw = await desktopSession.load();
      const protectedSession = parseSession(protectedRaw);
      const legacySession = readBrowserSession();
      memorySession = protectedSession ?? legacySession;
      if (!protectedSession && legacySession) {
        await desktopSession.save(JSON.stringify(legacySession));
      }
      clearStoredSession();
      hydrated = true;
      return memorySession;
    } catch {
      // Desktop secure storage is temporarily unavailable; keep the in-memory login.
      memorySession = readBrowserSession();
      hydrated = true;
      return memorySession;
    }
  }

  memorySession = readBrowserSession();
  hydrated = true;
  return memorySession;
}

export function readSession(): AuthSession | null {
  if (typeof window === "undefined") {
    return null;
  }

  return hydrated ? memorySession : readBrowserSession();
}

export function writeSession(session: AuthSession | null): void {
  const desktopSession =
    typeof window !== "undefined" ? window.mazettoDesktop?.session : undefined;
  const storedSession = session && !desktopSession
    ? withoutRefreshToken(session)
    : session;
  memorySession = storedSession;
  hydrated = true;
  if (typeof window !== "undefined") {
    if (desktopSession) {
      clearStoredSession();
      void (storedSession
        ? desktopSession.save(JSON.stringify(storedSession))
        : desktopSession.clear());
    } else {
      try {
        if (storedSession) {
          window.localStorage.setItem(authStorageKey, JSON.stringify(storedSession));
        } else {
          window.localStorage.removeItem(authStorageKey);
        }
      } catch {
        // Saqlab bo'lmadi — xotiradagi holat baribir yangilanadi.
      }
    }
  }

  for (const listener of listeners) {
    listener(storedSession);
  }
}

function withoutRefreshToken(session: AuthSession): AuthSession {
  const tokens = { ...session.tokens };
  delete tokens.refreshToken;
  return { ...session, tokens };
}

function readBrowserSession(): AuthSession | null {
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(authStorageKey);
  } catch {
    return null;
  }
  const session = parseSession(raw);
  if (raw && !session) clearStoredSession();
  return session;
}

function parseSession(raw: string | null): AuthSession | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return isAuthSession(parsed) ? parsed : null;
  } catch {
    return null;
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
    (candidate.tokens.refreshToken === undefined ||
      typeof candidate.tokens.refreshToken === "string")
  );
}
