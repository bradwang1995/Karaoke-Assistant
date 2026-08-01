import { afterEach, describe, expect, it, vi } from "vitest";
import {
  SEARCH_REQUEST_TIMEOUT_MS,
  SearchRequestTimeoutError,
  searchVideosViaApi,
} from "./apiClient";

describe("search API client deadline", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("aborts a text search at the two-second UX limit", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("Aborted", "AbortError"));
        });
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const request = searchVideosViaApi("room-test", "林俊杰", 50, {
      searchType: "artist",
    });
    const rejection = expect(request).rejects.toBeInstanceOf(SearchRequestTimeoutError);

    await vi.advanceTimersByTimeAsync(SEARCH_REQUEST_TIMEOUT_MS);
    await rejection;
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
