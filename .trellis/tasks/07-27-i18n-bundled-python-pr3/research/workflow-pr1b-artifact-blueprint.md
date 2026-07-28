# Research: Complete PR1-B planning artifact blueprint

- **Query**: Draft complete `prd.md`, `design.md`, `implement.md`, `implement.jsonl`, and `check.jsonl` for `.trellis/tasks/07-27-i18n-workflow-pr1b` without editing that task.
- **Scope**: internal planning
- **Date**: 2026-07-27

## Critical task-resolution caveat

`python3 ./.trellis/scripts/task.py current --source` resolved:

```text
Current task: .trellis/tasks/07-27-i18n-bundled-python-pr3
Source: session:claude_f7ca65de-dbf9-4d8c-83f7-5b0c1c6efca4
```

The delegated target is `.trellis/tasks/07-27-i18n-workflow-pr1b`, but the Research Agent contract permits writes only under the **resolved current task’s** `research/` directory. Therefore the requested target-task files were not modified. The caller should resolve/switch the session pointer deliberately, then copy/adapt the following blueprint into the PR1-B task. Do not run `task.py start` during that planning handoff.

---

## Proposed `prd.md`

```markdown
# i18n PR1-B: complete Chinese workflow

## Goal

Replace the PR1-A sample `workflow.zh.md` with a complete Chinese translation of the current bundled native workflow while preserving every machine-consumed contract, and prove that Chinese init/update/runtime paths behave the same as English.

## Requirements

### Translation scope

- Translate all human- and LLM-facing natural-language content in `packages/cli/src/templates/trellis/workflow.zh.md`, including headings, prose, table labels/cells, prompt examples, fenced-block comments, and HTML/Markdown comments.
- Use the current `packages/cli/src/templates/trellis/workflow.md` as the sole semantic source. Remove the PR1-A placeholder note and stale English body rather than incrementally translating the obsolete Chinese copy.
- Keep terminology consistent across the file. Preserve Trellis and platform proper names and stable Trellis domain terms where translating them would create ambiguous aliases.

### Protected content

- Preserve commands, flags, slash commands, paths, filenames, environment variables, JSON/YAML keys, code identifiers, status values, and quoted runtime literals exactly.
- Preserve all Phase/Step numbers and workflow qualifiers such as `[required · once]`, `[required · repeatable]`, `[optional · repeatable]`, and `[on demand]`.
- Preserve every `[workflow-state:STATUS]` opening/closing tag, STATUS value, platform marker, placeholder, code-fence language, and link target.
- Keep the English source byte-unchanged; Chinese remains a sibling `workflow.zh.md` source and lands as `.trellis/workflow.md` only through locale selection.

### Runtime compatibility

- Chinese Phase Index headings and Step titles must remain consumable by `get_context.py`, bundled Python workflow parsing, Python SessionStart hooks, Codex/Copilot SessionStart copies, OpenCode SessionStart context generation, and per-turn breadcrumb parsers.
- Runtime parsing must not add Chinese-specific heading literals. Locale-sensitive Phase Index boundaries must be derived from preserved workflow-state structure with backward compatibility for existing English/custom workflows.
- Breadcrumb STATUS pairing, platform filtering, Codex inline/sub-agent routing, and missing-structure fallback behavior must remain unchanged.

### Structural drift detection

- Extend i18n drift validation with content-based structural parity for the English/Chinese workflow pair, while retaining existing missing-counterpart and Git-recency checks.
- Structural parity must cover workflow-state tags, platform markers, numbered Steps and qualifiers, heading outline, code fences, inline technical spans, placeholders/XML-like tags, link targets, protected lexical tokens, and comment-block count.
- Drift remains warning-only by default and fails under `--strict`.
- Translation-completeness checks must reject the PR1-A placeholder and an English tail without rejecting intentional English proper names/identifiers.

### Integration coverage

- Verify `getWorkflowTemplate("zh")` returns the complete Chinese source and unsupported locales still fall back to exact English.
- Verify `trellis init --language zh` lands the exact Chinese workflow at `.trellis/workflow.md`, creates no locale-suffixed landed file, and records the Chinese landed hash under the locale-agnostic workflow key.
- Verify `trellis update` switches a pristine hash-tracked English workflow to Chinese based on selected project language, refreshes its hash, preserves user-owned config, and is idempotent on rerun.
- Verify compact Phase Index extraction, Step extraction, platform filtering, SessionStart overview generation, and breadcrumb emission against Chinese workflow content.
- Preserve all existing English init/update/runtime tests.

## Constraints

- Do not change the semantic workflow, required gates, routing decisions, or examples beyond translation and parser compatibility.
- Do not modify `packages/cli/src/templates/trellis/workflow.md`.
- Do not bypass `.template-hashes.json` conflict protection when switching locale.
- Distributed Python remains standard-library-only and Python 3.9 compatible.
- Planning only: do not start this task until `prd.md`, `design.md`, `implement.md`, and context manifests are reviewed.

## Out of Scope

- PR2 agents, common commands, or common skills.
- PR3 bundled skills, spec templates, or Python user-facing message migration.
- CLI TypeScript output/help translation.
- Platform-specific instruction-template translation.
- Marketplace workflow translation or new locales.
- README/docs-site changes unless separately requested.

## Acceptance Criteria

- [ ] `workflow.zh.md` is based on the current English source, contains Chinese content in every major section and numbered Step, and contains no PR1-A placeholder or stale English tail.
- [ ] English and Chinese workflow templates satisfy automated structural parity with category-specific diagnostics.
- [ ] All protected commands, paths, statuses, Phase/Step numbers, workflow-state tags, platform markers, placeholders, code fences, and link targets remain equivalent.
- [ ] Chinese Phase Index and Step content are returned correctly by `get_context.py --mode phase` and `--mode phase --step <X.Y>` with platform filtering.
- [ ] Shared Python, Codex, Copilot, and OpenCode SessionStart parsers produce a compact Chinese workflow overview without detailed Step bodies or duplicated workflow-state blocks.
- [ ] Python and OpenCode breadcrumb parsers emit Chinese workflow-state bodies verbatim and preserve fallback behavior.
- [ ] `init({ language: "zh" })` lands exact Chinese workflow bytes at `.trellis/workflow.md`; no `.zh.md` landed path/hash key exists.
- [ ] Same-version update changes a pristine English landed workflow to Chinese, refreshes `.trellis/workflow.md` hash to the Chinese bytes, preserves configured language, and is idempotent on rerun.
- [ ] Default English init/update output remains byte-compatible with the current English template.
- [ ] `pnpm run i18n:check`, lint, typecheck, focused tests, and the full test suite pass.
```

