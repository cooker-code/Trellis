# Design: locale-aware common templates and cross-platform Trellis agents

## 1. Context

PR1-A resolves `en|zh` and selects `workflow.md`, but common command/skill getters and platform agent loaders were locale-blind. Naively adding sidecars would create extra logical commands or agents because the filesystem scanners accepted every `.md`, `.toml`, or `.json` source.

PR2 performs locale selection at the source aggregation layer and threads one resolved locale through the platform rendering graph. Destination assembly, hash tracking, migrations, uninstall, and platform invocation remain locale-blind.

## 2. Design goals

1. Use one English-canonical selector for common and agent sources.
2. Propagate locale explicitly from init/update into configure/collect.
3. Provide per-file and per-key English fallback with unsuffixed destinations.
4. Localize generated prose, including frontmatter descriptions and pull-based preludes.
5. Preserve exact English behavior and init/update byte parity.
6. Leave a selector and propagation contract reusable by PR3.

## 3. Non-goals

- Workflow localization or parser changes (PR1-B).
- Bundled-skill, spec-template, Python-message, or docs-site localization (PR3).
- TypeScript CLI output localization.
- Agent semantic redesign or cross-platform agent deduplication.
- Hash schema or migration changes.

## 4. Source-selection primitive

`packages/cli/src/templates/template-utils.ts` owns the pure selector:

```ts
interface LocalizedTemplateSelection {
  logicalFile: string;
  sourceFile: string;
}

selectLocalizedTemplateFiles(
  files: readonly string[],
  semanticSuffix: string,
  language: SupportedLanguage,
): LocalizedTemplateSelection[]
```

Algorithm:

1. Identify canonical English files ending in `semanticSuffix`, excluding recognized locale sidecars.
2. Sort canonical files deterministically.
3. For non-English locale, derive `<stem>.<language><semanticSuffix>`.
4. Select that sibling when present; otherwise select the canonical English source.
5. Return the canonical logical filename regardless of selected source.
6. Ignore orphan locale sidecars.

The semantic suffix is explicit, so `.md`, `.toml`, `.json`, and PR3's compound `.md.txt` form resolve correctly. `createTemplateReader()` builds `listMdAgents(language)`, `listJsonAgents(language)`, and `listTomlAgents(language)` on this primitive.

## 5. Locale propagation

Locale is resolved once at each command boundary and passed explicitly:

```text
init() resolves language
  -> handleReinit(..., language)
  -> configurePlatform(platform, cwd, language)
     -> configureX(cwd, language)
        -> common resolvers + agent getters

update() resolves language
  -> collectTemplateFiles(..., language)
  -> collectPlatformTemplates(platform, language)
     -> collector common resolvers + agent getters
```

`PlatformFunctions.configure` and `collectTemplates` receive `SupportedLanguage`. Public low-level APIs default to English for compatibility, but init/update always pass their resolved value. No process-global locale cache is introduced; selected-content caches use the explicit locale as their key.

## 6. Common command and skill aggregation

`getCommandTemplates(language)` and `getSkillTemplates(language)` use the English files as the logical inventory and cache results in locale-keyed maps. Returned names never contain `.zh`.

Generated matcher and command-palette descriptions live in parallel metadata sources:

```text
common/descriptions.json
common/descriptions.zh.json
```

English values are authoritative. Chinese values overlay per key, and a missing file or key falls back to English. All command/skill resolver variants accept locale:

- `resolveCommands`
- `resolveSkills`
- `resolveSkillsNeutral`
- `resolveAllAsSkills`
- `resolveAllAsSkillsNeutral`
- `resolveCodexTrellisStartSkill`

Capability filtering and neutral `.agents/skills/` placeholder rendering are unchanged.

## 7. Pull-based prelude

The class-2 prelude is stored as parallel templates:

```text
common/agent-preludes/pull-based.md
common/agent-preludes/pull-based.zh.md
```

`buildPullBasedPrelude(agentType, language)` selects the locale, replaces the role-specific JSONL placeholder with `implement.jsonl` or `check.jsonl`, and applies the existing Python-command adaptation. Locale flows through Markdown and TOML inject/apply helpers. The existing research-agent prelude behavior is not changed.

## 8. Agent source selection and transformations

English files define the role set; Chinese sidecars only replace prose bytes.

