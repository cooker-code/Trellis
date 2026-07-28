# Research: PR1-B workflow runtime parser audit

- **Query**: Inspect every runtime consumer of `workflow.md` before fully translating `workflow.zh.md`.
- **Scope**: internal
- **Date**: 2026-07-27

## Findings

### Current source state

- Canonical English source: `packages/cli/src/templates/trellis/workflow.md` (710 lines).
- Chinese source: `packages/cli/src/templates/trellis/workflow.zh.md` (700 lines).
- The Chinese file is still the PR1-A sample: only the opening sections are translated, an explicit placeholder comment remains, and the rest is an older English workflow body.
- The Chinese copy is structurally stale: it lacks current English sections such as `Request Triage`, `Planning Artifacts`, `Parent / Child Task Trees`, `Active Task Routing`, and `Guardrails`; its marker count also differs (30 platform marker lines versus 26 in English).
- `.trellis/workflow.md` currently matches the packaged English source byte-for-byte. It is not the Chinese source.

### Runtime-safe structures already language-neutral

| Consumer | Structure | Why Chinese prose is safe |
|---|---|---|
| `shared-hooks/inject-workflow-state.py` | `[workflow-state:STATUS]...[/workflow-state:STATUS]` | Regex keys only on preserved tags (`:170-203`). Bodies are emitted verbatim. |
| `opencode/plugins/inject-workflow-state.js` | Same workflow-state tags | Same tag/backreference contract (`:32-98`). |
| `workflow_phase.py:get_step` | `#### <X.Y>` | `_STEP_HEADING_RE` keys on the preserved numeric Step id, not the English title (`:34`, `:100-126`). |
| `workflow_phase.py:filter_platform` | `[Platform A, ...]` markers | Marker values are explicitly preserved (`:31`, `:47-60`, `:171-205`). |

The breadcrumb bodies, step titles, prose, tables, examples, and comments can therefore be translated without affecting these consumers, provided workflow-state tags, Step ids, and platform markers remain exact.

### Language-coupled Phase Index consumers

Five shipped parser paths currently depend on exact English headings:

1. `packages/cli/src/templates/trellis/scripts/common/workflow_phase.py`
   - `_PHASE_INDEX_HEADING = "## Phase Index"` at `:38`.
   - End boundary is exact `"## Phase 1: Plan"` at `:80`.
2. `packages/cli/src/templates/shared-hooks/session-start.py`
   - `_build_workflow_overview` calls `_extract_range(content, "Phase Index", "Phase 1: Plan")` at `:714`.
3. `packages/cli/src/templates/codex/hooks/session-start.py`
   - Same exact call at `:461`.
4. `packages/cli/src/templates/copilot/hooks/session-start.py`
   - Same exact call at `:466`.
5. `packages/cli/src/templates/opencode/lib/session-utils.js`
   - Exact comparisons at `:399-404`.

If `## Phase Index` and `## Phase 1: Plan` are translated, these paths return an empty Phase Index overview. Step-specific extraction still works because Step numbers remain stable.

### Recommended parser compatibility strategy

The delegated scope requires translation of all natural-language headings while preserving Phase/Step **numbers**, not the English labels. Treating the two English headings as permanently untranslated would weaken “full Chinese translation” and keep a locale-specific parser contract. Prefer a language-neutral boundary algorithm:

1. Find the exact preserved opening tag `[workflow-state:no_task]`.
2. Scan backward to the nearest level-2 Markdown heading (`## `); this is the Phase Index start.
3. Scan forward to the next level-2 heading; this is the start of the detailed Phase 1 walkthrough and therefore the exclusive end.
4. Preserve the existing exact-English lookup as a backward-compatible first path or fallback for custom workflows that omit `no_task`.
5. If neither anchor exists, preserve current failure behavior (empty overview / existing caller fallback).

This avoids modifying the English source (important for upstream merges), does not hardcode Chinese labels, and supports future locales as long as workflow-state tags retain their documented machine syntax.

The standalone hook copies should use equivalent logic rather than introducing a cross-file import refactor in PR1-B. The hooks are distributed artifacts with deliberately self-contained parsing code.

### Parser behavior that must remain unchanged

- Workflow-state STATUS charset stays `[A-Za-z0-9_-]+` and opening/closing tags use the same STATUS backreference.
- `get_step("X.Y")` still terminates at the next `####`, `##`, or horizontal rule.
- Platform matching remains case-insensitive and separator-insensitive.
- Codex `planning-inline` / `in_progress-inline` selection is unchanged.
- SessionStart still strips breadcrumb blocks, HTML comments, and platform marker lines from the compact overview.
- Missing/malformed workflow structures retain visible fallback behavior rather than receiving a hidden translated fallback dictionary.
- The English workflow remains byte-unchanged.

## Existing tests affected

- Runtime Phase Index and SessionStart tests are concentrated in `packages/cli/test/regression.test.ts:3364-3574`; they currently assert English output only.
- OpenCode SessionStart parsing is covered through `packages/cli/test/templates/opencode.test.ts` and should gain one Chinese-source case if the JS boundary logic changes.
- Breadcrumb parser tests around `packages/cli/test/regression.test.ts:2696-2965` remain valid because tags are preserved.
- `packages/cli/test/templates/trellis.test.ts` asserts English semantic phrases and should continue to use the legacy English export; Chinese parity checks should be additive.

## Caveats

- A generic “first H2 / second H2” parser is too weak; anchor on `[workflow-state:no_task]` so front matter or introductory H2 sections cannot shift the range.
- Do not translate or rename `[workflow-state:no_task]`; it becomes both a breadcrumb key and the locale-neutral Phase Index anchor.
- `# Development Workflow - Session Summary` and other hook-generated wrapper text are outside PR1-B content scope; only the workflow-derived body becomes Chinese.
- Parser changes trigger the project’s workflow-state contract review requirement. Consult `.trellis/spec/cli/backend/workflow-state-contract.md` before implementation.
