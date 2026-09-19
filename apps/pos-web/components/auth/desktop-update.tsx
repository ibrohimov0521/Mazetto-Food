"use client";

import { Download, RefreshCw, RotateCw } from "lucide-react";
import { useEffect, useState } from "react";

type UpdateStatus = NonNullable<
  Window["mazettoDesktop"]
>["updates"] extends infer T
  ? T extends { getStatus: () => Promise<infer S> }
    ? S
    : never
  : never;

export function DesktopUpdateBadge() {
  const [isDesktop, setIsDesktop] = useState(false);
  const [status, setStatus] = useState<UpdateStatus | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const bridge = window.mazettoDesktop?.updates;
    const desktop = window.navigator.userAgent.includes("MAZETTO-Desktop/");
    setIsDesktop(desktop);
    if (!desktop || !bridge) {
      return;
    }

    void bridge.getStatus().then(setStatus).catch(() => undefined);
    return bridge.onStatus(setStatus);
  }, []);

  if (!isDesktop || !status) {
    return null;
  }

  const isReady = status.state === "downloaded";
  const isDownloading = status.state === "downloading";
  const isChecking = status.state === "checking";
  const currentState = status.state;
  const label = isReady
    ? "O'rnatish"
    : isDownloading
      ? `%${status.percent ?? 0}`
      : isChecking
        ? "Tekshirilmoqda"
        : currentState === "available"
          ? "Yuklash"
          : "Yangilanish";
  const Icon = isReady ? RotateCw : isDownloading ? Download : RefreshCw;

  async function handleClick(): Promise<void> {
    const bridge = window.mazettoDesktop?.updates;
    if (!bridge || busy || isDownloading || isChecking) return;
    setBusy(true);
    try {
      if (isReady) {
        setStatus(await bridge.install());
      } else if (currentState === "available") {
        setStatus(await bridge.download());
      } else {
        setStatus(await bridge.check());
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      aria-label={isReady ? "Yangilanishni o'rnatish" : "Yangilanishlarni tekshirish"}
      className={`flex h-7 shrink-0 items-center gap-1 rounded-mz-pill border px-2 text-[10px] font-bold transition hover:bg-white/10 disabled:opacity-60 ${
        isReady
          ? "border-emerald-300/60 bg-emerald-300/15 text-emerald-100"
          : currentState === "error"
            ? "border-rose-300/60 bg-rose-300/10 text-rose-100"
            : "border-sky-300/50 bg-sky-300/10 text-sky-100"
      }`}
      disabled={busy || isDownloading || isChecking}
      onClick={() => void handleClick()}
      title={
        status.message ??
        (status.version ? `Versiya ${status.version}` : "Yangilanishlarni tekshirish")
      }
      type="button"
    >
      <Icon aria-hidden="true" className={busy || isChecking ? "animate-spin" : ""} size={13} />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}