/**
 * Qoder templates
 *
 * These are GENERIC templates for user projects.
 *
 * Directory structure:
 *   qoder/
 *   ├── agents/         # Multi-agent pipeline agents
 *   └── settings.json   # Settings configuration
 */

import {
  createTemplateReader,
  type AgentTemplate,
  type HookTemplate,
} from "../template-utils.js";
import { DEFAULT_LANGUAGE, type SupportedLanguage } from "../../utils/i18n.js";
export type { AgentTemplate, HookTemplate };

const { listMdAgents, getSettings } = createTemplateReader(import.meta.url);

export const getAllAgents = (
  language: SupportedLanguage = DEFAULT_LANGUAGE,
): AgentTemplate[] => listMdAgents("agents", language);
export const getSettingsTemplate = (): HookTemplate => getSettings();
