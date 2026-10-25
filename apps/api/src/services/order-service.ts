import { randomBytes } from "node:crypto";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import type { AppRole } from "@nexafood/shared";
import type { Database } from "../db/client.js";
import {
  establishments,
  orderItemOptions,
  orderItems,
  orders,
  orderStatusEvents,
  productOptionGroups,
  optionGroups,
  restaurantTables,
  customers,
} from "../db/schema/index.js";
import { establishmentEvents } from "../lib/establishment-events.js";
import { badRequest, forbidden, notFound } from "../lib/errors.js";
import {
  assertOptionItemLinkedToProduct,
  assertSameTenantCustomer,
  assertSameTenantKitchenSector,
  assertSameTenantProduct,
  assertSameTenantTable,
  assertSameTenantVariation,
} from "../lib/same-tenant.js";
import type { EstablishmentContext } from "../lib/tenant-context.js";

function toNumber(value: string | number | null | undefined): number {
  if (value == null) return 0;
  return typeof value === "number" ? value : Number(value);
}

function money(value: number): string {
  return value.toFixed(2);
}

function generateOrderCode(): string {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const rand = String(Math.floor(Math.random() * 10_000)).padStart(4, "0");
  return `${yy}${mm}${dd}${rand}`;
}

/** Cryptographically strong opaque tracking token (not sequential, not guessable). */
function generatePublicToken(): string {
  return randomBytes(32).toString("base64url");
}

export type PlaceOrderItemInput = {
  productId: string;
  variationId?: string | null | undefined;
  quantity: number;
  notes?: string | null | undefined;
  removed?: string[] | undefined;
  optionItemIds?: string[] | undefined;
};

export type OrderChannelValue =
  | "CARDAPIO"
  | "MESA"
  | "BALCAO"
  | "IFOOD"
  | "99FOOD"
  | "MANUAL";

export type PlaceOrderInput = {
  /** Public placement resolves tenant by slug. */
  slug?: string | undefined;
  /** Staff placement uses session establishment (preferred). */
  establishmentId?: string | undefined;
  channel?: OrderChannelValue | undefined;
  mode: "DELIVERY" | "RETIRADA" | "LOCAL";
  paymentMethod: "PIX" | "CREDITO" | "DEBITO" | "DINHEIRO" | "CAIXA";
  customerName: string;
  customerPhone?: string | null | undefined;
  address?: string | null | undefined;
  tableNumber?: number | null | undefined;
  tableId?: string | null | undefined;
  customerId?: string | null | undefined;
  notes?: string | null | undefined;
  changeFor?: number | null | undefined;
  items: PlaceOrderItemInput[];
  /** Who appears on the first status event (staff name). */
  createdByName?: string | undefined;
};

export type StaffOrderInput = Omit<
  PlaceOrderInput,
  "slug" | "establishmentId" | "createdByName"
>;

const ORDER_STATUSES = [
  "ENVIADO",
  "CONFIRMADO",
  "PREPARANDO",
  "PRONTO",
  "EM_ENTREGA",
  "FINALIZADO",
  "CANCELADO",
] as const;

export type OrderStatusValue = (typeof ORDER_STATUSES)[number];

const KITCHEN_ITEM_STATUSES = ["NOVO", "PREPARANDO", "PRONTO"] as const;
export type KitchenItemStatusValue = (typeof KITCHEN_ITEM_STATUSES)[number];

export class OrderService {
  constructor(
    private readonly db: Database,
    private readonly pendingEvents?: Parameters<typeof establishmentEvents.publish>[0][],
  ) {}

  private publish(event: Parameters<typeof establishmentEvents.publish>[0]) {
    if (this.pendingEvents) this.pendingEvents.push(event);
    else establishmentEvents.publish(event);
  }

  private async atomic<T>(run: (service: OrderService) => Promise<T>): Promise<T> {
    const events: Parameters<typeof establishmentEvents.publish>[0][] = [];
    const result = await this.db.transaction(async tx => run(new OrderService(tx as unknown as Database, events)));
    for (const event of events) establishmentEvents.publish(event);
    return result;
  }

  /** Staff/cashier order — tenant always from session context. */
  async placeStaffOrder(
    ctx: EstablishmentContext,
    input: StaffOrderInput,
  ): Promise<{
    code: string;
    total: number;
    publicToken: string;
    orderId: string;
    tableId: string | null;
  }> {
    const channel: OrderChannelValue =
      input.channel ??
      (input.tableId || input.tableNumber != null ? "MESA" : "BALCAO");

    return this.placeOrder({
      ...input,
      establishmentId: ctx.establishmentId,
      channel,
      createdByName: ctx.auth.user.fullName || ctx.auth.user.email,
      createdByUserId: ctx.userId,
    });
  }

