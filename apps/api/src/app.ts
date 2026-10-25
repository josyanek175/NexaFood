import { randomUUID } from "node:crypto";
import Fastify from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import type { Pool } from "pg";
import { resolveCorsOrigins, type Env } from "./config/env.js";
import { createDb, type Database } from "./db/client.js";
import authContextPlugin from "./plugins/auth-context.js";
import errorHandlerPlugin from "./plugins/error-handler.js";
import requestIdPlugin from "./plugins/request-id.js";
import authRoutes from "./routes/auth.js";
import establishmentSettingsRoutes from "./routes/establishment-settings.js";
import healthRoutes from "./routes/health.js";
import opsRoutes from "./routes/ops.js";
import categoriesRoutes from "./routes/categories.js";
import optionGroupsRoutes from "./routes/option-groups.js";
import productsRoutes from "./routes/products.js";
import publicMenuRoutes from "./routes/public-menu.js";
import publicOrdersRoutes from "./routes/public-orders.js";
import tablesRoutes from "./routes/tables.js";
import { AuthService } from "./services/auth-service.js";
import { EstablishmentSettingsService } from "./services/establishment-settings-service.js";
import { CategoryService } from "./services/category-service.js";
import { MenuService } from "./services/menu-service.js";
import { OptionGroupService } from "./services/option-group-service.js";
import { OrderService } from "./services/order-service.js";
import { ProductService } from "./services/product-service.js";
import { TableService } from "./services/table-service.js";

export type BuildAppOptions = {
  env: Env;
  pool?: Pool | null;
  db?: Database | null;
  menuService?: MenuService;
  authService?: AuthService;
  orderService?: OrderService;
  productService?: ProductService;
  categoryService?: CategoryService;
  optionGroupService?: OptionGroupService;
  tableService?: TableService;
  settingsService?: EstablishmentSettingsService;
};

declare module "fastify" {
  interface FastifyInstance {
    config: Env;
  }
}

export async function buildApp(options: BuildAppOptions) {
  const { env } = options;
  const pool = options.pool ?? null;
  const db = options.db ?? (pool ? createDb(pool) : null);

  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
      redact: {
        paths: [
          "req.headers.authorization",
          "req.headers.cookie",
          "body.password",
          "body.passwordHash",
          "password",
          "passwordHash",
          "token",
        ],
        remove: true,
      },
    },
    genReqId: (req) => {
      const incoming = req.headers["x-request-id"];
      if (typeof incoming === "string" && incoming.trim().length > 0) return incoming.trim();
      return randomUUID();
    },
    requestIdHeader: "x-request-id",
  });

  app.decorate("config", env);

  await app.register(requestIdPlugin);
  await app.register(errorHandlerPlugin);
  await app.register(cookie);
  await app.register(cors, {
    origin: resolveCorsOrigins(env),
    credentials: true,
  });

  await app.register(healthRoutes, { pool });

  if (db) {
    const menuService = options.menuService ?? new MenuService(db);
    const authService = options.authService ?? new AuthService(db, env);
    const orderService = options.orderService ?? new OrderService(db);
    const productService = options.productService ?? new ProductService(db);
    const categoryService = options.categoryService ?? new CategoryService(db);
    const optionGroupService = options.optionGroupService ?? new OptionGroupService(db);
    const tableService = options.tableService ?? new TableService(db);
    const settingsService = options.settingsService ?? new EstablishmentSettingsService(db);

    await app.register(authContextPlugin, { authService });
    await app.register(authRoutes, { authService });
    await app.register(publicMenuRoutes, { menuService });
    await app.register(publicOrdersRoutes, { orderService });
    await app.register(opsRoutes, { orderService, menuService, tableService });
    await app.register(productsRoutes, { productService });
    await app.register(categoriesRoutes, { categoryService });
    await app.register(optionGroupsRoutes, { optionGroupService });
    await app.register(tablesRoutes, { tableService });
    await app.register(establishmentSettingsRoutes, { settingsService });
  } else {
    app.get("/api/v1/public/establishments/:slug/menu", async (_request, reply) => {
      return reply.status(503).send({
        error: {
          code: "DATABASE_NOT_CONFIGURED",
          message: "DATABASE_URL is required for this endpoint",
        },
      });
    });
    app.post("/api/v1/auth/login", async (_request, reply) => {
      return reply.status(503).send({
        error: { code: "DATABASE_NOT_CONFIGURED", message: "DATABASE_URL is required" },
      });
    });
  }

  return app;
}
