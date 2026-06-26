import { describe, expect, it } from "vitest";
import { checkRateLimit, rateLimitKey } from "./rateLimit";

class MemoryKv {
  values = new Map<string, string>();
  writes: Array<{ key: string; value: string; options?: KVNamespacePutOptions }> = [];

  async get<T>(key: string, options: { type: "json" }): Promise<T | null> {
    const value = this.values.get(key);
    return value && options.type === "json" ? (JSON.parse(value) as T) : null;
  }

  async put(key: string, value: string, options?: KVNamespacePutOptions) {
    this.values.set(key, value);
    this.writes.push({ key, value, options });
  }
}

describe("rate limit", () => {
  it("allows requests until the limit is reached", async () => {
    const namespace = new MemoryKv();
    const now = new Date("2026-06-25T12:00:00Z");

    const first = await checkRateLimit({
      namespace,
      scope: "room:abc:search",
      identity: "127.0.0.1",
      limit: 2,
      now,
    });
    const second = await checkRateLimit({
      namespace,
      scope: "room:abc:search",
      identity: "127.0.0.1",
      limit: 2,
      now,
    });
    const third = await checkRateLimit({
      namespace,
      scope: "room:abc:search",
      identity: "127.0.0.1",
      limit: 2,
      now,
    });

    expect(first.allowed).toBe(true);
    expect(first.remaining).toBe(1);
    expect(second.allowed).toBe(true);
    expect(second.remaining).toBe(0);
    expect(third.allowed).toBe(false);
    expect(third.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("uses stable hashed keys", () => {
    expect(rateLimitKey("Room ABC Search", "127.0.0.1", new Date("2026-06-25T12:00:00Z"))).toBe(
      rateLimitKey("Room ABC Search", "127.0.0.1", new Date("2026-06-25T12:00:30Z")),
    );
  });

  it("keeps KV expiration TTL compatible near the end of a window", async () => {
    const namespace = new MemoryKv();

    await checkRateLimit({
      namespace,
      scope: "room:abc:search",
      identity: "127.0.0.1",
      limit: 2,
      now: new Date("2026-06-25T12:00:45Z"),
    });

    expect(namespace.writes[0]?.options?.expirationTtl).toBeGreaterThanOrEqual(60);
  });
});