---

## Proposed `design.md`

```markdown
# Design: complete Chinese workflow with runtime-safe structural parity

## Context

PR1-A introduced locale selection and a sample `workflow.zh.md`, but the Chinese file still contains an explicit placeholder and an older English workflow body. The current workflow is runtime input, not documentation only: parsers consume workflow-state tags, platform markers, numbered Step headings, and the compact Phase Index range. Full heading translation therefore requires parser compatibility, structural validation, and init/update round-trip coverage.

## Design Goals

1. Make the Chinese workflow semantically complete and reviewable beside the untouched English source.
2. Preserve every machine-consumed token and workflow gate.
3. Remove locale-specific English-heading assumptions from compact Phase Index extraction without changing normal English behavior.
4. Detect future structural drift before it reaches generated projects.
5. Keep landed paths and hash ownership locale-agnostic.

## Non-Goals

- General Markdown translation infrastructure beyond the workflow pair.
- Translation of platform templates, skills, specs, CLI text, or Python user messages.
- Workflow semantic redesign.
- Migration manifests or partial workflow block merging.

## Source and Translation Boundary

`packages/cli/src/templates/trellis/workflow.md` remains the authoritative English source and is not edited. `workflow.zh.md` is rebuilt from the current English file, then only natural-language surfaces are translated.

Protected material remains exact:

- machine markers: workflow-state tags, platform marker lines, placeholders;
- control identifiers: status values, Phase/Step numbers, bracket qualifiers;
- technical material: commands, flags, paths, filenames, env vars, keys, identifiers, slash commands, link targets;
- code-fence delimiter/language sequence and exact quoted runtime output literals.

Natural-language comments and sample prompts are translated even inside fenced blocks. Proper names and stable Trellis domain tokens remain English where required for identity.

## Locale-Neutral Phase Index Extraction

### Problem

`workflow_phase.py`, three Python SessionStart implementations, and OpenCode session context currently search for exact `## Phase Index` and `## Phase 1: Plan` headings. Translating these headings would make the compact overview empty.

### Decision

Introduce equivalent `extract phase-index section` logic at each standalone parser boundary:

1. Prefer the existing exact English start anchor for backward compatibility.
2. Otherwise find the preserved `[workflow-state:no_task]` opening tag and scan backward to its enclosing level-2 heading.
3. From the start heading, scan forward to the next level-2 heading and use it as the exclusive end.
4. Return empty when neither anchor is available, preserving existing caller fallback behavior.

`get_step` remains unchanged because it already matches `#### <number>` independently of title language. Workflow-state and platform marker parsers remain unchanged.

