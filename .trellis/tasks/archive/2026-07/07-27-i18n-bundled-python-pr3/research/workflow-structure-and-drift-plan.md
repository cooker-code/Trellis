# 调研：PR1-B workflow（工作流）结构一致性与漂移检测

- **查询**：为英中文 workflow 模板定义可执行的结构等价契约，并评估既有漂移检查器。
- **范围**：内部。
- **日期**：2026-07-27

## 既有漂移检查器

`packages/cli/scripts/check-i18n-drift.js` 当前会：

- 递归扫描 `packages/cli/src/templates/` 下的 `*.zh.(md|py|yaml|yml|txt)`（`:31-46`）；
- 验证无后缀英文对应文件存在（`:48-51`、`:80-85`）；
- 比较英文与中文文件的最后一次 Git 提交时间（`:53-63`、`:87-97`）；
- 默认警告，使用 `--strict` 时返回非零（`:114-116`）；
- 任一侧未跟踪时静默跳过新旧比较。

它不检查当前 worktree（工作树）内容，无法发现被删的 workflow-state 标签、变更的平台 marker、缺少的 Step、修改的 placeholder 或畸形代码围栏。PR1-B 需要在时间新旧警告之外增加内容结构验证。

## 推荐范围与实现形态

只对 `workflow.zh.md` 增加 workflow 专用结构比较，不应将 workflow 语法强加给未来 PR2/PR3 的 Markdown 翻译。其他翻译文件继续使用通用对应文件/时间新旧检查。

将脚本重构为可安全导入的纯 helper（辅助函数）及保留的 CLI 入口：

- `extractWorkflowStructure(content)`；
- `compareWorkflowStructure(enContent, zhContent)`；
- 以 guard（守卫）保护 `main()`，使 Vitest 导入模块时不会执行 CLI。

CLI 额外报告 `structural` 计数。普通模式仅警告；`--strict` 在缺少对应文件、时间漂移或结构不匹配时失败。

## 结构契约

比较机器语义结构，不比较翻译正文或原始行数：

| 类别 | 必须相等的内容 |
|---|---|
| workflow-state 标签 | 开/闭 marker 行的精确顺序，包括 `no_task`、`planning`、`planning-inline`、`in_progress`、`in_progress-inline`、`completed` 与文档化的 `my-status` 示例。 |
| 平台 marker | `workflow_phase.py` 可接受的开/闭 marker 精确顺序，不含 workflow-state 标签。 |
| Step 标题 | 数字 ID（`1.0`…`3.5`）及 `[required · once]`、`[optional · repeatable]`、`[on demand]` 等保留限定符的精确顺序；标题可翻译。 |
| Phase 引用 | 机器关键处的 `Phase <number>` / `Step <number>` 标识精确顺序；标签可翻译。 |
| Markdown 大纲 | 标题级别与标题数量顺序相同；有稳定 ID 时比较 ID，不比较翻译标题。 |
| 代码围栏 | 围栏分隔符/语言序列相同且开闭平衡；围栏中的自然语言可翻译。 |
| 行内代码 | 反引号技术片段的精确 multiset（多重集合），其中含多数命令、路径、状态、参数、文件名和标识。 |
| placeholder / XML-like 标签 | `<...>` token 的精确 multiset，包括 `<your-name>`、`<task-dir>`、`<workflow-state>` 与 dispatch placeholder。 |
| 链接目标 | Markdown 链接目标精确且顺序相同；标签可翻译。 |
| 受保护词法 token | 行内代码外的参数、环境变量、命令、路径、状态值与 slash command（斜杠命令）精确 multiset。 |
| HTML 注释 | 注释块数量相同；正文应翻译，故不比较注释正文。 |

不要比较行数、段落数或表格单元格正文；中文换行和措辞可以不同，同时保持运行时安全。

## 翻译完整性与受保护内容

结构一致性不能证明每句都已翻译。应增加窄而稳定的检查并辅以人工审阅：

1. `workflow.zh.md` 不得含 PR1-A placeholder 注释（`i18n PR1 placeholder note` / `full Chinese translation lands...`）；
2. 每个顶层 workflow 章节、workflow-state 正文和带编号 Step 章节均至少包含中文字符；
3. 检查后部哨兵（Phase 2、Phase 3.4、自定义章节），防止“翻译前缀 + 英文尾部”；
4. 不做广义“没有英文单词”断言，专有名词与技术标识有意保留英文。

必须翻译面向人或 LLM 的 Markdown 标题/段落、表格标题和解释单元格、HTML/Markdown 注释、代码块内 shell 注释，以及 prompt 示例/用户可见样本文本。必须保持 Trellis 与平台专名、命令、参数、路径、文件名、环境变量、JSON/YAML 键、代码标识、状态值 `planning`/`in_progress`/`completed`/`no_task`、Phase/Step 数字与限定符、workflow-state 标签、平台 marker、placeholder、slash command、链接目标以及文档化的精确运行时回落字面量不变。对于 `Spec`、`Task`、`Workspace`、`Context`、agent/skill 名等领域技术标识，宜保留稳定英文 token 并翻译其周边文字。

## 测试与注意事项

建议将纯 extractor/comparator 测试放在 `packages/cli/test/scripts/check-i18n-drift.test.ts`，真实模板的一致性/完整性断言放在同一文件或 `packages/cli/test/utils/i18n.test.ts`；`packages/cli/test/templates/trellis.test.ts` 中的英文语义测试保持不变。

最少应有以下独立负向 fixture：删除一个 workflow-state 闭标签、删除一个平台 marker、修改一个 Step ID 或限定符、修改一个 placeholder、修改一个代码围栏、修改一个行内技术 token。每种变异须给出类别特定诊断，证明检查器不是“文件不同”式自证测试。

Git 提交时间戳精度为秒且忽略未提交内容，因此结构检查必须直接读文件字节。当前 `--strict` 的时间新旧检查在中文翻译提交前仍可能报告过期；单元测试应调用纯结构 helper，而不要依赖固定路径 CLI 的 Git 历史。行内代码比较刻意严格；若未来确需翻译行内自然语言，应先移出代码格式或经审查显式白名单。
