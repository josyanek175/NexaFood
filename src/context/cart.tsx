import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { CartLine } from "@/lib/types";

export const linePrice = (line: CartLine) => {
  const options = line.options.reduce((sum, o) => sum + o.price, 0);
  return (line.base_price + (line.variation?.price_delta ?? 0) + options) * line.quantity;
};

interface CartContextValue {
  lines: CartLine[];
  add: (line: Omit<CartLine, "line_id">) => void;
  update: (lineId: string, patch: Partial<CartLine>) => void;
  remove: (lineId: string) => void;
  clear: () => void;
  count: number;
  subtotal: number;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);

  const value = useMemo<CartContextValue>(() => {
    return {
      lines,
      add: (line) =>
        setLines((prev) => [...prev, { ...line, line_id: `l_${Date.now()}_${prev.length}` }]),
      update: (lineId, patch) =>
        setLines((prev) => prev.map((l) => (l.line_id === lineId ? { ...l, ...patch } : l))),
      remove: (lineId) => setLines((prev) => prev.filter((l) => l.line_id !== lineId)),
      clear: () => setLines([]),
      count: lines.reduce((n, l) => n + l.quantity, 0),
      subtotal: lines.reduce((sum, l) => sum + linePrice(l), 0),
    };
  }, [lines]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart deve ser usado dentro de CartProvider");
  return ctx;
}