### Why not bilingual hardcoding

Hardcoding `阶段索引` / `Phase 1：规划` would repeat the current locale coupling and require parser edits for every future language. The preserved workflow-state tag is already a documented stable machine identifier and uniquely locates the shipped Phase Index.

### Why not add new sentinels to English

The i18n architecture deliberately leaves upstream English sources untouched to reduce merge conflicts. Existing workflow-state tags provide a sufficient stable anchor.

## Structural Parity Model

Enhance `packages/cli/scripts/check-i18n-drift.js` with import-safe pure helpers for workflow structure extraction/comparison. Generic translation files continue to receive counterpart and Git-recency checks; the deep grammar applies only to `workflow.zh.md`.

The structure signature contains:

- ordered workflow-state opening/closing lines;
- ordered platform opening/closing lines;
- ordered Step ids and preserved qualifiers;
- heading-level outline with stable Phase/Step ids but no title text;
- ordered code-fence delimiters/languages and balance state;
- multisets of inline code spans, placeholders/XML-like tags, and protected lexical tokens;
- ordered link targets;
- HTML comment-block count.

Comparison returns category-specific diagnostics. CLI warning mode increments a structural count; `--strict` includes structural mismatches in its non-zero condition. Unit tests import the pure comparator, avoiding dependence on Git commit timestamps.

Translation completeness is checked separately with durable sentinels: no PR1-A placeholder, Chinese characters in every major/Step section, and Chinese content near late-file sections.

## Init / Update Data Flow

### Init

`--language zh` -> locale resolution -> `getWorkflowTemplate("zh")` -> Python command placeholder rendering -> write `.trellis/workflow.md` -> initialize hash from landed bytes.

### Update

config/env language resolution -> collect Chinese template under key `.trellis/workflow.md` -> hash classifier sees pristine English landed bytes matching stored English hash -> auto-update whole file -> refresh the same key with Chinese landed hash.

No `.zh.md` target path or hash key is introduced. User-modified workflow conflict behavior remains unchanged.

## File Boundaries

Expected product/test files:

- `packages/cli/src/templates/trellis/workflow.zh.md`
- `packages/cli/src/templates/trellis/scripts/common/workflow_phase.py`
- `packages/cli/src/templates/shared-hooks/session-start.py`
- `packages/cli/src/templates/codex/hooks/session-start.py`
- `packages/cli/src/templates/copilot/hooks/session-start.py`
- `packages/cli/src/templates/opencode/lib/session-utils.js`
- `packages/cli/scripts/check-i18n-drift.js`
- `packages/cli/test/scripts/check-i18n-drift.test.ts`
- `packages/cli/test/utils/i18n.test.ts`
- `packages/cli/test/commands/init.integration.test.ts`
- `packages/cli/test/commands/update.integration.test.ts`
- `packages/cli/test/regression.test.ts`
- `packages/cli/test/templates/opencode.test.ts`

Do not add files merely to satisfy this list; reuse existing test harnesses where they provide meaningful behavior coverage.

## Compatibility and Failure Behavior

- English source and default English landing are unchanged.
- Existing custom workflows with exact English headings continue to parse.
- Localized shipped workflows parse through the preserved no-task tag.
- Workflows without either anchor retain the existing empty/fallback behavior.
- The checker remains warning-only unless `--strict` is passed.
- Hash conflict handling remains the standard whole-file update flow.

## Rollout and Rollback

This is bundled-template content plus parser compatibility; no data migration is required. Rollback consists of reverting Chinese content/parser/checker/test changes. Existing English projects remain unaffected throughout. A Chinese landed workflow can be returned to English by selecting `en` and running update through normal hash rules.

## Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Translation omits a new workflow section | Canonical rebuild from current English + structural parity + late-file Chinese sentinels. |
| Marker/token translation breaks runtime | Exact protected-token comparison and runtime integration tests. |
| Phase Index disappears after heading translation | Locale-neutral no-task-tag boundary extraction in all parser families. |
| Checker becomes noisy for unrelated translations | Deep structural grammar limited to workflow pair. |
| Locale switch is mistaken for user edit | Integration test starts from a pristine stored English hash and verifies auto-update/hash refresh. |
| Test environment leaks `TRELLIS_LANGUAGE` | Prefer config-driven update fixture; explicitly restore env in any flag-driven case. |
```

---

## Proposed `implement.md`

```markdown
# Implementation Plan: complete Chinese workflow

## Pre-Flight

