import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const expectedGuardrails = {
  YOUTUBE_SEARCH_DAILY_LIMIT: 100,
  YOUTUBE_SEARCH_MAX_CALLS_PER_FILL: 1,
  YOUTUBE_SEARCH_TIMEOUT_MS: 1_600,
};

const mainConfig = readGuardrails("wrangler.toml");
const roomConfig = readGuardrails("wrangler.room.toml");

assertEqual(mainConfig, expectedGuardrails, "wrangler.toml");
assertEqual(roomConfig, expectedGuardrails, "wrangler.room.toml");
assertEqual(roomConfig, mainConfig, "Room/Main search guardrails");

const apiClient = readFileSync("src/lib/apiClient.ts", "utf8");
if (!/SEARCH_REQUEST_TIMEOUT_MS\s*=\s*2_000/.test(apiClient)) {
  fail("浏览器搜索硬截止必须保持为 2000ms。", { file: "src/lib/apiClient.ts" });
}

const searchService = readFileSync("worker/searchService.ts", "utf8");
if (!/DEFAULT_YOUTUBE_SEARCH_CALLS_PER_FILL\s*=\s*1/.test(searchService)) {
  fail("Worker 每次 cold fill 默认只能使用一次 search.list。", {
    file: "worker/searchService.ts",
  });
}
if (!/DEFAULT_YOUTUBE_SEARCH_TIMEOUT_MS\s*=\s*1_600/.test(searchService)) {
  fail("Worker 外部搜索预算必须保持为 1600ms。", {
    file: "worker/searchService.ts",
  });
}

console.log("✓ Search guardrails: 100/day, 1 cold call, 1600ms Worker, 2000ms browser");

run("Search quality and experience contracts", [
  "test",
  "--",
  "--config",
  "vitest.search.config.ts",
  "worker/searchQualityContract.test.ts",
  "worker/scoring.test.ts",
  "worker/searchFamily.test.ts",
  "worker/youtubeSearch.test.ts",
  "worker/searchService.test.ts",
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
