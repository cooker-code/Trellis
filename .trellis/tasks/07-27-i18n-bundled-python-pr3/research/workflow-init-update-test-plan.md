# 调研：PR1-B init/update（初始化/更新）与运行时集成测试

- **查询**：识别完整中文 `workflow.md` 所需的集成覆盖，同时不回归英文或 hash（哈希）所有权。
- **范围**：内部。
- **日期**：2026-07-27

## 现有集成行为

### init

- locale 选择已经通过 `packages/cli/src/templates/trellis/index.ts:92-114` 的 `getWorkflowTemplate(locale)` 接入；
- `createWorkflowStructure` 将选中源写入固定落地路径 `.trellis/workflow.md`（`packages/cli/src/configurators/workflow.ts:95-118`）；
- `packages/cli/test/commands/init.integration.test.ts:126-151` 目前只验证英文以 `# Development Workflow` 开头、`--language zh` 以 `# 开发工作流` 开头；
- init 的 hash 跟踪在写入后记录落地路径/内容，因此测试必须断言中文内容的 hash 位于 `.trellis/workflow.md`，绝不能位于 `.trellis/workflow.zh.md`。

### update

- `collectTemplateFiles` 解析 locale，并将选中字节放入 `.trellis/workflow.md`（`packages/cli/src/commands/update.ts:650-662`）；
- 英文的整文件 workflow 替换及 hash 刷新已在 `packages/cli/test/commands/update.integration.test.ts:1027-1068` 覆盖；
- 目前没有将已初始化英文项目切换至中文模板的 update 集成测试；
- 同版本 update 仍会分析模板字节：若英文落地文件与已存英文 hash 匹配，中文模板被选中后应判定为自动更新。

### 运行时

- `get_context.py --mode phase` 委派给 `common/workflow_phase.py`；
- `packages/cli/test/regression.test.ts:3364-3574` 的运行时测试只使用英文 workflow；
- workflow-state（工作流状态）标签与语言无关，故 breadcrumb（面包屑）正文可保持解析安全；但紧凑 Phase Index（阶段索引）提取目前依赖英文标题，见 `workflow-runtime-parser-audit.md`。

## 必需测试矩阵

### A. 模板源与一致性（单元测试）

1. `getWorkflowTemplate("zh")` 返回完整中文源；
2. 不含 PR1-A placeholder 注释；
3. 存在后部中文哨兵内容（Phase 2、Phase 3.4、自定义章节）；
4. 英文与中文结构通过一致性比较器；
5. 不支持的 locale 仍回落到精确英文字节。

### B. init 集成

将现有 `#1c` 用例加强或拆分：

| 场景 | 调用 | 断言 |
|---|---|---|
| 默认英文 | `init({ yes: true })` | 落地 workflow 等于 `replacePythonCommandLiterals(getWorkflowTemplate("en"))`，并存储英文 hash。 |
| 中文覆盖 | `init({ yes: true, language: "zh" })` | 落地 workflow 等于完整中文源经 Python placeholder 替换后的内容；不落地 `.zh.md`；hash 键为 `.trellis/workflow.md` 且值等于中文落地字节。 |
| 中文运行时 | 运行生成的 `get_context.py --mode phase` 与 `get_context.py --mode phase --step 1.1 --platform pi` | 紧凑 Phase Index 与 Step 正文为中文；Step 查找和平台过滤仍有效。 |

使用精确源内容相等，而不是 `startsWith`，避免“已翻译前缀 + 过时英文尾部”误通过。

### C. update 集成

在 `#workflow-md-r4` 附近增加具名用例：

1. 初始化默认英文项目；
2. 编辑 `.trellis/config.yaml` 启用顶层 `language: zh`，并保持其为用户所有的 config；可使用 `skipAll` 或定向准备以避免 update 覆盖 fixture；
3. 保持 `.trellis/workflow.md` 相对于已存英文 hash 为 pristine（未修改）；
4. 执行 `update({ skipAll: true })`，或实际允许自动更新的等效非交互选项；
5. 断言 `.trellis/workflow.md` 等于 placeholder 渲染后的中文字节；不存在 `.trellis/workflow.zh.md`；`.template-hashes.json` 只有无语言后缀的 workflow 键且 hash 等于中文字节；用户修改过的 language config 保留；
6. 再运行一次 update，workflow/hash 应保持不变（幂等）。

`update({ language: "zh" })` 的一次性变体也有价值，但其通过进程环境实现，测试必须在 `afterEach` 恢复 `TRELLIS_LANGUAGE`。

### D. 解析器集成

若 Phase 标题中文化，则为每类改变后的解析器增加直接中文用例：

| 解析器族 | 测试行为 |
|---|---|
| bundled Python `workflow_phase.py` | 提取中文 Phase Index；移除 workflow-state 块；排除详细 Phase 1；`get_step("1.1")` 返回中文正文。 |
| 共享 Python SessionStart | `<trellis-workflow>` 包含中文紧凑索引，排除详细 Step 正文及完整 workflow-state 块。 |
| Codex/Copilot 独立 SessionStart 副本 | 至少使用中文源覆盖其 Phase Index helper；若现有 harness 已逐副本运行，可断言共享 fixture 行为。 |
| OpenCode `session-utils.js` | 生成的 SessionStart 上下文含中文紧凑索引。 |
| breadcrumb Python/JS 解析器 | 现有语法测试可保留；新增一条断言证明中文标签正文原样发出。 |

## 负向与兼容性断言

- 默认英文字节不变，既有英文解析器用例继续通过；
- 缺失/畸形 Phase Index 锚点维持当前回落/空输出；
- 平台 marker 过滤不泄漏替代 Codex 块；
- workflow-state 开闭 STATUS 值仍配对；
- update 不产生带 locale 后缀的落地路径或 hash 键；
- 用户修改过的 workflow 冲突行为不变；PR1-B 不得为了切换语言绕过 hash 保护。

## 验证命令

在 `packages/cli/` 运行：

```bash
pnpm vitest run test/scripts/check-i18n-drift.test.ts
pnpm vitest run test/utils/i18n.test.ts
pnpm vitest run test/commands/init.integration.test.ts
pnpm vitest run test/commands/update.integration.test.ts
pnpm vitest run test/regression.test.ts
pnpm vitest run test/templates/opencode.test.ts
pnpm run i18n:check
pnpm lint
pnpm typecheck
pnpm test
```

开发期间以普通警告模式运行检查器。仅在理解 Git 时间新旧结果后再运行 `node scripts/check-i18n-drift.js --strict`，因为未提交的翻译字节不会更新 `git log` 时间戳。

## 相关规范

- `.trellis/spec/cli/backend/workflow-state-contract.md`：解析器/标签/update 契约；
- `.trellis/spec/cli/backend/commands-update.md`：整文件更新、hash、幂等性和集成测试约定；
- `.trellis/spec/cli/backend/script-conventions.md`：分发 Python 兼容性；
- `.trellis/spec/cli/unit-test/conventions.md`：精确断言、环境隔离与非自证 fixture；
- `.trellis/spec/cli/unit-test/integration-patterns.md`：真实临时目录 init/update 模式。
