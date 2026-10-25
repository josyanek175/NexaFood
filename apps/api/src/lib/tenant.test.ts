import { describe, expect, it } from "vitest";
import { AppError } from "./errors.js";
import { assertTenantRows } from "./tenant.js";

const EST_A = "11111111-1111-4111-8111-111111111111";
const EST_B = "22222222-2222-4222-8222-222222222222";

describe("assertTenantRows", () => {
  it("aceita linhas do mesmo estabelecimento", () => {
    expect(() =>
      assertTenantRows(
        EST_A,
        [
          { establishmentId: EST_A },
          { establishmentId: EST_A },
        ],
        "products",
      ),
    ).not.toThrow();
  });

  it("bloqueia vazamento de dados do estabelecimento B no contexto A", () => {
    expect(() =>
      assertTenantRows(
        EST_A,
        [
          { establishmentId: EST_A },
          { establishmentId: EST_B, name: "Produto do B" } as { establishmentId: string },
        ],
        "products",
      ),
    ).toThrow(AppError);

    try {
      assertTenantRows(EST_A, [{ establishmentId: EST_B }], "products");
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe("TENANT_ISOLATION_VIOLATION");
    }
  });
});
