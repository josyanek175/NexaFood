import type { AppRole } from "@nexafood/shared";
import type { FastifyRequest } from "fastify";
import { establishmentContextRequired, forbidden, unauthorized } from "../lib/errors.js";
import type { AuthContext } from "./types.js";

export function requireSession(request: FastifyRequest): AuthContext {
  if (!request.auth) throw unauthorized();
  return request.auth;
}

/**
 * @deprecated Prefer requireCurrentEstablishment from tenant-context.
 * Ensures membership on a specific establishment id (legacy path checks).
 */
export function requireEstablishmentAccess(
  request: FastifyRequest,
  establishmentId: string,
): AuthContext {
  const auth = requireSession(request);
  if (auth.currentEstablishmentId && auth.currentEstablishmentId !== establishmentId) {
    throw forbidden("Estabelecimento diferente do contexto atual da sessão.");
  }
  const membership = auth.memberships.find(
    (m) => m.establishmentId === establishmentId && m.active,
  );
  if (!membership) {
    throw forbidden("Sem acesso a este estabelecimento.");
  }
  return auth;
}

export function requireRole(
  request: FastifyRequest,
  allowedRoles: AppRole[],
  establishmentId?: string,
): AuthContext {
  const auth = requireSession(request);
  const targetId = establishmentId ?? auth.currentEstablishmentId;
  if (!targetId) throw establishmentContextRequired();
  if (auth.currentEstablishmentId && auth.currentEstablishmentId !== targetId) {
    throw forbidden("Estabelecimento diferente do contexto atual da sessão.");
  }

  const membership = auth.memberships.find((m) => m.establishmentId === targetId && m.active);
  if (!membership) throw forbidden("Sem acesso a este estabelecimento.");
  if (!allowedRoles.includes(membership.role)) {
    throw forbidden("Perfil sem permissão para esta operação.");
  }
  return auth;
}

/** Helper for future resource checks: resource.establishmentId must match authorized context. */
export function assertSameEstablishment(
  authorizedEstablishmentId: string,
  resourceEstablishmentId: string,
): void {
  if (authorizedEstablishmentId !== resourceEstablishmentId) {
    throw forbidden("Recurso pertence a outro estabelecimento.");
  }
}
