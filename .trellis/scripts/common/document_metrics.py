"""Deterministic Markdown document metrics and experiment report helpers.

Static token figures are estimates, not provider billing usage.  Runner usage
is accepted separately so experiment reports cannot conflate the two values.
"""

from __future__ import annotations

import json
import math
import re
from collections import defaultdict
from pathlib import Path
from typing import Any


ESTIMATOR_VERSION = "unicode-v1"
APPROVAL_START = "<!-- trellis:approval-surface:start -->"
APPROVAL_END = "<!-- trellis:approval-surface:end -->"
_CJK_RE = re.compile(r"[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]")
_ASCII_WORD_RE = re.compile(r"[A-Za-z0-9]+")
_HEADING_RE = re.compile(r"^#{1,6}\s+\S", re.MULTILINE)
_CHECKLIST_RE = re.compile(r"^\s*[-*+]\s+\[[ xX]\]", re.MULTILINE)
_UNRESOLVED_RE = re.compile(
    r"\b(?:TBD|TODO|TBC|FIXME)\b|待补充|待确认|待定|未解决",
    re.IGNORECASE,
)
_TERM_DEFINITION_RE = re.compile(
    r"^\s*(?:[-*+]\s+)?`[^`]+`\s*(?:—|–|:|：)\s*\S",
    re.MULTILINE,
)


def estimate_tokens(text: str) -> int:
    """Estimate tokens with a stable Unicode rule; never use it for billing."""
    cjk_count = len(_CJK_RE.findall(text))
    without_cjk = _CJK_RE.sub(" ", text)
    word_count = sum(math.ceil(len(word) / 4) for word in _ASCII_WORD_RE.findall(without_cjk))
    without_words = _ASCII_WORD_RE.sub("", without_cjk)
    punctuation_count = sum(1 for char in without_words if not char.isspace())
    return cjk_count + word_count + punctuation_count


def approval_surface(text: str) -> tuple[str, str]:
    """Return the approval and detail sections, treating unmarked text as approval."""
    start = text.find(APPROVAL_START)
    end = text.find(APPROVAL_END)
    if start < 0 or end < 0 or end < start:
        return text, ""
    approval_start = start + len(APPROVAL_START)
    approval = text[approval_start:end]
    detail = text[:start] + text[end + len(APPROVAL_END):]
    return approval, detail


def document_metrics(text: str) -> dict[str, int | str]:
    """Calculate deterministic, machine-readable structural document metrics."""
    approval, detail = approval_surface(text)
    return {
        "estimator_version": ESTIMATOR_VERSION,
        "utf8_bytes": len(text.encode("utf-8")),
        "characters": len(text),
        "lines": len(text.splitlines()),
        "estimated_tokens": estimate_tokens(text),
        "approval_surface_estimated_tokens": estimate_tokens(approval),
        "detail_estimated_tokens": estimate_tokens(detail),
        "headings": len(_HEADING_RE.findall(text)),
        "checklist_items": len(_CHECKLIST_RE.findall(text)),
        "unresolved_placeholders": len(_UNRESOLVED_RE.findall(text)),
        "term_definitions": len(_TERM_DEFINITION_RE.findall(text)),
    }


def compare_documents(native_text: str, reviewable_text: str) -> dict[str, Any]:
    """Compare native and reviewable documents with absolute and percent deltas."""
    native = document_metrics(native_text)
    reviewable = document_metrics(reviewable_text)
    deltas: dict[str, dict[str, float | int | None]] = {}
    for key, native_value in native.items():
        if key == "estimator_version":
            continue
        reviewable_value = reviewable[key]
        assert isinstance(native_value, int) and isinstance(reviewable_value, int)
        absolute = reviewable_value - native_value
        deltas[key] = {
            "absolute": absolute,
            "percent": None if native_value == 0 else round(absolute / native_value * 100, 2),
        }
    return {"native": native, "reviewable": reviewable, "delta": deltas}


_DOCUMENT_FIELDS = {
    "utf8_bytes", "characters", "lines", "estimated_tokens",
    "approval_surface_estimated_tokens", "detail_estimated_tokens", "headings",
    "checklist_items", "unresolved_placeholders", "term_definitions",
}
_USAGE_FIELDS = {"input_tokens", "output_tokens", "cache_read_tokens", "cache_write_tokens"}
_EXPERIMENT_SOURCES = {"historical_backtest", "real_task"}
_ASSIGNMENTS = {"randomized", "user_override", "shadow"}


def _is_non_negative_integer(value: Any) -> bool:
    """Return whether value is an integer metric, excluding Python booleans."""
    return isinstance(value, int) and not isinstance(value, bool) and value >= 0


