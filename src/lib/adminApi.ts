import type {
  AdminDeleteRepositoryResult,
  AdminOverview,
  AdminRange,
  AdminRepositoryPage,
  AdminResponseSource,
  AdminSearchEventPage,
  AdminSessionStatus,
} from "../types/admin";
import type { SearchType } from "../types/youtube";
import { ApiClientError } from "./apiClient";

export const adminSessionQueryKey = ["admin-session"] as const;

export async function fetchAdminSession() {
  return adminRequest<AdminSessionStatus>("/api/admin/session");
}

export async function loginAdmin(password: string) {
  return adminRequest<AdminSessionStatus>("/api/admin/session", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ password }),
  });
}

export async function logoutAdmin() {
  return adminRequest<{ authenticated: false }>("/api/admin/session", { method: "DELETE" });
}

export async function fetchAdminOverview(range: AdminRange) {
  return adminRequest<AdminOverview>(`/api/admin/overview?range=${range}`);
}

export async function fetchAdminSearches(options: {
  range: AdminRange;
  page: number;
  query?: string;
  source?: AdminResponseSource;
}) {
  const params = new URLSearchParams({
    range: options.range,
    page: String(options.page),
    pageSize: "20",
  });
  if (options.query) params.set("query", options.query);
  if (options.source) params.set("source", options.source);
  return adminRequest<AdminSearchEventPage>(`/api/admin/searches?${params}`);
}

export async function fetchAdminRepository(options: {
  page: number;
  query?: string;
  searchType?: SearchType;
  sort?: "recent" | "reuse" | "results" | "size";
  direction?: "asc" | "desc";
}) {
  const params = new URLSearchParams({
    page: String(options.page),
    pageSize: "20",
    sort: options.sort ?? "recent",
    direction: options.direction ?? "desc",
  });
  if (options.query) params.set("query", options.query);
  if (options.searchType) params.set("searchType", options.searchType);
  return adminRequest<AdminRepositoryPage>(`/api/admin/repository?${params}`);
}

export async function deleteAdminRepository(ids: string[]) {
  return adminRequest<AdminDeleteRepositoryResult>("/api/admin/repository", {
    method: "DELETE",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ids }),
  });
}

async function adminRequest<T>(path: string, init: RequestInit = {}) {
  const response = await fetch(path, {
    ...init,
    credentials: "same-origin",
    headers: {
      accept: "application/json",
      ...init.headers,
    },
  });
  const contentType = response.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) {
    throw new ApiClientError(response.status, "NON_JSON_RESPONSE", "后台接口没有返回 JSON。");
  }

  const body = (await response.json()) as T | {
    error?: { code?: string; message?: string };
  };

  if (!response.ok) {
    const error = body as { error?: { code?: string; message?: string } };
    const requestError = new ApiClientError(
      response.status,
      error.error?.code ?? "ADMIN_API_ERROR",
      error.error?.message ?? "后台请求失败。",
    );

    if (response.status === 401 && typeof window !== "undefined") {
      window.dispatchEvent(new Event("ktv-admin-unauthorized"));
    }

    throw requestError;
  }

  return body as T;
}
