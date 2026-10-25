import { pgEnum } from "drizzle-orm/pg-core";

export const appRoleEnum = pgEnum("app_role", [
  "PLATFORM_ADMIN",
  "ESTABLISHMENT_ADMIN",
  "MANAGER",
  "CASHIER",
  "ATTENDANT",
  "KITCHEN",
  "DELIVERY_DRIVER",
]);

export const entityStatusEnum = pgEnum("entity_status", [
  "ACTIVE",
  "SUSPENDED",
  "TRIAL",
  "INACTIVE",
]);

export const kitchenSectorTypeEnum = pgEnum("kitchen_sector_type", [
  "COZINHA",
  "BAR",
  "CHAPA",
  "PIZZARIA",
  "SOBREMESAS",
]);

export const orderChannelEnum = pgEnum("order_channel", [
  "CARDAPIO",
  "MESA",
  "BALCAO",
  "IFOOD",
  "99FOOD",
  "MANUAL",
]);

export const orderModeEnum = pgEnum("order_mode", ["DELIVERY", "RETIRADA", "LOCAL"]);

export const orderStatusEnum = pgEnum("order_status", [
  "ENVIADO",
  "CONFIRMADO",
  "PREPARANDO",
  "PRONTO",
  "EM_ENTREGA",
  "FINALIZADO",
  "CANCELADO",
]);

/** Per-item status on the kitchen display board (KDS). */
export const kitchenItemStatusEnum = pgEnum("kitchen_item_status", [
  "NOVO",
  "PREPARANDO",
  "PRONTO",
]);

export const paymentMethodEnum = pgEnum("payment_method", [
  "PIX",
  "CREDITO",
  "DEBITO",
  "DINHEIRO",
  "CAIXA",
]);

export const tableStatusEnum = pgEnum("table_status", [
  "LIVRE",
  "OCUPADA",
  "AGUARDANDO_PEDIDO",
  "PREPARANDO",
  "AGUARDANDO_PAGAMENTO",
  "FECHADA",
]);
