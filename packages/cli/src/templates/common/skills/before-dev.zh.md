在开始 task 前读取相关开发规范。

执行以下步骤：

1. **读取当前 Task 产物**：
   - `prd.md`：面向人阅读的目标、需求和用户可见结果合同
   - `design.md`（如存在）：技术设计
   - `implement.md`（如存在）：执行顺序和验证计划

2. **发现包及其 Spec 层**：
   ```bash
   python3 ./.trellis/scripts/get_context.py --mode packages
   ```

3. 根据以下信息**判断哪些 specs 适用于当前 Task**：
   - 正在修改哪个包（例如 `cli/`、`docs-site/`）
   - 工作类型（后端、前端、单元测试、文档等）
   - Task 产物中引用的任何 Spec/调研路径

4. **读取每个相关模块的 Spec 索引**：
   ```bash
   cat .trellis/spec/<package>/<layer>/index.md
   ```
   遵循索引中的 **“开发前检查清单”** 部分。

5. **读取开发前检查清单中列出的、与 Task 相关的具体规范文件**。索引不是终点——它会指向真正的规范文档（例如 `error-handling.md`、`conventions.md`、`mock-strategies.md`）。阅读这些文件，理解编码标准和项目模式。

6. **始终读取共享指南**：
   ```bash
   cat .trellis/spec/guides/index.md
   ```

7. 理解需要遵循的编码标准和模式，然后再开始开发计划。

此步骤在编写任何代码前都是**强制要求**。
