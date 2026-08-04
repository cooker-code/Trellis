"""Versioned planning-contract validation for Trellis tasks.

Only tasks with ``task.json.meta.planning_contract_version == "2"`` opt in.
Historical and system-created tasks therefore retain their existing behavior.
"""

from __future__ import annotations

import re
from pathlib import Path

from .io import read_json

PLANNING_CONTRACT_VERSION = "2"
PROFILE_FIELDS: tuple[str, ...] = (
    "interaction_change",
    "data_model_change",
    "public_contract_change",
    "cross_layer_change",
    "state_lifecycle_change",
    "security_compatibility_rollout_change",
    "technical_tradeoff",
)
BOOLEAN_VALUES = {"true", "false"}
UI_BLOCK_START = "<!-- ui-prototype:START -->"
UI_BLOCK_END = "<!-- ui-prototype:END -->"
PENDING_DIGEST = "pending"

_REQUIREMENT_TYPES = (
    "Add|Change|Remove|Preserve|Boundary|"
    "新增|修改|删除|保持不变|边界"
)
_GROUP_RE = re.compile(rf"^###\s+R(\d+)\s+({_REQUIREMENT_TYPES})\s*$", re.MULTILINE)
_REQUIREMENT_RE = re.compile(r"^-\s+\*\*R(\d+\.\d+)(?:\s+[^*]+)?\*\*", re.MULTILINE)
_OUTCOME_RE = re.compile(
    r"^-\s+\[[ xX]\]\s+\*\*O(\d+)\s*[（(]([^）)]*)[）)]\*\*",
    re.MULTILINE,
)
_PLACEHOLDER_RE = re.compile(r"\bTBD\b|待补充|replace this placeholder", re.IGNORECASE)


def uses_planning_contract(task_data: dict) -> bool:
    """Return whether a task explicitly opts into planning contract v2."""
    meta = task_data.get("meta")
    return (
        isinstance(meta, dict)
        and meta.get("planning_contract_version") == PLANNING_CONTRACT_VERSION
    )


def derive_planning_tier(meta: dict[str, str]) -> str:
    """Derive a tier solely from the seven explicit complexity answers."""
    values = [meta.get(field) for field in PROFILE_FIELDS]
    if any(value not in BOOLEAN_VALUES for value in values):
        return "pending"
    if any(value == "true" for value in values):
        return "complex"
    return "lightweight"


def seed_planning_meta(meta: dict[str, str]) -> dict[str, str]:
    """Add v2 defaults to user metadata without discarding custom keys."""
    seeded = dict(meta)
    seeded["planning_contract_version"] = PLANNING_CONTRACT_VERSION
    seeded.setdefault("ui", "false")
    for field in PROFILE_FIELDS:
        seeded.setdefault(field, "unknown")
    seeded["planning_tier"] = derive_planning_tier(seeded)
    return seeded


def apply_planning_profile(
    task_data: dict, values: dict[str, str]
) -> tuple[dict | None, list[str]]:
    """Return updated raw task data after validating a complete profile."""
    if set(values) != set(PROFILE_FIELDS):
        return None, ["profile_incomplete"]
    if any(value not in BOOLEAN_VALUES for value in values.values()):
        return None, ["profile_invalid_boolean"]
    meta = task_data.get("meta")
    if not isinstance(meta, dict):
        meta = {}
    updated_meta = seed_planning_meta({**meta, **values})
    updated = dict(task_data)
    updated["meta"] = updated_meta
    return updated, []


def _section(content: str, names: tuple[str, ...]) -> tuple[int, int, str] | None:
    pattern = re.compile(
        r"^##\s+(?:" + "|".join(re.escape(name) for name in names) + r")\s*$",
        re.MULTILINE,
    )
    match = pattern.search(content)
    if not match:
        return None
    next_heading = re.search(r"^##\s+", content[match.end():], re.MULTILINE)
    end = match.end() + next_heading.start() if next_heading else len(content)
    return match.start(), end, content[match.end():end]


