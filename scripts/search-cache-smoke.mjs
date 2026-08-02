const options = parseArgs(process.argv.slice(2));
const baseUrl = options["base-url"] ?? "https://ktv-assistant.bradwang1995.workers.dev";
const roomId = required(options, "room-id");
const query = required(options, "query");
const searchType = options["search-type"] === "artist" ? "artist" : "song";
const includeOriginalVocal = options.original === "true";

const quotaBefore = await readQuota(baseUrl);
const response = await fetch(`${baseUrl}/api/rooms/${encodeURIComponent(roomId)}/search`, {
  method: "POST",
  headers: {
    accept: "application/json",
    "content-type": "application/json; charset=utf-8",
  },
  body: JSON.stringify({
    query,
    limit: 50,
    searchType,
    includeOriginalVocal,
    cacheOnly: true,
  }),
});
const body = await response.json();
const quotaAfter = await readQuota(baseUrl);

if (!response.ok) {
  throw new Error(`Cache-only smoke failed with HTTP ${response.status}: ${JSON.stringify(body)}`);
}
if (body.cacheMeta?.cacheOnly !== true) {
  throw new Error("Server did not acknowledge cacheOnly=true; refusing to call this a zero-quota smoke.");
}
if (
  body.cacheMeta?.sourceQueryCount !== 0 ||
  body.cacheMeta?.externalCallAvoided !== true
) {
  throw new Error(`Cache-only contract was violated: ${JSON.stringify(body.cacheMeta)}`);
}
if (quotaBefore.used !== quotaAfter.used) {
  throw new Error(`Quota changed during cache-only smoke: ${quotaBefore.used} -> ${quotaAfter.used}`);
}

console.log(
  JSON.stringify(
    {
      mode: "cache-only",
      quotaUsedBefore: quotaBefore.used,
      quotaUsedAfter: quotaAfter.used,
      cacheHit: body.cached === true && body.results.length > 0,
      resultCount: body.results.length,
      topTitles: body.results.slice(0, 5).map((result) => result.title),
    },
    null,
    2,
  ),
);

async function readQuota(base) {
  const response = await fetch(`${base}/api/youtube/quota`, {
    headers: { accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`Quota preflight failed with HTTP ${response.status}.`);
  }
  return response.json();
}

function parseArgs(args) {
  const parsed = {};
  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    if (!token.startsWith("--")) continue;
    const [rawKey, inlineValue] = token.slice(2).split("=", 2);
    const value = inlineValue ?? args[index + 1];
    if (inlineValue === undefined && value && !value.startsWith("--")) index += 1;
    parsed[rawKey] = value ?? "true";
  }
  return parsed;
}

function required(options, key) {
  const value = options[key]?.trim();
  if (!value) {
    throw new Error(`Missing --${key}.`);
  }
  return value;
}
