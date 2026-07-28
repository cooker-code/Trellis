# Draft planning artifacts for PR3

- **Purpose**: Ready-to-transfer content for `prd.md`, `design.md`, `implement.md`, `implement.jsonl`, and `check.jsonl`.
- **Constraint**: The Research Agent may write only under this task’s `research/` directory, so these drafts were not applied to task-root artifacts.
- **Date**: 2026-07-27

---

## Draft: `prd.md`

# i18n PR3: Chinese bundled skills, spec templates, and Python messages

## Goal

Complete the third Chinese-localization content slice by shipping Chinese sources for built-in multi-file skills and blank spec templates, migrating the remaining core Python CLI messages onto the existing dictionary-based i18n framework, and documenting the shipped/deferred localization coverage for the current Beta track.

Users selecting `zh` should receive Chinese human/LLM-facing content at the same unsuffixed destination paths, while English remains the default and missing translations fall back safely to English.

## Confirmed facts

- PR1-A already owns locale resolution, `language: en|zh`, `--language`, `TRELLIS_LANGUAGE`, workflow source selection, and Python `common/i18n.py`.
- PR2 owns common locale selection/propagation for agents, commands, and single-file skills. PR3 depends on that contract and must not create another locale resolver.
- Bundled skills are recursively loaded from `templates/common/bundled-skills/**`; a naive `*.zh.md` addition would currently leak both language files to user projects.
- The current source tree has 27 bundled-skill Markdown files and 17 spec `*.md.txt` files. Tests must derive pair counts dynamically rather than hardcoding them.
- Only 16 spec templates currently land; `guides/cross-platform-thinking-guide.md.txt` is dormant/unregistered and must remain so.
- `.trellis/spec/` is user-owned after creation and is not overwritten by `trellis update`.
- CLI TypeScript command/help/prompt/output localization is excluded.

## Dependencies

1. PR2 must be merged or available on the implementation branch before PR3 begins.
2. PR2 must provide one active-locale contract shared by init and update platform-template paths.
3. If that contract is missing or materially different, stop and revise this plan; do not duplicate PR2’s common locale-selection code.

## Requirements

### R1. Translation source organization

- Keep every English source unchanged.
- Add Chinese sources beside English sources:
  - bundled Markdown: `foo.md` + `foo.zh.md`;
  - spec source: `foo.md.txt` + `foo.zh.md.txt`;
  - Python messages: `i18n_strings/en.py` + `i18n_strings/zh.py`.
- Treat English sources as the canonical logical file/key set.
- Preserve proper names and technical identifiers, including Trellis, GitNexus, ABCoder, platform names, skill IDs, commands, flags, paths, environment variables, JSON keys, status values, placeholders, code identifiers, code blocks, and link targets.
- Translate all human/LLM-facing prose and Markdown/HTML comments in the covered Markdown sources.

### R2. Bundled-skill recursive loading

- Localize every Markdown file under both bundled skills and all recursive references.
- Under `zh`, prefer the translated counterpart and fall back to English per file.
- Always return/write the unsuffixed logical destination path.
- Never install `*.zh.md` files into platform directories.
- Preserve non-localized assets/files unchanged.
- Ensure cache state is locale-keyed so multiple locale resolutions in one process do not contaminate each other.
- Ensure init writers and update collectors produce the same destination/content map.

### R3. Blank spec templates

- Add Chinese counterparts for every current English `*.md.txt` source, including the dormant cross-platform guide source.
- Select Chinese content at init/re-init when `language=zh`, with English fallback.
- Keep backend/frontend/fullstack, monorepo, and remote-template routing unchanged.
- Do not activate the dormant cross-platform guide.
- Do not overwrite existing user-owned `.trellis/spec/` when language changes during update.

### R4. Core Python CLI messages

