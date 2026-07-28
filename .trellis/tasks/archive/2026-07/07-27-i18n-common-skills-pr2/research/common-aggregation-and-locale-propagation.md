# Research: common aggregation and locale propagation for PR2

- **Query**: Inspect common commands/single-file skills aggregation, `template-utils`, locale propagation, generated prose, fallback, and cache behavior for i18n PR2.
- **Scope**: Internal code, specs, and tests
- **Date**: 2026-07-27

## Executive findings

1. PR1-A resolves locale correctly at the command boundary, but only `workflow.md` consumes it. Platform templates still render from English-only common/agent getters.
2. `templates/common/index.ts` currently treats every `*.md` as a logical command/skill. Adding `foo.zh.md` without changing it would emit an extra logical item named `foo.zh`.
3. `templates/template-utils.ts:listMdAgents()` and `listJsonAgents()` have the same failure mode. A `trellis-check.zh.md` or `.zh.json` sibling would become an extra agent named `trellis-check.zh`.
4. Common command/skill bodies are not the only prose surface. Generated skill/command frontmatter descriptions and the pull-based agent prelude are hardcoded English in `configurators/shared.ts`; they must become locale-aware source templates too or Chinese output will remain mixed-language.
5. Locale must be threaded explicitly through both init writers and update collectors. A new process-global locale cache in `shared.ts` would violate the existing shared-helper spec and make tests/concurrent calls fragile.
6. Every cache that stores selected content must be keyed by locale. Current `cachedCommands` and `cachedSkills` are singletons.

## Current data flow

### Locale resolution already exists

`packages/cli/src/utils/i18n.ts` owns the current contract:

```text
--language flag -> TRELLIS_LANGUAGE -> .trellis/config.yaml language -> en
```

- `init.ts:1049-1061` validates the one-shot flag, writes the env override, then calls `resolveLanguage(cwd)`.
- `update.ts:1709-1718` performs the same override before template collection.
- `update.ts:661` resolves locale while collecting `workflow.md`.
- `workflow.ts:createWorkflowStructure()` accepts `WorkflowOptions.language` for workflow selection.

The missing link is platform template generation:

```text
resolved language
  X  configurePlatform(platform, cwd)
  X  collectPlatformTemplates(platform)
      -> common command/skill getters and platform agent getters default to English
```

`configurePlatform` and `collectPlatformTemplates` have no locale parameter (`configurators/index.ts:522-538`).

### Common command/single-file skill aggregation

`packages/cli/src/templates/common/index.ts`:

- `listMarkdownFiles()` returns every `*.md` (`:25`).
- `getCommandTemplates()` maps filenames to names and uses one `cachedCommands` singleton (`:57,65-70`).
- `getSkillTemplates()` does the same with one `cachedSkills` singleton (`:58,77-82`).
- The current inventory is 3 command sources and 5 single-file skill sources, about 30 KB / 892 lines total.

Naive sidecar behavior today:

```text
continue.md       -> logical command continue
continue.zh.md    -> logical command continue.zh   (BUG)
```

The selector must treat English sources as the canonical logical set, overlay `*.zh.md` content per file, and return the original logical name.

### Platform agent aggregation

`packages/cli/src/templates/template-utils.ts` supplies shared filesystem readers:

- `listMdAgents()` filters every `.md`, strips `.md`, and reads it (`:49-56`).
- `listJsonAgents()` filters every `.json`, strips `.json`, and reads it (`:59-66`).
- There is no TOML equivalent.

Most platform modules delegate to these readers. Claude and Codex hand-roll equivalent loops. OpenCode recursively walks its whole platform directory rather than using a template index.

A generic selector in `template-utils.ts` is the right shared boundary because PR2 needs `.md`, `.json`, and `.toml`, while PR3 later needs recursive Markdown and compound `.md.txt` selection. The selector should be pure and suffix-aware rather than hardcoding one extension.

## Recommended locale propagation contract

Thread locale as an explicit argument; do not add shared module state.

