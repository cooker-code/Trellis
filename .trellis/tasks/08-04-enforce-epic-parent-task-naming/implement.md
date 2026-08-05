# 实施计划

1. 在 `task_store.py` 增加父 task slug 校验辅助函数，并在 `cmd_create --parent` 的任何目录或 JSON 写入前执行预检。
2. 在 `cmd_add_subtask` 的任何 JSON 写回前复用该校验，保持两条关联入口一致。
3. 在中英文 i18n（国际化）字符串和中英文工作流模板中说明 `story-<业务短名>` 规则、独立 task 豁免及正确的创建顺序。
4. 新增脚本集成测试：覆盖 `story-` 父 task 成功关联、普通 task 被拒绝、拒绝后无新 task/关系残留、`add-subtask` 不可绕过、历史非 `story-` 树仍可列出。
5. 运行相关 Vitest（测试框架）用例、模板回归测试与 Python 语法检查；确认新规则只影响上述两个写入入口。

## 验证命令

```bash
pnpm vitest run packages/cli/test/scripts/task-parent-naming.integration.test.ts
pnpm vitest run packages/cli/test/scripts/task-list-tree.integration.test.ts
pnpm vitest run packages/cli/test/templates/trellis.test.ts
python3 -m py_compile packages/cli/src/templates/trellis/scripts/common/task_store.py
```

## 审核点与回滚点

- 审核点：失败分支必须发生在 `create --parent` 目录创建之前，以及 `add-subtask` 的双 JSON 写回之前。
- 审核点：历史父子关系只做读取验证，不写入 `task.json`。
- 回滚点：校验是无数据迁移的局部变更；撤回代码、文档和测试即可恢复原关联行为。
