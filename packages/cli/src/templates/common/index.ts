/**
 * Common templates — single source of truth for all platforms.
 *
 * These templates contain {{placeholders}} that are resolved per-platform
 * by resolvePlaceholders() in configurators/shared.ts.
 *
 * Directory structure:
 *   common/
 *   ├── commands/        # Templates that stay as slash commands
 *   ├── skills/          # Single-file templates that become auto-triggered skills
 *   └── bundled-skills/  # Multi-file built-in skills with references/assets
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_LANGUAGE, type SupportedLanguage } from "../../utils/i18n.js";
import { selectLocalizedTemplateFiles } from "../template-utils.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function readTemplate(relativePath: string): string {
  return readFileSync(join(__dirname, relativePath), "utf-8");
}

function listMarkdownFiles(dir: string): string[] {
  try {
    return readdirSync(join(__dirname, dir))
      .filter((f) => f.endsWith(".md"))
      .sort();
  } catch {
    return [];
  }
}

export interface CommonTemplate {
  /** Template name without extension (e.g., "start", "before-dev") */
  name: string;
  /** Raw content with {{placeholders}} — must be resolved before writing */
  content: string;
}

export interface CommonBundledSkillFile {
  /** POSIX path relative to the skill directory, e.g. "references/core.md" */
  relativePath: string;
  /** Raw content with {{placeholders}} — must be resolved before writing */
  content: string;
}

export interface CommonBundledSkill {
  /** Skill directory name, e.g. "trellis-meta" */
  name: string;
  /** Files that must be written under the skill directory */
  files: CommonBundledSkillFile[];
}

interface CommonDescriptionTemplates {
  skills: Record<string, string>;
  commands: Record<string, string>;
}

// Cached results — files don't change during a CLI run. Locale-selected data
// is keyed explicitly so en -> zh -> en calls cannot contaminate one another.
const cachedCommands = new Map<SupportedLanguage, CommonTemplate[]>();
const cachedSkills = new Map<SupportedLanguage, CommonTemplate[]>();
const cachedBundledSkills = new Map<SupportedLanguage, CommonBundledSkill[]>();
const cachedDescriptions = new Map<
  SupportedLanguage,
  CommonDescriptionTemplates
>();
const cachedPullBasedPreludes = new Map<SupportedLanguage, string>();

function getFlatMarkdownTemplates(
  dir: "commands" | "skills",
  language: SupportedLanguage,
): CommonTemplate[] {
  return selectLocalizedTemplateFiles(
    listMarkdownFiles(dir),
    ".md",
    language,
  ).map(({ logicalFile, sourceFile }) => ({
    name: logicalFile.slice(0, -".md".length),
    content: readTemplate(`${dir}/${sourceFile}`),
  }));
}

/**
 * Get all command templates (stay as slash commands on all platforms).
 * English files define the logical set; locale sidecars only replace content.
 */
export function getCommandTemplates(
  language: SupportedLanguage = DEFAULT_LANGUAGE,
): CommonTemplate[] {
  const cached = cachedCommands.get(language);
  if (cached) return cached;
  const templates = getFlatMarkdownTemplates("commands", language);
  cachedCommands.set(language, templates);
  return templates;
}

/**
 * Get all skill templates (become auto-triggered skills on supporting platforms).
 * English files define the logical set; locale sidecars only replace content.
 */
export function getSkillTemplates(
  language: SupportedLanguage = DEFAULT_LANGUAGE,
): CommonTemplate[] {
  const cached = cachedSkills.get(language);
  if (cached) return cached;
  const templates = getFlatMarkdownTemplates("skills", language);
  cachedSkills.set(language, templates);
  return templates;
}

function loadDescriptionFile(relativePath: string): CommonDescriptionTemplates {
  try {
    const parsed = JSON.parse(
      readTemplate(relativePath),
    ) as Partial<CommonDescriptionTemplates>;
    return {
      skills: parsed.skills ?? {},
      commands: parsed.commands ?? {},
    };
  } catch {
    return { skills: {}, commands: {} };
  }
}

