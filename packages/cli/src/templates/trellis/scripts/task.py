#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Task Management Script.

Usage:
    python3 task.py create "<title>" [--slug <name>] [--assignee <dev>] [--priority P0|P1|P2|P3] [--parent <dir>] [--package <pkg>] [--no-start]
    python3 task.py add-context <dir> <file> <path> [reason] # Add jsonl entry
    python3 task.py validate <dir>              # Validate jsonl files
    python3 task.py list-context <dir>          # List jsonl entries
    python3 task.py start <dir>                 # Set active task
    python3 task.py current [--source] [--json] # Show active task
    python3 task.py finish                      # Clear active task
    python3 task.py set-branch <dir> <branch>   # Set git branch
    python3 task.py set-base-branch <dir> <branch>  # Set PR target branch
    python3 task.py set-scope <dir> <scope>     # Set scope for PR title
    python3 task.py set-meta <dir> <key> <value>  # Set a task metadata key
    python3 task.py archive <task-dir>          # Archive completed task
    python3 task.py list                        # List active tasks
    python3 task.py list-archive [month]        # List archived tasks
    python3 task.py add-subtask <parent-dir> <child-dir>     # Link child to parent
    python3 task.py remove-subtask <parent-dir> <child-dir>  # Unlink child from parent
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from common.i18n import set_locale, t
from common.log import Colors, colored
from common.paths import (
    DIR_WORKFLOW,
    DIR_TASKS,
    FILE_TASK_JSON,
    get_repo_root,
    get_developer,
    get_tasks_dir,
    get_current_task,
)
from common.active_task import (
    clear_active_task,
    resolve_active_task,
    resolve_context_key,
    set_active_task,
)
from common.io import read_json, write_json
from common.task_utils import resolve_task_dir, run_task_hooks
from common.tasks import iter_active_tasks, children_progress

# Import command handlers from split modules (also re-exports for plan.py compatibility)
from common.task_store import (
    cmd_create,
    cmd_archive,
    cmd_set_branch,
    cmd_set_base_branch,
    cmd_set_scope,
    cmd_set_meta,
    cmd_add_subtask,
    cmd_remove_subtask,
)
from common.task_context import (
    cmd_add_context,
    cmd_validate,
    cmd_list_context,
)
from common.document_metrics import (
    compare_documents,
    document_metrics,
    experiment_markdown_report,
    experiment_summary,
    load_experiment_records,
)


# =============================================================================
# Command: start / finish
# =============================================================================

def cmd_start(args: argparse.Namespace) -> int:
    """Set active task."""
    repo_root = get_repo_root()
    task_input = args.dir

    if not task_input:
        print(colored(t("task.start_required"), Colors.RED))
        return 1

    # Resolve task directory (supports task name, relative path, or absolute path)
    full_path = resolve_task_dir(task_input, repo_root)

    if not full_path.is_dir():
        print(colored(t("task.task_not_found", task=task_input), Colors.RED))
        print(t("task.task_lookup_hint"))
        return 1

    # Convert to relative path for storage
    try:
        task_dir = full_path.relative_to(repo_root).as_posix()
    except ValueError:
        task_dir = str(full_path)

    task_json_path = full_path / FILE_TASK_JSON

    if not resolve_context_key():
        # Degraded mode: no session identity available.
        # Hook didn't inject TRELLIS_CONTEXT_ID (common on Windows + Claude Code,
        # --continue resume path, fork distribution, hooks disabled, etc.). Skip
        # per-session pointer write; AI continues based on conversation context.
        print(colored(
            t("task.session_identity_unavailable"),
            Colors.YELLOW,
        ))
        print(colored(
            t("task.session_identity_hint"),
            Colors.YELLOW,
        ))

        # Still flip task.json status: planning → in_progress so downstream phases proceed.
        if task_json_path.is_file():
            data = read_json(task_json_path)
            if data and data.get("status") == "planning":
                data["status"] = "in_progress"
                if write_json(task_json_path, data):
                    print(colored(t("task.status_started_degraded"), Colors.GREEN))
            run_task_hooks("after_start", task_json_path, repo_root)
        return 0

    active = set_active_task(task_dir, repo_root)
    if active:
        print(colored(t("task.current_set", task=task_dir), Colors.GREEN))
        print(f"Source: {active.source}")

        if task_json_path.is_file():
            data = read_json(task_json_path)
            if data and data.get("status") == "planning":
                data["status"] = "in_progress"
                if write_json(task_json_path, data):
                    print(colored(t("task.status_started"), Colors.GREEN))

        print()
        print(colored(t("task.context_injection_hint"), Colors.BLUE))

        run_task_hooks("after_start", task_json_path, repo_root)
        return 0
    else:
        print(colored(t("task.set_current_failed"), Colors.RED))
        return 1


