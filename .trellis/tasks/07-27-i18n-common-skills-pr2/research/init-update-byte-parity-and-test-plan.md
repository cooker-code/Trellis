# Research: PR2 init/update byte parity and test plan

- **Query**: Define complete validation for locale-aware common commands/single-file skills and all Trellis agent definitions.
- **Scope**: Internal tests, build packaging, init/update/hash behavior
- **Date**: 2026-07-27

## Core invariants

For a fixed host OS, locale, and platform:

```text
bytes written by configurePlatform during init
== bytes returned by collectPlatformTemplates during update
```

For each logical source file:

```text
en source path -> logical destination
zh source path -> same logical destination
missing zh     -> English bytes at same logical destination
```

Hash contract:

```text
.template-hashes.json key   = unsuffixed landed path
.template-hashes.json value = SHA256(normalized landed content)
```

No schema/migration change is required.

## Existing high-value tests

| Existing test | Contract | PR2 extension |
|---|---|---|
| `test/configurators/platforms.test.ts:225` | Every platform configure output equals collect map bytes | Run matrix for `en` and `zh`; seed temp config/pass locale explicitly |
| `test/commands/init.integration.test.ts:126` | English/Chinese workflow init | Add representative common command, skill, Markdown/TOML/JSON agents, Copilot-derived agent, and hashes |
| `test/commands/update.integration.test.ts:163` | Same-version update true no-op | Add same-locale Chinese no-op and English→Chinese→English managed-template switch |
| `test/regression.test.ts:4960` | Class-2 prelude behavior | Validate locale-selected prelude plus stable `Active task:`/JSONL tokens |
| `test/regression.test.ts:5414` | Codex/Gemini shared `.agents/skills` byte identity | Run for both locales |
| `test/regression.test.ts:5175` | Research agents persist findings | Apply assertions to both locales/selected outputs |
| `test/regression.test.ts:5574` | Class-1 fallback protocol and Kiro schema | Apply to both locales without hardcoding English prose except protocol tokens |
| `test/templates/cursor.test.ts:29` | Cursor one-line description | Check both English and Chinese source/selected output |

## Test layer 1: pure locale selector

Create focused unit tests near `template-utils.ts` using temp directories or pure filename arrays.

Required cases:

1. `en` selects canonical file.
2. `zh` selects sibling and returns canonical logical name.
3. Missing `zh` silently selects English.
4. Orphan `foo.zh.md` without `foo.md` is not returned.
5. `.md`, `.toml`, `.json`, and compound `.md.txt` naming are handled correctly (compound coverage establishes the PR3 reuse contract even if PR3 owns actual spec sources).
6. Ordering is deterministic.
7. No returned logical path contains `.zh.`.
8. Sequential `en -> zh -> en` calls do not contaminate each other.

The fixture must be independent of repository translations so fallback can be tested without deleting tracked sources.

## Test layer 2: source-pair and structural integrity

Derive inventories dynamically from English sources; do not hardcode counts.

### Common sources

- Every English file under `common/commands/*.md` and `common/skills/*.md` has `*.zh.md`.
- Placeholder multisets are identical.
- Technical inline-code/path/command/link targets remain present.
- Chinese source contains meaningful Chinese prose, not only a translated heading.
- Description metadata has matching English/Chinese top-level/key sets and per-key fallback tests.
- Pull-prelude English/Chinese files preserve role placeholder and protocol tokens.

### Agent sources

For every English file in the 10 physical agent source directories, require a matching `*.zh.<suffix>`.

Format-specific checks:

- Markdown: parse frontmatter text enough to compare stable `name`, tools, mode, permission keys/values; ensure fence sequence and protected tokens are preserved.
- Cursor: `description` is one line in both locales.
- Gemini: `tools:` absent in both locales.
- OpenCode: `mode: subagent` and permission map unchanged.
- Pi: name/tool frontmatter unchanged.
- JSON/Kiro: parse both; compare non-prose schema, key sets, tool arrays, allowedTools, hooks, placeholder sets.
- TOML/Codex: verify exact stable assignments, balanced `developer_instructions = """` block, and protected token set. Avoid a new runtime dependency solely for tests.

