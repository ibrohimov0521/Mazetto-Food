"use client";

import { authStorageKey, getApiBaseUrl, type AuthSession } from "./auth";

type ApiEnvelope<T> = {
  success: boolean;
  data?: T;
  error?: { message: string };
};

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const stored = window.localStorage.getItem(authStorageKey);
  const session = stored ? (JSON.parse(stored) as AuthSession) : null;
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(session ? { Authorization: `${session.tokens.tokenType} ${session.tokens.accessToken}` } : {}),
      ...init?.headers,
    },
  });
  const payload = (await response.json()) as ApiEnvelope<T>;

  if (!response.ok || !payload.success || payload.data === undefined) {
    throw new Error(payload.error?.message ?? "Request failed");
  }

  return payload.data;
}
