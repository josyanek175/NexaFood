import { describe, expect, it } from "vitest";
import type { Order } from "./types";
import { filterSalesPeriod, salesTotals, salesCsv } from "./sales-report";
const row = (patch: Partial<Order> = {}) => ({ code: "123", created_at: new Date(2026, 9, 25, 12).toISOString(), customer_name: "Cliente", status: "finalizado", payment_method: "pix", total: 20, ...patch } as Order);
describe("relatórios reais", () => {
  it("exclui cancelados do valor e do ticket médio", () => {
    expect(salesTotals([row(), row({ status: "cancelado", total: 100 })])).toEqual({ value: 20, count: 1, canceled: 1, average: 20 });
  });
  it("filtra período local e rejeita período invertido", () => {
    const rows = [row(), row({ created_at: new Date(2026, 9, 24, 12).toISOString() })];
    expect(filterSalesPeriod(rows, "2026-10-25", "2026-10-25")).toHaveLength(1);
    expect(filterSalesPeriod(rows, "2026-10-26", "2026-10-25")).toHaveLength(0);
  });
  it("CSV preserva aspas e bloqueia fórmulas de planilha", () => {
    const csv = salesCsv([row({ customer_name: '=HYPERLINK("https://untrusted.test")' })]);
    expect(csv).toContain("'=");
    expect(csv).toContain('""https://untrusted.test""');
  });
});
