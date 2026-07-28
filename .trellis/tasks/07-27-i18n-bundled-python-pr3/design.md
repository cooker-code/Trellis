# 设计：i18n PR3

## 1. 边界与依赖

PR3 是 PR1-A 和 PR2 之上的内容与选择机制扩展，不自行解析 locale（区域语言）。

统一数据流：

```text
CLI/config/env
  -> 唯一活动 locale
  -> init writer + update collector
```

PR3 在三个入口消费该 locale：

```text
common bundled skill tree
  -> 本地化逻辑文件
  -> 平台目标路径

markdown spec catalog
  -> 本地化逻辑文档
  -> .trellis/spec 目标路径

task.py create + 中文 Agent/Skill/Command
  -> 中文 task 骨架与中文自然语言产物
  -> .trellis/tasks/<task>
```

不得引入第二套进程级语言来源。

## 2. 源文件与目标文件模型

English（英文）文件定义逻辑目标，Chinese（中文）文件作为 overlay（覆盖层）：

```text
foo.md              -> 逻辑目标 foo.md
foo.zh.md           -> foo.md 的中文源
foo.md.txt          -> 逻辑目标 foo.md
foo.zh.md.txt       -> foo.md 的中文源
```

选择规则：

```text
locale=en -> 英文源
locale=zh -> 中文源存在时选中文，否则选英文
```

选中内容写入不带语言后缀的目标路径；`.zh.` 不得进入用户项目或 `.template-hashes.json` 的键。

## 3. bundled skill 数据流

当前数据流：

```text
递归文件系统遍历
  -> CommonBundledSkillFile[]
  -> resolveBundledSkills(ctx)
  -> writeSkills / collectSkillTemplates
  -> 平台路径 + hash
```

目标数据流：

```text
递归遍历英文规范集合
  -> 按逻辑相对路径叠加中文文件
  -> 产生无后缀 relativePath 的 CommonBundledSkillFile[]
  -> placeholder（占位符）解析
  -> 既有 writer/collector
```

约束：

- 英文树是规范集合，孤立中文文件不能产生新输出。
- 中文缺失按文件回落英文。
- cache（缓存）按 locale 分组。
- 非 Markdown 资源原样复制。
- init 和 update 使用同一个 resolver（解析器）结果。
- 测试动态发现英文文件，不固定 38 这一规划期数量。

## 4. spec template 数据流

在 `templates/markdown/index.ts` 中使用 locale-aware catalog（语言感知目录）或访问器，替代只消费英文常量的路径；若兼容调用者需要，保留英文导出。

```text
createWorkflowStructure
  -> createSpecTemplates(language)
    -> writeBackendDocs / writeFrontendDocs / guides
      -> 选中的本地化内容
```

逻辑目录仍只注册当前 16 个文件；cross-platform guide 虽有中文源，但继续保持未注册。remote spec package（远端规范包）继续跳过本地空白模板写入。

## 5. task 内容语言数据流

### 5.1 默认 PRD 骨架

`task_store.py::_default_prd_content` 增加显式语言输入，或从已经解析的活动 locale 获取语言；调用方必须在创建 task 前完成语言解析。

```text
task.py main
  -> set_locale()
  -> cmd_create
  -> _default_prd_content(title, description, language)
  -> 中文或英文 prd.md
```

根 `.trellis/scripts/` 与 CLI template（模板）副本必须保持字节级同步。

英文默认行为保持兼容；中文骨架包含：

```text
## 目标
## 需求
## 验收标准
## 说明
```

文件名、命令、状态和结构字段保持英文技术标识。

### 5.2 AI 维护 task 的语言约束

中文 workflow（工作流）、Skill（技能）、Command（命令）和 Agent（代理）中，凡涉及创建或维护 `prd.md`、`design.md`、`implement.md`、research 文档或 JSONL 原因说明的指令，都要加入统一语言规范：

- 自然语言使用中文；
- 技术术语首次出现用 `English（中文解释）`；
- 命令、路径、键、状态和代码保持原样；
- 不改写历史归档或其他开发者任务。

测试不尝试判断任意文本的语言，而是验证代表性模板包含该约束，并验证中文默认 PRD 的确定性输出。

### 5.3 现有活动 task 迁移

只迁移以下目录：

```text
.trellis/tasks/05-20-trellis-i18n-chinese-support
.trellis/tasks/07-27-i18n-bundled-python-pr3
```

迁移对象包括 Markdown（标记语言）、JSONL（逐行 JSON）中的自然语言原因，以及 `task.json` 的 `title`、`description`、`notes` 等面向人字段。结构键、ID、name、状态和路径不变。

`archive/**` 和其他开发者任务通过允许列表明确排除。

## 6. 翻译结构验证

中英文 Markdown 对按结构而非正文逐字比较：

