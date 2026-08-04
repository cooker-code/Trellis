# 实施计划：Channel Agent 与配置模板中文化

1. 阅读 CLI backend 与 unit-test 规范、现有模板聚合器、`init`/`update` 调用链和现有 i18n 测试。
2. 对将修改的模板选择函数与调用点执行 GitNexus 影响分析，确认直接调用方和执行流程风险。
3. 新增中文 Agent 和配置模板；保留英文模板原文与文件名。
4. 将 Agent/config 模板聚合改为按 `language` 选择，并贯通初始化与更新路径；保持无后缀落地路径及现有 registry 保留逻辑。
5. 新增/扩展单元和集成测试，覆盖中文、英文、回退、哈希和持久化语言设置。
6. 运行相关测试，再运行 `pnpm lint`、`pnpm typecheck` 与 CLI 测试；必要时以临时项目执行 `init --language zh` 与 `update` 冒烟验证。
7. 运行 Trellis 检查、更新相关规范或任务记录，执行提交前 GitNexus 变更检测；经用户确认后归档或提交。
