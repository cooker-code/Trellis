# 研究：`.trellis/config.yaml` 加载链路与 Python i18n（国际化）模块设计（PR1）

- **调研问题**：调研 TS（TypeScript）与 Python 两端如何读 `.trellis/config.yaml`，以决定 `language` 字段加在哪、谁读、如何与 CLI（命令行工具）flag 合并；并给出 Python `scripts/common/i18n.py` 模块设计草案。
- **范围**：内部代码（不查外部库）
- **日期**：2026-05-20

---

## 1. TS 端 config 加载链路与 schema（结构定义）位置

### 关键发现：TS 端目前 **没有完整的 config schema 定义/类型**，全是按需「正则解析单一节」

| 用途 | 文件 | 行号 | 解析方式 |
|---|---|---|---|
| 模板源（注释样例） | `packages/cli/src/templates/trellis/config.yaml` | 全文 | 静态字符串，仅注释 |
| 模板加载（Node 层） | `packages/cli/src/templates/trellis/index.ts` | `:73` | `export const configYamlTemplate = readTemplate("config.yaml")` |
| init 时落地 | `packages/cli/src/configurators/workflow.ts` | `:106-110` | `writeFile(.trellis/config.yaml, configYamlTemplate)` |
| init 时给 monorepo 追加 packages 段 | `packages/cli/src/commands/init.ts` | `:968-1006` (`writeMonorepoConfig`) | 字符串拼接（不解析旧值，只检查是否已有 `^packages:` 行） |
| update 时读 update.skip | `packages/cli/src/commands/update.ts` | `:365-426` (`loadUpdateSkipPaths`) | 手写状态机逐行扫描 `update:` → `skip:` → `- xxx` |
| update 追加新章节 | `packages/cli/src/commands/update.ts` | `:442-472` (`extractConfigSection`) + `:484+` (`applyConfigSectionsAdded`) | 按 `#---` 分隔块抽取章节，按 sentinel 子串去重 |
| 章节追加声明 | `packages/cli/src/types/migration.ts` | `:32-54` (`ConfigSectionAdded`) | manifest schema |
| 章节追加 manifest 示例 | `packages/cli/src/migrations/manifests/0.5.11.json` (`session_auto_commit`)、`0.5.7.json`（`codex:`）| - | `{ file, sentinel, sectionHeading }` |

**没有 TS 端的 `TrellisConfig` interface，没有 JSON schema，没有 zod/io-ts 校验**。每个新增字段只是模板注释 + Python 端独立解析。CLI 在运行时基本不读 user config（只读 `update.skip`）。

### PR1 需要在 TS 端动哪几处

为支持 `language: 'en' | 'zh'` 字段，只需要：

1. **`packages/cli/src/templates/trellis/config.yaml`**：新增一节（同 `session_auto_commit` 风格），注释掉 `language: en` 默认值。
2. **`packages/cli/src/configurators/workflow.ts:77-131`**：`createWorkflowStructure` 增加 `language?: 'en' | 'zh'` 选项，决定按哪个 locale 选源文件落地（决策 3 的「sync 时落地」逻辑入口）。
3. **`packages/cli/src/commands/init.ts:930-954`** `InitOptions` 接口加 `language?: 'en' | 'zh'`，并在 `init` 函数内把 flag 透传到 `createWorkflowStructure`。
4. **`packages/cli/src/cli/index.ts:62-99`** `program.command("init")` 加 `.option("--language <code>", "Source template language: en | zh", "en")`；`update` 类似处理。
5. **migration manifest（下一个版本号）**：增 `configSectionsAdded` 入口，让旧用户 `trellis update` 自动追加 `language` 注释段，sentinel = `language:`，sectionHeading 取新加的章节标题。

### 不需要的事

- 不需要新建 TS 解析器：`language` 只在 init/sync 时用，CLI flag 优先级够用，无需运行时读 config（可选：在 sync 时按已有 `loadUpdateSkipPaths` 风格写一个 `loadLanguageFromConfig`，参考 `update.ts:365-426`）。
- 不需要 zod schema：与现状一致。

