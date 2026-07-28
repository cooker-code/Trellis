# 内置技能

“Bundled skills（内置技能）”是随 Trellis CLI npm 包发布的多文件内置技能。不同于用户单独安装到自己的 `.claude/skills/` 或其他平台技能根目录的 marketplace skills（市场技能），`trellis init` 会将内置技能自动写入每个受支持平台的技能根目录，`trellis update` 会保持它们同步。它们属于 Trellis 本身，而非第三方内容。

内置技能是在 `packages/cli/src/templates/common/bundled-skills/<skill>/` 下的目录，其中已包含自身的 `SKILL.md`（带 YAML frontmatter（头部元数据））以及可选的 `references/`、资源或其他支持文件。Trellis 会将整棵目录树按原样复制到每个平台的技能根目录，因此参考资料可以按需加载，而不会被压平为一个过大的 `SKILL.md`。

## 哪些内容属于内置技能（及相邻概念）

| 源路径 | 类型 | 发布方式 |
| --- | --- | --- |
| `templates/common/bundled-skills/<name>/` | 内置技能（多文件） | 将整个目录复制到每个平台的技能根目录 |
| `templates/common/skills/<name>.md` | 单文件工作流技能 | 使用 frontmatter 包装后，写为 `<root>/<name>/SKILL.md` |
| `templates/common/commands/<name>.md` | 斜杠命令 / 提示 | 写入每个平台的命令目录（`.claude/commands/trellis/`、`.cursor/commands/trellis-*.md`、`.gemini/commands/trellis/*.toml` 等） |
| `templates/<platform>/skills/` | 平台专属技能 | 只写入该平台的目录（例如 `.codex/skills/`） |
| `.claude/skills/<my-skill>/` 等位置的用户技能 | 市场技能或用户编写的技能 | Trellis 完全不管理 |

Trellis CLI 永远不会触及并非由其自身模板加载器生成的内容。用户手动放入平台技能根目录的任何内容都会保留不变。

## 当前内置技能（v0.6.0）

该集合通过列出 `templates/common/bundled-skills/` 下的目录在运行时发现：

| 技能 | 用途 |
| --- | --- |
| `trellis-meta` | 此技能。向在用户项目中工作的 AI 说明本地 Trellis 架构和可定制入口。 |
| `trellis-session-insight` | 封装 `trellis mem` CLI，使 AI 知道何时以及如何访问历史 Claude Code / Codex / Pi Agent 对话日志。 |
| `trellis-spec-bootstrap` | 用于从真实代码库创建或刷新 `.trellis/spec/` 的平台无关工作流（可选 GitNexus / ABCoder 集成）。 |
| `trellis-channel` | 能力技能，指导 AI 在多智能体协作、论坛/线程持久面板和调度器等待模式中何时使用 `trellis channel`。 |

该列表在运行时发现，因此在 `bundled-skills/` 下增加一个新目录，就是注册一个新技能所需的唯一步骤（见下文“新增内置技能”）。

## 各平台的内置技能落地位置

每个平台配置器都会在 `trellis init` 期间调用 `writeSkills(<root>, <workflowSkills>, resolveBundledSkills(ctx))`。`resolveBundledSkills` 会读取 `templates/common/bundled-skills/` 下的每个目录，解析 placeholder（占位符），并返回扁平的 `{relativePath, content}` 条目列表。然后 `writeSkills` 会将它们镜像写入平台的技能根目录。