- [ ] Confirm `task.py current --source` points to `.trellis/tasks/07-27-i18n-workflow-pr1b`; do not start it.
- [ ] Snapshot `git status --short` and do not include unrelated dirty files.
- [ ] Read `prd.md`, `design.md`, this plan, both JSONL manifests, and referenced research/specs.
- [ ] Before editing each function/method/class, run GitNexus upstream impact analysis and record direct callers/process risk. Warn before any HIGH/CRITICAL edit.
- [ ] Confirm `packages/cli/src/templates/trellis/workflow.md` is the current canonical source and remains outside the edit set.

## 1. Add Executable Structural Contract

- [ ] Refactor `check-i18n-drift.js` into import-safe pure structure helpers plus guarded CLI entry.
- [ ] Add workflow-only structure extraction for workflow-state tags, platform markers, Steps/qualifiers, heading outline, fences, inline code, placeholders, link targets, protected tokens, and comment count.
- [ ] Add category-specific mismatch reporting, a structural summary count, and `--strict` failure integration while preserving existing missing/recency behavior.
- [ ] Add focused positive/negative comparator tests with one mutation per category.
- [ ] Review gate: tests must fail against the stale PR1-A Chinese source for meaningful structural reasons before translation is replaced.

## 2. Rebuild and Translate `workflow.zh.md`

- [ ] Replace the file from the current English source rather than patching the obsolete body.
- [ ] Translate every natural-language heading, paragraph, table cell, prompt example, shell comment, and HTML/Markdown comment.
- [ ] Preserve protected commands, paths, identifiers, statuses, Phase/Step numbers, qualifiers, workflow-state tags, platform markers, placeholders, fences, and links exactly.
- [ ] Remove the PR1-A placeholder note.
- [ ] Run parity/completeness tests and manually review every top-level section and workflow-state body against English.
- [ ] Review gate: no major section or numbered Step may remain as an English prose block.

## 3. Make Compact Phase Parsing Locale-Neutral

- [ ] Update `workflow_phase.py:get_phase_index` to support exact-English anchor plus no-task-tag enclosing-H2 fallback; use next H2 as end boundary.
- [ ] Apply equivalent extraction behavior to shared, Codex, and Copilot Python SessionStart templates.
- [ ] Apply equivalent behavior to OpenCode `buildSessionContext`.
- [ ] Leave `get_step`, workflow-state regexes, platform matching, Codex mode routing, and fallback dictionaries untouched.
- [ ] Add Chinese Phase Index/Step/SessionStart cases plus malformed-anchor compatibility cases.
- [ ] Review gate: existing English runtime tests and new Chinese cases both pass; no duplicated breadcrumb block appears in SessionStart output.

## 4. Strengthen Locale and Init Integration

- [ ] Update `getWorkflowTemplate("zh")` tests to assert full-source completeness, late-file Chinese content, and structural parity.
- [ ] Strengthen Chinese init integration from prefix-only to exact landed-content equality after Python placeholder rendering.
- [ ] Assert no locale-suffixed landed file/hash key and exact Chinese hash under `.trellis/workflow.md`.
- [ ] Execute generated `get_context.py` against the initialized Chinese project to verify compact Phase Index, Step extraction, and platform filtering.
- [ ] Preserve exact default-English assertions.

## 5. Add Update Language-Switch Integration

- [ ] Initialize an English project with a valid stored English workflow hash.
- [ ] Activate top-level `language: zh` in config while preserving the config as user-owned test state.
- [ ] Run same-version update through a non-interactive path that still applies auto-updates.
- [ ] Assert exact Chinese landed bytes, locale-agnostic hash key/value, no `.zh.md` output, and preserved config.
- [ ] Rerun update and assert workflow/hash idempotency.
- [ ] Restore any `TRELLIS_LANGUAGE` mutation in test teardown.

## 6. Validation

From `packages/cli/`:

- [ ] `pnpm vitest run test/scripts/check-i18n-drift.test.ts`
- [ ] `pnpm vitest run test/utils/i18n.test.ts`
- [ ] `pnpm vitest run test/commands/init.integration.test.ts`
- [ ] `pnpm vitest run test/commands/update.integration.test.ts`
- [ ] `pnpm vitest run test/regression.test.ts`
- [ ] `pnpm vitest run test/templates/opencode.test.ts`
- [ ] `pnpm run i18n:check`
- [ ] `pnpm lint`
- [ ] `pnpm typecheck`
- [ ] `pnpm test`

## 7. Final Review

- [ ] Compare English/Chinese structural signatures and inspect diagnostics output.
- [ ] Confirm English source has no diff.
- [ ] Confirm changes are limited to PR1-B translation, parser compatibility, drift checking, and tests.
- [ ] Run `gitnexus_detect_changes({scope: "all"})` before any commit and verify affected symbols/flows match the plan.
- [ ] Do not start/archive/commit from the planning phase; return artifacts for user review first.

