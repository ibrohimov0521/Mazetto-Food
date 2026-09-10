import { isWithinTashkent } from "./tashkent-bounds";

export type DeliveryPoint = {
  latitude: number;
  longitude: number;
  source: "gps" | "map";
  accuracyMeters?: number;
};
export type DeliveryLocation = DeliveryPoint & {
  address: string;
  house: string;
  apartment: string;
  entrance: string;
  floor: string;
  landmark: string;
};
export type SavedAddress = {
  id: string;
  label: string;
  location: DeliveryLocation;
  updatedAt: string;
};

export function isDeliveryLocation(value: unknown): value is DeliveryLocation {
  if (!value || typeof value !== "object") return false;
  const location = value as DeliveryLocation;
  return (
    /*
     * Zona tekshiruvi shu yerda ham kerak: bu funksiya localStorage'dan va
     * serverdan kelgan SAQLANGAN manzillarni ham tekshiradi. Zona
     * toraytirilsa, eski manzil endi yaroqsiz bo'lib qoladi va uni jimgina
     * checkout'ga o'tkazib yuborish serverdan 400 keltirardi.
     */
    isWithinTashkent(location.latitude, location.longitude) &&
    typeof location.address === "string" &&
    Boolean(location.address.trim()) &&
    typeof location.house === "string" &&
    Boolean(location.house.trim()) &&
    ["gps", "map"].includes(location.source) &&
    ["apartment", "entrance", "floor", "landmark"].every(
      (key) => typeof location[key as keyof DeliveryLocation] === "string",
    )
  );
}

export function deliveryAddressText(location: DeliveryLocation) {
  return [
    location.address,
    "Uy: " + location.house,
    location.apartment && "Xonadon: " + location.apartment,
    location.entrance && "Kirish: " + location.entrance,
    location.floor && "Qavat: " + location.floor,
    location.landmark && "Mo'ljal: " + location.landmark,
  ]
    .filter(Boolean)
    .join(", ");
}

export function readLastAddressId(customerId: string): string | null {
  try {
    return localStorage.getItem("mazetto.customer.lastAddress." + customerId);
  } catch {
    return null;
  }
}
export function rememberAddressId(customerId: string, id: string) {
  try {
    localStorage.setItem("mazetto.customer.lastAddress." + customerId, id);
  } catch {
    /* Server persistence remains available when browser storage is blocked. */
  }
}
