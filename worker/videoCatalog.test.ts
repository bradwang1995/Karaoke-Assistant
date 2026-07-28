import { describe, expect, it } from "vitest";
import {
  buildCatalogMatchQuery,
  searchVideoCatalog,
  upsertVideoCatalog,
} from "./videoCatalog";

describe("persistent video catalog", () => {
  it("builds a bounded FTS query from song and artist terms", () => {
    expect(buildCatalogMatchQuery("My Heart Will Go On", "Celine Dion")).toBe(
      '"my" AND "heart" AND "will" AND "go" AND "on" AND "celine" AND "dion"',
    );
    expect(buildCatalogMatchQuery("青花瓷", "周杰伦")).toBe('"青花瓷" AND "周杰伦"');
  });

  it("reranks catalog matches and keeps unrelated song titles hidden", async () => {
    const rows = [
      catalogRow("original", "青花瓷 official MV 原唱"),
      catalogRow("karaoke", "青花瓷 KTV 伴奏版"),
      catalogRow("channel-only", "另一首歌 KTV", "青花瓷频道"),
      ...Array.from({ length: 9 }, (_, index) =>
        catalogRow(`related-${index}`, `青花瓷 karaoke ${index}`),
      ),
    ];
    const db = new CatalogD1({ searchRows: rows }).database;

    const results = await searchVideoCatalog({
      db,
      query: "青花瓷",
      searchType: "song",
      includeOriginalVocal: false,
      limit: 50,
    });

    expect(results).toHaveLength(11);
    expect(results[0].videoId).toBe("karaoke");
    expect(results.map((result) => result.videoId)).not.toContain("channel-only");
  });

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
});

class CatalogD1 {
  batchSizes: number[] = [];
  private searchRows: Record<string, unknown>[];
  private existingVideoIds: string[];

  constructor({
    searchRows = [],
    existingVideoIds = [],
  }: {
    searchRows?: Record<string, unknown>[];
    existingVideoIds?: string[];
  }) {
    this.searchRows = searchRows;
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

  all(sql: string) {
    if (sql.includes("FROM search_video_catalog_fts")) {
      return this.searchRows;
    }

    return [];
  }
}

class CatalogStatement {
  videoId = "";

  constructor(
    private readonly db: CatalogD1,
    private readonly sql: string,
  ) {}

  bind(...values: unknown[]) {
    this.videoId = typeof values[0] === "string" ? values[0] : "";
    return this;
  }

  async all<T = Record<string, unknown>>() {
    return d1Result(this.db.all(this.sql) as T[]);
  }

  async first<T = Record<string, unknown>>() {
    return (this.db.all(this.sql)[0] as T | undefined) ?? null;
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

function catalogRow(videoId: string, title: string, channelTitle = "KTV Studio") {
  return {
    video_id: videoId,
    title,
    channel_title: channelTitle,
    thumbnail_url: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
    duration_seconds: 240,
    published_at: "2026-01-01T00:00:00Z",
  };
}

function catalogCandidate(videoId: string, title: string) {
  return {
    videoId,
    title,
    channelTitle: "KTV Studio",
    durationSeconds: 240,
  };
}
