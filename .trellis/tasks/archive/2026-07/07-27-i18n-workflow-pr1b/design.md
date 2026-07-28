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
