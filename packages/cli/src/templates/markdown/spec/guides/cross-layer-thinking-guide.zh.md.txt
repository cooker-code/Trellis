# 跨层思维指南

> **目的**：在实施之前仔细考虑跨层的数据流。

---

## 问题

**大多数错误发生在层边界**，而不是层内。

常见的跨层错误：

- API 返回格式 A，前端需要格式 B
- 数据库存储X，服务转换为Y，但丢失数据
- 多个层以不同的方式实现相同的逻辑

---

## 实现跨层功能之前

### 第 1 步：绘制数据流图

画出数据如何移动：

```
Source → Transform → Store → Retrieve → Transform → Display
```

对于每个箭头，询问：

- 数据是什么格式？
- 可能会出什么问题？
- 谁负责验证？

### 第 2 步：确定边界

| 边界 | 常见问题 |
| --------------------- | --------------------------------- |
| API ↔ 服务 | 类型不匹配、缺少字段 |
| 服务 ↔ 数据库 | 格式转换、空值处理 |
| 后端 ↔ 前端 | 序列化、日期格式 |
| 组件 ↔ 组件 | props 形状变化 |

### 第 3 步：定义合约

对于每个边界：

- 确切的输入格式是什么？
- 确切的输出格式是什么？
- 可能会出现什么错误？

---

## 常见的跨层错误

### 错误 1：隐式格式假设

**不好**：假设日期格式而不检查

**好**：边界处的显式格式转换

### 错误 2：分散的验证

**不好**：在多个层中验证相同的事物

**好**：在入口点验证一次

### 错误 3：抽象泄漏

**不好**：组件了解数据库模式

**好**：每一层只知道它的邻居

### 错误 4：每个消费者解析相同的有效负载

**不好**： command 读取 JSONL 事件并内联转换字段：

```typescript
const thread = (ev as { thread?: string }).thread;
const labels = (ev as { labels?: string[] }).labels;
```

这看起来是本地化的，但这意味着每个消费者都拥有一个私有版本
事件契约。下一次字段变更可能只更新一个 command，却漏掉另一个。

**好**：在事件边界解码一次，然后导出类型化投影：

```typescript
if (!isThreadEvent(ev)) return false;
return ev.thread === filter.thread;
```

**规则**：对于仅附加日志、JSON 流、RPC 负载或配置文件，
为以下职责指定唯一所有者：

- 事件/负载类型定义
- 来自 `unknown` 的类型保护和规范化
- UI commands 使用的元数据 projection
- 从事实来源回放状态的 reducer

渲染代码可以格式化字段，但不得重新定义有效负载契约。

---

## 跨层功能清单

实施前：

- [ ] 绘制了完整的数据流
- [ ] 识别所有层边界
- [ ] 每个边界定义的格式
- [ ] 决定验证发生的位置

实施后：

- [ ] 使用边界情况测试（empty、null、invalid）
- [ ] 验证每个边界的错误处理
- [ ] 检查的数据在往返过程中仍然存在
- [ ] 检查消费者是否导入共享 decoder/projection，而不是在本地转换 payload 字段
- [ ] 检查派生状态是否引用源事件标识符（`seq`、`id`、`version`），而不是另造一套游标

---

## 跨平台模板一致性

在 Trellis 中，command 模板（例如 `record-session.md`）存在于**多个平台**中，具有相同或几乎相同的内容。这是跨层边界。

### 检查表：修改任何命令模板后

