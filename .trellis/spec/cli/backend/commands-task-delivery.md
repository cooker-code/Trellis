# Task Git Delivery Commands

## 1. Scope / Trigger

Use this contract when changing Task Git delivery status, local integration,
retention, worktree/branch cleanup, or the `finish-work` orchestration that
decides whether a Task may be archived.

The shipped source of truth is
`packages/cli/src/templates/trellis/scripts/common/delivery.py`; its dogfood
twin is `.trellis/scripts/common/delivery.py`. The twins must remain equal.
`task.py finish` is outside the delivery write boundary: it only clears the
current Session pointer and preserves `after_finish` hook semantics.

## 2. Signatures

```text
python3 ./.trellis/scripts/task.py delivery-status [task] [--json]
python3 ./.trellis/scripts/task.py deliver <task> \
  --mode local-merge|pr|retain [--authorize] [--reason TEXT] [--json]
python3 ./.trellis/scripts/task.py delivery-cleanup <task> \
  [--remove-worktree] [--delete-branch] --authorize [--json]
```

- `delivery-status` is read-only and never fetches, merges, pushes, prunes, or
  deletes.
- `local-merge` requires `--authorize` in the current invocation.
- `pr` is a local dry-run boundary. It reports prerequisites and never pushes
  or contacts a provider.
- `retain` requires a non-empty `--reason` and records
  `delivery_retention_reason` in `task.json`.
- cleanup targets are independent. Each invocation requires `--authorize` and
  at least one of `--remove-worktree` or `--delete-branch`.

## 3. Contracts

JSON receipts use `schema_version: "trellis-git-delivery.v1"`. A successful
`delivery-status --json` emits exactly one JSON object to stdout with:

```json
{
  "schema_version": "trellis-git-delivery.v1",
  "task": {"id": "example", "status": "in_progress"},
  "repository": {"state": "available"},
  "feature": {"branch": "feature/example", "head": "sha", "task_commit": "sha"},
  "base": {"branch": "main", "head": "sha"},
  "worktree": {"state": "present", "path": "/local/path", "dirty_count": 0},
  "cleanup": {"worktree": "present", "branch": "present"},
  "integration": {"state": "integration_pending", "ahead": 1, "behind": 0, "conflict_state": "clear"},
  "remote": {"state": "not_checked", "pr_url": null},
  "evidence": ["local_task_json", "local_git_only"],
  "allowed_modes": ["local-merge", "pr", "retain"],
  "next_action": "choose_delivery_mode"
}
```

The integration state is one of `no_code_change`, `uncommitted`, `committed`,
`integration_pending`, `integration_blocked`, `integrated`,
`cleanup_pending`, `retained`, or `unavailable`.

JSON refusals return exit code `1` and exactly one safe object:

```json
{
  "schema_version": "trellis-git-delivery.v1",
  "operation": {
    "mode": "cleanup",
    "state": "blocked",
    "reason": "dirty_worktree"
  }
}
```

Receipts may expose the local worktree path to the local CLI user. They must
not expose credentials, remote URLs, full Git output, diffs, commands, or file
contents to logs or external consumers.

## 4. Validation & Error Matrix

| Condition | Required result |
|---|---|
| Feature tip differs from recorded Task commit | `integration_blocked` with `task_commit_mismatch`; no merge |
| Task worktree is dirty | `uncommitted`; finish-work stops before archive |
| Feature is not a base ancestor and preview is clear | `integration_pending`; allow merge, PR dry-run, or retain |
| Preview reports a conflict | `integration_blocked`; allow only PR dry-run or retain |
| Base contains the verified feature tip | `integrated`, or `cleanup_pending` for an extra registered worktree |
| `local-merge` lacks current `--authorize` | exit `1`, `authorization_required` |
| Base worktree is dirty or not checked out | exit `1`; no merge |
| PR dry-run has no local remote | exit `1`, `remote_unavailable`; no network or Push |
| Retain lacks a reason | exit `1`; do not change Task metadata |
| Cleanup targets the primary worktree | exit `1`, `primary_worktree` |
| Worktree is dirty, detached, a submodule, prunable, ambiguous, or held by an explicit parallel Session | exit `1` with the matching stable reason; never force-remove |
| Retained delivery requests branch deletion | exit `1`, `retained_branch_preserved` |
| Feature is not proven integrated or is checked out elsewhere | exit `1`; preserve the branch |
| Authorized cleanup succeeds | persist the verified commit and cleanup facts; later status remains auditable even after the feature ref is deleted |
| Historical non-Git or no-code Task | degrade to `unavailable` or `no_code_change`; finish-work may archive only after non-code acceptance |

After `local-merge`, recompute delivery status and prove the verified Task
commit is an ancestor of base. A zero merge exit code alone is insufficient.
After removing a worktree, re-read registrations before evaluating branch
deletion in the same invocation.

## 5. Good / Base / Bad Cases

- Good: a clean feature tip equals `task.json.commit`; current base is clean;
  `local-merge --authorize` fast-forwards and the post-merge receipt reports
  `integrated` or `cleanup_pending`.
- Base: a historical Task has no branch or worktree metadata; status returns
  `no_code_change`/`unavailable` without breaking archival compatibility.
- Bad: an old configuration implies merge permission, or a caller asks to
  remove a dirty/detached/prunable worktree. The command must ignore historical
  permission and fail closed without `--force`.

## 6. Tests Required

Use real temporary Git repositories and linked worktrees. Assert both the
receipt and the absence/presence of Git side effects:

- uncommitted, committed/pending, conflict, integrated, retained, non-Git, and
  missing-field status paths;
- Task commit mismatch keeps base unchanged;
- PR dry-run emits one JSON line and does not change HEAD or contact a remote;
- dirty target blocks local merge;
- submodule, detached HEAD, prunable registration, explicit parallel Session,
  dirty worktree, and same-branch worktree each hit their specific reason;
- authorized worktree removal and branch deletion are separate, and the
  combined path refreshes worktree registrations;
- template registration installs `common/delivery.py`, and dogfood/template
  twins remain equal;
- existing `task.py finish`, `after_finish`, archive, and `after_archive`
  regressions remain unchanged.

## 7. Wrong vs Correct

### Wrong

```text
task.py finish
# Assume the Task commit is now on main and delete its worktree/branch.
```

`finish` only clears a Session pointer. It proves neither integration nor safe
cleanup.

### Correct

```text
task.py delivery-status <task> --json
task.py deliver <task> --mode local-merge --authorize --json
task.py delivery-status <task> --json
task.py delivery-cleanup <task> --remove-worktree --authorize --json
task.py delivery-cleanup <task> --delete-branch --authorize --json
```

Every write is explicitly authorized in the current invocation, and each
claim is verified by a fresh local receipt.