- Use the existing `common.i18n.set_locale()` and `t(key, **kwargs)` framework; do not add gettext/Babel or another parser/resolver.
- Resolve locale once at each public core entry point before argparse/help/output is built.
- Migrate core user-visible success, warning, error, hint, argparse-help, and text-context prose reachable from:
  - `task.py`;
  - `add_session.py`;
  - `get_context.py` / `common/git_context.py`;
  - `get_developer.py`;
  - `init_developer.py`;
  - their shared core modules.
- Keep English and Chinese key sets and format-placeholder sets aligned.
- Preserve exit codes and stdout/stderr routing.
- Preserve machine-consumed outputs exactly: raw path outputs, `task.py current --source` labels, JSON keys/schemas, enum values, and technical tokens.
- Keep generated workspace journal/index schemas, optional `linear_sync.py`, platform-specific Python hooks, developer-only self-test output, debug strings, and the invalid-locale bootstrap warning outside this PR; list them as deferred/intentional exclusions in docs.

### R5. Drift and structural validation

- Extend i18n drift checking to recognize compound `*.zh.md.txt` sources.
- Warn for missing English counterparts and stale English/Chinese source pairs; preserve current warning-only default and strict failure mode.
- Compare Python English/Chinese key sets and per-key format placeholders.
- Add structural tests for destination-path parity, frontmatter identity fields, placeholders, link targets, code fences/protected tokens, and missing-translation fallback.

### R6. Beta documentation and roadmap

- Add mirrored EN/ZH Beta localization pages and routes.
- Document configuration/flag priority, init/update materialization, fallback, unsuffixed destinations, hash behavior, spec ownership, Python protocol exceptions, translation policy, and coverage roadmap.
- Update mirrored Beta configuration and roadmap pages; audit the Beta FAQ for stale partial-support wording.
- Do not update Release-track pages/routes before GA.

## Acceptance criteria

- [ ] Every English bundled-skill Markdown source has a Chinese counterpart; `zh` init/update lands Chinese content at normal platform paths and no landed path contains `.zh.`.
- [ ] A missing bundled translation falls back to English without failure.
- [ ] Resolving `en -> zh -> en` in one process returns correct content each time.
- [ ] All platform collectors preserve the same logical destination set between English and Chinese.
- [ ] Every spec `*.md.txt` source has a `*.zh.md.txt` counterpart; a fresh `zh` init lands representative Chinese backend/frontend/guide specs at unsuffixed `.trellis/spec/**` paths.
- [ ] English init output remains byte-compatible with current English sources.
- [ ] The dormant cross-platform guide remains unregistered, and remote spec-template behavior is unchanged.
- [ ] Changing language during update does not overwrite existing `.trellis/spec/` content.
- [ ] Representative `task.py`, `add_session.py`, `get_developer.py`, and `get_context.py` core prose is Chinese under `zh` and English by default.
- [ ] Python `zh -> en -> key` fallback, dictionary key parity, and placeholder parity are tested.
- [ ] `task.py current --source`, raw path stdout, JSON schemas, exit codes, and stdout/stderr channels remain stable under both locales.
- [ ] `pnpm run i18n:check` covers Markdown, compound spec sources, and Python dictionary drift.
- [ ] EN/ZH Beta localization routes exist in matching navigation order; no Release route is added.
- [ ] CLI lint, typecheck, Python lint, tests, i18n check, build, and docs lint/format checks pass.

## Out of scope

- TypeScript CLI command/help/prompt/warning/error/summary localization.
- New locale-selection flags, config readers, or precedence rules.
- Platform-specific template directories not generated from PR2 common sources.
- Runtime machine translation or translation APIs.
- Languages other than English and Chinese.
- Rewriting existing user-owned specs when language changes.
- Generated workspace journal/index schema localization.
- Optional `linear_sync.py` and platform hook Python output.
- Renaming proper names or technical identifiers, including `trellis-spec-bootstarp`.
- Starting the task or changing product code during planning.

## Risks