---

## 2. Python 端 config 加载链路与现有差异

### 两个 config reader 并存 —— 故意为之

| 文件 | 行号 | 角色 | 谁在用 |
|---|---|---|---|
| `templates/trellis/scripts/common/config.py` | 全文 446 行 | **完整** reader：`_load_config()` + 多个 typed accessor (`get_session_auto_commit`、`get_packages`、`get_hooks`、`get_spec_scope` …)；依赖 `paths.get_repo_root()` | `add_session.py:45`、`session_context.py:23`、`packages_context.py:16`、`task_store.py:25`、`paths.py:406,421`、`task_utils.py:229` |
| `templates/trellis/scripts/common/trellis_config.py` | 全文 132 行 | **极简** reader：`read_trellis_config(repo_root) -> dict`，只暴露原始 dict，**不依赖** `paths` / `developer` 等 task helpers | `git_context.py:30,94`（hooks 路径上）、`shared-hooks/inject-workflow-state.py:243`（platform hook 拷贝过去） |

差异原因（见 `trellis_config.py` 模块 docstring）：hooks（`shared-hooks/*.py`）需要在没有完整 task helper 上下文时安全读取 config，所以 `trellis_config.py` 是 `config.py` 解析器的「无依赖镜像」。两者都用同一套 `parse_simple_yaml` + `_strip_inline_comment` + `_unquote` 解析链（spec 文件 `script-conventions.md:1170-1326` 把这点称作「load-bearing chain」并明令禁止任何自写 reader）。

### 两端是否共享 schema（结构定义）？

**不共享**。

- TS 端：无 schema。
- Python 端：通过 typed accessor 在 `config.py` 模块内一处一处地映射（见 `script-conventions.md:1247-1273` 「document every key in templates/trellis/config.yaml」规约）。每个 key 必须有：
  1. `DEFAULT_<KEY>` 常量；
  2. `get_<key>(repo_root)` accessor（默认值兜底、类型强转、stderr warn-on-invalid）；
  3. `templates/trellis/config.yaml` 内对应注释样例。

PR1 的 `language` 字段也必须遵循这套规约。

---

## 3. 现有 config.yaml 字段一览（路径：`templates/trellis/config.yaml`）

| 节标题 (`#--- ...---`) | 字段 | 默认值 | 说明 |
|---|---|---|---|
| Session Recording | `session_commit_message` / `max_journal_lines` | `"chore: record journal"` / `2000` | journal 行为 |
| Session Auto-Commit | `session_auto_commit` (注释默认开) | `true` | 0.5.11 加 |
| Task Lifecycle Hooks | `hooks.{after_create,after_start,after_finish,after_archive}[]` (注释) | 空 | shell 钩子 |
| Monorepo / Packages | `packages.<name>.{path,type,git}` / `default_package` (注释，init 时自动写入) | 单仓库无 | monorepo |
| Codex (dispatch behavior) | `codex.dispatch_mode` (注释) | `inline` | 0.6 加 |

### `language` 应放置位置

新增独立一节，**放在 Session Recording 之后、Session Auto-Commit 之前**（最顶层项目级开关，紧跟最基础的 session 设置）。注释样例示意（与既有 `session_auto_commit` 注释风格保持一致）：

```yaml
#-------------------------------------------------------------------------------
# Language
#-------------------------------------------------------------------------------

# Source-template language used by `trellis init` / `trellis sync` to pick
# which version of workflow.md / agents/*.md / scripts to materialize into
# .trellis/. Switching language requires re-running `trellis sync`; runtime
# files are NOT live-translated.
#
# Accepts: en (default) / zh
# Falls back to en when a translated *.zh.* template is missing.
#
# Python scripts (task.py / add_session.py / init_developer.py …) read this
# value once at startup to choose the i18n string dictionary used by their
# user-facing prints. Change effect: edit + rerun `trellis sync`.
#
# language: en
```

