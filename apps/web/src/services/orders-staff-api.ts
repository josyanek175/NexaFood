import { apiClient } from "@/lib/api-client";
import type { OrderMode, PaymentMethod } from "@/lib/types";

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

export type StaffOrderLine = {
  productId: string;
  variationId?: string | null;
  quantity: number;
  notes?: string | null;
  removed?: string[];
  optionItemIds?: string[];
};

export type PlaceStaffOrderInput = {
  mode: OrderMode;
  payment: PaymentMethod;
  channel?: "balcao" | "mesa" | "manual";
  customerName: string;
  customerPhone?: string;
  address?: string;
  tableId?: string;
  notes?: string;
  changeFor?: number;
  items: StaffOrderLine[];
};

export async function placeStaffOrder(input: PlaceStaffOrderInput) {
  return apiClient.post<{
    code: string;
    total: number;
    publicToken: string;
    orderId: string;
    tableId: string | null;
  }>("/api/v1/orders", {
    mode: MODE_DB[input.mode],
    paymentMethod: PAYMENT_DB[input.payment],
    ...(input.channel ? { channel: input.channel.toUpperCase() } : {}),
    customerName: input.customerName,
    customerPhone: input.customerPhone ?? null,
    address: input.address ?? null,
    tableId: input.tableId ?? null,
    notes: input.notes ?? null,
    changeFor: input.changeFor ?? null,
    items: input.items,
  });
}