def render_ui_prototype_block(
    *, locale: str, entry: str, preview: str, status: str, digest: str | None
) -> str:
    """Render the machine-owned UI reference inside User-visible Outcomes."""
    shown_digest = digest or PENDING_DIGEST
    if locale == "zh":
        body = (
            f"- [ ] **O-PROTOTYPE** 当前原型：[主入口]({entry})；\n"
            f"  预览：![原型预览]({preview})；\n"
            f"  `prototype status: {status}`；`digest: {shown_digest}`。"
        )
    else:
        body = (
            f"- [ ] **O-PROTOTYPE** Current prototype: [entry]({entry});\n"
            f"  preview: ![prototype preview]({preview});\n"
            f"  `prototype status: {status}`; `digest: {shown_digest}`."
        )
    return f"{UI_BLOCK_START}\n{body}\n{UI_BLOCK_END}"


def sync_ui_prototype_block(
    task_dir: Path, *, entry: str, preview: str, status: str, digest: str | None
) -> list[str]:
    """Replace only the managed block; never rewrite author-owned PRD content."""
    prd_path = task_dir / "prd.md"
    try:
        content = prd_path.read_text(encoding="utf-8")
    except OSError:
        return ["prd_missing"]
    locale = "zh" if "## 用户可见结果" in content else "en"
    desired = render_ui_prototype_block(
        locale=locale, entry=entry, preview=preview, status=status, digest=digest
    )
    pattern = re.compile(
        re.escape(UI_BLOCK_START) + r"[\s\S]*?" + re.escape(UI_BLOCK_END)
    )
    matches = list(pattern.finditer(content))
    if len(matches) != 1:
        return ["ui_prototype_block_missing" if not matches else "ui_prototype_block_duplicate"]
    updated = pattern.sub(desired, content, count=1)
    try:
        prd_path.write_text(updated, encoding="utf-8")
    except OSError:
        return ["prd_write_failed"]
    return []


def ui_prototype_block_current(
    task_dir: Path, *, entry: str, preview: str, status: str, digest: str | None
) -> bool:
    """Check the managed block against an expected current prototype state."""
    try:
        content = (task_dir / "prd.md").read_text(encoding="utf-8")
    except OSError:
        return False
    locale = "zh" if "## 用户可见结果" in content else "en"
    expected = render_ui_prototype_block(
        locale=locale, entry=entry, preview=preview, status=status, digest=digest
    )
    outcome = _section(content, ("User-visible Outcomes", "用户可见结果"))
    return outcome is not None and outcome[2].count(expected) == 1


