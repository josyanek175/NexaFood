import type { FastifyPluginAsync } from "fastify";
import type { MenuService } from "../services/menu-service.js";

export type PublicMenuRoutesOpts = {
  menuService: MenuService;
};

const publicMenuRoutes: FastifyPluginAsync<PublicMenuRoutesOpts> = async (app, opts) => {
  app.get<{ Params: { slug: string } }>(
    "/api/v1/public/establishments/:slug/menu",
    async (request) => {
      const menu = await opts.menuService.getPublicMenuBySlug(request.params.slug);
      return menu;
    },
  );
};

export default publicMenuRoutes;