def validate_experiment_record(record: Any, line_number: int | None = None) -> dict[str, Any]:
    """Validate and normalize one version-one experiment record."""
    prefix = f"line {line_number}: " if line_number else ""
    if not isinstance(record, dict):
        raise ValueError(prefix + "record must be an object")
    for field in ("task_id", "variant", "base_sha", "model", "run", "experiment_source", "assignment", "document", "usage", "interaction", "guardrails"):
        if field not in record:
            raise ValueError(prefix + f"missing required field '{field}'")
    if record["variant"] not in {"native", "reviewable"}:
        raise ValueError(prefix + "variant must be 'native' or 'reviewable'")
    if not _is_non_negative_integer(record["run"]) or record["run"] < 1:
        raise ValueError(prefix + "run must be a positive integer")
    if record["experiment_source"] not in _EXPERIMENT_SOURCES:
        raise ValueError(prefix + "experiment_source must be 'historical_backtest' or 'real_task'")
    if record["assignment"] not in _ASSIGNMENTS:
        raise ValueError(prefix + "assignment must be 'randomized', 'user_override', or 'shadow'")
    if record["experiment_source"] == "historical_backtest" and record["assignment"] != "shadow":
        raise ValueError(prefix + "historical_backtest records must use shadow assignment")
    document = record["document"]
    usage = record["usage"]
    if not isinstance(document, dict) or not isinstance(usage, dict):
        raise ValueError(prefix + "document and usage must be objects")
    missing_document = _DOCUMENT_FIELDS - document.keys()
    if missing_document:
        raise ValueError(prefix + "document missing " + ", ".join(sorted(missing_document)))
    for field in _DOCUMENT_FIELDS:
        if not _is_non_negative_integer(document[field]):
            raise ValueError(prefix + f"document.{field} must be a non-negative integer")
    for field in _USAGE_FIELDS:
        if field not in usage:
            raise ValueError(prefix + f"usage missing '{field}'")
        if usage[field] is not None and not _is_non_negative_integer(usage[field]):
            raise ValueError(prefix + f"usage.{field} must be a non-negative integer or null")
    interaction = record["interaction"]
    if not isinstance(interaction, dict):
        raise ValueError(prefix + "interaction must be an object")
    for field in ("approval_turns", "user_correction_tokens", "wall_clock_ms"):
        if field not in interaction:
            raise ValueError(prefix + f"interaction missing '{field}'")
        if interaction[field] is not None and not _is_non_negative_integer(interaction[field]):
            raise ValueError(prefix + f"interaction.{field} must be a non-negative integer or null")
    guardrails = record["guardrails"]
    if not isinstance(guardrails, dict):
        raise ValueError(prefix + "guardrails must be an object")
    for field in ("critical_requirement_omissions", "requirements_coverage", "acceptance_passed"):
        if field not in guardrails:
            raise ValueError(prefix + f"guardrails missing '{field}'")
    if not _is_non_negative_integer(guardrails["critical_requirement_omissions"]):
        raise ValueError(prefix + "guardrails.critical_requirement_omissions must be a non-negative integer")
    if isinstance(guardrails["requirements_coverage"], bool) or not isinstance(guardrails["requirements_coverage"], (int, float)) or not 0 <= guardrails["requirements_coverage"] <= 1:
        raise ValueError(prefix + "guardrails.requirements_coverage must be a number between 0 and 1")
    if guardrails["acceptance_passed"] is not None and not isinstance(guardrails["acceptance_passed"], bool):
        raise ValueError(prefix + "guardrails.acceptance_passed must be a boolean or null")
    shadow = record.get("shadow")
    if shadow is not None:
        if not isinstance(shadow, dict) or set(shadow) != {"native_path", "reviewable_path", "display_variant"}:
            raise ValueError(prefix + "shadow must contain native_path, reviewable_path, and display_variant")
        if shadow["display_variant"] not in {"native", "reviewable"}:
            raise ValueError(prefix + "shadow.display_variant must be 'native' or 'reviewable'")
    if record["assignment"] == "shadow" and shadow is None:
        raise ValueError(prefix + "shadow assignment requires shadow metadata")
    return record


def load_experiment_records(path: Path) -> list[dict[str, Any]]:
    """Read and validate a JSONL experiment file without writing to it."""
    records: list[dict[str, Any]] = []
    for line_number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
        if not line.strip():
            continue
        try:
            parsed = json.loads(line)
        except json.JSONDecodeError as exc:
            raise ValueError(f"line {line_number}: invalid JSON ({exc.msg})") from exc
        records.append(validate_experiment_record(parsed, line_number))
    if not records:
        raise ValueError("experiment results must contain at least one record")
    return records


