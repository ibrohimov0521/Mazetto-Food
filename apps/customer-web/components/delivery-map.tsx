"use client";

import { useEffect, useRef, useState } from "react";
import { LocateFixed, MapPin, Minus, Plus, RotateCw } from "lucide-react";
import type { Map as LeafletMap } from "leaflet";
import type { DeliveryPoint } from "../lib/delivery-location";

type Props = {
  point: DeliveryPoint | null;
  center?: { latitude: number; longitude: number } | null | undefined;
  onChange: (point: DeliveryPoint) => void;
};

export default function DeliveryMap({ point, center, onChange }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const callback = useRef(onChange);
  const currentPoint = useRef(point);
  const initialCenter = useRef(
    point ?? center ?? { latitude: 41.3111, longitude: 69.2797 },
  );
  const gpsRequest = useRef(0);
  const gpsTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const [attempt, setAttempt] = useState(0);
  const [ready, setReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  callback.current = onChange;
  currentPoint.current = point;
  if (!point && center) initialCenter.current = center;

  useEffect(() => {
    let disposed = false;
    let resize: ResizeObserver | undefined;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let instance: LeafletMap | undefined;
    let keyboard: ((event: KeyboardEvent) => void) | undefined;
    const element = container.current;
    setLocating(false);
    setReady(false);
    setMapError(null);
    void import("leaflet")
      .then((L) => {
        if (disposed || !container.current) return;
        const initial = currentPoint.current ?? initialCenter.current;
        instance = L.map(container.current, {
          zoomControl: false,
          scrollWheelZoom: false,
          attributionControl: true,
          zoomAnimation: false,
          fadeAnimation: false,
          markerZoomAnimation: false,
        }).setView(
          [initial.latitude, initial.longitude],
          currentPoint.current ? 17 : 14,
        );
        map.current = instance;
        const tiles = L.tileLayer(
          process.env.NEXT_PUBLIC_MAP_TILE_URL ||
            "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
          {
            maxZoom: 19,
            keepBuffer: 1,
            attribution:
              process.env.NEXT_PUBLIC_MAP_ATTRIBUTION ||
              '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>',
          },
        ).addTo(instance);
        let loaded = 0;
        timeout = setTimeout(() => {
          if (!disposed && !loaded)
            setMapError("Xarita yuklanishi kechikmoqda.");
        }, 10000);
        tiles.on("tileload", () => {
          loaded++;
          if (!disposed) {
            setMapError(null);
            setReady(true);
          }
          clearTimeout(timeout);
        });
        tiles.on("tileerror", () => {
          if (!disposed && !loaded)
            setMapError("Xarita yuklanmadi. Internet aloqasini tekshiring.");
        });
        instance.on(
          "click",
          (event: { latlng: { lat: number; lng: number } }) => {
            gpsRequest.current++;
            clearTimeout(gpsTimeout.current);
            setGpsError(null);
            setLocating(false);
            const position = L.latLng(
              event.latlng.lat,
              event.latlng.lng,
            ).wrap();
            const next = {
              latitude: position.lat,
              longitude: position.lng,
              source: "map" as const,
            };
            callback.current(next);
            instance?.panTo(event.latlng, { animate: false });
          },
        );
        let userMove = false;
        const beginMove = () => {
          userMove = true;
          gpsRequest.current++;
          clearTimeout(gpsTimeout.current);
          setGpsError(null);
          setLocating(false);
        };
        instance.on("dragstart", beginMove);
        keyboard = (event) => {
          if (
            ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(
              event.key,
            )
          )
            beginMove();
        };
        element?.addEventListener("keydown", keyboard, true);
        instance.on("moveend", () => {
          if (!instance || !userMove) return;
          userMove = false;
          const position = instance.getCenter().wrap();
          const previous = currentPoint.current;
          if (
            previous &&
            Math.abs(position.lat - previous.latitude) < 0.000001 &&
            Math.abs(position.lng - previous.longitude) < 0.000001
          )
            return;
          gpsRequest.current++;
          setLocating(false);
          callback.current({
            latitude: position.lat,
            longitude: position.lng,
            source: "map",
          });
        });
        resize = new ResizeObserver(() =>
          instance?.invalidateSize({ pan: false }),
        );
        resize.observe(container.current);
      })
      .catch(() => {
        if (!disposed) setMapError("Xarita ochilmadi. Qayta urinib ko'ring.");
      });
    return () => {
      disposed = true;
      gpsRequest.current++;
      clearTimeout(gpsTimeout.current);
      clearTimeout(timeout);
      resize?.disconnect();
      if (keyboard) element?.removeEventListener("keydown", keyboard, true);
      instance?.remove();
      map.current = null;
    };
  }, [attempt]);

  useEffect(() => {
    if (!point && center && map.current) {
      map.current.setView([center.latitude, center.longitude], 14, {
        animate: false,
      });
    }
  }, [center, point]);

  useEffect(() => {
    if (!point || !map.current) return;
    const current = map.current.getCenter();
    if (
      Math.abs(current.lat - point.latitude) > 0.000001 ||
      Math.abs(current.lng - point.longitude) > 0.000001
    ) {
      map.current.setView([point.latitude, point.longitude], 17, {
        animate: false,
      });
    }
  }, [point]);

  function locate() {
    if (!window.isSecureContext) {
      setGpsError(
        "Joylashuv uchun saytni xavfsiz HTTPS manzilidan oching. Xaritadan ham tanlashingiz mumkin.",
      );
      return;
    }
    if (!navigator.geolocation) {
      setGpsError(
        "Bu brauzer joylashuvni aniqlay olmaydi. Xaritadan manzil tanlang.",
      );
      return;
    }
    const request = ++gpsRequest.current;
    clearTimeout(gpsTimeout.current);
    setLocating(true);
    setGpsError(null);
    const fail = (message: string) => {
      if (request !== gpsRequest.current) return;
      gpsRequest.current++;
      clearTimeout(gpsTimeout.current);
      setLocating(false);
      setGpsError(message);
    };
    // Some devices keep waiting for a permission prompt beyond the native timeout.
    gpsTimeout.current = setTimeout(
      () =>
        fail(
          "Joylashuv aniqlash vaqti tugadi. Ruxsatni tekshiring yoki xaritadan tanlang.",
        ),
      12000,
    );
    try {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          if (request !== gpsRequest.current) return;
          clearTimeout(gpsTimeout.current);
          if (
            !Number.isFinite(position.coords.latitude) ||
            !Number.isFinite(position.coords.longitude)
          ) {
            fail("Joylashuv aniqlanmadi. Xaritadan manzilni belgilang.");
            return;
          }
          setLocating(false);
          callback.current({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracyMeters: Math.min(position.coords.accuracy, 100000),
            source: "gps",
          });
        },
        (error) => {
          fail(
            error.code === 1
              ? "Joylashuvga ruxsat berilmadi. Xaritadan manzilni belgilang."
              : "Joylashuv aniqlanmadi. Qayta urining yoki xaritadan tanlang.",
          );
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
      );
    } catch {
      fail("Joylashuvni aniqlab bo'lmadi. Xaritadan manzilni belgilang.");
    }
  }

  return (
    <div className="mf-delivery-map">
      <div className="mf-map-surface">
        <div
          className="mf-map-canvas"
          ref={container}
          aria-label="Yetkazish manzili xaritasi"
        />
        {!ready && !mapError ? (
          <div className="mf-map-loading" role="status">
            Xarita yuklanmoqda...
          </div>
        ) : null}
        <MapPin
          className={"mf-map-pin" + (point ? " is-selected" : "")}
          size={38}
          strokeWidth={2.5}
          aria-hidden="true"
        />
        <div className="mf-map-zoom">
          <button
            type="button"
            className="mf-icon-control"
            aria-label="Xaritani yaqinlashtirish"
            title="Yaqinlashtirish"
            onClick={() => map.current?.zoomIn()}
          >
            <Plus size={20} />
          </button>
          <button
            type="button"
            className="mf-icon-control"
            aria-label="Xaritani uzoqlashtirish"
            title="Uzoqlashtirish"
            onClick={() => map.current?.zoomOut()}
          >
            <Minus size={20} />
          </button>
        </div>
      </div>
      <div className="mf-map-actions">
        <button
          type="button"
          className="mf-location-button is-primary"
          onClick={locate}
          disabled={locating}
        >
          <LocateFixed size={18} />
          <span>{locating ? "Aniqlanmoqda..." : "Joylashuvimni aniqlash"}</span>
        </button>
        <span
          className={"mf-point-status" + (point ? " is-selected" : "")}
          role="status"
        >
          <MapPin size={15} />
          {point ? "Nuqta belgilandi" : "Nuqta tanlanmagan"}
        </span>
      </div>
      {point?.source === "gps" && (point.accuracyMeters ?? 0) > 100 ? (
        <p className="mf-location-notice">
          GPS aniqligi past. Bino joyini xaritada tekshiring.
        </p>
      ) : null}
      {gpsError ? (
        <p className="mf-location-notice" role="alert">
          {gpsError}
        </p>
      ) : null}
      {mapError ? (
        <div className="mf-location-notice" role="alert">
          <span>{mapError}</span>
          <button
            type="button"
            className="mf-text-command"
            onClick={() => setAttempt((value) => value + 1)}
          >
            <RotateCw size={16} />
            Qayta yuklash
          </button>
        </div>
      ) : null}
    </div>
  );
}
