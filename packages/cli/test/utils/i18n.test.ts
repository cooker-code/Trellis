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
import { getSpecTemplateContent } from "../../src/templates/markdown/index.js";

const englishWorkflowSource = fs.readFileSync(
  new URL("../../src/templates/trellis/workflow.md", import.meta.url),
  "utf-8",
);
const chineseWorkflowSource = fs.readFileSync(
  new URL("../../src/templates/trellis/workflow.zh.md", import.meta.url),
  "utf-8",
);

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

describe("getSpecTemplateContent", () => {
  it("selects compound-suffix spec sources without locale cache leakage", () => {
    const source = "spec/backend/index.md.txt";
    const english = fs.readFileSync(
      new URL(`../../src/templates/markdown/${source}`, import.meta.url),
      "utf-8",
    );
    const chinese = fs.readFileSync(
      new URL(
        "../../src/templates/markdown/spec/backend/index.zh.md.txt",
        import.meta.url,
      ),
      "utf-8",
    );

    expect(getSpecTemplateContent(source, "en")).toBe(english);
    expect(getSpecTemplateContent(source, "zh")).toBe(chinese);
    expect(getSpecTemplateContent(source, "en")).toBe(english);
    expect(getSpecTemplateContent(source, "ja")).toBe(english);
  });
});

describe("getWorkflowTemplate", () => {
  it("returns the exact English source for default locale", () => {
    expect(getWorkflowTemplate("en")).toBe(englishWorkflowSource);
  });

  it("returns the complete Chinese source when zh exists", () => {
    const zh = getWorkflowTemplate("zh");

    expect(zh).toBe(chineseWorkflowSource);
    expect(zh).not.toContain("i18n PR1 placeholder note");
    expect(zh).toContain("## Phase 2：执行");
    expect(zh).toContain("#### 3.4 提交改动");
    expect(zh).toContain("## 自定义 Trellis（适用于 fork）");
  });

  it("falls back to exact English bytes for unsupported locale", () => {
    expect(getWorkflowTemplate("ja")).toBe(englishWorkflowSource);
  });
});
