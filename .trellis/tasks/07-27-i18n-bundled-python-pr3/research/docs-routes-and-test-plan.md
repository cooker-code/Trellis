# Research: docs routes, roadmap, and test plan

- **Query**: Inspect documentation route needs, existing i18n claims, and validation commands for i18n PR3.
- **Scope**: docs-site, repository specs, package scripts, and existing tests
- **Date**: 2026-07-27

## Docs-site version scope

The checked-out docs-site has only Release navigation; it has no Beta version or `beta/**` tree. The confirmed low-intrusion decision is to add localization to the existing mirrored Release Advanced routes:

- `docs-site/advanced/**`
- `docs-site/zh/advanced/**`

Do not create a Beta version and do not copy the Release Use Cases, Marketplace, or Community shared groups. `docs-site/docs.json` must retain matching EN/ZH Release Advanced order.

## Recommended documentation deliverables

### New bilingual Release localization page

Add:

- `docs-site/advanced/localization.mdx`
- `docs-site/zh/advanced/localization.mdx`

Add each immediately after its existing Release configuration page in `docs-site/docs.json`, using the same order in both languages.

The page should document:

1. `language: en|zh` and `--language en|zh`.
2. Priority: one-shot CLI flag / `TRELLIS_LANGUAGE` / config / English default.
3. `trellis init` and `trellis update` as the actual materialization commands; there is no `trellis sync` command.
4. Locale-suffixed sources always land at normal unsuffixed paths.
5. Missing Chinese translations fall back to English.
6. `.template-hashes.json` remains keyed by landed paths.
7. Bundled skills switch on init/update.
8. Blank spec templates are localized only when newly generated; existing `.trellis/spec/` is user-owned and update does not rewrite it.
9. Python core CLI-message coverage and explicit exclusions/protocol-stable outputs.
10. A coverage roadmap table showing completed PR1-B, PR2, PR3 and deferred TypeScript CLI/platform-specific content.
11. Translation policy: preserve proper names and technical identifiers.

### Update existing Release pages

- `docs-site/advanced/configuration.mdx`
- `docs-site/zh/advanced/configuration.mdx`

Both currently omit the already-shipped `language` key. Add the key/default/accepted values, materialization behavior, fallback, and a link to the localization page.

- `docs-site/advanced/roadmap.mdx`
- `docs-site/zh/advanced/roadmap.mdx`

Both still list Chinese localization as a future v0.7 item. Replace that claim with current phased status and link to the localization page, while keeping CLI TypeScript output clearly deferred.

- Audit `docs-site/advanced/appendix-f.mdx` and its Chinese mirror. The current FAQ says built-in localization is “partially shipped and on the roadmap”; update it for PR3.

## Documentation style constraints

- Every MDX page needs title and description frontmatter.
- EN and ZH routes/file structure must mirror each other.
- Commands, code blocks, paths, flags, and identifiers remain English.
- Keep callouts structurally valid; do not put Markdown bullet lists inside callouts.
- Open with the concrete behavior and commands, not product narrative.
- `docs-site` is a submodule. Implementation should commit docs inside the submodule first, then update the root submodule pointer in the code commit flow.

## Existing tests and gaps

### Existing i18n tests

- `packages/cli/test/utils/i18n.test.ts`: TypeScript config/env resolution.
- `packages/cli/test/commands/init.integration.test.ts`: English workflow by default and Chinese workflow under `--language zh`.
- No Python `t()` integration tests.
- No bundled-skill locale tests.
- No spec-template locale tests.
- No Python dictionary parity/placeholder checks.

### Existing affected tests

- `packages/cli/test/configurators/platforms.test.ts` counts/resolves bundled skills across platforms and checks representative references.
- `packages/cli/test/regression.test.ts` enforces the spec-source `.md.txt` invariant.
- `packages/cli/test/templates/trellis.test.ts` checks script maps and workflow templates.
- `packages/cli/test/commands/init.integration.test.ts` checks actual init writes.
- Update integration tests and template-hash tests protect init/update/hash parity.

## Recommended test matrix

| # | Scenario | Verification |
|---:|---|---|
| 1 | Bundled loader, `en` | English content, canonical unsuffixed destination paths |
| 2 | Bundled loader, `zh` | Chinese content, same destination set, no `.zh.md` leaked |
| 3 | Bundled missing translation | English fallback at canonical destination |
| 4 | Locale cache sequence | `en -> zh -> en` returns the correct bytes each time |
| 5 | All platform collectors | Every map has canonical paths; shared/bundled content follows active locale |
| 6 | Init with `zh` | Representative bundled `SKILL.md`/reference and spec files are Chinese |
| 7 | Update language switch | Pristine managed bundled files switch locale and hashes remain under unsuffixed paths |
| 8 | Spec project types | Backend/frontend/fullstack and monorepo output sets remain unchanged |
| 9 | Remote specs | Remote packages still bypass local blank templates |
| 10 | Source-pair structure | 27 bundled + 17 spec translations have English counterparts and protected-token parity |
| 11 | Python resolver/fallback | Explicit/env/config/default priority and `zh -> en -> key` fallback |
| 12 | Python representative commands | Chinese prose with unchanged exit code/stdout/stderr behavior |
| 13 | Python protocols | `task.py current --source`, raw path outputs, and JSON keys stay stable |
| 14 | Drift checker | Compound `*.zh.md.txt`, missing source, stale source, key mismatch, placeholder mismatch |
| 15 | Docs navigation | EN/ZH Release routes exist in matching order; no Beta version or shared-group copy is added |

## Validation commands

From repository root:

```bash
pnpm --filter @mindfoldhq/trellis lint
pnpm --filter @mindfoldhq/trellis typecheck
pnpm --filter @mindfoldhq/trellis lint:py
pnpm --filter @mindfoldhq/trellis test
pnpm --filter @mindfoldhq/trellis i18n:check
pnpm --filter @mindfoldhq/trellis build
```

From `docs-site/`:

```bash
pnpm format:check
pnpm lint
```

Confirm the checked-out docs-site still has no Beta version and that only mirrored Release Advanced routes were added.

## GitNexus and pre-commit gate

Future implementation must run symbol impact analysis before changing each function/class/method. Before committing, run:

```bash
npx gitnexus detect-changes --scope all
```

The current CLI supports `detect-changes`; use the exact CLI help if option names differ at implementation time.

## Caveats

- `docs-site` is already a dirty submodule pointer in the caller’s working tree; implementation must not overwrite or absorb unrelated submodule work.
- The current `check-i18n-drift.js` is warning-only unless `--strict` is supplied.
