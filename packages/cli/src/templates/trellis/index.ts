/**
 * Trellis workflow templates
 *
 * These are GENERIC templates for user projects.
 * Do NOT use Trellis project's own .trellis/ directory (which may be customized).
 *
 * Directory structure:
 *   trellis/
 *   ├── scripts/
 *   │   ├── __init__.py
 *   │   ├── common/           # Shared utilities (Python)
 *   │   └── *.py              # Main scripts (Python)
 *   ├── agents/                # Channel runtime agent definitions
 *   │   └── *.md               # Loaded by `trellis channel spawn --agent <name>`
 *   ├── scripts-shell-archive/ # Archived shell scripts (for reference)
 *   ├── workflow.md           # Workflow guide
 *   ├── config.yaml            # Trellis configuration
 *   ├── gitignore.txt         # .gitignore content
 *   └── gitattributes.txt     # project-root .gitattributes content
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function readTemplate(relativePath: string): string {
  return readFileSync(join(__dirname, relativePath), "utf-8");
}

// Python scripts - package init
export const scriptsInit = readTemplate("scripts/__init__.py");

// Python scripts - common
export const commonInit = readTemplate("scripts/common/__init__.py");
export const commonPaths = readTemplate("scripts/common/paths.py");
export const commonDeveloper = readTemplate("scripts/common/developer.py");
export const commonGitContext = readTemplate("scripts/common/git_context.py");
export const commonTaskQueue = readTemplate("scripts/common/task_queue.py");
export const commonTaskUtils = readTemplate("scripts/common/task_utils.py");
export const commonActiveTask = readTemplate("scripts/common/active_task.py");
export const commonCliAdapter = readTemplate("scripts/common/cli_adapter.py");
export const commonConfig = readTemplate("scripts/common/config.py");
export const commonIo = readTemplate("scripts/common/io.py");
export const commonLog = readTemplate("scripts/common/log.py");
export const commonGit = readTemplate("scripts/common/git.py");
export const commonTypes = readTemplate("scripts/common/types.py");
export const commonTasks = readTemplate("scripts/common/tasks.py");
export const commonTaskContext = readTemplate("scripts/common/task_context.py");
export const commonTaskStore = readTemplate("scripts/common/task_store.py");
export const commonPrototypeGate = readTemplate(
  "scripts/common/prototype_gate.py",
);
export const commonPlanningGate = readTemplate(
  "scripts/common/planning_gate.py",
);
export const commonSessionContext = readTemplate(
  "scripts/common/session_context.py",
);
export const commonPackagesContext = readTemplate(
  "scripts/common/packages_context.py",
);
export const commonWorkflowPhase = readTemplate(
  "scripts/common/workflow_phase.py",
);
export const commonTrellisConfig = readTemplate(
  "scripts/common/trellis_config.py",
);
export const commonSafeCommit = readTemplate("scripts/common/safe_commit.py");

// Python scripts - main
export const getDeveloperScript = readTemplate("scripts/get_developer.py");
export const initDeveloperScript = readTemplate("scripts/init_developer.py");
export const taskScript = readTemplate("scripts/task.py");
export const getContextScript = readTemplate("scripts/get_context.py");
export const addSessionScript = readTemplate("scripts/add_session.py");

// Configuration files
const configYamlTemplateEn = readTemplate("config.yaml");
/** @deprecated Prefer getConfigYamlTemplate(locale). This alias is English. */
export const configYamlTemplate = configYamlTemplateEn;
export const gitignoreTemplate = readTemplate("gitignore.txt");
export const gitattributesTemplate = readTemplate("gitattributes.txt");

// Channel runtime agent definitions (loaded by
// `packages/cli/src/commands/channel/agent-loader.ts` from `.trellis/agents/`).
// These are platform-agnostic Trellis runtime files dispatched at `trellis init`
// and refreshed by `trellis update`.
const implementAgentTemplateEn = readTemplate("agents/implement.md");
const checkAgentTemplateEn = readTemplate("agents/check.md");
/** @deprecated Prefer getAllAgents(locale). These aliases are English. */
export const implementAgentTemplate = implementAgentTemplateEn;
export const checkAgentTemplate = checkAgentTemplateEn;

// English source for workflow.md (always loaded as the fallback).
const workflowMdTemplateEn = readTemplate("workflow.md");

// Lazy-loaded translations (cached after first read; missing → undefined).
const workflowMdTemplateCache: Record<string, string | undefined> = {
  en: workflowMdTemplateEn,
};
const localizedTemplateCache: Record<string, string | undefined> = {
  "config.yaml:en": configYamlTemplateEn,
  "agents/implement.md:en": implementAgentTemplateEn,
  "agents/check.md:en": checkAgentTemplateEn,
};

function tryReadTemplate(relativePath: string): string | undefined {
  try {
    return readTemplate(relativePath);
  } catch {
    return undefined;
  }
}

