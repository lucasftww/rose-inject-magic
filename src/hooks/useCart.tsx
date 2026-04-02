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
  skinsCount?: number;
}

interface CartContextType {
  items: CartItem[];
  addItem: (item: Omit<CartItem, "quantity">, isLoggedIn?: boolean) => boolean;
  removeItem: (productId: string, planId: string) => void;
  updateQuantity: (productId: string, planId: string, quantity: number) => void;
  clearCart: () => void;
  totalItems: number;
  totalPrice: number;
  requiresAuth: boolean;
  clearRequiresAuth: () => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const CART_KEY = "royal-store-cart";

/** Reject corrupt localStorage cart rows so totals/checkout never become NaN. */
function normalizeCartItemsFromStorage(parsed: unknown): CartItem[] {
  if (!Array.isArray(parsed)) return [];
  const out: CartItem[] = [];
  for (const row of parsed) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    const productId = typeof o.productId === "string" ? o.productId : String(o.productId ?? "").trim();
    const planId = typeof o.planId === "string" ? o.planId : String(o.planId ?? "").trim();
    if (!productId || !planId) continue;

    let price = Number(o.price);
    let quantity = Number(o.quantity);
    if (!Number.isFinite(price) || price < 0) price = 0;
    if (!Number.isFinite(quantity) || quantity < 1) quantity = 1;
    quantity = Math.max(1, Math.floor(quantity));

    const productName = typeof o.productName === "string" && o.productName.trim() ? o.productName : "Item";
    const planName = typeof o.planName === "string" && o.planName.trim() ? o.planName : "—";
    const productImage =
      o.productImage === null ? null : typeof o.productImage === "string" ? o.productImage : null;

    const item: CartItem = {
      productId,
      productName,
      productImage,
      planId,
      planName,
      price,
      quantity,
    };

    if (o.type === "lzt-account") {
      item.type = "lzt-account";
      if (typeof o.lztItemId === "string" && o.lztItemId) item.lztItemId = o.lztItemId;
      if (typeof o.lztGame === "string") item.lztGame = o.lztGame;
      const lp = Number(o.lztPrice);
      if (Number.isFinite(lp) && lp >= 0) item.lztPrice = lp;
      if (typeof o.lztCurrency === "string") item.lztCurrency = o.lztCurrency;
      const sc = Number(o.skinsCount);
      if (Number.isFinite(sc) && sc >= 0) item.skinsCount = sc;
    }

    out.push(item);
  }
  return out;
}

export const CartProvider = ({ children }: { children: ReactNode }) => {
  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      const stored = localStorage.getItem(CART_KEY);
      if (!stored) return [];
      return normalizeCartItemsFromStorage(JSON.parse(stored));
    } catch {
      return [];
    }
  });
  const [requiresAuth, setRequiresAuth] = useState(false);

  useEffect(() => {
    localStorage.setItem(CART_KEY, JSON.stringify(items));
  }, [items]);

  const clearRequiresAuth = useCallback(() => setRequiresAuth(false), []);

  const addItem = (item: Omit<CartItem, "quantity">, isLoggedIn?: boolean): boolean => {
    let loggedIn = isLoggedIn;
    if (loggedIn === undefined) {
      // Check all possible Supabase session keys in localStorage
      try {
        const sessionKey = Object.keys(localStorage).find(
          (k) => k.startsWith("sb-") && k.endsWith("-auth-token")
        );
        if (sessionKey) {
          const raw = localStorage.getItem(sessionKey);
          if (raw) {
            const parsed = JSON.parse(raw);
            // Validate token exists and hasn't expired
            const expiresAt = parsed?.expires_at;
            const hasToken = !!parsed?.access_token;
            loggedIn = hasToken && (!expiresAt || expiresAt * 1000 > Date.now());
          }
        }
      } catch {
        loggedIn = false;
      }
      loggedIn = loggedIn ?? false;
    }

    if (!loggedIn) {
      setRequiresAuth(true);
      return false;
    }

    // Direct checkout: replace cart with single item
    const price = Number.isFinite(item.price) && item.price >= 0 ? item.price : 0;
    setItems([{ ...item, price, quantity: 1 }]);
    return true;
  };

  const removeItem = (productId: string, planId: string) => {
    setItems((prev) =>
      prev.filter((i) => !(i.productId === productId && i.planId === planId))
    );
  };

  const updateQuantity = (productId: string, planId: string, quantity: number) => {
    const q = Math.floor(Number(quantity));
    if (!Number.isFinite(q) || q <= 0) {
      removeItem(productId, planId);
      return;
    }
    setItems((prev) =>
      prev.map((i) =>
        i.productId === productId && i.planId === planId
          ? { ...i, quantity: q }
          : i
      )
    );
  };

  const clearCart = () => setItems([]);

  const totalItems = items.reduce((sum, i) => {
    const q = Number.isFinite(i.quantity) && i.quantity >= 1 ? Math.floor(i.quantity) : 0;
    return sum + q;
  }, 0);
  const totalPrice = items.reduce((sum, i) => {
    const p = Number.isFinite(i.price) && i.price >= 0 ? i.price : 0;
    const q = Number.isFinite(i.quantity) && i.quantity >= 1 ? Math.floor(i.quantity) : 0;
    return sum + p * q;
  }, 0);

  return (
    <CartContext.Provider
      value={{ items, addItem, removeItem, updateQuantity, clearCart, totalItems, totalPrice, requiresAuth, clearRequiresAuth }}
    >
      {children}
    </CartContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
};
