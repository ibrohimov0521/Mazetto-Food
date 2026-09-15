"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "../../lib/api";
import { Button } from "../admin-ui/button";
import { Modal } from "../admin-ui/modal";
import { Icon } from "../admin-ui/icon";

type DesktopRuntimeStatus = { deviceId: string };

export function DesktopEnrollmentBadge() {
  const [isDesktop, setIsDesktop] = useState(false);
  const [deviceId, setDeviceId] = useState("");
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const desktop = window.navigator.userAgent.includes("MAZETTO-Desktop/");
    setIsDesktop(desktop);
    if (!desktop) return;

    void fetch("http://127.0.0.1:7359/desktop/status", { cache: "no-store" })
      .then((response) => response.json() as Promise<{ data?: DesktopRuntimeStatus }>)
      .then((payload) => setDeviceId(payload.data?.deviceId ?? ""))
      .catch(() => undefined);
  }, []);

  if (!isDesktop || !deviceId) return null;

  async function enroll(): Promise<void> {
    if (!code.trim() || isSaving) return;
    setIsSaving(true);
    setMessage("");
    try {
      await apiFetch("/devices/enroll", {
        method: "POST",
        body: JSON.stringify({ deviceId, enrollmentCode: code.trim() }),
      });
      await apiFetch("/devices/heartbeat", {
        method: "POST",
        headers: { "x-mazetto-device-id": deviceId },
        body: JSON.stringify({}),
      });
      setMessage("Qurilma muvaffaqiyatli ulandi.");
      setCode("");
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Qurilmani ulab bo'lmadi.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <button
        aria-label="Qurilmani ulash"
        className="grid h-7 w-7 shrink-0 place-items-center rounded-mz-control border border-white/20 text-mz-shell-fg-muted transition hover:bg-white/10 hover:text-white"
        onClick={() => setOpen(true)}
        title="Qurilmani filialga ulash"
        type="button"
      >
        <Icon name="monitor" />
      </button>
      <Modal
        footer={
          <>
            <Button onClick={() => setOpen(false)} variant="ghost">Yopish</Button>
            <Button disabled={!code.trim()} isLoading={isSaving} onClick={() => void enroll()}>
              Ulash
            </Button>
          </>
        }
        isOpen={open}
        onClose={() => setOpen(false)}
        title="Qurilmani ulash"
      >
        <div className="grid gap-3">
          <p className="text-sm text-mz-text-muted">
            Admin panelda yaratilgan bir martalik kodni kiriting.
          </p>
          <div className="rounded-mz-card border border-mz-border bg-mz-surface-sunken p-3 text-xs text-mz-text-muted">
            Qurilma ID: <span className="font-mono text-mz-text">{deviceId}</span>
          </div>
          <label className="grid gap-1 text-sm font-medium text-mz-text">
            Ulanish kodi
            <input
              autoFocus
              className="h-11 rounded-mz-control border border-mz-border bg-mz-surface px-3 font-mono uppercase tracking-[0.16em] outline-none focus:border-mz-info"
              maxLength={32}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
              placeholder="ABC123..."
              value={code}
            />
          </label>
          {message ? <p className="text-sm text-mz-text-muted" role="status">{message}</p> : null}
        </div>
      </Modal>
    </>
  );
}
