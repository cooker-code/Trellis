# 规划证据

## 当前文档生成

- `packages/cli/src/templates/trellis/scripts/common/task_store.py::_default_prd_content` 生成默认 PRD。
- 当前中英文骨架均只包含目标、需求、验收和说明，没有可测量的用户审批面边界。
- `packages/cli/src/templates/common/skills/brainstorm*.md` 负责最终 PRD 收敛；这是阻止“待确认问题留在最终 PRD”的正确入口。
- `packages/cli/src/templates/common/skills/check*.md` 已负责需求、测试和复用检查，适合追加文档复杂度护栏，但正确性检查必须在前。

## 现有 Benchmark 先例

归档 Task：

```text
.trellis/tasks/archive/2026-06/05-02-trellis-spec-compounding-benchmark-toy-phase/
```

可复用规则：

- 固定模型、代码基线、工具和预算，只改变一个实验变量。
- 每次运行采集 input/output/cache Token、耗时、工具调用和错误。
- 先做 calibration（校准），再决定正式运行规模。
- 非确定模型需要每个 cell（实验单元）重复运行，不能依赖单次结果。
- 汇总展示每组指标和 bootstrap 置信区间。

本任务第一版复用数据契约和聚合纪律，不复制其外部模型 runner。

## GitNexus 证据

- 索引基线：`fb6ac58666d8a317be15472403af20130dfff639`
- 初始 query 定位到 `task_store.py` 的任务创建路径、`task.py::cmd_start` 生命周期和 sub-agent artifact 注入流程。
- 产品代码修改前仍需对每个目标符号单独运行 upstream impact。

## 文章方法校准

文章提出“一屏摘要 + 关键图 + 契约/不变量 + 验收”，本任务仅吸收以下可验证部分：

- 决策和红线前置；
- 人类审批面与 Agent 细节分层；
- 只画暴露本次风险的图；
- 验收可执行；
- 结构统一以便复用和比较。

“三分钟审完”在没有人工实验前只是待验证假设，不能由静态 Token 指标直接证明。