- Recursive bundled loading can leak `*.zh.md` files or mix locales if cache keys are wrong.
- Output localization can break shell/agent consumers if protocol labels, channels, or exit codes change.
- `*.md.txt` naming can evade drift checks without compound-suffix support.
- Docs-site is a submodule and may contain unrelated work; preserve it and commit submodule changes separately during implementation.

---

## Draft: `design.md`

# Design: i18n PR3

## 1. Boundary and dependency

PR3 is a content/selection extension over PR1-A and PR2. It does not resolve locale itself.

The required upstream contract is:

```text
CLI/config/env -> one active locale -> init writer and update collector
```

PR3 consumes that locale in two source selectors:

```text
common bundled skill tree -> localized logical files -> platform destinations
markdown spec catalog      -> localized logical docs  -> .trellis/spec destinations
```

If PR2 exposes a named locale helper, use it. If PR2 passes locale explicitly, thread that value through. Do not introduce a second process-global locale source.

## 2. Source and destination model

English files define logical destinations:

```text
foo.md              -> logical foo.md
foo.zh.md           -> Chinese source overlay for foo.md
foo.md.txt          -> logical foo.md
foo.zh.md.txt       -> Chinese source overlay for foo.md
```

Selection:

```text
locale=en: English source
locale=zh: Chinese source if present, otherwise English
```

The selected content is written under the logical destination. Locale suffixes never enter user projects or `.template-hashes.json` keys.

## 3. Bundled-skill data flow

Current flow:

```text
recursive filesystem walk
  -> CommonBundledSkillFile[]
  -> resolveBundledSkills(ctx)
  -> writeSkills / collectSkillTemplates
  -> platform path + hash
```

Revised flow:

```text
recursive English canonical walk
  -> overlay locale counterpart by logical relative path
  -> CommonBundledSkillFile[] with unsuffixed relativePath
  -> placeholder resolution
  -> unchanged writers/collectors
```

Key properties:

- The English tree is canonical, so orphan translations cannot become new outputs.
- Missing translation is a per-file fallback.
- Cache is keyed by locale.
- Non-Markdown files are copied unchanged.
- Init and update use the same resolver result.

## 4. Spec-template data flow

Replace the purely eager English-only consumption with a locale-aware catalog/accessor in `templates/markdown/index.ts`. Keep compatibility exports if other callers/tests require English constants.

`WorkflowOptions.language` already exists. Pass it through:

```text
createWorkflowStructure
  -> createSpecTemplates(language)
    -> writeBackendDocs / writeFrontendDocs / guides
      -> selected localized content
```

The live logical catalog remains the current 16 files. The dormant cross-platform guide receives a translation source for parity but remains outside the live catalog.

Remote spec packages continue to short-circuit local blank-template writes.

## 5. Translation structure validation

For each English/Chinese Markdown pair, compare protected structure rather than prose bytes:

- English counterpart exists.
- Logical destination matches.
- Required frontmatter keys exist; `name` is identical.
- Placeholder sets are identical.
- Relative link targets are identical.
- Code-fence count/language sequence and protected code/command tokens remain intact.
- No Chinese source suffix appears in output maps.

Do not hardcode file counts in tests; derive the English canonical set and assert complete pairing. The current counts (27 and 17) are planning baselines only.

## 6. Python message flow

Public entry points call `set_locale()` before parser creation or output. Shared modules import `t` and format user prose through flat keys.

```text
entry main -> set_locale once -> command/shared functions -> t(key, kwargs)
```

The English dictionary is authoritative. Chinese fallback remains:

```text
zh key -> English key -> key string
```

Keep formatting/channel logic in callers where it is part of the command contract. Translation entries provide prose, not control flow.

### Protocol-safe allowlist

The following remain literal/stable:

- raw stdout paths;
- `Current task:`, `Source:`, `State: stale` in `task.py current --source`;
- JSON field names and mode/status values;
- severity tokens and technical identifiers;
- persisted workspace/index marker schema.

Tests assert this allowlist instead of assuming every literal must be translated.

### Circular dependency rule

