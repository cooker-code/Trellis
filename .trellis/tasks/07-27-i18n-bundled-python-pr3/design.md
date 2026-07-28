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
