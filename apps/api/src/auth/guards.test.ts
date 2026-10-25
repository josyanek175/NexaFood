import { describe, expect, it } from "vitest";
import type { FastifyRequest } from "fastify";
import { AppError } from "../lib/errors.js";
import {
  assertSameEstablishment,
  requireEstablishmentAccess,
  requireRole,
  requireSession,
} from "./guards.js";
import type { AuthContext } from "./types.js";

const EST_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const EST_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function req(auth: AuthContext | null): FastifyRequest {
  return { auth } as FastifyRequest;
}

function context(overrides: Partial<AuthContext> = {}): AuthContext {
  return {
    userId: "user-1",
    sessionId: "session-1",
    currentEstablishmentId: EST_A,
    isPlatformAdmin: false,
    user: { id: "user-1", email: "a@ex.com", fullName: "A", status: "ACTIVE" },
    memberships: [
      {
        establishmentId: EST_A,
        organizationId: "org-a",
        establishmentName: "A",
        establishmentSlug: "est-a",
        logoUrl: null,
        isOpen: true,
        status: "ACTIVE",
        role: "ESTABLISHMENT_ADMIN",
        active: true,
      },
    ],
    ...overrides,
  };
}

describe("auth guards", () => {
  it("requireSession bloqueia anônimo", () => {
    expect(() => requireSession(req(null))).toThrow(AppError);
  });

  it("requireRole aceita role permitida e rejeita não permitida", () => {
    const auth = context();
    expect(() => requireRole(req(auth), ["ESTABLISHMENT_ADMIN", "MANAGER"])).not.toThrow();
    expect(() => requireRole(req(auth), ["KITCHEN"])).toThrow(AppError);
  });

  it("requireEstablishmentAccess isola A e B", () => {
    const auth = context();
    expect(() => requireEstablishmentAccess(req(auth), EST_A)).not.toThrow();
    expect(() => requireEstablishmentAccess(req(auth), EST_B)).toThrow(AppError);
  });

  it("assertSameEstablishment impede vazamento entre tenants", () => {
    expect(() => assertSameEstablishment(EST_A, EST_A)).not.toThrow();
    expect(() => assertSameEstablishment(EST_A, EST_B)).toThrow(AppError);
  });
});
