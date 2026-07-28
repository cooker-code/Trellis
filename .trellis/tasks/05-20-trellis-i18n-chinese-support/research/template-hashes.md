# 研究：`.template-hashes.json` 机制及 i18n（国际化）适配建议

- **调研问题**：i18n PR1 引入 `*.zh.md` 后，`.template-hashes.json` 是否需要适配
- **范围**：internal（内部代码）
- **日期**：2026-05-20

## 1. 文件 Schema（结构定义）与真实条目

文件路径：`.trellis/.template-hashes.json`（即 `path.join(cwd, DIR_NAMES.WORKFLOW, ".template-hashes.json")`，见 `packages/cli/src/utils/template-hash.ts:51`）。

Schema 版本 v2（`HASHES_SCHEMA_VERSION = 2`）：

```json
{
  "__version": 2,
  "hashes": {
    ".claude/skills/trellis-meta/SKILL.md": "942e898a6fd769a93a3ca6f43f9fe0412d0adae011654fd384e9cacbd2af4f34",
    ".cursor/skills/trellis-meta/SKILL.md": "942e898a6fd769a93a3ca6f43f9fe0412d0adae011654fd384e9cacbd2af4f34"
  }
}
```

关键事实（`template-hash.ts` + `update.ts` 推断）：

- **Key**：相对项目根 `cwd` 的 **POSIX 风格落地路径**（永远 `/`，所有 key 经 `toPosix()` 归一化，见 `template-hash.ts:57-63, 110-117`）。
- **Value**：对应**落地文件内容**的 SHA256，对内容做了 CRLF→LF 归一化后再 hash（`computeHash`，`template-hash.ts:42-45`）。
- 旧的扁平 schema（无 `__version`）在 `loadHashes` 中被静默丢弃，由后续 init/update 重新生成（`template-hash.ts:67-103`）。
- 同一份模板内容会在多平台 key 下重复出现（如 `.claude/...` 与 `.cursor/...` 的 SKILL.md 共用同一 hash），证实 **value = 内容 hash 而非源标识**。

## 2. 谁写谁读

| 时机 | 模块 | 行为 |
|---|---|---|
| `trellis init` | `commands/init.ts:1759-1806` + `utils/file-writer.ts:55-75` | 先 `startRecordingWrites(cwd)` 收集真实写入路径，再 `initializeHashes(cwd, { trackedPaths })` 把这些路径 hash 入表；额外对 `.trellis/` 走目录递归 |
| `trellis init --reinit`（新增平台） | `commands/init.ts:861-869` | 与 init 类似，但 `merge: true`，保留旧平台条目 |
| `trellis update` | `commands/update.ts` | 读：`loadHashes` 跑 `analyzeChanges` 与 `classifyMigrations`；写：成功覆盖 / 自动更新后 `updateHashes`，rename 时 `renameHash`，删除时 `removeHash` |
| `trellis update`（self-heal） | `utils/manifest-prune.ts` | 删除"无人认领"的 key（早期 bug 把 `.codex/sessions/*` 等用户数据扫进来过）。**`.trellis/*` 永远保留**（`manifest-prune.ts:141-144`） |
| `trellis uninstall` | `commands/uninstall.ts`（间接） | 用 manifest 决定哪些路径是 trellis 写过的，逐一 unlink；`.trellis/` 整体 `rm -rf` |

写入 API 集中在 `template-hash.ts`：`saveHashes / updateHashes / updateHashFromFile / removeHash / renameHash / initializeHashes`。

## 3. “用户手改”判定算法

核心在 `commands/update.ts:697-762 (analyzeChanges)`：

```
对每个 [relativePath, newContent] in templates:
  fullPath = cwd/relativePath
  if !exists(fullPath):
      hashes[relativePath] ? userDeletedFiles : newFiles
  else:
      existing = read(fullPath)
      if existing == newContent:        → unchangedFiles
      else:
          storedHash = hashes[relativePath]
          currentHash = computeHash(existing)
          if storedHash == currentHash  → autoUpdateFiles  (模板新版本，用户没改)
          else                          → changedFiles    (模板新版本 + 用户改过，需确认)
```

要点：

- 比较是 **「磁盘当前内容 hash」 vs 「manifest 里记的 hash」**。manifest 里的 hash 一定来自 **上次写入时的 `newContent`**（即 init 时模板源内容 / update 时新模板内容）。源文件名（带不带 `.zh.` 后缀）从未进入计算。
- `templates` Map 由 `collectTemplateFiles` 生成，key 是落地路径（如 `.trellis/workflow.md`），value 是要写入的内容字节。
- 没有 storedHash 又不在 `LEGACY_UNTRACKED_AGENTS_MD_BLOCK_HASHES` 白名单里的，**保守判为"改过"**（`update.ts:743-756`、`template-hash.ts:202-205`）。