def _validate_prd(task_dir: Path, task_data: dict) -> tuple[dict, list[str]]:
    try:
        content = (task_dir / "prd.md").read_text(encoding="utf-8")
    except OSError:
        return {}, ["prd_missing"]

    errors: list[str] = []
    goal = _section(content, ("Goal", "目标"))
    requirements = _section(content, ("Requirements", "需求"))
    outcomes = _section(content, ("User-visible Outcomes", "用户可见结果"))
    if not goal or not requirements or not outcomes:
        return {}, ["prd_sections_missing"]
    if not (goal[0] < requirements[0] < outcomes[0]):
        errors.append("prd_section_order")
    if not re.search(r"^\s*1\.\s+", goal[2], re.MULTILINE):
        errors.append("goal_not_ordered")

    groups = list(_GROUP_RE.finditer(requirements[2]))
    requirement_ids = [f"R{item}" for item in _REQUIREMENT_RE.findall(requirements[2])]
    if not groups or not requirement_ids:
        errors.append("requirements_not_numbered")
    else:
        if len({group.group(1) for group in groups}) != len(groups):
            errors.append("requirement_group_duplicate")
        if len(set(requirement_ids)) != len(requirement_ids):
            errors.append("requirement_id_duplicate")
        group_ids = {group.group(1) for group in groups}
        if any(item[1:].split(".", 1)[0] not in group_ids for item in requirement_ids):
            errors.append("requirement_group_mismatch")

    outcome_matches = list(_OUTCOME_RE.finditer(outcomes[2]))
    if not outcome_matches:
        errors.append("outcomes_not_mapped")
    outcome_ids = [match.group(1) for match in outcome_matches]
    if len(set(outcome_ids)) != len(outcome_ids):
        errors.append("outcome_id_duplicate")
    known_requirements = set(requirement_ids)
    for match in outcome_matches:
        references = set(re.findall(r"R\d+\.\d+", match.group(2)))
        if not references or not references.issubset(known_requirements):
            errors.append("outcome_reference_invalid")
            break
    if _PLACEHOLDER_RE.search(requirements[2]) or _PLACEHOLDER_RE.search(outcomes[2]):
        errors.append("prd_placeholder")

    meta = task_data.get("meta") if isinstance(task_data.get("meta"), dict) else {}
    if meta.get("ui") == "true":
        manifest = read_json(task_dir / "prototype" / "manifest.json")
        if (
            isinstance(manifest, dict)
            and manifest.get("version") == 1
            and isinstance(manifest.get("entry"), str)
            and isinstance(manifest.get("preview"), str)
            and isinstance(manifest.get("status"), str)
            and manifest["entry"].startswith("prototype/")
            and manifest["preview"].startswith("prototype/")
            and ".." not in Path(manifest["entry"]).parts
            and ".." not in Path(manifest["preview"]).parts
        ):
            digest = manifest.get("artifact_digest")
            if manifest.get("status") != "approved":
                digest = None
            if not ui_prototype_block_current(
                task_dir,
                entry=str(manifest.get("entry", "")),
                preview=str(manifest.get("preview", "")),
                status=str(manifest.get("status", "")),
                digest=digest if isinstance(digest, str) else None,
            ):
                errors.append("ui_prototype_block_invalid")

    if meta.get("interaction_change") == "true":
        body = outcomes[2]
        has_heading = bool(re.search(r"^###\s+(Interaction Changes|交互变化)\s*$", body, re.MULTILINE))
        has_mermaid = bool(re.search(r"```mermaid\s+[\s\S]*?```", body))
        has_label = bool(re.search(r"新增[:：]|修改[:：]|删除[:：]|Add:|Change:|Remove:", body))
        has_changed_class = bool(re.search(r"classDef\s+changed\b", body)) and bool(
            re.search(r"class\s+[^;\n]+\s+changed\s*;", body)
        )
        has_red_link = bool(
            re.search(r"linkStyle\s+[^\n;]+\s+[^\n;]*stroke\s*:\s*#dc2626", body, re.IGNORECASE)
        )
        if not all((has_heading, has_mermaid, has_label, has_changed_class, has_red_link)):
            errors.append("interaction_diagram_invalid")

    status = {
        "requirement_groups": len(groups),
        "requirement_ids": requirement_ids,
        "outcome_ids": outcome_ids,
    }
    return status, list(dict.fromkeys(errors))


def _sql_blocks(content: str) -> list[str]:
    return re.findall(r"```(?:sql|postgresql|mysql|sqlite)\s*\n([\s\S]*?)```", content, re.IGNORECASE)


def _create_tables(sql: str) -> list[tuple[str, list[str], str]]:
    tables: list[tuple[str, list[str], str]] = []
    pattern = re.compile(
        r"^\s*CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([`\"\w.]+)\s*\((.*?)\)\s*[^;]*;",
        re.IGNORECASE | re.MULTILINE | re.DOTALL,
    )
    for match in pattern.finditer(sql):
        table = match.group(1).strip("`\"").split(".")[-1]
        body = match.group(2)
        columns: list[str] = []
        for raw_line in body.splitlines():
            line = raw_line.strip().lstrip(",")
            if not line or line.startswith("--"):
                continue
            first = re.match(r"[`\"]?([A-Za-z_][\w$]*)[`\"]?\s+", line)
            if not first:
                continue
            name = first.group(1)
            if name.upper() in {"PRIMARY", "UNIQUE", "FOREIGN", "CONSTRAINT", "CHECK", "KEY", "INDEX"}:
                continue
            columns.append(name)
        tables.append((table, columns, match.group(0)))
    return tables


def _alter_tables(sql: str) -> list[tuple[str, list[str], str]]:
    tables: list[tuple[str, list[str], str]] = []
    pattern = re.compile(
        r"^\s*ALTER\s+TABLE\s+([`\"\w.]+)\s+(.*?);",
        re.IGNORECASE | re.MULTILINE | re.DOTALL,
    )
    column_pattern = re.compile(
        r"\b(?:ADD(?:\s+COLUMN)?|MODIFY(?:\s+COLUMN)?|ALTER\s+COLUMN|DROP\s+COLUMN)\s+[`\"]?([A-Za-z_][\w$]*)",
        re.IGNORECASE,
    )
    for match in pattern.finditer(sql):
        table = match.group(1).strip("`\"").split(".")[-1]
        columns = column_pattern.findall(match.group(2))
        tables.append((table, columns, match.group(0)))
    return tables


