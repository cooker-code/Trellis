#!/usr/bin/env python3
"""
Trellis Python-side i18n.

Lightweight string-dictionary translator for user-facing prints in
Python scripts (task.py / init_developer.py / add_session.py / ...).

Design notes (see PR1 research/config-and-python-i18n.md §5):

- Locale resolution priority:
  ``TRELLIS_LANGUAGE`` env > ``language`` in ``.trellis/config.yaml`` > ``"en"``
- Dictionaries live in ``i18n_strings/{en,zh}.py`` as plain ``STRINGS`` dicts.
  Lazy-imported on first ``set_locale`` / ``t`` call.
- Missing key → fall back to English bundle → final fall back is the key
  itself (acts as a visible diagnostic, never raises).
- stdlib only. Compatible with Python 3.9 (uses
  ``from __future__ import annotations`` for PEP 604 forward refs).
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any

from .config import DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES, get_language


_current_locale: str = DEFAULT_LANGUAGE
_loaded_strings: dict[str, dict[str, str]] = {}  # locale -> {key: str}


def _resolve_locale(repo_root: Path | None = None) -> str:
    """Resolve active locale from env / config.yaml / default."""
    env = os.environ.get("TRELLIS_LANGUAGE", "").strip().lower()
    if env in SUPPORTED_LANGUAGES:
        return env
    return get_language(repo_root)


def set_locale(code: str | None = None, repo_root: Path | None = None) -> str:
    """Activate a locale for the running script.

    Call once at script entry. ``code`` (when provided) takes top priority and
    is mostly used by tests; production scripts pass nothing and rely on
    :func:`_resolve_locale`.

    Returns the active locale code (caller may log it for debugging).
    Invalid codes silently degrade to ``"en"``.
    """
    global _current_locale
    if code is not None:
        target = str(code).strip().lower()
    else:
        target = _resolve_locale(repo_root)
    if target not in SUPPORTED_LANGUAGES:
        target = DEFAULT_LANGUAGE
    _current_locale = target
    _ensure_loaded(target)
    return target


def get_locale() -> str:
    """Return the currently active locale code."""
    return _current_locale


def t(key: str, **kwargs: Any) -> str:
    """Translate a message key.

    - Substitutes ``{name}`` placeholders via ``str.format``.
    - Falls back to English if the active locale lacks ``key``.
    - Falls back to the key itself if even English lacks it (visible
      diagnostic, never raises).
    """
    _ensure_loaded(_current_locale)
    bundle = _loaded_strings.get(_current_locale, {})
    raw = bundle.get(key)
    if raw is None and _current_locale != DEFAULT_LANGUAGE:
        _ensure_loaded(DEFAULT_LANGUAGE)
        raw = _loaded_strings.get(DEFAULT_LANGUAGE, {}).get(key)
    if raw is None:
        return key  # last-resort: return the key as visible diagnostic
    if kwargs:
        try:
            return raw.format(**kwargs)
        except (KeyError, IndexError):
            return raw
    return raw


def _ensure_loaded(locale: str) -> None:
    if locale in _loaded_strings:
        return
    if locale == "zh":
        try:
            from .i18n_strings.zh import STRINGS  # type: ignore[import-not-found]
        except ImportError:
            _loaded_strings[locale] = {}
            return
    else:
        try:
            from .i18n_strings.en import STRINGS  # type: ignore[import-not-found]
        except ImportError:
            _loaded_strings[locale] = {}
            return
    _loaded_strings[locale] = dict(STRINGS)


def _reset_for_tests() -> None:
    """Reset module-level state (test-only helper)."""
    global _current_locale
    _current_locale = DEFAULT_LANGUAGE
    _loaded_strings.clear()
