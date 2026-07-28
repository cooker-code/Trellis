# Implementation plan: i18n PR2 common templates and agents

## Current status

The child task is `in_progress`. The delegated prompt is the authoritative active-task source for this sub-agent; the shell session pointer remains on the parent i18n task and must not be rewritten from this child implementation session.

## 0. Preconditions and safety

- [x] Resolve the PR2 child task from the dispatch prompt and load its artifacts.
- [x] Confirm PR1-B's shared checker/test foundation is present.
- [x] Snapshot the dirty working tree and preserve concurrent PR1-B/PR3, docs-site, marketplace, and parent-task work.
- [x] Read task artifacts, manifests, curated specs, and all PR2 research files.
- [x] Confirm the child task is already `in_progress`.
- [x] Run GitNexus upstream impact analysis before changing indexed symbols; the edited test helpers are new/untracked and therefore returned no indexed dependants, with no HIGH/CRITICAL result.

Rollback point: all PR2 content is additive sidecars/tests/task artifacts; do not revert or overwrite unrelated dirty paths.

## 1. Selector and structure tests

- [x] Cover `.md`, `.toml`, `.json`, `.md.txt`, fallback, orphan handling, deterministic order, and unsuffixed logical paths.
- [x] Cover locale cache sequence `en -> zh -> en`.
- [x] Discover common and physical-agent inventories dynamically from canonical English sources.
- [x] Validate placeholders, frontmatter, JSON, TOML, fences, and technical tokens without comparing translated prose byte-for-byte.
- [x] Preserve English generated-byte compatibility assertions.

Review gate: naive `*.zh.*` source leakage or a missing sidecar must fail tests.

## 2. Reusable locale selector

- [x] Add `selectLocalizedTemplateFiles()` with an explicit semantic suffix.
- [x] Keep English sources canonical, overlay `zh`, ignore orphans, and sort deterministically.
- [x] Extend `createTemplateReader()` with locale-aware Markdown, JSON, and TOML readers.
- [x] Keep selection pure, typed, and free of process-global locale state.

Rollback point: removing a locale sibling must fall back to English at the same logical path.

## 3. Locale propagation through platform boundaries

- [x] Extend `PlatformFunctions.configure` and `collectTemplates` with `SupportedLanguage`.
- [x] Extend `configurePlatform` and `collectPlatformTemplates` with explicit locale and English defaults.
- [x] Pass init's resolved locale through both full init and `handleReinit` add-platform paths.
- [x] Pass update's resolved locale into each configured-platform collector.
- [x] Preserve English defaults for key-only/compatibility callers because locale path sets are invariant.
- [x] Update all platform configurator signatures and call sites.

Review gate: init and collect paths receive the same locale for every platform.

## 4. Common aggregation and generated prose

- [x] Make command and single-file skill getters locale-aware with locale-keyed caches.
- [x] Add English/Chinese description metadata with per-key English fallback.
- [x] Carry selected descriptions through skill and Qoder command frontmatter.
- [x] Extract the pull-based prelude into English/Chinese templates.
- [x] Thread locale through Markdown/TOML prelude build/inject/apply helpers.
- [x] Update all command/skill resolver variants, including Codex `trellis-start`.
- [x] Preserve capability filtering and neutral shared Agent Skills rendering.

Review gate: English output remains compatible; Chinese descriptions and preludes contain Chinese prose plus stable protocol tokens.

## 5. Locale-aware agent loaders and configurators

- [x] Claude Code uses selected agent getters in init and update; sidecars do not land.
- [x] Cursor, Gemini, Qoder, CodeBuddy, Droid, and Pi pass locale to shared Markdown readers.
- [x] Kiro selects JSON siblings before placeholder resolution.
- [x] Codex selects TOML siblings before prelude insertion.
- [x] OpenCode overlays selected agents in its shared recursive collector and skips sidecars.
- [x] Copilot derives the selected Cursor locale before tool normalization and prelude insertion.
- [x] Preserve class-1/class-2/class-3 semantics and transform ordering.

Review gate: `en` and `zh` maps have identical keys and no destination contains `.zh.`.

## 6. Common Chinese sources

- [x] Translate every common command sidecar.
- [x] Translate every common single-file skill sidecar.
- [x] Translate description metadata and pull-based prelude.
- [x] Translate remaining human-facing report/example headings and labels in `break-loop.zh.md`, `brainstorm.zh.md`, and `update-spec.zh.md`.
- [x] Preserve commands, paths, placeholders, statuses, code identifiers, links, fences, and proper names.

Review gate: every canonical English common source has one Chinese sibling and major sections do not contain a large English-only tail.

## 7. Agent Chinese sources