def cmd_finish(args: argparse.Namespace) -> int:
    """Clear active task."""
    repo_root = get_repo_root()
    active = clear_active_task(repo_root)
    current = active.task_path

    if not current:
        print(colored(t("task.no_current"), Colors.YELLOW))
        return 0

    # Resolve task.json path before clearing
    task_json_path = repo_root / current / FILE_TASK_JSON

    print(colored(t("task.current_cleared", task=current), Colors.GREEN))
    print(f"Source: {active.source}")

    if task_json_path.is_file():
        run_task_hooks("after_finish", task_json_path, repo_root)
    return 0


def cmd_current(args: argparse.Namespace) -> int:
    """Show active task."""
    repo_root = get_repo_root()
    active = resolve_active_task(repo_root)

    if getattr(args, "json", False):
        task_obj = None
        if active.task_path:
            data = read_json(repo_root / active.task_path / FILE_TASK_JSON) or {}
            task_obj = {
                "dir": active.task_path,
                "id": data.get("id") or data.get("name"),
                "title": data.get("title"),
                "status": data.get("status"),
                "parent": data.get("parent"),
                "children": data.get("children", []),
                "branch": data.get("branch"),
                "base_branch": data.get("base_branch"),
            }
        print(json.dumps({
            "current_task": task_obj,
            "source": active.source,
            "stale": active.stale,
        }, ensure_ascii=False))
        return 0 if active.task_path else 1

    if args.source:
        print(f"Current task: {active.task_path or '(none)'}")
        print(f"Source: {active.source}")
        if active.stale:
            print("State: stale")
        return 0 if active.task_path else 1

    if active.task_path:
        print(active.task_path)
        return 0

    return 1


def _print_document_result(payload: dict, as_json: bool) -> None:
    """Print a stable JSON payload or readable pretty JSON for document commands."""
    print(json.dumps(payload, ensure_ascii=False, indent=None if as_json else 2))


def cmd_document_metrics(args: argparse.Namespace) -> int:
    """Measure one Markdown document without modifying it."""
    try:
        text = Path(args.markdown).read_text(encoding="utf-8")
    except OSError as exc:
        print(t("task.document_read_error", error=exc), file=sys.stderr)
        return 1
    _print_document_result(document_metrics(text), args.json)
    return 0


def cmd_compare_documents(args: argparse.Namespace) -> int:
    """Compare native and reviewable Markdown documents without modifying them."""
    try:
        native_text = Path(args.native).read_text(encoding="utf-8")
        reviewable_text = Path(args.reviewable).read_text(encoding="utf-8")
    except OSError as exc:
        print(t("task.document_read_error", error=exc), file=sys.stderr)
        return 1
    _print_document_result(compare_documents(native_text, reviewable_text), args.json)
    return 0


def cmd_experiment_report(args: argparse.Namespace) -> int:
    """Validate experiment JSONL and print or explicitly write an aggregate report."""
    try:
        summary = experiment_summary(load_experiment_records(Path(args.results)))
    except (OSError, ValueError) as exc:
        print(t("task.experiment_read_error", error=exc), file=sys.stderr)
        return 1
    output = json.dumps(summary, ensure_ascii=False, indent=2) if args.format == "json" else experiment_markdown_report(summary)
    if args.output:
        try:
            Path(args.output).write_text(output + ("" if output.endswith("\n") else "\n"), encoding="utf-8")
        except OSError as exc:
            print(t("task.experiment_write_error", error=exc), file=sys.stderr)
            return 1
    else:
        print(output)
    return 0


# =============================================================================
# Command: list
# =============================================================================

