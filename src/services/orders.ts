import { supabase } from "@/integrations/supabase/client";
import type { CartLine, OrderMode, PaymentMethod } from "@/lib/types";

/** Modalidades e pagamentos no formato do banco. */
const MODE_DB: Record<OrderMode, "DELIVERY" | "RETIRADA" | "LOCAL"> = {
  delivery: "DELIVERY",
  retirada: "RETIRADA",
  local: "LOCAL",
};

const PAYMENT_DB: Record<PaymentMethod, "PIX" | "CREDITO" | "DEBITO" | "DINHEIRO" | "CAIXA"> = {
  pix: "PIX",
  credito: "CREDITO",
  debito: "DEBITO",
  dinheiro: "DINHEIRO",
  caixa: "CAIXA",
};

export interface PlaceOrderInput {
  slug: string;
  mode: OrderMode;
  payment: PaymentMethod;
  customerName: string;
  customerPhone?: string;
  address?: string;
  tableNumber?: number;
  notes?: string;
  changeFor?: number;
  lines: CartLine[];
}

/** Cria o pedido no banco. Os preços são recalculados no servidor. */
export async function placeOrder(input: PlaceOrderInput): Promise<{ code: string; total: number }> {
  const { data, error } = await supabase.rpc("place_order", {
    _slug: input.slug,
    _mode: MODE_DB[input.mode],
    _payment_method: PAYMENT_DB[input.payment],
    _customer_name: input.customerName,
    ...(input.customerPhone ? { _customer_phone: input.customerPhone } : {}),
    ...(input.address ? { _address: input.address } : {}),
    ...(input.tableNumber != null ? { _table_number: input.tableNumber } : {}),
    ...(input.notes ? { _notes: input.notes } : {}),
    ...(input.changeFor != null ? { _change_for: input.changeFor } : {}),
    _items: input.lines.map((l) => ({
      product_id: l.product_id,
      variation_id: l.variation?.id ?? null,
      quantity: l.quantity,
      notes: l.notes ?? null,
      removed: l.removed,
      option_item_ids: l.options.map((o) => o.item_id),
    })),
  });
  if (error) throw new Error(error.message);
  const result = data as { code: string; total: number };
  return { code: result.code, total: Number(result.total) };
}

export interface OrderTracking {
  code: string;
  status: string;
  mode: string;
  created_at: string;
  total: number;
  subtotal: number;
  service_fee: number;
  delivery_fee: number;
  discount: number;
  table_number: number | null;
  customer_first_name: string;
  establishment: { name: string; slug: string; eta_min: number; eta_max: number };
  items: { name: string; variation: string | null; quantity: number; unit_price: number }[];
  history: { status: string; at: string }[];
}

/** Acompanhamento público do pedido pelo código. */
export async function getOrderTracking(code: string): Promise<OrderTracking | null> {
  const { data, error } = await supabase.rpc("get_order_tracking", { _code: code });
  if (error || !data) return null;
  return data as unknown as OrderTracking;
}

/* ============ Leituras operacionais (painel) ============ */

import type { Customer, Order, OrderStatus, TableEntity } from "@/lib/types";

const lower = <T extends string>(v: string) => v.toLowerCase() as T;

/** Pedidos do estabelecimento com itens, complementos e histórico. */
export async function fetchOrders(establishmentId: string): Promise<Order[]> {
  const { data, error } = await supabase
    .from("orders")
    .select(
      "*, order_items(*, order_item_options(*)), order_status_events(status, created_at, changed_by_name)",
    )
    .eq("establishment_id", establishmentId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error || !data) return [];

  return data.map((o) => ({
    id: o.id,
    establishment_id: establishmentId,
    code: o.code,
    channel: lower<Order["channel"]>(o.channel),
    mode: lower<Order["mode"]>(o.mode),
    status: lower<OrderStatus>(o.status),
    customer_name: o.customer_name,
    ...(o.customer_phone ? { customer_phone: o.customer_phone } : {}),
    ...(o.table_number != null ? { table_number: o.table_number } : {}),
    ...(o.address ? { address: o.address } : {}),
    items: (o.order_items ?? [])
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((i) => ({
        id: i.id,
        product_name: i.product_name,
        ...(i.variation_name ? { variation: i.variation_name } : {}),
        quantity: i.quantity,
        unit_price: Number(i.unit_price),
        options: (i.order_item_options ?? []).map((op) => ({
          group_name: op.group_name,
          item_name: op.item_name,
          price: Number(op.price),
        })),
        removed: i.removed ?? [],
        ...(i.notes ? { notes: i.notes } : {}),
        sector: lower<Order["items"][number]["sector"]>(i.sector),
      })),
    subtotal: Number(o.subtotal),
    discount: Number(o.discount),
    delivery_fee: Number(o.delivery_fee),
    service_fee: Number(o.service_fee),
    total: Number(o.total),
    payment_method: lower<Order["payment_method"]>(o.payment_method),
    ...(o.change_for != null ? { change_for: Number(o.change_for) } : {}),
    ...(o.notes ? { notes: o.notes } : {}),
    created_at: o.created_at,
    history: (o.order_status_events ?? [])
      .slice()
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((h) => ({ status: lower<OrderStatus>(h.status), at: h.created_at, by: h.changed_by_name })),
  }));
}

