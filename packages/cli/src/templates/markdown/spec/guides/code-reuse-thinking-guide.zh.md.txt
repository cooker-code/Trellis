# 代码重用思维指南

> **目的**：在创建新代码之前停下来思考 - 它是否已经存在？

---

## 问题

**重复的代码是不一致错误的第一大来源。**

当您复制粘贴或重写现有逻辑时：
- 错误修复不会传播
- 行为随着时间的推移而变化
- 代码库变得更难理解

---

## 编写新代码之前

### 第 1 步：首先搜索

```bash
# Search for similar function names
grep -r "functionName" .

# Search for similar logic
grep -r "keyword" .
```

### 第 2 步：提出这些问题

| 问题 | 如果是... |
|----------|-----------|
| 有类似的功能吗？ | 使用或扩展它 |
| 这个模式在其他地方使用吗？ | 遵循现有模式 |
| 这可能是一个共享实用程序吗？ | 在正确的位置创建它 |
| 我是否从另一个文件复制代码？ | **停止** - 提取到共享 |

---

## 常见的重复模式

### 模式 1：复制粘贴函数

**不好**：将验证函数复制到另一个文件

**好**：提取到共享实用程序，在需要时导入

### 模式 2：相似组件

**不好**：创建一个与现有组件 80% 相似的新组件

**好**：使用 props/variants 扩展现有组件

### 模式 3：重复常量

**不好**：在多个文件中定义相同的常量

**好**：单一事实来源，随处导入

### 模式 4：重复有效负载字段提取

**不好**：多个消费者在本地投射相同的 JSON/event 字段：

```typescript
const description = (ev as { description?: string }).description;
const context = (ev as { context?: ContextEntry[] }).context;
```

即使代码只有两行，这也是重复的合约逻辑。每个
消费者现在对有效负载的含义有自己的定义。

**好**：将解码器、类型保护或投影放在数据所有者旁边：

```typescript
if (isThreadEvent(ev)) {
  renderThreadEvent(ev);
}
```

**规则**：如果在 2 个以上位置读取相同的无类型负载字段，则创建一个
在添加第三个读取器之前共享类型保护/标准化器/投影。

---

## 何时抽象

**适合抽象的情况**：
- 相同代码出现 3 次以上
- 逻辑复杂到有bug
- 可能有很多人需要这个

**不适合抽象的情况**：
- 只使用过一次
- 琐碎的一行
- 抽象比复制更复杂

---

## 批量修改后

当您对多个文件进行类似更改时：

1. **回顾**：您是否捕获了所有实例？
2. **搜索**：运行 grep 查找任何遗漏的内容
3. **考虑**：这应该被抽象吗？

### Reducer 应使用穷举结构

当状态由 action-like 值（`action`、`kind`、`status`、`phase`）派生时，应优先使用包含单个 `switch` 的 reducer，而不是分散的 `if/else` 更新。

```typescript
// BAD - action-specific state transitions are hard to audit
if (action === "opened") { ... }
else if (action === "comment") { ... }
else if (action === "status") { ... }

// GOOD - one reducer owns the transition table
switch (event.action) {
  case "opened":
    ...
    return;
  case "comment":
    ...
    return;
}
```

当事件日志是事实来源时，这一点尤其重要。reducer 就是日志回放模型；展示代码和 commands 不应重复实现这套回放逻辑。

---

## 提交前的清单

- [ ] 搜索现有的类似代码
- [ ] 没有应该共享的复制粘贴逻辑
- [ ] 在共享解码器之外没有重复的无类型有效负载字段提取
- [ ] 在一处定义的常量
- [ ] 相似的模式遵循相同的结构
- [ ] reducer/action 转换集中在一个 reducer 或 command dispatcher 中

---

## 陷阱：Python if/elif/else 详尽检查

**问题**：Python 的 if/elif/else 链没有编译时详尽检查。当您向 `Literal` 类型（例如 `Platform`）添加新值时，现有的 if/elif/else 链会默默地转入 `else` 并具有错误的默认值。

**症状**：新平台部分工作 - 某些方法返回 Claude 默认值，而不是特定于平台的值。不会引发任何错误。

**示例** (`cli_adapter.py`)：
```python
# BAD: "gemini" falls through to else, returns "claude"
@property
def cli_name(self) -> str:
    if self.platform == "opencode":
        return "opencode"
    else:
        return "claude"  # gemini silently gets "claude"!

# GOOD: explicit branch for every platform
@property
def cli_name(self) -> str:
    if self.platform == "opencode":
        return "opencode"
    elif self.platform == "gemini":
        return "gemini"
    else:
        return "claude"
```

**预防**：向 Python `Literal` 类型添加新值时，搜索打开该类型的所有 if/elif/else 链并添加显式分支。不要依赖 `else` 对于新值来说是正确的。

---

## 陷阱：不对称机制产生相同的输出

**问题**：当两种不同的机制必须生成相同的文件集时（例如，用于初始化的递归目录复制与用于更新的手动 `files.set()` ），结构更改（重命名、移动、添加子目录）仅通过自动机制传播。手动路径则会悄然漂移。

**症状**：Init 工作正常，但 update 在错误的路径创建文件或完全丢失文件。

**预防**：
- **最好**：消除不对称性 - 让手动路径调用自动路径（例如， `collectTemplateFiles()` 调用 `getAllScripts()` 而不是维护自己的列表）
- **如果不对称不可避免**：添加回归测试来比较两种机制的输出
- 迁移目录结构时，搜索引用旧结构的所有代码路径

**真实示例**：`trellis update` 有一个手动 `files.set()` 列表，其中包含 `getAllScripts()` 已跟踪的 11 个脚本。修复：用 `for..of getAllScripts()` 循环替换手动列表。请参阅 v0.4.0-beta.3 中的 `update.ts` 重构。

---

## 模板文件注册（Trellis 特定）

将新文件添加到 `src/templates/trellis/scripts/` 时：

**单一注册点**：`src/templates/trellis/index.ts`

1. 添加 `export const xxxScript = readTemplate("scripts/path/file.py");`
2. 添加到 `getAllScripts()` Map

就是这样。 `commands/update.ts` 直接使用 `getAllScripts()` — 无需手动同步。

**为什么重要**：如果没有在 `getAllScripts()` 中注册，`trellis update` 就不会把文件同步到用户项目，bug 修复和新功能也无法传播。

**历史**：在 v0.4.0-beta.3 之前，`update.ts` 有自己手动维护的文件列表，经常与 `getAllScripts()` 不同步。这导致 11 个 Python 文件在 `trellis update` 期间被静默跳过。修复方法是消除重复列表并使用 `getAllScripts()` 作为单一事实来源。

### 新脚本快速清单

```bash
# After adding a new .py file, verify it's in getAllScripts():
grep -l "newFileName" src/templates/trellis/index.ts  # Should match
```

### 模板同步约定

`.trellis/scripts/` （dogfooded）和 `packages/cli/src/templates/trellis/scripts/` （模板）必须保持相同。编辑 `.trellis/scripts/` 后，始终同步：

```bash
rsync -av --delete --exclude='__pycache__' .trellis/scripts/ packages/cli/src/templates/trellis/scripts/
```

**陷阱**：使用错误的源/目标路径运行 rsync 可能会创建嵌套的垃圾目录（例如 `.trellis/scripts/packages/cli/...`）。运行前务必仔细检查路径。
