# i18n PR1-B: complete Chinese workflow

## Goal

Replace the PR1-A sample `workflow.zh.md` with a complete Chinese translation of the current bundled native workflow while preserving every machine-consumed contract, and prove that Chinese init/update/runtime paths behave the same as English.

## Requirements

### Translation scope

- Translate all human- and LLM-facing natural-language content in `packages/cli/src/templates/trellis/workflow.zh.md`, including headings, prose, table labels/cells, prompt examples, fenced-block comments, and HTML/Markdown comments.
- Use the current `packages/cli/src/templates/trellis/workflow.md` as the sole semantic source. Remove the PR1-A placeholder note and stale English body rather than incrementally translating the obsolete Chinese copy.
- Keep terminology consistent across the file. Preserve Trellis and platform proper names and stable Trellis domain terms where translating them would create ambiguous aliases.

### Protected content

- Preserve commands, flags, slash commands, paths, filenames, environment variables, JSON/YAML keys, code identifiers, status values, and quoted runtime literals exactly.
- Preserve all Phase/Step numbers and workflow qualifiers such as `[required · once]`, `[required · repeatable]`, `[optional · repeatable]`, and `[on demand]`.
- Preserve every `[workflow-state:STATUS]` opening/closing tag, STATUS value, platform marker, placeholder, code-fence language, and link target.
- Keep the English source byte-unchanged; Chinese remains a sibling `workflow.zh.md` source and lands as `.trellis/workflow.md` only through locale selection.

### Runtime compatibility

- Chinese Phase Index headings and Step titles must remain consumable by `get_context.py`, bundled Python workflow parsing, Python SessionStart hooks, Codex/Copilot SessionStart copies, OpenCode SessionStart context generation, and per-turn breadcrumb parsers.
- Runtime parsing must not add Chinese-specific heading literals. Locale-sensitive Phase Index boundaries must be derived from preserved workflow-state structure with backward compatibility for existing English/custom workflows.
- Breadcrumb STATUS pairing, platform filtering, Codex inline/sub-agent routing, and missing-structure fallback behavior must remain unchanged.

### Structural drift detection

- Extend i18n drift validation with content-based structural parity for the English/Chinese workflow pair, while retaining existing missing-counterpart and Git-recency checks.
- Structural parity must cover workflow-state tags, platform markers, numbered Steps and qualifiers, heading outline, code fences, inline technical spans, placeholders/XML-like tags, link targets, protected lexical tokens, and comment-block count.
- Drift remains warning-only by default and fails under `--strict`.
- Translation-completeness checks must reject the PR1-A placeholder and an English tail without rejecting intentional English proper names/identifiers.

### Integration coverage

- Verify `getWorkflowTemplate("zh")` returns the complete Chinese source and unsupported locales still fall back to exact English.
- Verify `trellis init --language zh` lands the exact Chinese workflow at `.trellis/workflow.md`, creates no locale-suffixed landed file, and records the Chinese landed hash under the locale-agnostic workflow key.
- Verify `trellis update` switches a pristine hash-tracked English workflow to Chinese based on selected project language, refreshes its hash, preserves user-owned config, and is idempotent on rerun.
- Verify compact Phase Index extraction, Step extraction, platform filtering, SessionStart overview generation, and breadcrumb emission against Chinese workflow content.
- Preserve all existing English init/update/runtime tests.

## Constraints

- Do not change the semantic workflow, required gates, routing decisions, or examples beyond translation and parser compatibility.
- Do not modify `packages/cli/src/templates/trellis/workflow.md`.
- Do not bypass `.template-hashes.json` conflict protection when switching locale.
- Distributed Python remains standard-library-only and Python 3.9 compatible.
- Planning only: do not start this task until `prd.md`, `design.md`, `implement.md`, and context manifests are reviewed.

## Out of Scope

- PR2 agents, common commands, or common skills.
- PR3 bundled skills, spec templates, or Python user-facing message migration.
- CLI TypeScript output/help translation.
- Platform-specific instruction-template translation.
- Marketplace workflow translation or new locales.
- README/docs-site changes unless separately requested.

## Acceptance Criteria

- [ ] `workflow.zh.md` is based on the current English source, contains Chinese content in every major section and numbered Step, and contains no PR1-A placeholder or stale English tail.
- [ ] English and Chinese workflow templates satisfy automated structural parity with category-specific diagnostics.
- [ ] All protected commands, paths, statuses, Phase/Step numbers, workflow-state tags, platform markers, placeholders, code fences, and link targets remain equivalent.
- [ ] Chinese Phase Index and Step content are returned correctly by `get_context.py --mode phase` and `--mode phase --step <X.Y>` with platform filtering.
- [ ] Shared Python, Codex, Copilot, and OpenCode SessionStart parsers produce a compact Chinese workflow overview without detailed Step bodies or duplicated workflow-state blocks.
- [ ] Python and OpenCode breadcrumb parsers emit Chinese workflow-state bodies verbatim and preserve fallback behavior.
- [ ] `init({ language: "zh" })` lands exact Chinese workflow bytes at `.trellis/workflow.md`; no `.zh.md` landed path/hash key exists.
- [ ] Same-version update changes a pristine English landed workflow to Chinese, refreshes `.trellis/workflow.md` hash to the Chinese bytes, preserves configured language, and is idempotent on rerun.
- [ ] Default English init/update output remains byte-compatible with the current English template.
- [ ] `pnpm run i18n:check`, lint, typecheck, focused tests, and the full test suite pass.
