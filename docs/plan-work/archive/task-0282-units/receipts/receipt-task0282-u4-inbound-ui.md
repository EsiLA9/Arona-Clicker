# Receipt — task-0282-u4-inbound-ui

## 实际修改

- `src/ui/runtime-editor/view.ts`：incoming Inspector 行使用原始边 source 作为展示和跳转端点；outgoing 使用 target。映射并保留 `edgeSource`、`edgeTarget`、`scope`、`sourceCategory`、`targetLocations`、`context`。local 行展示真实 owner 与局部路径；原始引用路径仍属于 source。候选状态不再默认选第一个候选作为展示端点。
- `src/ui/runtime-editor/codex-details/types.ts`：为 InspectorReference 增加上述可选边端点、作用域、来源类别、局部位置和上下文类型。
- `tests/ui/runtime-editor-codex-integration.test.ts`：增加 Area 入向跳转到引用 Spot 的集成回归，以及基于只读 mock query 的 local incoming 适配回归。

## 验证

- 修复前基线尝试：`npx vitest run --silent tests/ui/runtime-editor-codex-integration.test.ts -t "查看 Area 的入向关系时显示并打开引用它的 Spot"`。Vitest 收集阶段因并行 Data Services 改动导入尚未落盘的 `runtime-content-reference-rules` 而失败，0 个测试执行，因此没有获得旧 UI assertion 的失败证据。
- 初次并行运行新增 local 用例时，测试对局部键不出现在整行文本中的断言过严；保留局部键作为说明文本，改为断言跳转键指向真实 source，并显示 owner/path。
- 最终定向验证：`npx vitest run --silent tests/ui/runtime-editor-codex-integration.test.ts`，19 项通过。
- `git diff --check` 针对三个代码/测试文件及 Receipt 执行，exit 0；Git 提示 `view.ts` 的 CRLF 将在后续写入时转为 LF。
- `npm run check:docs` 在 Receipt 改用唯一文件名后扫描 796 份 Markdown，R2 重名已消除；仍有 3 个 R3 失效源码路径，分别来自 U1、U2 和 Task 0283。主线程负责对应实现/路径修复，本 Unit 未改动这些白名单外文件。
- 类型检查、架构检查及浏览器验收由主线程集成阶段完成；本 Unit 未执行。

## 限制与上游交接

- 由于并行模块缺失，旧实现回归失败无法在实现前证明；后续定向测试覆盖修复后的 Area/Spot 跳转与 local incoming 端点。
- 主线程仍需完成 Runtime 公共契约集成后的 `npx tsc --noEmit`、`npm run check:architecture` 和协调的 UI 验收。

## GALHCG 只读复核

- `graph_project(workspace_path="C:\\Users\\15229\\Documents\\Obsidian Vault\\1-项目\\ACProgram")` 确认 `project_id=acprogram`。
- `graph_read(kind="batch")` 复核三个代码/测试路径，均可从当前磁盘读取且已索引；新 Receipt 可读取但 `indexed=false` / `refresh_required=true`。没有刷新或改图。
