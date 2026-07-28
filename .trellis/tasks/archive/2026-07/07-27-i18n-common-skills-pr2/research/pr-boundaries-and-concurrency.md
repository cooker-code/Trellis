# Research: PR1-B / PR2 / PR3 boundaries and concurrency

- **Query**: Map overlapping files, dependencies, ownership, and safe concurrency boundaries for the Chinese i18n content PR sequence.
- **Scope**: Internal planning
- **Date**: 2026-07-27

## Recommended merge order

```text
PR1-B -> PR2 -> PR3
```

PR2 should not implement on top of an unmerged/stale PR1-B checker branch, and PR3 explicitly depends on the locale propagation API that PR2 must establish.

Translation authoring can happen in parallel in separate worktrees, but logic/test integration should be serialized because all three PRs touch shared i18n/test infrastructure.

## Ownership by PR

### PR1-B owns

- complete `workflow.zh.md` translation;
- locale-neutral runtime parsing of translated workflow headings;
- workflow-only structural parity grammar;
- workflow init/update/runtime tests;
- English workflow source remains untouched.

### PR2 owns

- locale-aware source selection for common commands/single-file skills;
- locale-aware platform agent source selection for Markdown/TOML/JSON;
- explicit locale propagation through platform init writers and update collectors;
- localized generated common frontmatter descriptions;
- localized generated pull-based agent prelude;
- translations for 3 commands, 5 single-file skills, and 30 physical agent sources;
- all-platform path/byte parity, update locale switching, and source structure tests;
- a reusable selector/locale propagation contract for PR3.

### PR3 owns

- recursive bundled-skill localization;
- spec `*.zh.md.txt` sources and init-only blank-spec selection;
- Python user-facing message migration and dictionary checks;
- Beta localization documentation/roadmap;
- compound suffix drift checks and bundled/spec/Python coverage.

## Overlapping files

| File/area | PR1-B | PR2 | PR3 | Boundary |
|---|---:|---:|---:|---|
| `packages/cli/scripts/check-i18n-drift.js` | workflow deep structure | discover md/toml/json + PR2 pairs | compound md.txt + Python dictionaries | Serialize; each PR extends prior checker, never rewrites from stale base |
| `packages/cli/test/scripts/check-i18n-drift.test.ts` | workflow cases | generic PR2 suffix/pair cases | compound/Python cases | Same ownership order |
| `packages/cli/test/utils/i18n.test.ts` | workflow structure/content | common/agent selection or shared selector references | bundled/spec/Python resolver | Prefer new focused files; avoid turning one test into a merge hotspot |
| `packages/cli/test/commands/init.integration.test.ts` | Chinese workflow | common + agent format representatives | bundled + specs | Add separate numbered scenarios; serialize edits |
| `packages/cli/test/commands/update.integration.test.ts` | workflow switch/hash | platform common/agent switch/hash | bundled switch/hash | Add separate scenarios; PR3 builds on PR2 fixture/API |
| `packages/cli/test/regression.test.ts` | workflow parsers/markers | agent formats/preludes/path parity | bundled/spec-source regressions | High-conflict monolith; group additions under PR-specific describes and rebase serially |
| `packages/cli/src/templates/common/index.ts` | no | commands/skills locale caches + helper imports | bundled recursive overlay | PR2 establishes API; PR3 extends only bundled branch |
| `packages/cli/src/configurators/shared.ts` | no | locale-aware command/skill resolvers, descriptions, prelude | locale-aware `resolveBundledSkills` | PR2 first; PR3 consumes language argument rather than changing propagation |
| `packages/cli/src/configurators/index.ts` | no | language-aware registry configure/collect | ideally no change | PR2 must make locale available to every collector so PR3 is data/loader-only |
| all per-platform configurators | no | pass language to common/agent renderers | ideally no change | PR2 owns propagation; PR3's bundled resolver should flow through existing language arg |
| `packages/cli/src/templates/template-utils.ts` | no | generic canonical-English locale selector, md/json/toml readers | reuse for recursive/compound suffixes | PR2 defines stable reusable contract; PR3 may extend tests, not invent a second selector |
| `packages/cli/src/commands/init.ts` | maybe workflow tests only | pass resolved language through both full/reinit platform paths | ideally no change | PR2 owns platform propagation; PR3 consumes existing `language` in workflow/spec writer |
| `packages/cli/src/commands/update.ts` | workflow selected content | pass one resolved language into platform collectors | ideally no change | PR2 owns one-time resolution and propagation |
| docs-site | possibly README only if separately approved | none | Beta EN/ZH localization docs | PR2 must not edit docs-site |

