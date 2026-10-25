/**
 * Domain model for NexaCardápio (multi-tenant SaaS).
 * Every operational entity carries `establishment_id` to guarantee tenant isolation.
 * These interfaces mirror the planned Supabase schema.
 */

export type UserRole =
  | "superadmin"
  | "admin"
  | "gerente"
  | "caixa"
  | "atendente"
  | "cozinha"
  | "entregador";

export type OrderChannel = "cardapio" | "mesa" | "balcao" | "ifood" | "99food" | "manual";

export type OrderMode = "delivery" | "retirada" | "local";

export type OrderStatus =
  | "enviado"
  | "confirmado"
  | "preparando"
  | "pronto"
  | "em_entrega"
  | "finalizado"
  | "cancelado";

export type PaymentMethod = "pix" | "credito" | "debito" | "dinheiro" | "caixa";

export interface BusinessHour {
  weekday: number; // 0 = domingo
  opens: string;
  closes: string;
  closed?: boolean;
}

export interface Establishment {
  id: string;
  slug: string;
  name: string;
  description: string;
  cnpj: string;
  owner: string;
  logo_url: string;
  cover_url: string;
  brand_hue: number;
  whatsapp: string;
  address: string;
  is_open: boolean;
  min_order: number;
  delivery_fee_from: number;
  service_fee_percent: number;
  eta_minutes: [number, number];
  modes: OrderMode[];
  delivery_policy: string;
  business_hours: BusinessHour[];
  plan: "starter" | "pro" | "enterprise";
  status: "ativo" | "suspenso" | "trial";
  created_at: string;
  due_at: string;
  users_count: number;
  orders_count: number;
}

export interface Category {
  id: string;
  establishment_id: string;
  name: string;
  position: number;
  active: boolean;
  available_from?: string;
  available_to?: string;
}

export interface OptionItem {
  id: string;
  name: string;
  price: number;
  available: boolean;
}

export interface OptionGroup {
  id: string;
  establishment_id: string;
  name: string;
  required: boolean;
  min: number;
  max: number;
  selection: "single" | "multiple";
  items: OptionItem[];
}

export interface ProductVariation {
  id: string;
  name: string;
  price_delta: number;
  available?: boolean;
}

export interface Product {
  id: string;
  establishment_id: string;
  category_id: string;
  name: string;
  description: string;
  image_url: string;
  price: number;
  promo_price?: number;
  sku: string;
  prep_minutes: number;
  available: boolean;
  featured: boolean;
  track_stock: boolean;
  stock?: number;
  sector: KitchenSector;
  variations: ProductVariation[];
  option_group_ids: string[];
  removable_ingredients: string[];
  channels: OrderChannel[];
}

export type KitchenSector = "cozinha" | "bar" | "chapa" | "pizzaria" | "sobremesas";

export interface TableEntity {
  id: string;
  establishment_id: string;
  number: number;
  seats: number;
  status: "livre" | "ocupada" | "aguardando_pedido" | "preparando" | "aguardando_pagamento" | "fechada";
  total?: number;
  opened_at?: string;
  active?: boolean;
  qr_path?: string;
  open_orders_count?: number;
}

export interface Customer {
  id: string;
  establishment_id: string;
  name: string;
  phone: string;
  email?: string;
  birthdate?: string;
  orders_count: number;
  total_spent: number;
  last_order_at: string;
  consent: boolean;
  notes?: string;
}

export interface OrderItemOption {
  group_name: string;
  item_name: string;
  price: number;
}

/** Status do item no quadro da cozinha (KDS). */
export type KitchenItemStatus = "novo" | "preparando" | "pronto";

export interface OrderItem {
  id: string;
  product_name: string;
  variation?: string;
  quantity: number;
  unit_price: number; // price frozen at sale time
  options: OrderItemOption[];
  removed: string[];
  notes?: string;
  sector: KitchenSector;
  kitchen_status: KitchenItemStatus;
  ready_at?: string;
}

export interface OrderStatusEvent {
  status: OrderStatus;
  at: string;
  by: string;
}

export interface Order {
  id: string;
  establishment_id: string;
  code: string;
  channel: OrderChannel;
  mode: OrderMode;
  status: OrderStatus;
  customer_name: string;
  customer_phone?: string;
  table_number?: number;
  address?: string;
  items: OrderItem[];
  subtotal: number;
  discount: number;
  delivery_fee: number;
  service_fee: number;
  total: number;
  payment_method: PaymentMethod;
  change_for?: number;
  notes?: string;
  created_at: string;
  history: OrderStatusEvent[];
}

export interface Coupon {
  id: string;
  establishment_id: string;
  code: string;
  type: "percent" | "fixed";
  value: number;
  min_order: number;
  active: boolean;
  uses: number;
}

export type IntegrationStatus = "nao_configurado" | "em_configuracao" | "conectado" | "erro";

export interface Integration {
  id: string;
  establishment_id: string;
  key: "ifood" | "99food" | "whatsapp" | "pix" | "gateway" | "nfce" | "printers" | "maps" | "driver_app";
  name: string;
  description: string;
  status: IntegrationStatus;
  external_id?: string;
  last_sync_at?: string;
  errors: string[];
}

export interface Printer {
  id: string;
  establishment_id: string;
  name: string;
  connection: "usb" | "rede" | "bluetooth";
  width: "58mm" | "80mm";
  sector: KitchenSector | "caixa";
  copies: number;
  auto_print: boolean;
  trigger: "ao_receber" | "ao_confirmar";
}

export interface Driver {
  id: string;
  establishment_id: string;
  name: string;
  phone: string;
  vehicle: "moto" | "bike" | "carro";
  status: "disponivel" | "em_rota" | "offline";
  deliveries_today: number;
}

/** Cart types (client-side only) */
export interface CartOptionSelection {
  group_id: string;
  group_name: string;
  item_id: string;
  item_name: string;
  price: number;
}

export interface CartLine {
  line_id: string;
  product_id: string;
  name: string;
  image_url: string;
  base_price: number;
  variation?: ProductVariation;
  options: CartOptionSelection[];
  removed: string[];
  notes?: string;
  quantity: number;
}
