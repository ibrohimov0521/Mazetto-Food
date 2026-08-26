"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type CustomerSession = {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  bonusBalance?: string;
  accessToken: string;
  refreshToken: string;
  tokenType: "Bearer";
};
export type CartModifier = {
  modifierId: string;
  name: string;
  price: string;
};
export type CartItem = {
  key: string;
  productId: string;
  productName: string;
  imageUrl?: string | null | undefined;
  variantId?: string | undefined;
  variantName?: string | undefined;
  unitPrice: string;
  quantity: number;
  modifiers: CartModifier[];
  notes?: string;
};
export type CartFlight = {
  id: number;
  imageUrl: string;
  source: {
    left: number;
    top: number;
    width: number;
    height: number;
  };
};
type CartContextValue = {
  customer: CustomerSession | null;
  items: CartItem[];
  favoriteIds: string[];
  toastMessage: string | null;
  cartPulseId: number;
  cartFlight: CartFlight | null;
  setCustomer: (customer: CustomerSession | null) => void;
  refreshCustomer: () => Promise<CustomerSession | null>;
  addItem: (item: Omit<CartItem, "key">) => void;
  updateQuantity: (key: string, quantity: number) => void;
  removeItem: (key: string) => void;
  clearCart: () => void;
  toggleFavorite: (productId: string) => void;
  isFavorite: (productId: string) => boolean;
  showToast: (message: string) => void;
  triggerCartFlight: (imageUrl: string | null | undefined, source: DOMRect) => void;
  finishCartFlight: () => void;
  subtotal: number;
};

const storageKey = "mazetto.customer.cart";
const customerKey = "mazetto.customer.session";
const favoritesKey = "mazetto.customer.favorites";
const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [customer, setCustomerState] = useState<CustomerSession | null>(null);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [cartPulseId, setCartPulseId] = useState(0);
  const [cartFlight, setCartFlight] = useState<CartFlight | null>(null);

  useEffect(() => {
    const storedItems = window.localStorage.getItem(storageKey);
    const storedCustomer = window.localStorage.getItem(customerKey);
    const storedFavorites = window.localStorage.getItem(favoritesKey);
    setItems(storedItems ? (JSON.parse(storedItems) as CartItem[]) : []);
    setCustomerState(storedCustomer ? (JSON.parse(storedCustomer) as CustomerSession) : null);
    setFavoriteIds(storedFavorites ? (JSON.parse(storedFavorites) as string[]) : []);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify(items));
  }, [items]);

  useEffect(() => {
    window.localStorage.setItem(favoritesKey, JSON.stringify(favoriteIds));
  }, [favoriteIds]);

  useEffect(() => {
    if (!toastMessage) {
      return;
    }

    const timeout = window.setTimeout(() => setToastMessage(null), 2400);
    return () => window.clearTimeout(timeout);
  }, [toastMessage]);

  const setCustomer = useCallback(function setCustomer(customer: CustomerSession | null) {
    setCustomerState(customer);

    if (customer) {
      window.localStorage.setItem(customerKey, JSON.stringify(customer));
    } else {
      window.localStorage.removeItem(customerKey);
    }
  }, []);

  const refreshCustomer = useCallback(async () => {
    if (!customer?.refreshToken) {
      return null;
    }

    try {
      const response = await fetch(`${getCustomerApiBaseUrl()}/customer/auth/refresh`, {
        body: JSON.stringify({ refreshToken: customer.refreshToken }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json()) as {
        success: boolean;
        data?: {
          customer: Omit<CustomerSession, "accessToken" | "refreshToken" | "tokenType">;
          tokens: Pick<CustomerSession, "accessToken" | "refreshToken" | "tokenType">;
        };
      };

      if (!response.ok || !payload.success || !payload.data) {
        throw new Error("Customer refresh failed");
      }

      const nextCustomer = {
        ...payload.data.customer,
        ...payload.data.tokens,
      };
      setCustomer(nextCustomer);
      return nextCustomer;
    } catch {
      setCustomer(null);
      return null;
    }
  }, [customer?.refreshToken, setCustomer]);

  const subtotal = useMemo(
    () =>
      items.reduce((total, item) => {
        const modifiersTotal = item.modifiers.reduce((sum, modifier) => sum + Number(modifier.price), 0);
        return total + (Number(item.unitPrice) + modifiersTotal) * item.quantity;
      }, 0),
    [items],
  );

  const value: CartContextValue = {
    customer,
    items,
    favoriteIds,
    toastMessage,
    cartPulseId,
    cartFlight,
    setCustomer,
    refreshCustomer,
    addItem(item) {
      const key = `${item.productId}-${item.variantId ?? "base"}-${item.modifiers.map((modifier) => modifier.modifierId).join(".")}-${item.notes ?? ""}`;
      setItems((current) => {
        const existing = current.find((candidate) => candidate.key === key);

        if (existing) {
          return current.map((candidate) => (candidate.key === key ? { ...candidate, quantity: candidate.quantity + item.quantity } : candidate));
        }

        return [...current, { ...item, key }];
      });
      setCartPulseId((current) => current + 1);
      setToastMessage(`${item.productName} savatga qo'shildi`);
    },
    updateQuantity(key, quantity) {
      setItems((current) => current.map((item) => (item.key === key ? { ...item, quantity } : item)).filter((item) => item.quantity > 0));
    },
    removeItem(key) {
      setItems((current) => current.filter((item) => item.key !== key));
    },
    clearCart() {
      setItems([]);
    },
    toggleFavorite(productId) {
      setFavoriteIds((current) => {
        const saved = !current.includes(productId);
        setToastMessage(saved ? "Sevimlilarga qo'shildi" : "Sevimlilardan olib tashlandi");
        return saved ? [...current, productId] : current.filter((id) => id !== productId);
      });
    },
    isFavorite(productId) {
      return favoriteIds.includes(productId);
    },
    showToast(message) {
      setToastMessage(message);
    },
    triggerCartFlight(imageUrl, source) {
      setCartFlight({
        id: Date.now(),
        imageUrl: productImage(imageUrl),
        source: {
          left: source.left,
          top: source.top,
          width: source.width,
          height: source.height,
        },
      });
    },
    finishCartFlight() {
      setCartFlight(null);
    },
    subtotal,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const value = useContext(CartContext);

  if (!value) {
    throw new Error("useCart must be used inside CartProvider");
  }

  return value;
}

export function formatMoney(value: string | number): string {
  return `${Number(value || 0).toLocaleString("uz-UZ")} UZS`;
}

export function productImage(imageUrl?: string | null): string {
  if (!imageUrl) {
    return "";
  }

  if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
    return imageUrl;
  }

  if (imageUrl.startsWith("/")) {
    const mediaUrl = process.env.NEXT_PUBLIC_MEDIA_URL?.replace(/\/$/, "");
    return mediaUrl ? `${mediaUrl}${imageUrl}` : imageUrl;
  }

  return imageUrl;
}

function getCustomerApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000/api/v1";
}
