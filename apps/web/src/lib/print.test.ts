import { describe, expect, it } from "vitest";
import type { Order } from "@/lib/types";
import { receiptText } from "./print";

const sampleOrder: Order = {
  id: "o1",
  establishment_id: "e1",
  code: "2401010001",
  channel: "mesa",
  mode: "local",
  status: "enviado",
  customer_name: "Cliente Mesa",
  table_number: 7,
  items: [
    {
      id: "i1",
      product_name: "Burger",
      quantity: 1,
      unit_price: 20,
      options: [],
      removed: [],
      sector: "chapa",
      kitchen_status: "novo",
    },
    {
      id: "i2",
      product_name: "Chopp",
      quantity: 2,
      unit_price: 12,
      options: [],
      removed: [],
      sector: "bar",
      kitchen_status: "novo",
    },
  ],
  subtotal: 44,
  discount: 0,
  delivery_fee: 0,
  service_fee: 0,
  total: 44,
  payment_method: "caixa",
  created_at: new Date().toISOString(),
  history: [],
};

describe("receiptText", () => {
  it("destaca mesa e filtra setor na comanda", () => {
    const text = receiptText(sampleOrder, "Nexa Burger", "comanda", { sector: "bar" });
    expect(text).toContain("*** MESA 7 ***");
    expect(text).toContain("Setor: BAR");
    expect(text).toContain("Chopp");
    expect(text).not.toContain("Burger");
    expect(text).toContain("COMANDA DE PRODUCAO");
  });
});