Translation completeness should use durable checks (Chinese characters in descriptions and each major section, no known placeholder sentence/large English tail) rather than rejecting every English token; proper names and technical identifiers intentionally remain English.

## Test layer 3: common resolver behavior

Parameterize `resolveCommands`, `resolveSkills`, `resolveSkillsNeutral`, `resolveAllAsSkills`, `resolveAllAsSkillsNeutral`, and `resolveCodexTrellisStartSkill` by locale.

Assert:

- English names/path sets exactly match Chinese names/path sets.
- Chinese bodies and generated descriptions are Chinese.
- English resolver output remains exactly equal to current English source/transformation bytes.
- Placeholder resolution remains platform-correct.
- Neutral output is byte-identical between Codex and Gemini for overlapping shared skill paths under both locales.
- Agent-capable filtering still omits `start`; agent-less platforms still include it; Codex special `trellis-start` remains present.
- No unresolved locale/source placeholder leaks.

## Test layer 4: every platform configure/collect parity

Extend the existing all-platform loop to both locales:

```text
for language in en, zh:
  for platform in PLATFORM_IDS:
    configurePlatform(platform, temp, language)
    templates = collectPlatformTemplates(platform, language)
    assert every map file exists and is byte-identical
    assert no written/map/hash path contains .zh.
```

Also compare path sets:

```text
keys(collectPlatformTemplates(platform, en))
== keys(collectPlatformTemplates(platform, zh))
```

This catches:

- Claude recursive-copy sidecar leaks;
- OpenCode recursive-walk sidecar leaks;
- `.zh` agent names from generic readers;
- missed locale argument in an individual configurator;
- missed locale argument in the update collector;
- prelude/wrapper mismatch;
- Copilot Cursor-source omission;
- agent-less platform omission.

## Test layer 5: init integration

Use a focused multi-platform Chinese init that covers every source/format mechanism without requiring one test per platform:

- Claude: recursive Markdown source path.
- OpenCode: recursive walker.
- Codex: TOML + pull prelude + shared Agent Skills.
- Kiro: JSON.
- Gemini: neutral shared `.agents/skills` writer.
- Copilot: Cursor-derived + tools normalization + pull prelude.
- Pi: dedicated collector/extension path.
- One agent-less platform (Windsurf or Antigravity): common `start` command plus skills.

Assertions:

1. Representative command/skill/agent files contain Chinese prose.
2. Stable IDs, placeholders after resolution, tools/schema, and target names remain correct.
3. No generated path contains `.zh.`.
4. `.template-hashes.json` contains only unsuffixed paths and hashes equal actual landed Chinese bytes.
5. English default init still produces exact English bytes.
6. `--language zh` works on first init.
7. Existing-project add-platform fast path with `--language zh` or `config.yaml: language: zh` writes Chinese files; this specifically exercises `handleReinit` rather than only full init.

## Test layer 6: update integration

### Chinese same-locale no-op

1. Init representative platforms with `zh`.
2. Snapshot all files.
3. Run same-version update with `zh` resolved from config/env/flag as appropriate.
4. Assert zero added/removed/changed files and no backup.

This is distinct from the existing English no-op and catches unresolved collector locale.

### Pristine English -> Chinese switch

1. Init English with representative platforms.
2. Ensure current file hashes match English bytes.
3. Set project `language: zh` or run `update({ language: "zh", force: true })` with a clean managed state.
4. Assert representative common commands, skills, and agent formats switch to exact selected Chinese rendered bytes.
5. Assert hash values refresh under unchanged unsuffixed keys.
6. Run update again and assert idempotency.

### Chinese -> English switch

Reverse the scenario and assert exact original English rendered bytes return. This proves English byte compatibility rather than merely “contains English.”

### User edit protection

For one translated managed file:

1. Start from a tracked English or Chinese install.
2. Modify the landed file without updating its hash.
3. Switch locale and run non-force conflict policy.
4. Assert user content is preserved/skipped or `.new` behavior follows existing options.

Locale selection must not bypass normal user-edit protection.

## Test layer 7: drift checker

