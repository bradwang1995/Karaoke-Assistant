# Repository workflow

## Default: local development, no release

- Default to scoped implementation and local validation. Do not deploy, run production smoke tests, or push main unless the user explicitly requests a release/deployment. A request to change code or copy is not a release request. This also applies to documentation-only changes such as this workflow update.
- Main is connected to Cloudflare Workers Builds: pushing main can deploy production. Do not push main as a way to save local work. Leave changes reviewable locally unless the user asks to commit; commit/push alone does not authorize production deployment. If asked to push main without a release, explain its deployment consequence before proceeding.
- Read root SEARCH.md before changing search behavior; it remains the only current source of truth for queries, relevance, intent, caching, recommendations, quota, deadlines and search UX. Record the intended change and update the contract/version when required by its matrix.
- Before marking local development complete, run the smallest relevant validation and git diff --check. Pure copy/docs changes do not automatically require full tests or a build. Logic changes need focused tests and typecheck; search behavior changes need npm run verify:search. Broaden validation only when risk justifies it or at release.
- Update README.md when behavior, architecture, APIs, operation or workflow changed, and PROGRESS.md with actual results. Distinguish locally validated, awaiting user review, and released; never invent results.

## Help the user preview and test

- The user is new to local preview and local Workers. Proactively choose and explain the appropriate level using README section 4. Run setup/checks yourself when tools allow; do not merely hand the user a command list.
- For each relevant change, provide the exact local URL, whether the server is running, what to click, expected results, checks already run, and any remaining limitations. If no UI changed, say a browser preview is unnecessary.
- For copy/layout/UI changes, use Vite localhost preview. For backend/API/D1/KV/DO/WebSocket changes, use both Workers locally with local migrations and local bindings. Never describe Vite localStorage/BroadcastChannel fallback as proof of real Worker behavior.
- Explain hot reload versus rebuild: Vite reflects frontend edits immediately; Wrangler serves dist, so frontend edits require npm run build then refresh. Keep the terminal running; Ctrl+C stops the service. If a port is occupied, use the actual port printed by the server and tell the user.
- Use a fresh Codex built-in @Browser session for frontend testing, visual checks, console/network debugging and localhost. Do not use personal Chrome unless explicitly requested.
- Local bindings isolate Cloudflare storage, but outbound fetches (including YouTube) can still be real. Use mocks/no API key by default; do not copy production credentials or use remote bindings/--remote/--tunnel as a local-testing shortcut. Do not print secrets.

## Release: only when explicitly requested

- Batch reviewed local changes into one release. Run relevant tests, full npm test, npm run typecheck, npm run build, npm run verify:search, and git diff --check before release.
- Commit only scoped changes. Deploy wrangler.room.toml first and wrangler.toml second, both with --keep-vars. Push the release branch as requested; because main push also triggers Main auto-deploy, if it happens before manual deployment, finish with Room → Main and verify the final active versions.
- Run production smoke tests, starting with zero-quota cacheOnly search; do not run cold text searches without explicit authorization. Record real deployment version IDs and real validation in PROGRESS.md, then commit/push that release record with [CI Skip] for documentation-only commits.
- Never claim a push or deployment succeeded until remote/production results are verified. Preserve Dashboard-managed variables and secrets.
