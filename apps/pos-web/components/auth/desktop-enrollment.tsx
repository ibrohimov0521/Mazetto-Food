"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "../../lib/api";
import { useAuth } from "./auth-provider";
import { Button } from "../admin-ui/button";
import { Modal } from "../admin-ui/modal";
import { Icon } from "../admin-ui/icon";

type DesktopRuntimeStatus = { deviceId: string };

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

  useEffect(() => {
    const desktop = window.navigator.userAgent.includes("MAZETTO-Desktop/");
    setIsDesktop(desktop);
    if (!desktop) return;

    void fetch("http://127.0.0.1:7359/desktop/status", { cache: "no-store" })
      .then((response) => response.json() as Promise<{ data?: DesktopRuntimeStatus }>)
      .then(async (payload) => {
        const nextDeviceId = payload.data?.deviceId ?? "";
        setDeviceId(nextDeviceId);
        if (!nextDeviceId) return;
        if (!session) {
          setIsEnrolled(false);
          return;
        }
        try {
          await apiFetch("/devices/heartbeat", {
            method: "POST",
            headers: { "x-mazetto-device-id": nextDeviceId },
            body: JSON.stringify({}),
          });
          setIsEnrolled(true);
        } catch {
          setIsEnrolled(false);
        }
      })
      .catch(() => setIsEnrolled(false));
  }, [session]);
  useEffect(() => {
    if (openOnUnenrolled && isEnrolled === false && deviceId) setOpen(true);
  }, [deviceId, isEnrolled, openOnUnenrolled]);

  if (!isDesktop || !deviceId) return null;

  async function enroll(): Promise<void> {
    if (!code.trim() || isSaving) return;
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
      if (session) {
        await apiFetch("/devices/heartbeat", {
          method: "POST",
          headers: { "x-mazetto-device-id": deviceId },
          body: JSON.stringify({}),
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
        title={isEnrolled ? "Qurilma ulangan" : "Qurilmani filialga ulash"}
        type="button"
      >
        <Icon name="monitor" />
        <span className="hidden sm:inline">Qurilma</span>
      </button>
      <Modal
        footer={isEnrolled ? (
          <Button onClick={() => setOpen(false)} size="lg">Tayyor</Button>
        ) : (
          <>
            <Button onClick={() => setOpen(false)} variant="ghost">Yopish</Button>
            <Button disabled={!code.trim()} isLoading={isSaving} onClick={() => void enroll()}>
              Ulash
            </Button>
          </>
        )}
        isOpen={open}
        onClose={() => setOpen(false)}
        title="Qurilmani ulash"
      >
        {isEnrolled ? (
          <div className="grid gap-3">
            <p className="text-sm font-semibold text-emerald-700">Qurilma ulangan</p>
            <p className="text-sm text-mz-text-muted">Bu kompyuter serverda tasdiqlangan. Buyurtma va kassa amallaridan foydalanishi mumkin.</p>
            <div className="rounded-mz-card border border-mz-border bg-mz-surface-sunken p-3 text-xs text-mz-text-muted">Qurilma ID: <span className="font-mono text-mz-text">{deviceId}</span></div>
          </div>
        ) : (
          <div className="grid gap-3">
            <p className="text-sm text-mz-text-muted">Admin panelda yaratilgan bir martalik kodni kiriting. Tasdiqlanmaguncha ushbu desktop ish amallaridan foydalana olmaydi.</p>
            <div className="rounded-mz-card border border-mz-border bg-mz-surface-sunken p-3 text-xs text-mz-text-muted">Qurilma ID: <span className="font-mono text-mz-text">{deviceId}</span></div>
            <label className="grid gap-1 text-sm font-medium text-mz-text">Ulanish kodi<input autoFocus className="h-11 rounded-mz-control border border-mz-border bg-mz-surface px-3 font-mono uppercase tracking-[0.16em] outline-none focus:border-mz-info" maxLength={32} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder="ABC123..." value={code} /></label>
            {message ? <p className="text-sm text-mz-text-muted" role="status">{message}</p> : null}
          </div>
        )}
      </Modal>
    </>
  );
}
