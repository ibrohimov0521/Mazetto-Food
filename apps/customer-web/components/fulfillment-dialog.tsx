"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, MapPin, RotateCw, ShoppingBag, Truck, X } from "lucide-react";
import { DeliveryAddressPicker } from "./delivery-address-picker";
import { useCheckoutRuntime } from "../lib/checkout-runtime";
import type { Fulfillment } from "../lib/fulfillment";
import type { Branch } from "../lib/types";
import type { DeliveryLocation } from "../lib/delivery-location";
import "leaflet/dist/leaflet.css";
import "../app/checkout/checkout.css";
import "./fulfillment-dialog.css";

export default function FulfillmentDialog({
  initial,
  onConfirm,
  onClose,
}: {
  initial: Fulfillment | null;
  onConfirm: (value: Fulfillment) => void;
  onClose: () => void;
}) {
  const { request: apiFetch, customer, preview } = useCheckoutRuntime();
  const dialog = useRef<HTMLDialogElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  const [type, setType] = useState<"DELIVERY" | "PICKUP">(
    initial?.type ?? "DELIVERY",
  );
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState(() => {
    if (initial?.branchId) return initial.branchId;
    if (preview) return "";
    try {
      return localStorage.getItem("mazetto.customer.branchId") ?? "";
    } catch {
      return "";
    }
  });
  const [location, setLocation] = useState<DeliveryLocation | null>(
    initial?.location ?? null,
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const version = useRef(0);
  const branch = branches.find((item) => item.id === branchId);
  const supportsMode = (item: Branch) =>
    type === "DELIVERY"
      ? item.deliveryEnabled !== false
      : item.pickupEnabled !== false;
  const available = (item: Branch) =>
    supportsMode(item);
  const isClosedNow = (item: Branch) => item.acceptsOrders === false;
  const enabled = Boolean(branch && available(branch));
  const load = useCallback(async () => {
    const current = ++version.current;
    setLoading(true);
    setError(null);
    try {
      const result = await apiFetch<Branch[]>("/customer/branches");
      if (current !== version.current) return;
      setBranches(result);
    } catch (error) {
      if (current === version.current)
        setError(
          error instanceof Error ? error.message : "Filiallar yuklanmadi.",
        );
    } finally {
      if (current === version.current) setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    void load();
    return () => {
      version.current++;
    };
  }, [load]);
  useEffect(() => {
    if (loading) return;
    if (
      branches.some(
        (item) => item.id === branchId && supportsMode(item),
      )
    )
      return;
    const next = branches.find(
      (item) => supportsMode(item),
    );
    setBranchId(next?.id ?? "");
  }, [branches, branchId, type, loading]);

  useEffect(() => {
    const element = dialog.current;
    const opener =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    element?.showModal();
    return () => {
      element?.close();
      document.body.style.overflow = oldOverflow;
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, []);

  function confirm(nextLocation: DeliveryLocation | null) {
    if (!branch || !enabled || (type === "DELIVERY" && !nextLocation)) return;
    onConfirm({
      type,
      branchId: branch.id,
      branchName: branch.name,
      branchAddress: branch.address ?? "",
      location: type === "DELIVERY" ? nextLocation : null,
    });
  }

  return (
    <dialog
      ref={dialog}
      className="mf-checkout-page mf-fulfillment-dialog"
      aria-labelledby="fulfillment-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!saving) close.current();
      }}
    >
      <header className="mf-fulfillment-header">
        <div>
          <span>Buyurtma manzili</span>
          <h2 id="fulfillment-title">Qabul qilish turini tanlang</h2>
        </div>
        <button
          type="button"
          className="mf-icon-control"
          aria-label="Oynani yopish"
          title="Yopish"
          disabled={saving}
          onClick={onClose}
        >
          <X size={22} />
        </button>
      </header>
      <div
        className="mf-delivery-segment mf-fulfillment-modes"
        role="group"
        aria-label="Qabul qilish usuli"
      >
        <button
          type="button"
          disabled={saving}
          aria-pressed={type === "DELIVERY"}
          onClick={() => setType("DELIVERY")}
        >
          <Truck size={20} />
          <span>Yetkazib berish</span>
        </button>
        <button
          type="button"
          disabled={saving}
          aria-pressed={type === "PICKUP"}
          onClick={() => setType("PICKUP")}
        >
          <ShoppingBag size={20} />
          <span>Olib ketish</span>
        </button>
      </div>
      <div className="mf-fulfillment-body">
        {loading ? (
          <p className="mf-address-loading" role="status">
            Filiallar yuklanmoqda...
          </p>
        ) : null}
        {error ? (
          <div className="mf-checkout-error" role="alert">
            {error}
            <button
              type="button"
              className="mf-text-command"
              onClick={() => void load()}
            >
              <RotateCw size={16} />
              Qayta urinish
            </button>
          </div>
        ) : null}
        {!loading && !error ? (
          <fieldset className="mf-fulfillment-branches" disabled={saving}>
            <legend>
              {type === "PICKUP" ? "Qaysi filialdan olasiz?" : "Filial"}
            </legend>
            {branches.map((item) => (
              <label
                className={
                  "mf-fulfillment-branch" +
                  (item.id === branchId ? " is-selected" : "") +
                  (!available(item) ? " is-unavailable" : "")
                }
                key={item.id}
              >
                <input
                  type="radio"
                  name="fulfillment-branch"
                  checked={item.id === branchId}
                  disabled={!available(item)}
                  onChange={() => setBranchId(item.id)}
                />
                <MapPin size={20} />
                <span>
                  <strong>{item.name}</strong>
                  <small>
                    {item.address ?? ""}
                    {!available(item)
                      ? " - bu usul mavjud emas"
                      : isClosedNow(item) ? " - hozir yopiq" : ""}
                  </small>
                </span>
              </label>
            ))}
            {!branches.length ? (
              <p className="mf-checkout-error">
                Hozir buyurtma qabul qiladigan filial yo'q.
              </p>
            ) : null}
          </fieldset>
        ) : null}
        {type === "DELIVERY" && enabled ? (
          <DeliveryAddressPicker
            key={customer?.id ?? "guest"}
            value={location}
            center={branch?.coordinates}
            onBusyChange={setSaving}
            onChange={(value) => {
              setLocation(value);
              if (value) confirm(value);
            }}
          />
        ) : null}
        {type === "PICKUP" && branch ? (
          <div className="mf-pickup-location">
            <ShoppingBag size={28} />
            <strong>{branch.name}</strong>
            <p>{branch.address}</p>
          </div>
        ) : null}
      </div>
      {type === "PICKUP" ? (
        <footer className="mf-fulfillment-footer">
          <button
            className="mf-checkout-submit"
            type="button"
            disabled={!enabled || loading}
            onClick={() => confirm(null)}
          >
            <Check size={18} />
            Shu filialdan olaman
          </button>
        </footer>
      ) : null}
      {type === "DELIVERY" && location && enabled ? (
        <footer className="mf-fulfillment-footer">
          <button
            className="mf-checkout-submit"
            type="button"
            disabled={saving}
            onClick={() => confirm(location)}
          >
            <Check size={18} />
            Shu manzilga
          </button>
        </footer>
      ) : null}
    </dialog>
  );
}
