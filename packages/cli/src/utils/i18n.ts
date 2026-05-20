/**
 * i18n locale resolution for the Trellis CLI (TS side).
 *
 * The mirror Python implementation lives in
 * `templates/trellis/scripts/common/i18n.py`. Both follow the same priority
 * chain so a user's `--language zh` flag (env override) and their
 * `.trellis/config.yaml` setting agree at sync time and at script runtime.
 *
 * Priority (highest first):
 *   1. `TRELLIS_LANGUAGE` env var (set by the CLI when `--language` is given,
 *      and respected by Python scripts at runtime)
 *   2. `language:` field in `.trellis/config.yaml`
 *   3. `"en"` default
 *
 * Invalid values silently degrade to `"en"` (avoid printing here so we don't
 * spam every collectTemplateFiles caller; the user-facing warn lives in
 * `validateLanguage`).
 *
 * No yaml dependency — this is a 1-line shallow scan in the same spirit as
 * `loadUpdateSkipPaths` in `commands/update.ts`.
 */

import fs from "node:fs";
import path from "node:path";

import { DIR_NAMES } from "../constants/paths.js";

export const SUPPORTED_LANGUAGES = ["en", "zh"] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];
export const DEFAULT_LANGUAGE: SupportedLanguage = "en";

function isSupportedLanguage(code: string): code is SupportedLanguage {
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(code);
}

/**
 * Validate a language code; returns the normalized code or `null` if invalid.
 * Use this at CLI flag parse time to print a one-shot warning.
 */
export function validateLanguage(
  raw: string | undefined,
): SupportedLanguage | null {
  if (!raw) return null;
  const code = raw.trim().toLowerCase();
  return isSupportedLanguage(code) ? code : null;
}

/**
 * Read `language:` from `.trellis/config.yaml`. Lightweight scan — looks for
 * a top-level `language: <value>` line (no indentation), strips inline
 * comments and surrounding quotes. Mirrors the Python parser in
 * `common/config.py` and the shallow style of `loadUpdateSkipPaths`.
 *
 * Returns `null` when the file does not exist, the field is absent, or the
 * value is invalid (caller decides the fallback).
 */
export function loadLanguageFromConfig(cwd: string): SupportedLanguage | null {
  const configPath = path.join(cwd, DIR_NAMES.WORKFLOW, "config.yaml");
  if (!fs.existsSync(configPath)) return null;

  let content: string;
  try {
    content = fs.readFileSync(configPath, "utf-8");
  } catch {
    return null;
  }

  for (const rawLine of content.split("\n")) {
    // Top-level only: no leading whitespace.
    if (rawLine.startsWith(" ") || rawLine.startsWith("\t")) continue;
    const stripped = rawLine.trimEnd();
    if (!stripped || stripped.startsWith("#")) continue;
    const match = stripped.match(/^language\s*:\s*(.+)$/);
    if (!match) continue;
    let value = match[1].trim();
    // Strip an inline `# comment` (only when prefixed by whitespace).
    const commentIdx = findInlineCommentIndex(value);
    if (commentIdx !== -1) value = value.slice(0, commentIdx).trim();
    // Strip a single layer of matched quotes.
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }
    return validateLanguage(value);
  }

  return null;
}

function findInlineCommentIndex(value: string): number {
  let inQuote: string | null = null;
  for (let i = 0; i < value.length; i++) {
    const ch = value[i];
    if (inQuote) {
      if (ch === inQuote) inQuote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      inQuote = ch;
      continue;
    }
    if (ch === "#" && (i === 0 || /\s/.test(value[i - 1]))) {
      return i;
    }
  }
  return -1;
}

/**
 * Resolve the active source-template language for the project.
 *
 * Priority:
 *   `TRELLIS_LANGUAGE` env > config.yaml > `"en"`
 *
 * The `--language <code>` CLI flag is realized by setting
 * `process.env.TRELLIS_LANGUAGE` at command entry (see `commands/init.ts`
 * and `commands/update.ts`), so this function does not take the flag value
 * directly — the env channel keeps precedence semantics consistent with the
 * Python side, which reads only env + config.
 */
export function resolveLanguage(cwd: string): SupportedLanguage {
  const env = process.env.TRELLIS_LANGUAGE?.trim().toLowerCase();
  if (env && isSupportedLanguage(env)) return env;
  const fromConfig = loadLanguageFromConfig(cwd);
  if (fromConfig) return fromConfig;
  return DEFAULT_LANGUAGE;
}