注意：默认 **注释掉**（保持文件零差异），`config.py` 的 `get_language()` accessor 提供 default `"en"`。这样旧用户升级后 git diff 无变化，符合 R2「上游 merge 不冲突」目标。

---

## 4. CLI flag 与 config 优先级合并建议

PRD R1 要求 `trellis init --language zh` 临时覆盖 config（不写盘）。建议优先级（与现有 platform CliFlag 处理一致）：

```
最高 → 最低
1. CLI flag --language <code>   (init/sync 时一次性，不写盘)
2. 环境变量 TRELLIS_LANGUAGE   (可选，便于 CI / 多人协作覆盖)
3. .trellis/config.yaml: language
4. 默认值 "en"
```

实现位置（仅在 TS 入口处合并，结果传给 `createWorkflowStructure`）：

- `commands/init.ts:1015` `init(options)` 顶部添加：
  ```ts
  const language =
    (options.language as string | undefined) ??
    process.env.TRELLIS_LANGUAGE ??
    readLanguageFromConfig(cwd) ??
    "en";
  ```
- `readLanguageFromConfig(cwd)` 仿照 `update.ts:365-426` `loadUpdateSkipPaths` 写一个 5–10 行的扫描（找 `^language:\s*<value>$` 一行即可，比 `update.skip` 简单），不引入 yaml 库。
- 严格校验：非 `en|zh` → 退化到 `en` 并 stderr 警告（与 Python 端 `_is_true_config_value` warn-on-invalid 风格一致）。
- 不写盘：`--language zh` 只覆盖本次 sync 行为，不修改 `config.yaml`（PRD R1 明确要求）。如果用户想持久化，自己改 config 文件。

Python 端镜像同一优先级（`scripts/common/i18n.py` 的 `_resolve_locale()`，见下节）。

---

## 5. Python i18n 模块接口设计草案

文件：`packages/cli/src/templates/trellis/scripts/common/i18n.py`（新增），随后在 `templates/trellis/index.ts` 导出（仿 `commonConfig` 行）。

### 5.1 接口签名

```python
# scripts/common/i18n.py
from __future__ import annotations

import os
import sys
from pathlib import Path
from typing import Any

from .config import _load_config  # 复用 load-bearing 解析链
# (NOT: 自写 reader; 见 script-conventions.md:1186)

DEFAULT_LANGUAGE = "en"
SUPPORTED_LANGUAGES = ("en", "zh")

_current_locale: str = DEFAULT_LANGUAGE
_loaded_strings: dict[str, dict[str, str]] = {}  # locale -> {key: str}


def get_language(repo_root: Path | None = None) -> str:
    """Read 'language' from config.yaml, default 'en'.

    Mirrors common.config typed accessor pattern.
    Invalid value → warn to stderr, return 'en'.
    """
    config = _load_config(repo_root)
    raw = config.get("language", DEFAULT_LANGUAGE)
    code = str(raw).strip().lower()
    if code in SUPPORTED_LANGUAGES:
        return code
    print(
        f"[WARN] invalid language: {raw!r}; using {DEFAULT_LANGUAGE} (default)",
        file=sys.stderr,
    )
    return DEFAULT_LANGUAGE


def _resolve_locale(repo_root: Path | None = None) -> str:
    """Priority: TRELLIS_LANGUAGE env > config.yaml > default."""
    env = os.environ.get("TRELLIS_LANGUAGE", "").strip().lower()
    if env in SUPPORTED_LANGUAGES:
        return env
    return get_language(repo_root)


def set_locale(code: str | None = None, repo_root: Path | None = None) -> str:
    """Activate locale. Call once at script entry.

    Returns the active locale code for callers that want to log it.
    """
    global _current_locale
    target = (code or "").strip().lower() if code else _resolve_locale(repo_root)
    if target not in SUPPORTED_LANGUAGES:
        target = DEFAULT_LANGUAGE
    _current_locale = target
    _ensure_loaded(target)
    return target


def t(key: str, **kwargs: Any) -> str:
    """Translate a message key. Falls back to English then to the key itself."""
    _ensure_loaded(_current_locale)
    bundle = _loaded_strings.get(_current_locale, {})
    raw = bundle.get(key)
    if raw is None and _current_locale != DEFAULT_LANGUAGE:
        _ensure_loaded(DEFAULT_LANGUAGE)
        raw = _loaded_strings.get(DEFAULT_LANGUAGE, {}).get(key)
    if raw is None:
        return key  # last-resort: return the key as visible diagnostic
    if kwargs:
        try:
            return raw.format(**kwargs)
        except (KeyError, IndexError):
            return raw
    return raw


def _ensure_loaded(locale: str) -> None:
    if locale in _loaded_strings:
        return
    # lazy import to avoid runtime cost when language not switched
    if locale == "zh":
        from .i18n_strings.zh import STRINGS  # type: ignore[import-not-found]
    else:
        from .i18n_strings.en import STRINGS  # type: ignore[import-not-found]
    _loaded_strings[locale] = dict(STRINGS)
```