  async placeOrder(
    input: PlaceOrderInput & { createdByUserId?: string | undefined },
  ): Promise<{
    code: string;
    total: number;
    publicToken: string;
    orderId: string;
    tableId: string | null;
  }> {
    return this.atomic(service => service.placeOrderInTransaction(input));
  }

  private async placeOrderInTransaction(input: PlaceOrderInput & { createdByUserId?: string | undefined }) {
    const name = input.customerName.trim();
    if (!name) throw badRequest("Informe o nome do cliente");
    if (!input.items.length) throw badRequest("Pedido sem itens");

    let est: typeof establishments.$inferSelect | undefined;
    if (input.establishmentId) {
      const [row] = await this.db
        .select()
        .from(establishments)
        .where(
          and(eq(establishments.id, input.establishmentId), eq(establishments.status, "ACTIVE")),
        )
        .limit(1);
      est = row;
    } else if (input.slug) {
      const [row] = await this.db
        .select()
        .from(establishments)
        .where(and(eq(establishments.slug, input.slug), eq(establishments.status, "ACTIVE")))
        .limit(1);
      est = row;
    }
    if (!est) throw badRequest("Estabelecimento indisponível");
    if (!input.createdByUserId && !est.isOpen) throw badRequest("Estabelecimento fechado para novos pedidos.");
    if (input.items.length > 100) throw badRequest("Pedido excede o limite de itens.");

    let table: typeof restaurantTables.$inferSelect | null = null;
    if (input.tableId) {
      table = await assertSameTenantTable(this.db, est.id, input.tableId);
    } else if (input.tableNumber != null) {
      const [row] = await this.db
        .select()
        .from(restaurantTables)
        .where(
          and(
            eq(restaurantTables.establishmentId, est.id),
            eq(restaurantTables.number, input.tableNumber),
          ),
        )
        .limit(1);
      if (!row) throw badRequest("Mesa inválida para este estabelecimento.");
      table = row;
    }

    if (table && !table.active) throw badRequest("Mesa inativa.");

    let customerId: string | null = null;
    if (input.customerId) {
      const customer = await assertSameTenantCustomer(this.db, est.id, input.customerId);
      customerId = customer.id;
    }

    const code = generateOrderCode();
    const publicToken = generatePublicToken();
    const channel: OrderChannelValue =
      input.channel ?? (table != null ? "MESA" : "CARDAPIO");

    const [order] = await this.db
      .insert(orders)
      .values({
        establishmentId: est.id,
        code,
        publicToken,
        channel,
        mode: input.mode,
        status: "ENVIADO",
        customerId,
        customerName: name.slice(0, 80),
        customerPhone: input.customerPhone?.trim() || null,
        tableId: table?.id ?? null,
        tableNumber: table?.number ?? input.tableNumber ?? null,
        address: input.address?.trim() || null,
        paymentMethod: input.paymentMethod,
        changeFor: input.changeFor != null ? money(input.changeFor) : null,
        notes: input.notes?.trim() || null,
      })
      .returning();
    if (!order) throw badRequest("Não foi possível criar o pedido");

    await this.db.insert(orderStatusEvents).values({
      orderId: order.id,
      establishmentId: est.id,
      status: "ENVIADO",
      changedBy: input.createdByUserId ?? null,
      changedByName: input.createdByName?.trim() || "Sistema",
    });
    let subtotal = 0;
    let position = 0;

    for (const line of input.items) {
      const prod = await assertSameTenantProduct(this.db, est.id, line.productId);
      if (!prod.active) throw badRequest("Produto indisponível");
      if (!prod.available) throw badRequest("Produto esgotado");

      const qty = Math.max(1, Math.min(99, Number(line.quantity) || 1));
      let unit = toNumber(prod.promoPrice ?? prod.price);

      let variationName: string | null = null;
      if (line.variationId) {
        const variation = await assertSameTenantVariation(
          this.db,
          est.id,
          prod.id,
          line.variationId,
        );
        if (!variation.available) throw badRequest("Variação esgotada");
        unit += toNumber(variation.priceDelta);
        variationName = variation.name;
      }

      let sector = "cozinha";
      if (prod.sectorId) {
        const sectorRow = await assertSameTenantKitchenSector(this.db, est.id, prod.sectorId);
        sector = sectorRow.type.toLowerCase();
      }

      const [item] = await this.db
        .insert(orderItems)
        .values({
          orderId: order.id,
          establishmentId: est.id,
          productId: prod.id,
          productName: prod.name,
          variationName,
          quantity: qty,
          unitPrice: money(unit),
          sector,
          removed: line.removed ?? [],
          notes: line.notes?.trim() || null,
          position: position++,
        })
        .returning();
      if (!item) throw badRequest("Não foi possível criar o item");

      const selectedIds = line.optionItemIds ?? [];
      if (new Set(selectedIds).size !== selectedIds.length) throw badRequest("Adicional repetido.");
      const counts = new Map<string, number>();
      const linkedGroups = await this.db.select({ group: optionGroups }).from(productOptionGroups)
        .innerJoin(optionGroups, and(eq(optionGroups.id, productOptionGroups.optionGroupId), eq(optionGroups.establishmentId, est.id)))
        .where(and(eq(productOptionGroups.productId, prod.id), eq(productOptionGroups.establishmentId, est.id)));

      for (const optionItemId of selectedIds) {
        const { optionItem, optionGroup } = await assertOptionItemLinkedToProduct(
          this.db,
          est.id,
          prod.id,
          optionItemId,
        );
        if (!optionItem.available || !optionGroup.active) throw badRequest("Adicional indisponível");
        counts.set(optionGroup.id, (counts.get(optionGroup.id) ?? 0) + 1);

        // Defense: link row must already match tenant; also verify denormalized equality.
        const [link] = await this.db
          .select()
          .from(productOptionGroups)
          .where(
            and(
              eq(productOptionGroups.productId, prod.id),
              eq(productOptionGroups.optionGroupId, optionGroup.id),
              eq(productOptionGroups.establishmentId, est.id),
            ),
          )
          .limit(1);
        if (!link) throw badRequest("Adicional não vinculado a este produto.");

        await this.db.insert(orderItemOptions).values({
          orderItemId: item.id,
          establishmentId: est.id,
          groupName: optionGroup.name,
          itemName: optionItem.name,
          price: optionItem.price,
        });
        unit += toNumber(optionItem.price);
      }

      for (const { group } of linkedGroups) {
        if (!group.active) continue;
        const count = counts.get(group.id) ?? 0;
        const min = Math.max(group.minSelect, group.required ? 1 : 0);
        const max = group.selection === "single" ? 1 : group.maxSelect;
        if (count < min || count > max) throw badRequest(`Confira as opções de ${group.name}: selecione entre ${min} e ${max}.`);
      }

      await this.db
        .update(orderItems)
        .set({ unitPrice: money(unit) })
        .where(and(eq(orderItems.id, item.id), eq(orderItems.establishmentId, est.id)));
      subtotal = Math.round((subtotal + Math.round(unit * 100) / 100 * qty) * 100) / 100;
    }

    if (!input.createdByUserId && subtotal < toNumber(est.minimumOrder)) {
      throw badRequest("Pedido abaixo do valor mínimo do estabelecimento.");
    }
    if (!input.createdByUserId && input.mode === "DELIVERY" && (!input.address?.trim() || !input.customerPhone?.trim())) {
      throw badRequest("Informe endereço e telefone para entrega.");
    }

    const serviceFee =
      input.mode === "LOCAL"
        ? Number(((subtotal * toNumber(est.serviceFeePercentage)) / 100).toFixed(2))
        : 0;
    const total = Math.round((subtotal + serviceFee) * 100) / 100;
    if (input.paymentMethod === "DINHEIRO" && input.changeFor != null && (!Number.isFinite(input.changeFor) || input.changeFor < total)) {
      throw badRequest("O valor para troco deve cobrir o total do pedido.");
    }

    await this.db
      .update(orders)
      .set({
        subtotal: money(subtotal),
        serviceFee: money(serviceFee),
        total: money(total),
      })
      .where(and(eq(orders.id, order.id), eq(orders.establishmentId, est.id)));

    if (table) {
      await this.db
        .update(restaurantTables)
        .set({
          status: "PREPARANDO",
          openedAt: sql`coalesce(${restaurantTables.openedAt}, now())`,
          currentTotal: sql`${restaurantTables.currentTotal} + ${money(total)}`,
          updatedAt: new Date(),
        })
        .where(
          and(eq(restaurantTables.id, table.id), eq(restaurantTables.establishmentId, est.id)),
        );

      this.publish({
        type: "table.updated",
        establishmentId: est.id,
        payload: { tableId: table.id, status: "PREPARANDO" },
      });
    }

    this.publish({
      type: "order.created",
      establishmentId: est.id,
      payload: { orderId: order.id, code },
    });

    return {
      code,
      total,
      publicToken,
      orderId: order.id,
      tableId: order.tableId,
    };
  }

