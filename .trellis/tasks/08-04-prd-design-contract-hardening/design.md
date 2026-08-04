# 设计：PRD 与 Design 规划合同强化

## 1. 设计结论

1. prototype 对所有显式 `meta.ui=true` 的新 UI Task 都是必需规划产物；既有摘要批准门禁保留，并增加 PRD 用户可见引用一致性校验。
2. “轻量/复杂”不再依赖自由文本判断。新 Task 写入版本化规划画像，所有触发项必须显式为 `true` 或 `false`，运行时据此推导 tier。
3. 流程图一般可选；`interaction_change=true` 时强制在 PRD 中提供交互变化图，并显式标红变化路径。
4. `data_model_change=true` 时强制 `design.md` 提供可审阅 DDL 和表/字段说明；ER 图始终可选。
5. 新合同仅作用于带规划合同版本的 Task，历史 Task 不自动迁移或阻塞。

## 2. 版本化规划画像

新 Task 在 `task.json.meta` 中使用字符串值，保持现有 `--meta key=value` 和 JSON 兼容：

```json
{
  "planning_contract_version": "2",
  "planning_tier": "pending",
  "ui": "false",
  "interaction_change": "unknown",
  "data_model_change": "unknown",
  "public_contract_change": "unknown",
  "cross_layer_change": "unknown",
  "state_lifecycle_change": "unknown",
  "security_compatibility_rollout_change": "unknown",
  "technical_tradeoff": "unknown"
}
```

规划阶段通过专用命令一次性提交画像；不要要求用户连续执行多次 `set-meta`。候选接口：

```text
task.py set-planning-profile <task> \
  --interaction-change false \
  --data-model-change false \
  --public-contract-change true \
  --cross-layer-change true \
  --state-lifecycle-change true \
  --security-compatibility-rollout-change true \
  --technical-tradeoff true
```

推导规则：

- 七个复杂度触发项全部为 `false` → `planning_tier=lightweight`。
- 任意触发项为 `true` → `planning_tier=complex`。
- 任意触发项为 `unknown` 或缺失 → `planning_tier=pending`，禁止 start。
- `ui=true` 单独触发 prototype 门禁，不自动等于 complex；纯文案/样式 UI 小改仍可 lightweight。
- `interaction_change=true` 同时意味着 complex，并触发交互变化图合同。
- `data_model_change=true` 同时意味着 complex，并触发数据库设计合同。

该分类固定“判断输入和推导结果”，但不能证明 Agent 对事实声明诚实。最终规划摘要必须展示画像，用户批准后才能进入实施。

## 3. PRD 结构合同

### 3.1 需求编号

PRD 继续保留三个核心二级章节。在“需求”内按实际存在的变更类型建立三级章节：

```markdown
### R1 新增
- **R1.1 ...**
- **R1.2 ...**

### R2 修改
- **R2.1 ...**

### R3 保持不变
- **R3.1 ...**
```

- 类型候选为新增、修改、删除、保持不变、边界；英文镜像为 Add、Change、Remove、Preserve、Boundary。
- 只生成有内容的类型，不用空章节凑模板。
- 需求 ID 在 Task 生命周期内稳定；删除需求时保留弃用说明，不把后续编号整体重排。
- 用户可见结果使用 `O1`、`O2`，并在括号中映射一个或多个需求 ID。

### 3.2 UI prototype 管理块

`task.py create --meta ui=true` 在“用户可见结果”内生成机器管理块：

```markdown
<!-- ui-prototype:START -->
- [ ] **O-PROTOTYPE** 当前原型：[主入口](prototype/index.html)；
  预览：![原型预览](prototype/preview.png)；
  `prototype status: pending_user_approval`；`digest: pending`。
<!-- ui-prototype:END -->
```

- `approve-prototype` 在写入 manifest 批准后同步管理块的 digest 和状态。
- `prototype-status` 只读显示 manifest 与 PRD 管理块是否一致。
- start 同时验证 manifest/产物/批准和 PRD 管理块；缺少、越界、摘要过期或内容不一致均拒绝。
- 管理块之外的用户结果由作者维护，命令不得改写。

### 3.3 交互变化图

- `interaction_change=false` 时不要求图。
- `interaction_change=true` 时，在“用户可见结果”中增加 `### 交互变化`，至少包含一个 Mermaid 流程图。
- 变化节点使用 `changed` class 和红色边框；变化连线使用红色 `linkStyle`。
- 节点文字必须包含“新增：”“修改：”或“删除：”，不能只靠颜色传达差异。
- 未变化上下文可使用默认样式，帮助用户看清变化前后的连接位置。

## 4. Database Design 合同

当 `data_model_change=true` 时，`design.md` 至少包含：

