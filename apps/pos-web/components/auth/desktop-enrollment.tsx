"use client";

import { useEffect, useState } from "react";
import { ApiRequestError, apiFetch } from "../../lib/api";
import { useAuth } from "./auth-provider";
import { Button } from "../admin-ui/button";
import { Modal } from "../admin-ui/modal";
import { Icon } from "../admin-ui/icon";

type DesktopRuntimeStatus = {
  deviceId: string;
  mode?: "online" | "offline" | "starting";
};

export function DesktopEnrollmentBadge({
  onEnrolled,
  openOnUnenrolled = false,
}: {
  onEnrolled?: () => void;
  openOnUnenrolled?: boolean;
}) {
  const { session } = useAuth();
  const [isDesktop, setIsDesktop] = useState(false);
  const [deviceId, setDeviceId] = useState("");
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isEnrolled, setIsEnrolled] = useState<boolean | null>(null);
  const [checkAttempt, setCheckAttempt] = useState(0);

  useEffect(() => {
    const desktop = window.navigator.userAgent.includes("MAZETTO-Desktop/");
    setIsDesktop(desktop);
    if (!desktop) return;

    let active = true;
    const refresh = async () => {
      setIsEnrolled(null);
      try {
        const response = await fetch(
          "http://127.0.0.1:7359/desktop/status",
          { cache: "no-store" },
        );
        if (!response.ok) return;
        const payload = (await response.json()) as {
          data?: DesktopRuntimeStatus;
        };
        const nextDeviceId = payload.data?.deviceId ?? "";
        if (!active) return;
        setDeviceId(nextDeviceId);
        if (!nextDeviceId) return;
        if (!session) {
          setIsEnrolled(false);
          return;
        }
        if (payload.data?.mode !== "online") return;
        try {
          await apiFetch("/devices/heartbeat", {
            method: "POST",
            headers: { "x-mazetto-device-id": nextDeviceId },
            body: JSON.stringify({}),
          });
          if (active) setIsEnrolled(true);
        } catch (error) {
          if (active) {
            setIsEnrolled(
              error instanceof ApiRequestError && error.status === 404
                ? false
                : null,
            );
          }
        }
      } catch {
        if (active) setIsEnrolled(null);
      }
    };

    void refresh();
    return () => {
      active = false;
    };
  }, [checkAttempt, session]);
  useEffect(() => {
    if (openOnUnenrolled && isEnrolled === false && deviceId) setOpen(true);
  }, [deviceId, isEnrolled, openOnUnenrolled]);

  if (!isDesktop || !deviceId) return null;

  async function enroll(): Promise<void> {
    if (!code.trim() || isSaving || isEnrolled !== false) return;
    setIsSaving(true);
    setMessage("");
    try {
      const desktopBridge = window.mazettoDesktop?.device;
      if (desktopBridge) {
        await desktopBridge.enroll({ deviceId, enrollmentCode: code.trim() });
      } else {
        await apiFetch("/devices/enroll", {
          method: "POST",
          body: JSON.stringify({ deviceId, enrollmentCode: code.trim() }),
        });
      }
      setMessage("Qurilma muvaffaqiyatli ulandi.");
      setCode("");
      setIsEnrolled(true);
      onEnrolled?.();
    } catch (caught) {
      const reason = caught instanceof Error ? caught.message : "Noma'lum xato";
      setMessage(
        reason === "Failed to fetch"
          ? "Desktop serveriga ulanib bo'lmadi. Ilovani qayta ishga tushiring."
          : reason,
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <button
        aria-label="Qurilmani ulash"
        className={`flex h-8 shrink-0 items-center gap-1 rounded-mz-control border px-2 text-[11px] font-bold transition ${isEnrolled ? "border-emerald-300/60 bg-emerald-400/15 text-emerald-100" : "border-mz-info/50 bg-mz-surface-sunken text-mz-info hover:bg-white hover:text-mz-info"}`}
        onClick={() => setOpen(true)}
        title={
          isEnrolled === true
            ? "Qurilma ulangan"
            : isEnrolled === false
              ? "Qurilmani filialga ulash"
              : "Qurilma holatini tekshirib bo'lmadi"
        }
        type="button"
      >
        <Icon name="monitor" />
        <span className="hidden sm:inline">Qurilma</span>
      </button>
      <Modal
        footer={isEnrolled === true ? (
          <Button onClick={() => setOpen(false)} size="lg">Tayyor</Button>
        ) : isEnrolled === false ? (
          <>
            <Button onClick={() => setOpen(false)} variant="ghost">Yopish</Button>
            <Button disabled={!code.trim()} isLoading={isSaving} onClick={() => void enroll()}>
              Ulash
            </Button>
          </>
        ) : (
          <>
            <Button onClick={() => setOpen(false)} variant="ghost">Yopish</Button>
            <Button onClick={() => setCheckAttempt((value) => value + 1)}>
              Qayta tekshirish
            </Button>
          </>
        )}
        isOpen={open}
        onClose={() => setOpen(false)}
        title="Qurilmani ulash"
      >
        {isEnrolled === true ? (
          <div className="grid gap-3">
            <p className="text-sm font-semibold text-emerald-700">Qurilma ulangan</p>
            <p className="text-sm text-mz-text-muted">Bu kompyuter serverda tasdiqlangan. Buyurtma va kassa amallaridan foydalanishi mumkin.</p>
            <div className="rounded-mz-card border border-mz-border bg-mz-surface-sunken p-3 text-xs text-mz-text-muted">Qurilma ID: <span className="font-mono text-mz-text">{deviceId}</span></div>
          </div>
        ) : isEnrolled === false ? (
          <div className="grid gap-3">
            <p className="text-sm text-mz-text-muted">Admin panelda yaratilgan bir martalik kodni kiriting. Tasdiqlanmaguncha ushbu desktop ish amallaridan foydalana olmaydi.</p>
            <div className="rounded-mz-card border border-mz-border bg-mz-surface-sunken p-3 text-xs text-mz-text-muted">Qurilma ID: <span className="font-mono text-mz-text">{deviceId}</span></div>
            <label className="grid gap-1 text-sm font-medium text-mz-text">Ulanish kodi<input autoFocus className="h-11 rounded-mz-control border border-mz-border bg-mz-surface px-3 font-mono uppercase tracking-[0.16em] outline-none focus:border-mz-info" maxLength={32} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder="ABC123..." value={code} /></label>
            {message ? <p className="text-sm text-mz-text-muted" role="status">{message}</p> : null}
          </div>
        ) : (
          <p className="text-sm text-mz-text-muted" role="status">
            Qurilma ulanish holatini aniqlab bo'lmadi. Bu qurilma ulanmagan degani emas; server yoki tarmoq aloqasi tiklangach qayta tekshiring.
          </p>
        )}
      </Modal>
    </>
  );
}