- 英文对应文件存在；
- 逻辑目标路径相同；
- 必需 frontmatter（头部元数据）键存在，身份字段保持一致；
- placeholder 集合一致；
- 相对链接目标一致；
- code fence（代码围栏）数量和语言序列一致；
- 受保护命令、路径和标识符保持；
- 输出映射不出现中文源后缀。

task 内容验证分两层：

1. 对默认 PRD 骨架做精确字节测试；
2. 对中文 Agent/Skill/Command 做代表性规则存在性测试。

不使用简单的“中文字符比例”作为唯一门禁，避免代码块和技术文档误报。

## 7. Python 文案数据流

公开入口在构造 argparse（参数解析器）和输出前调用 `set_locale()`：

```text
entry main
  -> set_locale once
  -> command/shared functions
  -> t(key, kwargs)
```

英文字典是规范键集合，中文回落顺序保持：

```text
zh key -> English key -> key string
```

翻译字典只提供文案，不控制业务流程。

### 协议保留清单

以下内容保持原文：

- 原始 stdout（标准输出）路径；
- `task.py current --source` 的稳定标签；
- JSON 字段名和 mode/status 值；
- severity token（严重级别标记）和技术标识；
- workspace/index 的持久化 marker schema（标记结构）。

### 循环依赖约束

`i18n.py` 导入 `config.py`，因此 `config.py` 不得在模块加载时反向导入 `i18n`。无效语言的启动警告继续保持英文；其他配置文案优先在已本地化调用方输出。

## 8. 漂移检查

i18n checker（国际化检查器）覆盖：

1. `*.zh.md` 和 `*.zh.md.txt` 文件配对；
2. Python `STRINGS` 字典；
3. task 中文骨架及代表性语言规范。

普通模式警告且退出码为 0；`--strict` 在缺失源、过期翻译、键不一致或 placeholder 不一致时返回非零。检查器不依赖 `.template-hashes.json`。

## 9. 文档站排除

用户于 2026-07-28 确认本 PR3 不生成 docs-site（文档站）项目内容。文档站本地生成物已丢弃，submodule（子模块）保持原始指针和干净状态；本设计不再新增页面、导航或根仓库指针。

## 10. 兼容性

- 未配置语言或 `en` 保持英文源和现有目标路径。
- 中文源缺失时自动回落英文。
- hash 键仍是落地路径，不迁移 schema（结构定义）。
- 已有用户 spec 不被改写。
- Python 命令名、参数、路径、JSON、输出通道和退出码不变。
- 历史归档 task 和其他开发者 task 不变。

## 11. 提交与回滚

- bundled/spec/Python/task runtime 改动在根仓库提交。
- 当前两个 task 的中文化文档与对应功能提交放在同一 PR3 提交序列中。
- 删除某个中文源会自然回落英文，不需要数据迁移。
- task 默认骨架可按函数与测试整体回滚，不影响既有 task。
- 文档路由可以独立回滚，不影响运行时。

## 12. 风险与缓解

| 风险 | 缓解措施 |
|---|---|
| 递归加载同时写出两种语言 | 英文规范集合 + 中文 overlay + 无后缀映射测试 |
| locale cache 串语言 | locale-keyed cache + `en -> zh -> en` 测试 |
| init/update 结果不同 | 共享 resolver + 映射相等测试 |
| spec 翻译覆盖用户文件 | 保持 update 排除规则并写入文档 |
| Python 输出破坏消费者 | 协议保留清单 + subprocess（子进程）通道/退出码/schema 测试 |
| task 语言检查误报技术内容 | 骨架精确测试 + 规则存在性测试，不做粗暴字符比例门禁 |
| 批量改写历史或他人 task | 两个活动目录允许列表 + Git diff（差异）范围检查 |
| 意外携带 docs-site 生成物 | 提交前确认子模块状态干净且根仓库指针未变化 |

## 13. upstream 同步与侵入预算

当前累计中文化分支包含大量新增翻译，也修改了 init/update、platform configurator（平台配置器）和 Python 模板链路，因此累计改造不能按文件数描述为“极小侵入”。PR3 的新增改动采用独立侵入预算：

1. **零侵入英文正文**：不修改英文 bundled skill、spec、workflow、Agent、Skill 或 Command 的自然语言正文。
2. **低侵入选择层**：既有 locale 选择和 Python i18n 已满足验收时只回归，不重构。
3. **单点运行时接入**：仅允许 `_default_prd_content` 及其必要调用链新增语言选择；根脚本与 template 双份改动视为一个逻辑接入点。
4. **加法式内容**：11 个 bundled 中文文件和测试以新增文件为主。
5. **可拆分提交**：翻译、运行时和 task 文档分开提交。
6. **同步优先**：产品实现前先让 `main` 快进到 `upstream/main`，再合入 `data-developer`；冲突必须暂停确认。

实现前和完成后都运行 merge-tree（合并树）预检，并列出与 upstream 重叠的文件。只要某项改动需要扩大到新的上游运行时模块，就回到设计审查，不在实现阶段顺手扩面。