## Rollback Points

- After Step 1: revert checker/tests if the signature is too strict before translating.
- After Step 2: restore only `workflow.zh.md` if translation review fails; English remains unaffected.
- After Step 3: revert parser compatibility as one unit across all Python/JS copies to avoid cross-platform skew.
- After Steps 4/5: revert test-only changes independently if they expose an unrelated pre-existing defect; document rather than masking it.
```

---

## Proposed `implement.jsonl`

```jsonl
{"file":".trellis/spec/cli/backend/index.md","reason":"Backend pre-development checklist and required workflow/parser/update guidance."}
{"file":".trellis/spec/cli/backend/workflow-state-contract.md","reason":"Machine marker syntax, parser/stripper parity, whole-file workflow update, and breadcrumb invariants."}
{"file":".trellis/spec/cli/backend/commands-update.md","reason":"Locale-selected whole-file workflow update, hash ownership, idempotency, and update integration conventions."}
{"file":".trellis/spec/cli/backend/script-conventions.md","reason":"Distributed Python 3.9 compatibility and workflow_phase.py conventions."}
{"file":".trellis/spec/cli/unit-test/index.md","reason":"Test quality gate and required validation commands."}
{"file":".trellis/spec/cli/unit-test/conventions.md","reason":"Exact assertions, non-tautological fixtures, and environment isolation requirements."}
{"file":".trellis/spec/cli/unit-test/integration-patterns.md","reason":"Real temp-directory init/update integration test pattern."}
{"file":".trellis/tasks/05-20-trellis-i18n-chinese-support/research/sync-call-chain.md","reason":"Existing locale source-selection and init/update call-chain research."}
{"file":".trellis/tasks/05-20-trellis-i18n-chinese-support/research/template-hashes.md","reason":"Locale-agnostic landed path/hash contract for workflow language switching."}
{"file":".trellis/tasks/07-27-i18n-bundled-python-pr3/research/workflow-runtime-parser-audit.md","reason":"Audit of every English-heading-dependent runtime parser and recommended locale-neutral boundary."}
{"file":".trellis/tasks/07-27-i18n-bundled-python-pr3/research/workflow-structure-and-drift-plan.md","reason":"Protected-token taxonomy and structural comparator design."}
{"file":".trellis/tasks/07-27-i18n-bundled-python-pr3/research/workflow-init-update-test-plan.md","reason":"Complete locale landing, hash, runtime, and idempotency test matrix."}
```

## Proposed `check.jsonl`

```jsonl
{"file":".trellis/spec/cli/backend/workflow-state-contract.md","reason":"Verify workflow-state tags, parser compatibility, update semantics, and breadcrumb gates remain intact."}
{"file":".trellis/spec/cli/backend/commands-update.md","reason":"Verify whole-file workflow update, user-edit protection, locale hash refresh, and idempotency."}
{"file":".trellis/spec/cli/backend/script-conventions.md","reason":"Verify distributed Python parser changes remain cross-platform and Python 3.9 compatible."}
{"file":".trellis/spec/cli/backend/quality-guidelines.md","reason":"General backend quality and routing-entry-path review."}
{"file":".trellis/spec/cli/unit-test/conventions.md","reason":"Check tests use exact, isolated, meaningful assertions without duplicated/tautological coverage."}
{"file":".trellis/spec/cli/unit-test/integration-patterns.md","reason":"Check init/update tests exercise real filesystem and hash behavior."}
{"file":".trellis/tasks/07-27-i18n-bundled-python-pr3/research/workflow-runtime-parser-audit.md","reason":"Cross-check that all identified parser families were covered."}
{"file":".trellis/tasks/07-27-i18n-bundled-python-pr3/research/workflow-structure-and-drift-plan.md","reason":"Validate structural parity categories and protected-token preservation."}
{"file":".trellis/tasks/07-27-i18n-bundled-python-pr3/research/workflow-init-update-test-plan.md","reason":"Validate the full init/update/runtime regression matrix."}
```

## Handoff notes

- If the caller wants each task self-contained, copy the three PR1-B research files into `.trellis/tasks/07-27-i18n-workflow-pr1b/research/` after the active task is deliberately switched, then update JSONL paths. The Research Agent could not do that under its current scope.
- The plan intentionally excludes README/docs-site work because the delegated PR1-B scope names translation, structural parity, and init/update integration only.
- Do not run `task.py start` until these artifacts are reviewed and the target task is actually current.
