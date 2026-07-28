# 调研：bundled skill（内置技能）递归加载与 spec template（规范模板）本地化

- **查询**：核查 i18n PR3 的 bundled-skills 递归加载、Markdown（标记语言）规范模板、locale（区域语言）传播、回落行为及相关测试。
- **范围**：内部代码与测试。
- **日期**：2026-07-27

## 结论

### bundled skill 递归加载目前不感知语言

规范加载器位于 `packages/cli/src/templates/common/index.ts`：

- `listDirectories("bundled-skills")` 发现技能根目录；
- `listBundledSkillFiles(skillDir)` 递归遍历根目录下所有文件，以 UTF-8 读取，并返回相对技能目录的路径；
- `getBundledSkillTemplates()` 通过 `cachedBundledSkills` 缓存结果；
- `packages/cli/src/configurators/shared.ts:resolveBundledSkills()` 展平文件并解析 placeholder（占位符）；
- 所有平台 configurator（配置器）与 update collector（更新收集器）均消费 `resolveBundledSkills()`。

若直接增加 `foo.zh.md` 而不调整递归加载器，每个受管平台技能目录都会同时安装 `foo.md` 与 `foo.zh.md`。语言选择必须在组装 `ResolvedSkillFile` 路径之前完成。

### 当前 bundled skill 清单

当前有 27 个英文 Markdown 文件，尚无中文对应文件：

| 技能 | 英文 Markdown 文件 | 说明 |
|---|---:|---|
| `trellis-meta` | 22 | `SKILL.md` 及递归 `references/{customize-local,local-architecture,platform-files}/**` |
| `trellis-spec-bootstarp` | 5 | `SKILL.md` 及 `references/` 下四个文件 |
| **合计** | **27** | 约 124 KB |

`trellis-spec-bootstarp` 是已发布的技术标识，包括其拼写；翻译时不得重命名。

### 必须遵循的递归选择契约

复用 PR2 的语言选择 API（应用程序接口），不得另建 locale 解析器：

1. 将英文文件树视为规范逻辑目标集合；
2. 当 locale 为 `zh` 且对应文件存在时，用 `foo.zh.md` 覆盖逻辑目标 `foo.md`；
3. 中文文件缺失时静默使用 `foo.md`；
4. 任何返回或写入的目标均不得包含 `.zh.`；
5. 未本地化的资源/文件保持原样；
6. cache（缓存）必须按 locale 分组，避免先解析英文污染同进程中的中文 init/update；
7. init 与 update 必须生成字节一致的映射，使 `.template-hashes.json` 继续以无后缀落地路径为键；
8. 没有英文源的孤立翻译应忽略或报告，不能变成新的落地文件。

GitNexus 对 `getBundledSkillTemplates` 和 `resolveBundledSkills` 的图分析为 LOW 风险，但没有涵盖文件系统扇出。仓库检索表明 14 个平台 configurator/collector 使用 `resolveBundledSkills`，实际集成风险更高。

### bundled skill 翻译不变量

翻译自然语言标题、段落、表格、指令以及 frontmatter（头部元数据）中的 `description`。以下内容必须逐字保留：

- frontmatter `name` 值；
- 技能 ID，例如 `trellis-meta`、`trellis-spec-bootstarp`；
- Trellis、GitNexus、ABCoder、Claude Code、Cursor、Codex、Pi 等专有名词；
- 命令、参数、环境变量、路径、JSON/JSONL 字段、状态值、代码标识和 placeholder；
- code fence（代码围栏）内容及语言标签；
- 相对链接目标和引用路径。

`trellis-spec-bootstarp/SKILL.md` 含四个指向 `references/*.md` 的 Markdown 链接；`trellis-meta/SKILL.md` 主要以行内代码列出引用路径。翻译必须保持所有目标字节稳定。

## spec template 结论

### 清单及已注册/未注册区分

