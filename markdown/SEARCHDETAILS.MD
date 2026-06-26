# Search Details

Last updated: 2026-06-26

This document captures the next search-system change request before implementation. The goal is to spend scarce YouTube search quota on broader, reusable result sets, then serve most user searches from cache.

## Current Verified Behavior

- Production search endpoint: `POST https://ktv-assistant.bradwang1995.workers.dev/api/rooms/:roomId/search`
- `YOUTUBE_API_KEY` is configured on both `ktv-assistant` and `ktv-assistant-room`.
- Step 9.5 verification room: `6z3b0y00`
- Query: `后来`
- First request returned real YouTube results with `cached: false`.
- Repeated request returned the same result set with `cached: true`.
- Current public API clamps requested `limit` to `1..8`.
- Current YouTube provider fills up to 50 cached results per search family from one `search.list` page, scores them, then returns the requested slice.
- Current KV search cache TTL defaults to 365 days.
- Blank-query search returns up to 8 cached recommendation results from `yt-search-recommendations:v1:CA:zh-Hans`.
- Cached search-family reads are re-ranked against the user's current query before slicing.

## Product Goal

When a guest searches for one song, the backend should use that quota spend to cache a much richer pool of KTV candidates:

- The exact song title.
- Closely related song-title variants.
- The artist's other likely karaoke songs.
- Related works that people might naturally request in the same party context.
- Multiple language/script variants where useful, especially Chinese, pinyin, English titles, and common karaoke keywords.

The user-facing response can still return a small ranked set, but the cache should retain a larger reusable candidate pool.

## Important API Constraints

Google's current YouTube Data API docs say `search.list` `maxResults` accepts `0..50`. For this project, the practical cache-fill target is therefore one `maxResults=50` request per cold search.

The docs also say `q` supports Boolean OR with `|` and exclusion with `-`, which may help combine related terms into fewer requests. The pipe character must be URL-escaped when sent over HTTP.

Quota should be treated as configurable. The current project budget is treated as 50 `search.list` calls/day. With one request per cold search, the app can support up to about 50 uncached user searches/day before relying entirely on cache.

References:

- https://developers.google.com/youtube/v3/docs/search/list
- https://developers.google.com/youtube/v3/determine_quota_cost

## Proposed Behavior

### Request Shape

Keep the existing endpoint:

```txt
POST /api/rooms/:roomId/search
```

Near-term request body:

```json
{
  "query": "后来",
  "limit": 8
}
```

Future optional fields:

```json
{
  "query": "后来",
  "artist": "刘若英",
  "limit": 8,
  "cacheFill": true
}
```

### Response Shape

Keep the existing shape for frontend compatibility:

```json
{
  "query": "后来",
  "normalizedQuery": "后来 ktv",
  "cached": false,
  "results": []
}
```

Future optional metadata can be added without breaking the frontend:

```json
{
  "cacheMeta": {
    "sourceQueryCount": 1,
    "cachedResultCount": 50,
    "servedFromExpandedCache": true
  }
}
```

## Query Expansion Strategy

For a user query like `后来`, generate a compact set of search intents:

1. Exact KTV intent:
   - `后来 ktv`
   - `后来 karaoke`
   - `后来 伴奏`
   - `后来 卡拉OK`
2. Artist-aware intent when artist is known:
   - `刘若英 后来 ktv`
   - `刘若英 karaoke`
   - `刘若英 经典歌曲 ktv`
3. Related title intent:
   - Known aliases, translations, pinyin, or common typo variants.
   - Related songs from the same artist catalog.
4. Negative filters:
   - Consider excluding covers, live, reaction, tutorial, or lyric-only videos only after checking whether this hurts KTV availability.

The first implementation should avoid making an LLM call in the hot path. Start with deterministic expansion and a small curated alias/catalog file. Later, a background process or admin tool can enrich aliases.

## 50-Result Single-Page Cache Fill

