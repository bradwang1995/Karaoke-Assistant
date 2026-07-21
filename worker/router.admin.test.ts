import { describe, expect, it } from "vitest";
import { handleApiRequest } from "./router";

describe("admin API authorization boundary", () => {
  it("rejects direct overview reads before checking backend bindings", async () => {
    const response = await handleApiRequest(
      new Request("https://ktv.example/api/admin/overview"),
      {},
    );

    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "ADMIN_UNAUTHORIZED" },
    });
  });

  it("rejects direct destructive requests without a valid session", async () => {
    const response = await handleApiRequest(
      new Request("https://ktv.example/api/admin/repository", {
        method: "DELETE",
        headers: {
          origin: "https://ktv.example",
          "content-type": "application/json",
        },
        body: JSON.stringify({ ids: ["entry-1"] }),
      }),
      {},
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "ADMIN_UNAUTHORIZED" },
    });
  });
});
