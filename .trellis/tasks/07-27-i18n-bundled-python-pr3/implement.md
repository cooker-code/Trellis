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
