/**
 * Factory Droid templates
 *
 * These are GENERIC templates for user projects.
 *
 * Directory structure:
 *   droid/
 *   ├── droids/         # Multi-agent pipeline droids (agents)
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

export const getAllDroids = (
  language: SupportedLanguage = DEFAULT_LANGUAGE,
): AgentTemplate[] => listMdAgents("droids", language);
export const getSettingsTemplate = (): HookTemplate => getSettings();
