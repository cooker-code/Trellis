#!/usr/bin/env python3
"""
Developer management utilities.

Provides:
    init_developer     - Initialize developer
    ensure_developer   - Ensure developer is initialized (exit if not)
    show_developer_info - Show developer information
"""

from __future__ import annotations

import sys
from datetime import datetime
from pathlib import Path

from .i18n import t
from .paths import (
    DIR_WORKFLOW,
    DIR_WORKSPACE,
    DIR_TASKS,
    FILE_DEVELOPER,
    FILE_JOURNAL_PREFIX,
    get_repo_root,
    get_developer,
    check_developer,
)


# =============================================================================
# Developer Initialization
# =============================================================================

def init_developer(name: str, repo_root: Path | None = None) -> bool:
    """Initialize developer.

    Creates:
        - .trellis/.developer file with developer info
        - .trellis/workspace/<name>/ directory structure
        - Initial journal file and index.md

    Args:
        name: Developer name.
        repo_root: Repository root path. Defaults to auto-detected.

    Returns:
        True on success, False on error.
    """
    if not name:
        print(t("developer.name_required"), file=sys.stderr)
        return False

    if repo_root is None:
        repo_root = get_repo_root()

    dev_file = repo_root / DIR_WORKFLOW / FILE_DEVELOPER
    workspace_dir = repo_root / DIR_WORKFLOW / DIR_WORKSPACE / name

    # Create .developer file
    initialized_at = datetime.now().isoformat()
    try:
        dev_file.write_text(
            f"name={name}\ninitialized_at={initialized_at}\n",
            encoding="utf-8"
        )
    except (OSError, IOError) as e:
        print(t("developer.file_create_failed", error=e), file=sys.stderr)
        return False

    # Create workspace directory structure
    try:
        workspace_dir.mkdir(parents=True, exist_ok=True)
    except (OSError, IOError) as e:
        print(t("developer.workspace_create_failed", error=e), file=sys.stderr)
        return False

    # Create initial journal file
    journal_file = workspace_dir / f"{FILE_JOURNAL_PREFIX}1.md"
    if not journal_file.exists():
        today = datetime.now().strftime("%Y-%m-%d")
        journal_content = f"""# Journal - {name} (Part 1)

> AI development session journal
> Started: {today}

---

"""
        try:
            journal_file.write_text(journal_content, encoding="utf-8")
        except (OSError, IOError) as e:
            print(t("developer.journal_create_failed", error=e), file=sys.stderr)
            return False

    # Create index.md with markers for auto-update
    index_file = workspace_dir / "index.md"
    if not index_file.exists():
        index_content = f"""# Workspace Index - {name}

> Journal tracking for AI development sessions.

---

## Current Status

<!-- @@@auto:current-status -->
- **Active File**: `journal-1.md`
- **Total Sessions**: 0
- **Last Active**: -
<!-- @@@/auto:current-status -->

---

## Active Documents

<!-- @@@auto:active-documents -->
| File | Lines | Status |
|------|-------|--------|
| `journal-1.md` | ~0 | Active |
<!-- @@@/auto:active-documents -->

---

## Session History

<!-- @@@auto:session-history -->
| # | Date | Title | Commits | Branch |
|---|------|-------|---------|--------|
<!-- @@@/auto:session-history -->

---

## Notes

- Sessions are appended to journal files
- New journal file created when current exceeds 2000 lines
- Use `add_session.py` to record sessions
"""
        try:
            index_file.write_text(index_content, encoding="utf-8")
        except (OSError, IOError) as e:
            print(t("developer.index_create_failed", error=e), file=sys.stderr)
            return False

    print(t("developer.initialized", name=name))
    print(t("developer.file_path", path=dev_file))
    print(t("developer.workspace_path", path=workspace_dir))

    return True


def ensure_developer(repo_root: Path | None = None) -> None:
    """Ensure developer is initialized, exit if not.

    Args:
        repo_root: Repository root path. Defaults to auto-detected.
    """
    if repo_root is None:
        repo_root = get_repo_root()

    if not check_developer(repo_root):
        print(t("developer.not_initialized_error"), file=sys.stderr)
        print(t("developer.initialize_hint", workflow=DIR_WORKFLOW), file=sys.stderr)
        sys.exit(1)


def show_developer_info(repo_root: Path | None = None) -> None:
    """Show developer information.

    Args:
        repo_root: Repository root path. Defaults to auto-detected.
    """
    if repo_root is None:
        repo_root = get_repo_root()

    developer = get_developer(repo_root)

    if not developer:
        print(t("developer.info_not_initialized"))
    else:
        print(t("developer.info_name", name=developer))
        print(t("developer.info_workspace", workflow=DIR_WORKFLOW, workspace=DIR_WORKSPACE, developer=developer))
        print(t("developer.info_tasks", workflow=DIR_WORKFLOW, tasks=DIR_TASKS))


# =============================================================================
# Main Entry (for testing)
# =============================================================================

if __name__ == "__main__":
    show_developer_info()
