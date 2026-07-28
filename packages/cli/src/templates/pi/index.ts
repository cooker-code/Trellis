import {
  createTemplateReader,
  type AgentTemplate,
  type HookTemplate,
} from "../template-utils.js";
import { DEFAULT_LANGUAGE, type SupportedLanguage } from "../../utils/i18n.js";

const { listMdAgents, getSettings, readTemplate } = createTemplateReader(
  import.meta.url,
);

export function getAllAgents(
  language: SupportedLanguage = DEFAULT_LANGUAGE,
): AgentTemplate[] {
  return listMdAgents("agents", language);
}

export function getSettingsTemplate(): HookTemplate {
  return getSettings();
}

export function getExtensionTemplate(): string {
  return readTemplate("extensions/trellis/index.ts.txt");
}
