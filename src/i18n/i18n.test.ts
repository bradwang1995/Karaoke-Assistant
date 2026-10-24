import { afterEach, describe, expect, it, vi } from "vitest";
import english from "./en.json";
import { formatRelativeQuotaReset } from "../lib/quotaReset";
import { quotaResetMessage, searchPartialMessage } from "../lib/searchExperience";

function browser(browserLanguage = "en-CA", preference?: string, blocked = false) {
  const data = new Map<string, string>();
  if (preference) data.set("karaoke-assistant:language", preference);
  const storage = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value); },
    removeItem: (key: string) => { data.delete(key); },
  };
  const window = new EventTarget();
  Object.defineProperty(window, "localStorage", { get: () => {
    if (blocked) throw new Error("Storage blocked");
    return storage;
  } });
  const document = { documentElement: { lang: "" }, title: "" };
  vi.stubGlobal("window", window);
  vi.stubGlobal("document", document);
  vi.stubGlobal("navigator", { language: browserLanguage });
  return { window, storage, document };
}

async function load() {
  vi.resetModules();
  return import("./index");
}

afterEach(() => vi.unstubAllGlobals());

describe("browser language preference", () => {
  it.each(["zh", "zh-CN", "zh-TW", "zh-HK", "zh-Hant", "ZH-hans", "zh_SG"])("detects Chinese variant %s", async (language) => {
    browser(language);
    expect((await load()).getLanguage()).toBe("zh");
  });

  it.each(["en-CA", "fr-CA", "ja", "ko", "de", ""])("defaults other languages to English: %s", async (language) => {
    browser(language);
    expect((await load()).getLanguage()).toBe("en");
  });

  it("prioritizes saved choices, ignores invalid preferences, and sets page metadata", async () => {
    const first = browser("zh-CN", "en");
    expect((await load()).getLanguage()).toBe("en");
    expect(first.document.documentElement.lang).toBe("en");
    expect(first.document.title).toBe("KTV Assistant");
    browser("zh-TW", "invalid");
    expect((await load()).getLanguage()).toBe("zh");
  });

  it("persists a manual choice across module reloads and notifies subscribers", async () => {
    const env = browser("en-CA");
    const locale = await load();
    const listener = vi.fn();
    const unsubscribe = locale.subscribeLanguage(listener);
    locale.setLanguage("zh");
    expect(env.storage.getItem(locale.LANGUAGE_STORAGE_KEY)).toBe("zh");
    expect(listener).toHaveBeenCalledOnce();
    expect(env.document.documentElement.lang).toBe("zh-Hans");
    expect(env.document.title).toBe("K歌助手");
    unsubscribe();
    expect((await load()).getLanguage()).toBe("zh");
  });

  it("syncs other tabs through storage events and follows the browser when cleared", async () => {
    const env = browser("en-CA");
    const locale = await load();
    const listener = vi.fn();
    const unsubscribe = locale.subscribeLanguage(listener);
    const dispatch = (key: string | null) => env.window.dispatchEvent(Object.assign(new Event("storage"), { storageArea: env.storage, key }));
    env.storage.setItem(locale.LANGUAGE_STORAGE_KEY, "zh");
    dispatch("unrelated");
    expect(locale.getLanguage()).toBe("en");
    dispatch(locale.LANGUAGE_STORAGE_KEY);
    expect(locale.getLanguage()).toBe("zh");
    env.storage.removeItem(locale.LANGUAGE_STORAGE_KEY);
    dispatch(null);
    expect(locale.getLanguage()).toBe("en");
    unsubscribe();
    dispatch(locale.LANGUAGE_STORAGE_KEY);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("keeps independent browser profiles isolated", async () => {
    const firstBrowser = browser("zh-CN");
    const firstLocale = await load();
    browser("en-CA");
    const secondLocale = await load();
    secondLocale.setLanguage("en");
    expect(firstLocale.getLanguage()).toBe("zh");
    expect(firstBrowser.storage.getItem(firstLocale.LANGUAGE_STORAGE_KEY)).toBeNull();
  });

  it("supports blocked storage and keeps the manual choice on languagechange", async () => {
    const env = browser("en-CA", undefined, true);
    const locale = await load();
    const unsubscribe = locale.subscribeLanguage(() => {});
    expect(() => locale.setLanguage("zh")).not.toThrow();
    env.window.dispatchEvent(new Event("languagechange"));
    expect(locale.getLanguage()).toBe("zh");
    unsubscribe();
  });

  it("follows browser language changes only without a saved preference", async () => {
    const env = browser("en-CA");
    const locale = await load();
    const unsubscribe = locale.subscribeLanguage(() => {});
    vi.stubGlobal("navigator", { language: "zh-HK" });
    env.window.dispatchEvent(new Event("languagechange"));
    expect(locale.getLanguage()).toBe("zh");
    locale.setLanguage("en");
    env.window.dispatchEvent(new Event("languagechange"));
    expect(locale.getLanguage()).toBe("en");
    unsubscribe();
  });
});

describe("localized messages", () => {
  it("preserves interpolation values and custom content verbatim", async () => {
    browser("en-CA");
    const { translate } = await load();
    expect(translate("已点歌成功：{0}", ["陈楚生《耍赖》"])).toBe("Added to queue: 陈楚生《耍赖》");
    expect(translate("自定义房间名")).toBe("自定义房间名");
    expect(translate("toString")).toBe("toString");
    expect(translate("搜索", [], "zh")).toBe("搜索");
  });

  it("keeps all catalog placeholders aligned and supplies English text", () => {
    for (const [chinese, translated] of Object.entries(english)) {
      expect(translated.trim(), chinese).not.toBe("");
      expect(translated, chinese).not.toMatch(/\p{Script=Han}/u);
      expect(translated.match(/\{\d+\}/g)?.sort() ?? [], chinese).toEqual(chinese.match(/\{\d+\}/g)?.sort() ?? []);
    }
  });

  it("localizes quota and partial results without changing recovery behavior", async () => {
    browser("en-CA");
    const { translate } = await load();
    const now = Date.parse("2026-10-23T10:00:00Z");
    expect(formatRelativeQuotaReset("2026-10-23T11:30:00Z", now, translate)).toBe("Quota resets in 2 hours");
    expect(formatRelativeQuotaReset("invalid", now, translate)).toBe("Reset time unavailable");
    expect(formatRelativeQuotaReset("2026-10-23T09:00:00Z", now, translate)).toBe("Quota resets shortly");
    expect(quotaResetMessage(undefined, translate)).toBe("Reset time unavailable");
    expect(searchPartialMessage({ query: "test", normalizedQuery: "test", results: [], cached: false, cacheMeta: { sourceQueryCount: 0, cachedResultCount: 0, servedFromExpandedCache: false, providerRateLimited: true } }, translate)).toContain("YouTube is temporarily rate limiting");
  });
});


it("translates known server cleanup templates without altering user text", async () => {
  browser("en-CA");
  const { translateServiceMessage } = await load();
  expect(translateServiceMessage("本批已删除 12 条低复用资料，存储已达到目标范围。"))
    .toBe("Deleted 12 low-reuse records. Storage is within the target range.");
  expect(translateServiceMessage("达到 80% 后，按复用次数、最近使用、创建时间依次从低到高选择；每批最多 50 条，目标降至 65% 以下。"))
    .toBe("At 80% capacity, select records by lowest reuse, oldest use, then oldest creation. Up to 50 records per batch, targeting below 65%.");
  expect(translateServiceMessage("朋友的自定义房间")).toBe("朋友的自定义房间");
});
