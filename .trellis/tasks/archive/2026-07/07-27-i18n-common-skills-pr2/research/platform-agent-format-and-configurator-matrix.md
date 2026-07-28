# Research: Trellis agent formats and configurator matrix

- **Query**: Inspect every supported agent-capable platform's Trellis agent source format, loader, init writer, update collector, and locale hazards for PR2.
- **Scope**: Internal templates/configurators/tests
- **Date**: 2026-07-27

## Inventory

Trellis currently has 11 agent-capable platforms and 3 roles (`trellis-research`, `trellis-implement`, `trellis-check`), producing 33 installed agent definitions.

Only 10 platforms own physical source definitions. GitHub Copilot derives all three definitions from Cursor sources and applies platform transformations. Therefore PR2's source baseline is 30 English files, not 33.

| Platform | Capability class | Physical source | Installed target | Source count |
|---|---|---|---|---:|
| Claude Code | Class-1 hook-inject | `templates/claude/agents/*.md` | `.claude/agents/*.md` | 3 |
| Cursor | Class-1 hook-inject | `templates/cursor/agents/*.md` | `.cursor/agents/*.md` | 3 |
| OpenCode | Class-1 JS plugin | `templates/opencode/agents/*.md` | `.opencode/agents/*.md` | 3 |
| Codex | Class-2 pull-based | `templates/codex/agents/*.toml` | `.codex/agents/*.toml` | 3 |
| Kiro | Class-1 agentSpawn | `templates/kiro/agents/*.json` | `.kiro/agents/*.json` | 3 |
| Gemini CLI | Class-2 pull-based | `templates/gemini/agents/*.md` | `.gemini/agents/*.md` | 3 |
| Qoder | Class-2 pull-based | `templates/qoder/agents/*.md` | `.qoder/agents/*.md` | 3 |
| CodeBuddy | Class-1 hook-inject | `templates/codebuddy/agents/*.md` | `.codebuddy/agents/*.md` | 3 |
| Factory Droid | Class-1 hook-inject | `templates/droid/droids/*.md` | `.factory/droids/*.md` | 3 |
| Pi Agent | Class-3 extension-backed, pull-prelude fallback | `templates/pi/agents/*.md` | `.pi/agents/*.md` | 3 |
| GitHub Copilot | Class-2 pull-based | **Cursor source reused** | `.github/agents/*.agent.md` | 0 direct / 3 generated |

Agent-less Kilo, Antigravity, and Windsurf have no agent definition files; they still receive localized common commands/single-file skills.

## Per-platform format and loader details

### Claude Code

- Format: Markdown with YAML frontmatter (`name`, block-scalar `description`, comma-separated `tools`).
- Loader: hand-written `templates/claude/index.ts:getAllAgents()` scans every `.md` (`:43-55`).
- Init: `configurators/claude.ts:copyDirFiltered()` recursively copies the platform directory (`:38-61`).
- Update: `configurators/index.ts` independently calls `getClaudeAgents()` and maps `.claude/agents/<name>.md`.
- Locale hazard: both paths would expose/copy `*.zh.md` as a second file. Init's recursive copy is not using the update getter, so both paths must call one selector or parity will drift.
- Required structural invariants: `name` and `tools` unchanged; description and body prose translated; recursion guard/context-loading markers preserved.

### Cursor

- Format: Markdown/YAML, but `description` must be a single-line literal. Block scalar `description: |` is rejected by Cursor's UI parser.
- Loader: shared `template-utils.ts:listMdAgents()` via `templates/cursor/index.ts`.
- Init/update: `writeAgents(getAllAgents())` and matching collector.
- Locale hazard: generic loader currently treats `.zh.md` as another agent.
- Copilot dependency: Cursor's selected locale source also drives Copilot. Do not add a duplicate Copilot source tree.
- Regression owner: `test/templates/cursor.test.ts:29` enforces single-line descriptions; run the same check against Chinese sources/selected output.

### OpenCode

- Format: Markdown/YAML with `description`, `mode: subagent`, and nested `permission` map.
- Loader/writer: no template index. `configurators/opencode.ts:walkOpenCodeTemplateDir()` recursively reads every file under `templates/opencode/` and is shared by init and update (`:47-82,86-109`).
- Locale hazard: a Chinese sidecar would be copied verbatim as `.opencode/agents/trellis-*.zh.md` unless the walker overlays localized agent sources onto canonical paths and skips sidecars.
- Required structural invariants: `mode`, permission keys/values, tool wildcards, and frontmatter shape unchanged.
- Advantage: init/update already share one map producer, so locale selection in that producer gives byte parity automatically.

