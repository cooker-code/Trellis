#!/usr/bin/env node
/**
 * i18n drift detector.
 *
 * Generic checks verify that every `*.zh.*` template has an English
 * counterpart and warn when the English source is newer in Git. The bundled
 * workflow pair additionally receives a content-based structural comparison,
 * because workflow.md is runtime input as well as documentation.
 *
 * Warning-only by default. Use `--strict` to fail with a non-zero exit code.
 *
 * Usage:
 *   node scripts/check-i18n-drift.js [--strict]
 *   pnpm run i18n:check
 */
import { execFileSync, execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const __dirname = path.dirname(SCRIPT_PATH);
const TEMPLATES_DIR = path.resolve(__dirname, "../src/templates");
const PACKAGE_ROOT = path.resolve(__dirname, "..");
const WORKFLOW_ZH_PATH = path.join(TEMPLATES_DIR, "trellis", "workflow.zh.md");
const PYTHON_STRINGS_DIR = path.join(
  TEMPLATES_DIR,
  "trellis",
  "scripts",
  "common",
  "i18n_strings",
);

const WORKFLOW_STATE_MARKER_RE = /^\[\/?workflow-state:[A-Za-z0-9_-]+\]\s*$/gm;
const PLATFORM_MARKER_RE = /^\[\/?[A-Za-z][^\[\]]*\]\s*$/gm;
const STEP_LINE_RE = /^(?:####\s+|-\s+)(\d+\.\d+)\b(.*)$/gm;
const HEADING_RE = /^(#{1,6})\s+(.+)$/gm;
const PHASE_REFERENCE_RE = /\b(?:Phase|Step)[ \t]+\d+(?:\.\d+)?\b/g;
const INLINE_CODE_RE = /`([^`\n]+)`/g;
const PLACEHOLDER_RE = /<(?!\!--)[^>\n]+>/g;
const LINK_TARGET_RE = /\]\(([^)\n]+)\)/g;
const HTML_COMMENT_RE = /<!--[\s\S]*?-->/g;
const CHINESE_RE = /[\u3400-\u9fff]/;
const HANDLEBAR_PLACEHOLDER_RE = /\{\{[^{}\n]+\}\}/g;
const GENERIC_PATH_RE =
  /(?:\.{1,2}\/|\.[A-Za-z0-9_-]+\/|\{[A-Z_]+\}\/)(?:[A-Za-z0-9_{}<>*-]+(?:[./][A-Za-z0-9_{}<>*-]+)*\/?)?/g;
const GENERIC_STRUCTURAL_PATH_RE =
  /(?:^|\/)(?:common\/(?:commands|skills|agent-preludes)\/|common\/descriptions\.zh\.json$|(?:claude|cursor|opencode|codex|kiro|gemini|qoder|codebuddy|pi)\/agents\/|droid\/droids\/)/;
const TASK_SUBCOMMAND_CONTEXT_RE =
  /\btask\.py[ \t]+([a-z][a-z0-9]*(?:-[a-z0-9]+)*)\b/g;
const STATUS_ASSIGNMENT_CONTEXT_RE =
  /\bstatus\s*=\s*(['"`]?)([A-Za-z][A-Za-z0-9_-]*)\1/g;

function collectMatches(content, regex, group = 0) {
  return [...content.matchAll(regex)].map((match) => match[group]);
}

function sortedMultiset(values) {
  return [...values].sort((a, b) => a.localeCompare(b));
}

