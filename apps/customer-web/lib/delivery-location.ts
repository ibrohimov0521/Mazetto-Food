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
    Number.isFinite(location.latitude) &&
    Math.abs(location.latitude) <= 90 &&
    Number.isFinite(location.longitude) &&
    Math.abs(location.longitude) <= 180 &&
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
