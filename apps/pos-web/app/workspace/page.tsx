"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../components/auth/auth-provider";
import { getPrimaryRedirect } from "../../lib/auth";

export default function WorkspacePage() {
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

    router.replace(getPrimaryRedirect(user.roles));
  }, [isReady, router, user]);

  return <main className="min-h-screen bg-white" />;
}