1. `## 数据模型`：模型目标、边界和生命周期。
2. `### DDL`：所有新增或修改表的完整建表/变更语句。
3. `### 表与字段说明`：每张表的用途，以及每个字段的类型、空值、默认值、业务含义和约束。
4. 主键、唯一键、外键/逻辑关系、索引和迁移/回滚说明。

注释规则：

- 支持原生注释的方言使用 `COMMENT` 或 `COMMENT ON TABLE/COLUMN`。
- SQLite 等不持久化列注释的方言，在 DDL 中使用可读 SQL 注释，并以“表与字段说明”作为权威数据字典。
- Validator 先识别行首 `CREATE TABLE`/`ALTER TABLE`，避免把说明文字或注释中的 SQL 示例误计为正式 DDL。
- ER 图可使用 Mermaid `erDiagram`；它是可选增强，不影响 start。多表或关系变更时 Workflow 应推荐，但不能自动批准或强制。

## 5. Runtime 门禁与命令

新增独立 `planning_gate.py`，避免把结构解析、DDL 检查和 prototype 逻辑全部塞进 `task.py`：

- `set-planning-profile`：校验布尔输入并写入推导 tier。
- `planning-status`：只读输出画像、需求编号、结果映射、prototype、交互图、复杂产物和数据库合同状态。
- `cmd_start`：先运行 planning gate，再运行 prototype digest gate；两者都在状态、活动指针和 hook 前完成。

门禁矩阵：

| 条件 | 必需产物/内容 | 失败结果 |
| --- | --- | --- |
| contract v2 + tier pending | 完整规划画像 | 拒绝 start |
| lightweight | PRD 编号与结果映射 | 拒绝 start |
| complex | PRD + design + implement | 拒绝 start |
| ui=true | prototype 产物、批准、PRD 管理块一致 | 拒绝 start |
| interaction_change=true | PRD 交互变化 Mermaid 与红色变化路径 | 拒绝 start |
| data_model_change=true | design DDL + 表/字段说明 | 拒绝 start |
| legacy task | 维持现有兼容路径 | 不新增阻塞 |

## 6. 代码与传播范围

### Runtime 与模板真相源

- `packages/cli/src/templates/trellis/scripts/common/planning_gate.py`：新规划合同 validator。
- `packages/cli/src/templates/trellis/scripts/common/task_store.py`：create 时写 contract v2 pending 画像并生成 UI PRD 管理块。
- `packages/cli/src/templates/trellis/scripts/task.py`：命令入口和 start 前统一门禁。
- `packages/cli/src/templates/trellis/scripts/common/i18n_strings/{en,zh}.py`：可操作错误信息。
- `packages/cli/src/templates/trellis/index.ts`：把新 Python 文件纳入发布模板。
- `.trellis/scripts/**`：dogfood 镜像，与发布模板保持同步。

### AI 规划与合同传播

- `packages/cli/src/templates/common/prd-contract.json`：升级为版本化规划合同源。
- `packages/cli/scripts/check-prd-contract.mjs`：同步中英文 Workflow/Brainstorm managed block，并检查新语义。
- `packages/cli/src/templates/common/skills/brainstorm*.md`：收集规划画像、需求编号、prototype、交互图和数据库设计。
- `packages/cli/src/templates/trellis/workflow*.md`、`.trellis/workflow.md`：planning/start 门禁说明。
- `packages/cli/src/templates/common/bundled-skills/trellis-meta/references/local-architecture/task-system*.md`：Task 模型说明。
- docs-site 与 Marketplace 模板同步语义，但外部仓库 PR 不作为父仓库门禁。

### Tests

- 扩展 `packages/cli/test/templates/prd-contract.test.ts` 的正向/负向 mutation。
- 新增 planning gate integration tests，覆盖 lightweight、complex、unknown、UI 管理块、交互图、DDL 注释、多方言和 legacy 兼容。
- 复用 prototype gate tests，验证 planning/prototype 任一失败都不写状态、不移动指针、不触发 hook。

## 7. 兼容性、风险与回滚

- contract v2 仅对新建或显式迁移的 Task 生效；历史 Task 不扫描、不自动改写。
- 最大风险是误把合法轻量 Task 阻塞或由 Markdown 解析误判。所有错误必须输出具体缺失项，并提供 `planning-status` 预检。
- DDL 解析只承担规划合同检查，不构建完整 SQL parser；不支持的方言可以通过结构化数据字典满足备注合同。
- 实现前先处理 `08-01-ui-prototype-directory-start-gate` 的未提交基线，避免两个 Task 争用同一批文件而无法独立审计。
- 回滚时先解除 `cmd_start` 对 planning gate 的调用，保留向后兼容的 metadata 和只读状态命令；不得破坏既有 prototype gate。
