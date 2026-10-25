import rateLimit from "@fastify/rate-limit";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { clearSessionCookie, readSessionToken, setSessionCookie } from "../auth/cookie.js";
import { requireSession } from "../auth/guards.js";
import { badRequest } from "../lib/errors.js";
import type { AuthService } from "../services/auth-service.js";

export type AuthRoutesOpts = {
  authService: AuthService;
};

const loginBodySchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(1).max(200),
});

const registerBodySchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(6).max(200),
  fullName: z.string().max(120).optional().default(""),
});

const currentEstablishmentBodySchema = z.object({
  establishmentId: z.string().uuid(),
});

const authRoutes: FastifyPluginAsync<AuthRoutesOpts> = async (app, opts) => {
  const { authService } = opts;

  await app.register(async (scoped) => {
    await scoped.register(rateLimit, {
      max: app.config.AUTH_LOGIN_RATE_MAX,
      timeWindow: app.config.AUTH_LOGIN_RATE_WINDOW_MS,
      keyGenerator: (request) => {
        const body = request.body as { email?: unknown } | undefined;
        const email =
          typeof body?.email === "string" ? body.email.trim().toLowerCase() : "unknown";
        return `${request.ip}:${email}`;
      },
    });

    scoped.post("/api/v1/auth/login", async (request, reply) => {
      const parsed = loginBodySchema.safeParse(request.body);
      if (!parsed.success) throw badRequest("Payload inválido.", parsed.error.flatten());

      const userAgent = request.headers["user-agent"];
      const { token, me } = await authService.login(parsed.data.email, parsed.data.password, {
        ipAddress: request.ip,
        ...(typeof userAgent === "string" ? { userAgent } : {}),
      });

      setSessionCookie(reply, app.config, token);
      return me;
    });

    scoped.post("/api/v1/auth/register", async (request, reply) => {
      const parsed = registerBodySchema.safeParse(request.body);
      if (!parsed.success) throw badRequest("Payload inválido.", parsed.error.flatten());

      const userAgent = request.headers["user-agent"];
      const { token, me } = await authService.register({
        email: parsed.data.email,
        password: parsed.data.password,
        fullName: parsed.data.fullName,
        meta: {
          ipAddress: request.ip,
          ...(typeof userAgent === "string" ? { userAgent } : {}),
        },
      });

      setSessionCookie(reply, app.config, token);
      return me;
    });
  });

  app.post("/api/v1/auth/logout", async (request, reply) => {
    const token = readSessionToken(request, app.config);
    await authService.logoutByToken(token);
    clearSessionCookie(reply, app.config);
    return { ok: true };
  });

  app.get("/api/v1/auth/me", async (request) => {
    const auth = requireSession(request);
    return authService.getMe(auth);
  });

  app.post("/api/v1/auth/current-establishment", async (request) => {
    const auth = requireSession(request);
    const parsed = currentEstablishmentBodySchema.safeParse(request.body);
    if (!parsed.success) throw badRequest("Payload inválido.", parsed.error.flatten());
    return authService.setCurrentEstablishment(auth, parsed.data.establishmentId);
  });
};

export default authRoutes;
