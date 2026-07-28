# Research: PR1-B structural parity and drift detection

- **Query**: Define an executable structural-equivalence contract for English and Chinese workflow templates and assess the existing drift checker.
- **Scope**: internal
- **Date**: 2026-07-27

## Existing drift checker

`packages/cli/scripts/check-i18n-drift.js` currently:

- recursively scans `packages/cli/src/templates/` for `*.zh.(md|py|yaml|yml|txt)` (`:31-46`);
- verifies that the unsuffixed English counterpart exists (`:48-51`, `:80-85`);
- compares the last committed Git timestamps of English and Chinese files (`:53-63`, `:87-97`);
- warns by default and exits non-zero under `--strict` (`:114-116`);
- silently skips recency comparison when either side is untracked.

It does **not** inspect current worktree content and cannot detect deleted workflow-state tags, changed platform markers, missing Steps, altered placeholders, or malformed code fences. PR1-B needs content-based structural validation in addition to recency warnings.

## Recommended scope

Add workflow-specific structure comparison for `workflow.zh.md` only. Do not impose a workflow grammar on future PR2/PR3 Markdown translations. Keep generic counterpart/recency behavior for all translation files.

Refactor the script into import-safe pure helpers plus the existing CLI entry:

- `extractWorkflowStructure(content)`
- `compareWorkflowStructure(enContent, zhContent)`
- `main()` guarded so importing the module in Vitest does not execute the CLI

The CLI should report a separate `structural` count. Default mode warns; `--strict` fails when missing counterparts, recency drift, or structural mismatches exist.

## Structural contract

Compare semantic machine structures, not translated prose or raw line counts.

| Category | Required equality |
|---|---|
| Workflow-state tags | Exact ordered opening/closing marker lines, including `no_task`, `planning`, `planning-inline`, `in_progress`, `in_progress-inline`, `completed`, and the documented `my-status` example. |
| Platform markers | Exact ordered opening/closing marker lines accepted by `workflow_phase.py`; exclude workflow-state tags. |
| Step headings | Same ordered numeric ids (`1.0`…`3.5`) and same preserved bracket qualifiers such as `[required · once]`, `[optional · repeatable]`, `[on demand]`. Titles may differ. |
| Phase references | Same ordered `Phase <number>` / `Step <number>` identifiers wherever they are machine-significant; labels may differ. |
| Markdown outline | Same ordered heading levels and same number of headings. Compare stable ids where present, not translated title text. |
| Code fences | Same ordered fence delimiter/language sequence and balanced opening/closing fences. Fence prose may be translated. |
| Inline code | Exact multiset of backtick-delimited technical spans. These hold most commands, paths, statuses, flags, file names, and identifiers. |
| Placeholders / XML-like tags | Exact multiset of `<...>` tokens, including `<your-name>`, `<task-dir>`, `<workflow-state>`, and dispatch placeholders. |
| Link targets | Exact ordered Markdown link destinations; labels may differ. |
| Protected lexical tokens | Exact multiset for flags, environment variables, command names, paths, status values, and slash commands found outside inline-code spans. |
| HTML comments | Same comment-block count; comment bodies are expected to be translated and therefore are not compared. |

Avoid raw line-count, paragraph-count, or table-cell-text equality: valid Chinese wrapping and phrasing can differ while preserving runtime behavior.

## Translation completeness checks

Structural parity cannot prove every sentence was translated. Add narrow, durable checks and rely on human review for semantics:

1. `workflow.zh.md` must not contain the PR1-A placeholder comment (`i18n PR1 placeholder note` / `full Chinese translation lands...`).
2. Every top-level workflow section, workflow-state body, and numbered Step section must contain Chinese characters.
3. Check several late-file sentinels (Phase 2, Phase 3.4, customization section) so a translated prefix plus English tail cannot pass.
4. Do not use a broad “no English words” assertion: proper names and technical identifiers are intentionally English.

## Protected-content policy

Translate all human/LLM-facing prose, including:

- Markdown headings and paragraphs;
- table headings and explanatory cells;
- HTML/Markdown comments;
- shell comments inside fenced blocks;
- prompt examples and user-facing sample text inside fenced blocks.

Preserve exactly:

- proper names (`Trellis`, platform names);
- command names, flags, paths, file names, environment variables, JSON/YAML keys, code identifiers;
- status values (`planning`, `in_progress`, `completed`, `no_task`);
- Phase/Step numbers and bracket qualifiers;
- workflow-state tags, platform markers, placeholders, slash commands;
- exact quoted runtime fallback literals when the prose documents an emitted string.

For domain terms used as technical identifiers (`Spec`, `Task`, `Workspace`, `Context`, agent/skill names), prefer stable English tokens with translated surrounding prose rather than inventing multiple Chinese aliases.

## Tests

Suggested placement:

- Pure extractor/comparator tests: `packages/cli/test/scripts/check-i18n-drift.test.ts`.
- Real-template parity and translation-completeness assertions: same file or `packages/cli/test/utils/i18n.test.ts`.
- Keep English semantic workflow tests in `packages/cli/test/templates/trellis.test.ts` unchanged.

Minimum negative fixtures should independently remove/change:

1. one workflow-state closing tag;
2. one platform marker;
3. one Step id or qualifier;
4. one placeholder;
5. one code fence;
6. one inline technical token.

Each mutation must produce a category-specific diagnostic, proving the checker is not a tautological “files differ” test.

## Caveats

- Git commit timestamps have one-second resolution and ignore uncommitted content. Structural checks must read file bytes directly.
- Current `--strict` recency behavior can still report stale translation until the Chinese update is committed; unit tests should call pure structure helpers rather than running the fixed-path CLI against Git history.
- Inline-code equality is intentionally strict. If a future translation genuinely needs to translate an inline prose fragment, it should first be reclassified outside code formatting or explicitly whitelisted with review.
