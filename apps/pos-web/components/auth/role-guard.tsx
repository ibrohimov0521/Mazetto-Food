"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { hasRole } from "../../lib/auth";
import { useAuth } from "./auth-provider";

export function RoleGuard({ roles, children }: { roles: string[]; children: React.ReactNode }) {
  const router = useRouter();
  const { isReady, user } = useAuth();

  useEffect(() => {
    if (!isReady) {
      return;
    }

    if (!user) {
      router.replace("/login");
      return;
    }

    if (!hasRole(user, roles)) {
      router.replace("/access-denied");
    }
  }, [isReady, roles, router, user]);

  if (!isReady || !user || !hasRole(user, roles)) {
    return <GuardShell />;
  }

  return <>{children}</>;
}

function GuardShell() {
  return <main className="min-h-screen bg-white" />;
}
