# 05-conventions/testing — 测试约定

> 本文回答：如何为引擎、数据服务、产品 Runtime 和 UI 的行为变更选择测试入口。

## 组织方式

- `tests/engine/`：Engine 机制、Runtime 装配和领域协作测试。
- `tests/data/`：Datapack、Registry、包管理、资产和持久化测试。
- `tests/ui/`：组件、Controller、UIContext 与 DOM 可见行为测试。
- `tools/datapack-editor/**`：独立编辑器模型、Schema、校验和 UI 测试。

测试目录按测试主体大类组织，并不保证与每个源码文件一对一。跨层行为可在适当目录中用集成测试验证。

## 命令与证据

- `npm test` 执行 Vitest 一次性全量测试。
- 文档变化运行 `npm run check:docs`；涉及文件还应核对差异空白。
- 机制修改须有对应行为测试；报告测试结果时区分已运行与未运行。
- Schema 源类型变化另按 [[docs/docs-829/05-conventions/schema-sync]] 执行同步与校验。
