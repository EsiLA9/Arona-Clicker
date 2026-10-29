# Receipt：Task 0288-U2 Map Registry 与入口引用

## 完成内容

- Registry 新增 Map 定义表、只读查询入口，并通过共用 `tableSteps` 支持多包合并覆盖与 `clear()`。
- Datapack 校验检查 Map ID 类型、包内重复 Map ID，以及 Map 内重复 Node ID、起点/出口/Edge 端点引用、自环和重复有向 Edge。
- Spot Functionality 增加独立 `mapEntry` / `mapId`；Registry 引用检查拒绝缺失或未知 Map。既有 `operationEntry` 仍只查 OperationEvent。
- `SpotFunctionalityView` 增加 `mapId`；现有查询实现直接投影功能定义，定向测试确认目标 ID 保留。
- 未修改生成 Schema。

## 验证

- `npx vitest run tests/data/gameplay-b-map-registry.test.ts`：通过，1 个测试文件、15 个测试。
- `npx tsc --noEmit`：通过；本轮未见 U1 时记录的 WorkspaceState 类型错误。
- `git diff --check`：无输出。

## GALHCG 直接路径只读复核

- 对 `src/data-services/registry/registry.ts` 执行 `graph_health(check="changed")`：返回 `content_changed`，当前图中已有 Registry 关联，但其 Evidence 对应内容已过期。
- 本任务只做只读复核；没有负责人授权进行 `graph_edit`、刷新或写入图。源码与测试仍是实现事实来源。
