# 实现验证记录

## 已通过

- CLI 全量测试：`pnpm --filter @mindfoldhq/trellis test`，退出码 0。
- 新增原型生命周期集成测试：7 项通过，覆盖中英文 create/status/approve/start、正常与降级模式、摘要过期、路径穿越、外部符号链接、缺失产物、批准依据和非 UI 兼容。
- 静态检查：CLI lint、typecheck、i18n drift、PRD contract checker、Python `py_compile`、`git diff --check` 全部通过。
- 构建：`pnpm --filter @mindfoldhq/trellis build`，退出码 0。
- 文档验证曾运行 `pnpm --dir docs-site lint`，556 个 Markdown/MDX 文件零错误；外部文档增量随后按用户要求撤回，不作为父仓库发布产物。
- 模板一致性：发布模板与 `.trellis/` dogfood Python twin byte diff 通过；Workflow 只校验父仓库内受管理的 PRD contract block，不再读取 Marketplace。
- Task Context：`task.py validate 08-01-ui-prototype-directory-start-gate`，`implement.jsonl` / `check.jsonl` 各 4 项且全部有效。

## 风险证据

- 修改前对 `cmd_start`、`cmd_create`、`getAllScripts`、`validateContract`、`managedBlock`、`main` 的 GitNexus upstream impact 均为 `LOW`。
- 最终 `gitnexus detect-changes --scope all` 为 `CRITICAL`，报告 52 个符号、19 条流程；主要因为 CLI 主分发和文档模板进入全局影响图。该风险已通过 CLI 全量测试、构建、双语测试、零副作用断言和镜像一致性检查覆盖，未发现实际回归。

## 未执行

- 未提交、未创建分支、未推送、未创建 PR、未合并、未发布。
- Docs Prettier 全库检查存在 120 个既有格式告警；本轮修改通过 docs lint，未对全库执行格式化以避免扩大无关改动。