def _validate_data_model(task_dir: Path) -> list[str]:
    try:
        content = (task_dir / "design.md").read_text(encoding="utf-8")
    except OSError:
        return ["design_missing"]
    errors: list[str] = []
    if not re.search(r"^##\s+(Data Model|数据模型)\s*$", content, re.MULTILINE):
        errors.append("data_model_section_missing")
    if not re.search(r"^###\s+DDL\s*$", content, re.MULTILINE | re.IGNORECASE):
        errors.append("ddl_section_missing")
    dictionary_match = re.search(
        r"^###\s+(?:Table and Field Descriptions|表与字段说明)\s*$",
        content,
        re.MULTILINE,
    )
    if not dictionary_match:
        errors.append("data_dictionary_missing")
        dictionary_body = ""
    else:
        next_heading = re.search(
            r"^#{2,3}\s+", content[dictionary_match.end():], re.MULTILINE
        )
        dictionary_end = (
            dictionary_match.end() + next_heading.start()
            if next_heading
            else len(content)
        )
        dictionary_body = content[dictionary_match.end():dictionary_end]
        required_headers = (
            bool(re.search(r"字段|Field", dictionary_body, re.IGNORECASE)),
            bool(re.search(r"类型|Type", dictionary_body, re.IGNORECASE)),
            bool(re.search(r"业务含义|说明|Description|Meaning", dictionary_body, re.IGNORECASE)),
        )
        if not all(required_headers):
            errors.append("data_dictionary_incomplete")

    sql = "\n".join(_sql_blocks(content))
    if not re.search(r"^\s*(CREATE|ALTER)\s+TABLE\b", sql, re.IGNORECASE | re.MULTILINE):
        errors.append("ddl_statement_missing")
    tables = _create_tables(sql) + _alter_tables(sql)
    if not tables:
        errors.append("ddl_statement_missing")

    for table, columns, statement in tables:
        if not re.search(rf"\b{re.escape(table)}\b", dictionary_body, re.IGNORECASE):
            errors.append("table_description_missing")
        table_native_comment = bool(
            re.search(r"\bCOMMENT\s*=\s*['\"]", statement, re.IGNORECASE)
            or re.search(rf"COMMENT\s+ON\s+TABLE\s+[^;]*\b{re.escape(table)}\b", sql, re.IGNORECASE)
        )
        table_sql_comment = bool(re.search(rf"--[^\n]*\b{re.escape(table)}\b", sql, re.IGNORECASE))
        if not (table_native_comment or table_sql_comment):
            errors.append("table_comment_missing")
        for column in columns:
            if not re.search(rf"\b{re.escape(column)}\b", dictionary_body, re.IGNORECASE):
                errors.append("field_description_missing")
                continue
            inline_comment = bool(
                re.search(
                    rf"^[^\n]*[`\"]?{re.escape(column)}[`\"]?\s+[^\n,]*\bCOMMENT\s+['\"]",
                    statement,
                    re.IGNORECASE | re.MULTILINE,
                )
            )
            comment_on = bool(
                re.search(
                    rf"COMMENT\s+ON\s+COLUMN\s+[^;]*\.{re.escape(column)}[`\"]?\s+IS\s+['\"]",
                    sql,
                    re.IGNORECASE,
                )
            )
            sql_comment = bool(
                re.search(
                    rf"--[^\n]*\b{re.escape(column)}\b[^\n]*\n\s*[`\"]?{re.escape(column)}[`\"]?\s+",
                    statement,
                    re.IGNORECASE,
                )
                or re.search(
                    rf"^[^\n]*[`\"]?{re.escape(column)}[`\"]?\s+[^\n]*--\s*\S",
                    statement,
                    re.IGNORECASE | re.MULTILINE,
                )
            )
            if not (inline_comment or comment_on or sql_comment):
                errors.append("field_comment_missing")

    if not re.search(r"主键|Primary Key|PRIMARY KEY", content, re.IGNORECASE):
        errors.append("constraints_missing")
    if not re.search(r"迁移|Migration", content, re.IGNORECASE) or not re.search(
        r"回滚|Rollback", content, re.IGNORECASE
    ):
        errors.append("migration_rollback_missing")
    return list(dict.fromkeys(errors))