## PR2 -> PR3 API contract

PR2 should leave PR3 these stable capabilities:

1. A pure source selector that:
   - uses English canonical paths;
   - overlays `<stem>.<locale><semantic-suffix>`;
   - falls back per file;
   - returns unsuffixed logical paths;
   - supports an explicit semantic suffix (including future `.md.txt`).
2. A normalized `SupportedLanguage` argument passed from `init`/`update` into every platform configure/collect path.
3. Locale-aware shared resolvers whose signatures can be reused by `resolveBundledSkills`.
4. Locale-keyed cache convention.
5. Tests proving path parity and `en -> zh -> en` isolation.

PR3 must not:

- call `resolveLanguage()` independently inside the bundled loader;
- add a second module-global locale;
- make each platform configurator re-resolve language;
- change landed path/hash semantics;
- overwrite existing `.trellis/spec/` during update.

## PR1-B -> PR2 checker contract

PR1-B is expected to make `check-i18n-drift.js` import-safe/testable and add workflow-specific structure comparison. PR2 should preserve that grammar and only add generic source families/extensions plus PR2-scoped completeness checks.

If PR1-B does not land first, PR2 should avoid a large checker refactor and limit itself to tests, then rebase/add checker support after PR1-B. Do not develop two incompatible checker architectures in parallel.

## Safe parallel work

The following can be authored concurrently in isolated worktrees because they add disjoint sidecar files:

- PR1-B workflow translation;
- PR2 common/agent translations;
- PR3 bundled/spec translations;
- PR3 documentation drafts.

The following are not safe to merge concurrently without a designated owner:

- drift checker and checker tests;
- `common/index.ts`;
- `configurators/shared.ts`;
- `configurators/index.ts` and platform configurators;
- init/update/regression test files.

## Detailed concurrency plan inside PR2

After the locale API/selector contract is fixed, work can be split into independent batches:

1. **Logic owner**: selector, locale propagation, generated descriptions/prelude, all-platform parity scaffolding.
2. **Common translation owner**: 8 common Markdown sidecars + description/prelude Chinese sources.
3. **Markdown agent owner**: Claude/Cursor/OpenCode/Gemini/Qoder/CodeBuddy/Droid/Pi sidecars.
4. **Structured agent owner**: Codex TOML + Kiro JSON sidecars and format checks.
5. **Integration owner**: init/update/hash/build smoke after all batches merge.

Do not let translation batches independently edit English sources or shared resolver code. Merge logic first, then translation files, then integration tests to reduce conflicts.

## Out-of-scope boundaries for PR2

- No `workflow.md` translation/parser work (PR1-B).
- No bundled-skill reference translation/recursive loader changes (PR3).
- No blank spec-template localization (PR3).
- No Python CLI message migration (PR3).
- No docs-site/roadmap localization (PR3).
- No TypeScript CLI help/prompt/error localization.
- No platform-specific hooks/settings/extensions translation.
- No new locales or runtime machine translation.
- No semantic rewrite/refactor of agent responsibilities.
- No task start, product code edit during planning, or task-root artifact edit by the Research Agent.

## Risk gates

- PR2 has broad practical fan-out despite mostly low-level filesystem selectors: 14 platforms, 11 generated agent sets, shared hash tracking, and two writers of `.agents/skills`.
- Before implementation, run GitNexus upstream impact analysis for each modified function/class/method. Warn before HIGH/CRITICAL edits.
- Before commit, run GitNexus change detection and verify all direct dependents are covered.
- Preserve unrelated dirty task/submodule work already present in the repository.

## Handoff rule

The caller should copy the final blueprint into task-root `prd.md`, `design.md`, `implement.md`, `implement.jsonl`, and `check.jsonl` only after review. This Research Agent intentionally writes only under PR2 `research/` and does not start the task.
