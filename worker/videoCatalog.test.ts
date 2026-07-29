import { describe, expect, it } from "vitest";
import { upsertVideoCatalog } from "./videoCatalog";

describe("passive video candidate catalog", () => {
  it("counts only newly inserted unique candidates", async () => {
    const fake = new CatalogD1({ existingVideoIds: ["existing"] });
    const result = await upsertVideoCatalog(
      fake.database,
      [
        catalogCandidate("existing", "青花瓷 KTV"),
        catalogCandidate("new", "青花瓷 karaoke"),
        catalogCandidate("new", "青花瓷 karaoke duplicate"),
      ],
      "青花瓷",
    );

    expect(result).toEqual({
      candidateCount: 2,
      uniqueVideosAdded: 1,
    });
    expect(fake.batchSizes).toEqual([2, 1]);
  });

  it("does not persist non-music or seven-minute candidates", async () => {
    const valid = catalogCandidate("valid", "青花瓷 KTV");
    const nonMusic = { ...catalogCandidate("travel", "加拿大旅游"), categoryId: "19" };
    const tooLong = { ...catalogCandidate("concert", "完整演唱会"), durationSeconds: 420 };

    await expect(
      upsertVideoCatalog(undefined, [valid, nonMusic, tooLong], "青花瓷"),
    ).resolves.toEqual({
      candidateCount: 1,
      uniqueVideosAdded: 0,
    });
  });
});

class CatalogD1 {
  batchSizes: number[] = [];
  private existingVideoIds: string[];

  constructor({
    existingVideoIds = [],
  }: {
    existingVideoIds?: string[];
  }) {
    this.existingVideoIds = existingVideoIds;
  }

  database: D1Database = {
    prepare: (sql: string) => new CatalogStatement(this, sql) as D1PreparedStatement,
    batch: async (statements: D1PreparedStatement[]) => {
      this.batchSizes.push(statements.length);
      const isInsertBatch = this.batchSizes.length === 1;
      return statements.map((statement) => {
        const videoId = (statement as CatalogStatement).videoId;
        const changes =
          isInsertBatch && this.existingVideoIds.includes(videoId) ? 0 : 1;
        return d1Result([], changes);
      });
    },
    exec: async () => ({ count: 0, duration: 0 }),
    withSession: () => {
      throw new Error("Not implemented in catalog test.");
    },
    dump: async () => new ArrayBuffer(0),
  };

}

class CatalogStatement {
  videoId = "";

  constructor(_db: CatalogD1, _sql: string) {}

  bind(...values: unknown[]) {
    this.videoId = typeof values[0] === "string" ? values[0] : "";
    return this;
  }

  async all<T = Record<string, unknown>>() {
    return d1Result<T>([]);
  }

  async first<T = Record<string, unknown>>() {
    return null;
  }

  async run<T = Record<string, unknown>>() {
    return d1Result<T>([]);
  }

  async raw<T = unknown[]>(options: { columnNames: true }): Promise<[string[], ...T[]]>;
  async raw<T = unknown[]>(options?: { columnNames?: false }): Promise<T[]>;
  async raw<T = unknown[]>(options?: { columnNames?: boolean }) {
    return options?.columnNames ? ([[]] as [string[], ...T[]]) : ([] as T[]);
  }
}

function d1Result<T>(results: T[], changes = 0) {
  return {
    success: true as const,
    results,
    meta: d1Meta(changes),
  };
}

function d1Meta(changes = 0) {
  return {
    duration: 0,
    size_after: 0,
    rows_read: 0,
    rows_written: 0,
    last_row_id: 0,
    changed_db: false,
    changes,
  };
}

function catalogCandidate(videoId: string, title: string) {
  return {
    videoId,
    title,
    channelTitle: "KTV Studio",
    durationSeconds: 240,
    categoryId: "10",
    tags: ["music", "karaoke"],
  };
}