### 5.2 字典存放位置——推荐独立子模块（不内联）

```
packages/cli/src/templates/trellis/scripts/common/
├── i18n.py                      # 公共接口（上面的代码）
└── i18n_strings/
    ├── __init__.py
    ├── en.py                    # STRINGS: dict[str, str]  英文权威源
    └── zh.py                    # STRINGS: dict[str, str]  中文翻译
```

理由：

1. **可读性**：单独的 `en.py` / `zh.py` 文件让翻译者只关心字符串字典，改 PR 时 diff 干净，符合 R5「漂移检测」未来扩展（脚本可直接对比两个 dict 的 key 集合差）。
2. **与「并列后缀文件」决策（决策 1）哲学一致**：模板层用 `*.zh.md`，Python 层用 `i18n_strings/zh.py`，两边对称。
3. **不破坏 stdlib-only 规约**：每份字典就是 `STRINGS: dict[str, str] = {...}`，纯 dict，无 gettext / babel / json 依赖。
4. **延迟加载**：`_ensure_loaded` 按需 import；`en` 模式下不会触发 `zh.py` 加载。
5. **Python 3.9 兼容**：dict literal + dataclass-free，配合 `from __future__ import annotations`（i18n.py 顶部已加，参 `script-conventions.md:616-685`）。

`i18n.py` 也必须在 `templates/trellis/index.ts:30-62` 注册 `commonI18n`（仿 `commonConfig`），同时在 `getAllScripts()` `:79-115` map 加入 `common/i18n.py`、`common/i18n_strings/__init__.py`、`common/i18n_strings/en.py`、`common/i18n_strings/zh.py`。

### 5.3 调用方迁移示例（`init_developer.py` 试点——PR1 R4）

```python
# init_developer.py:25-47
from common.i18n import set_locale, t

def main() -> None:
    set_locale()  # reads TRELLIS_LANGUAGE / config.yaml / "en"

    if len(sys.argv) < 2:
        print(t("init_developer.usage", script=sys.argv[0]))
        print()
        print(t("init_developer.example_label"))
        print(f"  {sys.argv[0]} john")
        sys.exit(1)
    ...
```

`en.py` / `zh.py` 字典样例：

```python
# en.py
STRINGS = {
    "init_developer.usage": "Usage: {script} <developer-name>",
    "init_developer.example_label": "Example:",
    "init_developer.already_initialized": "Developer already initialized: {name}",
    ...
}

# zh.py
STRINGS = {
    "init_developer.usage": "用法: {script} <开发者名称>",
    "init_developer.example_label": "示例:",
    "init_developer.already_initialized": "开发者已初始化: {name}",
    ...
}
```

key 命名约定：`<file_stem>.<short_action>`。技术名词（路径、命令、变量）不进字典 — 见 PRD「Out of Scope」。

