"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

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
type CartContextValue = {
  customer: CustomerSession | null;
  items: CartItem[];
  favoriteIds: string[];
  setCustomer: (customer: CustomerSession | null) => void;
  addItem: (item: Omit<CartItem, "key">) => void;
  updateQuantity: (key: string, quantity: number) => void;
  removeItem: (key: string) => void;
  clearCart: () => void;
  toggleFavorite: (productId: string) => void;
  isFavorite: (productId: string) => boolean;
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

  function setCustomer(customer: CustomerSession | null) {
    setCustomerState(customer);

    if (customer) {
      window.localStorage.setItem(customerKey, JSON.stringify(customer));
    } else {
      window.localStorage.removeItem(customerKey);
    }
  }

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
    setCustomer,
    addItem(item) {
      const key = `${item.productId}-${item.variantId ?? "base"}-${item.modifiers.map((modifier) => modifier.modifierId).join(".")}-${item.notes ?? ""}`;
      setItems((current) => {
        const existing = current.find((candidate) => candidate.key === key);

        if (existing) {
          return current.map((candidate) => (candidate.key === key ? { ...candidate, quantity: candidate.quantity + item.quantity } : candidate));
        }

        return [...current, { ...item, key }];
      });
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
      setFavoriteIds((current) => (current.includes(productId) ? current.filter((id) => id !== productId) : [...current, productId]));
    },
    isFavorite(productId) {
      return favoriteIds.includes(productId);
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
  const fallbackImage =
    "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=900&q=80";

  if (!imageUrl) {
    return fallbackImage;
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
