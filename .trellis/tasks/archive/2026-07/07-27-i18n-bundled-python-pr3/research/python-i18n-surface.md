# 调研：剩余 Python i18n（国际化）文案范围

- **查询**：核查 Python i18n 框架及 i18n PR3 中剩余面向用户的 Python 文案。
- **范围**：`packages/cli/src/templates/trellis/scripts/**`、相关规范与测试。
- **日期**：2026-07-27

## 现有框架

PR1-A 已提供：

- `common/i18n.py`：`set_locale`、`get_locale`、`t`、英文回落、键回落与惰性 bundle（资源包）加载；
- `common/i18n_strings/en.py` 与 `zh.py`；
- 带 `en|zh` 校验的 `common/config.py:get_language()`；
- 当前唯一已迁移的调用方 `init_developer.py`。

当前中英文 bundle 仅有五个 `init_developer.*` 键，且没有 Python `t()` 或 bundle 一致性的直接测试。GitNexus 对 `common/i18n.py:t` 评为 LOW 风险（一个直接调用方 `init_developer.main`），但 PR3 会刻意扩大核心脚本调用范围。

## 核心面向用户范围

仓库扫描在 17 个 Python 文件中发现约 370 处直接 `print`、argparse（参数解析器）帮助/描述、日志及可见异常候选。核心公开入口为：

- `task.py`；
- `add_session.py`；
- 通过 `common/git_context.py:main` 的 `get_context.py`；
- `get_developer.py`；
- `init_developer.py`。

这些入口的大部分可见文字位于 `common/developer.py`、`common/task_store.py`、`common/task_context.py`、`common/task_utils.py`、`common/safe_commit.py`、`common/session_context.py`、`common/packages_context.py`、`common/config.py` 的部分警告和 `common/workflow_phase.py` 的部分错误中。`task.py` 约有 89 个候选，`add_session.py` 约 52 个，`common/task_store.py` 约 60 个。

## 范围分类

### 通过 `t(key)` 翻译

- 面向用户的成功、警告、错误、提示和状态说明；
- argparse 的命令描述及 `help=` 文本；
- 保留命令/参数/placeholder 的多行用法说明；
- 文本模式会话/包上下文标题与解释；
- safe-commit（安全提交）警告，包括既有反例 `git add -f .trellis/`；
- 由核心入口路径抛出的可见错误。

每个核心入口须在构造 argparse 或输出前只调用一次 `set_locale()`。共享函数应调用 `t()`，不得自行再次解析 locale。

### 保持稳定协议/技术输出

不得翻译命令与参数、路径、环境变量、JSON/JSONL 键、状态 enum（枚举）值、包/任务 ID、分支名和 placeholder；也不得翻译被调用方消费的 `task.py create`/`archive` 原始 stdout（标准输出）路径和 `task.py current` 原始路径输出。

`task.py current --source` 的 `Current task:`、`Source:`、`State: stale` 必须保持原文：bundled 与平台 agent prelude（代理前置上下文）明确要求解析 `Current task:` 行。JSON 模式中的标识性键/值、stdout/stderr（标准错误）通道、退出码，以及作为稳定 severity token（严重级别标记）的 `[OK]`、`[WARN]`、`[ERROR]` 亦不得改变。中文 locale 只能翻译这些 token 周围的自然语言。

### 本 PR 不翻译的内容

- Python 注释和仅供开发者使用的 docstring（文档字符串）；
- 仅用于调试的诊断与断言；
- `paths.py`、`task_utils.py` 等库文件中 `if __name__ == "__main__"` 的自测输出；
- `developer.py`、`add_session.py` 生成的持久 journal/index Markdown schema（结构定义）。其中英文 marker/header（标记/标题）会被既有更新逻辑解析，且不属于控制台消息；
- `templates/trellis/scripts/**` 外的平台专属 Python hook；
- 可选 `scripts/hooks/linear_sync.py`。它在嵌套目录运行，若要导入 `common.i18n` 将改变其导入契约或加入禁止的 `sys.path` 操作；应在路线图记录，不能复制 locale 逻辑；
- `common/config.py:get_language()` 对无效 `language` 的启动警告。此时 locale 尚未有效解析，且 `i18n.py` 已导入 `config.py`，必须保留英文回落诊断以避免循环依赖。

这些排除项须写入本地化覆盖页面，使“剩余 Python 消息”拥有可验证边界。

## 消息键设计

遵循 `.trellis/spec/cli/backend/script-conventions.md`：

- 使用 `<module_or_command>.<short_action>` 形式的扁平键；
- 英文 bundle 是规范键集合；
- PR 完成时中文 bundle 镜像全部键；
- 两种语言中 `str.format` placeholder 名称必须相同；
- 缺失中文键回落英文，双侧缺失时回落键本身。

建议命名空间：`task.*`、`task_create.*`、`task_archive.*`、`task_context.*`、`add_session.*`、`developer.*`、`get_developer.*`、`context.*`、`packages_context.*`、`safe_commit.*`、`config.*`。不要为仅含标点或空行建立键；不依赖语言的格式留在调用方，始终一同输出的完整多行块使用一个键。

## 漂移与验证缺口

`packages/cli/scripts/check-i18n-drift.js` 当前仅检查带后缀文件的 Git 时间戳。script-conventions 规范宣称会比较 Python bundle 键，但实现尚不存在。PR3 应增加：

1. 中英文键集合比较；
2. 每个共享键的 placeholder 集合比较；
3. 普通模式输出警告、`--strict` 模式返回非零；
4. 识别 `*.zh.md.txt` 复合模板后缀。

## 必需测试

应建立专用 Python-i18n subprocess（子进程）/集成测试，而不是只做源码字符串断言：

1. 将 `getAllScripts()` 复制到临时 `.trellis/scripts` 树；
2. 无 locale/config 时断言代表性英文输出；
3. 以 `TRELLIS_LANGUAGE=zh` 运行，断言 `task.py`、`add_session.py`、`get_developer.py`、`get_context.py` 文本模式的代表性中文；
4. 无环境变量时验证 config 中 `language: zh`；
5. 验证 `TRELLIS_LANGUAGE` 优先于 config；
6. 验证缺失中文键回落英文、双侧缺失回落键；
7. 验证中英文 placeholder 名称相同；
8. 验证 `task.py current --source` 在 `zh` 下仍满足稳定协议；
9. 验证 JSON 模式在 `en`、`zh` 下 schema 不变；
10. 验证退出码及 stdout/stderr 通道不变；
11. 尽可能在同一进程运行语言序列，发现模块状态泄漏。

测试使用平台已选 Python 命令，维持 Python 3.9 兼容（`from __future__ import annotations`），并运行 `pnpm lint:py`。

## 设计约束与影响

- 不引入 gettext/Babel 或外部依赖；模板只使用标准库；
- 不新增第二个 locale 解析器；PR3 消费 PR1/PR2 语言契约；
- 不在模块加载期从 `config.py` 导入 `i18n`，因为 `i18n.py` 已导入 config 访问器；
- 保留 `common/__init__.py` 的 Windows UTF-8 行为；
- 入口模块保持简单：只解析一次 locale，再委派。

GitNexus 对 `task.py:main`、`add_session.py:main`、`git_context.py:main` 的当前风险均为 LOW。实际风险在输出契约兼容性，而非调用图深度；测试必须聚焦精确通道、退出码、解析标签和 JSON schema。
