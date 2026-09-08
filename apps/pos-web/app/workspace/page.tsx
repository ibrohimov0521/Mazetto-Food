"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AuthShell } from "../../components/auth/auth-shell";
import { useAuth } from "../../components/auth/auth-provider";
import { getAccessiblePanels } from "../../lib/auth";

export default function WorkspacePage() {
  const router = useRouter();
  const { isReady, user } = useAuth();
  const panels = getAccessiblePanels(user);

  useEffect(() => {
    if (!isReady) {
      return;
    }

    if (!user) {
      router.replace("/login");
      return;
    }

    const onlyPanel = panels[0];

    if (panels.length === 1 && onlyPanel) {
      router.replace(onlyPanel.href);
    }
  }, [isReady, panels, router, user]);

  if (!isReady || !user) {
    return <main className="min-h-screen bg-white" />;
  }

  return (
    <AuthShell eyebrow="Ish joyi" title="Panelni tanlang">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {panels.map((panel) => (
          <Link
            className="group rounded-mz-card border border-mz-border bg-white p-5 shadow-[0_18px_55px_rgba(15,118,110,0.10)] transition hover:-translate-y-0.5 hover:border-[#ffd52e] hover:shadow-[0_20px_60px_rgba(15,118,110,0.16)]"
            href={panel.href}
            key={panel.href}
          >
            <p className="text-xs font-black uppercase text-[#008579]">
              MAZETTO FOOD
            </p>
            <h2 className="mt-3 text-2xl font-black text-[#053f3a]">
              {panel.title}
            </h2>
            <p className="mt-2 min-h-10 text-sm font-medium leading-6 text-neutral-600">
              {panel.description}
            </p>
            <span className="mt-5 inline-flex rounded-mz-control bg-[#ffd52e] px-4 py-2 text-sm font-black text-[#053f3a] transition group-hover:bg-[#ffe66b]">
              Kirish
            </span>
          </Link>
        ))}
      </section>
    </AuthShell>
  );
}
