# Repository workflow

- Treat root `SEARCH.md` as the only current source of truth for search queries, relevance, intent, caching, recommendations, quota, deadlines, and search UX. Before changing those behaviors, read it and record the intended change; update it in the same batch, bump the documented/implemented algorithm or cache version when required by its matrix, and run `npm run verify:search`.
- Treat every completed repository change as a release workflow unless the user explicitly says not to publish. This is standing authorization to commit the scoped worktree, push the current release branch, redeploy Room then Main, and run production verification without asking the user to repeat the release instruction.
- Before declaring any change complete:
  1. Update `README.md` when behavior, architecture, APIs, operation, or release guidance changed.
  2. Update `PROGRESS.md` with the completed batch and real verification results.
  3. Run the relevant tests, typecheck, production build, and `git diff --check`.
  4. Commit only the scoped changes and push the current release branch.
  5. Deploy `wrangler.room.toml` first and `wrangler.toml` second with `--keep-vars`; do not skip redeployment because a change looks small or documentation-only unless the user explicitly says not to deploy.
  6. Run a production smoke test, record real deployment version IDs in `PROGRESS.md`, then commit and push that release record.
- Never claim a push or deployment succeeded until the remote/production result has been verified.
- Do not expose or overwrite secrets; preserve Dashboard-managed variables during deployment.
