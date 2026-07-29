import fs from "node:fs";
import path from "node:path";

import { DIR_NAMES, PATHS } from "../constants/paths.js";
import { copyTrellisDir } from "../templates/extract.js";

// Import trellis templates (generic, not project-specific)
import {
  getWorkflowTemplate,
  getConfigYamlTemplate,
  gitignoreTemplate,
  gitattributesTemplate,
  getAllAgents,
} from "../templates/trellis/index.js";

// Import markdown templates
import {
  agentProgressIndexContent,
  getSpecTemplateContent,
} from "../templates/markdown/index.js";

import { writeFile, ensureDir } from "../utils/file-writer.js";
import { replacePythonCommandLiterals } from "./shared.js";
import {
  sanitizePkgName,
  type ProjectType,
  type DetectedPackage,
} from "../utils/project-detector.js";

interface DocDefinition {
  name: string;
  source: string;
}

/**
 * Options for creating workflow structure
 */
export interface WorkflowOptions {
  /** Detected or specified project type */
  projectType: ProjectType;
  /** Skip creating local spec templates (when using remote template) — single-repo mode */
  skipSpecTemplates?: boolean;
  /** Detected monorepo packages (enables monorepo spec creation) */
  packages?: DetectedPackage[];
  /** Package names that use remote templates (skip blank spec for these) */
  remoteSpecPackages?: Set<string>;
  /**
   * Optional override for `.trellis/workflow.md` content. When omitted the
   * bundled native template is written. Set by `init --workflow` (or
   * `--workflow-source`) after the resolver has fetched marketplace content.
   * Caller is still responsible for removing the `.trellis/workflow.md` hash
   * entry for non-native workflows so update.ts treats them as user-managed.
   */
  workflowMdOverride?: string;
  /**
   * Source-template language code (i18n). When set to a non-`en` locale,
   * locale-suffixed template files (`workflow.<locale>.md`) are preferred,
   * falling back to the English source. Default `en`.
   */
  language?: string;
}

/**
 * Regex used to detect an existing `journal-*.md merge=union` gitattributes
 * rule (any whitespace variant), so `ensureGitattributes` never appends a
 * duplicate entry to a project's pre-existing `.gitattributes`.
 */
const JOURNAL_MERGE_UNION_PATTERN = /journal-\*\.md\s+merge=union/;

/**
 * Ensure the project-root `.gitattributes` carries the journal `merge=union`
 * rule, without ever overwriting a user's existing file wholesale.
 *
 * - No `.gitattributes` yet: write the bundled template directly.
 * - Existing file that already has a `journal-*.md merge=union` rule (user's
 *   own or from a previous `trellis init`/`update`): no-op, avoids duplicates.
 * - Existing file without that rule: append the bundled template content.
 *
 * Intentionally does NOT go through the standard `writeFile` conflict-prompt
 * flow — this file is additive-only and never a candidate for whole-file
 * overwrite.
 */
export function ensureGitattributes(cwd: string): void {
  const targetPath = path.join(cwd, ".gitattributes");

  if (!fs.existsSync(targetPath)) {
    fs.writeFileSync(targetPath, gitattributesTemplate);
    return;
  }

  const existing = fs.readFileSync(targetPath, "utf-8");
  if (JOURNAL_MERGE_UNION_PATTERN.test(existing)) {
    return;
  }

  const separator = existing.endsWith("\n") ? "\n" : "\n\n";
  fs.writeFileSync(targetPath, existing + separator + gitattributesTemplate);
}

/**
 * Create workflow structure based on project type
 *
 * This function creates the .trellis/ directory structure by:
 * 1. Copying scripts/ directory directly (dogfooding)
 * 2. Copying workflow.md and .gitignore (dogfooding)
 * 3. Creating workspace/ with index.md
 * 4. Creating tasks/ directory
 * 5. Creating spec/ with templates (not dogfooded - generic templates)
 *
 * @param cwd - Current working directory
 * @param options - Workflow options including project type
 */
export async function createWorkflowStructure(
  cwd: string,
  options?: WorkflowOptions,
): Promise<void> {
  const projectType = options?.projectType ?? "fullstack";
  const skipSpecTemplates = options?.skipSpecTemplates ?? false;
  const packages = options?.packages;
  const remoteSpecPackages = options?.remoteSpecPackages;
  const language = options?.language ?? "en";
  const workflowMd =
    options?.workflowMdOverride ?? getWorkflowTemplate(language);

  // Create base .trellis directory
  ensureDir(path.join(cwd, DIR_NAMES.WORKFLOW));

  // Copy scripts/ directory from templates
  await copyTrellisDir("scripts", path.join(cwd, PATHS.SCRIPTS), {
    executable: true,
  });

  // Copy workflow.md (native bundled template or selected marketplace variant)
  await writeFile(
    path.join(cwd, PATHS.WORKFLOW_GUIDE_FILE),
    replacePythonCommandLiterals(workflowMd),
  );

  // Copy .gitignore from templates
  await writeFile(
    path.join(cwd, DIR_NAMES.WORKFLOW, ".gitignore"),
    gitignoreTemplate,
  );

  // Copy config.yaml from templates
  await writeFile(
    path.join(cwd, DIR_NAMES.WORKFLOW, "config.yaml"),
    getConfigYamlTemplate(language),
  );

  // Ensure project-root .gitattributes carries the journal merge=union rule
  // (additive-only — never overwrites a user's existing file wholesale).
  ensureGitattributes(cwd);

  // Dispatch channel runtime agent definitions. These are platform-agnostic
  // Trellis runtime files consumed by `trellis channel spawn --agent <name>`
  // through `packages/cli/src/commands/channel/agent-loader.ts`. They are
  // dispatched on every init regardless of selected workflow because the user
  // can switch to a channel-driven workflow at any time via `trellis workflow
  // --template`.
  ensureDir(path.join(cwd, PATHS.AGENTS));
  for (const [agentFile, content] of getAllAgents(language)) {
    await writeFile(path.join(cwd, PATHS.AGENTS, agentFile), content);
  }

  // Create workspace/ with index.md
  ensureDir(path.join(cwd, PATHS.WORKSPACE));
  await writeFile(
    path.join(cwd, PATHS.WORKSPACE, "index.md"),
    replacePythonCommandLiterals(agentProgressIndexContent),
  );

  // Create tasks/ directory
  ensureDir(path.join(cwd, PATHS.TASKS));

  // Create spec templates based on project type
  // These are NOT dogfooded - they are generic templates for new projects
  if (packages && packages.length > 0) {
    // Monorepo mode: create per-package spec directories
    await createSpecTemplates(
      cwd,
      projectType,
      language,
      packages,
      remoteSpecPackages,
    );
  } else if (!skipSpecTemplates) {
    // Single-repo mode: create global spec (skip if using remote template)
    await createSpecTemplates(cwd, projectType, language);
  }
}

