# vibe-lang

**A language and toolchain for AI-driven code maintenance.**

[Website](./docs/index.html) · [中文文档](./README.zh-CN.md) · [Language spec](./docs/spec.md) · License: Apache-2.0

> The website (`docs/index.html`) is a self-contained teaching page — enable
> GitHub Pages from the `/docs` folder and it serves as the project homepage.

---

## The problem

The way we direct AI coding agents today is chat. Chat is great for expressing
intent once — and terrible as an engineering artifact:

- Requirements are scattered across conversation history. Nobody can review them.
- The agent decides for itself which files to touch. "Don't break payments" is a hope, not a guarantee.
- "Done" means the agent says it's done. There is no mechanical acceptance check.
- Six months later, nobody knows why the code changed.

As more code is written and maintained by AI, the scarce skill is no longer
writing code — it is **specifying changes precisely enough that an AI can
execute them and a machine can verify them**.

## The idea

vibe-lang gives change intent a typed, versionable, executable form: the **Vibefile**.

```text
natural language        ──  prompt layer    (fast, human)
        ↓
change declaration      ──  spec layer      (reviewable, versioned   ← the Vibefile)
        ↓
plan.json + agent prompt──  contract layer  (deterministic compile)
        ↓
AI executor edits code  ──  execution layer (any agent CLI, untrusted)
        ↓
scope + acceptance check──  enforcement     (deterministic verify, CI gate)
```

Think of it the way you think of infrastructure files:

| File | Encodes |
|---|---|
| `Dockerfile` | how a container is built |
| `Makefile` | how tasks are executed |
| `*.tf` | how infrastructure is provisioned |
| **`*.vibe`** | **how AI is allowed to modify software** |

Two design invariants:

1. **Compiler and verifier never call an LLM.** Same input, same output, every time.
2. **The AI executor is untrusted.** File boundaries are enforced against the
   actual `git` diff after execution — not assumed from the agent's self-report.

## A Vibefile

```vibe
change "add product search" {
  goal "Add title search to the home page product list"

  scope {
    allow "src/app/page.tsx"
    allow "src/components/**"
    allow "src/lib/queries.ts"

    forbid "src/app/api/payment/**"   // never touched, no matter what
    forbid "prisma/**"                // no schema changes in this change
  }

  requirements {
    "Search input at the top of the product list"
    "Filter products by title, case-insensitive"
    "Search term reflected in the URL as query param q"
  }

  constraints {
    "no new npm dependency"
    "keep the GET /api/products response shape unchanged"
  }

  acceptance {
    "typing a keyword narrows the product list"
    "the search term survives a page reload"
    run "npx tsc --noEmit"
    run "npm test"
  }

  rollback revert
}
```

The syntax is deliberately small: one declaration, six blocks, about a dozen
keywords. Bare strings do the obvious thing — a requirement defaults to `add`,
an acceptance line defaults to a behavioral `test`; only commands need an
explicit `run`. Prefix `remove`/`modify` when intent differs.

If a change has no `scope`, no `requirements`, or no `acceptance` — or a
pattern is both allowed and forbidden — **it does not compile**. An ambiguous
change plan is a rejected change plan.

## Quick start

```bash
npm install        # from a clone; npm package publication is planned
npm run build
npm link           # makes the `vibe` command available
```

In the repository you want to maintain:

```bash
vibe init
# .vibe/config.json           executor configuration
# .vibe/changes/example.vibe  your first Vibefile (version this directory)
```

Configure an executor in `.vibe/config.json` — any AI coding CLI works:

```json
{
  "executor": "cursor-agent -p \"$(cat {promptFile})\" --force",
  "maxAttempts": 2
}
```

Then run a change end-to-end:

```bash
vibe run .vibe/changes/add-search.vibe
```

What happens:

1. The Vibefile is compiled and statically checked; a `plan.json` and a
   deterministic agent prompt are written to `.vibe/runs/<title>/`.
2. The working tree must be clean (so the diff is exactly the AI's work).
3. The executor runs inside the repo with the prompt as its contract.
4. The verifier checks every changed file against `allow`/`forbid` and runs
   every acceptance command.
5. On failure, the failure report is appended to the prompt and the executor
   retries (up to `maxAttempts`). On final failure with `rollback revert`,
   tracked files are restored.

No executor configured? `vibe run` falls back to manual mode: it prints the
prompt path for you to paste into any AI tool, and the `verify` command to run
afterwards.

### Verification as a CI gate

```bash
vibe verify .vibe/runs/add-product-search/plan.json --repo . --json
```

Exit code `0` iff no scope violations and all acceptance commands pass — wire
it directly into CI so no AI-authored PR merges outside its declared boundary.

## Commands

| Command | Purpose |
|---|---|
| `vibe init` | Scaffold `.vibe/` in a repository |
| `vibe compile <file.vibe>` | Compile change declarations to `plan.json` + agent prompt |
| `vibe run <change.vibe>` | Execute a change end-to-end (compile → AI → verify → retry) |
| `vibe verify <plan.json> --repo <dir>` | Enforce a change plan against a git tree |
| `vibe generate <app.vibe>` | Bootstrap a project from an `app` declaration (secondary) |

## Repository convention

```text
.vibe/
  config.json     executor + retry budget         (versioned)
  changes/*.vibe  change intent files             (versioned — the engineering asset)
  build/          compiled plans                  (gitignored)
  runs/           run artifacts + verify reports  (gitignored)
```

Vibefiles go through pull-request review like any other source file. The
history of `.vibe/changes/` becomes the project's machine-readable intent
history — who changed what, within which boundaries, verified how.

## Who maintains the Vibefiles?

Most users speak natural language; an assistant drafts the Vibefile. The role
we expect to emerge — call it the **vibe coding engineer** — reviews and
maintains the spec layer:

```text
ordinary user      : "add search, don't touch payment code"
vibe engineer      : reviews scope, tightens acceptance, versions the Vibefile
AI executor        : edits code within the contract
verifier + CI      : proves the contract was honored
```

The analogy: most people never hand-write SQL or Dockerfiles, yet databases
and deployments would be unmanageable without them.

## Architecture

```text
src/language/vibe.langium   grammar (Langium) → parser + typed AST + LSP-ready
src/ir/                     Zod-validated intermediate representations
src/compile/                AST → IR transforms, semantic checks (fail closed)
src/generate/               deterministic emitters: plans, prompts, scaffolds
src/verify/                 glob scope checker + acceptance runner over git
src/executor/               pluggable agent CLI integration
src/commands/               CLI subcommands
```

See [docs/spec.md](./docs/spec.md) for the normative grammar, IR schemas, and
verification semantics.

## Roadmap

- [ ] Automate `test` acceptance items (lower to Playwright/E2E)
- [ ] Machine-check `constraints` (dependency diff, migration diff)
- [ ] In-flight scope enforcement via executor hooks (block writes, not just detect)
- [ ] NL → Vibefile drafting with schema-constrained LLM output
- [ ] Multi-change orchestration with dependency ordering
- [ ] VS Code extension (Langium LSP: completion, diagnostics, hovers)
- [ ] npm package publication

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md). The short version: grammar, IR, and
verifier changes need tests and a spec update; generators stay deterministic.

## License

[Apache-2.0](./LICENSE)