### Codex

- Format: TOML with stable `name`, `description`, `sandbox_mode`, and triple-quoted `developer_instructions`.
- Loader: hand-written `templates/codex/index.ts:getAllAgents()` scans every `.toml` (`:63-76`).
- Transformation: `applyPullBasedPreludeToml()` inserts a generated prelude inside `developer_instructions` for implement/check.
- Init: `configurators/codex.ts:84-90`.
- Update: `configurators/index.ts` applies the same prelude and maps `.codex/agents/*.toml`.
- Locale hazards:
  - `.zh.toml` currently becomes another agent named `trellis-*.zh`.
  - The selected Chinese body would still receive an English generated prelude unless prelude selection is localized.
- Required structural invariants: TOML keys, exact `name`, `sandbox_mode`, triple-quote boundaries, and technical literals unchanged.

### Kiro

- Format: JSON with `name`, `description`, escaped Markdown in `prompt`, `tools`, `allowedTools`, and `hooks.agentSpawn`.
- Loader: `template-utils.ts:listJsonAgents()` via `templates/kiro/index.ts`.
- Transform: `resolvePlaceholders()` resolves `{{PYTHON_CMD}}` before write/collect.
- Locale hazard: `.zh.json` becomes an extra agent and may duplicate names.
- Required structural invariants:
  - both English and Chinese files parse as JSON;
  - top-level key set is identical;
  - `name`, `tools`, `allowedTools`, hook keys/command, placeholder set, and schema shape are identical;
  - only `description` and natural-language `prompt` prose differ.
- Regression owner: `regression.test.ts:5688` enforces the current `prompt`/hooks-object schema.

### Gemini CLI

- Format: Markdown/YAML with `name` and block-scalar `description`; intentionally **no `tools:` line**, because Gemini rejects the comma-separated form.
- Loader: shared `listMdAgents()`.
- Transformation: implement/check receive `applyPullBasedPreludeMarkdown()`.
- Locale hazards: duplicate `.zh` agent name plus English generated prelude.
- Required invariant: Chinese source must also omit `tools:`.

### Qoder

- Format: Markdown/YAML with `name`, block-scalar `description`, comma-separated tools.
- Loader: shared `listMdAgents()`.
- Transformation: implement/check receive pull-based prelude.
- Locale hazards: duplicate `.zh` agent name plus English prelude.
- Required invariants: frontmatter keys/tools and agent identity unchanged.

### CodeBuddy

- Format: Markdown/YAML; current files are byte-identical to Claude for all three roles.
- Loader: shared `listMdAgents()`.
- Init/update: plain selected source with class-1 hook fallback protocol already in body.
- Locale hazard: duplicate `.zh` agent.
- Translation decision: still add CodeBuddy-specific parallel sources. Do not make runtime output depend on Claude's source path; the platform source directories are independently tracked and may diverge upstream.

### Factory Droid

- Format: Markdown/YAML under `droids/`, but semantic role names remain `trellis-*`.
- Loader: `listMdAgents("droids")` via `getAllDroids()`.
- Init/update: `.factory/droids/<name>.md`.
- Locale hazard: duplicate `.zh` droid.
- Required invariant: preserve “Droid” platform terminology and all frontmatter tools/IDs.

### Pi Agent

- Format: compact Markdown/YAML (`name`, description, tools).
- Loader: shared `listMdAgents()`.
- Init/update: dedicated `collectPiTemplates()` is the map source; both apply `applyPullBasedPreludeMarkdown()` to implement/check.
- Locale hazards: duplicate `.zh` agent plus English generated prelude.
- Required invariants: names/tool list unchanged; no Python hook references introduced; extension behavior untouched.
- Pi definitions are intentionally shorter than other platform copies; translate their actual content, do not replace them with a larger canonical agent body.

### GitHub Copilot

- No physical agent source under `templates/copilot/`.
- Both init and update dynamically import/reuse Cursor agents, then call:
  1. `normalizeCopilotMarkdownAgents()` to convert tools to Copilot YAML lists;
  2. `applyPullBasedPreludeMarkdown()`;
  3. write/map `.github/agents/<name>.agent.md`.
- Locale must be passed into Cursor `getAllAgents(language)` and into the prelude transform.
- Required invariants: selected Chinese prose survives; normalized Copilot tools remain `read/edit/search/execute/web/exa/*/chrome-devtools/*`; init and collect output remain identical.