- [ ] 查找具有相同 command 的所有平台：`find src/templates/*/commands/trellis/ -name "<command>.*"`
- [ ] 更新所有平台副本（Markdown `.md` 和 TOML `.toml`）
- [ ] 对于 Gemini TOML：调整行延续（`\\` 与 `\`）和三引号字符串
- [ ] 运行 `/trellis:check-cross-layer` 以验证没有遗漏任何内容

**真实示例**：更新了 Claude 中的 `record-session.md` 以使用 `--mode record`，但忘记了 iFlow、Kilo、OpenCode 和 Gemini — 通过跨层检查捕获。

---

## 生成的运行时模板升级一致性

一些生成的文件既是文档也是 runtime 输入。在 Trellis 中，
`.trellis/workflow.md` 由 `get_context.py`、`workflow_phase.py` 解析，
SessionStart 过滤器和每轮 hooks。模板更改必须经过验证
针对新的初始化和升级路径。

### 检查表：修改运行时解析模板后

- [ ] 识别每个读取模板的 runtime 解析器，而不仅仅是文件
安装它的作者
- [ ] 检查相关语法是否存在于明显的管理区域之外
例如标签块
- [ ] 验证新的 `init` 输出和写入的版本化 `update` 场景
旧的 `.trellis/.version`
- [ ] 使用较旧的原始模板夹具添加升级回归，然后
断言安装的文件达到当前打包的形状
- [ ] 更新拥有 runtime 合约的后端 spec

---

## 版本化文档边界

版本化文档是跨层边界：源路径，`docs.json`
版本路由和渲染的版本选择器必须都描述相同的
发布线。

### 清单：编辑版本化文档之前

- [ ] 确定目标发布线：stable、beta 或 RC
- [ ] 验证编辑的 MDX 路径是否与该行匹配：
  - 稳定：`docs-site/{start,advanced,...}` 和 `docs-site/zh/{start,advanced,...}`
  - 测试版：`docs-site/beta/**` 和 `docs-site/zh/beta/**`
  - RC：`docs-site/rc/**` 和 `docs-site/zh/rc/**`
- [ ] 验证 `docs.json` 导航将版本标签指向相同的路径
- [ ] 在提交之前，在相反的树中查找特定于发布行的术语
- [ ] 将根发布路径下出现的 beta 内容视为源路径错误，
不是渲染错误

**真实示例**：仅测试版 task workflow 更改已记录
`prd.md` + `design.md` + `implement.md`、task-创建同意和 Codex
根 `start/` 和 `advanced/` 路径下的模式横幅。然后是文档站点
在发布选择器下提供了 0.6 beta 行为。修复方法是恢复 root
发布文档，将 0.6 内容移至 `beta/` 和 `zh/beta/`，并添加 grep
针对根发布树审核 beta 标记。

**真实示例**：Codex 内联模式更改了 workflow 平台标记
`[Codex]` / `[Kilo, Antigravity, Windsurf]` 至 `[codex-sub-agent]` /
`[codex-inline, Kilo, Antigravity, Windsurf]`。全新 init 的结果正确，但
`trellis update` 只合并 `[workflow-state:*]` 块，并保留了过时的
这些块之外的标记。结果：升级后的项目获得了新的 hook 脚本
但旧的 workflow 路由，所以 `get_context.py --mode phase --platform codex`
可以返回空的阶段 2.1 详细信息。

---

## 模式检测探针清单

当 CLI 通过探测远程资源自动判断模式时（例如检查 `index.json` 是否存在，以决定使用 marketplace 还是直接下载）：

### 实施前：

- [ ] 探针在使用结果的**所有**代码路径中运行（交互式、`-y`、`--flag` 组合）
- [ ] 区分 404 和瞬态错误 — 不要将两者都视为“未找到”
- [ ] 瞬态错误**中止或重试**，永远不会默默地切换模式
- [ ] 当上下文发生变化（例如，用户切换源）时，共享状态（缓存、预取数据）将被重置**
- [ ] **快捷路径**（例如， `--template` 跳过选择器）必须具有与探测路径相同的错误处理质量 - 检查下游函数是否调用包罗万象的包装器

### 实施后：

- [ ] 跟踪从探测结果到模式决策分支的每条路径——无失败
- [ ] 外部格式契约（giget URI、原始 URL）经过测试或至少记录为注释
- [ ] 元数据读取消耗完整响应或使用流解析器 - 永远不要将固定大小的前缀解析为完整的 JSON
- [ ] 从解析的部分重建复合标识符时，验证**所有**字段都包含在内并且位于**正确的位置**（例如，`provider:repo/path#ref`而不是`provider:repo#ref/path`）
- [ ] 验证在快捷方式之后调用的**操作函数**不会在内部使用旧的包罗万象的获取 - 当错误区分很重要时，它们必须使用探测质量变体

**真实示例**：自定义注册表流程在 3 轮审核中存在 8 个错误：(1) 探针仅在交互模式下运行，(2) 瞬态错误陷入错误模式，(3) giget URI 的 `#ref` 位置错误，(4) 切换 source 后预取模板发生泄漏，(5) `--template` 快捷方式绕过了探针，但`downloadTemplateById` 内部使用了 catch-all `fetchTemplateIndex`，将超时变成“找不到模板”。

**真实示例**：agent session 的更新提示使用 `response.read(4096)` 获取 npm `latest` 元数据，然后将其解析为完整的 JSON。 `@mindfoldhq/trellis` 包元数据超过 4 KB，因此 JSON 被截断，解析失败，并且第一次会话注入没有显示更新提示。修复：在解析之前读取完整的响应，并添加回归，其中 `version` 后跟 8 KB 元数据尾部。

---

## 跨平台模板一致性

在 Trellis 中，command 模板（例如 `record-session.md`）存在于**多个平台**中，具有相同或几乎相同的内容。这是跨层边界。

### 检查表：修改任何命令模板后

- [ ] 查找具有相同 command 的所有平台：`find src/templates/*/commands/trellis/ -name "<command>.*"`
- [ ] 更新所有平台副本（Markdown `.md` 和 TOML `.toml`）
- [ ] 对于 Gemini TOML：调整行延续（`\\` 与 `\`）和三引号字符串
- [ ] 运行 `/trellis:check-cross-layer` 以验证没有遗漏任何内容

**真实示例**：更新了 Claude 中的 `record-session.md` 以使用 `--mode record`，但忘记了 iFlow、Kilo、OpenCode 和 Gemini — 通过跨层检查捕获。

---

## 生成的运行时模板升级一致性

一些生成的文件既是文档也是 runtime 输入。在 Trellis 中，
`.trellis/workflow.md` 由 `get_context.py`、`workflow_phase.py` 解析，
SessionStart 过滤器和每轮 hooks。模板更改必须经过验证
针对新的初始化和升级路径。

### 检查表：修改运行时解析模板后

- [ ] 识别每个读取模板的 runtime 解析器，而不仅仅是文件
安装它的作者
- [ ] 检查相关语法是否存在于明显的管理区域之外
例如标签块
- [ ] 验证新的 `init` 输出和写入的版本化 `update` 场景
旧的 `.trellis/.version`
- [ ] 使用较旧的原始模板夹具添加升级回归，然后
断言安装的文件达到当前打包的形状
- [ ] 更新拥有 runtime 合约的后端 spec

**真实示例**：Codex 内联模式更改了 workflow 平台标记
`[Codex]` / `[Kilo, Antigravity, Windsurf]` 至 `[codex-sub-agent]` /
`[codex-inline, Kilo, Antigravity, Windsurf]`。全新 init 的结果正确，但
`trellis update` 只合并 `[workflow-state:*]` 块，并保留了过时的
这些块之外的标记。结果：升级后的项目获得了新的 hook 脚本
但旧的 workflow 路由，所以 `get_context.py --mode phase --platform codex`
可以返回空的阶段 2.1 详细信息。

---

## 模式检测探针清单

当 CLI 通过探测远程资源自动判断模式时（例如检查 `index.json` 是否存在，以决定使用 marketplace 还是直接下载）：

### 实施前：
- [ ] 探针在使用结果的**所有**代码路径中运行（交互式、`-y`、`--flag` 组合）
- [ ] 区分 404 和瞬态错误 — 不要将两者都视为“未找到”
- [ ] 瞬态错误**中止或重试**，永远不会默默地切换模式
- [ ] 当上下文发生变化（例如，用户切换源）时，共享状态（缓存、预取数据）将被重置**
- [ ] **快捷路径**（例如， `--template` 跳过选择器）必须具有与探测路径相同的错误处理质量 - 检查下游函数是否调用包罗万象的包装器

### 实施后：
- [ ] 跟踪从探测结果到模式决策分支的每条路径——无失败
- [ ] 外部格式契约（giget URI、原始 URL）经过测试或至少记录为注释
- [ ] 元数据读取消耗完整响应或使用流解析器 - 永远不要将固定大小的前缀解析为完整的 JSON
- [ ] 从解析的部分重建复合标识符时，验证**所有**字段都包含在内并且位于**正确的位置**（例如，`provider:repo/path#ref`而不是`provider:repo#ref/path`）
- [ ] 验证在快捷方式之后调用的**操作函数**不会在内部使用旧的包罗万象的获取 - 当错误区分很重要时，它们必须使用探测质量变体

