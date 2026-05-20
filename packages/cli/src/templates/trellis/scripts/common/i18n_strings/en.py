"""English (default) string bundle for Trellis Python scripts.

Authoritative source for translation keys — the ``zh.py`` bundle should
mirror this dict's keys.
"""

from __future__ import annotations

STRINGS: dict[str, str] = {
    # init_developer.py
    "init_developer.usage": "Usage: {script} <developer-name>",
    "init_developer.example_label": "Example:",
    "init_developer.example_command": "  {script} john",
    "init_developer.already_initialized": "Developer already initialized: {name}",
    "init_developer.reinit_hint": "To reinitialize, remove {dir}/{file} first",
}
