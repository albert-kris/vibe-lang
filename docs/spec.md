# Vibe Language Specification (v0.1)

Status: draft. This document is the normative reference for the Vibe language,
its intermediate representations, and the verification semantics.

## 1. Design goals

Vibe encodes **change intent for AI-driven code maintenance** as a typed,
versionable, mechanically verifiable artifact. The design separates four layers:

| Layer | Artifact | Owner |
|---|---|---|
| Prompt | natural-language request | end user |
| Spec | `change` declaration (Vibefile) | engineer reviews/maintains |
| Contract | Change IR (`plan.json`) + agent prompt | compiler (deterministic) |
| Enforcement | scope + acceptance verification over a git tree | verifier (deterministic) |

Two invariants govern the whole system:

1. **The compiler and verifier never call an LLM.** Same input, same output.
2. **The AI executor is untrusted.** Boundaries are enforced *after* execution
   against the actual git diff, not assumed from the executor's self-report.

## 2. Lexical structure

- Encoding: UTF-8. Whitespace insignificant except as token separator.
- Comments: `// line` and `/* block */`.
- `ID`: `[a-zA-Z_][a-zA-Z0-9_]*`
- `STRING`: double-quoted, `\`-escapes permitted.
- `NUMBER`: decimal integer or float.

## 3. Grammar (EBNF)

A document is a sequence of top-level declarations:

```ebnf
Document    ::= (AppDecl | ChangeDecl)*
```

### 3.1 Change declarations (core)

```ebnf
ChangeDecl  ::= "change" STRING "{"
                  "goal" STRING
                  ( ScopeBlock | RequirementsBlock | StyleHintsBlock
                  | ConstraintsBlock | AcceptanceBlock | RollbackDecl )*
                "}"

ScopeBlock        ::= "scope" "{" (("allow" | "forbid") STRING)* "}"
RequirementsBlock ::= "requirements" "{" (("add" | "remove" | "modify")? STRING)* "}"
StyleHintsBlock   ::= "style" "{" STRING* "}"
ConstraintsBlock  ::= "constraints" "{" STRING* "}"
AcceptanceBlock   ::= "acceptance" "{" (("test" | "run")? STRING)* "}"
RollbackDecl      ::= "rollback" ("revert" | "manual")
```

Sugar defaults: a bare string in `requirements` means `add`; a bare string in
`acceptance` means `test` (a behavioral check). Commands must be explicit
(`run "..."`). Repeated blocks of the same kind are merged in declaration
order; multiple `rollback` declarations are an error.

### 3.2 App declarations (bootstrap)

`app` declarations describe a full product for initial scaffolding. They are a
secondary capability; see the grammar file (`src/language/vibe.langium`) for
the complete rules covering `vibe`, `style`, `model`, `api`, `component`, and
`page` blocks.

## 4. Static semantics of `change`

A change declaration is **well-formed** iff all of the following hold
(violations are compile-time errors, no plan is emitted):

- C1. A `scope` block exists and contains at least one `allow` rule.
- C2. No pattern appears in both `allow` and `forbid`.
- C3. At least one requirement exists.
- C4. At least one acceptance item exists.

Rationale: a change without file boundaries is not safely executable (C1, C2);
a change without instructions is not executable at all (C3); a change without
verification criteria is not trustworthy (C4).

## 5. Change IR

The validated form of a change declaration. JSON Schema is derivable from the
Zod definition in `src/ir/change-ir.ts`; the shape is:

```ts
interface ChangeIR {
  title: string;
  goal: string;
  scope: { allow: string[]; forbid: string[] };
  requirements: { kind: 'add' | 'remove' | 'modify'; text: string }[];
  styleHints: string[];
  constraints: string[];
  acceptance: { kind: 'test' | 'run'; value: string }[];
  rollback?: 'revert' | 'manual';
}
```

`plan.json` wraps the IR as `{ "version": "0.1", "kind": "vibe-change-plan", "plan": ChangeIR }`.

## 6. Scope pattern semantics

Patterns are slash-separated path globs matched against repository-relative
paths (backslashes normalized to `/`):

- `**` matches zero or more path segments.
- `*` matches any characters within one segment.
- All other characters match literally.

**Decision procedure** for a changed file `f`:

1. If any `forbid` pattern matches `f` → violation (`forbidden`).
   Forbid takes precedence over allow.
2. Else if no `allow` pattern matches `f` → violation (`out-of-scope`).
3. Else → permitted.

## 7. Verification semantics

Given a plan `P` and a git repository `R`:

```text
verify(P, R):
  changed  := files reported by `git status --porcelain` in R
             (staged, unstaged, and untracked; rename targets)
  V        := scope violations per §6 over changed
  C        := for each acceptance item of kind `run`, execute the command
             in R; record exit codes
  passed   := V = ∅  ∧  ∀c ∈ C: exit(c) = 0
```

Acceptance items of kind `test` describe observable behavior; v0.1 reports
them as a checklist (automation via E2E generation is a roadmap item, §10).

The verifier exits `0` iff `passed`, making it directly usable as a CI gate.

## 8. Execution semantics (`vibe run`)

```text
run(vibefile, R, executor, maxAttempts):
  P := compile(vibefile)            # rejects ill-formed changes (§4)
  require clean_working_tree(R)     # baseline so the diff is exactly the AI's work
  prompt := render(P)               # deterministic agent contract
  for attempt in 1..maxAttempts:
    invoke executor with prompt     # any CLI: cursor-agent, claude, aider, ...
    result := verify(P, R)
    if result.passed: return PASS
    prompt := prompt + failure_report(result)   # feedback loop
  if P.rollback = revert: git checkout -- .     # restore tracked files
  return FAIL
```

The executor is configured per repository (`.vibe/config.json`) or per
invocation (`--executor`), as a shell template with `{promptFile}`, `{prompt}`,
and `{repo}` placeholders.

## 9. Repository convention

```text
.vibe/
  config.json     executor + retry budget        (versioned)
  changes/*.vibe  change intent files            (versioned - the engineering asset)
  build/          compiled plans                 (ignored)
  runs/           per-run artifacts and reports  (ignored)
```

Vibefiles are reviewed in pull requests like any other source file. The
history of `.vibe/changes/` is the project's machine-readable intent history.

## 10. Known limitations and roadmap

- `test` acceptance items are not yet executed (planned: lowering to
  Playwright/E2E harnesses).
- Scope enforcement is post-hoc; in-flight enforcement requires executor-side
  hooks (planned: hook adapters for agent CLIs that support them).
- `constraints` are conveyed to the executor but only partially machine-checked
  (planned: dependency-diff and migration-diff checkers).
- Single-change runs only; multi-change orchestration with dependency ordering
  is future work.
