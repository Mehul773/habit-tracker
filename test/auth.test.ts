import { describe, it, expect } from "vitest";
import { sha256Hex, verifyPassword } from "../worker/auth";

describe("sha256Hex", () => {
  it("returns 64-char lowercase hex", async () => {
    const h = await sha256Hex("hello");
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    // known SHA-256 of "hello"
    expect(h).toBe("2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824");
  });
});

describe("verifyPassword", () => {
  it("true when input hashes to storedHash", async () => {
    const stored = await sha256Hex("9876543210");
    expect(await verifyPassword("9876543210", stored)).toBe(true);
    expect(await verifyPassword("wrong", stored)).toBe(false);
  });
  it("false when no password set", async () => {
    expect(await verifyPassword("anything", null)).toBe(false);
    expect(await verifyPassword("anything", "")).toBe(false);
  });
});
