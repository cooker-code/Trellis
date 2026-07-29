# 实施计划：可读任务文档与对照指标实验

## 用户可见交付路线

| 阶段 | 用户得到的结果 | 完成证据 | 当前状态 |
|---|---|---|---|
| 1. 规划收敛 | 明确两条文档链路、指标和护栏 | PRD、设计、实施计划获批 | 进行中 |
| 2. 双链生成 | 创建 Task 时可选原生或可审阅模式 | CLI 集成测试与生成快照 | 未开始 |
| 3. 指标采集 | 能测量和比较两份文档 | 文本/JSON 指标输出测试 | 未开始 |
| 4. 历史回测 | 固定夹具生成可复核对照结果 | 版本化 JSON/Markdown 报告 | 未开始 |
| 5. 质量验收 | 默认行为不退化、影响范围明确 | lint、typecheck、tests、GitNexus | 未开始 |

## Agent 技术执行清单

1. 读取 CLI backend 的脚本、质量、文件安全规范，以及 unit-test 规范。
2. 对拟修改的 `cmd_create`、`_default_prd_content`、`main`/parser 和模板导出符号执行 GitNexus upstream impact。
3. 新增文档 profile 解析和 reviewable 中英文骨架，保持 native 默认输出字节不变。
4. 新增纯函数文档度量模块：审批面切分、Unicode Token 估算、结构计数、差异计算。
5. 将度量和比较命令接入 `task.py`，补充中英文帮助字符串。
6. 新增实验 JSONL 校验与聚合，区分 estimated/actual Token。
7. 更新 Brainstorm/Check 中英文模板，加入 reviewable profile 的人类审批面、结果型路线和复杂度护栏。
8. 新增单元与集成测试，包括：
   - native 默认快照不变；
   - reviewable 中英文骨架；
   - approval marker 切分；
   - Token 估算确定性；
   - native/reviewable 比较；
   - malformed JSONL 和 null usage；
   - 需求/验收 ID 保真。
9. 建立至少一组历史 Task 固定夹具，运行离线回测并生成结果报告。
10. 运行目标测试、`pnpm lint`、`pnpm typecheck`、必要的 Python 静态检查和完整相关测试。
11. 运行 `gitnexus detect-changes --compare main`，检查受影响流程与 PRD 一致。
12. 执行 Trellis Check；如形成稳定项目约定，再按 `trellis-update-spec` 评估是否更新规范。

## 预期修改面

- `packages/cli/src/templates/trellis/scripts/task.py`
- `packages/cli/src/templates/trellis/scripts/common/task_store.py`
- 新的 `packages/cli/src/templates/trellis/scripts/common/document_metrics.py`
- `packages/cli/src/templates/trellis/index.ts`
- `packages/cli/src/templates/common/skills/brainstorm*.md`
- `packages/cli/src/templates/common/skills/check*.md`
- 对应 `packages/cli/test/**`
- 本 Task 的 fixture（夹具）与 benchmark 结果

最终文件集合以 GitNexus 影响分析和现有测试组织为准，不为目录对称而新增无用途文件。

## 验证命令

```bash
pnpm --filter @mindfoldhq/trellis test -- <target test files>
pnpm --filter @mindfoldhq/trellis lint
pnpm --filter @mindfoldhq/trellis typecheck
python3 ./.trellis/scripts/task.py validate 07-28-reviewable-task-docs-experiment
gitnexus detect-changes --compare main
```

## 回滚点

- 保持 `native` 为默认，任何 reviewable 问题都可以通过不传新参数绕开。
- 每个实现阶段独立验证；若实验聚合超出第一版必要范围，保留文档度量与标准 JSONL 输入契约，不伪造真实 usage。
- 不触碰 `/Users/blank/wangliang/gitcode/Trellis` 主工作树中的未提交内容。