## 4. i18n 引入后的潜在冲突点

PRD 决策：模板源新增 `workflow.zh.md`，sync 时按 `language` 选源，**统一落地为 `workflow.md`**。

- **R2 第 3 条要求"`.template-hashes.json` 跟踪原模板路径（包含后缀）"** 与现有契约**直接冲突**：
  - 现有契约下 key 永远是落地路径 `.trellis/workflow.md`，value 是落地内容 hash。`isTemplateModified` / `analyzeChanges` 在比较时只读 `cwd/.trellis/workflow.md`，根本不知道源是不是 `.zh.md`。
  - 如果按 R2 字面意义把 key 写成 `.trellis/workflow.zh.md`，下次 update 比对时 `templates` Map 仍按落地路径 `.trellis/workflow.md` 查 hash → `storedHash = undefined` → 全部判定为"用户手改过" → 退化成强提示。
- **切换语言场景**：用户从 `language=en` → `zh` → 重跑 sync。
  - 新模板内容 = 中文 workflow.zh.md 的字节。落地后 `.trellis/workflow.md` 内容变成中文。`updateHashes` 把 key=`.trellis/workflow.md` 的 hash 更新为「中文内容 hash」。✅ 一致。
  - 反向切回 `en` 也一样：新模板内容 = 英文，落地内容 = 英文，hash 重写为英文 hash。✅ 一致。
- **关键约束**：sync **必须**在写入"落地"文件后立即 `updateHashes(cwd, {<landedPath>: <landedContent>})`，不能跳过。否则下次 update 会把切语言后的新落地内容当成"用户手改"。
- **manifest-prune 影响**：`buildKnownKeys` 走 `collectPlatformTemplates(id)`，那里 key 也都是落地路径。只要 i18n sync 不引入 `.zh.md` 后缀的落地 key，prune 行为不受影响。
- **migration manifest 影响**：现有 0.5.x 各 migration 的 `from`/`to` 都是英文落地路径，与 i18n 选源逻辑解耦，无影响。

## 5. 最小改动方案建议

**核心原则：`.template-hashes.json` 只管"落地"，不管"来源"。i18n 是「源选择」层，对 hash 系统透明。**

1. **不要修改 R2 第 3 条字面意思**。把它重新表述为：
   > `.template-hashes.json` 仍以落地路径（如 `.trellis/workflow.md`）为 key、以落地内容 hash 为 value；i18n 的源后缀逻辑发生在 `collectTemplateFiles` 上游，对 hash 透明。
2. 在 `collectTemplateFiles`（或新增的 i18n 选源 helper）里：
   - 输入：当前 `language`、模板目录扫描结果
   - 输出：`Map<landedPath, content>`，其中 `landedPath` 始终脱后缀。
   - sync 时 `language=zh`：先查 `<file>.zh.md` 是否存在，存在则 content 取它、key 仍写 `<file>.md`；不存在则回落到 `<file>.md`。
3. 对 `analyzeChanges` / `updateHashes` / `manifest-prune` / migrations **零改动**。
4. （可选增强）切换 `language` 时给出提示 "下次 update 时已修改过 `.trellis/workflow.md` 的用户会被询问是否覆盖"，这是 PRD 已声明的可接受行为（"切换语言 = 改 config + 重跑 sync"）。
5. **drift 检测脚本** `check-i18n-drift.js` 不应读 `.template-hashes.json`——它要的是模板源 git history（英文文件 mtime/git hash 是否新于 `.zh.md`），与本 manifest 完全解耦。

### 验收要点
- 切换 `language` 后跑 sync，`.template-hashes.json` 中 `.trellis/workflow.md` 的 hash 必须更新为新落地内容 hash。
- 再次 `trellis update`（CLI 升级）应识别"未手改"并自动更新（不进 `changedFiles`）。
- 删除 `workflow.zh.md` 后 `language=zh` 跑 sync 应无声回落英文，且 hash 更新为英文 hash。

## 注意事项 / 未发现项

- 未发现现有 `sync` 命令；当前模板写入分散在 `init` / `update` 两条路径。PR1 需要决定：i18n 选源逻辑落在 `collectTemplateFiles`（被 update 调用）还是新建独立 `sync` 命令。两条路径都需要套上同一选源 helper。
- 未读到 `commands/uninstall.ts` 全文，但 `manifest-prune.ts:18-21` 注释明确 uninstall 用 manifest 决定 unlink 列表——i18n 透明落地路径意味着 uninstall 行为不变。
