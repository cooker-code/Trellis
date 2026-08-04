"""UI prototype manifest validation and approval helpers.

The gate is deliberately opt-in: only ``task.json.meta.ui == \"true\"``
activates it, preserving historical task behavior.
"""

from __future__ import annotations

import hashlib
from pathlib import Path, PurePosixPath

from .io import read_json, write_json

MANIFEST_RELATIVE_PATH = "prototype/manifest.json"
PENDING_STATUS = "pending_user_approval"
APPROVED_STATUS = "approved"
TEXT_SUFFIXES = {
    ".css", ".cjs", ".html", ".htm", ".js", ".json", ".jsx", ".md",
    ".mjs", ".svg", ".ts", ".tsx", ".txt", ".vue", ".xml", ".yaml", ".yml",
}


def is_ui_task(task_data: dict) -> bool:
    """Return whether the explicit UI prototype contract is enabled."""
    meta = task_data.get("meta")
    return isinstance(meta, dict) and meta.get("ui") == "true"


def _is_within(path: Path, root: Path) -> bool:
    try:
        path.relative_to(root)
        return True
    except ValueError:
        return False


def _resolve_prototype_file(task_dir: Path, value: object) -> tuple[Path | None, str | None]:
    """Resolve a manifest path without allowing traversal or external links."""
    if not isinstance(value, str) or not value:
        return None, "invalid_path"
    relative = PurePosixPath(value)
    if relative.is_absolute() or any(part in ("", ".", "..") for part in relative.parts):
        return None, "path_outside_prototype"
    if not relative.parts or relative.parts[0] != "prototype":
        return None, "path_outside_prototype"

    prototype_root = task_dir / "prototype"
    candidate = task_dir.joinpath(*relative.parts)
    try:
        resolved_root = prototype_root.resolve(strict=True)
        resolved_candidate = candidate.resolve(strict=True)
    except OSError:
        return None, "missing_file"
    if not _is_within(resolved_candidate, resolved_root):
        return None, "path_outside_prototype"
    if not resolved_candidate.is_file():
        return None, "missing_file"
    return resolved_candidate, None


def _normalized_content(path: Path) -> bytes:
    """Normalize UTF-8 text line endings while preserving binary asset bytes."""
    content = path.read_bytes()
    if path.suffix.lower() not in TEXT_SUFFIXES:
        return content
    try:
        return content.decode("utf-8").replace("\r\n", "\n").encode("utf-8")
    except UnicodeDecodeError:
        return content


def compute_artifact_digest(task_dir: Path, manifest: dict) -> tuple[str | None, list[str]]:
    """Compute a stable digest for entry, preview, and optional asset files."""
    paths: list[object] = [manifest.get("entry"), manifest.get("preview")]
    assets = manifest.get("assets", [])
    if not isinstance(assets, list) or not all(isinstance(item, str) for item in assets):
        return None, ["invalid_assets"]
    paths.extend(assets)

    resolved: dict[str, Path] = {}
    errors: list[str] = []
    for value in paths:
        file_path, error = _resolve_prototype_file(task_dir, value)
        if error:
            errors.append(error)
            continue
        assert file_path is not None
        logical = PurePosixPath(value).as_posix()
        resolved[logical] = file_path
    if errors:
        return None, sorted(set(errors))

    digest = hashlib.sha256()
    for logical in sorted(resolved):
        digest.update(logical.encode("utf-8"))
        digest.update(b"\0")
        digest.update(_normalized_content(resolved[logical]))
        digest.update(b"\0")
    return f"sha256:{digest.hexdigest()}", []


def load_ui_manifest(task_dir: Path, task_data: dict) -> tuple[dict | None, list[str]]:
    """Load and validate the opt-in manifest location and v1 shape."""
    meta = task_data.get("meta")
    if not isinstance(meta, dict) or meta.get("prototype_manifest") != MANIFEST_RELATIVE_PATH:
        return None, ["invalid_manifest_path"]
    manifest_path = task_dir / "prototype" / "manifest.json"
    try:
        if not _is_within(manifest_path.resolve(strict=True), (task_dir / "prototype").resolve(strict=True)):
            return None, ["invalid_manifest_path"]
    except OSError:
        return None, ["invalid_manifest"]
    manifest = read_json(manifest_path)
    if not isinstance(manifest, dict):
        return None, ["invalid_manifest"]
    if manifest.get("version") != 1:
        return None, ["invalid_manifest_version"]
    if not isinstance(manifest.get("entry"), str) or not isinstance(manifest.get("preview"), str):
        return None, ["invalid_manifest"]
    return manifest, []


def validate_ui_prototype(task_dir: Path, task_data: dict) -> tuple[str | None, list[str]]:
    """Validate an enabled UI task and return its current digest or errors."""
    if not is_ui_task(task_data):
        return None, []
    manifest, errors = load_ui_manifest(task_dir, task_data)
    if errors:
        return None, errors
    assert manifest is not None
    digest, errors = compute_artifact_digest(task_dir, manifest)
    if errors:
        return None, errors
    assert digest is not None
    if manifest.get("status") != APPROVED_STATUS:
        return None, ["pending_approval"]
    if manifest.get("artifact_digest") != digest or manifest.get("approved_digest") != digest:
        return None, ["stale_approval"]
    evidence = manifest.get("approval_evidence")
    if not isinstance(evidence, str) or not evidence.strip():
        return None, ["missing_approval_evidence"]
    return digest, []


def approve_ui_prototype(task_dir: Path, task_data: dict, evidence: str) -> tuple[str | None, list[str]]:
    """Record explicit evidence and the digest of the currently viewable files."""
    if not is_ui_task(task_data):
        return None, ["not_ui_task"]
    if not evidence.strip():
        return None, ["missing_approval_evidence"]
    manifest, errors = load_ui_manifest(task_dir, task_data)
    if errors:
        return None, errors
    assert manifest is not None
    digest, errors = compute_artifact_digest(task_dir, manifest)
    if errors:
        return None, errors
    assert digest is not None
    manifest["artifact_digest"] = digest
    manifest["status"] = APPROVED_STATUS
    manifest["approved_digest"] = digest
    manifest["approval_evidence"] = evidence.strip()
    if not write_json(task_dir / "prototype" / "manifest.json", manifest):
        return None, ["manifest_write_failed"]
    return digest, []