function getLocalizedTemplate(
  relativePath: string,
  locale: string,
  englishTemplate: string,
): string {
  const code = locale.toLowerCase();
  if (code === "en") return englishTemplate;

  const cacheKey = `${relativePath}:${code}`;
  if (cacheKey in localizedTemplateCache) {
    return localizedTemplateCache[cacheKey] ?? englishTemplate;
  }

  const extensionIndex = relativePath.lastIndexOf(".");
  const localizedPath =
    extensionIndex === -1
      ? `${relativePath}.${code}`
      : `${relativePath.slice(0, extensionIndex)}.${code}${relativePath.slice(extensionIndex)}`;
  const localized = tryReadTemplate(localizedPath);
  localizedTemplateCache[cacheKey] = localized;
  return localized ?? englishTemplate;
}

/** Get config.yaml content for a locale, falling back to English when absent. */
export function getConfigYamlTemplate(locale: string = "en"): string {
  return getLocalizedTemplate("config.yaml", locale, configYamlTemplateEn);
}

/**
 * Get the workflow.md template content for the given locale.
 *
 * For non-`en` locales, the corresponding `workflow.<locale>.md` source is
 * preferred; if it does not exist, the function silently falls back to the
 * English source. The same locale-suffix-then-fallback rule will apply to
 * other i18n-aware templates introduced in PR2/PR3.
 *
 * The English text remains accessible as the legacy `workflowMdTemplate`
 * named export for callers that don't yet pass a locale (kept for backward
 * compatibility during the i18n rollout).
 */
export function getWorkflowTemplate(locale: string = "en"): string {
  const code = locale.toLowerCase();
  if (code === "en") return workflowMdTemplateEn;
  if (code in workflowMdTemplateCache) {
    const cached = workflowMdTemplateCache[code];
    if (cached !== undefined) return cached;
    return workflowMdTemplateEn;
  }
  const translated = tryReadTemplate(`workflow.${code}.md`);
  workflowMdTemplateCache[code] = translated;
  return translated ?? workflowMdTemplateEn;
}

/** @deprecated Prefer `getWorkflowTemplate(locale)`; this alias always returns English. */
export const workflowMdTemplate = workflowMdTemplateEn;

// Python scripts - i18n
export const commonI18n = readTemplate("scripts/common/i18n.py");
export const commonI18nStringsInit = readTemplate(
  "scripts/common/i18n_strings/__init__.py",
);
export const commonI18nStringsEn = readTemplate(
  "scripts/common/i18n_strings/en.py",
);
export const commonI18nStringsZh = readTemplate(
  "scripts/common/i18n_strings/zh.py",
);

/**
 * Get all script templates as a map of relative path to content
 */
export function getAllScripts(): Map<string, string> {
  const scripts = new Map<string, string>();

  // Package init
  scripts.set("__init__.py", scriptsInit);

  // Common
  scripts.set("common/__init__.py", commonInit);
  scripts.set("common/paths.py", commonPaths);
  scripts.set("common/developer.py", commonDeveloper);
  scripts.set("common/git_context.py", commonGitContext);
  scripts.set("common/task_queue.py", commonTaskQueue);
  scripts.set("common/task_utils.py", commonTaskUtils);
  scripts.set("common/active_task.py", commonActiveTask);
  scripts.set("common/cli_adapter.py", commonCliAdapter);
  scripts.set("common/config.py", commonConfig);
  scripts.set("common/io.py", commonIo);
  scripts.set("common/log.py", commonLog);
  scripts.set("common/git.py", commonGit);
  scripts.set("common/types.py", commonTypes);
  scripts.set("common/tasks.py", commonTasks);
  scripts.set("common/task_context.py", commonTaskContext);
  scripts.set("common/task_store.py", commonTaskStore);
  scripts.set("common/prototype_gate.py", commonPrototypeGate);
  scripts.set("common/planning_gate.py", commonPlanningGate);
  scripts.set("common/session_context.py", commonSessionContext);
  scripts.set("common/packages_context.py", commonPackagesContext);
  scripts.set("common/workflow_phase.py", commonWorkflowPhase);
  scripts.set("common/trellis_config.py", commonTrellisConfig);
  scripts.set("common/safe_commit.py", commonSafeCommit);
  scripts.set("common/i18n.py", commonI18n);
  scripts.set("common/i18n_strings/__init__.py", commonI18nStringsInit);
  scripts.set("common/i18n_strings/en.py", commonI18nStringsEn);
  scripts.set("common/i18n_strings/zh.py", commonI18nStringsZh);

  // Main
  scripts.set("get_developer.py", getDeveloperScript);
  scripts.set("init_developer.py", initDeveloperScript);
  scripts.set("task.py", taskScript);
  scripts.set("get_context.py", getContextScript);
  scripts.set("add_session.py", addSessionScript);

  return scripts;
}

/**
 * Get all channel runtime agent definitions as a map of relative path
 * (under `.trellis/agents/`) to content.
 *
 * Consumed by `trellis init` (to dispatch on first install) and by
 * `trellis update` (to backfill missing files and surface conflicts on edited
 * ones via the standard hash machinery).
 */
export function getAllAgents(language: string = "en"): Map<string, string> {
  const agents = new Map<string, string>();
  agents.set(
    "implement.md",
    getLocalizedTemplate(
      "agents/implement.md",
      language,
      implementAgentTemplateEn,
    ),
  );
  agents.set(
    "check.md",
    getLocalizedTemplate("agents/check.md", language, checkAgentTemplateEn),
  );
  return agents;
}
