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
  let response: Response;

  try {
    response = await fetch(`${getApiBaseUrl()}${path}`, {
      ...requestInit,
      headers: {
        "Content-Type": "application/json",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...headers,
      },
    });
  } catch {
    throw new Error("Server bilan aloqa uzildi. Qayta urinib ko'ring.");
  }

  const payload = await parseEnvelope<T>(response);

  if (!response.ok || !payload.success || payload.data === undefined) {
    throw new Error(Array.isArray(payload.error?.message) ? payload.error.message.join(", ") : payload.error?.message ?? "Request failed");
  }

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
