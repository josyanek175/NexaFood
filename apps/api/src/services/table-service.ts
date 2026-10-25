import { and, asc, desc, eq, inArray, notInArray, sql } from "drizzle-orm";
import type { Database } from "../db/client.js";
import { establishments, orders, restaurantTables } from "../db/schema/index.js";
import { establishmentEvents } from "../lib/establishment-events.js";
import { badRequest, notFound } from "../lib/errors.js";
import type { EstablishmentContext } from "../lib/tenant-context.js";

function toNumber(value: string | number | null | undefined): number {
  if (value == null) return 0;
  return typeof value === "number" ? value : Number(value);
}

function money(value: number): string {
  return value.toFixed(2);
}

const TABLE_STATUSES = [
  "LIVRE",
  "OCUPADA",
  "AGUARDANDO_PEDIDO",
  "PREPARANDO",
  "AGUARDANDO_PAGAMENTO",
  "FECHADA",
] as const;

export type TableStatusValue = (typeof TABLE_STATUSES)[number];

const OPEN_ORDER_STATUSES = [
  "ENVIADO",
  "CONFIRMADO",
  "PREPARANDO",
  "PRONTO",
  "EM_ENTREGA",
] as const;

export type CreateTableInput = {
  number: number;
  seats?: number | undefined;
  active?: boolean | undefined;
};

export type PatchTableInput = {
  number?: number | undefined;
  seats?: number | undefined;
  active?: boolean | undefined;
};

export class TableService {
  constructor(private readonly db: Database) {}

  async list(establishmentId: string) {
    const [est] = await this.db
      .select({ slug: establishments.slug })
      .from(establishments)
      .where(eq(establishments.id, establishmentId))
      .limit(1);
    if (!est) throw notFound("Estabelecimento não encontrado");

    const rows = await this.db
      .select()
      .from(restaurantTables)
      .where(eq(restaurantTables.establishmentId, establishmentId))
      .orderBy(asc(restaurantTables.number));

    const openCounts = await this.countOpenOrdersByTable(establishmentId);

    return rows.map((t) => this.toDto(t, est.slug, openCounts.get(t.id) ?? 0));
  }

  async getById(establishmentId: string, tableId: string) {
    const [est] = await this.db
      .select({ slug: establishments.slug, name: establishments.name })
      .from(establishments)
      .where(eq(establishments.id, establishmentId))
      .limit(1);
    if (!est) throw notFound("Estabelecimento não encontrado");

    const table = await this.load(establishmentId, tableId);
    const recentOrders = await this.db
      .select({
        id: orders.id,
        code: orders.code,
        status: orders.status,
        total: orders.total,
        customerName: orders.customerName,
        createdAt: orders.createdAt,
      })
      .from(orders)
      .where(
        and(eq(orders.establishmentId, establishmentId), eq(orders.tableId, tableId)),
      )
      .orderBy(desc(orders.createdAt))
      .limit(30);

    const openCount = recentOrders.filter((o) =>
      (OPEN_ORDER_STATUSES as readonly string[]).includes(o.status),
    ).length;

    return {
      ...this.toDto(table, est.slug, openCount),
      establishmentName: est.name,
      orders: recentOrders.map((o) => ({
        id: o.id,
        code: o.code,
        status: o.status,
        total: toNumber(o.total),
        customerName: o.customerName,
        createdAt: o.createdAt.toISOString(),
      })),
    };
  }

  async create(establishmentId: string, input: CreateTableInput) {
    if (!Number.isInteger(input.number) || input.number < 1) {
      throw badRequest("Número da mesa inválido.");
    }
    const seats = input.seats ?? 4;
    if (!Number.isInteger(seats) || seats < 1) throw badRequest("Lugares inválidos.");

    try {
      const [row] = await this.db
        .insert(restaurantTables)
        .values({
          establishmentId,
          number: input.number,
          seats,
          active: input.active ?? true,
          status: "LIVRE",
        })
        .returning();
      if (!row) throw badRequest("Não foi possível criar a mesa.");

      establishmentEvents.publish({
        type: "table.updated",
        establishmentId,
        payload: { tableId: row.id },
      });

      const [est] = await this.db
        .select({ slug: establishments.slug })
        .from(establishments)
        .where(eq(establishments.id, establishmentId))
        .limit(1);

      return this.toDto(row, est?.slug ?? "", 0);
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (message.includes("restaurant_tables_establishment_id_number_unique")) {
        throw badRequest("Já existe uma mesa com este número.");
      }
      throw error;
    }
  }