/** Atualiza o status de um pedido (registra histórico automaticamente). */
export async function updateOrderStatus(orderId: string, status: OrderStatus) {
  const { error } = await supabase
    .from("orders")
    .update({ status: status.toUpperCase() as never })
    .eq("id", orderId);
  if (error) throw new Error(error.message);
}

/** Mesas do estabelecimento. */
export async function fetchTables(establishmentId: string): Promise<TableEntity[]> {
  const { data } = await supabase
    .from("restaurant_tables")
    .select("*")
    .eq("establishment_id", establishmentId)
    .order("number");
  return (data ?? []).map((t) => ({
    id: t.id,
    establishment_id: establishmentId,
    number: t.number,
    seats: t.seats,
    status: lower<TableEntity["status"]>(t.status),
    ...(Number(t.current_total) > 0 ? { total: Number(t.current_total) } : {}),
    ...(t.opened_at ? { opened_at: t.opened_at } : {}),
  }));
}

/** Clientes do estabelecimento. */
export async function fetchCustomers(establishmentId: string): Promise<Customer[]> {
  const { data } = await supabase
    .from("customers")
    .select("*")
    .eq("establishment_id", establishmentId)
    .order("last_order_at", { ascending: false, nullsFirst: false });
  return (data ?? []).map((c) => ({
    id: c.id,
    establishment_id: establishmentId,
    name: c.name,
    phone: c.phone,
    ...(c.email ? { email: c.email } : {}),
    ...(c.birthdate ? { birthdate: c.birthdate } : {}),
    orders_count: c.orders_count,
    total_spent: Number(c.total_spent),
    last_order_at: c.last_order_at ?? c.created_at,
    consent: c.consent,
    ...(c.notes ? { notes: c.notes } : {}),
  }));
}

const PAY_LABEL: Record<string, string> = {
  pix: "Pix",
  credito: "Crédito",
  debito: "Débito",
  dinheiro: "Dinheiro",
  caixa: "Pagar no caixa",
};

/** Calcula os indicadores do painel a partir dos pedidos reais do estabelecimento. */
export function computeAnalytics(orders: Order[]) {
  const valid = orders.filter((o) => o.status !== "cancelado");

  const byHour = new Map<string, number>();
  for (const o of valid) {
    const h = `${String(new Date(o.created_at).getHours()).padStart(2, "0")}h`;
    byHour.set(h, (byHour.get(h) ?? 0) + o.total);
  }
  const salesByHour = [...byHour.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([hour, vendas]) => ({ hour, vendas: Number(vendas.toFixed(2)) }));

  const byChannel = new Map<string, number>();
  for (const o of valid) byChannel.set(o.channel, (byChannel.get(o.channel) ?? 0) + 1);
  const totalOrders = valid.length || 1;
  const salesByChannel = [...byChannel.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, qty]) => ({ name, value: Math.round((qty / totalOrders) * 100) }));

  const prod = new Map<string, { qty: number; revenue: number }>();
  for (const o of valid) {
    for (const i of o.items) {
      const cur = prod.get(i.product_name) ?? { qty: 0, revenue: 0 };
      cur.qty += i.quantity;
      cur.revenue += i.quantity * i.unit_price;
      prod.set(i.product_name, cur);
    }
  }
  const topProducts = [...prod.entries()]
    .map(([name, v]) => ({ name, qty: v.qty, revenue: Number(v.revenue.toFixed(2)) }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 6);

  const pay = new Map<string, number>();
  for (const o of valid) pay.set(o.payment_method, (pay.get(o.payment_method) ?? 0) + o.total);
  const paymentsBreakdown = [...pay.entries()]
    .map(([method, value]) => ({ method: PAY_LABEL[method] ?? method, value: Number(value.toFixed(2)) }))
    .sort((a, b) => b.value - a.value);

  return { salesByHour, salesByChannel, topProducts, paymentsBreakdown };
}
