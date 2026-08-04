# Continue Current Task

Resume work on the current task — pick up at the right phase/step in `.trellis/workflow.md`.

---

## Step 1: Load Current Context

```bash
{{PYTHON_CMD}} ./.trellis/scripts/get_context.py
```

Confirms: current task, git state, recent commits.

## Step 2: Load the Phase Index

```bash
{{PYTHON_CMD}} ./.trellis/scripts/get_context.py --mode phase
```

Shows the Phase Index (Plan / Execute / Finish) with routing + skill mapping.

## Step 3: Decide Where You Are

`get_context.py` shows the active task's `status` field. Route by `status` + artifact presence. This command replaces the user needing to remember the Trellis flow; it does not itself approve implementation.

- `status=planning` + no `prd.md` → **1.1** (load `trellis-brainstorm`)
- `status=planning` + `prd.md` present → run `task.py planning-status <task>`. A `pending` profile returns to **1.1**; derived `lightweight` can move to **1.4** review; derived `complex` returns to **1.1** until `design.md` + `implement.md` are complete.
- `status=planning` + complex artifacts complete + sub-agent jsonl not curated (only the seed `_example` row) → **1.3**
- `status=planning` + `planning-status` valid + required jsonl curated or inline mode → **1.4** (ask for start review). For `meta.ui=true`, also require the entry and preview declared by `prototype/manifest.json`, read the entry/current digest/status with `task.py prototype-status <task>`, show the latest prototype, and record confirmation with `task.py approve-prototype <task> <approval-evidence>` before `task.py start`.
- `status=in_progress` + implementation not started → **2.1**
- `status=in_progress` + implementation done, not yet checked → **2.2**
- `status=in_progress` + check passed → **3.3** (spec update) → **3.4** (commit)
- `status=completed` (rare; usually archived immediately) → archive flow

Phase rules (full detail in `.trellis/workflow.md`):

1. Run steps **in order** within a phase — `[required]` steps must not be skipped
2. `[once]` steps are already done if the required output exists. The persisted planning profile—not free-form judgment—derives the tier: `lightweight` may use only `prd.md`; `complex` also needs `design.md` and `implement.md`; `pending` cannot start.
3. You may go back to an earlier phase if discoveries require it

## Step 4: Load the Specific Step

Once you know which step to resume at:

```bash
{{PYTHON_CMD}} ./.trellis/scripts/get_context.py --mode phase --step <X.X> --platform {{CLI_FLAG}}
```

Follow the loaded instructions. After each `[required]` step completes, move to the next.

---

## Reference

Full workflow and detailed phase steps live in `.trellis/workflow.md`. This command is only an entry point — the canonical guidance is there.