`packages/cli/src/templates/markdown/spec/` 有 17 个英文 `*.md.txt` 源（约 104 KB）：backend 6 个、frontend 7 个、guides 4 个。`packages/cli/src/templates/markdown/index.ts` 的导出与 `configurators/workflow.ts` 只实际落地 16 个文件。`guides/cross-platform-thinking-guide.md.txt` 虽存在于源树中，但未被导入或创建。

PR3 应翻译全部 17 个源以满足源树覆盖，但不得激活未注册的 cross-platform guide（跨平台指南），避免无关行为变更。

现有 `packages/cli/test/regression.test.ts` 要求规范模板树中的每个文件以 `.md.txt` 结束。因此中文命名为：

```text
index.md.txt       -> index.zh.md.txt
foo.md.txt         -> foo.zh.md.txt
```

末尾 `.txt` 是打包/源标记；locale 后缀位于语义 `.md` 扩展名前。漂移检查器需要支持此复合后缀。

### 当前数据流与推荐实现

- `packages/cli/src/templates/markdown/index.ts` 在模块级读取固定英文路径；
- `packages/cli/src/configurators/workflow.ts:createWorkflowStructure()` 已为 `workflow.md` 解析 `options.language`；
- 该 language 尚未传至 `createSpecTemplates`、`writeSpecForType`、`writeBackendDocs`、`writeFrontendDocs`；
- spec 只在 init/re-init 时创建；update 将 `.trellis/spec/` 视为用户内容且不覆盖；
- remote spec package（远端规范包）在 `zh` 下也必须继续绕过本地空白模板。

应在 `templates/markdown/index.ts` 提供一个 locale-aware（语言感知）模板访问器/目录，同时按兼容性保留现有英文导出。目录按逻辑目标映射英文源，在存在时选择 `*.zh.md.txt`，否则回落英文；再将已解析的 `WorkflowOptions.language` 传入规范写入函数。

不得新增配置读取器或改变 CLI 的语言优先级；`utils/i18n.ts`、`--language`、`TRELLIS_LANGUAGE` 及公共 locale 传播均属于 PR2/PR1 依赖。

翻译面向用户或 LLM（大语言模型）的全部正文、表格、检查清单及 HTML/Markdown 注释；保持相对链接、目标文件名、代码围栏、命令、路径、标识、`{{PYTHON_CMD}}` 等 placeholder、平台 marker（标记）、Markdown 结构与注释分隔符不变。英文页脚 `Language: ... English` 应改为表明生成的中文模板需以中文维护。

## 受影响测试

1. 为 27 个 bundled Markdown 与 17 个 spec `*.md.txt` 建立源文件配对覆盖；
2. 断言 locale 输出映射不含 `.zh.` 且与英文拥有相同目标集合；
3. 覆盖缺失翻译时的英文回落；
4. 在同一进程验证 `en -> zh -> en` 的 locale-keyed（按语言分键）缓存；
5. 同时覆盖 configure/write 与 collect/update，14 个平台映射均满足无后缀不变量；
6. 增加代表性 init 集成测试，证明中文规范内容写入正常无后缀 `.trellis/spec/**` 路径；
7. 保持 remote template 与 backend/frontend 项目类型行为；
8. 更新现有 `*.md.txt` 回归断言，明确允许 `*.md.txt` 和 `*.zh.md.txt`，拒绝裸 `.md`。

## 影响与注意事项

- GitNexus：`createSpecTemplates` 仅有一个直接上游调用者 `createWorkflowStructure`，为 LOW 风险；
- bundled skill 的实际扇出包括 14 个平台 configurator/collector 以及 init/update hash 跟踪，即使图风险较低也必须做集成测试；
- 当前递归逻辑以 UTF-8 读取所有文件。PR3 只增加 Markdown 翻译，不应顺带重构未来二进制资源支持；
- init 后切换 `language` 不得重写用户定制的 `.trellis/spec/`；文档需说明中文空白规范仅在新建时生效，而平台 bundled skill 会在 `trellis update` 时切换。
