"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { hasPermission } from "../../lib/auth";
import { useAuth } from "./auth-provider";

export function PermissionGuard({
  permission,
  children,
}: {
  permission: string;
  children: React.ReactNode;
}) {
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

    if (!hasPermission(user, permission)) {
      router.replace("/access-denied");
    }
  }, [isReady, permission, router, user]);

  if (!isReady || !user || !hasPermission(user, permission)) {
    return <main className="min-h-screen bg-white" />;
  }

  return <>{children}</>;
}
