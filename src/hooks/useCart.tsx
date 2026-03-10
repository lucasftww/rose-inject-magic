import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";

export interface CartItem {
  productId: string;
  productName: string;
  productImage: string | null;
  planId: string;
  planName: string;
  price: number;
  quantity: number;
  type?: "product" | "lzt-account";
  lztItemId?: string;
  lztPrice?: number;
  lztCurrency?: string;
  lztGame?: string;
}

interface CartContextType {
  items: CartItem[];
  addItem: (item: Omit<CartItem, "quantity">) => boolean;
  removeItem: (productId: string, planId: string) => void;
  updateQuantity: (productId: string, planId: string, quantity: number) => void;
  clearCart: () => void;
  totalItems: number;
  totalPrice: number;
  requiresAuth: boolean;
  clearRequiresAuth: () => void;
  cartOpen: boolean;
  setCartOpen: (open: boolean) => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const CART_KEY = "royal-store-cart";

export const CartProvider = ({ children }: { children: ReactNode }) => {
  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      const stored = localStorage.getItem(CART_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [requiresAuth, setRequiresAuth] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem(CART_KEY, JSON.stringify(items));
  }, [items]);

  const clearRequiresAuth = useCallback(() => setRequiresAuth(false), []);

  const addItem = (item: Omit<CartItem, "quantity">, isLoggedIn?: boolean): boolean => {
    // If caller doesn't pass auth status, check localStorage as fallback
    let loggedIn = isLoggedIn;
    if (loggedIn === undefined) {
      const sessionKey = Object.keys(localStorage).find(k => k.startsWith("sb-") && k.endsWith("-auth-token"));
      const session = sessionKey ? localStorage.getItem(sessionKey) : null;
      loggedIn = false;
      if (session) {
        try {
          const parsed = JSON.parse(session);
          loggedIn = !!parsed?.access_token;
        } catch {}
      }
    }

    if (!loggedIn) {
      setRequiresAuth(true);
      return false;
    }

    setItems((prev) => {
      if (item.type === "lzt-account") {
        const existing = prev.find(
          (i) => i.type === "lzt-account" && i.lztItemId === item.lztItemId
        );
        if (existing) return prev;
        return [...prev, { ...item, quantity: 1 }];
      }

      const existing = prev.find(
        (i) => i.productId === item.productId && i.planId === item.planId
      );
      if (existing) {
        return prev.map((i) =>
          i.productId === item.productId && i.planId === item.planId
            ? { ...i, quantity: i.quantity + 1 }
            : i
        );
      }
      return [...prev, { ...item, quantity: 1 }];
    });
    return true;
  };

  const removeItem = (productId: string, planId: string) => {
    setItems((prev) =>
      prev.filter((i) => !(i.productId === productId && i.planId === planId))
    );
  };

  const updateQuantity = (productId: string, planId: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(productId, planId);
      return;
    }
    setItems((prev) =>
      prev.map((i) =>
        i.productId === productId && i.planId === planId
          ? { ...i, quantity }
          : i
      )
    );
  };

  const clearCart = () => setItems([]);

  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);
  const totalPrice = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

  return (
    <CartContext.Provider
      value={{ items, addItem, removeItem, updateQuantity, clearCart, totalItems, totalPrice, requiresAuth, clearRequiresAuth, cartOpen, setCartOpen }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
};