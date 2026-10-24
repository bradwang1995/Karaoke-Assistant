import { interpolate } from "./messages";
import { useSyncExternalStore } from "react";
import english from "./en.json";

export type Language = "zh" | "en";
export const LANGUAGE_STORAGE_KEY = "karaoke-assistant:language";
const catalog: Record<string, string> = english;

export function resolveLanguage(preference: unknown, browserLanguage?: string): Language {
  if (preference === "zh" || preference === "en") return preference;
  return /^zh(?:[-_]|$)/i.test(browserLanguage ?? "") ? "zh" : "en";
}

function readLanguage(): Language {
  let preference: string | null = null;
  try {
    preference = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
  } catch {
    // Private browsing or blocked storage still supports in-memory switching.
  }
  return resolveLanguage(preference, typeof navigator === "undefined" ? "zh" : navigator.language);
}

let language = readLanguage();
let memoryPreference: Language | null = null;
const listeners = new Set<() => void>();

function updateLanguage(next: Language) {
  language = next;
  if (typeof document !== "undefined") {
    document.documentElement.lang = next === "zh" ? "zh-Hans" : "en";
    document.title = next === "zh" ? "K歌助手" : "KTV Assistant";
  }
  listeners.forEach((listener) => listener());
}

export function setLanguage(next: Language) {
  try {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, next);
    memoryPreference = null;
  } catch {
    memoryPreference = next;
    // Keep the selection for this tab even when persistence is unavailable.
  }
  updateLanguage(next);
}

function onStorage(event: StorageEvent) {
  let localStorage: Storage;
  try {
    localStorage = window.localStorage;
  } catch {
    return;
  }
  if (event.storageArea === localStorage && (event.key === LANGUAGE_STORAGE_KEY || event.key === null)) {
    memoryPreference = null;
    updateLanguage(readLanguage());
  }
}

function onBrowserLanguageChange() {
  updateLanguage(memoryPreference ?? readLanguage());
}

export function subscribeLanguage(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1 && typeof window !== "undefined") {
    window.addEventListener("storage", onStorage);
    window.addEventListener("languagechange", onBrowserLanguageChange);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && typeof window !== "undefined") {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("languagechange", onBrowserLanguageChange);
    }
  };
}

export function useLanguage() {
  return useSyncExternalStore(subscribeLanguage, () => language, () => "zh" as Language);
}

export function getLanguage() {
  return language;
}

export function getLocale() {
  return language === "zh" ? "zh-CN" : "en-CA";
}

export function translate(key: string, values: readonly (string | number)[] = [], target = language): string {
  const template = target === "en" && Object.prototype.hasOwnProperty.call(catalog, key)
    ? catalog[key]
    : key;
  return interpolate(template, values);
}

// Apply the detected language before the first React render.
updateLanguage(language);

// Only known server-generated templates are translated. User content is untouched.
const serviceTemplates = [
  "本批已删除 {0} 条低复用资料，存储已达到目标范围。",
  "本批已删除 {0} 条低复用资料；D1 容量统计可能延迟，必要时可再次预览。",
  "达到 {0}% 后，按复用次数、最近使用、创建时间依次从低到高选择；每批最多 {1} 条，目标降至 {2}% 以下。",
];

export function translateServiceMessage(message: string) {
  for (const template of serviceTemplates) {
    const pattern = template.split(/\{\d+\}/).map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("([0-9.]+)");
    const match = message.match(new RegExp(`^${pattern}$`));
    if (match) return translate(template, match.slice(1));
  }
  return translate(message);
}
