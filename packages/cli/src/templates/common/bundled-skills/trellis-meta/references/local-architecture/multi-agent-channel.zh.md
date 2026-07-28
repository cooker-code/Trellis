# 本地多智能体通道运行时

`trellis channel` 是随 Trellis CLI 提供的本地多智能体协作运行时。它让主 AI（人工智能）会话能够派生同级 worker（工作代理，Claude Code、Codex 或 `.trellis/agents/` 下的任意代理定义），通过事件日志交换持久消息，并在无需手工拼接 shell 管道的情况下协调审查或 brainstorm（头脑风暴）循环。

本参考资料说明通道如何接入用户项目，以便需要定制项目的 AI 知道应修改什么。运行时用法（命令、论坛/线程模式、worker 派生标志）请参阅内置的 `trellis-channel` 能力技能。

## 本地系统模型

通道运行时跨越三个本地层面：

1. 用户主目录中的**存储层**：持久事件日志和 worker 状态文件。
2. 项目内 `.trellis/agents/` 中的**代理定义**：供 `trellis channel spawn --agent <name>` 使用的平台无关角色卡。
3. `.trellis/config.yaml` 中的**项目配置**：worker 防护阈值和其他通道开关。

## 核心路径

| 路径 | 用途 |
| --- | --- |
| `~/.trellis/channels/<project>/<channel>/events.jsonl` | 每个通道的仅追加事件日志。序列锁定，可安全重放。 |
| `~/.trellis/channels/<project>/<channel>/<channel>.lock` | 通道级写锁。 |
| `~/.trellis/channels/<project>/<channel>/<worker>.spawnlock` | OOM guard（内存不足防护）使用的逐 worker 派生锁。 |
| `~/.trellis/channels/<project>/<channel>/.seq` | 用于有序事件分配的序列 sidecar（旁车文件）。 |
| `~/.trellis/channels/_global/<channel>/...` | 使用 `--scope global` 创建的通道。项目桶会被共享键替代。 |
| `.trellis/agents/check.md` | `--agent check` 使用的默认 Check Agent（检查代理）角色定义。 |
| `.trellis/agents/implement.md` | `--agent implement` 使用的默认 Implement Agent（实施代理）角色定义。 |
| `.trellis/config.yaml`（`channel.*` 块） | worker 防护阈值和通道默认值。 |

项目桶名称从绝对项目路径推导而来（斜杠会被压平，非字母数字字符会替换为 `-`），与 Claude Code 的 `~/.claude/projects/<sanitized-cwd>/` 约定一致。测试或 sandboxing（沙箱隔离）时，可通过 `TRELLIS_CHANNEL_ROOT`（根目录）或 `TRELLIS_CHANNEL_PROJECT`（桶名称）覆盖。

## 何时应使用通道运行时

通道比单个 Bash 调用或一次性 sub-agent（子代理）派发更重。仅在至少满足下列一个条件时使用：

- 工作需要**两个或更多代理**通过多轮对话协作（跨 AI 头脑风暴、同级审查、调度器 + worker）。
- worker 应作为**同级进程**运行，主会话可以中断、观察进度或异步等待它。
- 对话必须在之后仍然**持久且可检查**（论坛/线程通道、议题面板、决策轨迹）。
- 多个 worker 必须**共享事件日志**，从而能看到其他 worker 的报告。

在下列情形优先使用更轻量的方式：

- 单次 Bash 调用或单个 Agent 工具调用就够用 -> 直接这样做。
- 用户只需针对一个文件的静态审查 -> 读取文件并内联回复。
- 需求是“记住上周讨论过什么” -> 使用 `trellis mem`，而不是通道。

## 定制入口

| 需求 | 修改位置 |
| --- | --- |
| 修改默认通道 worker 空闲超时 | `.trellis/config.yaml` 中的 `channel.worker_guard.idle_timeout`。接受 `5m`、`30s` 等；设置 `0` 可停用空闲清理。 |
| 修改存活 worker 预算 | `.trellis/config.yaml` 中的 `channel.worker_guard.max_live_workers`。设置 `0` 可停用派生时预算检查。 |
| 按次派生覆盖 worker 防护 | 在 `trellis channel spawn` 上传入 `--idle-timeout` / `--max-live-workers`，或在环境中设置 `TRELLIS_CHANNEL_WORKER_IDLE_TIMEOUT` / `TRELLIS_CHANNEL_MAX_LIVE_WORKERS`。 |
| 修改默认 Check 或 Implement worker 的工作内容 | 编辑 `.trellis/agents/check.md` 或 `.trellis/agents/implement.md`。这些是平台无关角色卡；传入 `--agent check|implement` 时，通道运行时会注入它们。 |
| 新增角色卡 | 将 `<name>.md` 放入 `.trellis/agents/`。`trellis channel spawn --agent <name>` 会读取它。 |
| 迁移通道存储位置（CI sandbox、临时运行） | 设置 `TRELLIS_CHANNEL_ROOT=/path/to/dir`。通道事件会随之迁移；现有通道仍留在旧根目录。 |
| 切换存储范围 | 在每个通道子命令中传入 `--scope project`（默认）或 `--scope global`。桶目录会改变，其他内容不变。 |

worker 防护的优先级为：CLI flag（命令行标志）> environment variable（环境变量）> `.trellis/config.yaml` > built-in default（内置默认值）。内置默认值为 `idle_timeout: 5m` 和 `max_live_workers: 6`。

## 与其他本地层的关系

- **工作流层**：使用通道派发的工作流（例如 `channel-driven-subagent-dispatch`）会指示主代理调用 `trellis channel spawn --agent check` 或 `--agent implement`，而非平台 sub-agent。若 `.trellis/agents/check.md` 或 `implement.md` 缺失，`trellis workflow --template <id>` 会在安装时打印非阻塞警告。若意外删除，请使用 `trellis update` 恢复。
- **任务层**：通道 worker 不拥有 task（任务）状态。监督的主会话会通过 worker 收件箱传递活动任务路径；worker 从磁盘解析任务产物。
- **规范层**：worker 与主会话以同样方式读取 `.trellis/spec/`。通道运行时不会绕过规范上下文加载。
- **平台集成层**：通道运行时与平台无关。它不依赖 `.claude/`、`.codex/` 或任何其他平台目录。用于规范化提供方输出的 adapter（适配器，Claude `stream-json`、Codex `app-server`）位于 Trellis CLI 二进制包内，而非项目中。
- **平台子代理文件与通道 worker**：编辑 `.claude/agents/trellis-implement.md`（及其他平台 `.X/agents/` 目录中的对应文件）**不会**改变通道运行时 worker 行为——通道 worker 加载的是 `.trellis/agents/<name>.md`。平台专属代理文件用于主 AI 会话直接派发子代理，而不是用于通道派生的 worker。平台代理层面请参见 `platform-files/agents.md`，以及规定这种拆分的 `trellis-meta/SKILL.md` 规则。

## 运行时用法

有关命令语法、论坛/线程模式、worker handles（工作代理句柄）、进度检查以及 `--kind done` / `--kind turn_finished` 调度器等待模式，请加载内置 `trellis-channel` 技能（在执行 `trellis init` / `trellis update` 后会自动安装到每个平台的技能目录）。本参考资料仅涵盖本地文件布局和定制开关；它不会重复可能随发行版变动的命令语法。