def _display_status(t, all_statuses: dict) -> str:
    """Return the status label to show for a task in `list` output.

    A parent task's stored status stays "planning" until someone runs
    `task.py start` on the parent directly, even while its children are
    actively being worked — a misleading label for anyone scanning the
    list (#399 item 3). Show "active" instead when at least one child is
    past planning; the stored status.json value is left untouched.
    """
    if t.status == "planning" and t.children:
        child_in_flight = any(
            all_statuses.get(c) not in (None, "planning") for c in t.children
        )
        if child_in_flight:
            return "active"
    return t.status


def cmd_list(args: argparse.Namespace) -> int:
    """List active tasks."""
    repo_root = get_repo_root()
    tasks_dir = get_tasks_dir(repo_root)
    current_task = get_current_task(repo_root)
    developer = get_developer(repo_root)
    filter_mine = args.mine
    filter_status = args.status
    as_json = getattr(args, "json", False)

    # Single pass: collect all tasks via shared iterator
    all_tasks = {t.dir_name: t for t in iter_active_tasks(tasks_dir)}
    all_statuses = {name: t.status for name, t in all_tasks.items()}

    if as_json:
        if filter_mine and not developer:
            print(json.dumps({"error": "No developer set"}), file=sys.stderr)
            return 1

        items = []
        for dir_name in sorted(all_tasks.keys()):
            task = all_tasks[dir_name]
            if filter_mine and (task.assignee or "-") != developer:
                continue
            if filter_status and task.status != filter_status:
                continue
            items.append({
                "dir": f"{DIR_WORKFLOW}/{DIR_TASKS}/{dir_name}",
                "id": task.raw.get("id") or dir_name,
                "title": task.title,
                "status": task.status,
                "display_status": _display_status(task, all_statuses),
                "priority": task.priority,
                "assignee": task.assignee or None,
                "parent": task.parent,
                "children": list(task.children),
                "package": task.package,
            })
        print(json.dumps({"tasks": items}, ensure_ascii=False))
        return 0

    if filter_mine:
        if not developer:
            print(colored(t("task.no_developer"), Colors.RED), file=sys.stderr)
            return 1
        print(colored(t("task.my_tasks_header", developer=developer), Colors.BLUE))
    else:
        print(colored(t("task.all_tasks_header"), Colors.BLUE))
    print()

    # Display tasks hierarchically
    count = 0

    def _print_task(dir_name: str, indent: int = 0) -> None:
        nonlocal count
        task = all_tasks[dir_name]

        # Apply --mine filter
        if filter_mine and (task.assignee or "-") != developer:
            return

        # Apply --status filter
        if filter_status and task.status != filter_status:
            return

        relative_path = f"{DIR_WORKFLOW}/{DIR_TASKS}/{dir_name}"
        marker = ""
        if relative_path == current_task:
            marker = f" {colored(t('task.current_marker'), Colors.GREEN)}"

        # Children progress
        progress = children_progress(task.children, all_statuses)
        status_label = _display_status(task, all_statuses)

        # Package tag
        pkg_tag = f" @{task.package}" if task.package else ""

        prefix = "  " * indent + "  - "

        if filter_mine:
            print(f"{prefix}{dir_name}/ ({status_label}){pkg_tag}{progress}{marker}")
        else:
            print(f"{prefix}{dir_name}/ ({status_label}){pkg_tag}{progress} [{colored(task.assignee or '-', Colors.CYAN)}]{marker}")
        count += 1

        # Print children indented
        for child_name in task.children:
            if child_name in all_tasks:
                _print_task(child_name, indent + 1)

    # Display only top-level tasks: those without a parent, plus orphans
    # whose recorded parent is not (or no longer) in the active set — a
    # dangling parent ref must still render flat instead of disappearing.
    for dir_name in sorted(all_tasks.keys()):
        parent = all_tasks[dir_name].parent
        if not parent or parent not in all_tasks:
            _print_task(dir_name)

    if count == 0:
        if filter_mine:
            print(t("task.no_assigned", prefix="  "))
        else:
            print(t("task.no_active", prefix="  "))

    print()
    print(t("task.total", count=count))
    return 0


# =============================================================================
# Command: list-archive
# =============================================================================

