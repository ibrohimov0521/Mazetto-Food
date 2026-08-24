"use client";

export type ApiEnvelope<T> = {
  success: boolean;
  data?: T;
  error?: { message: string | string[] };
};

export function getApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000/api/v1";
}

type ApiFetchInit = RequestInit & {
  accessToken?: string;
};

export async function apiFetch<T>(path: string, init?: ApiFetchInit): Promise<T> {
  const { accessToken, headers, ...requestInit } = init ?? {};
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...requestInit,
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...headers,
    },
  });
  const payload = (await response.json()) as ApiEnvelope<T>;

  if (!response.ok || !payload.success || payload.data === undefined) {
    throw new Error(Array.isArray(payload.error?.message) ? payload.error.message.join(", ") : payload.error?.message ?? "Request failed");
  }

  return payload.data;
}