  async getOrderTrackingByPublicToken(token: string) {
    const [row] = await this.db
      .select({
        order: orders,
        establishmentName: establishments.name,
        establishmentSlug: establishments.slug,
        etaMin: establishments.estimatedTimeMin,
        etaMax: establishments.estimatedTimeMax,
      })
      .from(orders)
      .innerJoin(establishments, eq(establishments.id, orders.establishmentId))
      .where(eq(orders.publicToken, token))
      .limit(1);

    if (!row) return null;
    return this.toPublicTracking(row);
  }

  /**
   * Deprecated: requires slug to avoid cross-tenant code collision.
   * Prefer getOrderTrackingByPublicToken.
   */
  async getOrderTrackingBySlugAndCode(slug: string, code: string) {
    const [row] = await this.db
      .select({
        order: orders,
        establishmentName: establishments.name,
        establishmentSlug: establishments.slug,
        etaMin: establishments.estimatedTimeMin,
        etaMax: establishments.estimatedTimeMax,
      })
      .from(orders)
      .innerJoin(establishments, eq(establishments.id, orders.establishmentId))
      .where(and(eq(establishments.slug, slug), eq(orders.code, code)))
      .limit(1);

    if (!row) return null;
    return this.toPublicTracking(row);
  }

  private async toPublicTracking(row: {
    order: typeof orders.$inferSelect;
    establishmentName: string;
    establishmentSlug: string;
    etaMin: number;
    etaMax: number;
  }) {
    const items = await this.db
      .select()
      .from(orderItems)
      .where(
        and(
          eq(orderItems.orderId, row.order.id),
          eq(orderItems.establishmentId, row.order.establishmentId),
        ),
      )
      .orderBy(asc(orderItems.position));

    const history = await this.db
      .select()
      .from(orderStatusEvents)
      .where(
        and(
          eq(orderStatusEvents.orderId, row.order.id),
          eq(orderStatusEvents.establishmentId, row.order.establishmentId),
        ),
      )
      .orderBy(asc(orderStatusEvents.createdAt));

    return {
      code: row.order.code,
      status: row.order.status,
      mode: row.order.mode,
      created_at: row.order.createdAt.toISOString(),
      total: toNumber(row.order.total),
      subtotal: toNumber(row.order.subtotal),
      service_fee: toNumber(row.order.serviceFee),
      delivery_fee: toNumber(row.order.deliveryFee),
      discount: toNumber(row.order.discount),
      table_number: row.order.tableNumber,
      customer_first_name: row.order.customerName.split(" ")[0] ?? "",
      establishment: {
        name: row.establishmentName,
        slug: row.establishmentSlug,
        eta_min: row.etaMin,
        eta_max: row.etaMax,
      },
      items: items.map((i) => ({
        name: i.productName,
        variation: i.variationName,
        quantity: i.quantity,
        unit_price: toNumber(i.unitPrice),
      })),
      history: history.map((h) => ({
        status: h.status,
        at: h.createdAt.toISOString(),
      })),
    };
  }

