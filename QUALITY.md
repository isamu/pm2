# Quality

Maintained by [ever-better](https://github.com/isamu/ever-better). Numbers are rendered from
`.ever-better/state.json`; edits outside the notes block are overwritten on the next run.

- Phase: **drain**
- Frozen: 2026-08-08T09:40:43.166Z
- Open violations: **3645**
- Rules improved since the ceiling: **0**
- Everything is at or below its ceiling.

## Worklist

Top to bottom. An unattended run works this list and nothing else.

- [x] **P0 diagnose** — taken 2026-08-08T09:40:21.066Z
- [ ] **P1 bootstrap** — 2 gap(s) still open
- [x] **P2 freeze** — frozen 2026-08-08T09:40:43.166Z
- [ ] **P3 drain** — 3645 violations across 70 rules
  - [ ] `sonarjs/no-parameter-reassignment` — 1 left
  - [ ] `sonarjs/reduce-initial-value` — 1 left
  - [ ] `sonarjs/duplicates-in-character-class` — 1 left
  - [ ] `sonarjs/code-eval` — 1 left
  - [ ] `sonarjs/no-invariant-returns` — 1 left
- [ ] **P4 tighten** — add the next rule tier, then freeze and drain again
- [ ] **P5 duplication and dead code** — report-only scans; extraction is judgment, not a threshold

## Ratchet

Ceiling is the count at the last freeze. It may fall and must never rise.

| Rule | Ceiling | Now | Change | Status |
| --- | ---: | ---: | ---: | --- |
| `id-length` | 1356 | 1356 | 0 | draining |
| `@typescript-eslint/no-unused-vars` | 920 | 920 | 0 | draining |
| `max-nested-callbacks` | 197 | 197 | 0 | draining |
| `max-lines-per-function` | 129 | 129 | 0 | draining |
| `@typescript-eslint/no-this-alias` | 122 | 122 | 0 | draining |
| `@typescript-eslint/no-unused-expressions` | 89 | 89 | 0 | draining |
| `sonarjs/no-unused-vars` | 63 | 63 | 0 | draining |
| `sonarjs/no-redundant-boolean` | 62 | 62 | 0 | draining |
| `sonarjs/no-nested-functions` | 61 | 61 | 0 | draining |
| `sonarjs/no-dead-store` | 54 | 54 | 0 | draining |
| `sonarjs/cognitive-complexity` | 49 | 49 | 0 | draining |
| `complexity` | 40 | 40 | 0 | draining |
| `sonarjs/no-ignored-exceptions` | 40 | 40 | 0 | draining |
| `no-useless-assignment` | 38 | 38 | 0 | draining |
| `sonarjs/assertions-in-tests` | 38 | 38 | 0 | draining |
| `no-prototype-builtins` | 29 | 29 | 0 | draining |
| `no-redeclare` | 27 | 27 | 0 | draining |
| `sonarjs/no-duplicate-test-title` | 25 | 25 | 0 | draining |
| `sonarjs/block-scoped-var` | 22 | 22 | 0 | draining |
| `sonarjs/no-os-command-from-path` | 20 | 20 | 0 | draining |
| `sonarjs/concise-regex` | 20 | 20 | 0 | draining |
| `no-empty` | 19 | 19 | 0 | draining |
| `@typescript-eslint/no-explicit-any` | 17 | 17 | 0 | draining |
| `sonarjs/no-skipped-tests` | 16 | 16 | 0 | draining |
| `no-useless-escape` | 13 | 13 | 0 | draining |
| `sonarjs/no-clear-text-protocols` | 13 | 13 | 0 | draining |
| `sonarjs/super-linear-regex` | 12 | 12 | 0 | draining |
| `sonarjs/no-nested-assignment` | 11 | 11 | 0 | draining |
| `sonarjs/regex-complexity` | 11 | 11 | 0 | draining |
| `sonarjs/todo-tag` | 10 | 10 | 0 | draining |
| `sonarjs/no-nested-conditional` | 10 | 10 | 0 | draining |
| `sonarjs/pseudo-random` | 9 | 9 | 0 | draining |
| `sonarjs/publicly-writable-directories` | 9 | 9 | 0 | draining |
| `no-unreachable` | 8 | 8 | 0 | draining |
| `sonarjs/no-duplicated-branches` | 8 | 8 | 0 | draining |
| `sonarjs/single-character-alternation` | 7 | 7 | 0 | draining |
| `max-depth` | 7 | 7 | 0 | draining |
| `sonarjs/file-permissions` | 6 | 6 | 0 | draining |
| `no-control-regex` | 4 | 4 | 0 | draining |
| `sonarjs/x-powered-by` | 4 | 4 | 0 | draining |
| `max-lines` | 3 | 3 | 0 | draining |
| `sonarjs/no-identical-functions` | 3 | 3 | 0 | draining |
| `sonarjs/prefer-single-boolean-return` | 3 | 3 | 0 | draining |
| `sonarjs/arguments-order` | 3 | 3 | 0 | draining |
| `sonarjs/no-globals-shadowing` | 2 | 2 | 0 | draining |
| `no-unassigned-vars` | 2 | 2 | 0 | draining |
| `preserve-caught-error` | 2 | 2 | 0 | draining |
| `@typescript-eslint/no-array-constructor` | 2 | 2 | 0 | draining |
| `no-misleading-character-class` | 2 | 2 | 0 | draining |
| `sonarjs/no-misleading-character-class` | 2 | 2 | 0 | draining |
| `no-self-assign` | 2 | 2 | 0 | draining |
| `sonarjs/no-gratuitous-expressions` | 2 | 2 | 0 | draining |
| `security/detect-object-injection` | 2 | 2 | 0 | draining |
| `sonarjs/slow-regex` | 2 | 2 | 0 | draining |
| `sonarjs/no-hardcoded-ip` | 2 | 2 | 0 | draining |
| `no-dupe-keys` | 2 | 2 | 0 | draining |
| `sonarjs/no-parameter-reassignment` | 1 | 1 | 0 | draining |
| `sonarjs/reduce-initial-value` | 1 | 1 | 0 | draining |
| `sonarjs/duplicates-in-character-class` | 1 | 1 | 0 | draining |
| `sonarjs/code-eval` | 1 | 1 | 0 | draining |
| `sonarjs/no-invariant-returns` | 1 | 1 | 0 | draining |
| `sonarjs/no-redundant-jump` | 1 | 1 | 0 | draining |
| `no-global-assign` | 1 | 1 | 0 | draining |
| `sonarjs/no-control-regex` | 1 | 1 | 0 | draining |
| `sonarjs/prefer-while` | 1 | 1 | 0 | draining |
| `max-params` | 1 | 1 | 0 | draining |
| `no-dupe-else-if` | 1 | 1 | 0 | draining |
| `sonarjs/no-identical-conditions` | 1 | 1 | 0 | draining |
| `no-async-promise-executor` | 1 | 1 | 0 | draining |
| `sonarjs/stable-tests` | 1 | 1 | 0 | draining |

## Other counters

| Counter | Ceiling | Now |
| --- | ---: | ---: |
| eslint:warnings | 1037 | 1037 |

## Outstanding

### bootstrap

- [ ] **No test runner** — Draining warnings finds bugs. Without a runner there is nowhere to pin them.
- [ ] **Missing package scripts: build** — CI runs scripts, not commands. A gate with no script behind it cannot be enforced.

### drain

- [ ] **No CLAUDE.md / AGENTS.md** — Draining is done by agents. Rules that live only in your head produce a different fix every session.

### tighten

- [ ] **Only 1% of sources are TypeScript** — The type-aware rules cover the typed part only, so the remaining .js files are the blind spot the counts will not show.
- [ ] **6 strictness flags `strict` does not include are off** — Measured with `tsc --showConfig`, after every extends: noUncheckedIndexedAccess, exactOptionalPropertyTypes, noImplicitReturns, noFallthroughCasesInSwitch, noImplicitOverride, noPropertyAccessFromIndexSignature. Type errors have no suppression mechanism, so enable them one at a time and measure the cost first.

### split

- [ ] **14 files over 600 lines** — These are the split-and-DRY backlog. Knowing the count now makes the limit a choice.

## Work log

| Date | Commit | Kind | Rule | What |
| --- | --- | --- | --- | --- |
| 2026-08-08 | 2f404a42 | drained | no-undef | fixed cst/completer ReferenceErrors in lib/API/Extra.js and lib/completion.js; regression test in test/interface/completion.mocha.js |

## Notes

<!-- ever-better:notes:start -->
_Anything written between these markers survives a re-render._
<!-- ever-better:notes:end -->
