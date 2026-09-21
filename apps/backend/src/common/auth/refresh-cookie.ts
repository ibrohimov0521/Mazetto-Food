import type { Request, Response } from "express";

export const STAFF_REFRESH_COOKIE = "mazetto_staff_refresh";
export const CUSTOMER_REFRESH_COOKIE = "mazetto_customer_refresh";

export function readRefreshToken(request: Request, bodyToken: string | undefined, cookieName: string): string {
  return bodyToken?.trim() || parseCookies(request.headers.cookie)[cookieName] || "";
}

export function setRefreshCookie(response: Response, cookieName: string, token: string, path: string, maxAgeSeconds: number): void {
  response.cookie(cookieName, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path,
    maxAge: maxAgeSeconds * 1000,
  });
}

export function clearRefreshCookie(response: Response, cookieName: string, path: string): void {
  response.clearCookie(cookieName, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path,
  });
}

function parseCookies(raw: string | undefined): Record<string, string> {
  if (!raw) return {};
  return Object.fromEntries(raw.split(";").flatMap((part) => {
    const separator = part.indexOf("=");
    if (separator < 1) return [];
    try {
      return [[part.slice(0, separator).trim(), decodeURIComponent(part.slice(separator + 1).trim())]];
    } catch {
      return [];
    }
  }));
}
