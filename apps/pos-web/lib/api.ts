"use client";

import { getApiBaseUrl, type AuthSession } from "./auth";
import { readSession, writeSession } from "./session";

type ApiEnvelope<T> = {
  success: boolean;
  data?: T;
  error?: { message: string };
};

/**
 * Sessiya tugaganda `apiFetch` shu xatoni tashlaydi.
 * Chaqiruvchi buni oddiy xatodan ajratib, login'ga yo'naltirishi mumkin.
 */
export class SessionExpiredError extends Error {
  constructor(message = "Sessiya muddati tugagan. Qaytadan kiring.") {
    super(message);
    this.name = "SessionExpiredError";
  }
}

/*
 * Backend `/auth/refresh` refresh tokenni AYLANTIRADI — eski token darhol
 * yaroqsiz bo'ladi. Shuning uchun bir vaqtda faqat bitta yangilash bo'lishi shart:
 * parallel 401 lar bitta va'daga qo'shiladi.
 */
let refreshInFlight: Promise<AuthSession | null> | null = null;

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const session = readSession();
  let response = await requestWithSession(path, init, session);

  if (response.status === 401 && session) {
    const refreshed = await refreshSession(session);

    if (!refreshed) {
      throw new SessionExpiredError();
    }

    response = await requestWithSession(path, init, refreshed);

    if (response.status === 401) {
      // Yangi token ham rad etildi — sessiya haqiqatan tugagan
      // (rol o'zgargan, bloklangan yoki parol reset qilingan).
      writeSession(null);
      throw new SessionExpiredError();
    }
  }

  const payload = await parseEnvelope<T>(response);

  if (!response.ok || !payload.success || payload.data === undefined) {
    throw new Error(payload.error?.message ?? "Request failed");
  }

  return payload.data;
}

async function requestWithSession(
  path: string,
  init: RequestInit | undefined,
  session: AuthSession | null,
): Promise<Response> {
  return fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(session
        ? { Authorization: `${session.tokens.tokenType} ${session.tokens.accessToken}` }
        : {}),
      ...init?.headers,
    },
  });
}

async function refreshSession(session: AuthSession): Promise<AuthSession | null> {
  refreshInFlight ??= performRefresh(session).finally(() => {
    refreshInFlight = null;
  });

  return refreshInFlight;
}

async function performRefresh(session: AuthSession): Promise<AuthSession | null> {
  /*
   * Boshqa bir so'rov biz kutayotgan vaqtda yangilab ulgurgan bo'lishi mumkin.
   * Saqlangan token o'zgargan bo'lsa, uni ishlatamiz.
   */
  const current = readSession();

  if (current && current.tokens.accessToken !== session.tokens.accessToken) {
    return current;
  }

  let response: Response;

  try {
    response = await fetch(`${getApiBaseUrl()}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: session.tokens.refreshToken }),
    });
  } catch {
    // Tarmoq uzilishi — sessiyani o'chirmaymiz, keyingi urinishda tiklanishi mumkin.
    return null;
  }

  if (!response.ok) {
    writeSession(null);
    return null;
  }

  const payload = await parseEnvelope<AuthSession>(response);

  if (!payload.success || !payload.data) {
    writeSession(null);
    return null;
  }

  writeSession(payload.data);

  return payload.data;
}

async function parseEnvelope<T>(response: Response): Promise<ApiEnvelope<T>> {
  try {
    return (await response.json()) as ApiEnvelope<T>;
  } catch {
    return {
      success: false,
      error: {
        message: response.ok
          ? "Server javobini o'qib bo'lmadi."
          : `Server xatosi: ${response.status}`,
      },
    };
  }
}
