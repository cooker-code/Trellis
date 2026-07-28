#!/usr/bin/env python3
"""
Get current developer name.

This is a wrapper that uses common/paths.py
"""

from __future__ import annotations

import sys

from common.i18n import set_locale, t
from common.paths import get_developer


def main() -> None:
    """CLI entry point."""
    set_locale()
    developer = get_developer()
    if developer:
        print(developer)
    else:
        print(t("get_developer.not_initialized"), file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
