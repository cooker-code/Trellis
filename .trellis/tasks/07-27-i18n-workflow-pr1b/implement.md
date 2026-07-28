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
