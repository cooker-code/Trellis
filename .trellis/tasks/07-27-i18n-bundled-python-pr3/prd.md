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