/** Load generated skill/command descriptions with per-key English fallback. */
export function getCommonDescriptions(
  language: SupportedLanguage = DEFAULT_LANGUAGE,
): CommonDescriptionTemplates {
  const cached = cachedDescriptions.get(language);
  if (cached) return cached;

  const english = loadDescriptionFile("descriptions.json");
  if (language === DEFAULT_LANGUAGE) {
    cachedDescriptions.set(language, english);
    return english;
  }

  const selected = selectLocalizedTemplateFiles(
    readdirSync(__dirname),
    ".json",
    language,
  ).find(({ logicalFile }) => logicalFile === "descriptions.json");
  const localized = selected
    ? loadDescriptionFile(selected.sourceFile)
    : { skills: {}, commands: {} };
  const result = {
    skills: { ...english.skills, ...localized.skills },
    commands: { ...english.commands, ...localized.commands },
  };
  cachedDescriptions.set(language, result);
  return result;
}

/** Get one generated skill matcher description. */
export function getSkillDescription(
  name: string,
  language: SupportedLanguage = DEFAULT_LANGUAGE,
): string | undefined {
  return getCommonDescriptions(language).skills[name];
}

/** Get one generated command-palette description. */
export function getCommandDescription(
  name: string,
  language: SupportedLanguage = DEFAULT_LANGUAGE,
): string | undefined {
  return getCommonDescriptions(language).commands[name];
}

/** Get the locale-selected class-2 pull-based agent prelude template. */
export function getPullBasedPreludeTemplate(
  language: SupportedLanguage = DEFAULT_LANGUAGE,
): string {
  const cached = cachedPullBasedPreludes.get(language);
  if (cached !== undefined) return cached;

  const selected = selectLocalizedTemplateFiles(
    listMarkdownFiles("agent-preludes"),
    ".md",
    language,
  ).find(({ logicalFile }) => logicalFile === "pull-based.md");
  if (!selected) {
    throw new Error("Missing common agent prelude template: pull-based.md");
  }
  const content = readTemplate(`agent-preludes/${selected.sourceFile}`);
  cachedPullBasedPreludes.set(language, content);
  return content;
}

function listDirectories(dir: string): string[] {
  try {
    return readdirSync(join(__dirname, dir))
      .filter((entry) => statSync(join(__dirname, dir, entry)).isDirectory())
      .sort();
  } catch {
    return [];
  }
}

function toPosixRelativePath(root: string, filePath: string): string {
  return relative(root, filePath).split(sep).join("/");
}

function listBundledSkillFiles(
  skillDir: string,
  language: SupportedLanguage,
): CommonBundledSkillFile[] {
  const root = join(__dirname, "bundled-skills", skillDir);
  const discovered: string[] = [];

  function walk(dir: string): void {
    for (const entry of readdirSync(dir).sort()) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        walk(fullPath);
      } else {
        discovered.push(toPosixRelativePath(root, fullPath));
      }
    }
  }

  walk(root);
  const selectedMarkdown = selectLocalizedTemplateFiles(
    discovered,
    ".md",
    language,
  );
  const selectedMarkdownSources = new Set(
    selectedMarkdown.map(({ sourceFile }) => sourceFile),
  );
  const sourceToLogical = new Map(
    selectedMarkdown.map(({ logicalFile, sourceFile }) => [
      sourceFile,
      logicalFile,
    ]),
  );
  const selectedFiles = discovered
    .filter(
      (relativePath) =>
        !relativePath.endsWith(".md") ||
        selectedMarkdownSources.has(relativePath),
    )
    .map((sourceFile) => ({
      relativePath: sourceToLogical.get(sourceFile) ?? sourceFile,
      content: readFileSync(join(root, ...sourceFile.split("/")), "utf-8"),
    }));

  return selectedFiles.sort((a, b) =>
    a.relativePath.localeCompare(b.relativePath),
  );
}

/**
 * Get all multi-file built-in skills.
 *
 * These are copied as complete skill directories so references and assets stay
 * lazy-loadable instead of being flattened into one oversized SKILL.md.
 */
export function getBundledSkillTemplates(
  language: SupportedLanguage = DEFAULT_LANGUAGE,
): CommonBundledSkill[] {
  const cached = cachedBundledSkills.get(language);
  if (cached) return cached;
  const templates = listDirectories("bundled-skills").map((name) => ({
    name,
    files: listBundledSkillFiles(name, language),
  }));
  cachedBundledSkills.set(language, templates);
  return templates;
}
