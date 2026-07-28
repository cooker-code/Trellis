# Research: PR1-B init/update and runtime integration tests

- **Query**: Identify complete integration coverage for a full Chinese `workflow.md` without regressing English or hash ownership.
- **Scope**: internal
- **Date**: 2026-07-27

## Existing integration behavior

### Init

- Locale selection is already wired through `getWorkflowTemplate(locale)` in `packages/cli/src/templates/trellis/index.ts:92-114`.
- `createWorkflowStructure` writes the selected source to the fixed landed path `.trellis/workflow.md` (`packages/cli/src/configurators/workflow.ts:95-118`).
- `packages/cli/test/commands/init.integration.test.ts:126-151` currently verifies only that English starts with `# Development Workflow` and `--language zh` starts with `# 开发工作流`.
- Init hash tracking records the landed path/content after writes, so the test should assert the Chinese content hash under `.trellis/workflow.md`, never `.trellis/workflow.zh.md`.

### Update

- `collectTemplateFiles` resolves locale and inserts selected bytes under `.trellis/workflow.md` (`packages/cli/src/commands/update.ts:650-662`).
- Whole-file workflow replacement and hash refresh are already covered for English by `packages/cli/test/commands/update.integration.test.ts:1027-1068`.
- No current update integration test switches an initialized English project to the Chinese template.
- Same-version update still analyzes template bytes, so an English landed file with a matching stored English hash should be classified as an auto-update when the selected template changes to Chinese.

### Runtime

- `get_context.py --mode phase` delegates to `common/workflow_phase.py`.
- Existing runtime tests in `packages/cli/test/regression.test.ts:3364-3574` use only the English workflow.
- Breadcrumb bodies are parser-safe because workflow-state tags are locale-neutral, but compact Phase Index extraction currently requires English headings (see `workflow-runtime-parser-audit.md`).

## Required test matrix

### A. Template source and parity (unit)

1. `getWorkflowTemplate("zh")` returns the complete Chinese source.
2. The PR1-A placeholder comment is absent.
3. Late-file Chinese sentinels exist (Phase 2, Phase 3.4, customization section).
4. English and Chinese structures pass the parity comparator.
5. Unsupported locale still falls back to exact English bytes.

### B. Init integration

Strengthen the existing `#1c` case or split it into explicit cases:

| Scenario | Call | Assertions |
|---|---|---|
| Default English | `init({ yes: true })` | Landed workflow equals `replacePythonCommandLiterals(getWorkflowTemplate("en"))`; English hash is stored. |
| Chinese override | `init({ yes: true, language: "zh" })` | Landed workflow equals the fully translated source after Python placeholder replacement; no `.zh.md` lands; hash key is `.trellis/workflow.md` and value equals landed Chinese bytes. |
| Chinese runtime | Run generated `get_context.py --mode phase` and `--mode phase --step 1.1 --platform pi` | Compact Phase Index and Step body are Chinese; Step lookup and platform filtering still work. |

Use exact source equality rather than `startsWith`, so a translated prefix plus stale English tail cannot pass.

### C. Update integration

Add a named case near `#workflow-md-r4`:

1. Initialize a default English project.
2. Edit `.trellis/config.yaml` to activate top-level `language: zh` while preserving it as user-owned config (use `skipAll` or a targeted setup so update does not overwrite the config fixture).
3. Keep `.trellis/workflow.md` pristine relative to its stored English hash.
4. Run `update({ skipAll: true })` (or the exact non-interactive option that still allows auto-updates).
5. Assert:
   - `.trellis/workflow.md` equals selected Chinese bytes after placeholder rendering;
   - no `.trellis/workflow.zh.md` exists;
   - `.template-hashes.json` contains only the locale-agnostic landed key for workflow;
   - its hash equals Chinese landed bytes;
   - the user-modified language config is preserved.
6. Run update again and assert the workflow/hash are unchanged (idempotent locale landing).

A one-shot `update({ language: "zh" })` variant is useful but must restore `TRELLIS_LANGUAGE` in `afterEach`; `update()` currently realizes the flag through process environment and tests must not leak it into later cases.

### D. Parser integration

If Phase headings are translated, add direct Chinese cases for every changed parser family:

| Parser family | Test behavior |
|---|---|
| Bundled Python `workflow_phase.py` | Chinese Phase Index extracted; workflow-state blocks stripped; detailed Phase 1 excluded; `get_step("1.1")` returns Chinese body. |
| Shared Python SessionStart | `<trellis-workflow>` contains Chinese compact index, excludes detailed Step bodies and complete workflow-state blocks. |
| Codex/Copilot standalone SessionStart copies | At minimum exercise their Phase Index helper with Chinese source, or assert shared fixture behavior if a test harness already runs each copy. |
| OpenCode `session-utils.js` | Chinese compact index appears in generated SessionStart context. |
| Breadcrumb Python/JS parsers | Existing tests remain sufficient for syntax; add one assertion that a Chinese tag body is emitted verbatim. |

## Negative and compatibility assertions

- English default bytes remain unchanged.
- English parser cases remain green.
- Missing/malformed Phase Index anchor still returns the existing fallback/empty result.
- Platform marker filtering does not leak the alternate Codex block.
- Workflow-state opening and closing STATUS values remain matched.
- Update never creates a locale-suffixed landed path or hash key.
- User-modified workflow conflict behavior is unchanged; PR1-B should not bypass hash protection merely to switch language.

## Validation commands

From `packages/cli/`:

```bash
pnpm vitest run test/scripts/check-i18n-drift.test.ts
pnpm vitest run test/utils/i18n.test.ts
pnpm vitest run test/commands/init.integration.test.ts
pnpm vitest run test/commands/update.integration.test.ts
pnpm vitest run test/regression.test.ts
pnpm vitest run test/templates/opencode.test.ts
pnpm run i18n:check
pnpm lint
pnpm typecheck
pnpm test
```

Run the checker in normal warning mode during development. Use `node scripts/check-i18n-drift.js --strict` only after understanding the Git-recency result, because uncommitted translation bytes do not update `git log` timestamps.

## Related specs

- `.trellis/spec/cli/backend/workflow-state-contract.md` — parser/tag/update contract.
- `.trellis/spec/cli/backend/commands-update.md` — whole-file update, hashes, idempotency, integration test conventions.
- `.trellis/spec/cli/backend/script-conventions.md` — distributed Python compatibility.
- `.trellis/spec/cli/unit-test/conventions.md` — exact assertions, env isolation, non-tautological fixtures.
- `.trellis/spec/cli/unit-test/integration-patterns.md` — real temp-directory init/update pattern.
