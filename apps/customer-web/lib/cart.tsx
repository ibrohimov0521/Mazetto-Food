"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { getApiBaseUrl } from "./api";

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
const sourceMenuMediaPaths = new Set([
  "/categories/burger.webp",
  "/categories/chicken-burger.webp",
  "/categories/chicken-lavash.webp",
  "/categories/doner.webp",
  "/categories/drinks.webp",
  "/categories/fast-food.webp",
  "/categories/hot-dog.webp",
  "/categories/lavash.webp",
  "/categories/sauces.webp",
  "/categories/sets.webp",
  "/products/achchiq-big-lavash.webp",
  "/products/achchiq-kurinniy-big-lavash.webp",
  "/products/achchiq-kurinniy-lavash.webp",
  "/products/achchiq-lavash.webp",
  "/products/big-lavash-pishloqli.webp",
  "/products/big-lavash.webp",
  "/products/burger.webp",
  "/products/chesnochniy-sous.webp",
  "/products/chicken-burger-canonical.webp",
  "/products/chicken-chizburger.webp",
  "/products/chicken-hot-dog-katta.webp",
  "/products/chicken-hot-dog-mini.webp",
  "/products/chizburger.webp",
  "/products/doner-blyuda.webp",
  "/products/doner.webp",
  "/products/double-burger.webp",
  "/products/double-chicken-burger.webp",
  "/products/double-chicken-chizburger.webp",
  "/products/double-chizburger.webp",
  "/products/fresh-hot-dog.webp",
  "/products/jaydari-kartoshka-120gr.webp",
  "/products/jaydari-kartoshka-150gr.webp",
  "/products/kampot.webp",
  "/products/karaleviski-hot-dog.webp",
  "/products/kartoshka-fri-katta-120gr.webp",
  "/products/kartoshka-fri-kichik-100gr.webp",
  "/products/katlet-podamashni.webp",
  "/products/katta-qazili-hot-dog.webp",
  "/products/ketchup.webp",
  "/products/kichkina-qazili-hot-dog.webp",
  "/products/klab-senwich-friziz.webp",
  "/products/klab-senwich.webp",
  "/products/kurinniy-big-lavash-pishloqli.webp",
  "/products/kurinniy-big-lavash.webp",
  "/products/kurinniy-doner.webp",
  "/products/kurinniy-lavash-pishloqli.webp",
  "/products/kurinniy-lavash.webp",
  "/products/kurinniy-lukavoyi-kalso-8-ta.webp",
  "/products/kurinniy-sharik-3-dona.webp",
  "/products/kurinniy-sharik-5-dona.webp",
  "/products/lavash-pishloqli.webp",
  "/products/lavash.webp",
  "/products/moxito.webp",
  "/products/naggets-5-dona.webp",
  "/products/ortacha-qazili-hot-dog.webp",
  "/products/pishloqli-sous.webp",
  "/products/salatli-hot-dog-katta.webp",
  "/products/salatli-hot-dog-kichik.webp",
  "/products/salatli-mega-hot-dog.webp",
  "/products/saseska-podomashniy.webp",
  "/products/set-chizburger.webp",
  "/products/set-doner-blyuda-juftligi.webp",
  "/products/set-doner.webp",
  "/products/set-donerda-baraka.webp",
  "/products/set-double-chizburger-juftligi.webp",
  "/products/set-double-chizburger.webp",
  "/products/set-katlet-podomashni-juftligi.webp",
  "/products/set-klab-senwich-juftligi.webp",
  "/products/set-klab-senwich.webp",
  "/products/set-lavash-canonical.webp",
  "/products/set-lavashlar-juftligi.webp",
  "/products/set-lavashlar-uchligi.webp",
  "/products/set-oilaviy.webp",
  "/products/set-qazili-hot-dog.webp",
  "/products/set-salatli-hot-dog.webp",
  "/products/set-tandir-lavash-juftligi.webp",
  "/products/set-xaggi-uchligi.webp",
  "/products/set-xaggi.webp",
  "/products/shashlik-katletli-hot-dog.webp",
  "/products/shashlikli-hot-dog.webp",
  "/products/tandir-lavash-pishloqli.webp",
  "/products/tandir-lavash.webp",
  "/products/ultra-qazili-hot-dog.webp",
  "/products/xaggi.webp",
]);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [customer, setCustomerState] = useState<CustomerSession | null>(null);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [cartPulseId, setCartPulseId] = useState(0);
  const [cartFlight, setCartFlight] = useState<CartFlight | null>(null);

  useEffect(() => {
    setItems(readStoredValue<CartItem[]>(storageKey, []));
    setCustomerState(readStoredValue<CustomerSession | null>(customerKey, null));
    setFavoriteIds(readStoredValue<string[]>(favoritesKey, []));
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
        cache: "no-store",
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
      const key = cartItemKey(item);
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
  return `${Number(value || 0).toLocaleString("uz-UZ")} so'm`;
}

export function cartItemKey(item: {
  productId: string;
  variantId?: string | undefined;
  modifiers?: { modifierId: string }[];
  notes?: string;
}): string {
  return `${item.productId}-${item.variantId ?? "base"}-${(item.modifiers ?? []).map((modifier) => modifier.modifierId).join(".")}-${item.notes ?? ""}`;
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

export function sourceMenuImage(imageUrl?: string | null): string {
  if (!imageUrl || imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
    return "";
  }

  if (sourceMenuMediaPaths.has(imageUrl)) {
    return `/menu-media/source${imageUrl}`;
  }

  return "";
}

function getCustomerApiBaseUrl(): string {
  return getApiBaseUrl();
}

function readStoredValue<T>(key: string, fallback: T): T {
  try {
    const value = window.localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    window.localStorage.removeItem(key);
    return fallback;
  }
}
