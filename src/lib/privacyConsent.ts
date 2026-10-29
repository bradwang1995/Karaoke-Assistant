export const POLICY_VERSION = "2026-10-28-v1";
export const CONSENT_STORAGE_KEY = "karaoke-assistant:privacy-consent";
type ConsentStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function createConsentStore(storage: () => ConsentStorage, clock = Date.now) {
  let fallback: boolean | undefined;
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((listener) => listener());
  return {
    accepted() {
      if (fallback !== undefined) return fallback;
      try {
        const raw = storage().getItem(CONSENT_STORAGE_KEY);
        if (!raw) return false;
        const record: unknown = JSON.parse(raw);
        return typeof record === "object" && record !== null &&
          "version" in record && record.version === POLICY_VERSION &&
          "acceptedAt" in record && typeof record.acceptedAt === "string" &&
          Number.isFinite(Date.parse(record.acceptedAt));
      } catch {
        return false;
      }
    },
    accept() {
      try {
        storage().setItem(CONSENT_STORAGE_KEY, JSON.stringify({
          version: POLICY_VERSION,
          acceptedAt: new Date(clock()).toISOString(),
        }));
        fallback = undefined;
      } catch {
        // Explicit consent remains valid for this page when storage is blocked.
        fallback = true;
      }
      emit();
    },
    revoke() {
      fallback = false;
      try { storage().removeItem(CONSENT_STORAGE_KEY); } catch { /* Keep this page revoked. */ }
      emit();
    },
    refresh() {
      fallback = undefined;
      emit();
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };
}

export const privacyConsent = createConsentStore(() => window.localStorage);

export function subscribePrivacyConsent(listener: () => void) {
  const unsubscribe = privacyConsent.subscribe(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === CONSENT_STORAGE_KEY || event.key === null) privacyConsent.refresh();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    unsubscribe();
    window.removeEventListener("storage", onStorage);
  };
}
