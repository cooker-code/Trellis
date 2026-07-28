/**
 * Claude Code templates
 *
 * Directory structure:
 *   claude/
 *   ├── agents/         # Sub-agent definitions
 *   ├── hooks/          # Claude-only opt-in hooks (statusline.py)
 *   └── settings.json   # Settings configuration
 *
 * Default hooks come from shared-hooks/ (unified with other platforms).
 */

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_LANGUAGE, type SupportedLanguage } from "../../utils/i18n.js";
import { selectLocalizedTemplateFiles } from "../template-utils.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function readTemplate(relativePath: string): string {
  return readFileSync(join(__dirname, relativePath), "utf-8");
}

function listFiles(dir: string): string[] {
  try {
    return readdirSync(join(__dirname, dir));
  } catch {
    return [];
  }
}

export const settingsTemplate = readTemplate("settings.json");

export interface AgentTemplate {
  name: string;
  content: string;
}

export interface SettingsTemplate {
  targetPath: string;
  content: string;
}

export function getAllAgents(
  language: SupportedLanguage = DEFAULT_LANGUAGE,
): AgentTemplate[] {
  return selectLocalizedTemplateFiles(listFiles("agents"), ".md", language).map(
    ({ logicalFile, sourceFile }) => ({
      name: logicalFile.slice(0, -".md".length),
      content: readTemplate(`agents/${sourceFile}`),
    }),
  );
}

export function getSettingsTemplate(): SettingsTemplate {
  return {
    targetPath: "settings.json",
    content: settingsTemplate,
  };
}

/**
 * Opt-in statusLine hook, installed only via `trellis init --with-statusline`.
 *
 * Lives under claude/hooks/ (not shared-hooks/) because `statusLine` is a
 * Claude-only event, and is intentionally NOT part of `collectTemplates` —
 * `trellis update` must never force-install it on opted-out projects.
 */
export function getStatuslineHook(): string {
  return readTemplate("hooks/statusline.py");
}
