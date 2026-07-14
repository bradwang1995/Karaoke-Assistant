import type { ApiErrorResponse, CreateRoomResponse } from "../types/api";
import type { RoomSnapshot } from "../types/room";
import type { SearchResponse, SearchType, YouTubeQuotaStatus } from "../types/youtube";

export class ApiClientError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.code = code;
  }
}

export async function createRoomViaApi() {
  const response = await fetch("/api/rooms", {
    method: "POST",
    headers: {
      accept: "application/json",
    },
  });

  return parseJsonResponse<CreateRoomResponse>(response);
}

export async function fetchRoomSnapshot(roomId: string) {
  const response = await fetch(`/api/rooms/${roomId}/snapshot`, {
    headers: {
      accept: "application/json",
    },
  });

  return parseJsonResponse<RoomSnapshot>(response);
}

export async function cleanupRoomViaApi(roomId: string) {
  const response = await fetch(`/api/rooms/${roomId}/cleanup`, {
    method: "POST",
    headers: {
      accept: "application/json",
    },
  });

  return parseJsonResponse<RoomSnapshot>(response);
}

export async function searchVideosViaApi(
  roomId: string,
  query: string,
  limit = 10,
  options: { cacheFill?: boolean; searchType?: SearchType; includeOriginalVocal?: boolean } = {},
) {
  const response = await fetch(`/api/rooms/${roomId}/search`, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      query,
      limit,
      ...(typeof options.cacheFill === "boolean" ? { cacheFill: options.cacheFill } : {}),
      ...(options.searchType ? { searchType: options.searchType } : {}),
      ...(typeof options.includeOriginalVocal === "boolean"
        ? { includeOriginalVocal: options.includeOriginalVocal }
        : {}),
    }),
  });

  return parseJsonResponse<SearchResponse>(response);
}

export async function fetchYouTubeQuotaStatus() {
  const response = await fetch("/api/youtube/quota", {
    headers: {
      accept: "application/json",
    },
  });

  return parseJsonResponse<YouTubeQuotaStatus>(response);
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) {
    throw new ApiClientError(
      response.status,
      "NON_JSON_RESPONSE",
      "API did not return JSON.",
    );
  }

  const body = (await response.json()) as T | ApiErrorResponse;

  if (!response.ok) {
    const errorBody = body as ApiErrorResponse;
    throw new ApiClientError(
      response.status,
      errorBody.error?.code ?? "API_ERROR",
      errorBody.error?.message ?? "API request failed.",
    );
  }

  return body as T;
}