  async listOrders(establishmentId: string) {
    const orderRows = await this.db
      .select()
      .from(orders)
      .where(eq(orders.establishmentId, establishmentId))
      .orderBy(desc(orders.createdAt))
      .limit(200);

    if (orderRows.length === 0) return [];

    const orderIds = orderRows.map((o) => o.id);
    const itemRows = await this.db
      .select()
      .from(orderItems)
      .where(
        and(inArray(orderItems.orderId, orderIds), eq(orderItems.establishmentId, establishmentId)),
      )
      .orderBy(asc(orderItems.position));

    const itemIds = itemRows.map((i) => i.id);
    const optionRows =
      itemIds.length === 0
        ? []
        : await this.db
            .select()
            .from(orderItemOptions)
            .where(
              and(
                inArray(orderItemOptions.orderItemId, itemIds),
                eq(orderItemOptions.establishmentId, establishmentId),
              ),
            );

    const eventRows = await this.db
      .select()
      .from(orderStatusEvents)
      .where(
        and(
          inArray(orderStatusEvents.orderId, orderIds),
          eq(orderStatusEvents.establishmentId, establishmentId),
        ),
      )
      .orderBy(asc(orderStatusEvents.createdAt));

    const optionsByItem = new Map<string, typeof optionRows>();
    for (const op of optionRows) {
      const list = optionsByItem.get(op.orderItemId) ?? [];
      list.push(op);
      optionsByItem.set(op.orderItemId, list);
    }

    const itemsByOrder = new Map<string, typeof itemRows>();
    for (const item of itemRows) {
      const list = itemsByOrder.get(item.orderId) ?? [];
      list.push(item);
      itemsByOrder.set(item.orderId, list);
    }

    const eventsByOrder = new Map<string, typeof eventRows>();
    for (const ev of eventRows) {
      const list = eventsByOrder.get(ev.orderId) ?? [];
      list.push(ev);
      eventsByOrder.set(ev.orderId, list);
    }

    return orderRows.map((o) => ({
      id: o.id,
      establishmentId: o.establishmentId,
      code: o.code,
      channel: o.channel,
      mode: o.mode,
      status: o.status,
      customerName: o.customerName,
      customerPhone: o.customerPhone,
      tableId: o.tableId,
      tableNumber: o.tableNumber,
      address: o.address,
      subtotal: toNumber(o.subtotal),
      discount: toNumber(o.discount),
      deliveryFee: toNumber(o.deliveryFee),
      serviceFee: toNumber(o.serviceFee),
      total: toNumber(o.total),
      paymentMethod: o.paymentMethod,
      changeFor: o.changeFor == null ? null : toNumber(o.changeFor),
      notes: o.notes,
      createdAt: o.createdAt.toISOString(),
      items: (itemsByOrder.get(o.id) ?? []).map((i) => ({
        id: i.id,
        productName: i.productName,
        variationName: i.variationName,
        quantity: i.quantity,
        unitPrice: toNumber(i.unitPrice),
        sector: i.sector,
        kitchenStatus: i.kitchenStatus,
        readyAt: i.readyAt?.toISOString() ?? null,
        removed: i.removed ?? [],
        notes: i.notes,
        options: (optionsByItem.get(i.id) ?? []).map((op) => ({
          groupName: op.groupName,
          itemName: op.itemName,
          price: toNumber(op.price),
        })),
      })),
      history: (eventsByOrder.get(o.id) ?? []).map((h) => ({
        status: h.status,
        at: h.createdAt.toISOString(),
        by: h.changedByName,
      })),
    }));
  }