### 5.4 不破坏 stdlib-only 校验

- 没有第三方依赖：仅 `os`, `sys`, `pathlib`, `typing`。
- 字典就是 Python 字面量，启动开销 ≈ 一次 `import`。
- 兼容 `script-conventions.md:9` Python 3.9+ 约束（PEP 604 因 `from __future__ import annotations` 保护）。
- 与 Windows stdio 修复（`common/__init__.py` 中央化）共存：i18n 不接管 stdio，只产生 str，照常被 print。

---

## 6. PR1 落地清单（按文件）

| # | 文件 | 改动概要 |
|---|---|---|
| 1 | `templates/trellis/config.yaml` | 新增 `# Language` 注释节（参第 3 节示例） |
| 2 | `templates/trellis/scripts/common/config.py` | 新增 `DEFAULT_LANGUAGE`、`get_language(repo_root)` accessor（与 `get_session_auto_commit:215-243` 同风格） |
| 3 | `templates/trellis/scripts/common/i18n.py` (新建) | `set_locale` / `t` / `get_language` / `_resolve_locale` / `_ensure_loaded`（参第 5.1 节） |
| 4 | `templates/trellis/scripts/common/i18n_strings/{__init__.py,en.py,zh.py}` (新建) | `STRINGS` dict |
| 5 | `templates/trellis/scripts/init_developer.py` | 试点：顶部 `set_locale()`，print 文案改 `t(key)` |
| 6 | `templates/trellis/index.ts` | 新增 `commonI18n`、`commonI18nStringsInit/En/Zh` 导出，加入 `getAllScripts` map |
| 7 | `commands/init.ts` | `InitOptions` 加 `language?: 'en' \| 'zh'`；`init()` 顶部解析优先级；透传到 `createWorkflowStructure` |
| 8 | `cli/index.ts` | `init` / `update` 命令加 `.option("--language <code>", ...)` |
| 9 | `configurators/workflow.ts` | `WorkflowOptions` 加 `language?: 'en' \| 'zh'`；sync 落地时按 locale 选 `*.md` vs `*.zh.md`（与 sync 选源逻辑同 PR） |
| 10 | `migrations/manifests/<next-version>.json` | `configSectionsAdded: [{ file, sentinel: "language:", sectionHeading: "Language" }]` |
| 11 | 测试 | `loadLanguageFromConfig` 单测 / `i18n.t()` 切换 / 缺失 key 回落 / TRELLIS_LANGUAGE env 优先级 |

## 7. 关键参考行

- `templates/trellis/scripts/common/config.py:189-196` — `_load_config` 是所有 typed accessor 的入口
- `templates/trellis/scripts/common/config.py:215-243` — `get_session_auto_commit` 是新 accessor 的复制模版
- `templates/trellis/scripts/common/trellis_config.py:119-131` — `read_trellis_config`（hooks 用），i18n 不需要走这条
- `commands/update.ts:365-426` — `loadUpdateSkipPaths` 是 TS 端轻量 reader 模版
- `types/migration.ts:39-54` — `ConfigSectionAdded`，PR1 升级路径
- `migrations/manifests/0.5.11.json:8-14` — 最近一次新增 config 节的 manifest 样本
- `.trellis/spec/cli/backend/script-conventions.md:1170-1326` — config 字段新增的硬约束（必须走 `_load_config`、必须有 typed accessor、必须有注释样例、必须有 inline-comment 测试 fixture）

## 8. 注意事项 / 未发现项

- 代码里没看到现成的 `--language` CLI flag，确认 PR1 是首次引入（与 PRD 一致）。
- 没找到 TS 端的中央 `TrellisConfig` interface — 如果未来要做 schema 校验，会是另一个 PR；本次 PR1 不必涉及。
- 测试目录结构未深入排查（`packages/cli/test/?`）：PR1 写新测试时需要先看现有 `loadUpdateSkipPaths` 的测试位置作为放置参考，以后追加（本次研究范围未覆盖测试目录扫描）。
