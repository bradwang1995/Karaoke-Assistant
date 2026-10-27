import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const searchContract = readSearchContract("SEARCH.md");
const expectedGuardrails = {
  YOUTUBE_SEARCH_DAILY_LIMIT: searchContract.dailySearchListLimit,
  YOUTUBE_SEARCH_MAX_CALLS_PER_FILL: searchContract.maxSearchListCallsPerColdFill,
  YOUTUBE_SEARCH_TIMEOUT_MS: searchContract.workerDeadlineMs,
  SEARCH_CACHE_TTL_DAYS: searchContract.kvTtlDays,
  SEARCH_CACHE_MAX_ENTRY_BYTES: searchContract.kvMaxEntryBytes,
  SEARCH_RATE_LIMIT_PER_MINUTE: searchContract.rateLimitPerMinute,
};

const mainConfig = readGuardrails("wrangler.toml");
const roomConfig = readGuardrails("wrangler.room.toml");

assertEqual(mainConfig, expectedGuardrails, "wrangler.toml");
assertEqual(roomConfig, expectedGuardrails, "wrangler.room.toml");
assertEqual(roomConfig, mainConfig, "Room/Main search guardrails");

const apiClient = readFileSync("src/lib/apiClient.ts", "utf8");
assertNumericConstant(
  apiClient,
  "SEARCH_REQUEST_TIMEOUT_MS",
  searchContract.browserDeadlineMs,
  "src/lib/apiClient.ts",
);

const searchService = readFileSync("worker/searchService.ts", "utf8");
assertNumericConstant(
  searchService,
  "DEFAULT_YOUTUBE_SEARCH_CALLS_PER_FILL",
  searchContract.maxSearchListCallsPerColdFill,
  "worker/searchService.ts",
);
assertNumericConstant(
  searchService,
  "DEFAULT_YOUTUBE_SEARCH_TIMEOUT_MS",
  searchContract.workerDeadlineMs,
  "worker/searchService.ts",
);

const searchFamily = readFileSync("worker/searchFamily.ts", "utf8");
assertStringConstant(
  searchFamily,
  "SEARCH_ALGORITHM_VERSION",
  searchContract.searchAlgorithmVersion,
  "worker/searchFamily.ts",
);

const kvCache = readFileSync("worker/kvCache.ts", "utf8");
assertStringConstant(
  kvCache,
  "SEARCH_CACHE_VERSION",
  searchContract.searchCacheVersion,
  "worker/kvCache.ts",
);
assertStringConstant(
  kvCache,
  "SEARCH_RECOMMENDATIONS_VERSION",
  searchContract.recommendationsVersion,
  "worker/kvCache.ts",
);
assertNumericConstant(
  kvCache,
  "MAX_CACHED_SEARCH_RESULTS",
  searchContract.maxCachedResults,
  "worker/kvCache.ts",
);
assertNumericConstant(
  kvCache,
  "MAX_RECOMMENDED_SEARCH_RESULTS",
  searchContract.maxRecommendations,
  "worker/kvCache.ts",
);
assertNumericConstant(
  kvCache,
  "MAX_PROMOTED_RESULTS_PER_SEARCH",
  searchContract.maxPromotedRecommendationsPerSearch,
  "worker/kvCache.ts",
);

const youtubeSearch = readFileSync("worker/youtubeSearch.ts", "utf8");
assertStringConstant(youtubeSearch, "REGION_CODE", searchContract.regionCode, "worker/youtubeSearch.ts");
assertStringConstant(
  youtubeSearch,
  "RELEVANCE_LANGUAGE",
  searchContract.relevanceLanguage,
  "worker/youtubeSearch.ts",
);
assertNumericConstant(
  youtubeSearch,
  "SEARCH_PAGE_SIZE",
  searchContract.searchPageSize,
  "worker/youtubeSearch.ts",
);

const songFilter = readFileSync("worker/songFilter.ts", "utf8");
if ("maxDurationSecondsExclusive" in searchContract) {
  fail("SEARCH.md 不得再声明普通搜索时长硬上限。", { file: "SEARCH.md" });
}
if (/videoCategoryId\s*:|videoDuration\s*:/.test(youtubeSearch)) {
  fail("普通文字 search.list 不得设置 category 或 duration provider filter。", {
    file: "worker/youtubeSearch.ts",
  });
}
if (/YOUTUBE_MUSIC_CATEGORY_ID|MAX_SONG_DURATION_SECONDS|categoryId|durationSeconds/.test(songFilter)) {
  fail("结构准入不得依赖 Music category 或 duration。", { file: "worker/songFilter.ts" });
}