  /**
   * Updates a single line's kitchen board status and syncs the parent order:
   * - first item leaving NOVO → order PREPARANDO
   * - all items PRONTO → order PRONTO
   */
  async updateOrderItemKitchenStatus(
    ctx: EstablishmentContext,
    itemId: string,
    kitchenStatus: KitchenItemStatusValue,
    allowedRoles: AppRole[],
  ) {
    return this.atomic(service => service.updateKitchenInTransaction(ctx, itemId, kitchenStatus, allowedRoles));
  }

  private async updateKitchenInTransaction(ctx: EstablishmentContext, itemId: string, kitchenStatus: KitchenItemStatusValue, allowedRoles: AppRole[]) {
    if (!KITCHEN_ITEM_STATUSES.includes(kitchenStatus)) {
      throw badRequest("Status de cozinha inválido.");
    }
    if (!allowedRoles.includes(ctx.role)) {
      throw forbidden("Perfil sem permissão para esta operação.");
    }

    const [item] = await this.db
      .select()
      .from(orderItems)
      .where(and(eq(orderItems.id, itemId), eq(orderItems.establishmentId, ctx.establishmentId)))
      .limit(1);
    if (!item) throw notFound("Item do pedido não encontrado");

    const [order] = await this.db
      .select()
      .from(orders)
      .where(and(eq(orders.id, item.orderId), eq(orders.establishmentId, ctx.establishmentId)))
      .limit(1).for("update");
    if (!order) throw notFound("Pedido não encontrado");
    if (order.status === "CANCELADO" || order.status === "FINALIZADO") {
      throw badRequest("Pedido encerrado não pode ser atualizado na cozinha.");
    }

    if (item.kitchenStatus !== kitchenStatus) {
      await this.db
        .update(orderItems)
        .set({
          kitchenStatus,
          readyAt: kitchenStatus === "PRONTO" ? new Date() : null,
        })
        .where(
          and(eq(orderItems.id, itemId), eq(orderItems.establishmentId, ctx.establishmentId)),
        );
    }

    const siblings = await this.db
      .select()
      .from(orderItems)
      .where(
        and(
          eq(orderItems.orderId, order.id),
          eq(orderItems.establishmentId, ctx.establishmentId),
        ),
      );

    const allReady = siblings.every((s) => s.kitchenStatus === "PRONTO");
    const anyStarted = siblings.some(
      (s) => s.kitchenStatus === "PREPARANDO" || s.kitchenStatus === "PRONTO",
    );

    let nextOrderStatus: OrderStatusValue | null = null;
    if (allReady && order.status !== "EM_ENTREGA") {
      nextOrderStatus = "PRONTO";
    } else if (
      anyStarted &&
      (order.status === "ENVIADO" || order.status === "CONFIRMADO" || order.status === "PRONTO")
    ) {
      // If something left PRONTO (or first start), keep/return to PREPARANDO.
      if (!allReady) nextOrderStatus = "PREPARANDO";
    }

    if (nextOrderStatus && nextOrderStatus !== order.status) {
      await this.db
        .update(orders)
        .set({ status: nextOrderStatus, updatedAt: new Date() })
        .where(and(eq(orders.id, order.id), eq(orders.establishmentId, ctx.establishmentId)));

      await this.db.insert(orderStatusEvents).values({
        orderId: order.id,
        establishmentId: ctx.establishmentId,
        status: nextOrderStatus,
        changedBy: ctx.userId,
        changedByName: ctx.auth.user.fullName || ctx.auth.user.email,
      });
    }

    const effectiveOrderStatus = nextOrderStatus ?? order.status;

    this.publish({
      type: "order.updated",
      establishmentId: ctx.establishmentId,
      payload: {
        orderId: order.id,
        itemId,
        kitchenStatus,
        status: effectiveOrderStatus,
      },
    });

    return {
      ok: true as const,
      itemId,
      kitchenStatus,
      orderId: order.id,
      orderStatus: effectiveOrderStatus,
      tableId: order.tableId,
    };
  }

