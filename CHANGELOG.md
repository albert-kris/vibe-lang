# Changelog

## 0.1.0 (unreleased)

Initial public release.

- Vibe Change Language: `change` declarations with `goal`, `scope` (allow/forbid),
  `requirements`, `style`, `constraints`, `acceptance` (test/run), `rollback`
- Compiler front end built on Langium: parser, typed AST, validated Change IR (Zod)
- `vibe run`: full execute-verify-retry loop with pluggable AI executors
- `vibe verify`: mechanical scope checking against git diffs + acceptance commands,
  CI-friendly exit codes and `--json` output
- `vibe init`: repository scaffolding (`.vibe/` convention)
- Secondary: `vibe generate` bootstraps a Next.js + Prisma project from an `app` declaration
- Test suite (vitest), CI workflow, Apache-2.0 license
