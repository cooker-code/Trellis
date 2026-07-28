# Sync（同步）/Init（初始化）调用链路与 i18n（国际化）介入点

> 调研时间：2026-05-20。来源：trellis-research sub-agent（子代理；agent a8189bfb）。
> 本文档是该次调研的内容存档，主线 implement 实施时可作单点参考。

## 1. 入口与命令

仓库**没有** `trellis sync` 命令。CLI 只有三个命令（`packages/cli/src/cli/index.ts:62-169`）：

| 命令 | 入口 | 作用 |
|---|---|---|
| `trellis init` | `commands/init.ts:1015` `init()` | 首次安装/再初始化（对应 PRD 中的 sync 落地时机） |
| `trellis update` | `commands/update.ts:1681` `update()` | 升级 CLI 后把模板差异同步到项目（事实上的 "sync"） |
| `trellis uninstall` | `commands/uninstall.ts` | 卸载 |

**PR1 必须同时挂入 init 和 update 两条路径。**

## 2. 调用链总览

### Init（初始化）路径

```
cli/index.ts:62 (program.command "init")
  → commands/init.ts:1015 init(options)
    → init.ts:1763 createWorkflowStructure(cwd, {projectType, ...})
      → configurators/workflow.ts:77 createWorkflowStructure
        → templates/extract.ts:109 copyTrellisDir("scripts", ...)
            → extract.ts:119 copyDirRecursive (readFileSync + writeFile)
        → utils/file-writer.ts:113 writeFile(workflow.md path, workflowMdTemplate)
        → writeFile(config.yaml path, configYamlTemplate)
        → writeFile(.gitignore path, gitignoreTemplate)
        → writeFile(workspace/index.md, agentProgressIndexContent)
        → workflow.ts:202 createSpecTemplates → writeFile(各 spec md)
    → init.ts:1787 configurePlatform(platformId, cwd)  # 每平台逐个执行
      → configurators/index.ts:522 PLATFORM_FUNCTIONS[id].configure(cwd)
    → init.ts:1806 initializeHashes(cwd, {trackedPaths: writtenPaths})
```

### Update（更新）路径

```
cli/index.ts:115 (program.command "update")
  → commands/update.ts:1681 update(options)
    → update.ts:1830 collectTemplateFiles(cwd, extraPlatforms?, breakingBypass)
        - getAllScripts() → "scripts/*"
        - workflowMdTemplate / configYamlTemplate / gitignoreTemplate
        - buildAgentsMdTemplate(cwd) 用于 AGENTS.md
        - 对每个 configured platform 调 collectPlatformTemplates(platformId)
            → configurators/index.ts:533 PLATFORM_FUNCTIONS[id].collectTemplates()
        - replacePythonCommandLiterals 对所有 content 兜底替换
    → update.ts:1974 analyzeChanges(cwd, hashes, templates)
    → update.ts:2197 fs.writeFileSync(...)  # newFiles
    → update.ts:2218 fs.writeFileSync(...)  # autoUpdateFiles
    → update.ts:2244 fs.writeFileSync(...)  # changedFiles 经用户确认
    → updateHashes(cwd, filesToHash)
```

## 3. 模板路径处理位置

模板文件名（hash 跟踪用、磁盘落地用）的"落地路径"在三个地方拼装：

1. **scripts 目录**：`extract.ts:119 copyDirRecursive` 直接保留源端目录结构（`templates/trellis/scripts/foo.py` → `<cwd>/.trellis/scripts/foo.py`）。**如果源里出现 `foo.zh.py`，默认会原样落盘成 `foo.zh.py`** —— PR1 必须脱后缀。
2. **trellis 根文件**：`configurators/workflow.ts:95-110` 显式 `writeFile(<cwd>/.trellis/workflow.md, workflowMdTemplate)` 等（hardcoded 落地名）。
3. **平台模板**：`PLATFORM_FUNCTIONS[id].collectTemplates()`（如 `index.ts:160-179` claude）显式拼接 `.claude/commands/trellis/${cmd.name}.md`、`.claude/skills/${skill.name}/SKILL.md` 等；`writeAgents/writeSkills`（`shared.ts:492/517`）直接使用 `skill.name`/`agent.name` 当目录/文件名。

