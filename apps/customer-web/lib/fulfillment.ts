"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { isDeliveryLocation, type DeliveryLocation } from "./delivery-location";

export type Fulfillment = {
  type: "DELIVERY" | "PICKUP";
  branchId: string;
  branchName: string;
  branchAddress: string;
  location: DeliveryLocation | null;
};
type State = { selection: Fulfillment | null; confirmed: boolean };
const empty: State = { selection: null, confirmed: false };

function isSelection(value: unknown): value is Fulfillment {
  if (!value || typeof value !== "object") return false;
  const item = value as Fulfillment;
  return (
    typeof item.branchId === "string" &&
    Boolean(item.branchId) &&
    typeof item.branchName === "string" &&
    typeof item.branchAddress === "string" &&
    (item.type === "PICKUP" ||
      (item.type === "DELIVERY" && isDeliveryLocation(item.location)))
  );
}
function read(key: string): State {
  try {
    const item = JSON.parse(
      sessionStorage.getItem(key) ?? "null",
    ) as State | null;
    return item && isSelection(item.selection)
      ? { selection: item.selection, confirmed: item.confirmed === true }
      : empty;
  } catch {
    return empty;
  }
}
function persist(key: string, state: State) {
  try {
    sessionStorage.setItem(key, JSON.stringify(state));
  } catch {
    /* In-memory checkout still works. */
  }
}

export function useFulfillmentState(customerId?: string, preview = false) {
  const owner = customerId ?? "guest";
  const prefix = preview
    ? "mazetto.preview.fulfillment."
    : "mazetto.customer.fulfillment.";
  const key = prefix + owner;
  const [record, setRecord] = useState<{ key: string; state: State } | null>(
    null,
  );
  const previous = useRef<{ owner: string; state: State } | null>(null);
  useEffect(() => {
    // Keep a guest's current checkout when they sign in, but never carry one account into another.
    const transferringGuest =
      previous.current?.owner === "guest" &&
      owner !== "guest" &&
      previous.current.state.confirmed;
    const state = transferringGuest ? previous.current!.state : read(key);
    if (transferringGuest) {
      try {
        sessionStorage.removeItem(prefix + "guest");
      } catch {
        /* Optional session persistence. */
      }
    }
    previous.current = { owner, state };
    setRecord({ key, state });
    persist(key, state);
  }, [key, owner, prefix]);
  const state = record?.key === key ? record.state : empty;
  const select = useCallback(
    (selection: Fulfillment) => {
      const state = { selection, confirmed: true };
      previous.current = { owner, state };
      setRecord({ key, state });
      persist(key, state);
      if (!preview) {
        try {
          localStorage.setItem("mazetto.customer.branchId", selection.branchId);
        } catch {
          /* Optional preference. */
        }
      }
    },
    [key, owner, preview],
  );
  const reset = useCallback(() => {
    const state = {
      selection: previous.current?.state.selection ?? null,
      confirmed: false,
    };
    previous.current = { owner, state };
    setRecord({ key, state });
    persist(key, state);
  }, [key, owner]);
  return {
    fulfillment: state.selection,
    fulfillmentConfirmed: state.confirmed,
    selectFulfillment: select,
    resetFulfillment: reset,
  };
}