- [x] Translate Claude Code, Cursor, OpenCode, Gemini, Qoder, CodeBuddy, Droid, and Pi Markdown sidecars.
- [x] Translate Codex TOML sidecars while preserving keys, quoting, sandbox, feature flags, and recursion guards.
- [x] Translate Kiro JSON sidecars while preserving schema, tools, hooks, and placeholders.
- [x] Keep Copilot source-less and verify derived Chinese output from Cursor.
- [x] Translate all remaining report-format headings/examples across the physical agent source inventory.
- [x] Preserve context-loading, research persistence, write boundaries, and forbidden git operations.

Review gate: the dynamically discovered physical English inventory is fully paired and all generated agent-capable platforms are covered.

## 8. Drift validation

- [x] Extend the existing checker architecture rather than replacing PR1-B workflow validation.
- [x] Discover `.zh.md`, `.zh.toml`, and `.zh.json` source pairs.
- [x] Cover missing-pair/orphan/stale behavior and strict/non-strict modes.
- [x] Preserve warning-only default and strict non-zero behavior.
- [x] Leave PR3's compound spec/Python ownership intact.

## 9. Init/update/hash integration

- [x] Cover every platform's configure-vs-collect byte parity for both locales.
- [x] Assert `en`/`zh` path-set equality and no suffix leakage.
- [x] Cover Chinese first init across Markdown, TOML, JSON, shared Agent Skills, Copilot, Pi, and an agent-less platform.
- [x] Cover existing-project add-platform Chinese fast path.
- [x] Cover same-locale Chinese update no-op.
- [x] Cover pristine English -> Chinese -> English byte/hash switching and idempotency.
- [x] Cover user-modification conflict protection.
- [x] Restore `TRELLIS_LANGUAGE` from suite hooks instead of deleting or leaking it ad hoc.

Review gate: landed hash keys are unsuffixed and hash the actual landed bytes.

## 10. Build/package smoke

- [x] Build CLI and verify representative Markdown/TOML/JSON Chinese sidecars under `dist/templates`.
- [x] Inspect `npm pack --dry-run --json` for representative sidecars.
- [x] Run the built CLI with `init --language zh` in a fresh temporary Git repository.
- [x] Verify Chinese unsuffixed generated files, tracked hash keys, and built-binary update no-op.

## 11. Full validation and final review

Run from repository root:

```bash
pnpm --filter @mindfoldhq/trellis lint
pnpm --filter @mindfoldhq/trellis typecheck
pnpm --filter @mindfoldhq/trellis test
pnpm --filter @mindfoldhq/trellis i18n:check
pnpm --filter @mindfoldhq/trellis build
```

- [x] Focused PR2 tests pass (96 tests).
- [x] Full CLI tests pass (53 files, 1331 tests).
- [x] CLI lint passes.
- [x] CLI typecheck passes.
- [x] i18n drift check has no PR2 structural/missing issue; one pre-existing PR1 workflow drift warning remains warning-only.
- [x] Audit English canonical source files for unintended edits.
- [x] Audit generated paths/hash keys for `.zh.` leakage.
- [x] Confirm no PR1/PR3 production source was modified by this blocker-fix pass.
- [x] Run `gitnexus detect-changes --scope all --repo Trellis`; it reports CRITICAL for the combined dirty worktree (83 files, 379 symbols, 120 flows), dominated by concurrent parent/PR1/PR3/docs/submodule changes rather than this text/test blocker-fix alone.
- [x] Re-run root git status and separate unrelated dirty files in the final report.

## 12. Handoff

- [x] Report changed PR2 files and exact verification results to the main session.
- [x] Do not run `git commit`, `git push`, or `git merge`.
- [x] Leave task archival, commit creation, and parent-task closure to the main session.

## Verification record

- Focused PR2 tests: 5 files / 96 tests passed.
- Init integration: 38 tests passed.
- Full CLI suite: 53 files / 1331 tests passed.
- Lint: passed.
- Typecheck: passed.
- Build: passed.
- `npm pack --dry-run --json`: representative common/Markdown/TOML/JSON sidecars present (767 files total).
- Built CLI smoke: Chinese init/update no-op passed with unsuffixed outputs and hash keys.
- i18n checker: 85 translations checked; 0 missing, 0 structural issues, 0 Python issues, and one warning-only PR1 workflow staleness notice.

## Closure verification

- Integrated implementation commit: `bf5a6718 feat(i18n): 完成中文本地化内容链路`.
- CLI build, lint, TypeScript typecheck, and Python type/lint check completed successfully.
- Current i18n check covered 85 translations with 0 missing, 0 drift, 0 structural issues, and 0 Python issues.
- Current full CLI suite passed: 81 test files, 1788 tests.
