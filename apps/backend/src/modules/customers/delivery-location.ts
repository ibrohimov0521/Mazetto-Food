import { BadRequestException } from "@nestjs/common";
import type { DeliveryLocationDto } from "./dto/delivery-location.dto";

export function normalizeDeliveryLocation(value: DeliveryLocationDto) {
  if (
    !Number.isFinite(value.latitude) ||
    Math.abs(value.latitude) > 90 ||
    !Number.isFinite(value.longitude) ||
    Math.abs(value.longitude) > 180 ||
    (value.address?.trim().length ?? 0) < 3 ||
    !value.house?.trim()
  ) {
    throw new BadRequestException("Manzil va xaritadagi nuqtani tekshiring.");
  }
  return {
    latitude: value.latitude,
    longitude: value.longitude,
    address: value.address.trim(),
    house: value.house.trim(),
    apartment: value.apartment?.trim() ?? "",
    entrance: value.entrance?.trim() ?? "",
    floor: value.floor?.trim() ?? "",
    landmark: value.landmark?.trim() ?? "",
    source: value.source,
    ...(value.accuracyMeters != null
      ? { accuracyMeters: value.accuracyMeters }
      : {}),
  };
}

export function deliveryAddressText(
  location: ReturnType<typeof normalizeDeliveryLocation>,
) {
  return [
    location.address,
    `Uy: ${location.house}`,
    location.apartment && `Xonadon: ${location.apartment}`,
    location.entrance && `Kirish: ${location.entrance}`,
    location.floor && `Qavat: ${location.floor}`,
    location.landmark && `Mo'ljal: ${location.landmark}`,
  ]
    .filter(Boolean)
    .join(", ");
}
