import { describe, expect, it } from "vitest";
import {
  clearAdminSession,
  createAdminSession,
  isSameOriginMutation,
  readAdminSession,
  requireAdmin,
} from "./adminAuth";

class MemoryKv {
  private store = new Map<string, string>();

  async get<T>(key: string, options: { type: "json" }): Promise<T | null> {
    const value = this.store.get(key);
    return options.type === "json" && value ? (JSON.parse(value) as T) : null;
  }

  async put(key: string, value: string) {
    this.store.set(key, value);
  }
}

const configuredEnv = {
  SEARCH_CACHE: new MemoryKv(),
  ADMIN_PASSWORD: "local-test-password",
  ADMIN_SESSION_SECRET: "local-test-session-secret-with-enough-entropy",
};

describe("admin authentication", () => {
  it("creates and verifies a signed HttpOnly session cookie", async () => {
    const loginResponse = await createAdminSession(
      request("/api/admin/session", {
        method: "POST",
        body: JSON.stringify({ password: "local-test-password" }),
      }),
      configuredEnv,
    );
    const setCookie = loginResponse.headers.get("set-cookie");

    expect(loginResponse.status).toBe(200);
    expect(setCookie).toContain("ktv_admin_session=");
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("Secure");
    expect(setCookie).toContain("SameSite=Strict");

    const cookie = setCookie?.split(";")[0] ?? "";
    const sessionRequest = request("/api/admin/session", {
      headers: { cookie },
    });

    await expect(requireAdmin(sessionRequest, configuredEnv)).resolves.toBe(true);
    expect((await readAdminSession(sessionRequest, configuredEnv)).status).toBe(200);
  });

  it("rejects an incorrect password without issuing a cookie", async () => {
    const response = await createAdminSession(
      request("/api/admin/session", {
        method: "POST",
        body: JSON.stringify({ password: "wrong" }),
      }),
      { ...configuredEnv, SEARCH_CACHE: new MemoryKv() },
    );

    expect(response.status).toBe(401);
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("fails closed when admin secrets are absent and validates mutation origins", async () => {
    const response = await createAdminSession(
      request("/api/admin/session", {
        method: "POST",
        body: JSON.stringify({ password: "anything" }),
      }),
      {},
    );

    expect(response.status).toBe(503);
    expect(isSameOriginMutation(request("/api/admin/session", { method: "POST" }))).toBe(true);
    expect(
      isSameOriginMutation(
        new Request("https://ktv.example/api/admin/session", {
          method: "POST",
          headers: { origin: "https://attacker.example" },
        }),
      ),
    ).toBe(false);
    expect(clearAdminSession().headers.get("set-cookie")).toContain("Max-Age=0");
  });
});

function request(path: string, init: RequestInit = {}) {
  return new Request(`https://ktv.example${path}`, {
    ...init,
    headers: {
      origin: "https://ktv.example",
      "content-type": "application/json",
      ...init.headers,
    },
  });
}