def planning_status(task_dir: Path, task_data: dict) -> dict:
    """Return a machine-readable, side-effect-free planning status report."""
    if not uses_planning_contract(task_data):
        return {"contract_version": None, "legacy": True, "valid": True, "errors": []}
    meta = task_data.get("meta")
    assert isinstance(meta, dict)
    errors: list[str] = []
    if meta.get("ui") not in BOOLEAN_VALUES:
        errors.append("ui_invalid_boolean")
    tier = derive_planning_tier(meta)
    if tier == "pending":
        errors.append("profile_incomplete")
    if meta.get("planning_tier") != tier:
        errors.append("tier_mismatch")
    prd_status, prd_errors = _validate_prd(task_dir, task_data)
    errors.extend(prd_errors)
    if tier == "complex":
        if not (task_dir / "design.md").is_file():
            errors.append("design_missing")
        if not (task_dir / "implement.md").is_file():
            errors.append("implement_missing")
    data_model_errors: list[str] = []
    if meta.get("data_model_change") == "true":
        data_model_errors = _validate_data_model(task_dir)
        errors.extend(data_model_errors)
    profile = {field: meta.get(field) for field in PROFILE_FIELDS}
    unique_errors = list(dict.fromkeys(errors))
    interaction_required = meta.get("interaction_change") == "true"
    data_model_required = meta.get("data_model_change") == "true"
    complex_required = tier == "complex"

    ui_status: dict = {"required": meta.get("ui") == "true", "valid": True, "errors": []}
    if ui_status["required"]:
        from .prototype_gate import (
            compute_artifact_digest,
            load_ui_manifest,
            validate_ui_prototype,
        )

        manifest, manifest_errors = load_ui_manifest(task_dir, task_data)
        current_digest: str | None = None
        if isinstance(manifest, dict) and not manifest_errors:
            current_digest, digest_errors = compute_artifact_digest(task_dir, manifest)
        else:
            digest_errors = []
        _, approval_errors = validate_ui_prototype(task_dir, task_data)
        ui_errors = list(dict.fromkeys(manifest_errors + digest_errors + approval_errors))
        prd_reference_current = False
        if isinstance(manifest, dict) and not manifest_errors:
            prd_reference_current = ui_prototype_block_current(
                task_dir,
                entry=str(manifest.get("entry", "")),
                preview=str(manifest.get("preview", "")),
                status=str(manifest.get("status", "")),
                digest=(
                    current_digest
                    if manifest.get("status") == "approved"
                    else None
                ),
            )
            if not prd_reference_current:
                ui_errors.append("prd_reference_mismatch")
        ui_status = {
            "required": True,
            "entry": manifest.get("entry") if isinstance(manifest, dict) else None,
            "preview": manifest.get("preview") if isinstance(manifest, dict) else None,
            "status": manifest.get("status") if isinstance(manifest, dict) else None,
            "current_digest": current_digest,
            "prd_reference_current": prd_reference_current,
            "valid": not ui_errors,
            "errors": list(dict.fromkeys(ui_errors)),
        }

    checks = {
        "profile_complete": tier != "pending",
        "prd": not prd_errors,
        "complex_artifacts": (
            None
            if not complex_required
            else not any(error in unique_errors for error in ("design_missing", "implement_missing"))
        ),
        "interaction_diagram": (
            None
            if not interaction_required
            else "interaction_diagram_invalid" not in unique_errors
        ),
        "database_design": (
            None
            if not data_model_required
            else not data_model_errors
        ),
        "ui_prototype": ui_status,
    }
    return {
        "contract_version": PLANNING_CONTRACT_VERSION,
        "legacy": False,
        "planning_tier": tier,
        "profile": profile,
        "prd": prd_status,
        "checks": checks,
        "valid": not unique_errors and bool(ui_status["valid"]),
        "errors": unique_errors,
    }


def validate_planning_contract(task_dir: Path, task_data: dict) -> list[str]:
    """Return actionable error codes; an empty list permits task start."""
    return list(planning_status(task_dir, task_data)["errors"])
