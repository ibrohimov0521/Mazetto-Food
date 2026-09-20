"use client";

import { useEffect, useState } from "react";
import { Button } from "../admin-ui/button";

type UpdateStatus = {
  state: "disabled" | "idle" | "checking" | "available" | "downloading" | "downloaded" | "up-to-date" | "error";
  version: string | null;
  percent: number | null;
  message: string | null;
  checkedAt: string | null;
};

export function DesktopUpdateControls() {
  const [status, setStatus] = useState<UpdateStatus | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const bridge = window.mazettoDesktop?.updates;
    if (!bridge) return;
    void bridge.getStatus().then(setStatus).catch(() => undefined);
    return bridge.onStatus(setStatus);
  }, []);

  const bridge = typeof window !== "undefined" ? window.mazettoDesktop?.updates : undefined;
  if (!bridge || status?.state === "disabled") return null;
  const currentState = status?.state ?? "idle";
  const message = currentState === "available" ? `Yangi versiya: ${status?.version ?? "mavjud"}` : currentState === "downloading" ? `Yuklanmoqda: ${status?.percent ?? 0}%` : currentState === "downloaded" ? "Yangilanish tayyor." : status?.message ?? "Yangilanishni tekshirishga tayyor.";
  const check = async () => { setBusy(true); try { setStatus(await bridge.check()); } finally { setBusy(false); } };
  const download = async () => { setBusy(true); try { setStatus(await bridge.download()); } finally { setBusy(false); } };
  return <div className="rounded-mz-card border border-mz-border bg-mz-surface-sunken p-3"><p className="text-sm font-semibold text-mz-text">Ilova yangilanishi</p><p className="mt-1 text-[12px] text-mz-text-muted">{message}</p><div className="mt-2 flex flex-wrap gap-2"><Button isLoading={busy} onClick={() => void check()} size="sm" variant="ghost">Tekshirish</Button>{currentState === "available" ? <Button isLoading={busy} onClick={() => void download()} size="sm">Yuklash</Button> : null}{currentState === "downloaded" ? <Button onClick={() => void bridge.install()} size="sm">O‘rnatish uchun qayta ochish</Button> : null}</div></div>;
}