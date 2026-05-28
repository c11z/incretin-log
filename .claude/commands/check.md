Run all checks before pushing. Run these steps and report a pass/fail summary:

1. From `site/`, run `npm run typecheck`.
2. From `site/`, run `npm run build`.
3. Check for uncommitted changes with `git status` and `git diff --stat`.

Report a summary: what passed, what failed, and whether there are uncommitted changes.
