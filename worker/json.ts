import type { ApiErrorResponse } from "../src/types/api";

export function jsonResponse(body: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");

  return new Response(JSON.stringify(body), {
    ...init,
    headers,
  });
}

export function apiError(status: number, code: string, message: string, init: ResponseInit = {}) {
  return jsonResponse(
    {
      error: {
        code,
        message,
      },
    } satisfies ApiErrorResponse,
    { ...init, status },
  );
}