Target behavior:

- Store up to 50 deduplicated candidates per normalized search family.
- Use exactly one `search.list` request for a cold cache fill:
  - First page only: `maxResults=50`
- If future expanded-query work is added, cap total outbound calls by daily quota budget and keep the default hot path at one call.
- Deduplicate by `videoId`.
- Score all candidates once, then store the full scored list.
- Serve the frontend from the cached list using the requested `limit`.

If the daily budget is 50 `search.list` calls and each cold fill uses 1 call, the hard maximum is about 50 full cache fills/day.

## Cache Model

Current KV key pattern:

```txt
yt-search:v1:<normalizedQuery>:CA:zh-Hans
```

Recommended future key model:

```txt
yt-search:v2:<searchFamilyHash>:CA:zh-Hans
yt-search-index:v1:<normalizedQuery>:CA:zh-Hans -> <searchFamilyHash>
yt-search-recommendations:v1:CA:zh-Hans
```

This allows several equivalent queries to reuse the same cached family:

- `后来`
- `后来 ktv`
- `刘若英 后来`
- `后来 karaoke`

Recommended cached entry fields:

```json
{
  "queryFamily": {
    "canonicalQuery": "后来",
    "artist": "刘若英",
    "aliases": ["后来 ktv", "刘若英 后来", "后来 karaoke"]
  },
  "createdAt": "2026-06-25T00:00:00.000Z",
  "expiresAt": "2026-07-25T00:00:00.000Z",
  "sourceQueries": [],
  "results": [],
  "stats": {
    "resultCount": 50,
    "youtubeSearchCalls": 1,
    "videosListCalls": 1
  }
}
```

## Cache Size Policy

Use KV for search-cache payloads first. Treat the cache as disposable and rebuildable.

Suggested policy:

- Increase TTL from 6 hours to something longer, such as 7 to 30 days, once result quality is good.
- Keep an approximate byte-size estimate per cache entry.
- Add metadata keys for cache age, hit count, and payload size.
- Evict low-hit or oldest cache families before high-hit families.
- Do not put this cache in D1 unless we need SQL queries over cached video metadata.

The idea of using up to 50% of available storage for search cache is reasonable as a product direction, but implementation should be based on the actual storage product limits and cost model at the time we build it.

## Ranking Notes

Retain and extend current scoring:

- Strongly prefer results whose title exactly matches, starts with, or contains the searched song title.
- Treat channel-only query matches, same-artist songs, and related songs as lower-priority results.
- Prefer title/channel signals: `KTV`, `karaoke`, `卡拉OK`, `伴奏`, `instrumental`, `pinyin`.
- Prefer embeddable videos.
- Prefer medium-length music videos and karaoke tracks.
- Downrank lyric-only, tutorial, cover-only, reaction, shorts, and unrelated live performances.
- Keep reasons in each result for debugging.

## Implementation Phases

1. Keep internal provider fetch at 50 results and store the full scored cache result.
2. Keep frontend response `limit` small while returning from the larger cache.
3. Keep default cache fill to one `search.list` call.
4. Add query-family keys and alias mapping.
5. Keep quota budget guardrails and cache-fill throttling configurable.
6. Add admin/debug visibility for cache entries and hit rates.

## Open Questions

- Monitor whether the actual daily `search.list` limit for this Google Cloud project changes from 50.
- Decide whether 50 cached candidates should be per exact query, per song, or per artist/song family.
- Decide whether related artist works should be curated manually, generated offline, or inferred from YouTube results.
- Decide whether cache warming should happen only after user search or also via a manual/admin prewarm tool.

## 2026-06-26 Playback Follow-Up Check

The display autoplay and quality-preference changes did not change the search API, quota model, cache keys, ranking logic, or recommendation pool behavior. Search remains capped at up to 8 user-facing results from the cached/scored candidate pool, with cold cache fill still defaulting to one `search.list` request.
