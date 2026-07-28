/**
 * Cursor templates
 *
 * Directory structure:
 *   cursor/
 *   ├── agents/      # Sub-agent definitions
 *   └── hooks.json   # Hooks configuration
 */

import { createTemplateReader, type AgentTemplate } from "../template-utils.js";
import { DEFAULT_LANGUAGE, type SupportedLanguage } from "../../utils/i18n.js";
export type { AgentTemplate };

const { listMdAgents, getConfig } = createTemplateReader(import.meta.url);

export const getAllAgents = (
  language: SupportedLanguage = DEFAULT_LANGUAGE,
): AgentTemplate[] => listMdAgents("agents", language);
export const getHooksConfig = (): string => getConfig("hooks.json");