**真实示例**：自定义注册表流程在 3 轮审核中存在 8 个错误：(1) 探针仅在交互模式下运行，(2) 瞬态错误陷入错误模式，(3) giget URI 的 `#ref` 位置错误，(4) 切换 source 后预取模板发生泄漏，(5) `--template` 快捷方式绕过了探针，但`downloadTemplateById` 内部使用了 catch-all `fetchTemplateIndex`，将超时变成“找不到模板”。

**真实示例**：agent session 的更新提示使用 `response.read(4096)` 获取 npm `latest` 元数据，然后将其解析为完整的 JSON。 `@mindfoldhq/trellis` 包元数据超过 4 KB，因此 JSON 被截断，解析失败，并且第一次会话注入没有显示更新提示。修复：在解析之前读取完整的响应，并添加回归，其中 `version` 后跟 8 KB 元数据尾部。

---

## 何时创建流程文档

在以下情况下创建详细的流程文档：

- 特征跨越 3+ 层
- 多个团队参与
- 数据格式复杂
- 该功能之前曾引发过错误

---

## 事件日志/投影边界

仅附加日志是跨层合约。单个事件经过：

```
CLI input → event writer → events.jsonl → reader → filter → reducer → display
```

### 清单：添加新事件类型或字段后

- [ ] 将事件类型添加到中央事件分类中
- [ ] 在事件层添加类型化事件变体或类型保护
- [ ] 为来自用户输入或 JSON 的 array/object 字段添加 normalization helper
- [ ] 只在 event writer 中分配 `seq` / `id`
- [ ] 让 filter 和 reducer 使用 typed event guard，而不是局部类型断言
- [ ] 让展示代码使用 reducer 输出或 typed events，而不是原始 JSON
- [ ] 至少添加一个回归测试，证明历史回放与实时过滤使用相同的 filter model

**真实示例**：添加了线程通道 `kind: "thread"`、`description`、
`context`、标签和 `lastSeq`。第一个实现重放线程
状态正确，但几个 commands 仍然重新解析事件有效负载字段
局部类型断言。修复方法是让核心事件层拥有 `ThreadChannelEvent`
和 `isThreadEvent`，让 `reduceChannelMetadata` 成为唯一的 channel metadata projection，并让 `reduceThreads` 成为唯一的 thread replay reducer。