def cmd_list_archive(args: argparse.Namespace) -> int:
    """List archived tasks."""
    repo_root = get_repo_root()
    tasks_dir = get_tasks_dir(repo_root)
    archive_dir = tasks_dir / "archive"
    month = args.month

    print(colored(t("task.archived_header"), Colors.BLUE))
    print()

    if month:
        month_dir = archive_dir / month
        if month_dir.is_dir():
            print(f"[{month}]")
            for d in sorted(month_dir.iterdir()):
                if d.is_dir():
                    print(f"  - {d.name}/")
        else:
            print(t("task.no_archives_for_month", month=month))
    else:
        if archive_dir.is_dir():
            for month_dir in sorted(archive_dir.iterdir()):
                if month_dir.is_dir():
                    month_name = month_dir.name
                    count = sum(1 for d in month_dir.iterdir() if d.is_dir())
                    print(t("task.archive_month_count", month=month_name, count=count))

    return 0


# =============================================================================
# Help
# =============================================================================

def show_usage() -> None:
    """Show usage help."""
    print(t("task.usage"))


# =============================================================================
# Main Entry
# =============================================================================

def main() -> int:
    """CLI entry point."""
    set_locale()

    # Deprecation guard: `init-context` was removed in v0.5.0-beta.12.
    # Detect early so argparse doesn't mask the real reason with a generic
    # "invalid choice" error.
    if len(sys.argv) >= 2 and sys.argv[1] == "init-context":
        print(
            colored(
                t("task.init_context_removed"),
                Colors.RED,
            ),
            file=sys.stderr,
        )
        print(
            t("task.init_context_seeded"),
            file=sys.stderr,
        )
        print(
            t("task.init_context_curated"),
            file=sys.stderr,
        )
        print(t("task.init_context_guidance"), file=sys.stderr)
        print(
            "  python3 ./.trellis/scripts/get_context.py --mode phase --step 1",
            file=sys.stderr,
        )
        print(
            t("task.init_context_append"),
            file=sys.stderr,
        )
        return 2

    parser = argparse.ArgumentParser(
        description=t("task.arg_description"),
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    subparsers = parser.add_subparsers(dest="command", help=t("task.arg_commands"))

    # create
    p_create = subparsers.add_parser("create", help=t("task.arg_create"))
    p_create.add_argument("title", help=t("task.arg_title"))
    p_create.add_argument("--slug", "-s", help=t("task.arg_slug"))
    p_create.add_argument("--assignee", "-a", help=t("task.arg_assignee"))
    p_create.add_argument("--priority", "-p", default="P2", help=t("task.arg_priority"))
    p_create.add_argument("--description", "-d", help=t("task.arg_task_description"))
    p_create.add_argument("--parent", help=t("task.arg_parent"))
    p_create.add_argument("--package", help=t("task.arg_package"))
    p_create.add_argument("--base-branch", help=t("task.arg_create_base_branch"))
    p_create.add_argument("--meta", action="append", help=t("task.arg_meta"))
    p_create.add_argument("--no-start", action="store_true", help=t("task.arg_no_start"))
    p_create.add_argument("--document-profile", choices=("native", "reviewable"), default="native", help=t("task.arg_document_profile"))

    p_metrics = subparsers.add_parser("document-metrics", help=t("task.arg_document_metrics"))
    p_metrics.add_argument("markdown", help=t("task.arg_markdown"))
    p_metrics.add_argument("--json", action="store_true", help=t("task.arg_json"))

    p_compare = subparsers.add_parser("compare-documents", help=t("task.arg_compare_documents"))
    p_compare.add_argument("native", help=t("task.arg_native_markdown"))
    p_compare.add_argument("reviewable", help=t("task.arg_reviewable_markdown"))
    p_compare.add_argument("--json", action="store_true", help=t("task.arg_json"))

    p_report = subparsers.add_parser("experiment-report", help=t("task.arg_experiment_report"))
    p_report.add_argument("results", help=t("task.arg_results_jsonl"))
    p_report.add_argument("--format", choices=("json", "markdown"), default="markdown", help=t("task.arg_report_format"))
    p_report.add_argument("--output", help=t("task.arg_output"))

    # add-context
    p_add = subparsers.add_parser("add-context", help=t("task.arg_add_context"))
    p_add.add_argument("dir", help=t("task.arg_dir"))
    p_add.add_argument("file", help=t("task.arg_jsonl"))
    p_add.add_argument("path", help=t("task.arg_path"))
    p_add.add_argument("reason", nargs="?", help=t("task.arg_reason"))

    # validate
    p_validate = subparsers.add_parser("validate", help=t("task.arg_validate"))
    p_validate.add_argument("dir", help=t("task.arg_dir"))

    # list-context
    p_listctx = subparsers.add_parser("list-context", help=t("task.arg_list_context"))
    p_listctx.add_argument("dir", help=t("task.arg_dir"))

    # start
    p_start = subparsers.add_parser("start", help=t("task.arg_start"))
    p_start.add_argument("dir", help=t("task.arg_dir"))

    # current
    p_current = subparsers.add_parser("current", help=t("task.arg_current"))
    p_current.add_argument("--source", action="store_true",
                           help=t("task.arg_source"))
    p_current.add_argument("--json", action="store_true", help=t("task.arg_json"))

    # finish
    subparsers.add_parser("finish", help=t("task.arg_finish"))

    # set-branch
    p_branch = subparsers.add_parser("set-branch", help=t("task.arg_set_branch"))
    p_branch.add_argument("dir", help=t("task.arg_dir"))
    p_branch.add_argument("branch", help=t("task.arg_branch"))

    # set-base-branch
    p_base = subparsers.add_parser("set-base-branch", help=t("task.arg_set_base"))
    p_base.add_argument("dir", help=t("task.arg_dir"))
    p_base.add_argument("base_branch", help=t("task.arg_base_branch"))

    # set-scope
    p_scope = subparsers.add_parser("set-scope", help=t("task.arg_set_scope"))
    p_scope.add_argument("dir", help=t("task.arg_dir"))
    p_scope.add_argument("scope", help=t("task.arg_scope"))

    # set-meta
    p_setmeta = subparsers.add_parser("set-meta", help=t("task.arg_set_meta"))
    p_setmeta.add_argument("dir", help=t("task.arg_dir"))
    p_setmeta.add_argument("key", help=t("task.arg_meta_key"))
    p_setmeta.add_argument("value", help=t("task.arg_meta_value"))

    # archive
    p_archive = subparsers.add_parser("archive", help=t("task.arg_archive"))
    p_archive.add_argument("name", help=t("task.arg_name"))
    p_archive.add_argument("--no-commit", action="store_true", help=t("task.arg_no_commit"))

    # list
    p_list = subparsers.add_parser("list", help=t("task.arg_list"))
    p_list.add_argument("--mine", "-m", action="store_true", help=t("task.arg_mine"))
    p_list.add_argument("--status", "-s", help=t("task.arg_status"))
    p_list.add_argument("--json", action="store_true", help=t("task.arg_json"))

    # add-subtask
    p_addsub = subparsers.add_parser("add-subtask", help=t("task.arg_add_subtask"))
    p_addsub.add_argument("parent_dir", help=t("task.arg_parent_dir"))
    p_addsub.add_argument("child_dir", help=t("task.arg_child_dir"))

    # remove-subtask
    p_rmsub = subparsers.add_parser("remove-subtask", help=t("task.arg_remove_subtask"))
    p_rmsub.add_argument("parent_dir", help=t("task.arg_parent_dir"))
    p_rmsub.add_argument("child_dir", help=t("task.arg_child_dir"))

    # list-archive
    p_listarch = subparsers.add_parser("list-archive", help=t("task.arg_list_archive"))
    p_listarch.add_argument("month", nargs="?", help=t("task.arg_month"))

    args = parser.parse_args()

    if not args.command:
        show_usage()
        return 1

    commands = {
        "create": cmd_create,
        "document-metrics": cmd_document_metrics,
        "compare-documents": cmd_compare_documents,
        "experiment-report": cmd_experiment_report,
        "add-context": cmd_add_context,
        "validate": cmd_validate,
        "list-context": cmd_list_context,
        "start": cmd_start,
        "current": cmd_current,
        "finish": cmd_finish,
        "set-branch": cmd_set_branch,
        "set-base-branch": cmd_set_base_branch,
        "set-scope": cmd_set_scope,
        "set-meta": cmd_set_meta,
        "archive": cmd_archive,
        "add-subtask": cmd_add_subtask,
        "remove-subtask": cmd_remove_subtask,
        "list": cmd_list,
        "list-archive": cmd_list_archive,
    }

    if args.command in commands:
        return commands[args.command](args)
    else:
        show_usage()
        return 1


if __name__ == "__main__":
    sys.exit(main())