PR2 adds `.zh.toml` and `.zh.json`, so `check-i18n-drift.js` must discover them. It should continue warning by default and failing under `--strict`.

Cases:

- Markdown/TOML/JSON translation with English counterpart.
- Orphan translation.
- Stale English/Chinese pair.
- Missing Chinese counterpart in PR2-covered canonical directories (if completeness enforcement is added).
- Clean source tree.

Coordinate with PR1-B, which owns deep workflow structural drift validation, and PR3, which owns compound `.zh.md.txt` plus Python dictionary checks. PR2 should rebase on PR1-B's checker structure rather than replacing it.

## Test layer 8: dist/npm artifact smoke

Source-level Vitest tests do not prove translation sidecars are published. After `pnpm build`:

1. Assert representative `dist/templates/common/...zh.md`, `dist/templates/codex/agents/...zh.toml`, and `dist/templates/kiro/agents/...zh.json` exist.
2. Run `npm pack --dry-run --json` and confirm those `dist/**` source files are in the tarball.
3. Use the built CLI in a fresh temp Git repository with `init --language zh` and representative platform flags.
4. Assert generated files are Chinese under unsuffixed paths.
5. Assert built-binary `update --dry-run` reports no unexpected changes.

## Environment isolation

`test/setup.ts` deletes host `TRELLIS_LANGUAGE`, but individual tests that set it must restore/delete it in `afterEach` or `finally`. Do not rely on suite order. Prefer explicit language arguments in low-level tests; use env/config only in dedicated precedence/integration cases.

The resolved Python command is separate shared state. Existing tests must continue resetting it where platform rendering is exercised under mocked hosts.

## Validation commands

From repository root:

```bash
pnpm --filter @mindfoldhq/trellis lint
pnpm --filter @mindfoldhq/trellis typecheck
pnpm --filter @mindfoldhq/trellis test
pnpm --filter @mindfoldhq/trellis i18n:check
pnpm --filter @mindfoldhq/trellis build
```

Focused during implementation:

```bash
pnpm --filter @mindfoldhq/trellis vitest run test/templates/template-utils.test.ts
pnpm --filter @mindfoldhq/trellis vitest run test/configurators/shared.test.ts
pnpm --filter @mindfoldhq/trellis vitest run test/configurators/platforms.test.ts
pnpm --filter @mindfoldhq/trellis vitest run test/commands/init.integration.test.ts
pnpm --filter @mindfoldhq/trellis vitest run test/commands/update.integration.test.ts
pnpm --filter @mindfoldhq/trellis vitest run test/regression.test.ts
```

Use the package's actual pnpm syntax at implementation time if the workspace wrapper does not forward `vitest` directly.

## Acceptance-level test matrix

| # | Scenario | Expected |
|---:|---|---|
| 1 | Common selector en/zh | Same logical set; selected bytes differ |
| 2 | Missing translation | English fallback, no extra path |
| 3 | Cache sequence | en -> zh -> en correct |
| 4 | Agent source pairing | Every physical English source has zh sibling |
| 5 | Agent format structure | Markdown/TOML/JSON stable fields preserved |
| 6 | Every platform map | en/zh path parity, no `.zh.` |
| 7 | Init/collect parity | Exact bytes for every platform and locale |
| 8 | Shared Agent Skills | Codex/Gemini overlap byte-identical in zh |
| 9 | Chinese first init | Common + all format families land Chinese |
| 10 | Chinese add-platform reinit | Fast path honors locale |
| 11 | English->Chinese update | Managed bytes/hash switch at same keys |
| 12 | Chinese->English update | Exact English bytes restored |
| 13 | Same-locale update | True no-op |
| 14 | User-modified file | Existing conflict policy preserved |
| 15 | Dist/package smoke | Sidecars published, not landed |

## Caveats

- Do not assert a fixed number of source files or platforms in new tests; derive from canonical English trees/`PLATFORM_IDS`.
- Do not compare translated prose bytes to English; compare protected structure and behavior.
- Do not weaken existing format-specific tests just because their English wording changes. Move assertions to stable protocol tokens where appropriate.
