"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
const CheckoutPage = dynamic(() => import("../app/checkout/page"), {
  ssr: false,
});
import "./checkout-preview.css";
import {
  CheckoutRuntimeContext,
  type CheckoutRuntime,
} from "../lib/checkout-runtime";
import type { CustomerSession, CartItem } from "../lib/cart";
import type { SavedAddress } from "../lib/delivery-location";
import { isDeliveryLocation } from "../lib/delivery-location";
import { useFulfillmentState } from "../lib/fulfillment";
import { MediaImage } from "./media-image";
import { Plus } from "lucide-react";
import { TASHKENT_CENTER } from "../lib/tashkent-bounds";
const FulfillmentDialog = dynamic(() => import("./fulfillment-dialog"), {
  ssr: false,
});

const storageKey = "mazetto.preview.checkout.addresses.v1";
const customer: CustomerSession = {
  id: "checkout-preview",
  name: "Sinov mijoz",
  phone: "+998900000000",
  accessToken: "preview-not-a-token",
  refreshToken: "preview-not-a-token",
  tokenType: "Bearer",
};
const items: CartItem[] = [
  {
    key: "preview-lavash",
    productId: "preview-lavash",
    productName: "Big lavash",
    imageUrl: "https://media.mazettofood.uz/products/big-lavash.webp",
    unitPrice: "36000",
    quantity: 2,
    modifiers: [],
  },
];
const branch = {
  id: "preview-branch",
  name: "Mazetto Food",
  address: "Toshkent",
  coordinates: TASHKENT_CENTER,
  acceptsOrders: true,
  deliveryEnabled: true,
  pickupEnabled: true,
};

export function CheckoutPreview() {
  const [message, setMessage] = useState<string | null>(null);
  const selection = useFulfillmentState(customer.id, true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const openFulfillment = useCallback(() => setDialogOpen(true), []);
  const addresses = useRef<SavedAddress[] | null>(null);
  const request = useCallback<CheckoutRuntime["request"]>(
    async <T,>(
      path: string,
      init?: Parameters<CheckoutRuntime["request"]>[1],
    ): Promise<T> => {
      if (addresses.current === null) {
        try {
          const stored: unknown = JSON.parse(
            localStorage.getItem(storageKey) ?? "[]",
          );
          addresses.current = Array.isArray(stored)
            ? stored.filter(
                (item: SavedAddress) =>
                  typeof item?.id === "string" &&
                  typeof item?.label === "string" &&
                  isDeliveryLocation(item?.location),
              )
            : [];
        } catch {
          addresses.current = [];
        }
      }
      const method = init?.method ?? "GET";
      if (path === "/customer/branches" && method === "GET")
        return [branch] as T;
      if (path === "/customer/checkout/quote" && method === "POST") {
        return {
          subtotal: "72000",
          deliveryFee: "0",
          total: "72000",
          paymentMethods: [
            { code: "CASH", label: "Naqd", status: "AVAILABLE" },
          ],
        } as T;
      }
      if (path === "/customer/me/addresses" && method === "GET")
        return [...addresses.current] as T;
      const match = /^\/customer\/me\/addresses\/([a-zA-Z0-9-]+)$/.exec(path);
      if (match && method === "PUT") {
        const body = JSON.parse(String(init?.body)) as {
          label: string;
          location: SavedAddress["location"];
        };
        if (!isDeliveryLocation(body.location))
          throw new Error("Manzilni tekshiring.");
        const entry = {
          id: match[1]!,
          label: body.label,
          location: body.location,
          updatedAt: new Date().toISOString(),
        };
        const next = [
          entry,
          ...addresses.current.filter((item) => item.id !== entry.id),
        ];
        if (next.length > 10)
          throw new Error("10 tagacha manzil saqlash mumkin.");
        localStorage.setItem(storageKey, JSON.stringify(next));
        addresses.current = next;
        return entry as T;
      }
      if (match && method === "DELETE") {
        const next = addresses.current.filter((item) => item.id !== match[1]);
        localStorage.setItem(storageKey, JSON.stringify(next));
        addresses.current = next;
        return { deleted: true } as T;
      }
      throw new Error("Bu sinov sahifasida haqiqiy buyurtma yuborilmaydi.");
    },
    [],
  );
  const refreshCustomer = useCallback(async () => customer, []);
  const clearCart = useCallback(() => {}, []);
  const runtime = useMemo<CheckoutRuntime>(
    () => ({
      customer,
      items,
      subtotal: 72000,
      request,
      preview: true,
      refreshCustomer,
      clearCart,
      showToast: setMessage,
      fulfillment: selection.fulfillment,
      fulfillmentConfirmed: selection.fulfillmentConfirmed,
      openFulfillment,
    }),
    [
      request,
      refreshCustomer,
      clearCart,
      selection.fulfillment,
      selection.fulfillmentConfirmed,
      openFulfillment,
    ],
  );

  return (
    <CheckoutRuntimeContext.Provider value={runtime}>
      <div className="mf-checkout-preview">
        <div className="mf-preview-notice">
          <strong>Sinov sahifasi</strong>
          <span>
            Login kerak emas. Manzillar shu brauzerda saqlanadi. Haqiqiy
            buyurtma yuborilmaydi.
          </span>
          {message ? <p role="status">{message}</p> : null}
        </div>
        <div
          className="mf-preview-product"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            padding: 16,
            maxWidth: 1152,
            margin: "0 auto",
            background: "#f5f5ef",
            color: "#07373a",
          }}
        >
          <MediaImage
            src={items[0]!.imageUrl}
            alt="Big lavash"
            aspectClassName="h-14 w-14"
            sizes="56px"
          />
          <div style={{ flex: 1 }}>
            <strong>Big lavash</strong>
            <p>36 000 so'm</p>
          </div>
          <button
            type="button"
            className="mf-location-button is-primary"
            onClick={openFulfillment}
          >
            <Plus size={18} />
            Savatga qo'shish
          </button>
        </div>
        <CheckoutPage />
        {dialogOpen ? (
          <FulfillmentDialog
            initial={selection.fulfillment}
            onClose={() => setDialogOpen(false)}
            onConfirm={(value) => {
              selection.selectFulfillment(value);
              setDialogOpen(false);
            }}
          />
        ) : null}
        {message ? (
          <div className="mf-preview-feedback" role="status">
            {message}
            <button type="button" onClick={() => setMessage(null)}>
              Yopish
            </button>
          </div>
        ) : null}
      </div>
    </CheckoutRuntimeContext.Provider>
  );
}