**关键差异**：scripts 是"源结构=目标结构"递归拷贝；workflow.md / commands / skills 是"逻辑名 → 显式拼装目标路径"。

## 4. `templates/trellis/index.ts` 是硬编码

`templates/trellis/index.ts` **不是文件系统驱动**：

- `workflowMdTemplate = readTemplate("workflow.md")`（line 72，**模块加载即固定**）
- `getAllScripts()`（line 79-116）逐项 `scripts.set("common/foo.py", commonFoo)`

直接在 `templates/trellis/` 下放 `workflow.zh.md` **不会**被 `workflowMdTemplate` 自动捡到。必须：
- 在该 index.ts 显式增加 `readTemplate("workflow.zh.md")`
- **把 `workflowMdTemplate` 从顶层 const 改为接受 locale 的函数 `getWorkflowTemplate(locale)`**
- 更新所有四个引用点（`init.ts:43-44`、`update.ts:43`、`workflow.ts:9-11`、`update.ts:646`）

`templates/common/index.ts:65-83` 的 `getCommandTemplates / getSkillTemplates` 是**文件系统驱动**（`listMarkdownFiles("commands")`）。在 `common/commands/` 下加 `start.zh.md`，目前会**被当成新增的 command** —— PR1 需要在聚合层**过滤后缀并按 locale 二选一**。

平台模板的 `template-utils.ts:33 createTemplateReader` 的 `listMdAgents()` 同样 FS 驱动，但 PR1 范围 L2 不覆盖平台目录，可暂不动。

## 5. 介入点候选（带优劣）

### 候选 A：源端聚合层（`templates/trellis/index.ts` + `templates/common/index.ts`）——**推荐**
在 `getAllScripts()`、`workflowMdTemplate` 取值、`getCommandTemplates`/`getSkillTemplates` 内统一加 `pickByLocale(file)` 工具：优先 `*.zh.md`，缺则 `*.md`，**返回 key 始终是脱后缀名**。
- ✅ 调用方零改动：`workflow.ts:97`、`update.ts:646`、`PLATFORM_FUNCTIONS.collectTemplates`、`writeSkills/writeAgents` 全自动获益
- ✅ Hash 跟踪天然透明：键名一直是英文路径
- ✅ `extract.ts copyDirRecursive`（scripts 路径）需要单独打补丁——把"复制时如果同目录有 `*.zh.<ext>` 就用它，但落地名脱后缀"作为同一套规则
- ⚠️ 需引入"locale 解析"模块（读 `.trellis/config.yaml.language`）——必须在两个命令的入口尽早调用一次，缓存 module-level（参考 `shared.ts:23 resolvedPythonCommand` 的模式）

### 候选 B：写盘层（`utils/file-writer.ts writeFile`）——❌ 否决
writeFile 只接受 content 字符串，已无文件名上下文。

### 候选 C：`createTemplateReader` 包一层（`templates/template-utils.ts`）——折中
让 reader 自己做语言选择。
- ✅ 复用面广，平台模板未来要 i18n 时直接受益
- ❌ 现有 reader API 已四散；PR1 只翻译 workflow.md，改动面过大
- 折中：**先 A，预留 reader 升级接口给 PR2/PR3**

### 候选 D：CLI（命令行工具）入口注入（必做前置）
`init.ts:1015` / `update.ts:1681` 顶部读 config + flag，决定 locale 后调 `setResolvedLocale("zh")`。仅决定"locale 是什么"，真正的"按 locale 取文件"仍要靠 A。

**最终建议**：A + D 组合。

## 6. 现有 CLI flag / config 读取

