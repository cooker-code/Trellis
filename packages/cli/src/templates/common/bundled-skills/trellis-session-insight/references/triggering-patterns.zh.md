# 触发模式

以下用户表达应让 AI 考虑使用 `trellis mem`。按意图而非表面用词判断。

## 回忆过去的解决方案

用户在问以前怎样解决问题，例如“上次怎么解的？”、“之前是怎么搞定 X 的？”或 “How did we solve this last time?”。使用：

```bash
trellis mem search "<symptom keyword>" --global --limit 10
```

然后对最相关结果运行 `context`。

## 检索旧决策

当用户询问“我们当时为什么选 X？”或“之前讨论过这个方案吗？”时，先搜索关键词，再导出 brainstorm：

```bash
trellis mem search "<decision keyword>"
trellis mem extract <id> --phase brainstorm
```

## 跨会话继续

用户说“继续上次的”、“我们上次做到哪了”或 “Continue from last time.” 时，先按 task 查找最近会话，再导出最后一条：

```bash
trellis mem list --task <current-task-dir>
```

## 熟悉 bug 的排查

错误看起来以前出现过时，使用有辨识度的错误片段搜索：

```bash
trellis mem search "<error message fragment>" --global
```

## 复盘与重复模式

用户要求总结经验、确认是否反复踩坑时，使用：

```bash
trellis mem search "<topic>" --global --limit 50
```

需要时比较两三段 `extract` 结果。

## 不要触发的情况

- “这个函数做什么？”：直接读文件。
- “这个测试为何失败？”：先读测试输出和源码。
- “代码库里 X 的正确模式是什么？”：搜索并阅读 spec（规范）。
- “修这个 bug。”：先调试；仅在确有旧上下文迹象时检索记忆。
