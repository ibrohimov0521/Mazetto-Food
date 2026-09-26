"use client";

import type { AuthSession, AuthUser } from "./types";

const storageKey = "bestteam.owner.session";
type Envelope<T> = { success: boolean; data?: T; error?: { message?: string | string[] } };
type AuthResponse = { user: AuthUser; tokens: { accessToken: string; tokenType: string } };

export function readSession(): AuthSession | null {
  try {
    const raw = sessionStorage.getItem(storageKey);
    return raw ? JSON.parse(raw) as AuthSession : null;
  } catch {
    return null;
  }
}

export function saveSession(session: AuthSession | null) {
  if (session) sessionStorage.setItem(storageKey, JSON.stringify(session));
  else sessionStorage.removeItem(storageKey);
}

function ownerOnly(user: AuthUser) {
  if (!user.roles?.includes("PLATFORM_OWNER") || !(user.permissions?.includes("SYSTEM_HEALTH_VIEW") || user.permissions?.includes("*"))) {
    throw new Error("Bu panelga faqat BestTeam egasi kira oladi.");
  }
}

async function unwrap<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => null) as Envelope<T> | null;
  if (!response.ok || !payload?.success || payload.data === undefined) {
    const message = payload?.error?.message;
    throw new Error(Array.isArray(message) ? message.join(", ") : message || `So'rov bajarilmadi (${response.status}).`);
  }
  return payload.data;
}

async function refresh(): Promise<AuthSession> {
  const response = await fetch("/api/v1/auth/refresh", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: "{}",
  });
  const data = await unwrap<AuthResponse>(response);
  ownerOnly(data.user);
  const session = { user: data.user, accessToken: data.tokens.accessToken };
  saveSession(session);
  return session;
}

let refreshInFlight: Promise<AuthSession> | null = null;

function refreshOnce() {
  refreshInFlight ??= refresh().finally(() => { refreshInFlight = null; });
  return refreshInFlight;
}

export async function restoreSession(): Promise<AuthSession> {
  const session = readSession() || await refreshOnce();
  const user = await apiRequest<AuthUser>("/auth/me");
  ownerOnly(user);
  const updated = { ...(readSession() || session), user };
  saveSession(updated);
  return updated;
}

export async function login(identifier: string, password: string): Promise<AuthSession> {
  const response = await fetch("/api/v1/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ identifier, password }),
  });
  const data = await unwrap<AuthResponse>(response);
  ownerOnly(data.user);
  const session = { user: data.user, accessToken: data.tokens.accessToken };
  saveSession(session);
  return session;
}

export async function logout() {
  try { await apiRequest("/auth/logout", { method: "POST", body: "{}" }); } catch { /* Local session still ends. */ }
  saveSession(null);
}

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  let session = readSession();
  if (!session) throw new Error("Sessiya mavjud emas.");
  const send = (token: string) => fetch(`/api/v1${path}`, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...init?.headers },
  });
  let response = await send(session.accessToken);
  if (response.status === 401) {
    try { session = await refreshOnce(); } catch {
      saveSession(null);
      window.location.assign("/login");
      throw new Error("Sessiya tugadi. Qayta kiring.");
    }
    response = await send(session.accessToken);
  }
  return unwrap<T>(response);
}