- Claude Code: selected agents are written from the locale-aware getter; sidecars are not recursively copied.
- Cursor, CodeBuddy, Gemini, Qoder, Droid, and Pi: shared locale-aware Markdown readers.
- OpenCode: its shared recursive init/update collector overlays selected agent sidecars and suppresses source-suffixed targets.
- Codex: locale-aware TOML reader, then pull-based prelude injection.
- Kiro: locale-aware JSON reader, then existing placeholder resolution.
- Copilot: locale-selected Cursor sources, then Copilot tool normalization and pull-based prelude injection.
- Pi: locale-selected compact agents plus its existing extension-backed behavior; no Python hooks are added.

All post-selection transforms run in the same order in init and update collectors.

## 9. Translation policy

Translate human/LLM-facing headings, prose, descriptions, report formats, examples, checklists, tables, and natural-language comments. Preserve:

- role IDs such as `trellis-implement`;
- commands, flags, paths, filenames, environment variables, code identifiers, and status values;
- YAML/TOML/JSON keys, tool names, permissions, sandbox modes, and hook/event names;
- placeholders and parser-consumed protocol syntax, especially `Active task:`, `{TASK_DIR}`, `<task-path>`, and `<!-- trellis-hook-injected -->`;
- code-fence languages, link targets, and product/platform proper names.

Translated examples retain their structural syntax while replacing human-readable labels and explanatory text.

## 10. Data flow and hash contract

```text
English canonical source set
  -> locale overlay / English fallback
  -> platform placeholder + wrapper/prelude transforms
  -> existing unsuffixed destination map
  -> init write or update compare
  -> hash landed bytes under the destination key
```

Locale suffixes never reach platform maps, write helpers, `.template-hashes.json`, migrations, or uninstall. Switching locale is an ordinary template-content transition protected by the existing stored-hash conflict policy.

## 11. Validation model

### Structural parity

Compare protected structure rather than translated prose:

- placeholders and stable tokens;
- role/file IDs;
- frontmatter keys and stable values;
- JSON schema, tools, and hooks;
- TOML assignments and triple-quote boundaries;
- code-fence sequence, technical literals, and link targets.

### Translation completeness

For each Chinese common template and physical agent source:

- discover the expected inventory dynamically from canonical English sources;
- require meaningful Chinese in each major Markdown section;
- reject a large English-only tail after the last Chinese text in a section;
- verify report-format headings and examples, including fenced Markdown examples.

### Behavioral parity

- English and Chinese destination key sets are identical.
- Every platform's configure output equals its collect map byte-for-byte for both locales.
- English generated bytes remain compatible.
- Codex and Gemini shared `.agents/skills/` bytes remain identical.
- First init, re-init add-platform, update switching, fallback, cache isolation, hash refresh, and user-edit protection are covered.

## 12. Compatibility

- No language or `en` selects canonical English sources.
- Missing translations silently fall back per file/key.
- Existing user-modified files remain conflict-protected.
- Platform schemas, tool vocabularies, command names, and destination paths do not change.
- Distribution packages both source locales, but generated projects receive one selected unsuffixed output.

## 13. PR boundaries

PR1-B owns workflow translation, parser compatibility, and workflow structural checks. PR2 owns common commands/single-file skills, descriptions, preludes, platform agent sources, and locale propagation. PR3 reuses PR2's selector and propagation for bundled skills, spec templates, and Python messages; PR2 does not modify those production sources.

Shared checker and integration-test changes are applied serially in PR1-B -> PR2 -> PR3 order.

## 14. Rollback

- Removing a Chinese sidecar causes automatic English fallback.
- Reverting explicit locale propagation restores English-only platform output without data migration.
- Metadata/prelude extraction is reversible because English generated bytes remain unchanged.
- No persisted user schema needs migration.

## 15. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Sidecar emitted as an extra command/agent | English-canonical selector and no-suffix path tests |
| Init/update select different locales | Explicit language arguments and all-platform byte parity |
| Cache poisoned by first locale | Locale-keyed caches and `en -> zh -> en` tests |
| Mixed-language generated output | Localized descriptions, prelude, major-section, and English-tail checks |
| Claude/OpenCode recursive sidecar leak | Dedicated collector and integration assertions |
| Copilot omitted | Cursor-derived Chinese output test after normalization/prelude |
| Shared `.agents/skills` collision | Neutral renderer parity under both locales |
| Invalid TOML/JSON/Markdown translation | Format-specific structural tests |
| Concurrent PR scope collision | Serialized ownership and no PR1/PR3 production edits |