| 平台 | 内置技能根目录 | 说明 |
| --- | --- | --- |
| Claude Code | `.claude/skills/<skill>/` | `configureClaude` |
| Cursor | `.cursor/skills/<skill>/` | `configureCursor` |
| Codex | `.agents/skills/<skill>/` | `configureCodex` 写入共享的 `.agents/skills/` 根目录，Gemini CLI 0.40+ 也会读取该目录 |
| Gemini CLI | `.agents/skills/<skill>/` | 与 Codex 共用根目录；两个配置器必须生成字节完全一致的输出 |
| Kiro | `.kiro/skills/<skill>/` | `configureKiro`（基于技能的平台——没有命令） |
| Qoder | `.qoder/skills/<skill>/` | `configureQoder` |
| Codebuddy | `.codebuddy/skills/<skill>/` | `configureCodebuddy` |
| Copilot | `.github/skills/<skill>/` | `configureCopilot` |
| Droid | `.factory/skills/<skill>/` | `configureDroid` |
| Antigravity | `.agent/skills/<skill>/` | `configureAntigravity` |
| Devin | `.devin/skills/<skill>/` | `configureDevin` |
| Kilo | `.kilocode/skills/<skill>/` | `configureKilo` |
| ZCode | `.zcode/skills/<skill>/` | `configureZcode` |
| OpenCode | （由 `collectOpenCodeTemplates` 处理） | 使用同一份 `resolveBundledSkills(ctx)` 输出 |
| Pi、Reasonix | （由各自的收集器处理） | 使用同一份 `resolveBundledSkills(ctx)` 输出 |

两条路径会使用同一份数据：

1. `configureX(cwd)` 会在 `trellis init` 期间写入文件。
2. `collectPlatformTemplates(platformId)`（位于 `configurators/index.ts`）会返回 `Map<filePath, content>`，供 `trellis update` 用来检测漂移并填充 `.trellis/.template-hashes.json`。两者必须生成字节完全一致的输出，因此都会调用 `resolveBundledSkills(ctx)` 和 `collectSkillTemplates(root, …, resolveBundledSkills(ctx))`。

## 分发接线（代码路径）

将内置技能自动分发到平台技能根目录的机制位于两个文件中：

1. `packages/cli/src/templates/common/index.ts`
   - `listDirectories("bundled-skills")` 会枚举磁盘上的技能目录。
   - `listBundledSkillFiles(skillDir)` 会递归遍历每个技能目录，并为每个文件返回 `{relativePath, content}`。
   - `getBundledSkillTemplates()` 会返回已缓存的 `CommonBundledSkill[]`。

2. `packages/cli/src/configurators/shared.ts`
   - `resolveBundledSkills(ctx)` 会将该列表压平为 `ResolvedSkillFile[]`，其中路径为 `<skill>/<relativePath>`，且 placeholder 已被解析。
   - `writeSkills(skillsRoot, workflowSkills, bundledSkills)` 会将工作流技能和内置技能文件一同写入 `skillsRoot` 下。
   - `collectSkillTemplates(skillsRoot, workflowSkills, bundledSkills)` 会为 update / hash 管道返回相同形状的 `Map<filePath, content>`。

每个支持技能的平台配置器都会导入这两个辅助函数（见 `claude.ts`、`cursor.ts`、`codex.ts`、`gemini.ts`、`kiro.ts`、`qoder.ts`、`codebuddy.ts`、`copilot.ts`、`droid.ts`、`antigravity.ts`、`devin.ts`、`kilo.ts`）。`index.ts` 的 `PLATFORM_FUNCTIONS` 注册表也会在每个 `collectTemplates` 闭包中调用 `resolveBundledSkills(ctx)`，以便 `trellis update` 跟踪保持一致。

## 新增内置技能

结构和分发接线已经是通用的，因此新增技能只需修改文件并验证分发。

1. **创建目录树。**

   ```
   packages/cli/src/templates/common/bundled-skills/<my-skill>/
     SKILL.md                     # YAML frontmatter + body
     references/                  # optional
       <topic>.md
     assets/                      # optional (anything readable as utf-8)
   ```

2. **编写有效的 `SKILL.md` 头部。**frontmatter 至少必须包含：

   ```yaml
   ---
   name: <my-skill>
   description: "When the AI should reach for this skill. Triggering phrases go here."
   ---
   ```

   `description` 是各平台自动触发机制所匹配的内容，因此应描述用户意图触发条件，而不是技能的内部实现。

3. **在合适的位置使用 placeholder。**内置技能内容会经过 `resolvePlaceholders(file.content, ctx)`。`resolvePlaceholders` 支持的任意 `{{platform_name}}`、`{{python_cmd}}` 等 token 都会按平台替换。

4. **无需分发接线。**`listDirectories("bundled-skills")` 会自动发现新目录，因此所有平台都会在下一次 `trellis init` 或 `trellis update` 时收到它。

