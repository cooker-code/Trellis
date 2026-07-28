import path from "node:path";
import { AI_TOOLS } from "../types/ai-tools.js";
import { DEFAULT_LANGUAGE, type SupportedLanguage } from "../utils/i18n.js";
import { ensureDir, writeFile } from "../utils/file-writer.js";
import {
  applyPullBasedPreludeMarkdown,
  collectSkillTemplates,
  replacePythonCommandLiterals,
  resolveCommands,
  resolveBundledSkills,
  resolvePlaceholders,
  resolveSkillsNeutral,
  writeAgents,
  writeSkills,
} from "./shared.js";
import {
  getAllAgents,
  getExtensionTemplate,
  getSettingsTemplate,
} from "../templates/pi/index.js";

function resolvePiCommands(
  language: SupportedLanguage = DEFAULT_LANGUAGE,
): ReturnType<typeof resolveCommands> {
  const ctx = AI_TOOLS.pi.templateContext;
  const commands = resolveCommands(ctx, language);
  if (commands.some((command) => command.name === "start")) return commands;

  // Pi has extension hooks, so the shared command resolver filters `start`.
  // Keep a manual fallback because Pi's `session_start` event cannot mutate
  // model context; the strong startup injection happens later at agent start.
  const start = resolveCommands({ ...ctx, hasHooks: false }, language).find(
    (command) => command.name === "start",
  );
  return start ? [start, ...commands] : commands;
}

export function collectPiTemplates(
  language: SupportedLanguage = DEFAULT_LANGUAGE,
): Map<string, string> {
  const config = AI_TOOLS.pi;
  const ctx = config.templateContext;
  const files = new Map<string, string>();

  for (const command of resolvePiCommands(language)) {
    files.set(`.pi/prompts/trellis-${command.name}.md`, command.content);
  }

  // Shared skills go to `.agents/skills/` (Pi discovers this cross-platform
  // workspace alias natively). Neutral resolver keeps content byte-identical
  // to Codex's/Gemini's writes for the same skill names, avoiding the
  // duplicate/conflicting-skill installs reported in #447.
  for (const [filePath, content] of collectSkillTemplates(
    ".agents/skills",
    resolveSkillsNeutral(ctx, language),
    resolveBundledSkills(ctx, language),
  )) {
    files.set(filePath, content);
  }

  for (const agent of applyPullBasedPreludeMarkdown(
    getAllAgents(language),
    language,
  )) {
    files.set(`.pi/agents/${agent.name}.md`, agent.content);
  }

  files.set(".pi/extensions/trellis/index.ts", getExtensionTemplate());

  const settings = getSettingsTemplate();
  files.set(
    `.pi/${settings.targetPath}`,
    resolvePlaceholders(settings.content),
  );

  return files;
}

export async function configurePi(
  cwd: string,
  language: SupportedLanguage = DEFAULT_LANGUAGE,
): Promise<void> {
  const config = AI_TOOLS.pi;
  const ctx = config.templateContext;
  const configRoot = path.join(cwd, config.configDir);

  ensureDir(path.join(configRoot, "prompts"));
  for (const command of resolvePiCommands(language)) {
    await writeFile(
      path.join(configRoot, "prompts", `trellis-${command.name}.md`),
      command.content,
    );
  }

  // See collectPiTemplates(): shared skills now live in `.agents/skills/`,
  // deduped with Codex/Gemini (#447).
  await writeSkills(
    path.join(cwd, ".agents", "skills"),
    resolveSkillsNeutral(ctx, language),
    resolveBundledSkills(ctx, language),
  );
  await writeAgents(
    path.join(configRoot, "agents"),
    applyPullBasedPreludeMarkdown(getAllAgents(language), language),
  );

  ensureDir(path.join(configRoot, "extensions", "trellis"));
  await writeFile(
    path.join(configRoot, "extensions", "trellis", "index.ts"),
    replacePythonCommandLiterals(getExtensionTemplate()),
  );

  const settings = getSettingsTemplate();
  await writeFile(
    path.join(configRoot, settings.targetPath),
    resolvePlaceholders(settings.content),
  );
}
