import { expect, it, vi } from "vitest";
import { handleApiRequest } from "./router";

vi.mock("./searchService", async (original) => ({
  ...await original<typeof import("./searchService")>(),
  searchVideos: vi.fn(async () => { throw new Error("private provider URL ?key=test-secret"); }),
}));

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
