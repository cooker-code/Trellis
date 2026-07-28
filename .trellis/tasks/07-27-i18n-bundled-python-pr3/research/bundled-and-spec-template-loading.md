# Research: bundled-skill recursion and spec-template localization

- **Query**: Inspect bundled-skills recursive loading, Markdown spec templates, locale propagation, fallback behavior, and relevant tests for i18n PR3.
- **Scope**: Internal code and tests
- **Date**: 2026-07-27

## Findings

### Bundled skills are recursive and currently locale-blind

The canonical loader is `packages/cli/src/templates/common/index.ts`:

- `listDirectories("bundled-skills")` discovers skill roots.
- `listBundledSkillFiles(skillDir)` recursively walks every file below each root, reads every file as UTF-8, and returns paths relative to the skill directory.
- `getBundledSkillTemplates()` caches one global result in `cachedBundledSkills`.
- `packages/cli/src/configurators/shared.ts:resolveBundledSkills()` flattens those files and resolves placeholders.
- Every platform configurator and update collector consumes `resolveBundledSkills()`.

Adding `foo.zh.md` without changing the recursive loader would therefore install **both** `foo.md` and `foo.zh.md` into every managed platform skill directory. The locale selector must operate before `ResolvedSkillFile` paths are assembled.

### Current bundled-skill inventory

There are 27 English Markdown files and no Chinese counterparts:

| Skill | English Markdown files | Notes |
|---|---:|---|
| `trellis-meta` | 22 | `SKILL.md` plus recursive `references/{customize-local,local-architecture,platform-files}/**` |
| `trellis-spec-bootstarp` | 5 | `SKILL.md` plus four files under `references/` |
| **Total** | **27** | About 124 KB |

`trellis-spec-bootstarp` is the shipped technical identifier, including its spelling. It must not be renamed as part of translation.

### Required recursive selection contract

Use the PR2 locale-selection API rather than creating another locale resolver. PR3 needs the following behavior from the existing common-template layer:

1. Treat the English file tree as the canonical logical destination set.
2. For locale `zh`, overlay `foo.zh.md` onto logical destination `foo.md` when the counterpart exists.
3. If `foo.zh.md` is missing, silently use `foo.md`.
4. Never return or write a destination containing `.zh.`.
5. Preserve non-localized assets/files as-is.
6. Cache by locale, not in one process-global singleton; otherwise a first English call can poison a later Chinese init/update in the same process.
7. Produce byte-identical maps for init and update paths so `.template-hashes.json` remains keyed by unsuffixed landed paths.
8. Ignore/report an orphan translation that has no English source; do not make the translation itself a new landed file.

The current GitNexus graph reports LOW risk for `getBundledSkillTemplates` and `resolveBundledSkills`, but the graph misses their filesystem-driven fan-out. Repository search shows `resolveBundledSkills` is used by all 14 platform configurators/collectors, so practical integration risk is broader than the graph indicates.

### Translation invariants for bundled skills

Translate natural-language headings, paragraphs, tables, instructions, and frontmatter `description`. Preserve exactly:

- frontmatter `name` values;
- skill IDs (`trellis-meta`, `trellis-spec-bootstarp`);
- Trellis, GitNexus, ABCoder, Claude Code, Cursor, Codex, Pi, and other proper names;
- commands, flags, environment variables, paths, JSON/JSONL keys, status values, code identifiers, and placeholders;
- code-fence bodies and fence language tags;
- relative link targets and reference paths.

`trellis-spec-bootstarp/SKILL.md` has four Markdown links to `references/*.md`. `trellis-meta/SKILL.md` lists reference paths mostly as inline code. Translation must keep all targets byte-stable.

## Spec-template findings

### Inventory and live/dormant distinction

`packages/cli/src/templates/markdown/spec/` contains 17 English `*.md.txt` sources (about 104 KB):

- backend: 6
- frontend: 7
- guides: 4

`packages/cli/src/templates/markdown/index.ts` exports and `configurators/workflow.ts` lands only 16 of them. `guides/cross-platform-thinking-guide.md.txt` is present in the source tree but is not imported or created. PR3 should translate all 17 sources to satisfy source-tree coverage, but must not activate the dormant cross-platform guide as an unrelated behavior change.

The existing regression test at `packages/cli/test/regression.test.ts` requires every file under the spec-template tree to end in `.md.txt`. The parallel Chinese naming convention should therefore be:

```text
index.md.txt       -> index.zh.md.txt
foo.md.txt         -> foo.zh.md.txt
```

The final `.txt` is a packaging/source marker; the locale suffix belongs before the semantic `.md` extension. The drift detector currently does not recognize this compound suffix and must be extended.

### Current spec data flow

- `packages/cli/src/templates/markdown/index.ts` eagerly reads fixed English paths into module-level constants.
- `packages/cli/src/configurators/workflow.ts:createWorkflowStructure()` already resolves `options.language` for `workflow.md`.
- That language is **not** passed into `createSpecTemplates`, `writeSpecForType`, `writeBackendDocs`, or `writeFrontendDocs`.
- Spec files are created only during init/re-init template creation. Update deliberately treats `.trellis/spec/` as user-owned and does not overwrite it.
- Remote spec packages bypass local blank templates and must continue to do so under `zh`.

### Recommended spec loader shape

Create one locale-aware Markdown-template accessor/catalog in `templates/markdown/index.ts`, while retaining existing English exports if compatibility requires them. The catalog should map each live logical destination to its English source and select `*.zh.md.txt` with English fallback. Then pass the already-resolved `WorkflowOptions.language` through the spec-writing functions.

Do not add another config reader or change CLI language precedence in PR3. `utils/i18n.ts`, `--language`, `TRELLIS_LANGUAGE`, and the common locale propagation are PR2/PR1 dependencies.

### Spec translation invariants

Translate all human/LLM prose, tables, checklists, and HTML/Markdown comments. Preserve:

- relative links and destination file names;
- fenced code, commands, paths, identifiers, placeholders such as `{{PYTHON_CMD}}`, and platform marker tokens;
- Markdown marker structures and comment delimiters;
- the same live/dormant registration set as English.

The English footer `Language: ... English` should be translated to state that the generated Chinese template should be maintained in Chinese.

## Tests affected

1. Add source-pair coverage for 27 bundled Markdown files and 17 spec `*.md.txt` files.
2. Add logical-path tests: locale output maps never contain `.zh.` and have the same destination set as English.
3. Add fallback tests for missing translations.
4. Add locale-keyed cache regression: resolve `en`, then `zh`, then `en` in one process.
5. Exercise both configure/write and collect/update paths; all 14 platform maps should satisfy the no-suffix invariant.
6. Add a representative init integration test proving Chinese spec content lands under the normal unsuffixed `.trellis/spec/**` path.
7. Keep remote-template and backend/frontend project-type behavior unchanged.
8. Update the existing `*.md.txt` regression wording/assertion to explicitly allow both `*.md.txt` and `*.zh.md.txt` while rejecting bare `.md` files.

## Impact summary

- GitNexus: `createSpecTemplates` has one direct upstream caller (`createWorkflowStructure`), LOW risk.
- Practical bundled-skill fan-out: 14 platform configurators/collectors plus init/update hash tracking; integration tests are mandatory despite LOW graph risk.

## Caveats

- Current bundled recursion reads all files as UTF-8. PR3 only adds Markdown translations and should not refactor future binary-asset support.
- Changing `language` after init must not rewrite user-customized `.trellis/spec/`; documentation must explain that Chinese blank specs apply to newly generated specs, while bundled platform skills switch on `trellis update`.
