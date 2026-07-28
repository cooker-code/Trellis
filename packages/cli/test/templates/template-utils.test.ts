import { describe, expect, it } from "vitest";
import { selectLocalizedTemplateFiles } from "../../src/templates/template-utils.js";

describe("selectLocalizedTemplateFiles", () => {
  const files = [
    "zeta.md",
    "alpha.md",
    "alpha.zh.md",
    "orphan.zh.md",
    "nested/item.md",
  ];

  it("uses unsuffixed English files as the canonical logical set", () => {
    expect(selectLocalizedTemplateFiles(files, ".md", "en")).toEqual([
      { logicalFile: "alpha.md", sourceFile: "alpha.md" },
      { logicalFile: "nested/item.md", sourceFile: "nested/item.md" },
      { logicalFile: "zeta.md", sourceFile: "zeta.md" },
    ]);
  });

  it("selects locale sidecars with per-file English fallback", () => {
    expect(selectLocalizedTemplateFiles(files, ".md", "zh")).toEqual([
      { logicalFile: "alpha.md", sourceFile: "alpha.zh.md" },
      { logicalFile: "nested/item.md", sourceFile: "nested/item.md" },
      { logicalFile: "zeta.md", sourceFile: "zeta.md" },
    ]);
  });

  it("handles Markdown, TOML, JSON, and compound semantic suffixes", () => {
    const cases = [
      ["agent.md", "agent.zh.md", ".md"],
      ["agent.toml", "agent.zh.toml", ".toml"],
      ["agent.json", "agent.zh.json", ".json"],
      ["guide.md.txt", "guide.zh.md.txt", ".md.txt"],
    ] as const;

    for (const [english, chinese, suffix] of cases) {
      expect(
        selectLocalizedTemplateFiles([chinese, english], suffix, "zh"),
      ).toEqual([{ logicalFile: english, sourceFile: chinese }]);
    }
  });

  it("does not leak locale suffixes across en -> zh -> en calls", () => {
    const englishBefore = selectLocalizedTemplateFiles(files, ".md", "en");
    const chinese = selectLocalizedTemplateFiles(files, ".md", "zh");
    const englishAfter = selectLocalizedTemplateFiles(files, ".md", "en");

    expect(englishAfter).toEqual(englishBefore);
    expect(chinese).not.toEqual(englishBefore);
    for (const selection of [...englishBefore, ...chinese, ...englishAfter]) {
      expect(selection.logicalFile).not.toContain(".zh.");
    }
  });
});
