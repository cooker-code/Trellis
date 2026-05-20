#!/usr/bin/env node
/**
 * i18n drift detector.
 *
 * Walks `packages/cli/src/templates/` and for every `*.zh.md` source it
 * checks:
 *   1. that the corresponding English `*.md` exists, and
 *   2. whether the English file has been modified more recently in git than
 *      the translation (`*.zh.md`). When so, prints a warning so translators
 *      know the translation is stale.
 *
 * Exits 0 even when drift is detected (warning-only, never blocks CI). Use
 * `--strict` to fail with non-zero on drift.
 *
 * Usage:
 *   node scripts/check-i18n-drift.js [--strict]
 *   pnpm run i18n:check
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = path.resolve(__dirname, "../src/templates");
const PACKAGE_ROOT = path.resolve(__dirname, "..");

const args = new Set(process.argv.slice(2));
const STRICT = args.has("--strict");

function listZhFiles(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listZhFiles(full));
    } else if (
      entry.isFile() &&
      /\.zh\.(md|py|yaml|yml|txt)$/.test(entry.name)
    ) {
      out.push(full);
    }
  }
  return out;
}

function englishCounterpart(zhPath) {
  // foo.zh.md -> foo.md ; bar.zh.py -> bar.py ; etc.
  return zhPath.replace(/\.zh(\.[^.]+)$/, "$1");
}

function gitLastCommitTime(filePath) {
  try {
    const out = execSync(
      `git log -1 --format=%ct -- ${JSON.stringify(filePath)}`,
      { cwd: PACKAGE_ROOT, encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] },
    ).trim();
    return out ? Number(out) : null;
  } catch {
    return null;
  }
}

function main() {
  const zhFiles = listZhFiles(TEMPLATES_DIR);
  if (zhFiles.length === 0) {
    console.log("[i18n] no *.zh.* template files found — nothing to check.");
    process.exit(0);
  }

  let missingCount = 0;
  let driftCount = 0;
  const driftReports = [];

  for (const zhPath of zhFiles) {
    const enPath = englishCounterpart(zhPath);
    const relZh = path.relative(PACKAGE_ROOT, zhPath);
    const relEn = path.relative(PACKAGE_ROOT, enPath);

    if (!fs.existsSync(enPath)) {
      console.warn(`[i18n] MISSING English source for ${relZh} (expected ${relEn})`);
      missingCount += 1;
      continue;
    }

    const enTime = gitLastCommitTime(enPath);
    const zhTime = gitLastCommitTime(zhPath);
    if (enTime === null || zhTime === null) {
      // One side untracked — likely WIP. Skip silently.
      continue;
    }
    if (enTime > zhTime) {
      driftCount += 1;
      driftReports.push({ relEn, relZh, enTime, zhTime });
    }
  }

  if (driftReports.length > 0) {
    console.warn("[i18n] DRIFT detected — translations may be stale:");
    for (const r of driftReports) {
      const enWhen = new Date(r.enTime * 1000).toISOString().slice(0, 10);
      const zhWhen = new Date(r.zhTime * 1000).toISOString().slice(0, 10);
      console.warn(
        `  - ${r.relEn} (${enWhen}) is newer than ${r.relZh} (${zhWhen})`,
      );
    }
  }

  console.log(
    `[i18n] checked ${zhFiles.length} translation(s): ${missingCount} missing, ${driftCount} drift`,
  );

  if (STRICT && (missingCount > 0 || driftCount > 0)) {
    process.exit(1);
  }
  process.exit(0);
}

main();