  async update(establishmentId: string, tableId: string, input: PatchTableInput) {
    await this.load(establishmentId, tableId);
    const patch: Partial<typeof restaurantTables.$inferInsert> = { updatedAt: new Date() };

    if (input.number !== undefined) {
      if (!Number.isInteger(input.number) || input.number < 1) {
        throw badRequest("Número da mesa inválido.");
      }
      patch.number = input.number;
    }
    if (input.seats !== undefined) {
      if (!Number.isInteger(input.seats) || input.seats < 1) {
        throw badRequest("Lugares inválidos.");
      }
      patch.seats = input.seats;
    }
    if (input.active !== undefined) patch.active = input.active;

    try {
      const [row] = await this.db
        .update(restaurantTables)
        .set(patch)
        .where(
          and(
            eq(restaurantTables.id, tableId),
            eq(restaurantTables.establishmentId, establishmentId),
          ),
        )
        .returning();
      if (!row) throw notFound("Mesa não encontrada");

      establishmentEvents.publish({
        type: "table.updated",
        establishmentId,
        payload: { tableId },
      });

      const [est] = await this.db
        .select({ slug: establishments.slug })
        .from(establishments)
        .where(eq(establishments.id, establishmentId))
        .limit(1);
      const openCounts = await this.countOpenOrdersByTable(establishmentId);
      return this.toDto(row, est?.slug ?? "", openCounts.get(row.id) ?? 0);
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (message.includes("restaurant_tables_establishment_id_number_unique")) {
        throw badRequest("Já existe uma mesa com este número.");
      }
      throw error;
    }
  }

  async open(ctx: EstablishmentContext, tableId: string) {
    const table = await this.load(ctx.establishmentId, tableId);
    if (!table.active) throw badRequest("Mesa inativa.");
    if (table.status !== "LIVRE" && table.status !== "FECHADA") {
      throw badRequest("Mesa já está aberta.");
    }

    const [row] = await this.db
      .update(restaurantTables)
      .set({
        status: "AGUARDANDO_PEDIDO",
        openedAt: new Date(),
        currentTotal: money(0),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(restaurantTables.id, tableId),
          eq(restaurantTables.establishmentId, ctx.establishmentId),
        ),
      )
      .returning();
    if (!row) throw notFound("Mesa não encontrada");

    establishmentEvents.publish({
      type: "table.updated",
      establishmentId: ctx.establishmentId,
      payload: { tableId },
    });

    const [est] = await this.db
      .select({ slug: establishments.slug })
      .from(establishments)
      .where(eq(establishments.id, ctx.establishmentId))
      .limit(1);
    return this.toDto(row, est?.slug ?? "", 0);
  }

  async close(ctx: EstablishmentContext, tableId: string, force = false) {
    await this.load(ctx.establishmentId, tableId);
    const openCounts = await this.countOpenOrdersByTable(ctx.establishmentId);
    const open = openCounts.get(tableId) ?? 0;
    if (open > 0 && !force) {
      throw badRequest(
        `Há ${open} pedido(s) em andamento nesta mesa. Finalize ou use force=true.`,
      );
    }

    const [row] = await this.db
      .update(restaurantTables)
      .set({
        status: "LIVRE",
        openedAt: null,
        currentTotal: money(0),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(restaurantTables.id, tableId),
          eq(restaurantTables.establishmentId, ctx.establishmentId),
        ),
      )
      .returning();
    if (!row) throw notFound("Mesa não encontrada");

    establishmentEvents.publish({
      type: "table.updated",
      establishmentId: ctx.establishmentId,
      payload: { tableId },
    });

    const [est] = await this.db
      .select({ slug: establishments.slug })
      .from(establishments)
      .where(eq(establishments.id, ctx.establishmentId))
      .limit(1);
    return this.toDto(row, est?.slug ?? "", 0);
  }

