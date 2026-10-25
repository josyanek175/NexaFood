import { apiClient, ApiClientError } from "@/lib/api-client";
import type {
  CartLine,
  Customer,
  KitchenItemStatus,
  Order,
  OrderMode,
  OrderStatus,
  PaymentMethod,
} from "@/lib/types";

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

/** Cria o pedido na API. Os preços são recalculados no servidor. */
export async function placeOrder(
  input: PlaceOrderInput,
): Promise<{ code: string; total: number; publicToken: string }> {
  return apiClient.post<{ code: string; total: number; publicToken: string }>(
    "/api/v1/public/orders",
    {
      slug: input.slug,
      mode: MODE_DB[input.mode],
      paymentMethod: PAYMENT_DB[input.payment],
      customerName: input.customerName,
      customerPhone: input.customerPhone ?? null,
      address: input.address ?? null,
      tableNumber: input.tableNumber ?? null,
      notes: input.notes ?? null,
      changeFor: input.changeFor ?? null,
      items: input.lines.map((l) => ({
        productId: l.product_id,
        variationId: l.variation?.id ?? null,
        quantity: l.quantity,
        notes: l.notes ?? null,
        removed: l.removed,
        optionItemIds: l.options.map((o) => o.item_id),
      })),
    },
  );
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

/** Acompanhamento público do pedido pelo public_token opaco. */
export async function getOrderTracking(token: string): Promise<OrderTracking | null> {
  try {
    return await apiClient.get<OrderTracking>(
      `/api/v1/public/orders/tracking/${encodeURIComponent(token)}`,
    );
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 404) return null;
    throw error;
  }
}

const lower = <T extends string>(v: string) => v.toLowerCase() as T;

type ApiOrder = {
  id: string;
  establishmentId: string;
  code: string;
  channel: string;
  mode: string;
  status: string;
  customerName: string;
  customerPhone: string | null;
  tableNumber: number | null;
  address: string | null;
  subtotal: number;
  discount: number;
  deliveryFee: number;
  serviceFee: number;
  total: number;
  paymentMethod: string;
  changeFor: number | null;
  notes: string | null;
  createdAt: string;
  items: Array<{
    id: string;
    productName: string;
    variationName: string | null;
    quantity: number;
    unitPrice: number;
    sector: string;
    kitchenStatus: string;
    readyAt: string | null;
    removed: string[];
    notes: string | null;
    options: Array<{ groupName: string; itemName: string; price: number }>;
  }>;
  history: Array<{ status: string; at: string; by: string }>;
};

/** Pedidos do estabelecimento com itens, complementos e histórico. */
export async function fetchOrders(establishmentId: string): Promise<Order[]> {
  // Tenant comes from session cookie (currentEstablishmentId); param kept for query keys.
  void establishmentId;
  const data = await apiClient.get<ApiOrder[]>(`/api/v1/orders`);

  return data.map((o) => ({
    id: o.id,
    establishment_id: establishmentId,
    code: o.code,
    channel: lower<Order["channel"]>(o.channel),
    mode: lower<Order["mode"]>(o.mode),
    status: lower<OrderStatus>(o.status),
    customer_name: o.customerName,
    ...(o.customerPhone ? { customer_phone: o.customerPhone } : {}),
    ...(o.tableNumber != null ? { table_number: o.tableNumber } : {}),
    ...(o.address ? { address: o.address } : {}),
    items: o.items.map((i) => ({
      id: i.id,
      product_name: i.productName,
      ...(i.variationName ? { variation: i.variationName } : {}),
      quantity: i.quantity,
      unit_price: i.unitPrice,
      options: i.options.map((op) => ({
        group_name: op.groupName,
        item_name: op.itemName,
        price: op.price,
      })),
      removed: i.removed ?? [],
      ...(i.notes ? { notes: i.notes } : {}),
      sector: lower<Order["items"][number]["sector"]>(i.sector),
      kitchen_status: lower<KitchenItemStatus>(i.kitchenStatus ?? "NOVO"),
      ...(i.readyAt ? { ready_at: i.readyAt } : {}),
    })),
    subtotal: o.subtotal,
    discount: o.discount,
    delivery_fee: o.deliveryFee,
    service_fee: o.serviceFee,
    total: o.total,
    payment_method: lower<Order["payment_method"]>(o.paymentMethod),
    ...(o.changeFor != null ? { change_for: o.changeFor } : {}),
    ...(o.notes ? { notes: o.notes } : {}),
    created_at: o.createdAt,
    history: o.history.map((h) => ({
      status: lower<OrderStatus>(h.status),
      at: h.at,
      by: h.by,
    })),
  }));
}

/** Atualiza o status de um pedido (registra histórico no servidor). */
export async function updateOrderStatus(orderId: string, status: OrderStatus) {
  await apiClient.patch(`/api/v1/orders/${encodeURIComponent(orderId)}/status`, {
    status: status.toUpperCase(),
  });
}

/** Atualiza o status de um item no quadro da cozinha (KDS). */
export async function updateOrderItemKitchenStatus(itemId: string, status: KitchenItemStatus) {
  return apiClient.patch<{
    ok: boolean;
    itemId: string;
    kitchenStatus: string;
    orderId: string;
    orderStatus: string;
  }>(`/api/v1/order-items/${encodeURIComponent(itemId)}/kitchen-status`, {
    status: status.toUpperCase(),
  });
}

/** @deprecated Prefer listTables from tables-api. Kept for existing imports. */
export { listTables as fetchTables } from "@/services/tables-api";

type ApiCustomer = {
  id: string;
  establishmentId: string;
  name: string;
  phone: string;
  email: string | null;
  birthdate: string | null;
  consent: boolean;
  notes: string | null;
  ordersCount: number;
  totalSpent: number;
  lastOrderAt: string;
};

/** Clientes do estabelecimento. */
export async function fetchCustomers(establishmentId: string): Promise<Customer[]> {
  void establishmentId;
  const data = await apiClient.get<ApiCustomer[]>(`/api/v1/customers`);
  return data.map((c) => ({
    id: c.id,
    establishment_id: establishmentId,
    name: c.name,
    phone: c.phone,
    ...(c.email ? { email: c.email } : {}),
    ...(c.birthdate ? { birthdate: c.birthdate } : {}),
    orders_count: c.ordersCount,
    total_spent: c.totalSpent,
    last_order_at: c.lastOrderAt,
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
    .map(([method, value]) => ({
      method: PAY_LABEL[method] ?? method,
      value: Number(value.toFixed(2)),
    }))
    .sort((a, b) => b.value - a.value);

  return { salesByHour, salesByChannel, topProducts, paymentsBreakdown };
}
