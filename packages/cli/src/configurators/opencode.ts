import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { AI_TOOLS } from "../types/ai-tools.js";
import { getOpenCodeTemplatePath } from "../templates/extract.js";
import { ensureDir, writeFile } from "../utils/file-writer.js";
import { toPosix } from "../utils/posix.js";
import { DEFAULT_LANGUAGE, type SupportedLanguage } from "../utils/i18n.js";
import { selectLocalizedTemplateFiles } from "../templates/template-utils.js";
import {
  collectSkillTemplates,
  replacePythonCommandLiterals,
  resolveBundledSkills,
  resolveCommands,
  resolveSkills,
} from "./shared.js";

/**
 * Files under packages/cli/src/templates/opencode/ that are NOT user-facing
 * assets (build artifacts, runtime caches, etc.). The template dir has a
 * real package.json that declares the @opencode-ai/plugin dep — that one
 * IS user-facing and must be shipped.
 */
const EXCLUDE_PATTERNS = [
  ".d.ts",
  ".d.ts.map",
  ".js.map",
  "__pycache__",
  "node_modules",
  "bun.lock",
  ".gitignore",
];

function shouldExclude(filename: string): boolean {
  for (const pattern of EXCLUDE_PATTERNS) {
    if (filename.endsWith(pattern) || filename === pattern) {
      return true;
    }
  }
  return false;
}

/**
 * Walk the opencode template directory and produce a `Map<relPath, content>`
 * rooted at `.opencode/`. Shared by both `configureOpenCode` (init-time write)
 * and `collectOpenCodeTemplates` (update-time hash tracking) so the two paths
 * always agree on the exact file set. `commands/` is handled separately (sourced
 * from common template context, not from this directory tree).
 */
function walkOpenCodeTemplateDir(
  language: SupportedLanguage,
): Map<string, string> {
  const files = new Map<string, string>();
  const sourcePath = getOpenCodeTemplatePath();

  function walk(relDir: string): void {
    const absDir = path.join(sourcePath, relDir);
    const entries = readdirSync(absDir).sort();
    const localizedAgents =
      toPosix(relDir) === "agents"
        ? new Map(
            selectLocalizedTemplateFiles(entries, ".md", language).map(
              ({ logicalFile, sourceFile }) => [sourceFile, logicalFile],
            ),
          )
        : null;

    for (const entry of entries) {
      if (shouldExclude(entry)) continue;
      const absEntry = path.join(absDir, entry);
      const sourceRelEntry = relDir ? path.join(relDir, entry) : entry;
      const stat = statSync(absEntry);
      if (stat.isDirectory()) {
        // Skip commands/ — that's sourced from common/ templates, not the
        // opencode/ dir. Including both paths would double-write.
        if (sourceRelEntry === "commands") continue;
        walk(sourceRelEntry);
      } else {
        let logicalEntry = entry;
        if (localizedAgents && entry.endsWith(".md")) {
          const selectedLogicalEntry = localizedAgents.get(entry);
          if (!selectedLogicalEntry) continue;
          logicalEntry = selectedLogicalEntry;
        }
        const logicalRelEntry = relDir
          ? path.join(relDir, logicalEntry)
          : logicalEntry;
        const content = readFileSync(absEntry, "utf-8");
        // Map keys are logical paths used as cross-platform hash keys / lookup
        // keys downstream. Always POSIX, regardless of host OS.
        files.set(
          toPosix(path.join(".opencode", logicalRelEntry)),
          replacePythonCommandLiterals(content),
        );
      }
    }
  }

  walk("");
  return files;
}

/**
 * Collect all opencode template files that `trellis update` should track.
 *
 * Must stay in sync with `configureOpenCode`: both paths produce the same
 * `Map<relPath, content>`. If they drift, update will spuriously flag newly
 * init'd files as modifications on the next run.
 */
export function collectOpenCodeTemplates(
  language: SupportedLanguage = DEFAULT_LANGUAGE,
): Map<string, string> {
  const files = walkOpenCodeTemplateDir(language);
  const ctx = AI_TOOLS.opencode.templateContext;
  for (const cmd of resolveCommands(ctx, language)) {
    files.set(`.opencode/commands/trellis/${cmd.name}.md`, cmd.content);
  }
  for (const [filePath, content] of collectSkillTemplates(
    ".opencode/skills",
    resolveSkills(ctx, language),
    resolveBundledSkills(ctx, language),
  )) {
    files.set(filePath, content);
  }
  return files;
}

/**
 * Configure OpenCode at init time by writing the same file set enumerated
 * by `collectOpenCodeTemplates`.
 */
export async function configureOpenCode(
  cwd: string,
  language: SupportedLanguage = DEFAULT_LANGUAGE,
): Promise<void> {
  for (const [relPath, content] of collectOpenCodeTemplates(language)) {
    const absPath = path.join(cwd, relPath);
    ensureDir(path.dirname(absPath));
    await writeFile(absPath, content);
  }
}
