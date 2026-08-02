import { beforeEach, vi } from "vitest";

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      throw new Error(
        `Search contract attempted real network access: ${String(input)}. Stub fetch explicitly instead.`,
      );
    }),
  );
});
