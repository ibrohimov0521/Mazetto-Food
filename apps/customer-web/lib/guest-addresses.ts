"use client";

import { apiFetch } from "./api";
import { isDeliveryLocation, type SavedAddress } from "./delivery-location";
const key = "mazetto.customer.guestAddresses.v1";
export const guestApiFetch: typeof apiFetch = async <T>(
  path: string,
  init?: Parameters<typeof apiFetch>[1],
): Promise<T> => {
  if (!/^\/customer\/me\/addresses(?:\/[a-zA-Z0-9-]+)?$/.test(path))
    return apiFetch<T>(path, init);
  let saved: SavedAddress[] = [];
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(key) ?? "[]");
    if (Array.isArray(stored))
      saved = stored.filter(
        (entry: SavedAddress) =>
          typeof entry?.id === "string" &&
          typeof entry?.label === "string" &&
          isDeliveryLocation(entry?.location),
      );
  } catch {
    /* Empty address book if local data is unavailable. */
  }
  const method = init?.method ?? "GET";
  if (method === "GET") return saved as T;
  const id = path.split("/").at(-1)!;
  if (method === "DELETE") {
    localStorage.setItem(
      key,
      JSON.stringify(saved.filter((entry) => entry.id !== id)),
    );
    return { deleted: true } as T;
  }
  if (method === "PUT") {
    const input = JSON.parse(String(init?.body)) as Pick<
      SavedAddress,
      "label" | "location"
    >;
    if (!isDeliveryLocation(input.location) || !input.label.trim())
      throw new Error("Manzilni tekshiring.");
    const entry = {
      id,
      label: input.label.trim(),
      location: input.location,
      updatedAt: new Date().toISOString(),
    };
    const next = [entry, ...saved.filter((item) => item.id !== id)];
    if (next.length > 10) throw new Error("10 tagacha manzil saqlash mumkin.");
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      throw new Error(
        "Brauzerda saqlab bo'lmadi. Saqlash belgisini olib, davom etishingiz mumkin.",
      );
    }
    return entry as T;
  }
  throw new Error("Manzil amali bajarilmadi.");
};
