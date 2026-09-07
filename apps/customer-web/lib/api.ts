"use client";

export type ApiEnvelope<T> = {
  success: boolean;
  data?: T;
  error?: { message: string | string[] };
};

export function getApiBaseUrl(): string {
  if (typeof window !== "undefined" && window.location.hostname.endsWith("mazettofood.uz")) {
    return "/api/v1";
  }

  const configuredUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.trim().replace(/\/$/, "");

  if (configuredUrl) {
    return configuredUrl;
  }

  const developmentHost =
    typeof window !== "undefined" ? window.location.hostname : "127.0.0.1";

  return `http://${developmentHost}:4000/api/v1`;
}

type ApiFetchInit = RequestInit & {
  accessToken?: string;
};

const catalogCache = new Map<string, { expiresAt: number; data: unknown }>();
const catalogRequests = new Map<string, Promise<unknown>>();
const catalogTtl = 30_000;

export async function apiFetch<T>(path: string, init?: ApiFetchInit): Promise<T> {
  // Cache only public browsing data. Quotes, branch availability, auth and orders stay fresh.
  const cacheable = typeof window !== "undefined" && init === undefined &&
    /^\/customer\/(?:home|menu\/(?:categories|products)(?:\/[^/?]+)?)(?:\?[^#]*)?$/.test(path);
  if (!cacheable) return requestApi<T>(path, init);

  const key = `${getApiBaseUrl()}${path}`;
  const cached = catalogCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.data as T;
  const pending = catalogRequests.get(key);
  if (pending) return pending as Promise<T>;

  const request = requestApi<T>(path).then((data) => {
    if (catalogCache.size >= 100) catalogCache.delete(catalogCache.keys().next().value!);
    catalogCache.set(key, { data, expiresAt: Date.now() + catalogTtl });
    return data;
  }).finally(() => catalogRequests.delete(key));
  catalogRequests.set(key, request);
  return request;
}

async function requestApi<T>(path: string, init?: ApiFetchInit): Promise<T> {
  const { accessToken, headers, ...requestInit } = init ?? {};
  const requestHeaders = new Headers(headers);
  if (requestInit.body != null && !requestHeaders.has("Content-Type")) {
    requestHeaders.set("Content-Type", "application/json");
  }
  if (accessToken) requestHeaders.set("Authorization", `Bearer ${accessToken}`);
  const timeout = AbortSignal.timeout(15_000);
  const signal = requestInit.signal ? AbortSignal.any([requestInit.signal, timeout]) : timeout;
  let response: Response;
  let payload: ApiEnvelope<T>;

  try {
    response = await fetch(`${getApiBaseUrl()}${path}`, {
      ...requestInit,
      cache: requestInit.cache ?? "no-store",
      headers: requestHeaders,
      signal,
    });
    payload = await parseEnvelope<T>(response);
  } catch {
    if (requestInit.signal?.aborted) throw requestInit.signal.reason;
    if (timeout.aborted) throw new Error("Server javobi kechikmoqda. Qayta urinib ko'ring.");
    throw new Error("Server bilan aloqa uzildi. Qayta urinib ko'ring.");
  }

  if (!response.ok || !payload.success || payload.data === undefined) {
    throw new Error(getCustomerErrorMessage(response, payload));
  }

  return payload.data;
}

function getCustomerErrorMessage<T>(response: Response, payload: ApiEnvelope<T>): string {
  const backendMessage = Array.isArray(payload.error?.message) ? payload.error.message.join(", ") : payload.error?.message;

  if (backendMessage) {
    if (backendMessage.includes("Too many")) {
      return "Juda ko'p urinish bo'ldi. Bir oz kutib qayta urinib ko'ring.";
    }

    if (
      backendMessage.includes("Unauthorized") ||
      backendMessage.includes("customer bearer token") ||
      backendMessage.includes("customer token")
    ) {
      return "Sessiya muddati tugagan. Telefon raqamingizni qayta tasdiqlang.";
    }

    if (backendMessage === "Branch is not accepting orders now") {
      return "Tanlangan filial hozir buyurtma qabul qilmayapti. Iltimos, boshqa filial yoki vaqtni tanlang.";
    }

    if (backendMessage === "Delivery is not available for this branch") {
      return "Tanlangan filialda yetkazib berish mavjud emas.";
    }

    if (backendMessage === "Pickup is not available for this branch") {
      return "Tanlangan filialdan olib ketish hozir mavjud emas.";
    }

    if (backendMessage === "Product not found or unavailable") {
      return "Savatdagi mahsulotlardan biri hozir mavjud emas. Savatni yangilab ko'ring.";
    }

    if (backendMessage === "Modifier is not available for this product") {
      return "Tanlangan qo'shimchalardan biri bu mahsulot uchun mavjud emas.";
    }

    if (backendMessage === "Payment method is not available for customer orders") {
      return "Bu to'lov turi hozircha mavjud emas. Iltimos, naqd to'lovni tanlang.";
    }

    if (backendMessage === "Checkout attempt is already being processed") {
      return "Buyurtma allaqachon yuborilmoqda. Iltimos, bir necha soniya kuting.";
    }

    return backendMessage;
  }

  if (response.status === 401) {
    return "Sessiya muddati tugagan. Telefon raqamingizni qayta tasdiqlang.";
  }

  if (response.status === 404) {
    return "So'ralgan ma'lumot topilmadi.";
  }

  if (response.status >= 500) {
    return "Serverda vaqtinchalik muammo bor. Bir ozdan keyin urinib ko'ring.";
  }

  return "So'rov bajarilmadi. Qayta urinib ko'ring.";
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
