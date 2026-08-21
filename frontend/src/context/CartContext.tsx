/**
 * Cart context: client-side cart stored in AsyncStorage/localStorage.
 * Cart persists across sessions and is separate from any user account.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { storage } from "@/src/utils/storage";

const CART_KEY = "neds_cart_v1";

export type CartItem = {
  product_id: string;
  name: string;
  price: number;
  mrp?: number;
  image_base64?: string | null;
  seller_id?: string;
  category_id?: string;
  qty: number;
  stock?: number;
  unit?: string;
};

type CartState = {
  items: CartItem[];
  addToCart: (item: Omit<CartItem, "qty">, qty?: number) => void;
  updateQty: (product_id: string, qty: number) => void;
  removeItem: (product_id: string) => void;
  clearCart: () => void;
  subtotal: number;
  itemCount: number;
  hasItem: (product_id: string) => boolean;
};

const CartContext = createContext<CartState | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Load from storage
  useEffect(() => {
    (async () => {
      try {
        const raw = await storage.getItem<CartItem[]>(CART_KEY, []);
        if (Array.isArray(raw)) setItems(raw);
      } catch {}
      setLoaded(true);
    })();
  }, []);

  // Persist on change (after initial load)
  useEffect(() => {
    if (!loaded) return;
    storage.setItem(CART_KEY, items).catch(() => {});
  }, [items, loaded]);

  const addToCart = useCallback((item: Omit<CartItem, "qty">, qty: number = 1) => {
    setItems((cur) => {
      const idx = cur.findIndex((c) => c.product_id === item.product_id);
      if (idx >= 0) {
        const next = [...cur];
        const targetQty = next[idx].qty + qty;
        const maxQty = item.stock !== undefined ? item.stock : 999;
        next[idx] = { ...next[idx], qty: Math.min(targetQty, maxQty) };
        return next;
      }
      return [...cur, { ...item, qty }];
    });
  }, []);

  const updateQty = useCallback((product_id: string, qty: number) => {
    setItems((cur) => {
      if (qty <= 0) return cur.filter((c) => c.product_id !== product_id);
      return cur.map((c) => c.product_id === product_id ? { ...c, qty: Math.min(qty, c.stock ?? 999) } : c);
    });
  }, []);

  const removeItem = useCallback((product_id: string) => {
    setItems((cur) => cur.filter((c) => c.product_id !== product_id));
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

  const subtotal = useMemo(() => items.reduce((s, i) => s + i.price * i.qty, 0), [items]);
  const itemCount = useMemo(() => items.reduce((s, i) => s + i.qty, 0), [items]);
  const hasItem = useCallback((pid: string) => items.some((c) => c.product_id === pid), [items]);

  const value: CartState = { items, addToCart, updateQty, removeItem, clearCart, subtotal, itemCount, hasItem };
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