- **没有** `--language` flag，没有任何 locale/i18n/语言相关代码
- **YAML 解析**：`update.ts:365 loadUpdateSkipPaths` 是手写的浅 YAML 解析（只识别顶层 key + list），仅支持 `update.skip` 路径。**没有通用的 config loader**。
- **monorepo 配置**：`init.ts:968 writeMonorepoConfig` 也是手写写盘 + `^packages\s*:` 正则探测
- **`.trellis/config.yaml`**：模板见 `templates/trellis/config.yaml`，目前没有 `language:` 字段
- Python 那一侧确实有 `templates/trellis/scripts/common/trellis_config.py`（已在 index.ts:60 导出），但 TS 端不读它

**PR1 必新增**：CLI TS 端的 `loadLanguage(cwd, override?)` 函数（仿 `loadUpdateSkipPaths` 浅 YAML 风格，**不引入 yaml 库**）。位置建议 `packages/cli/src/utils/config.ts` 或聚合到 `configurators/shared.ts`。同时给 `init` 和 `update` 命令注册 `--language <code>`。

## 7. 关键函数签名摘录

```ts
// configurators/workflow.ts:77
export async function createWorkflowStructure(
  cwd: string,
  options?: WorkflowOptions,
): Promise<void>

// commands/update.ts:610  ← update 路径汇集模板
function collectTemplateFiles(
  cwd: string,
  extraPlatforms?: Set<AITool>,
  bypassUpdateSkip = false,
): Map<string, string>

// configurators/index.ts:533  ← 每平台模板聚合
export function collectPlatformTemplates(
  platformId: AITool,
): Map<string, string> | undefined

// templates/trellis/index.ts:79
export function getAllScripts(): Map<string, string>

// templates/common/index.ts:65,77
export function getCommandTemplates(): CommonTemplate[]
export function getSkillTemplates(): CommonTemplate[]

// templates/extract.ts:109  ← scripts 走的递归拷贝
export async function copyTrellisDir(
  srcRelativePath: string,
  destPath: string,
  options?: { executable?: boolean },
): Promise<void>

// utils/file-writer.ts:113  ← 实际落盘
export async function writeFile(
  filePath: string,
  content: string,
  options?: { executable?: boolean },
): Promise<boolean>
```

## 8. 关键文件路径清单

- `packages/cli/src/cli/index.ts`
- `packages/cli/src/commands/init.ts`
- `packages/cli/src/commands/update.ts`
- `packages/cli/src/configurators/index.ts`
- `packages/cli/src/configurators/workflow.ts`
- `packages/cli/src/configurators/shared.ts`
- `packages/cli/src/configurators/claude.ts` (示例平台)
- `packages/cli/src/templates/trellis/index.ts` (硬编码聚合)
- `packages/cli/src/templates/trellis/config.yaml` (PR1 加 `language` 字段)
- `packages/cli/src/templates/common/index.ts` (FS 驱动聚合)
- `packages/cli/src/templates/template-utils.ts` (createTemplateReader)
- `packages/cli/src/templates/extract.ts` (copyTrellisDir)
- `packages/cli/src/utils/file-writer.ts` (writeFile)

## 9. 注意事项（PR1 实施必读）

- `getAllScripts()` 是手写枚举的 Map，新增 `*.zh.py` 必须**同步在 index.ts 里 `readTemplate` 一份**——不会自动收。
- `workflowMdTemplate` 是顶层 `const`，**模块加载即固定**；PR1 必须把它改成 lazy/函数化（如 `getWorkflowTemplate(locale)`），并更新所有四个引用点（`init.ts:43-44`、`update.ts:43`、`workflow.ts:9-11`、`update.ts:646`）。
- 没找到上层"locale resolve" 的现成位置；建议在 `configurators/shared.ts` 里仿照 `setResolvedPythonCommand`/`getPythonCommandForPlatform` 加一对 `setResolvedLocale`/`getResolvedLocale`，由 init/update 入口最早一刻调用。
- **PRD R2 第 3 条与现有 `.template-hashes.json` 契约冲突**——hash key 仍应是落地路径（脱后缀），与现有兼容；hash 值随源端语言变化（这正是切语言要重跑 sync 的原因，符合决策 3）。详见 `template-hashes.md` 第 4 节。
