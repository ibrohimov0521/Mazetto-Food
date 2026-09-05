"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getApiBaseUrl, getPrimaryRedirect, type AuthSession, type AuthUser } from "../../lib/auth";
import { readSession, subscribeToSession, writeSession } from "../../lib/session";

type AuthContextValue = {
  isReady: boolean;
  session: AuthSession | null;
  user: AuthUser | null;
  login: (identifier: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

type CurrentShiftResponse = {
  status?: string;
} | null;

type ApiEnvelope<T> = {
  success: boolean;
  data?: T;
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    setSession(readSession());
    setIsReady(true);
  }, []);

  /*
   * `lib/api.ts` token yangilaganda yoki sessiya tugaganini aniqlaganda
   * shu yerga xabar keladi. Sessiya yo'qolgan bo'lsa login'ga yo'naltiramiz.
   */
  useEffect(() => {
    return subscribeToSession((nextSession) => {
      setSession(nextSession);

      if (!nextSession) {
        router.replace("/login");
      }
    });
  }, [router]);

  const login = useCallback(
    async (identifier: string, password: string) => {
      const response = await fetch(`${getApiBaseUrl()}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password }),
      });
      const payload = (await response.json()) as {
        success: boolean;
        data?: AuthSession;
        error?: { message: string };
      };

      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error?.message ?? "Login failed");
      }

      writeSession(payload.data);
      router.replace(await getLoginRedirect(payload.data));
    },
    [router],
  );

  const logout = useCallback(async () => {
    const refreshToken = session?.tokens.refreshToken;

    if (refreshToken) {
      await fetch(`${getApiBaseUrl()}/auth/logout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      }).catch(() => undefined);
    }

    // Sessiyani tozalash login'ga yo'naltirishni ham ishga tushiradi (yuqoridagi subscribe).
    writeSession(null);
  }, [session?.tokens.refreshToken]);

  const value = useMemo<AuthContextValue>(
    () => ({
      isReady,
      session,
      user: session?.user ?? null,
      login,
      logout,
    }),
    [isReady, login, logout, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

async function getLoginRedirect(session: AuthSession): Promise<string> {
  const fallbackRedirect = getPrimaryRedirect(session.user.roles);

  if (fallbackRedirect !== "/shift") {
    return fallbackRedirect;
  }

  try {
    const response = await fetch(`${getApiBaseUrl()}/cash-register/shift`, {
      headers: { Authorization: `${session.tokens.tokenType} ${session.tokens.accessToken}` },
    });
    const payload = (await response.json()) as ApiEnvelope<CurrentShiftResponse>;

    return response.ok && payload.success && payload.data?.status === "OPEN" ? "/pos" : "/shift";
  } catch {
    return "/shift";
  }
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);

  if (!value) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return value;
}
