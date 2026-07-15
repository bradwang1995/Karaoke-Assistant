# Repository workflow

- Treat a substantial feature batch or internal-test repair round as a release workflow unless the user explicitly says not to publish.
- Before declaring a substantial batch complete:
  1. Update `README.md` when behavior, architecture, APIs, operation, or release guidance changed.
  2. Update `PROGRESS.md` with the completed batch and real verification results.
  3. Run the relevant tests, typecheck, production build, and `git diff --check`.
  4. Commit only the scoped changes and push the current release branch.
  5. When Worker code or frontend assets changed, deploy `wrangler.room.toml` first and `wrangler.toml` second with `--keep-vars`.
  6. Run a production smoke test, record real deployment version IDs in `PROGRESS.md`, then commit and push that release record.
- Never claim a push or deployment succeeded until the remote/production result has been verified.
- Do not expose or overwrite secrets; preserve Dashboard-managed variables during deployment.
