import type { Order } from "./types";

export function localDateKey(value: Date): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

export function filterSalesPeriod(orders: Order[], from: string, to: string): Order[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || from > to) return [];
  return orders.filter(order => {
    const date = new Date(order.created_at);
    if (!Number.isFinite(date.getTime())) return false;
    const key = localDateKey(date);
    return key >= from && key <= to;
  });
}

export function salesTotals(orders: Order[]) {
  const valid = orders.filter(o => o.status !== "cancelado");
  const value = valid.reduce((sum, order) => sum + order.total, 0);
  return { value, count: valid.length, canceled: orders.length - valid.length, average: valid.length ? value / valid.length : 0 };
}

function csvCell(value: string | number): string {
  let text = String(value);
  // Spreadsheet formulas must not execute from a customer's name or notes.
  if (/^[\s]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}

export function salesCsv(orders: Order[]): string {
  const rows = [["Pedido", "Data", "Cliente", "Status", "Pagamento", "Valor do pedido"],
    ...orders.map(o => [o.code, new Date(o.created_at).toISOString(), o.customer_name, o.status, o.payment_method, o.total.toFixed(2)])];
  return "\ufeff" + rows.map(row => row.map(csvCell).join(";")).join("\r\n");
}