```ts
configurePlatform(platformId, cwd, language = resolveLanguage(cwd))
collectPlatformTemplates(platformId, language = DEFAULT_LANGUAGE)

configureX(cwd, language = DEFAULT_LANGUAGE)
collectXTemplates(language = DEFAULT_LANGUAGE)

resolveCommands(ctx, language = DEFAULT_LANGUAGE)
resolveSkills(ctx, language = DEFAULT_LANGUAGE)
resolveAllAsSkills(ctx, language = DEFAULT_LANGUAGE)
getAllAgents(language = DEFAULT_LANGUAGE)
```

Required call-chain changes:

```text
init() resolves language once
  -> handleReinit(..., language)
     -> configurePlatform(platform, cwd, language)   [add-platform fast path]
  -> configurePlatform(platform, cwd, language)     [full init path]

update.collectTemplateFiles() resolves language once
  -> collectPlatformTemplates(platform, language)
```

Why explicit threading:

- The backend spec says `shared.ts` should cache only the resolved Python command and pass other derived values through arguments.
- `configurePlatform()` is routinely called against temp directories that differ from `process.cwd()` in tests.
- `collectPlatformTemplates()` is also called by manifest pruning, tests, and regressions; a default English argument preserves compatibility while update passes the actual locale.
- PR3 can reuse the same locale argument in `resolveBundledSkills()` without inventing a second resolver.

The re-init fast path is load-bearing: `init.ts:756` defines `handleReinit`, and `:1141` calls it before the main init flow. If language is passed only at the later `configurePlatform` call (`:1847`), adding a platform to an existing Chinese project will still write English templates.

## Recommended selector contract in `template-utils.ts`

Use the English filename set as canonical and insert the locale before an explicit semantic suffix.

```ts
interface LocalizedTemplateSelection {
  logicalFile: string; // unsuffixed destination/source identity
  sourceFile: string;  // selected locale sibling or English fallback
}

selectLocalizedTemplateFiles(
  files: readonly string[],
  semanticSuffix: ".md" | ".json" | ".toml" | ".md.txt",
  language: SupportedLanguage,
): LocalizedTemplateSelection[]
```

Required semantics:

1. Canonical output is derived only from English files.
2. For `zh`, `foo.zh<suffix>` overlays `foo<suffix>`.
3. Missing localized sibling falls back to English without warning/error.
4. Orphan translations never create output; drift validation reports them.
5. Returned logical names/paths never contain `.zh.`.
6. Output ordering remains deterministic.
7. The suffix is explicit so PR3 can correctly map `foo.md.txt <-> foo.zh.md.txt`; `path.extname()` alone would produce the wrong `foo.md.zh.txt` form.
8. Selection itself should be pure so temp-fixture tests can cover missing translations without deleting repository files.

`createTemplateReader()` should expose locale-aware Markdown, JSON, and TOML agent readers built on this function. Claude and Codex should either adopt those readers or call the same pure selector; no third algorithm should be introduced.

## Locale-keyed caches

Replace:

```ts
let cachedCommands: CommonTemplate[] | undefined;
let cachedSkills: CommonTemplate[] | undefined;
```

with locale-keyed maps. The regression sequence is:

```text
getCommandTemplates(en) -> getCommandTemplates(zh) -> getCommandTemplates(en)
```

The first and third English results must be byte-identical, and the middle result must contain Chinese selected bytes. The same applies to skills and any extracted generated-prose source.

Do not cache by mutable env/config state. Cache by the explicit normalized locale argument.

## Generated prose that also requires localization

### Skill and command frontmatter descriptions

`configurators/shared.ts` currently stores human/LLM-facing English in:

- `SKILL_DESCRIPTIONS` (`:225`)
- `COMMAND_DESCRIPTIONS` (`:267`)

These values land in every generated `SKILL.md` and in Qoder command frontmatter. Translating only the Markdown bodies would leave the AI matcher/user palette descriptions English.

Recommended source organization:

```text
packages/cli/src/templates/common/descriptions.json
packages/cli/src/templates/common/descriptions.zh.json
```

The English JSON should contain the current strings byte-for-byte; the Chinese sibling translates values while preserving command/skill keys. Per-key fallback is English. Resolved `CommonTemplate` entries can carry the selected description into `wrapWithSkillFrontmatter` / `wrapWithCommandFrontmatter`.

This keeps translated prose in parallel-suffix template sources instead of embedding a second i18n dictionary in TypeScript. Tests must prove generated English bytes remain unchanged after extracting the existing registries.

