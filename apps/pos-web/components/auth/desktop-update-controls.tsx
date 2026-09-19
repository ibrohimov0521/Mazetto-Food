"use client";

import { useEffect, useState } from "react";
import { Button } from "../admin-ui/button";

export function DesktopUpdateControls() {
  const [status, setStatus] = useState<DesktopUpdateStatus | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const bridge = window.mazettoDesktop?.updates;
    if (!bridge) return;
    void bridge.getStatus().then(setStatus).catch(() => undefined);
    return bridge.onStatus(setStatus);
  }, []);

  if (!window.mazettoDesktop?.updates || status?.state === "disabled") return null;
  const message = status?.state === "available" ? `Yangi versiya: ${status.version}` : status?.state === "downloading" ? `Yuklanmoqda: ${status.percent ?? 0}%` : status?.state === "downloaded" ? "Yangilanish tayyor." : status?.message ?? "Yangilanish holati tekshirilmagan.";
  const check = async () => { setBusy(true); try { setStatus(await window.mazettoDesktop!.updates!.check()); } finally { setBusy(false); } };
  const download = async () => { setBusy(true); try { setStatus(await window.mazettoDesktop!.updates!.download()); } finally { setBusy(false); } };
  return <div className="rounded-mz-card border border-mz-border bg-mz-surface-sunken p-3"><p className="text-sm font-semibold text-mz-text">Ilova yangilanishi</p><p className="mt-1 text-[12px] text-mz-text-muted">{message}</p><div className="mt-2 flex flex-wrap gap-2"><Button isLoading={busy} onClick={() => void check()} size="sm" variant="ghost">Tekshirish</Button>{status?.state === "available" ? <Button isLoading={busy} onClick={() => void download()} size="sm">Yuklash</Button> : null}{status?.state === "downloaded" ? <Button onClick={() => void window.mazettoDesktop!.updates!.install()} size="sm">O‘rnatish uchun qayta ochish</Button> : null}</div></div>;
}