const scoring = readFileSync("worker/scoring.ts", "utf8");
assertStringConstant(
  readFileSync("src/lib/searchPolicyVersion.ts", "utf8"),
  "SEARCH_RESULT_POLICY_VERSION",
  searchContract.searchResultPolicyVersion,
  "src/lib/searchPolicyVersion.ts",
);
if (/hasSongTitleMatch|isKaraokeIntentResult|isOriginalVocalIntentResult/.test(scoring)) {
  fail("Query/intent scoring 不得重新成为准入 hard gate。", { file: "worker/scoring.ts" });
}

console.log(
  `✓ SEARCH.md contract: ${searchContract.dailySearchListLimit}/day, ` +
    `${searchContract.maxSearchListCallsPerColdFill} cold call, ` +
    `${searchContract.workerDeadlineMs}ms Worker, ${searchContract.browserDeadlineMs}ms browser`,
);

run("Search quality and experience contracts", [
  "test",
  "--",
  "--config",
  "vitest.search.config.ts",
  "worker/searchQualityContract.test.ts",
  "worker/scoring.test.ts",
  "worker/musicEligibility.test.ts",
  "worker/searchFamily.test.ts",
  "worker/youtubeSearch.test.ts",
  "worker/searchService.test.ts",
  "worker/searchRepository.test.ts",
  "worker/kvCache.test.ts",
  "worker/songFilter.test.ts",
  "worker/videoCatalog.test.ts",
  "worker/directVideoSearch.test.ts",
  "src/lib/searchExperience.test.ts",
  "src/lib/apiClient.test.ts",
  "src/lib/youtube.test.ts",
]);
run("TypeScript contracts", ["run", "typecheck"]);

console.log("✓ Zero-quota search verification passed; no real network access was allowed.");

function readGuardrails(file) {
  const source = readFileSync(file, "utf8");
  return Object.fromEntries(
    Object.keys(expectedGuardrails).map((key) => {
      const match = source.match(new RegExp(`^${key}\\s*=\\s*"(\\d+)"`, "m"));
      if (!match) {
        fail(`缺少 ${key}。`, { file });
      }
      return [key, Number(match[1])];
    }),
  );
}

function readSearchContract(file) {
  const source = readFileSync(file, "utf8");
  const match = source.match(
    /<!-- SEARCH_CONTRACT_START -->\s*```json\s*([\s\S]*?)\s*```\s*<!-- SEARCH_CONTRACT_END -->/,
  );

  if (!match) {
    fail("SEARCH.md 缺少机器可读的 SEARCH_CONTRACT。", { file });
  }

  try {
    const contract = JSON.parse(match[1]);
    if (contract.schemaVersion !== 1) {
      fail("SEARCH_CONTRACT schemaVersion 不受支持。", {
        expected: 1,
        actual: contract.schemaVersion,
      });
    }
    return contract;
  } catch (error) {
    fail("SEARCH_CONTRACT 不是合法 JSON。", {
      file,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

function assertStringConstant(source, name, expected, file) {
  const match = source.match(new RegExp(`${name}\\s*=\\s*["']([^"']+)["']`));
  if (!match || match[1] !== expected) {
    fail(`SEARCH.md 与 ${name} 不一致。`, {
      documented: expected,
      implemented: match?.[1],
      file,
    });
  }
}

function assertNumericConstant(source, name, expected, file) {
  const match = source.match(new RegExp(`${name}\\s*=\\s*([\\d_]+)`));
  const actual = match ? Number(match[1].replaceAll("_", "")) : undefined;
  if (actual !== expected) {
    fail(`SEARCH.md 与 ${name} 不一致。`, {
      documented: expected,
      implemented: actual,
      file,
    });
  }
}

function assertEqual(actual, expected, label) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    fail(`${label} 搜索保护配置不一致。`, { actual, expected });
  }
}

function run(label, args) {
  console.log(`\n> ${label}`);
  const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
  const result = spawnSync(npmCommand, args, {
    cwd: process.cwd(),
    env: {
      ...process.env,
      YOUTUBE_API_KEY: "",
      KARAOKE_ALLOW_LIVE_SEARCH: "0",
    },
    shell: process.platform === "win32",
    stdio: "inherit",
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function fail(message, details) {
  console.error(`✗ ${message}`);
  console.error(JSON.stringify(details, null, 2));
  process.exit(1);
}
