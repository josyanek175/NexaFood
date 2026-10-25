import { describe, expect, it, vi } from "vitest";
import { ApiClientError, createApiClient } from "./api-client";

describe("api-client", () => {
  it("monta URL e retorna JSON", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      expect(String(input)).toBe("http://localhost:3333/api/v1/public/establishments/nexa-burger/menu");
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });

    const client = createApiClient({
      baseUrl: "http://localhost:3333",
      fetchImpl: fetchImpl as unknown as typeof fetch,
      credentials: "omit",
    });

    await expect(client.get<{ ok: boolean }>("/api/v1/public/establishments/nexa-burger/menu")).resolves.toEqual({
      ok: true,
    });
  });

  it("trata erro HTTP sem vazar stack", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ error: { code: "NOT_FOUND", message: "Estabelecimento não encontrado" } }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const client = createApiClient({
      baseUrl: "http://localhost:3333",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await expect(client.get("/x")).rejects.toMatchObject({
      name: "ApiClientError",
      status: 404,
      code: "NOT_FOUND",
      message: "Estabelecimento não encontrado",
    } satisfies Partial<ApiClientError>);
  });

  it("exige base URL configurada", async () => {
    const client = createApiClient({
      baseUrl: "",
      fetchImpl: vi.fn() as unknown as typeof fetch,
    });
    await expect(client.get("/health")).rejects.toMatchObject({
      code: "API_BASE_URL_MISSING",
    });
  });
});
