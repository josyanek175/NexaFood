import { describe, expect, it } from "vitest";
import { hashPassword, normalizeEmail, verifyPassword } from "./password.js";

describe("password helpers", () => {
  it("normaliza email case-insensitive", () => {
    expect(normalizeEmail("  Admin@Example.COM ")).toBe("admin@example.com");
  });

  it("faz hash Argon2id e verifica corretamente", async () => {
    const hash = await hashPassword("correct-horse");
    expect(hash).not.toContain("correct-horse");
    expect(await verifyPassword(hash, "correct-horse")).toBe(true);
    expect(await verifyPassword(hash, "wrong")).toBe(false);
  });

  it("aplica pepper quando configurado", async () => {
    const hash = await hashPassword("secret", { pepper: "pep" });
    expect(await verifyPassword(hash, "secret", { pepper: "pep" })).toBe(true);
    expect(await verifyPassword(hash, "secret", { pepper: "other" })).toBe(false);
  });
});
