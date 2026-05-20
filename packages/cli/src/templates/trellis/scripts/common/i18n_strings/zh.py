"""中文字符串包（zh）for Trellis Python scripts.

镜像 ``en.py`` 的 key 集合；缺失 key 会被 ``i18n.t`` 回落到英文版。
技术名词（路径、命令、变量名等）保持英文，不翻译。
"""

from __future__ import annotations

STRINGS: dict[str, str] = {
    # init_developer.py
    "init_developer.usage": "用法: {script} <开发者名称>",
    "init_developer.example_label": "示例:",
    "init_developer.example_command": "  {script} john",
    "init_developer.already_initialized": "开发者已初始化: {name}",
    "init_developer.reinit_hint": "如需重新初始化, 请先删除 {dir}/{file}",
}