  async updateOrderStatus(
    ctx: EstablishmentContext,
    orderId: string,
    status: OrderStatusValue,
    allowedRoles: AppRole[],
  ) {
    return this.atomic(service => service.updateStatusInTransaction(ctx, orderId, status, allowedRoles));
  }

  private async updateStatusInTransaction(ctx: EstablishmentContext, orderId: string, status: OrderStatusValue, allowedRoles: AppRole[]) {
    if (!ORDER_STATUSES.includes(status)) throw badRequest("Status inválido");
    if (!allowedRoles.includes(ctx.role)) {
      throw forbidden("Perfil sem permissão para esta operação.");
    }

    const [order] = await this.db
      .select()
      .from(orders)
      .where(and(eq(orders.id, orderId), eq(orders.establishmentId, ctx.establishmentId)))
      .limit(1).for("update");
    if (!order) throw notFound("Pedido não encontrado");

    if (order.status === status) {
      return { ok: true as const, status, tableId: order.tableId };
    }

    if (order.status === "FINALIZADO" || order.status === "CANCELADO") {
      throw badRequest("Pedido encerrado não pode mudar de status.");
    }

    await this.db
      .update(orders)
      .set({ status, updatedAt: new Date() })
      .where(and(eq(orders.id, orderId), eq(orders.establishmentId, ctx.establishmentId)));

    await this.db.insert(orderStatusEvents).values({
      orderId,
      establishmentId: ctx.establishmentId,
      status,
      changedBy: ctx.userId,
      changedByName: ctx.auth.user.fullName || ctx.auth.user.email,
    });

    this.publish({
      type: "order.updated",
      establishmentId: ctx.establishmentId,
      payload: { orderId, status },
    });

    return {
      ok: true as const,
      status,
      tableId: order.tableId,
    };
  }

  async listCustomers(establishmentId: string) {
    const rows = await this.db
      .select()
      .from(customers)
      .where(eq(customers.establishmentId, establishmentId))
      .orderBy(desc(customers.lastOrderAt));

    return rows.map((c) => ({
      id: c.id,
      establishmentId: c.establishmentId,
      name: c.name,
      phone: c.phone,
      email: c.email,
      birthdate: c.birthdate,
      consent: c.consent,
      notes: c.notes,
      ordersCount: c.ordersCount,
      totalSpent: toNumber(c.totalSpent),
      lastOrderAt: (c.lastOrderAt ?? c.createdAt).toISOString(),
    }));
  }

  async getCustomer(establishmentId: string, customerId: string) {
    return assertSameTenantCustomer(this.db, establishmentId, customerId);
  }
}
