import { describe, expect, it } from "vitest";
import { generateSessionToken, hashSessionToken } from "./session-token.js";

describe("session token", () => {
  it("gera token opaco e armazena apenas hash", () => {
    const token = generateSessionToken();
    const hash = hashSessionToken(token);
    expect(token.length).toBeGreaterThan(20);
    expect(hash).not.toEqual(token);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hashSessionToken(token)).toBe(hash);
  });
});
