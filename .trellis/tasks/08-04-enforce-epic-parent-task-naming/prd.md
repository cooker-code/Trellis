# 约束 Story 父任务命名

## Goal

1. 让人仅通过 task 目录名就能识别父 task：任何拥有子 task 的父 task 都使用 `story-` 前缀，例如 `story-release-diff`。
2. 在创建和关联父子关系时阻止不符合约定的父 task，避免依靠人工检查或事后修正。

## Requirements

### R1 Add

- **R1.1** `task.py create --parent` 在写入父子关联前，校验目标父 task 的稳定 slug 为 `story-<业务短名>`；不符合时失败且不写入半完成的关联。
- **R1.2** `task.py add-subtask` 使用与创建路径一致的父 task 命名校验，防止先建独立 task 再绕过约束关联。
- **R1.3** 为命令错误信息和工作流说明补充可复制的正确命名示例，以及说明普通顶层 task 可以不使用 `story-`。

### R2 Change

- **R2.1** 父子 task 的判断仍以 `task.json` 的 `parent` / `children` 关系为准；`story-` 是父 task 的强制人类可读命名标识，不新增第二套层级数据。
- **R2.2** 新建或重新关联的关系必须通过命名校验；已有非 `story-` 父 task 保持可读，不自动迁移，也不因本次升级被阻断。

### R3 Preserve

- **R3.1** 独立 task 不因名称未使用 `story-` 而被拒绝。
- **R3.2** 现有父子关系的双向写入、归档历史记录、树形 `list` 输出和状态进度语义保持不变。

### R4 Boundary

- **R4.1** 本任务不改变 task 的状态生命周期、分支/worktree 流程或子 task 间依赖表达方式。
- **R4.2** 本任务不把 `story` 写入状态字段、任务标题或业务 ID；约束对象仅为用于目录和 CLI 引用的 slug。

## User-visible Outcomes

- [x] **O1 (R1.1, R1.2)** 用户将 child 关联到 `story-` 父 task 时成功；关联到普通 task 时得到明确的修复提示，且任务关系未被部分写入。
- [x] **O2 (R1.3, R2.1)** `task.py` 帮助与工作流示例让用户能区分独立 task、Story 父 task 和 child task，并能按树形列表核验关系。
- [x] **O3 (R2.2, R3.2)** 历史 task 的兼容策略有明确验收；既有树与归档进度语义不因本约束发生意外变化。