  async setStatus(ctx: EstablishmentContext, tableId: string, status: TableStatusValue) {
    if (!TABLE_STATUSES.includes(status)) throw badRequest("Status de mesa inválido.");
    await this.load(ctx.establishmentId, tableId);

    const patch: Partial<typeof restaurantTables.$inferInsert> = {
      status,
      updatedAt: new Date(),
    };
    if (status === "LIVRE") {
      patch.openedAt = null;
      patch.currentTotal = money(0);
    } else if (status === "AGUARDANDO_PEDIDO" || status === "OCUPADA") {
      // ensure openedAt when moving into an open state
      const current = await this.load(ctx.establishmentId, tableId);
      if (!current.openedAt) patch.openedAt = new Date();
    }

    const [row] = await this.db
      .update(restaurantTables)
      .set(patch)
      .where(
        and(
          eq(restaurantTables.id, tableId),
          eq(restaurantTables.establishmentId, ctx.establishmentId),
        ),
      )
      .returning();
    if (!row) throw notFound("Mesa não encontrada");

    establishmentEvents.publish({
      type: "table.updated",
      establishmentId: ctx.establishmentId,
      payload: { tableId, status },
    });

    const [est] = await this.db
      .select({ slug: establishments.slug })
      .from(establishments)
      .where(eq(establishments.id, ctx.establishmentId))
      .limit(1);
    const openCounts = await this.countOpenOrdersByTable(ctx.establishmentId);
    return this.toDto(row, est?.slug ?? "", openCounts.get(row.id) ?? 0);
  }

  /** Recalculate table total/status after order changes. */
  async syncFromOrders(establishmentId: string, tableId: string) {
    const table = await this.load(establishmentId, tableId);
    const openOrders = await this.db
      .select({ total: orders.total, status: orders.status })
      .from(orders)
      .where(
        and(
          eq(orders.establishmentId, establishmentId),
          eq(orders.tableId, tableId),
          notInArray(orders.status, ["FINALIZADO", "CANCELADO"]),
        ),
      );

    const total = openOrders.reduce((s, o) => s + toNumber(o.total), 0);
    const hasPreparing = openOrders.some((o) =>
      ["ENVIADO", "CONFIRMADO", "PREPARANDO", "PRONTO", "EM_ENTREGA"].includes(o.status),
    );

    let status: TableStatusValue = table.status;
    if (openOrders.length === 0 && table.status !== "LIVRE") {
      status = table.openedAt ? "AGUARDANDO_PAGAMENTO" : "LIVRE";
    } else if (hasPreparing) {
      status = "PREPARANDO";
    } else if (openOrders.length > 0) {
      status = "OCUPADA";
    }

    await this.db
      .update(restaurantTables)
      .set({
        currentTotal: money(total),
        status,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(restaurantTables.id, tableId),
          eq(restaurantTables.establishmentId, establishmentId),
        ),
      );

    establishmentEvents.publish({
      type: "table.updated",
      establishmentId,
      payload: { tableId, status },
    });
  }

  private async countOpenOrdersByTable(establishmentId: string) {
    const rows = await this.db
      .select({
        tableId: orders.tableId,
        count: sql<number>`count(*)::int`,
      })
      .from(orders)
      .where(
        and(
          eq(orders.establishmentId, establishmentId),
          inArray(orders.status, [...OPEN_ORDER_STATUSES]),
        ),
      )
      .groupBy(orders.tableId);

    const map = new Map<string, number>();
    for (const row of rows) {
      if (row.tableId) map.set(row.tableId, Number(row.count));
    }
    return map;
  }

  private async load(establishmentId: string, tableId: string) {
    const [row] = await this.db
      .select()
      .from(restaurantTables)
      .where(
        and(
          eq(restaurantTables.id, tableId),
          eq(restaurantTables.establishmentId, establishmentId),
        ),
      )
      .limit(1);
    if (!row) throw notFound("Mesa não encontrada");
    return row;
  }

  private toDto(
    row: typeof restaurantTables.$inferSelect,
    slug: string,
    openOrdersCount: number,
  ) {
    return {
      id: row.id,
      establishmentId: row.establishmentId,
      number: row.number,
      seats: row.seats,
      status: row.status,
      currentTotal: toNumber(row.currentTotal),
      openedAt: row.openedAt?.toISOString() ?? null,
      active: row.active,
      qrToken: row.qrToken,
      qrPath: `/${slug}?mesa=${row.number}`,
      openOrdersCount,
    };
  }
}