### Pull-based sub-agent prelude

`configurators/shared.ts:buildPullBasedPrelude()` is a long English string inserted into implement/check definitions for Codex, Gemini, Qoder, Copilot, and Pi. It includes task-loading instructions and cannot remain English in a fully Chinese agent definition.

Recommended source organization:

```text
packages/cli/src/templates/common/agent-preludes/pull-based.md
packages/cli/src/templates/common/agent-preludes/pull-based.zh.md
```

Use a protected placeholder for `implement.jsonl` vs `check.jsonl`. `buildPullBasedPrelude(agentType, language)` selects the locale source, substitutes the role-specific JSONL filename, and still runs Python-command adaptation. Thread `language` through:

- `injectPullBasedPreludeMarkdown`
- `injectPullBasedPreludeToml`
- `applyPullBasedPreludeMarkdown`
- `applyPullBasedPreludeToml`

English generated output must remain byte-identical to the current inline string.

## Common translation inventory and protected structure

Planning baseline (derive dynamically in tests; do not hardcode):

```text
common/commands: 3 English Markdown files
common/skills:   5 English Markdown files
```

Translate all human/LLM-facing headings, prose, tables, checklists, quoted guidance, report examples, and Markdown/HTML comments. Preserve exactly:

- filenames and logical IDs;
- `{{PYTHON_CMD}}`, `{{CLI_FLAG}}`, `{{CMD_REF:*}}`, and conditional placeholders;
- commands, flags, paths, environment variables, JSON/JSONL keys, status values, phase/step identifiers, and code identifiers;
- inline-code technical tokens;
- fenced command bodies and link targets;
- Trellis and platform/product proper names.

Natural-language shell comments and sample report prose may be translated, but executable tokens in those blocks must remain exact.

## Init/update and hash implications

Locale selection must happen before path assembly. Downstream maps and writes remain locale-blind:

```text
selected source bytes -> existing logical destination path -> existing hash key
```

No `.template-hashes.json` schema change is needed. The value naturally becomes the hash of Chinese landed bytes; the key remains the unsuffixed destination.

Shared `.agents/skills/` has an additional invariant: Codex and Gemini must render the five overlapping single-file skills byte-identically under both English and Chinese. Both must use the same locale and neutral placeholder renderer.

## Files likely modified by PR2 logic

- `packages/cli/src/templates/template-utils.ts`
- `packages/cli/src/templates/common/index.ts`
- `packages/cli/src/types/ai-tools.ts` only if a locale-bearing context type is chosen; explicit separate arguments avoid changing static registry data
- `packages/cli/src/configurators/shared.ts`
- `packages/cli/src/configurators/index.ts`
- `packages/cli/src/commands/init.ts`
- `packages/cli/src/commands/update.ts`
- all 14 configurator files, to pass the selected language consistently
- platform template indexes for Claude, Cursor, Codex, Kiro, Gemini, Qoder, CodeBuddy, Droid, and Pi
- OpenCode's recursive walker

No hash utility, manifest schema, migration, Python runtime, workflow parser, spec-template writer, or docs-site change is required for PR2.

## Related specs

- `.trellis/spec/cli/backend/directory-structure.md` — parallel suffixes, English canonical source, unsuffixed destinations, locale-keyed getter guidance.
- `.trellis/spec/cli/backend/configurator-shared.md` — explicit argument flow, neutral shared-skill rendering, pull-prelude and byte-parity invariants.
- `.trellis/spec/cli/backend/platform-integration.md` — platform formats and configure/collect symmetry.
- `.trellis/spec/cli/backend/commands-update.md` — update map, hash, and idempotency contract.
- `.trellis/spec/cli/unit-test/conventions.md` — dynamic inventories and exact behavior assertions.

## Caveats

- The current backend spec says research is exempt from pull-based prelude, while current workflow/user delegation requires an active task for research persistence. PR2 is translation-only and must preserve current semantics rather than resolving that pre-existing documentation/code mismatch.
- Unsupported locales already normalize/fall back before this layer. Localized source selection should still degrade to English defensively.
- `copy-templates.js` will intentionally package the parallel source files into `dist/templates`; the configurators, not the build copier, are responsible for preventing locale-suffixed files from landing in user projects.
