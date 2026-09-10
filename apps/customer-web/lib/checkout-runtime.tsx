"use client";

import { createContext, useContext } from "react";
import { apiFetch } from "./api";
import { guestApiFetch } from "./guest-addresses";
import { useCart } from "./cart";

export type CheckoutRuntime = Pick<
  ReturnType<typeof useCart>,
  | "customer"
  | "items"
  | "subtotal"
  | "clearCart"
  | "refreshCustomer"
  | "showToast"
  | "fulfillment"
  | "fulfillmentConfirmed"
  | "openFulfillment"
> & { request: typeof apiFetch; preview: boolean };

export const CheckoutRuntimeContext = createContext<CheckoutRuntime | null>(
  null,
);

export function useCheckoutRuntime(): CheckoutRuntime {
  const cart = useCart();
  const runtime = useContext(CheckoutRuntimeContext);
  return (
    runtime ?? {
      ...cart,
      request: cart.customer?.accessToken ? apiFetch : guestApiFetch,
      preview: false,
    }
  );
}
