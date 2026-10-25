import fp from "fastify-plugin";
import type { FastifyPluginAsync } from "fastify";
import { readSessionToken } from "../auth/cookie.js";
import type { AuthService } from "../services/auth-service.js";

export type AuthContextPluginOpts = {
  authService: AuthService;
};

const authContextPlugin: FastifyPluginAsync<AuthContextPluginOpts> = async (app, opts) => {
  app.decorateRequest("auth", null);

  app.addHook("preHandler", async (request) => {
    const token = readSessionToken(request, app.config);
    request.auth = await opts.authService.resolveAuthFromToken(token);
  });
};

export default fp(authContextPlugin, {
  name: "auth-context",
  dependencies: ["@fastify/cookie"],
});
