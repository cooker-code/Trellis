/**
 * Tests for `utils/i18n.ts` (loadLanguageFromConfig / resolveLanguage /
 * validateLanguage) and `templates/trellis/index.ts` (getWorkflowTemplate).
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  DEFAULT_LANGUAGE,
  loadLanguageFromConfig,
  resolveLanguage,
  validateLanguage,
} from "../../src/utils/i18n.js";
import { getWorkflowTemplate } from "../../src/templates/trellis/index.js";

// =============================================================================
// validateLanguage
// =============================================================================

describe("validateLanguage", () => {
  it("returns the normalized code for supported values", () => {
    expect(validateLanguage("en")).toBe("en");
    expect(validateLanguage("zh")).toBe("zh");
    expect(validateLanguage("ZH")).toBe("zh");
    expect(validateLanguage("  en  ")).toBe("en");
  });

  it("returns null for unsupported / empty values", () => {
    expect(validateLanguage("ja")).toBeNull();
    expect(validateLanguage("")).toBeNull();
    expect(validateLanguage(undefined)).toBeNull();
  });
});

// =============================================================================
// loadLanguageFromConfig
// =============================================================================

describe("loadLanguageFromConfig", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "trellis-i18n-"));
    fs.mkdirSync(path.join(tmpDir, ".trellis"), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("reads bare `language: zh` line", () => {
    fs.writeFileSync(
      path.join(tmpDir, ".trellis", "config.yaml"),
      "language: zh\n",
    );
    expect(loadLanguageFromConfig(tmpDir)).toBe("zh");
  });

  it("strips inline comments", () => {
    fs.writeFileSync(
      path.join(tmpDir, ".trellis", "config.yaml"),
      "language: zh  # set to chinese\n",
    );
    expect(loadLanguageFromConfig(tmpDir)).toBe("zh");
  });

  it("strips quoted values", () => {
    fs.writeFileSync(
      path.join(tmpDir, ".trellis", "config.yaml"),
      'language: "en"\n',
    );
    expect(loadLanguageFromConfig(tmpDir)).toBe("en");
  });

  it("ignores commented-out lines (default config behavior)", () => {
    fs.writeFileSync(
      path.join(tmpDir, ".trellis", "config.yaml"),
      "# language: en\n",
    );
    expect(loadLanguageFromConfig(tmpDir)).toBeNull();
  });

  it("ignores indented `language:` keys (only top-level matters)", () => {
    fs.writeFileSync(
      path.join(tmpDir, ".trellis", "config.yaml"),
      "session:\n  language: zh\n",
    );
    expect(loadLanguageFromConfig(tmpDir)).toBeNull();
  });

  it("returns null for invalid value", () => {
    fs.writeFileSync(
      path.join(tmpDir, ".trellis", "config.yaml"),
      "language: ja\n",
    );
    expect(loadLanguageFromConfig(tmpDir)).toBeNull();
  });

  it("returns null when config does not exist", () => {
    expect(loadLanguageFromConfig(tmpDir)).toBeNull();
  });
});

// =============================================================================
// resolveLanguage (env > config > default)
// =============================================================================

describe("resolveLanguage", () => {
  let tmpDir: string;
  const ORIG_ENV = process.env.TRELLIS_LANGUAGE;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "trellis-i18n-resolve-"));
    fs.mkdirSync(path.join(tmpDir, ".trellis"), { recursive: true });
    delete process.env.TRELLIS_LANGUAGE;
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    if (ORIG_ENV === undefined) delete process.env.TRELLIS_LANGUAGE;
    else process.env.TRELLIS_LANGUAGE = ORIG_ENV;
  });

  it("returns default when nothing is configured", () => {
    expect(resolveLanguage(tmpDir)).toBe(DEFAULT_LANGUAGE);
  });

  it("env var takes precedence over config", () => {
    fs.writeFileSync(
      path.join(tmpDir, ".trellis", "config.yaml"),
      "language: en\n",
    );
    process.env.TRELLIS_LANGUAGE = "zh";
    expect(resolveLanguage(tmpDir)).toBe("zh");
  });

  it("config used when env is unset", () => {
    fs.writeFileSync(
      path.join(tmpDir, ".trellis", "config.yaml"),
      "language: zh\n",
    );
    expect(resolveLanguage(tmpDir)).toBe("zh");
  });

  it("invalid env value is ignored, falls back to config", () => {
    fs.writeFileSync(
      path.join(tmpDir, ".trellis", "config.yaml"),
      "language: zh\n",
    );
    process.env.TRELLIS_LANGUAGE = "ja";
    expect(resolveLanguage(tmpDir)).toBe("zh");
  });
});

// =============================================================================
// getWorkflowTemplate (locale source selection)
// =============================================================================

describe("getWorkflowTemplate", () => {
  it("returns English content for default locale", () => {
    const en = getWorkflowTemplate("en");
    expect(en.length).toBeGreaterThan(0);
    expect(en.startsWith("# Development Workflow")).toBe(true);
  });

  it("returns Chinese content when zh source exists", () => {
    const zh = getWorkflowTemplate("zh");
    expect(zh.length).toBeGreaterThan(0);
    // zh template (PR1 placeholder) starts with translated heading.
    expect(zh.startsWith("# 开发工作流")).toBe(true);
  });

  it("falls back to English for unsupported locale", () => {
    const fallback = getWorkflowTemplate("ja");
    const en = getWorkflowTemplate("en");
    expect(fallback).toBe(en);
  });
});
