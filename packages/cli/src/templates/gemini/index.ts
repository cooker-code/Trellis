/**
 * Gemini CLI templates
 *
 * Directory structure:
 *   gemini/
 *   ├── agents/        # Sub-agent definitions
 *   └── settings.json  # Settings configuration
 */

import { createTemplateReader, type AgentTemplate } from "../template-utils.js";
import { DEFAULT_LANGUAGE, type SupportedLanguage } from "../../utils/i18n.js";
export type { AgentTemplate };

const { listMdAgents, getConfig } = createTemplateReader(import.meta.url);

export const getAllAgents = (
  language: SupportedLanguage = DEFAULT_LANGUAGE,
): AgentTemplate[] => listMdAgents("agents", language);
export const getSettingsTemplate = (): string => getConfig("settings.json");