5. **在发布前验证分发路径。**跳过其中任一步，过去都曾导致功能被记录为内置，但发布的 npm tarball（打包归档）缺少对应文件：

   - 源文件存在于将要打标签的分支上。
   - `pnpm --filter @mindfoldhq/trellis build` 会将资源复制到 `dist/templates/common/bundled-skills/<skill>/`。
   - `npm pack --dry-run --json` 包含预期的 `dist/**` 路径。
   - 在新的临时项目中，`trellis init` 会写入 `.claude/skills/<skill>/SKILL.md`、`.agents/skills/<skill>/SKILL.md`、`.zcode/skills/<skill>/SKILL.md` 等。
   - `.trellis/.template-hashes.json` 会列出生成的文件。
   - 临时项目中的 `trellis update --dry-run` 会报告 “Already up to date!”。

6. **如果该技能是在其他项目将升级到的发行版中新增，请加入 migration manifest（迁移清单）条目。**没有显式 manifest 条目时，文件仍会通过 `trellis update` 的标准“缺失文件”分支落地，但 manifest 会使变更在 changelog（变更日志）中可见。

## 在本地覆盖内置技能

没有正式的“项目本地技能”机制（例如 `.trellis/skills/`）。内置技能以平台根目录为基础，因此覆盖也必须以平台根目录为基础。

受支持的模式依赖于 `trellis update` 中现有的模板 hash 差异检测：

1. 直接编辑本地文件。例如：`.claude/skills/trellis-meta/SKILL.md`。
2. 该文件的 hash 现在会与 `.trellis/.template-hashes.json` 中的条目不同。
3. 下一次 `trellis update` 会检测到用户修改并保持文件不变（除非显式传入 `--force`，Trellis 永远不会覆盖用户修改的文件）。

注意事项：

- 覆盖只适用于被编辑目录所属的一个平台。例如，要同时覆盖 Claude Code 和 Codex 的同一技能，必须同时编辑 `.claude/skills/<name>/` 和 `.agents/skills/<name>/`。
- 未来的 `trellis update --force` 会覆盖本地编辑。请将覆盖内容置于版本控制中，以便需要时重新应用。
- 安装在同一平台技能根目录、但使用不同文件夹名称的市场技能（例如 `.claude/skills/my-custom-meta/`）不会被 Trellis 触及；当目标是新增行为而不是修改 `trellis-meta` 本身时，它们是更干净的选择。
- 团队私有约定应放在 `.trellis/spec/` 或单独的市场式本地技能中，而不是修改 `trellis-meta` 本身。参见 `customize-local/add-project-local-conventions.md`。

## 从项目中移除内置技能

内置技能没有逐项目停用标志。有两种选择：

1. **删除每个平台技能根目录中的目录。**`trellis update` 会发现文件缺失，与 `.trellis/.template-hashes.json` 比较，并将删除视为任何其他用户修改——除非传入 `--force`，否则不会静默重新创建目录。

2. **固定到未发布该技能的 Trellis 版本。**内置技能集合由构建时决定，因此安装更早的 CLI 发行版是永久排除当前发行版所带技能的唯一方式。

第三种选择——全局停用所有内置技能——不受支持。每个配置器中的分发都是无条件的。新增这种标志需要改动 `configurators/index.ts` 中的 `PLATFORM_FUNCTIONS` 和每个 `configureX` 函数。

## 操作规则

- 将 `templates/common/bundled-skills/` 视为内置技能存在与否的唯一事实来源。不要手工维护逐平台技能列表。
- 不要在内置 `SKILL.md` 中添加平台专属逻辑。如果行为与平台有关，请将其放在 `templates/<platform>/skills/` 中。
- 不要让内置技能依赖特定 CLI 二进制命令（例如 `trellis mem`），却未在技能 description 和 references 中暴露此依赖——使用较旧发行版的用户可能没有该命令。
- 不要在内置技能中保存项目私有内容。内置技能是公开内容，会随产品发布给每位用户；项目规则应放在 `.trellis/spec/` 或本地技能中。
