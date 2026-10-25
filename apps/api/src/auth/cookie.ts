import type { FastifyReply, FastifyRequest } from "fastify";
import type { Env } from "../config/env.js";

export function readSessionToken(request: FastifyRequest, env: Env): string | null {
  const raw = request.cookies?.[env.SESSION_COOKIE_NAME];
  if (!raw || raw.trim() === "") return null;
  return raw;
}

export function setSessionCookie(reply: FastifyReply, env: Env, token: string): void {
  const maxAgeSeconds = env.SESSION_TTL_DAYS * 24 * 60 * 60;
  reply.setCookie(env.SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: maxAgeSeconds,
  });
}

export function clearSessionCookie(reply: FastifyReply, env: Env): void {
  reply.clearCookie(env.SESSION_COOKIE_NAME, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });
}