## Source naming

Use suffix insertion before the complete source suffix:

```text
Markdown: trellis-check.md        + trellis-check.zh.md
TOML:     trellis-check.toml      + trellis-check.zh.toml
JSON:     trellis-check.json      + trellis-check.zh.json
```

All install targets retain their current names. No generated path or hash key may contain `.zh.`.

## Translation policy for agent files

Translate:

- frontmatter/TOML/JSON `description` values;
- headings, prose, checklists, table labels, report-format prose, explanatory comments, warnings, and instructions inside the agent prompt;
- natural-language portions of examples.

Preserve exactly:

- role IDs: `trellis-research`, `trellis-implement`, `trellis-check`;
- YAML/TOML/JSON keys and structural punctuation;
- tool names, permission values, sandbox modes, event names, hook commands;
- commands, flags, paths, filenames, env vars, placeholders, JSONL keys, status values, code identifiers;
- `<!-- trellis-hook-injected -->`, `{TASK_DIR}`, `<task-path>`, and `Active task:` protocol tokens where parsers/tests consume the literal;
- fenced code delimiters/languages and executable command content;
- Trellis, GitNexus, ABCoder, platform names, and other proper names.

“Active task:” and other protocol labels should remain literal when a parser/test extracts them. Translate the surrounding instruction, not the stable token.

## Current duplication and why not to refactor it in PR2

The source tree has heavy textual duplication:

- Claude and CodeBuddy are byte-identical by role.
- Claude, Qoder, Droid, and Gemini differ mostly in frontmatter or a recursion-guard section.
- Research sources for Claude, CodeBuddy, Qoder, and Droid are byte-identical.

Do not extract a new canonical cross-platform agent DSL in this translation PR. Platform-specific differences are contract-sensitive (Cursor description syntax, Gemini missing tools, OpenCode permissions, Kiro JSON, Codex TOML, Pi compact prompts). Refactoring them while translating would enlarge review risk and make upstream merges harder. Parallel translations should mirror the current source boundaries.

## Tests that must be locale-parameterized

### Source/loader tests

- `templates/claude.test.ts`, `cursor.test.ts`, `codex.test.ts`, `pi.test.ts`, plus a new generic selector test.
- Assert each getter returns exactly the canonical three role names for both `en` and `zh`; no `.zh` logical names.
- Dynamic source-pair inventory across all physical agent directories.

### Structural tests

- Cursor: Chinese selected/source description remains single-line.
- Gemini: no `tools:` line in either locale.
- Kiro: parse JSON and compare key/tool/hook structure.
- Codex: required TOML assignments and balanced triple-quoted instructions.
- OpenCode: permission map and `mode: subagent` preserved.
- All Markdown: frontmatter identity/tool fields and protected token sets preserved.
- All roles: recursion guard/context protocol/persistence constraints still present after translation.

### Transform/output tests

- Existing `platforms.test.ts:225` configure-vs-collect byte parity should run for both locales and all 14 platforms.
- Existing class-2 prelude tests (`regression.test.ts:4960`) should assert Chinese selected prelude/prose while stable technical tokens remain.
- Existing Copilot normalization tests and collect parity remain green for Chinese.
- Existing Kiro schema (`:5688`), research persistence (`:5175`), class-1 fallback (`:5574`), and Cursor description (`cursor.test.ts:29`) checks must run against both source locales or generated outputs.

## Practical risk

Although each getter has few direct callers, changing selection affects every generated platform file, hash tracking, and uninstall ownership. Practical risk is medium/high because:

- 14 configurator paths consume common templates;
- 11 agent-capable platforms consume agent definitions;
- class-2/Pi agent output has a second generated prose layer;
- Claude and OpenCode use recursive copy/walk mechanisms unlike the other loaders;
- Copilot has no direct source and is easy to omit from locale tests.

## Related specs

- `.trellis/spec/cli/backend/platform-integration.md` — platform formats and capability classes.
- `.trellis/spec/cli/backend/configurator-shared.md` — prelude, Copilot normalization, init/update symmetry.
- `.trellis/spec/cli/backend/commands-update.md` — collected map and hash behavior.
- `.trellis/spec/guides/cross-platform-thinking-guide.md` — exhaustive platform audit requirement.

## Caveats

- The platform integration spec contains some stale historical prose (for example older OpenCode tracking language). Current configurator code and regression tests are authoritative.
- Proper-name preservation does not mean leaving all English prose untouched. Product/platform names remain English inside otherwise Chinese sentences.
