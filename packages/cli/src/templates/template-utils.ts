/**
 * Shared utilities for platform template modules.
 * Eliminates boilerplate across qoder/, codebuddy/, droid/, cursor/, gemini/, kiro/ index.ts files.
 */

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_LANGUAGE,
  SUPPORTED_LANGUAGES,
  type SupportedLanguage,
} from "../utils/i18n.js";

export interface AgentTemplate {
  name: string;
  content: string;
}

export interface HookTemplate {
  targetPath: string;
  content: string;
}

export interface LocalizedTemplateSelection {
  /** Canonical English filename used as the logical destination identity. */
  logicalFile: string;
  /** Locale-selected source filename, or the English fallback. */
  sourceFile: string;
}

/**
 * Select locale sidecars while keeping the unsuffixed English files canonical.
 *
 * `semanticSuffix` is explicit so compound suffixes such as `.md.txt` resolve
 * as `foo.zh.md.txt` rather than the incorrect `foo.md.zh.txt`. Orphan locale
 * sidecars never create logical output.
 */
export function selectLocalizedTemplateFiles(
  files: readonly string[],
  semanticSuffix: string,
  language: SupportedLanguage = DEFAULT_LANGUAGE,
): LocalizedTemplateSelection[] {
  const fileSet = new Set(files);
  const localizedSuffixes = SUPPORTED_LANGUAGES.map(
    (code) => `.${code}${semanticSuffix}`,
  );
  const canonicalFiles = files
    .filter(
      (file) =>
        file.endsWith(semanticSuffix) &&
        !localizedSuffixes.some((suffix) => file.endsWith(suffix)),
    )
    .sort((a, b) => a.localeCompare(b));

  return canonicalFiles.map((logicalFile) => {
    if (language === DEFAULT_LANGUAGE) {
      return { logicalFile, sourceFile: logicalFile };
    }
    const stem = logicalFile.slice(0, -semanticSuffix.length);
    const localizedFile = `${stem}.${language}${semanticSuffix}`;
    return {
      logicalFile,
      sourceFile: fileSet.has(localizedFile) ? localizedFile : logicalFile,
    };
  });
}

export interface TemplateReader {
  readTemplate: (relativePath: string) => string;
  listFiles: (dir: string) => string[];
  listMdAgents: (dir?: string, language?: SupportedLanguage) => AgentTemplate[];
  listJsonAgents: (
    dir?: string,
    language?: SupportedLanguage,
  ) => AgentTemplate[];
  listTomlAgents: (
    dir?: string,
    language?: SupportedLanguage,
  ) => AgentTemplate[];
  getSettings: (filename?: string) => HookTemplate;
  getConfig: (filename: string) => string;
}

/**
 * Create a template reader bound to the caller's directory.
 * Usage: `const { readTemplate, listMdAgents, getSettings } = createTemplateReader(import.meta.url);`
 */
export function createTemplateReader(importMetaUrl: string): TemplateReader {
  const __dirname = dirname(fileURLToPath(importMetaUrl));

  function readTemplate(relativePath: string): string {
    return readFileSync(join(__dirname, relativePath), "utf-8");
  }

  function listFiles(dir: string): string[] {
    try {
      // Only regular files — skip dirs like __pycache__ that break readTemplate.
      return readdirSync(join(__dirname, dir), { withFileTypes: true })
        .filter((e) => e.isFile())
        .map((e) => e.name)
        .sort();
    } catch {
      return [];
    }
  }

  function listAgents(
    dir: string,
    semanticSuffix: ".md" | ".json" | ".toml",
    language: SupportedLanguage,
  ): AgentTemplate[] {
    return selectLocalizedTemplateFiles(
      listFiles(dir),
      semanticSuffix,
      language,
    ).map(({ logicalFile, sourceFile }) => ({
      name: logicalFile.slice(0, -semanticSuffix.length),
      content: readTemplate(`${dir}/${sourceFile}`),
    }));
  }

  /** Read locale-selected .md agent files from a subdirectory. */
  function listMdAgents(
    dir = "agents",
    language: SupportedLanguage = DEFAULT_LANGUAGE,
  ): AgentTemplate[] {
    return listAgents(dir, ".md", language);
  }

  /** Read locale-selected .json agent files from a subdirectory (Kiro). */
  function listJsonAgents(
    dir = "agents",
    language: SupportedLanguage = DEFAULT_LANGUAGE,
  ): AgentTemplate[] {
    return listAgents(dir, ".json", language);
  }

  /** Read locale-selected .toml agent files from a subdirectory (Codex). */
  function listTomlAgents(
    dir = "agents",
    language: SupportedLanguage = DEFAULT_LANGUAGE,
  ): AgentTemplate[] {
    return listAgents(dir, ".toml", language);
  }

  /** Read settings.json and return as HookTemplate */
  function getSettings(filename = "settings.json"): HookTemplate {
    return { targetPath: filename, content: readTemplate(filename) };
  }

  /** Read a config file and return raw string */
  function getConfig(filename: string): string {
    return readTemplate(filename);
  }

  return {
    readTemplate,
    listFiles,
    listMdAgents,
    listJsonAgents,
    listTomlAgents,
    getSettings,
    getConfig,
  };
}
