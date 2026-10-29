import { describe, expect, it, vi } from "vitest";
import { CONSENT_STORAGE_KEY, POLICY_VERSION, createConsentStore } from "./privacyConsent";

function storage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value); },
    removeItem: (key: string) => { data.delete(key); },
  };
}

describe("versioned privacy consent", () => {
  it("does not infer consent from absent, corrupt, old or incomplete records", () => {
    const db = storage();
    const store = createConsentStore(() => db);
    expect(store.accepted()).toBe(false);
    for (const raw of ["broken", "null", "true", JSON.stringify({ version: "old", acceptedAt: "2026-10-28" }), JSON.stringify({ version: POLICY_VERSION }), JSON.stringify({ version: POLICY_VERSION, acceptedAt: "bad date" })]) {
      db.setItem(CONSENT_STORAGE_KEY, raw);
      expect(store.accepted()).toBe(false);
    }
  });

  it("persists only policy version and timestamp and restores in a fresh store", () => {
    const db = storage();
    const store = createConsentStore(() => db, () => Date.parse("2026-10-28T12:00:00Z"));
    store.accept();
    expect(JSON.parse(db.getItem(CONSENT_STORAGE_KEY)!)).toEqual({ version: POLICY_VERSION, acceptedAt: "2026-10-28T12:00:00.000Z" });
    const restored = createConsentStore(() => db);
    expect(restored.accepted()).toBe(true);
    restored.revoke();
    expect(restored.accepted()).toBe(false);
    expect(store.accepted()).toBe(false);
  });

  it("supports explicit page-only acceptance and revocation with blocked storage", () => {
    const store = createConsentStore(() => { throw new Error("Storage blocked"); });
    expect(store.accepted()).toBe(false);
    store.accept();
    expect(store.accepted()).toBe(true);
    store.revoke();
    expect(store.accepted()).toBe(false);
    expect(createConsentStore(() => { throw new Error("Storage blocked"); }).accepted()).toBe(false);
  });

  it("notifies active subscribers and reconciles changes from another tab", () => {
    const db = storage();
    const a = createConsentStore(() => db);
    const b = createConsentStore(() => db);
    const listener = vi.fn();
    const unsubscribe = b.subscribe(listener);
    a.accept();
    b.refresh();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(b.accepted()).toBe(true);
    a.revoke();
    b.refresh();
    expect(b.accepted()).toBe(false);
    unsubscribe();
    b.refresh();
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
