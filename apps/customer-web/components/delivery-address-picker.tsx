"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  Home,
  Pencil,
  Plus,
  RotateCw,
  Trash2,
} from "lucide-react";
import { useCheckoutRuntime } from "../lib/checkout-runtime";

import {
  deliveryAddressText,
  isDeliveryLocation,
  readLastAddressId,
  rememberAddressId,
} from "../lib/delivery-location";
import type {
  DeliveryLocation,
  DeliveryPoint,
  SavedAddress,
} from "../lib/delivery-location";

const DeliveryMap = dynamic(() => import("./delivery-map"), {
  ssr: false,
  loading: () => (
    <div className="mf-map-placeholder" role="status">
      Xarita yuklanmoqda...
    </div>
  ),
});
const emptyDetails = {
  address: "",
  house: "",
  apartment: "",
  entrance: "",
  floor: "",
  landmark: "",
};
type Details = typeof emptyDetails;

export function DeliveryAddressPicker({
  value,
  onChange,
  center,
  error,
  disabled = false,
  onBusyChange,
  onRemove,
}: {
  value: DeliveryLocation | null;
  onChange: (value: DeliveryLocation | null) => void;
  center?: { latitude: number; longitude: number } | null | undefined;
  error?: string | undefined;
  disabled?: boolean;
  onBusyChange?: (busy: boolean) => void;
  onRemove?: (location: DeliveryLocation) => void;
}) {
  const { customer, refreshCustomer, request: apiFetch } = useCheckoutRuntime();
  const [saved, setSaved] = useState<SavedAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [details, setDetails] = useState<Details>(emptyDetails);
  const [point, setPoint] = useState<DeliveryPoint | null>(null);
  const [label, setLabel] = useState("Uy");
  const [save, setSave] = useState(true);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  /*
   * Ko'cha nomi geokoderdan avtomatik to'ldirilganini eslab qolamiz.
   * Foydalanuvchi maydonni O'ZI tahrirlagan bo'lsa, keyingi nuqta tanlash
   * uning yozganini ALMASHTIRMASLIGI kerak — bu eng bezovta qiladigan xato.
   */
  const autoFilledAddress = useRef<string | null>(null);
  const [locatingAddress, setLocatingAddress] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const request = useRef(0);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const operation = useRef(false);
  const draftId = useRef<string | null>(null);
  const currentIsSaved =
    value &&
    saved.some(
      (entry) =>
        entry.location.latitude === value.latitude &&
        entry.location.longitude === value.longitude &&
        entry.location.address === value.address &&
        entry.location.house === value.house,
    );
  const entries: SavedAddress[] =
    value && !currentIsSaved
      ? [
          {
            id: "current-address",
            label: "Tanlangan manzil",
            location: value,
            updatedAt: "",
          },
          ...saved,
        ]
      : saved;
  const selected = entries.find((entry) => entry.id === selectedId);
  const customerId = customer?.id ?? "guest";
  const currentValue = useRef(value);
  currentValue.current = value;
  useEffect(() => {
    onBusyChange?.(busy);
  }, [busy, onBusyChange]);

  /*
   * Xaritada nuqta tanlanganda ko'cha nomini avtomatik to'ldiradi.
   *
   * Ilgari foydalanuvchi ko'chani QO'LDA yozardi — bu checkout'dagi eng
   * ko'p tashlab ketiladigan qadam edi.
   *
   * FAIL-OPEN: geokoder javob bermasa hech narsa ko'rsatilmaydi va maydon
   * bo'sh qoladi — foydalanuvchi baribir qo'lda yoza oladi. Xato xabari
   * ATAYLAB yo'q: bu qulaylik, buyurtma uchun shart emas.
   */
  useEffect(() => {
    if (!editing || !point) return;

    // Foydalanuvchi maydonni o'zi tahrirlagan bo'lsa — tegmaymiz.
    const current = details.address.trim();
    if (current && current !== autoFilledAddress.current) return;

    let cancelled = false;
    // Sur-sur qilganda har bir oraliq nuqta uchun so'rov ketmasligi uchun.
    const timer = setTimeout(() => {
      setLocatingAddress(true);
      const query = new URLSearchParams({
        lat: String(point.latitude),
        lng: String(point.longitude),
        lang: "uz",
      });
      apiFetch<{ label: string; inCity: boolean }>(
        "/geocoding/reverse?" + query.toString(),
      )
        .then((result) => {
          if (cancelled) return;
          const label = result?.label?.trim();
          if (!label) return;
          /*
           * Nominatim to'liq zanjir qaytaradi ("uy, ko'cha, tuman, shahar,
           * viloyat, mamlakat, indeks"). Maydon uzunligi 200 ta belgi va
           * foydalanuvchiga ko'cha darajasi yetarli — boshidagi uch bo'lak
           * olinadi.
           */
          const short = label.split(",").slice(0, 3).join(",").trim();
          autoFilledAddress.current = short;
          setDetails((previous) =>
            previous.address.trim() &&
            previous.address.trim() !== autoFilledAddress.current
              ? previous
              : { ...previous, address: short },
          );
        })
        .catch(() => {
          /* Fail-open: qo'lda kiritish har doim ochiq. */
        })
        .finally(() => {
          if (!cancelled) setLocatingAddress(false);
        });
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    /*
     * `details.address` ATAYLAB bog'liqlikda emas: har bir harf yozilganda
     * effekt qayta ishga tushib, so'rov toshqiniga aylanardi. Yozuvning
     * o'zi `setDetails` ning funksional shaklida qayta tekshiriladi, ya'ni
     * eskirgan qiymat ustiga yozilmaydi.
     */
  }, [editing, point?.latitude, point?.longitude, apiFetch]);

  const addressRequest = useCallback(
    async <T,>(path: string, init?: RequestInit): Promise<T> => {
      if (!customer?.accessToken) return apiFetch<T>(path, init);
      try {
        return await apiFetch<T>(path, {
          ...init,
          accessToken: customer.accessToken,
        });
      } catch (error) {
        if (
          !(error instanceof Error) ||
          !error.message.includes("Sessiya muddati tugagan")
        )
          throw error;
        const refreshed = await refreshCustomer();
        if (!refreshed) throw error;
        return apiFetch<T>(path, {
          ...init,
          accessToken: refreshed.accessToken,
        });
      }
    },
    [customer?.accessToken, refreshCustomer, apiFetch],
  );

  const load = useCallback(async () => {
    if (!customerId) return;
    const version = ++request.current;
    setLoading(true);
    setLoadError(null);
    try {
      const result = await addressRequest<SavedAddress[]>(
        "/customer/me/addresses",
      );
      if (version !== request.current) return;
      const valid = result.filter(
        (entry) =>
          typeof entry.id === "string" && isDeliveryLocation(entry.location),
      );
      setSaved(valid);
      const preferred =
        valid.find((entry) => entry.id === readLastAddressId(customerId)) ??
        valid[0];
      const active = currentValue.current;
      const matching = active
        ? valid.find(
            (entry) =>
              entry.location.latitude === active.latitude &&
              entry.location.longitude === active.longitude &&
              entry.location.address === active.address &&
              entry.location.house === active.house,
          )
        : null;
      setSelectedId((current) =>
        active
          ? (matching?.id ?? "current-address")
          : valid.some((entry) => entry.id === current)
            ? current
            : (preferred?.id ?? null),
      );
      if (!valid.length && !currentValue.current) setEditing(true);
    } catch (error) {
      if (version === request.current) {
        setLoadError(
          error instanceof Error ? error.message : "Manzillar yuklanmadi.",
        );
        setEditing(!currentValue.current);
      }
    } finally {
      if (version === request.current) setLoading(false);
    }
  }, [addressRequest, customerId]);

  useEffect(() => {
    void load();
    return () => {
      request.current++;
    };
  }, [load]);

  function edit(entry?: SavedAddress) {
    setFormError(null);
    const id = entry?.id === "current-address" ? null : (entry?.id ?? null);
    setEditingId(id);
    draftId.current = id;
    setDetails(
      entry
        ? {
            address: entry.location.address,
            house: entry.location.house,
            apartment: entry.location.apartment,
            entrance: entry.location.entrance,
            floor: entry.location.floor,
            landmark: entry.location.landmark,
          }
        : emptyDetails,
    );
    setPoint(entry?.location ?? null);
    setLabel(entry?.label ?? "Uy");
    setSave(true);
    setEditing(true);
  }

  async function confirm() {
    if (operation.current || disabled) return;
    if (
      !point ||
      details.address.trim().length < 3 ||
      !details.house.trim() ||
      (save && !label.trim())
    ) {
      setFormError(
        !point
          ? "Xaritada yetkazish nuqtasini belgilang."
          : !details.address.trim() || details.address.trim().length < 3
            ? "Ko'cha yoki mahalla nomini kiriting."
            : !details.house.trim()
              ? "Uy yoki bino raqamini kiriting."
              : "Manzil nomini kiriting.",
      );
      return;
    }
    const next: DeliveryLocation = {
      ...point,
      ...(Object.fromEntries(
        Object.entries(details).map(([key, text]) => [key, text.trim()]),
      ) as Details),
    };
    operation.current = true;
    setBusy(true);
    setFormError(null);
    try {
      if (save && customerId) {
        const id = editingId ?? draftId.current ?? crypto.randomUUID();
        draftId.current = id;
        const result = await addressRequest<SavedAddress>(
          "/customer/me/addresses/" + encodeURIComponent(id),
          {
            method: "PUT",
            body: JSON.stringify({ label: label.trim(), location: next }),
          },
        );
        if (!mounted.current) return;
        request.current++;
        setLoading(false);
        setLoadError(null);
        setSaved((previous) => [
          result,
          ...previous.filter((entry) => entry.id !== result.id),
        ]);
        setSelectedId(result.id);
        rememberAddressId(customerId, result.id);
      } else {
        setSelectedId(null);
      }
      onChange(next);
      setEditing(false);
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : "Manzil saqlanmadi. Qayta urinib ko'ring.",
      );
    } finally {
      operation.current = false;
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (operation.current) return;
    operation.current = true;
    setBusy(true);
    setFormError(null);
    try {
      const removed = entries.find((entry) => entry.id === id);
      if (id !== "current-address") {
        await addressRequest(
          "/customer/me/addresses/" + encodeURIComponent(id),
          {
            method: "DELETE",
          },
        );
      }
      if (!mounted.current) return;
      request.current++;
      setLoading(false);
      setLoadError(null);
      const remaining = saved.filter((entry) => entry.id !== id);
      setSaved(remaining);
      setDeleteId(null);
      if (removed) onRemove?.(removed.location);
      if (selectedId === id) {
        setSelectedId(remaining[0]?.id ?? null);
        onChange(null);
      }
      if (!remaining.length) edit();
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "Manzil o'chirilmadi.",
      );
    } finally {
      operation.current = false;
      setBusy(false);
    }
  }

  return (
    <fieldset
      className="mf-address-picker"
      disabled={disabled || busy}
      id="delivery-address"
      tabIndex={-1}
    >
      {loadError ? (
        <div className="mf-location-notice" role="alert">
          {loadError}
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
      {loading ? (
        <div className="mf-address-loading" role="status">
          Manzillar yuklanmoqda...
        </div>
      ) : null}
      {!loading && !editing && entries.length > 0 ? (
        <div className="mf-saved-addresses">
          <p className="mf-address-question">Yetkazish manzili</p>
          <div
            role="radiogroup"
            aria-label="Saqlangan manzillar"
            className="mf-saved-list"
          >
            {entries.map((entry) => (
              <div
                className={
                  "mf-saved-row" +
                  (entry.id === selectedId ? " is-selected" : "")
                }
                key={entry.id}
              >
                <label className="mf-saved-select">
                  <input
                    type="radio"
                    name="saved-address"
                    value={entry.id}
                    checked={selectedId === entry.id}
                    onChange={() => {
                      setSelectedId(entry.id);
                      setDeleteId(null);
                    }}
                  />
                  <div>
                    <strong>{entry.label}</strong>
                    <p>{deliveryAddressText(entry.location)}</p>
                  </div>
                </label>
                <div className="mf-saved-tools">
                  <button
                    type="button"
                    className="mf-icon-control"
                    aria-label={entry.label + " manzilini tahrirlash"}
                    title="Tahrirlash"
                    onClick={() => edit(entry)}
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    type="button"
                    className="mf-icon-control"
                    aria-label={entry.label + " manzilini o'chirish"}
                    title="O'chirish"
                    onClick={() => setDeleteId(entry.id)}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                {deleteId === entry.id ? (
                  <div className="mf-address-delete" role="alert">
                    <span>Bu manzil o'chirilsinmi?</span>
                    <button
                      type="button"
                      className="mf-text-command"
                      onClick={() => void remove(entry.id)}
                    >
                      O'chirish
                    </button>
                    <button
                      type="button"
                      className="mf-text-command"
                      onClick={() => setDeleteId(null)}
                    >
                      Bekor qilish
                    </button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
          <div className="mf-address-bottom">
            <button
              type="button"
              className="mf-location-button is-primary"
              disabled={!selected}
              onClick={() => {
                if (!selected || !customerId) return;
                onChange(selected.location);
                rememberAddressId(customerId, selected.id);
              }}
            >
              <Check size={18} />
              Shu manzilga
            </button>
            <button
              type="button"
              className="mf-location-button"
              onClick={() => edit()}
            >
              <Plus size={18} />
              Yangi manzil
            </button>
          </div>
        </div>
      ) : null}
      {editing ? (
        <div className="mf-address-editor">
          <DeliveryMap
            point={point}
            center={center}
            onChange={(next) => {
              setPoint(next);
              setFormError(null);
            }}
          />
          {locatingAddress ? (
            <p className="mf-location-notice" role="status">
              Manzil aniqlanmoqda...
            </p>
          ) : null}
          <div className="mf-address-fields">
            <label className="mf-checkout-field mf-field-wide">
              Ko'cha yoki mahalla
              <input
                className="mf-input"
                autoComplete="address-line1"
                placeholder="Masalan, Amir Temur ko'chasi"
                maxLength={200}
                value={details.address}
                onChange={(event) =>
                  setDetails({ ...details, address: event.target.value })
                }
              />
            </label>
            <label className="mf-checkout-field">
              Uy / bino
              <input
                className="mf-input"
                autoComplete="address-line2"
                placeholder="12A"
                maxLength={40}
                value={details.house}
                onChange={(event) =>
                  setDetails({ ...details, house: event.target.value })
                }
              />
            </label>
            <label className="mf-checkout-field">
              Xonadon
              <input
                className="mf-input"
                placeholder="Ixtiyoriy"
                maxLength={20}
                value={details.apartment}
                onChange={(event) =>
                  setDetails({ ...details, apartment: event.target.value })
                }
              />
            </label>
          </div>
          <details className="mf-address-extra">
            <summary>
              Mo'ljal va kirish tafsilotlari
              <ChevronDown size={17} />
            </summary>
            <div className="mf-address-fields">
              <label className="mf-checkout-field">
                Kirish yo'lagi
                <input
                  className="mf-input"
                  placeholder="2"
                  maxLength={20}
                  value={details.entrance}
                  onChange={(event) =>
                    setDetails({ ...details, entrance: event.target.value })
                  }
                />
              </label>
              <label className="mf-checkout-field">
                Qavat
                <input
                  className="mf-input"
                  placeholder="3"
                  maxLength={20}
                  value={details.floor}
                  onChange={(event) =>
                    setDetails({ ...details, floor: event.target.value })
                  }
                />
              </label>
              <label className="mf-checkout-field mf-field-wide">
                Mo'ljal
                <input
                  className="mf-input"
                  placeholder="Masalan, dorixona yonidagi kirish"
                  maxLength={120}
                  value={details.landmark}
                  onChange={(event) =>
                    setDetails({ ...details, landmark: event.target.value })
                  }
                />
              </label>
            </div>
          </details>
          <label className="mf-save-address">
            <input
              type="checkbox"
              checked={save}
              onChange={(event) => setSave(event.target.checked)}
            />
            <span>Keyingi buyurtmalar uchun saqlash</span>
          </label>
          {save ? (
            <div className="mf-address-labels">
              {["Uy", "Ish"].map((name) => (
                <button
                  type="button"
                  key={name}
                  aria-pressed={label === name}
                  className="mf-location-button"
                  onClick={() => setLabel(name)}
                >
                  <Home size={16} />
                  {name}
                </button>
              ))}
              <input
                className="mf-input"
                aria-label="Manzil nomi"
                maxLength={40}
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                placeholder="Manzil nomi"
              />
            </div>
          ) : null}
          <div className="mf-address-bottom">
            <button
              type="button"
              className="mf-location-button is-primary"
              onClick={() => void confirm()}
            >
              <Check size={18} />
              {busy ? "Saqlanmoqda..." : "Manzilni tasdiqlash"}
            </button>
            {entries.length ? (
              <button
                type="button"
                className="mf-text-command"
                onClick={() => {
                  setEditing(false);
                  setFormError(null);
                }}
              >
                Saqlangan manzillar
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
      {formError || error ? (
        <p className="mf-checkout-error" role="alert">
          {formError ?? error}
        </p>
      ) : null}
    </fieldset>
  );
}
