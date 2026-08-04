"""Task Git delivery status and explicitly-authorized delivery actions."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from .git import run_git
from .io import read_json, write_json
from .paths import FILE_TASK_JSON, get_repo_root
from .task_utils import resolve_task_dir


SCHEMA_VERSION = "trellis-git-delivery.v1"
_DELIVERY_STATES = frozenset({
    "no_code_change", "uncommitted", "committed", "integration_pending",
    "integration_blocked", "integrated", "cleanup_pending", "retained", "unavailable",
})


def _ref(repo_root: Path, revision: str) -> str | None:
    """Resolve a local revision without contacting remotes."""
    rc, out, _ = run_git(["rev-parse", "--verify", "--quiet", revision], cwd=repo_root, timeout=5)
    return out.strip() if rc == 0 and out.strip() else None


def _is_ancestor(repo_root: Path, older: str, newer: str) -> bool | None:
    """Return ancestry, preserving command failures as unknown."""
    rc, _, _ = run_git(["merge-base", "--is-ancestor", older, newer], cwd=repo_root, timeout=5)
    if rc == 0:
        return True
    if rc == 1:
        return False
    return None


def _worktree_status(repo_root: Path, configured_path: object) -> dict[str, object]:
    """Return a conservative worktree fact; never probes arbitrary missing paths."""
    if not isinstance(configured_path, str) or not configured_path:
        return {"state": "not_recorded", "path": None, "dirty_count": None}
    candidate = Path(configured_path).expanduser()
    if not candidate.is_absolute():
        candidate = repo_root / candidate
    candidate = candidate.resolve()
    if not candidate.is_dir():
        return {"state": "missing", "path": str(candidate), "dirty_count": None}
    rc, out, _ = run_git(["status", "--porcelain"], cwd=candidate, timeout=5)
    if rc != 0:
        return {"state": "unavailable", "path": str(candidate), "dirty_count": None}
    return {
        "state": "present", "path": str(candidate),
        "dirty_count": len([line for line in out.splitlines() if line.strip()]),
    }


def _task_payload(task_dir: Path) -> dict[str, object] | None:
    data = read_json(task_dir / FILE_TASK_JSON)
    return data if isinstance(data, dict) else None


def _worktree_records(repo_root: Path) -> list[dict[str, str]] | None:
    """Parse local worktree registrations without pruning or modifying them."""
    rc, out, _ = run_git(["worktree", "list", "--porcelain"], cwd=repo_root, timeout=5)
    if rc != 0:
        return None
    records: list[dict[str, str]] = []
    current: dict[str, str] = {}
    for line in out.splitlines() + [""]:
        if not line:
            if current:
                records.append(current)
                current = {}
            continue
        key, _, value = line.partition(" ")
        current[key] = value
    return records


def _has_parallel_session(repo_root: Path, worktree_path: str) -> bool:
    """Fail closed only when another session explicitly owns this worktree.

    A normal runtime session stores ``current_task``.  Treating that value as
    a worktree lock would make cleanup impossible for the Task's own active
    session, so a lock must name the concrete worktree path instead.
    """
    sessions = repo_root / ".trellis" / ".runtime" / "sessions"
    if not sessions.is_dir():
        return False
    expected = str(Path(worktree_path).resolve())
    for session in sessions.glob("*.json"):
        try:
            data = read_json(session)
            if not isinstance(data, dict):
                return True
            paths = (data.get("worktree_path"), data.get("worktreePath"))
            if any(
                isinstance(value, str) and str(Path(value).expanduser().resolve()) == expected
                for value in paths
            ):
                return True
        except (OSError, RuntimeError):
            return True
    return False


def delivery_status(task_input: str | None) -> dict[str, object]:
    """Compute the read-only, versioned delivery receipt for one task."""
    repo_root = get_repo_root()
    task_dir = resolve_task_dir(task_input or "", repo_root)
    data = _task_payload(task_dir)
    task = {
        "id": task_dir.name,
        "status": data.get("status") if data else "unknown",
    }
    result: dict[str, object] = {
        "schema_version": SCHEMA_VERSION,
        "task": task,
        "repository": {"state": "unavailable"},
        "feature": {"branch": None, "head": None},
        "base": {"branch": None, "head": None},
        "worktree": {"state": "not_recorded", "path": None, "dirty_count": None},
        "cleanup": {"worktree": "not_recorded", "branch": "not_recorded"},
        "integration": {"state": "unavailable", "ahead": None, "behind": None, "conflict_state": "not_checked"},
        "remote": {"state": "not_checked", "pr_url": None},
        "evidence": ["local_task_json", "local_git_only"],
        "allowed_modes": [],
        "next_action": "inspect_task_metadata",
    }
    if data is None:
        return result
    rc, out, _ = run_git(["rev-parse", "--is-inside-work-tree"], cwd=repo_root, timeout=5)
    if rc != 0 or out.strip() != "true":
        result["next_action"] = "use_a_git_repository_or_retain_task"
        return result
    result["repository"] = {"state": "available"}
    feature = data.get("branch")
    base = data.get("base_branch")
    worktree = _worktree_status(repo_root, data.get("worktree_path"))
    result["worktree"] = worktree
    result["cleanup"] = {
        "worktree": "removed" if data.get("delivery_worktree_removed") else worktree["state"],
        "branch": "not_recorded",
    }
    result["remote"] = {"state": "not_checked", "pr_url": data.get("pr_url")}
    if not isinstance(feature, str) or not feature:
        result["integration"] = {"state": "no_code_change", "ahead": None, "behind": None, "conflict_state": "not_checked"}
        result["next_action"] = "archive_when_non_code_acceptance_is_complete"
        return result
    recorded_commit = data.get("commit")
    feature_head = _ref(repo_root, f"refs/heads/{feature}")
    recorded_head = _ref(repo_root, recorded_commit) if isinstance(recorded_commit, str) and recorded_commit else None
    task_commit = recorded_head or feature_head
    result["feature"] = {"branch": feature, "head": feature_head, "task_commit": task_commit}
    base_head = _ref(repo_root, f"refs/heads/{base}") if isinstance(base, str) and base else None
    result["base"] = {"branch": base if isinstance(base, str) else None, "head": base_head}
    cleanup = result["cleanup"]
    assert isinstance(cleanup, dict)
    cleanup["branch"] = "deleted" if data.get("delivery_branch_deleted") else ("present" if feature_head else "missing")
    if not feature_head:
        if data.get("delivery_retention_reason"):
            result["next_action"] = "restore_the_retained_feature_branch"
            return result
        if task_commit and base_head and _is_ancestor(repo_root, task_commit, base_head) is True:
            result["integration"] = {"state": "integrated", "ahead": 0, "behind": 0, "conflict_state": "clear"}
            result["next_action"] = "archive_delivery_receipt"
            return result
        result["integration"] = {"state": "unavailable", "ahead": None, "behind": None, "conflict_state": "not_checked"}
        result["next_action"] = "restore_or_record_feature_branch"
        return result
    if not task_commit or task_commit != feature_head:
        result["integration"] = {"state": "integration_blocked", "ahead": None, "behind": None, "conflict_state": "task_commit_mismatch"}
        result["allowed_modes"] = ["pr", "retain"]
        result["next_action"] = "restore_the_recorded_task_commit_or_choose_pr_or_retain"
        return result
    if worktree["state"] == "present" and worktree["dirty_count"]:
        result["integration"] = {"state": "uncommitted", "ahead": None, "behind": None, "conflict_state": "not_checked"}
        result["next_action"] = "return_to_phase_3_4_and_commit_worktree_changes"
        return result
    if data.get("delivery_retention_reason"):
        cleanup["branch"] = "retained"
        result["integration"] = {"state": "retained", "ahead": None, "behind": None, "conflict_state": "not_checked"}
        result["next_action"] = "retain_branch_and_follow_recorded_reason"
        return result
    if not isinstance(base, str) or not base:
        result["integration"] = {"state": "committed", "ahead": None, "behind": None, "conflict_state": "not_checked"}
        result["next_action"] = "record_base_branch_before_delivery"
        return result
    if not base_head:
        result["integration"] = {"state": "committed", "ahead": None, "behind": None, "conflict_state": "not_checked"}
        result["next_action"] = "restore_or_record_base_branch"
        return result
    integrated = _is_ancestor(repo_root, feature_head, base_head)
    if integrated is True:
        is_primary_worktree = worktree["state"] == "present" and worktree["path"] == str(repo_root.resolve())
        state = "cleanup_pending" if worktree["state"] == "present" and not is_primary_worktree else "integrated"
        result["integration"] = {"state": state, "ahead": 0, "behind": 0, "conflict_state": "clear"}
        result["next_action"] = "separately_authorize_worktree_or_branch_cleanup" if state == "cleanup_pending" else "archive_delivery_receipt"
        return result
    if integrated is None:
        result["next_action"] = "inspect_local_git_state"
        return result
    base_is_ancestor = _is_ancestor(repo_root, base_head, feature_head)
    rc, merge_preview, _ = run_git(["merge-tree", base_head, feature_head], cwd=repo_root, timeout=5)
    conflict = rc != 0 or "<<<<<<<" in merge_preview
    state = "integration_blocked" if conflict else "integration_pending"
    result["integration"] = {
        "state": state, "ahead": 1 if base_is_ancestor else None,
        "behind": 0 if base_is_ancestor else None,
        "conflict_state": "conflict" if conflict else "clear",
    }
    result["allowed_modes"] = ["local-merge", "pr", "retain"] if not conflict else ["pr", "retain"]
    result["next_action"] = "choose_delivery_mode" if not conflict else "resolve_conflict_or_choose_pr_or_retain"
    return result


def _print_receipt(receipt: dict[str, object], as_json: bool) -> None:
    if as_json:
        print(json.dumps(receipt, ensure_ascii=False, sort_keys=True))
        return
    integration = receipt["integration"]
    assert isinstance(integration, dict)
    print(f"Delivery state: {integration['state']}")
    print(f"Next action: {receipt['next_action']}")


def _blocked(args: argparse.Namespace, mode: str, reason: str, message: str) -> int:
    """Return one machine-readable refusal without exposing Git command output."""
    if args.json:
        print(json.dumps({
            "schema_version": SCHEMA_VERSION,
            "operation": {"mode": mode, "state": "blocked", "reason": reason},
        }, ensure_ascii=False, sort_keys=True))
    else:
        print(f"Error: {message}", file=sys.stderr)
    return 1


def cmd_delivery_status(args: argparse.Namespace) -> int:
    """Print a local-only delivery status receipt."""
    _print_receipt(delivery_status(args.task), args.json)
    return 0


def cmd_deliver(args: argparse.Namespace) -> int:
    """Perform one explicitly requested, bounded delivery action."""
    receipt = delivery_status(args.task)
    mode = args.mode
    if mode == "retain":
        repo_root = get_repo_root()
        task_dir = resolve_task_dir(args.task, repo_root)
        data = _task_payload(task_dir)
        if data is None:
            return _blocked(args, "retain", "task_metadata_unavailable", "task metadata is unavailable")
        reason = args.reason.strip() if isinstance(args.reason, str) else ""
        if not reason:
            return _blocked(args, "retain", "retention_reason_required", "retain requires --reason")
        feature = receipt.get("feature")
        if isinstance(feature, dict) and isinstance(feature.get("task_commit"), str):
            data["commit"] = feature["task_commit"]
        data["delivery_retention_reason"] = reason
        if not write_json(task_dir / FILE_TASK_JSON, data):
            return _blocked(args, "retain", "receipt_write_failed", "could not write delivery receipt")
        _print_receipt(delivery_status(args.task), args.json)
        return 0
    if mode == "pr":
        # This is deliberately a local dry-run boundary. Trellis has no
        # provider SDK in its shipped Python, so it never silently pushes.
        repo_root = get_repo_root()
        rc, remotes, _ = run_git(["remote"], cwd=repo_root, timeout=5)
        if rc != 0 or not remotes.strip():
            return _blocked(args, "pr", "remote_unavailable", "PR delivery blocked: no local remote is configured")
        receipt["operation"] = {"mode": "pr", "state": "dry_run", "dry_run": True, "push": False}
        receipt["next_action"] = "create_pr_or_mr_with_your_provider_then_record_pr_url"
        _print_receipt(receipt, args.json)
        return 0
    if not args.authorize:
        return _blocked(args, "local-merge", "authorization_required", "local-merge requires this invocation's --authorize flag")
    integration = receipt["integration"]
    assert isinstance(integration, dict)
    if integration["state"] != "integration_pending":
        return _blocked(args, "local-merge", "delivery_state_unavailable", f"local merge is unavailable while delivery state is {integration['state']}")
    feature = receipt["feature"]
    base = receipt["base"]
    assert isinstance(feature, dict) and isinstance(base, dict)
    repo_root = get_repo_root()
    rc, current_branch, _ = run_git(["branch", "--show-current"], cwd=repo_root, timeout=5)
    if rc != 0 or current_branch.strip() != base["branch"]:
        return _blocked(args, "local-merge", "target_branch_not_checked_out", "repository root must be cleanly checked out on the task base branch")
    rc, porcelain, _ = run_git(["status", "--porcelain"], cwd=repo_root, timeout=5)
    if rc != 0 or porcelain.strip():
        return _blocked(args, "local-merge", "dirty_target_worktree", "target worktree is dirty; local merge stopped without changes")
    task_commit = feature.get("task_commit")
    if not isinstance(task_commit, str) or task_commit != feature.get("head"):
        return _blocked(args, "local-merge", "task_commit_mismatch", "recorded task commit no longer matches the feature tip")
    rc, _, err = run_git(["merge", "--ff-only", task_commit], cwd=repo_root)
    if rc != 0:
        return _blocked(args, "local-merge", "fast_forward_failed", "local merge failed without fallback")
    receipt = delivery_status(args.task)
    integration = receipt["integration"]
    assert isinstance(integration, dict)
    if integration["state"] not in {"integrated", "cleanup_pending"}:
        return _blocked(args, "local-merge", "post_merge_verification_failed", "merge completed but post-merge ancestry verification failed")
    _print_receipt(receipt, args.json)
    return 0


def cmd_delivery_cleanup(args: argparse.Namespace) -> int:
    """Remove a registered worktree and/or merged branch with separate consent."""
    if not args.authorize or not (args.remove_worktree or args.delete_branch):
        return _blocked(args, "cleanup", "authorization_or_target_required", "cleanup requires --authorize and one explicit cleanup target")
    repo_root = get_repo_root()
    task_dir = resolve_task_dir(args.task, repo_root)
    data = _task_payload(task_dir)
    receipt = delivery_status(args.task)
    feature = receipt["feature"]
    worktree = receipt["worktree"]
    integration = receipt["integration"]
    assert isinstance(feature, dict) and isinstance(worktree, dict) and isinstance(integration, dict)
    if data is None or integration["state"] not in {"integrated", "cleanup_pending", "retained"}:
        return _blocked(args, "cleanup", "delivery_not_integrated", "cleanup requires an integrated or explicitly retained delivery receipt")
    if integration["state"] == "retained" and args.delete_branch:
        return _blocked(args, "cleanup", "retained_branch_preserved", "retained delivery must preserve its feature branch")
    path_value = worktree.get("path")
    records = _worktree_records(repo_root)
    if records is None:
        return _blocked(args, "cleanup", "worktree_registrations_unavailable", "worktree registrations are unavailable")
    if args.remove_worktree:
        matching = [record for record in records if record.get("worktree") == path_value]
        if len(matching) == 1 and "prunable" in matching[0]:
            return _blocked(args, "cleanup", "prunable_worktree_registration", "worktree registration is prunable; cleanup stopped")
        if worktree.get("state") != "present" or not isinstance(path_value, str):
            return _blocked(args, "cleanup", "recorded_worktree_missing", "recorded worktree is not present")
        if Path(path_value).resolve() == repo_root.resolve():
            return _blocked(args, "cleanup", "primary_worktree", "the primary worktree is never removed by delivery cleanup")
        if len(matching) != 1:
            return _blocked(args, "cleanup", "ambiguous_worktree_registration", "worktree registration is ambiguous; cleanup stopped")
        if (Path(path_value) / ".gitmodules").exists():
            return _blocked(args, "cleanup", "submodule_worktree", "submodule worktree requires manual cleanup")
        rc, branch, _ = run_git(["symbolic-ref", "--quiet", "--short", "HEAD"], cwd=Path(path_value), timeout=5)
        if rc != 0 or not branch.strip():
            return _blocked(args, "cleanup", "detached_head", "detached worktree requires manual cleanup")
        if _has_parallel_session(repo_root, path_value):
            return _blocked(args, "cleanup", "parallel_session_reference", "parallel session references this task/worktree")
        if worktree.get("dirty_count"):
            return _blocked(args, "cleanup", "dirty_worktree", "worktree is dirty; cleanup stopped without force")
        rc, _, err = run_git(["worktree", "remove", path_value], cwd=repo_root)
        if rc != 0:
            return _blocked(args, "cleanup", "worktree_remove_failed", "worktree removal failed")
        data["delivery_worktree_removed"] = True
        if not write_json(task_dir / FILE_TASK_JSON, data):
            return _blocked(args, "cleanup", "worktree_receipt_write_failed", "worktree was removed but its receipt could not be written")
        records = _worktree_records(repo_root)
        if records is None:
            return _blocked(args, "cleanup", "worktree_registrations_unavailable", "worktree registrations are unavailable after removal")
    if args.delete_branch:
        branch_name = feature.get("branch")
        branch_head = feature.get("head")
        base = receipt["base"]
        assert isinstance(base, dict)
        if not isinstance(branch_name, str) or not isinstance(branch_head, str) or not isinstance(base.get("head"), str):
            return _blocked(args, "cleanup", "feature_or_base_unavailable", "feature/base references are unavailable")
        if _is_ancestor(repo_root, branch_head, str(base["head"])) is not True:
            return _blocked(args, "cleanup", "feature_not_integrated", "feature branch is not proven integrated")
        if any(record.get("branch") == f"refs/heads/{branch_name}" for record in records):
            return _blocked(args, "cleanup", "feature_branch_checked_out", "feature branch is checked out by a worktree")
        data["commit"] = branch_head
        if not write_json(task_dir / FILE_TASK_JSON, data):
            return _blocked(args, "cleanup", "branch_receipt_write_failed", "branch cleanup receipt could not be written")
        rc, _, err = run_git(["branch", "-d", branch_name], cwd=repo_root)
        if rc != 0:
            return _blocked(args, "cleanup", "branch_delete_failed", "branch deletion failed")
        data["delivery_branch_deleted"] = True
        if not write_json(task_dir / FILE_TASK_JSON, data):
            return _blocked(args, "cleanup", "branch_deleted_receipt_write_failed", "branch was deleted but its receipt could not be written")
    _print_receipt(delivery_status(args.task), args.json)
    return 0
