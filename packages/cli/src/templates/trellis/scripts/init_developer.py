#!/usr/bin/env python3
"""
Initialize developer for workflow.

Usage:
    python3 init_developer.py <developer-name>

This creates:
    - .trellis/.developer file with developer info
    - .trellis/workspace/<name>/ directory structure
"""

from __future__ import annotations

import sys

from common.paths import (
    DIR_WORKFLOW,
    FILE_DEVELOPER,
    get_developer,
)
from common.developer import init_developer
from common.i18n import set_locale, t


def main() -> None:
    """CLI entry point."""
    set_locale()  # reads TRELLIS_LANGUAGE env / config.yaml / default "en"

    if len(sys.argv) < 2:
        print(t("init_developer.usage", script=sys.argv[0]))
        print()
        print(t("init_developer.example_label"))
        print(t("init_developer.example_command", script=sys.argv[0]))
        sys.exit(1)

    name = sys.argv[1]

    # Check if already initialized
    existing = get_developer()
    if existing:
        print(t("init_developer.already_initialized", name=existing))
        print()
        print(t("init_developer.reinit_hint", dir=DIR_WORKFLOW, file=FILE_DEVELOPER))
        sys.exit(0)

    if init_developer(name):
        sys.exit(0)
    else:
        sys.exit(1)


if __name__ == "__main__":
    main()