`i18n.py` imports `config.py`; therefore `config.py` must not import `i18n` at module load time. Leave the invalid-language bootstrap warning English. Any localized config messages must avoid a new cycle, preferably by being moved to already-localized callers rather than adding lazy circular imports.

## 7. Drift checker

Extend the existing warning-only checker with two source families:

1. suffix pairs, including `*.zh.md.txt`;
2. Python `STRINGS` bundles.

Normal mode warns and exits 0. `--strict` exits non-zero on missing source, stale pair, key mismatch, or placeholder mismatch. The checker remains independent of `.template-hashes.json`.

## 8. Documentation architecture

Add a bilingual Beta-only `advanced/localization` page and mirrored navigation entries. Update Beta configuration/roadmap/FAQ claims. Release docs remain frozen until GA.

The localization page is the coverage source of truth and explicitly distinguishes:

- managed files that switch during update;
- blank spec templates that apply only at creation;
- core Python messages;
- protocol-stable/deferred surfaces;
- TypeScript CLI output deferred beyond PR3.

## 9. Compatibility and rollback

### Compatibility

- `en` or absent language keeps English sources and current destination names.
- Missing Chinese source degrades to English.
- Hash keys remain landed paths; no hash-schema migration.
- Existing user specs are not rewritten.
- Python command names, flags, paths, JSON, channels, and exit codes remain unchanged.

### Rollback

- Removing a Chinese source causes automatic English fallback.
- Reverting Python call sites to literals does not require data migration; dictionaries are additive files.
- Docs routes can be removed without product runtime impact.
- No migration modifies user content.

## 10. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Recursive loader writes both locale files | English-canonical overlay + no-suffix map invariant |
| Locale cache contamination | Locale-keyed cache + sequential-locale test |
| Init/update disagreement | Shared resolver used by both paths + map equality tests |
| Spec translation overwrites user content | Keep update exclusion; document init-only blank specs |
| Python output breaks consumers | Protocol allowlist + subprocess channel/exit/schema tests |
| Translation drifts | Pair/key/placeholder drift checks |
| Beta docs leak into Release | Opposite-tree grep + mirrored Beta-only route test |

---

## Draft: `implement.md`

# Implementation plan: i18n PR3

## 0. Preconditions and safety

- [ ] Confirm PR2 is present and identify its locale propagation/selection API.
- [ ] Confirm task remains `planning`; do not run `task.py start` until artifact review.
- [ ] Snapshot root and `docs-site` dirty state; preserve unrelated work.
- [ ] Run GitNexus impact analysis for every function/class/method to be modified. Warn before any HIGH/CRITICAL edit.
- [ ] Re-run source inventories for bundled Markdown, spec `*.md.txt`, Python user-facing literals, and docs routes.

Rollback point: no edits if PR2’s dependency contract is unavailable.

## 1. Add failing structural/selection tests

- [ ] Add dynamic English/Chinese pair tests for bundled and spec source trees.
- [ ] Add logical destination/no-`.zh.` tests.
- [ ] Add missing-translation fallback fixtures.
- [ ] Add `en -> zh -> en` cache-isolation test.
- [ ] Update the spec `.md.txt` regression to allow `*.zh.md.txt` while rejecting bare orphan Markdown.

Rollback point: tests only.

## 2. Extend bundled recursive loading

- [ ] Reuse PR2’s locale contract in the bundled recursive loader.
- [ ] Make the English tree canonical and overlay translated Markdown by logical path.
- [ ] Keep non-localized files unchanged.
- [ ] Key caches by locale.
- [ ] Verify `resolveBundledSkills`, `writeSkills`, and `collectSkillTemplates` receive only unsuffixed paths.
- [ ] Exercise all platform collectors and representative configure paths.

Review gate: init and update maps are path/content equivalent for the same locale.

## 3. Add bundled-skill translations