function extractFenceStructure(content) {
  const markers = [];
  const stacks = { "`": [], "~": [] };

  for (const line of content.split(/\r?\n/)) {
    const match = /^\s*(`{3,}|~{3,})([^\n]*)$/.exec(line);
    if (!match) continue;

    const delimiter = match[1];
    const info = match[2].trim();
    markers.push(`${delimiter}|${info}`);

    const kind = delimiter[0];
    const stack = stacks[kind];
    if (stack.length === 0) {
      stack.push(delimiter.length);
    } else if (info === "" && delimiter.length >= stack[stack.length - 1]) {
      stack.pop();
    } else {
      stack.push(delimiter.length);
    }
  }

  return {
    markers,
    balanced: stacks["`"].length === 0 && stacks["~"].length === 0,
  };
}

function extractFencedTechnicalLines(content) {
  const technicalLines = [];
  let activeLanguage = null;
  let activeDelimiter = null;

  for (const line of content.split(/\r?\n/)) {
    const fence = /^\s*(`{3,}|~{3,})([^\n]*)$/.exec(line);
    if (fence) {
      const delimiter = fence[1];
      const info = fence[2].trim();
      if (activeDelimiter === null) {
        activeDelimiter = delimiter;
        activeLanguage = info;
      } else if (
        info === "" &&
        delimiter[0] === activeDelimiter[0] &&
        delimiter.length >= activeDelimiter.length
      ) {
        activeDelimiter = null;
        activeLanguage = null;
      }
      continue;
    }

    if (activeLanguage === "bash") {
      const command = line.replace(/\s+#.*$/, "").trim();
      if (command && !command.startsWith("#")) {
        technicalLines.push(
          command.replace(
            /(--(?:title|summary)\s+)(?:"[^"]*"|'[^']*')/g,
            '$1"<translated-value>"',
          ),
        );
      }
    } else if (activeLanguage === "json" && line.trim()) {
      const jsonLine = line.trim();
      technicalLines.push(
        /^"[^"]+"\s*,?$/.test(jsonLine)
          ? jsonLine.replace(/^"[^"]+"/, '"<translated-value>"')
          : jsonLine,
      );
    }
  }

  return technicalLines;
}

function extractInlineCode(content) {
  const values = [];
  for (const match of content.matchAll(INLINE_CODE_RE)) {
    const before = match.index === 0 ? "" : content[match.index - 1];
    const afterIndex = match.index + match[0].length;
    const after = afterIndex >= content.length ? "" : content[afterIndex];
    if (before !== "`" && after !== "`") values.push(match[0]);
  }
  return sortedMultiset(values);
}

function extractProtectedTokens(content) {
  const withoutInlineCode = content.replace(INLINE_CODE_RE, "");
  const patterns = [
    /\/trellis(?::|-)[A-Za-z0-9-]+|\/finish-work/g,
    /--[A-Za-z0-9][A-Za-z0-9-]*/g,
    /\b(?:TRELLIS_[A-Z0-9_]+|[A-Z][A-Z0-9_]*(?:_ID|_PATH|_DIR|_FILE))\b/g,
    /\b(?:no_task|planning-inline|in_progress-inline|in_progress|completed)\b/g,
    /\b(?:after_create|after_start|after_finish|after_archive)\b/g,
    /\b[A-Za-z0-9_-]+\.(?:md|jsonl|json|py|yaml|yml)\b/g,
    /(?:\.{1,2}\/|\.[A-Za-z0-9_-]+\/|\{[A-Z_]+\}\/)[A-Za-z0-9_{}<>\-./*]+/g,
    /\btrellis-(?:brainstorm|before-dev|implement|research|check|update-spec|break-loop)\b/g,
    /\b[a-z][a-z0-9]*(?:_[a-z0-9]+)+\b/g,
    /\b[A-Z][a-z0-9]+(?:[A-Z][A-Za-z0-9]*)+\b/g,
    /Refer to workflow\.md for current step\./g,
  ];

  const tokens = [];
  for (const pattern of patterns)
    tokens.push(...collectMatches(withoutInlineCode, pattern));
  for (const match of withoutInlineCode.matchAll(TASK_SUBCOMMAND_CONTEXT_RE)) {
    tokens.push(`task.py ${match[1]}`);
  }
  for (const match of withoutInlineCode.matchAll(
    STATUS_ASSIGNMENT_CONTEXT_RE,
  )) {
    tokens.push(`status=${match[2]}`);
  }
  return sortedMultiset(tokens);
}

function extractHeadingOutline(content) {
  return [...content.matchAll(HEADING_RE)].map((match) => {
    const level = match[1].length;
    const text = match[2];
    const step = /^(\d+\.\d+)\b/.exec(text);
    if (step) return `${level}:step:${step[1]}`;
    const phase = /\bPhase\s+(\d+)\b/.exec(text);
    if (phase) return `${level}:phase:${phase[1]}`;
    return `${level}:translated`;
  });
}

/** Extract the machine-significant structure of a workflow template. */
export function extractWorkflowStructure(content) {
  const workflowStateMarkers = collectMatches(
    content,
    WORKFLOW_STATE_MARKER_RE,
  ).map((line) => line.trim());
  const platformMarkers = collectMatches(content, PLATFORM_MARKER_RE)
    .map((line) => line.trim())
    .filter((line) => !/^\[\/?workflow-state:/.test(line));
  const stepHeadings = [...content.matchAll(STEP_LINE_RE)].map((match) => {
    const qualifier = /`\[[^\]\n]+\]`/.exec(match[2])?.[0];
    return qualifier ? `${match[1]} ${qualifier}` : match[1];
  });
  const fences = extractFenceStructure(content);
  const withoutComments = content.replace(HTML_COMMENT_RE, "");

  return {
    workflowStateMarkers,
    platformMarkers,
    stepHeadings,
    phaseReferences: collectMatches(content, PHASE_REFERENCE_RE),
    headingOutline: extractHeadingOutline(content),
    fenceMarkers: fences.markers,
    fencesBalanced: fences.balanced,
    fencedTechnicalLines: extractFencedTechnicalLines(content),
    inlineCode: extractInlineCode(content),
    placeholders: sortedMultiset(
      collectMatches(withoutComments, PLACEHOLDER_RE),
    ),
    linkTargets: collectMatches(content, LINK_TARGET_RE, 1),
    protectedTokens: extractProtectedTokens(content),
    htmlCommentCount: collectMatches(content, HTML_COMMENT_RE).length,
  };
}

function firstSequenceDifference(expected, actual) {
  const length = Math.max(expected.length, actual.length);
  for (let index = 0; index < length; index += 1) {
    if (expected[index] !== actual[index]) {
      return `index ${index}: expected ${JSON.stringify(expected[index])}, got ${JSON.stringify(actual[index])}`;
    }
  }
  return "unknown difference";
}

/** Compare English and localized workflow structures category by category. */
export function compareWorkflowStructure(englishContent, localizedContent) {
  const english = extractWorkflowStructure(englishContent);
  const localized = extractWorkflowStructure(localizedContent);
  const diagnostics = [];
  const sequenceCategories = [
    ["workflow-state markers", "workflowStateMarkers"],
    ["platform markers", "platformMarkers"],
    ["Step headings/qualifiers", "stepHeadings"],
    ["Phase/Step references", "phaseReferences"],
    ["Markdown heading outline", "headingOutline"],
    ["code fences", "fenceMarkers"],
    ["fenced technical lines", "fencedTechnicalLines"],
    ["inline code", "inlineCode"],
    ["placeholders/XML tags", "placeholders"],
    ["link targets", "linkTargets"],
    ["protected lexical tokens", "protectedTokens"],
  ];

  for (const [category, key] of sequenceCategories) {
    const expected = english[key];
    const actual = localized[key];
    if (JSON.stringify(expected) !== JSON.stringify(actual)) {
      diagnostics.push({
        category,
        message: firstSequenceDifference(expected, actual),
      });
    }
  }

  if (!english.fencesBalanced || !localized.fencesBalanced) {
    diagnostics.push({
      category: "code fence balance",
      message: `English balanced=${english.fencesBalanced}, localized balanced=${localized.fencesBalanced}`,
    });
  }
  if (english.htmlCommentCount !== localized.htmlCommentCount) {
    diagnostics.push({
      category: "HTML comment count",
      message: `expected ${english.htmlCommentCount}, got ${localized.htmlCommentCount}`,
    });
  }

  return diagnostics;
}

/** Remove translated Markdown description prose while retaining schema fields. */
function markdownFrontmatterSignature(content) {
  if (!content.startsWith("---\n")) return null;
  const end = content.indexOf("\n---\n", 4);
  if (end < 0) return ["<unclosed-frontmatter>"];

  const kept = [];
  let skippingDescription = false;
  for (const line of content.slice(4, end).split("\n")) {
    if (line.startsWith("description:")) {
      skippingDescription = true;
      continue;
    }
    if (skippingDescription && /^\s/.test(line)) continue;
    skippingDescription = false;
    kept.push(line);
  }
  return kept;
}

function compareJsonShape(english, localized, prefix = "$") {
  const diagnostics = [];
  if (
    english === null ||
    localized === null ||
    typeof english !== "object" ||
    typeof localized !== "object"
  ) {
    return diagnostics;
  }

  const englishKeys = Object.keys(english).sort();
  const localizedKeys = Object.keys(localized).sort();
  if (JSON.stringify(englishKeys) !== JSON.stringify(localizedKeys)) {
    diagnostics.push({
      category: "JSON key schema",
      message: `${prefix}: expected ${JSON.stringify(englishKeys)}, got ${JSON.stringify(localizedKeys)}`,
    });
    return diagnostics;
  }

  for (const key of englishKeys) {
    diagnostics.push(
      ...compareJsonShape(english[key], localized[key], `${prefix}.${key}`),
    );
  }
  return diagnostics;
}

function genericPayload(filePath, content) {
  if (filePath.endsWith(".json")) {
    const parsed = JSON.parse(content);
    return typeof parsed.prompt === "string"
      ? parsed.prompt
      : JSON.stringify(parsed);
  }
  if (filePath.endsWith(".toml")) {
    const instructions =
      /developer_instructions\s*=\s*"""\r?\n([\s\S]*?)\r?\n"""/.exec(content);
    if (!instructions)
      throw new Error("developer_instructions triple-quoted string not found");
    return instructions[1];
  }
  return content;
}

/** Compare common/agent sidecars without requiring prose to remain English. */
export function compareLocalizedTemplateStructure(
  englishContent,
  localizedContent,
  localizedPath = "template.zh.md",
) {
  const diagnostics = [];
  let englishPayload;
  let localizedPayload;

  try {
    englishPayload = genericPayload(localizedPath, englishContent);
    localizedPayload = genericPayload(localizedPath, localizedContent);
  } catch (error) {
    return [
      {
        category: "localized format parse",
        message: error instanceof Error ? error.message : String(error),
      },
    ];
  }

  if (localizedPath.endsWith(".json")) {
    const englishJson = JSON.parse(englishContent);
    const localizedJson = JSON.parse(localizedContent);
    diagnostics.push(...compareJsonShape(englishJson, localizedJson));
    if (typeof englishJson.prompt === "string") {
      for (const key of ["name", "tools", "allowedTools", "hooks"]) {
        if (
          JSON.stringify(englishJson[key]) !==
          JSON.stringify(localizedJson[key])
        ) {
          diagnostics.push({
            category: "JSON protected field",
            message: `${key} differs`,
          });
        }
      }
    }
  } else if (localizedPath.endsWith(".md")) {
    const englishFrontmatter = markdownFrontmatterSignature(englishContent);
    const localizedFrontmatter = markdownFrontmatterSignature(localizedContent);
    if (
      JSON.stringify(englishFrontmatter) !==
      JSON.stringify(localizedFrontmatter)
    ) {
      diagnostics.push({
        category: "Markdown frontmatter schema",
        message: "non-description frontmatter differs",
      });
    }
  } else if (localizedPath.endsWith(".toml")) {
    const protectedAssignments = (content) =>
      content
        .split(/\r?\n/)
        .filter((line) =>
          /^(?:name|sandbox_mode|multi_agent|enabled)\s*=|^\[features(?:\.multi_agent_v2)?\]$/.test(
            line,
          ),
        );
    const englishAssignments = protectedAssignments(englishContent);
    const localizedAssignments = protectedAssignments(localizedContent);
    if (
      JSON.stringify(englishAssignments) !==
      JSON.stringify(localizedAssignments)
    ) {
      diagnostics.push({
        category: "TOML protected schema",
        message: firstSequenceDifference(
          englishAssignments,
          localizedAssignments,
        ),
      });
    }
  }

  const normalizeGenericTokens = (content) =>
    sortedMultiset([
      ...extractProtectedTokens(content).filter(
        (token) => !token.startsWith(".") && !token.startsWith("{"),
      ),
      ...collectMatches(content.replace(INLINE_CODE_RE, ""), GENERIC_PATH_RE),
    ]);
  const headingLevels = (content) =>
    [...content.matchAll(/^(#{1,6})\s+/gm)].map((match) => match[1].length);
  const sequenceCategories = [
    [
      "Handlebars placeholders",
      sortedMultiset(collectMatches(englishPayload, HANDLEBAR_PLACEHOLDER_RE)),
      sortedMultiset(
        collectMatches(localizedPayload, HANDLEBAR_PLACEHOLDER_RE),
      ),
    ],
    [
      "Markdown heading levels",
      headingLevels(englishPayload),
      headingLevels(localizedPayload),
    ],
    [
      "code fences",
      extractFenceStructure(englishPayload).markers,
      extractFenceStructure(localizedPayload).markers,
    ],
    [
      "inline code",
      extractInlineCode(englishPayload),
      extractInlineCode(localizedPayload),
    ],
    [
      "protected lexical tokens",
      normalizeGenericTokens(englishPayload),
      normalizeGenericTokens(localizedPayload),
    ],
  ];
  for (const [category, expected, actual] of sequenceCategories) {
    if (JSON.stringify(expected) !== JSON.stringify(actual)) {
      diagnostics.push({
        category,
        message: firstSequenceDifference(expected, actual),
      });
    }
  }

  if (
    !extractFenceStructure(englishPayload).balanced ||
    !extractFenceStructure(localizedPayload).balanced
  ) {
    diagnostics.push({
      category: "code fence balance",
      message: "English or localized template has unbalanced fences",
    });
  }
  if (!CHINESE_RE.test(localizedPayload)) {
    diagnostics.push({
      category: "translation completeness",
      message: "localized prose contains no Chinese text",
    });
  }

  const withoutFencedCode = (content) => {
    const proseLines = [];
    let activeFence = null;
    for (const line of content.split(/\r?\n/)) {
      const fence = /^\s*(`{3,}|~{3,})/.exec(line);
      if (fence) {
        if (activeFence === null) activeFence = fence[1];
        else if (
          fence[1][0] === activeFence[0] &&
          fence[1].length >= activeFence.length
        )
          activeFence = null;
        continue;
      }
      if (activeFence === null) proseLines.push(line);
    }
    return proseLines.join("\n");
  };
  const englishProse = withoutFencedCode(englishPayload);
  const localizedProse = withoutFencedCode(localizedPayload);
  const englishH2 = [...englishProse.matchAll(/^##\s+.+$/gm)];
  const localizedH2 = [...localizedProse.matchAll(/^##\s+.+$/gm)];
  for (let index = 0; index < localizedH2.length; index += 1) {
    const current = localizedH2[index];
    const end = localizedH2[index + 1]?.index ?? localizedProse.length;
    const section = localizedProse.slice(current.index, end).trim();
    const englishStart = englishH2[index]?.index;
    const englishEnd = englishH2[index + 1]?.index ?? englishProse.length;
    const englishSection =
      englishStart === undefined
        ? ""
        : englishProse.slice(englishStart, englishEnd).trim();
    if (!CHINESE_RE.test(section) && section !== englishSection) {
      diagnostics.push({
        category: "translation completeness",
        message: `H2 section lacks Chinese content: ${current[0]}`,
      });
    }
  }
  return diagnostics;
}

function sectionHasChinese(content, start, end) {
  return CHINESE_RE.test(content.slice(start, end));
}

function collectHumanFacingEnglishLines(content) {
  const lines = new Set();
  let activeFenceLanguage = null;
  let activeFenceDelimiter = null;

  for (const line of content.split(/\r?\n/)) {
    const fence = /^\s*(`{3,}|~{3,})([^\n]*)$/.exec(line);
    if (fence) {
      const delimiter = fence[1];
      const info = fence[2].trim();
      if (activeFenceDelimiter === null) {
        activeFenceDelimiter = delimiter;
        activeFenceLanguage = info;
      } else if (
        info === "" &&
        delimiter[0] === activeFenceDelimiter[0] &&
        delimiter.length >= activeFenceDelimiter.length
      ) {
        activeFenceDelimiter = null;
        activeFenceLanguage = null;
      }
      continue;
    }

    const trimmed = line.trim();
    if (
      !trimmed ||
      trimmed === "---" ||
      /^\[\/?(?:workflow-state:)?[^\]]+\]$/.test(trimmed) ||
      trimmed === '"Refer to workflow.md for current step."'
    ) {
      continue;
    }

    let candidate = trimmed;
    if (activeFenceLanguage === "bash") {
      if (!candidate.startsWith("#")) {
        if (/--(?:title|summary)\s+(?:"[^"]*"|'[^']*')/.test(candidate)) {
          lines.add(trimmed);
        }
        continue;
      }
      candidate = candidate.replace(/^#+\s*/, "");
    } else if (activeFenceLanguage === "json") {
      const humanValue = /^"([^"]+)"\s*,?$/.exec(candidate);
      if (!humanValue) continue;
      candidate = humanValue[1];
    }

    candidate = candidate
      .replace(INLINE_CODE_RE, "")
      .replace(PLACEHOLDER_RE, "")
      .replace(LINK_TARGET_RE, "")
      .replace(GENERIC_PATH_RE, "")
      .replace(/https?:\/\/\S+/g, "")
      .replace(/[#>*_|()[\]{}:;,.=+\/\\-]/g, " ");
    const words = candidate.match(/\b[A-Za-z][A-Za-z'-]*\b/g) ?? [];
    const minimumWords =
      activeFenceLanguage === "json" || /^(?:#{1,6}\s+|\|)/.test(trimmed)
        ? 1
        : 2;
    if (words.length >= minimumWords) lines.add(trimmed);
  }

  return lines;
}

/** Check that the Chinese workflow is complete without banning technical English. */
export function checkChineseWorkflowCompleteness(content, englishContent = "") {
  const diagnostics = [];
  if (
    /i18n PR1 placeholder note|full Chinese translation lands/i.test(content)
  ) {
    diagnostics.push({
      category: "translation completeness",
      message: "PR1-A placeholder text is still present",
    });
  }

  const h2Matches = [...content.matchAll(/^##\s+.+$/gm)];
  for (let index = 0; index < h2Matches.length; index += 1) {
    const current = h2Matches[index];
    const end = h2Matches[index + 1]?.index ?? content.length;
    if (!sectionHasChinese(content, current.index, end)) {
      diagnostics.push({
        category: "translation completeness",
        message: `H2 section lacks Chinese content: ${current[0]}`,
      });
    }
  }

  const stepMatches = [...content.matchAll(/^####\s+(\d+\.\d+)\b.*$/gm)];
  for (let index = 0; index < stepMatches.length; index += 1) {
    const current = stepMatches[index];
    const nextHeading = /^#{2,4}\s+.+$/gm;
    nextHeading.lastIndex = current.index + current[0].length;
    const next = nextHeading.exec(content);
    const end = next?.index ?? content.length;
    if (!sectionHasChinese(content, current.index, end)) {
      diagnostics.push({
        category: "translation completeness",
        message: `Step ${current[1]} lacks Chinese content`,
      });
    }
  }

  const stateBlockRe =
    /\[workflow-state:([A-Za-z0-9_-]+)\]\s*\n([\s\S]*?)\n\s*\[\/workflow-state:\1\]/g;
  for (const match of content.matchAll(stateBlockRe)) {
    if (!CHINESE_RE.test(match[2])) {
      diagnostics.push({
        category: "translation completeness",
        message: `workflow-state:${match[1]} body lacks Chinese content`,
      });
    }
  }

  for (const lateSection of ["2.1", "3.4"]) {
    const match = new RegExp(
      `^####\\s+${lateSection.replace(".", "\\.")}\\b.*$`,
      "m",
    ).exec(content);
    if (!match || !sectionHasChinese(content, match.index, content.length)) {
      diagnostics.push({
        category: "translation completeness",
        message: `late-file Chinese sentinel missing for Step ${lateSection}`,
      });
    }
  }

  if (englishContent) {
    const humanFacingEnglishLines =
      collectHumanFacingEnglishLines(englishContent);
    const copiedLines = content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(
        (line) =>
          humanFacingEnglishLines.has(line) &&
          !/^<!-- prd-contract:(?:START|END) -->$/.test(line),
      );
    if (copiedLines.length > 0) {
      diagnostics.push({
        category: "translation completeness",
        message: `${copiedLines.length} untranslated English prose line(s) remain; first: ${JSON.stringify(copiedLines[0])}`,
      });
    }
  }

  return diagnostics;
}

export function isLocalizedTemplateFile(fileName) {
  return /\.zh\.(?:md(?:\.txt)?|json|toml|py|yaml|yml|txt)$/.test(fileName);
}

function listZhFiles(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listZhFiles(full));
    } else if (entry.isFile() && isLocalizedTemplateFile(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

export function englishCounterpart(zhPath) {
  return zhPath.replace(/\.zh(?=\.)/, "");
}

function pythonFormatFields(value) {
  return [...value.matchAll(/\{([A-Za-z_][A-Za-z0-9_]*)\}/g)]
    .map((match) => match[1])
    .sort((left, right) => left.localeCompare(right));
}

/** Compare Python locale dictionaries without depending on key order. */
export function comparePythonStringBundles(english, localized) {
  const diagnostics = [];
  const englishKeys = Object.keys(english).sort();
  const localizedKeys = Object.keys(localized).sort();

  for (const key of englishKeys) {
    if (!(key in localized)) {
      diagnostics.push({ category: "missing localized key", message: key });
      continue;
    }
    const englishFields = pythonFormatFields(english[key]);
    const localizedFields = pythonFormatFields(localized[key]);
    if (JSON.stringify(englishFields) !== JSON.stringify(localizedFields)) {
      diagnostics.push({
        category: "Python placeholder mismatch",
        message: `${key}: expected ${JSON.stringify(englishFields)}, got ${JSON.stringify(localizedFields)}`,
      });
    }
  }

  for (const key of localizedKeys) {
    if (!(key in english)) {
      diagnostics.push({ category: "orphan localized key", message: key });
    }
  }
  return diagnostics;
}

function loadPythonStringBundle(filePath) {
  const pythonCommand = process.platform === "win32" ? "python" : "python3";
  const loader = [
    "import json, runpy, sys",
    "strings = runpy.run_path(sys.argv[1]).get('STRINGS', {})",
    "print(json.dumps(strings, ensure_ascii=False))",
  ].join("; ");
  const output = execFileSync(pythonCommand, ["-c", loader, filePath], {
    cwd: PACKAGE_ROOT,
    encoding: "utf-8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  return JSON.parse(output);
}

function checkPythonStringBundles() {
  const englishPath = path.join(PYTHON_STRINGS_DIR, "en.py");
  const localizedPath = path.join(PYTHON_STRINGS_DIR, "zh.py");
  try {
    return comparePythonStringBundles(
      loadPythonStringBundle(englishPath),
      loadPythonStringBundle(localizedPath),
    );
  } catch (error) {
    return [
      {
        category: "Python bundle load failure",
        message: error instanceof Error ? error.message : String(error),
      },
    ];
  }
}

function gitLastCommitTime(filePath) {
  try {
    const out = execSync(
      `git log -1 --format=%ct -- ${JSON.stringify(filePath)}`,
      {
        cwd: PACKAGE_ROOT,
        encoding: "utf-8",
        stdio: ["ignore", "pipe", "ignore"],
      },
    ).trim();
    return out ? Number(out) : null;
  } catch {
    return null;
  }
}

export function main(argv = process.argv.slice(2)) {
  const strict = new Set(argv).has("--strict");
  const zhFiles = listZhFiles(TEMPLATES_DIR);
  if (zhFiles.length === 0) {
    console.log("[i18n] no *.zh.* template files found — nothing to check.");
    return 0;
  }

  let missingCount = 0;
  let driftCount = 0;
  let structuralCount = 0;
  let pythonIssueCount = 0;
  const driftReports = [];

  for (const zhPath of zhFiles) {
    const enPath = englishCounterpart(zhPath);
    const relZh = path.relative(PACKAGE_ROOT, zhPath);
    const relEn = path.relative(PACKAGE_ROOT, enPath);

    if (!fs.existsSync(enPath)) {
      console.warn(
        `[i18n] MISSING English source for ${relZh} (expected ${relEn})`,
      );
      missingCount += 1;
      continue;
    }

    const normalizedZhPath = relZh.split(path.sep).join("/");
    const isWorkflow = path.resolve(zhPath) === path.resolve(WORKFLOW_ZH_PATH);
    if (isWorkflow || GENERIC_STRUCTURAL_PATH_RE.test(normalizedZhPath)) {
      const englishContent = fs.readFileSync(enPath, "utf-8");
      const localizedContent = fs.readFileSync(zhPath, "utf-8");
      const diagnostics = isWorkflow
        ? [
            ...compareWorkflowStructure(englishContent, localizedContent),
            ...checkChineseWorkflowCompleteness(
              localizedContent,
              englishContent,
            ),
          ]
        : compareLocalizedTemplateStructure(
            englishContent,
            localizedContent,
            normalizedZhPath,
          );
      if (diagnostics.length > 0) {
        structuralCount += diagnostics.length;
        console.warn(`[i18n] STRUCTURE mismatch for ${relZh}:`);
        for (const diagnostic of diagnostics) {
          console.warn(`  - ${diagnostic.category}: ${diagnostic.message}`);
        }
      }
    }

    const enTime = gitLastCommitTime(enPath);
    const zhTime = gitLastCommitTime(zhPath);
    if (enTime === null || zhTime === null) continue;
    if (enTime > zhTime) {
      driftCount += 1;
      driftReports.push({ relEn, relZh, enTime, zhTime });
    }
  }

  const pythonDiagnostics = checkPythonStringBundles();
  if (pythonDiagnostics.length > 0) {
    pythonIssueCount = pythonDiagnostics.length;
    console.warn("[i18n] Python string bundle mismatch:");
    for (const diagnostic of pythonDiagnostics) {
      console.warn(`  - ${diagnostic.category}: ${diagnostic.message}`);
    }
  }

  if (driftReports.length > 0) {
    console.warn("[i18n] DRIFT detected — translations may be stale:");
    for (const report of driftReports) {
      const enWhen = new Date(report.enTime * 1000).toISOString().slice(0, 10);
      const zhWhen = new Date(report.zhTime * 1000).toISOString().slice(0, 10);
      console.warn(
        `  - ${report.relEn} (${enWhen}) is newer than ${report.relZh} (${zhWhen})`,
      );
    }
  }

  console.log(
    `[i18n] checked ${zhFiles.length} translation(s): ${missingCount} missing, ${driftCount} drift, ${structuralCount} structural issue(s), ${pythonIssueCount} Python issue(s)`,
  );

  return strict &&
    (missingCount > 0 ||
      driftCount > 0 ||
      structuralCount > 0 ||
      pythonIssueCount > 0)
    ? 1
    : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH) {
  process.exitCode = main();
}
