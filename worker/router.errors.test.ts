import { expect, it, vi } from "vitest";
import { handleApiRequest } from "./router";

vi.mock("./searchService", async (original) => ({
  ...await original<typeof import("./searchService")>(),
  searchVideos: vi.fn(async () => { throw new Error("private provider URL ?key=test-secret"); }),
}));

function mockKv(): KVNamespace {
  return { get: vi.fn(), put: vi.fn(), getWithMetadata: vi.fn(), list: vi.fn(), delete: vi.fn() };
}

it("returns a generic search error without exposing internal transport details", async () => {
  const response = await handleApiRequest(new Request("https://ktv.example/api/rooms/room1234/search", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ query: "song" }),
  }), {});
  expect(response.status).toBe(502);
  const body = await response.text();
  expect(body).toContain("SEARCH_FAILED");
  expect(body).not.toContain("test-secret");
  expect(body).not.toContain("provider URL");
});

it("uses the search binding for throttling before reading or writing search KV", async () => {
  const limit = vi.fn().mockResolvedValue({ success: false });
  const kv = mockKv();
  const response = await handleApiRequest(new Request("https://ktv.example/api/rooms/room1234/search", {
    method: "POST",
    headers: { "content-type": "application/json", "cf-connecting-ip": "192.0.2.1" },
    body: JSON.stringify({ query: "song" }),
  }), { SEARCH_RATE_LIMITER: { limit }, SEARCH_CACHE: kv });
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({
    results: [], cacheMeta: { throttled: true, externalCallAvoided: true, retryAfterSeconds: 60 },
  });
  expect(limit).toHaveBeenCalledWith({ key: "room1234:192.0.2.1" });
  expect(kv.get).not.toHaveBeenCalled();
  expect(kv.put).not.toHaveBeenCalled();
});

it("checks playback independently of search KV and returns a retry hint when limited", async () => {
  const limit = vi.fn().mockResolvedValueOnce({ success: true }).mockResolvedValueOnce({ success: false });
  const kv = mockKv();
  const env = { PLAYBACK_RATE_LIMITER: { limit }, SEARCH_CACHE: kv };
  const check = () => handleApiRequest(new Request("https://ktv.example/api/youtube/playback/dQw4w9WgXcQ", {
    method: "POST",
    headers: { origin: "https://ktv.example", "cf-connecting-ip": "192.0.2.1" },
  }), env);
  const allowedRequest = await check();
  expect(await allowedRequest.json()).toMatchObject({ allowed: false, reason: "unknown" });
  const throttled = await check();
  expect(throttled.status).toBe(429);
  expect(throttled.headers.get("retry-after")).toBe("60");
  expect(limit).toHaveBeenCalledWith({ key: "192.0.2.1" });
  expect(kv.get).not.toHaveBeenCalled();
  expect(kv.put).not.toHaveBeenCalled();
});
