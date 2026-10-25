import type { AppRole } from "@nexafood/shared";
import type { FastifyRequest } from "fastify";
import { requireSession } from "../auth/guards.js";
import type { AuthContext } from "../auth/types.js";
import { establishmentContextRequired, forbidden } from "./errors.js";

export type EstablishmentContext = {
  userId: string;
  sessionId: string;
  establishmentId: string;
  organizationId: string;
  role: AppRole;
  isPlatformAdmin: boolean;
  auth: AuthContext;
};

/**
 * Official tenant for authenticated business operations.
 * Source of truth: request.auth.currentEstablishmentId (session), never body/path/query.
 * PLATFORM_ADMIN does not bypass — must have membership + current establishment.
 */
export function requireCurrentEstablishment(request: FastifyRequest): EstablishmentContext {
  const auth = requireSession(request);
  const establishmentId = auth.currentEstablishmentId;
  if (!establishmentId) {
    throw establishmentContextRequired();
  }

  const membership = auth.memberships.find((m) => m.establishmentId === establishmentId && m.active);
  if (!membership) {
    throw establishmentContextRequired("Estabelecimento atual inválido para este usuário.");
  }

  return {
    userId: auth.userId,
    sessionId: auth.sessionId,
    establishmentId: membership.establishmentId,
    organizationId: membership.organizationId,
    role: membership.role,
    isPlatformAdmin: auth.isPlatformAdmin,
    auth,
  };
}

export function requireCurrentEstablishmentRole(
  request: FastifyRequest,
  allowedRoles: AppRole[],
): EstablishmentContext {
  const ctx = requireCurrentEstablishment(request);
  if (!allowedRoles.includes(ctx.role)) {
    throw forbidden("Perfil sem permissão para esta operação.");
  }
  return ctx;
}

/** Alias for readability at call sites. */
export const getEstablishmentContext = requireCurrentEstablishment;
