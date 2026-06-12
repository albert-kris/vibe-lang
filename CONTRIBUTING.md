# Contributing

Thanks for your interest in vibe-lang.

## Development setup

```bash
npm install
npm run langium:generate   # regenerate parser after editing src/language/vibe.langium
npm run typecheck
npm test
```

Run the CLI from source:

```bash
npm run vibe -- --help
npm run vibe -- compile examples/add-search.vibe
```

## Project layout

| Path | Purpose |
|---|---|
| `src/language/vibe.langium` | Grammar (single source of truth for syntax) |
| `src/ir/` | Validated intermediate representations (Zod schemas) |
| `src/compile/` | AST → IR transforms and semantic checks |
| `src/generate/` | Deterministic generators (plans, prompts, app scaffolding) |
| `src/verify/` | Scope checking and acceptance verification |
| `src/executor/` | Pluggable AI executor integration |
| `src/commands/` | CLI subcommands |
| `test/` | vitest suites |
| `docs/spec.md` | Language specification |

## Rules of the road

- The grammar, IR schemas, and verifier are the contract. Changes to any of them
  need tests and a `docs/spec.md` update.
- Generators must stay deterministic: same IR in, same bytes out. No LLM calls
  inside the compiler or verifier.
- Semantic checks should fail closed: an ambiguous change plan is a rejected
  change plan.

## Submitting changes

1. Fork, branch, make your change with tests.
2. `npm run typecheck && npm test` must pass.
3. Open a PR describing the motivation; small focused PRs review faster.