- [ ] Translate both `SKILL.md` files.
- [ ] Translate all recursive `trellis-meta/references/**` files.
- [ ] Translate all `trellis-spec-bootstarp/references/**` files.
- [ ] Preserve frontmatter names, proper names, commands, code, paths, placeholders, and link targets.
- [ ] Run structural pair tests and drift check.

Review gate: no English file changed solely to support translation.

## 4. Localize spec templates

- [ ] Add `*.zh.md.txt` counterparts for all English spec sources.
- [ ] Add/reuse a locale-aware spec accessor/catalog.
- [ ] Pass `WorkflowOptions.language` into spec creation/writers.
- [ ] Preserve current live 16-file registration and keep the dormant cross-platform source dormant.
- [ ] Preserve backend/frontend/fullstack, monorepo, and remote-template branches.
- [ ] Add init integration assertions for representative Chinese specs and English fallback.
- [ ] Assert update does not rewrite existing `.trellis/spec/`.

Rollback point: remove localized catalog wiring; English exports remain compatible.

## 5. Migrate core Python messages

- [ ] Freeze an inventory of reachable core user-facing output and intentional exclusions.
- [ ] Call `set_locale()` at each core public entry before argparse/output.
- [ ] Move core prose to English dictionary keys in coherent namespaces.
- [ ] Add matching Chinese translations with identical placeholders.
- [ ] Keep protocol-safe literals, raw paths, JSON schema, channels, and exit codes unchanged.
- [ ] Do not localize persisted journal/index marker schemas, optional `linear_sync.py`, platform hooks, self-test/debug output, or invalid-locale bootstrap warning.
- [ ] Add subprocess tests for env/config/default priority, representative output, fallback, channels, exit codes, and stable protocol labels.
- [ ] Run Python 3.9 syntax/future-import audit and `pnpm lint:py`.

Review gate: compare English command output before/after for behavior and channel compatibility.

## 6. Extend i18n drift checking

- [ ] Recognize `*.zh.md.txt` counterparts correctly.
- [ ] Compare Python bundle keys.
- [ ] Compare format placeholders per key.
- [ ] Preserve warning-only default and strict failure behavior.
- [ ] Add checker tests for missing counterpart, stale source, key mismatch, placeholder mismatch, and clean state.

## 7. Update Beta documentation

- [ ] Add mirrored `beta/advanced/localization.mdx` pages.
- [ ] Add mirrored EN/ZH Beta routes in `docs.json` in identical order.
- [ ] Update mirrored Beta configuration pages with `language`.
- [ ] Update mirrored Beta roadmap pages from future promise to phased coverage.
- [ ] Audit mirrored Beta FAQ localization wording.
- [ ] Run opposite-tree grep to prove Release docs/routes did not receive Beta behavior.
- [ ] Run docs format and lint checks.

Submodule gate: commit docs-site changes inside the submodule before updating the root pointer during the later commit phase.

## 8. Full validation

```bash
pnpm --filter @mindfoldhq/trellis lint
pnpm --filter @mindfoldhq/trellis typecheck
pnpm --filter @mindfoldhq/trellis lint:py
pnpm --filter @mindfoldhq/trellis test
pnpm --filter @mindfoldhq/trellis i18n:check
pnpm --filter @mindfoldhq/trellis build

cd docs-site
pnpm format:check
pnpm lint
```

- [ ] Run representative real CLI smoke tests from built output for `en` and `zh`.
- [ ] Verify no landed/source map key unintentionally contains `.zh.`.
- [ ] Verify English sources were not edited except for necessary code/tests/docs references.
- [ ] Verify all intended Python call sites use `t()` or are on the explicit allowlist.
- [ ] Run `npx gitnexus detect-changes --scope all` and confirm only expected symbols/flows/files changed.
- [ ] Re-run `git status` in root and docs submodule; separate unrelated dirty files.

## 9. Review gate before implementation activation

- [ ] User reviews `prd.md`, `design.md`, `implement.md`, and context manifests.
- [ ] Only after approval, run `task.py start` in the implementing session.

---

## Draft: `implement.jsonl`