def experiment_summary(records: list[dict[str, Any]]) -> dict[str, Any]:
    """Aggregate static estimates and actual runner usage into separate columns."""
    groups: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for record in records:
        groups[record["variant"]].append(record)
    variants: dict[str, Any] = {}
    for variant, entries in sorted(groups.items()):
        count = len(entries)
        document_fields = sorted(_DOCUMENT_FIELDS)
        usage_fields = sorted(_USAGE_FIELDS)
        variants[variant] = {
            "runs": count,
            "task_ids": sorted({entry["task_id"] for entry in entries}),
            "base_shas": sorted({entry["base_sha"] for entry in entries}),
            "models": sorted({entry["model"] for entry in entries if entry["model"] is not None}),
            "estimated_document_averages": {
                field: round(sum(entry["document"][field] for entry in entries) / count, 2)
                for field in document_fields
            },
            "actual_runner_usage_averages": {
                field: (
                    None if not (values := [entry["usage"][field] for entry in entries if entry["usage"][field] is not None])
                    else round(sum(values) / len(values), 2)
                )
                for field in usage_fields
            },
            "interaction_averages": {
                field: (None if not (values := [entry["interaction"][field] for entry in entries if entry["interaction"][field] is not None]) else round(sum(values) / len(values), 2))
                for field in ("approval_turns", "user_correction_tokens", "wall_clock_ms")
            },
            "guardrails": {
                "critical_requirement_omissions": sum(entry["guardrails"]["critical_requirement_omissions"] for entry in entries),
                "requirements_coverage": min(entry["guardrails"]["requirements_coverage"] for entry in entries),
                "acceptance_passed": all(entry["guardrails"]["acceptance_passed"] is True for entry in entries),
            },
        }
    cohort_keys = {(entry["experiment_source"], entry["assignment"]) for entry in records}
    comparison = {}
    comparison_note = "No native/reviewable delta is reported: samples span distinct source or assignment cohorts."
    if len(cohort_keys) == 1 and {"native", "reviewable"} <= variants.keys():
        for section in ("estimated_document_averages", "actual_runner_usage_averages", "interaction_averages"):
            comparison[section] = {
                field: None if variants["native"][section][field] is None or variants["reviewable"][section][field] is None else round(variants["reviewable"][section][field] - variants["native"][section][field], 2)
                for field in variants["native"][section]
            }
        comparison_note = "Reviewable minus native within one source/assignment cohort; this is descriptive unless samples are paired or randomized."
    return {"schema_version": "experiment-v1", "sample_count": len(records), "sample_cohorts": [{"experiment_source": source, "assignment": assignment, "records": sum(1 for entry in records if (entry["experiment_source"], entry["assignment"]) == (source, assignment))} for source, assignment in sorted(cohort_keys)], "variants": variants, "native_to_reviewable_delta": comparison, "comparison_note": comparison_note}


def experiment_markdown_report(summary: dict[str, Any]) -> str:
    """Render a transparent report; static structure is not human comprehension."""
    lines = [
        "# Document Profile Experiment Report",
        "",
        f"Samples: {summary['sample_count']}",
        "Cohorts: " + "; ".join(f"{item['experiment_source']}/{item['assignment']}={item['records']}" for item in summary["sample_cohorts"]),
        "",
        "Static document tokens are deterministic estimates, not model billing tokens or proof of human understanding.",
        "Actual runner usage is reported separately and remains null when no runner supplied it.",
        summary["comparison_note"],
    ]
    for variant, data in summary["variants"].items():
        lines.extend([
            "", f"## {variant}", "", f"Runs: {data['runs']}",
            f"Tasks: {', '.join(data['task_ids'])}", f"Baseline SHA: {', '.join(data['base_shas'])}", f"Models: {', '.join(data['models']) or 'null'}", "",
            "| Metric | Estimated document average | Actual runner usage average |",
            "|---|---:|---:|",
        ])
        estimated = data["estimated_document_averages"]
        actual = data["actual_runner_usage_averages"]
        lines.extend(f"| {field} | {value} | - |" for field, value in estimated.items())
        lines.extend(f"| {field} | - | {value if value is not None else 'null'} |" for field, value in actual.items())
        lines.extend(["", "Interaction averages: " + ", ".join(f"{field}={value if value is not None else 'null'}" for field, value in data["interaction_averages"].items()) + "."])
        guardrails = data["guardrails"]
        lines.extend([
            "", f"Guardrails: critical_requirement_omissions={guardrails['critical_requirement_omissions']}; acceptance_passed={guardrails['acceptance_passed']}.",
        ])
    if summary["native_to_reviewable_delta"]:
        lines.extend(["", "## Native to reviewable delta", "", "Reviewable minus native; null means actual runner data was unavailable."])
        for section, values in summary["native_to_reviewable_delta"].items():
            lines.append(f"- {section}: " + ", ".join(f"{field}={value}" for field, value in values.items()))
    return "\n".join(lines) + "\n"
