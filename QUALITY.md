# Quality

Maintained by [ever-better](https://github.com/isamu/ever-better). Numbers are rendered from
`.ever-better/state.json`; edits outside the notes block are overwritten on the next run.

- Phase: **diagnose**
- Frozen: not yet — run `ever-better freeze`
- Open violations: **0**
- Rules improved since the ceiling: **0**
- Everything is at or below its ceiling.

## Worklist

Top to bottom. An unattended run works this list and nothing else.

- [x] **P0 diagnose** — taken 2026-08-08T08:37:19.234Z
- [ ] **P1 bootstrap** — 5 gap(s) still open
- [ ] **P2 freeze** — baseline not pinned yet
- [ ] **P3 drain** — backlog empty
- [ ] **P4 tighten** — add the next rule tier, then freeze and drain again
- [ ] **P5 duplication and dead code** — report-only scans; extraction is judgment, not a threshold

## Ratchet

Ceiling is the count at the last freeze. It may fall and must never rise.

No rule violations recorded yet. Run `ever-better freeze`.

## Outstanding

### bootstrap

- [ ] **ESLint is not configured** — Nothing enforces anything yet. This is the first thing bootstrap installs.
- [ ] **No TypeScript** — Types are the cheapest rule set there is, and the type-aware lint tier cannot run without them. `ever-better migrate` walks it one file at a time, dependencies first.
- [ ] **No formatter** — Formatting must land before linting starts, or the first drain PR is a diff nobody can read.
- [ ] **No test runner** — Draining warnings finds bugs. Without a runner there is nowhere to pin them.
- [ ] **Missing package scripts: format, lint, build, typecheck** — CI runs scripts, not commands. A gate with no script behind it cannot be enforced.

### drain

- [ ] **No CLAUDE.md / AGENTS.md** — Draining is done by agents. Rules that live only in your head produce a different fix every session.

### tighten

- [ ] **No dead-code detection** — knip reports unused exports and files. Report-only at first; a counter later.

### split

- [ ] **No duplication detection** — jscpd is what turns 'this feels repetitive' into a number that can only go down.
- [ ] **14 files over 600 lines** — These are the split-and-DRY backlog. Knowing the count now makes the limit a choice.

### review

- [ ] **CI does not run on macos** — Path handling and file watching break per platform, and only per platform.
- [ ] **CI does not run lint** — The rules are configured but nothing runs them on a pull request.
- [ ] **CI does not run `ever-better check`** — A baseline is only a ratchet if something rejects a regression. Thorough CI that never runs the gate enforces nothing, and looks identical from the outside.

## Notes

<!-- ever-better:notes:start -->
_Anything written between these markers survives a re-render._
<!-- ever-better:notes:end -->