```jsonl
{"file":".trellis/spec/cli/backend/index.md","reason":"CLI/backend pre-development checklist and package rules."}
{"file":".trellis/spec/cli/backend/script-conventions.md","reason":"Python 3.9, stdlib-only, config, and i18n message contracts."}
{"file":".trellis/spec/cli/backend/quality-guidelines.md","reason":"TypeScript quality, source/audit discipline, and compatibility rules."}
{"file":".trellis/spec/cli/unit-test/index.md","reason":"Test commands and required unit/integration coverage."}
{"file":".trellis/spec/cli/unit-test/conventions.md","reason":"Dynamic inventories, meaningful assertions, and regression-test conventions."}
{"file":".trellis/spec/cli/unit-test/integration-patterns.md","reason":"Init/update filesystem integration-test patterns."}
{"file":".trellis/spec/docs-site/docs/index.md","reason":"Docs package entry checklist."}
{"file":".trellis/spec/docs-site/docs/sync-on-change.md","reason":"Beta/Release routing and bilingual docs synchronization contract."}
{"file":".trellis/spec/docs-site/docs/config-guidelines.md","reason":"Mintlify bilingual route and docs.json requirements."}
{"file":".trellis/spec/docs-site/docs/mdx-guidelines.md","reason":"MDX structure and validation constraints."}
{"file":".trellis/spec/docs-site/docs/style-guide.md","reason":"Technical docs voice and source-of-truth discipline."}
{"file":".trellis/spec/guides/index.md","reason":"Shared cross-layer and code-reuse thinking triggers."}
{"file":".trellis/tasks/07-27-i18n-bundled-python-pr3/research/bundled-and-spec-template-loading.md","reason":"Recursive loader, source inventory, locale overlay, and spec-template findings."}
{"file":".trellis/tasks/07-27-i18n-bundled-python-pr3/research/python-i18n-surface.md","reason":"Python message scope, protocol allowlist, and subprocess test requirements."}
{"file":".trellis/tasks/07-27-i18n-bundled-python-pr3/research/docs-routes-and-test-plan.md","reason":"Beta docs routes, stale claims, test matrix, and validation commands."}
```

---

## Draft: `check.jsonl`

```jsonl
{"file":".trellis/spec/cli/backend/script-conventions.md","reason":"Verify Python i18n, stdlib-only, locale, and output contracts."}
{"file":".trellis/spec/cli/backend/quality-guidelines.md","reason":"Verify code quality and cross-path audit completeness."}
{"file":".trellis/spec/cli/unit-test/index.md","reason":"Verify required checks and test layers."}
{"file":".trellis/spec/cli/unit-test/conventions.md","reason":"Verify tests are dynamic, non-tautological, and behavior-focused."}
{"file":".trellis/spec/cli/unit-test/integration-patterns.md","reason":"Verify init/update integration coverage and real filesystem behavior."}
{"file":".trellis/spec/docs-site/docs/sync-on-change.md","reason":"Verify Beta-only and mirrored EN/ZH docs changes."}
{"file":".trellis/spec/docs-site/docs/config-guidelines.md","reason":"Verify docs.json language routes and navigation parity."}
{"file":".trellis/spec/docs-site/docs/mdx-guidelines.md","reason":"Verify MDX syntax and frontmatter."}
{"file":".trellis/spec/docs-site/docs/style-guide.md","reason":"Verify technical documentation accuracy and scope."}
{"file":".trellis/tasks/07-27-i18n-bundled-python-pr3/research/bundled-and-spec-template-loading.md","reason":"Check logical path parity, fallback, cache, and source coverage."}
{"file":".trellis/tasks/07-27-i18n-bundled-python-pr3/research/python-i18n-surface.md","reason":"Check complete core Python migration and protocol exclusions."}
{"file":".trellis/tasks/07-27-i18n-bundled-python-pr3/research/docs-routes-and-test-plan.md","reason":"Check docs/test matrix and validation completeness."}
```
