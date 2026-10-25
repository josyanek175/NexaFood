import { describe, expect, it } from "vitest";
import type { FastifyRequest } from "fastify";
import { AppError } from "./errors.js";
import { requireCurrentEstablishment } from "./tenant-context.js";
import type { AuthContext } from "../auth/types.js";

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
      {
        establishmentId: EST_B,
        organizationId: "org-a",
        establishmentName: "B",
        establishmentSlug: "est-b",
        logoUrl: null,
        isOpen: true,
        status: "ACTIVE",
        role: "MANAGER",
        active: true,
      },
    ],
    ...overrides,
  };
}

describe("requireCurrentEstablishment", () => {
  it("exige sessão", () => {
    expect(() => requireCurrentEstablishment(req(null))).toThrow(AppError);
  });

  it("exige currentEstablishmentId", () => {
    try {
      requireCurrentEstablishment(req(context({ currentEstablishmentId: null })));
      expect.fail("should throw");
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe("ESTABLISHMENT_CONTEXT_REQUIRED");
      expect((error as AppError).statusCode).toBe(409);
    }
  });

  it("platform admin sem membership no current também falha", () => {
    expect(() =>
      requireCurrentEstablishment(
        req(
          context({
            isPlatformAdmin: true,
            currentEstablishmentId: EST_A,
            memberships: [],
          }),
        ),
      ),
    ).toThrow(AppError);
  });

  it("retorna contexto do establishment atual (não o outro da membership)", () => {
    const ctx = requireCurrentEstablishment(req(context({ currentEstablishmentId: EST_A })));
    expect(ctx.establishmentId).toBe(EST_A);
    expect(ctx.role).toBe("ESTABLISHMENT_ADMIN");
    expect(ctx.organizationId).toBe("org-a");
  });
});