/**
 * Write backend spec docs into a target spec directory.
 */
async function writeDocs(
  targetDir: string,
  docs: DocDefinition[],
  language: string,
): Promise<void> {
  ensureDir(targetDir);
  for (const doc of docs) {
    await writeFile(
      path.join(targetDir, doc.name),
      getSpecTemplateContent(doc.source, language),
    );
  }
}

async function writeBackendDocs(
  specBase: string,
  language: string,
): Promise<void> {
  const docs: DocDefinition[] = [
    { name: "index.md", source: "spec/backend/index.md.txt" },
    {
      name: "directory-structure.md",
      source: "spec/backend/directory-structure.md.txt",
    },
    {
      name: "database-guidelines.md",
      source: "spec/backend/database-guidelines.md.txt",
    },
    {
      name: "logging-guidelines.md",
      source: "spec/backend/logging-guidelines.md.txt",
    },
    {
      name: "quality-guidelines.md",
      source: "spec/backend/quality-guidelines.md.txt",
    },
    {
      name: "error-handling.md",
      source: "spec/backend/error-handling.md.txt",
    },
  ];
  await writeDocs(path.join(specBase, "backend"), docs, language);
}

/**
 * Write frontend spec docs into a target spec directory.
 */
async function writeFrontendDocs(
  specBase: string,
  language: string,
): Promise<void> {
  const docs: DocDefinition[] = [
    { name: "index.md", source: "spec/frontend/index.md.txt" },
    {
      name: "directory-structure.md",
      source: "spec/frontend/directory-structure.md.txt",
    },
    { name: "type-safety.md", source: "spec/frontend/type-safety.md.txt" },
    {
      name: "hook-guidelines.md",
      source: "spec/frontend/hook-guidelines.md.txt",
    },
    {
      name: "component-guidelines.md",
      source: "spec/frontend/component-guidelines.md.txt",
    },
    {
      name: "quality-guidelines.md",
      source: "spec/frontend/quality-guidelines.md.txt",
    },
    {
      name: "state-management.md",
      source: "spec/frontend/state-management.md.txt",
    },
  ];
  await writeDocs(path.join(specBase, "frontend"), docs, language);
}

/**
 * Write spec docs for a given project type into a target spec directory.
 */
async function writeSpecForType(
  specBase: string,
  projectType: ProjectType,
  language: string,
): Promise<void> {
  if (projectType !== "frontend") {
    await writeBackendDocs(specBase, language);
  }
  if (projectType !== "backend") {
    await writeFrontendDocs(specBase, language);
  }
}

async function createSpecTemplates(
  cwd: string,
  projectType: ProjectType,
  language: string,
  packages?: DetectedPackage[],
  remoteSpecPackages?: Set<string>,
): Promise<void> {
  // Ensure spec directory exists
  ensureDir(path.join(cwd, PATHS.SPEC));

  // Guides - always created regardless of mode
  const guidesDir = path.join(cwd, `${PATHS.SPEC}/guides`);
  ensureDir(guidesDir);
  const guidesDocs: DocDefinition[] = [
    { name: "index.md", source: "spec/guides/index.md.txt" },
    {
      name: "cross-layer-thinking-guide.md",
      source: "spec/guides/cross-layer-thinking-guide.md.txt",
    },
    {
      name: "code-reuse-thinking-guide.md",
      source: "spec/guides/code-reuse-thinking-guide.md.txt",
    },
  ];
  await writeDocs(guidesDir, guidesDocs, language);

  if (packages && packages.length > 0) {
    // Monorepo mode: create spec/<name>/ for each package
    for (const pkg of packages) {
      const dirName = sanitizePkgName(pkg.name);
      if (remoteSpecPackages?.has(dirName)) continue;
      const pkgSpecBase = path.join(cwd, `${PATHS.SPEC}/${dirName}`);
      ensureDir(pkgSpecBase);
      const pkgType = pkg.type === "unknown" ? "fullstack" : pkg.type;
      await writeSpecForType(pkgSpecBase, pkgType, language);
    }
  } else {
    // Single-repo mode
    await writeSpecForType(path.join(cwd, PATHS.SPEC), projectType, language);
  }
}
