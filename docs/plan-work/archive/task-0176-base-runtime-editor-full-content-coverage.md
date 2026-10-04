# Task：基础包 RuntimeEditor 全内容表编辑覆盖

状态：proposed — Task 0175 已交付发布包与安全交换；等待进入完整内容表编辑施工

## 目标

让基础包的所有声明内容都能在游戏内 RuntimeEditor 以明确的结构化界面读取、新增、修改、删除和 Apply。编辑态副本必须保留包内资源与引用语义，不能让未支持字段因整包 round-trip 被静默清除。

## 范围

- 覆盖 Task 0175 盘点的 22 个当前无 RuntimeEditor 编辑面的内容表：`items`、`characters`、`characterVariants`、`dropTables`、`pics`、`charaProfiles`、`cultivateCurves`、`colorGroups`、`colorEquipments`、`gears`、`gearConfig`、`gachaPools`、`shops`、`triggerDefs`、`passivePools`、`passiveStories`、`stories`、`activeStories`、`affectorPacks`、`funcletDefs`、`resourceDisplays`、`extras`。
- 按领域依赖将表拆为独立可验收切片；每片声明允许编辑的字段、引用候选、校验、删除影响和完整 round-trip 行为。
- 复用 RuntimeEditor 的编辑态目标、Apply、包快照持久化和 base 同名交换回退。
- RuntimeEditor 仅编辑编辑态记录，不写入发布 `bundle` 基准。
- 明确当前 IndexedDB 按浏览器 Profile 隔离；若需要跨浏览器共享，另立文件同步任务，不假装同步已存在。

## 非目标

- 窄屏适配。
- 独立 `tools/datapack-editor/`。
- 变更 Engine / Datapack Schema，除非某个表编辑所需字段经单独裁定；字段变化仍须按 Schema 同步流程处理。
- 任意 JSON 原文编辑器作为唯一编辑能力。
- 存档迁移。

## 必须核对

- [[docs/docs-829/00-INDEX]]
- [[docs/docs-829/03-data-structures/datapack-contracts]]
- [[docs/docs-829/04-mechanisms/data-services/pack-loading]]
- [[docs/docs-829/05-conventions/architecture-discipline]]
- [[docs/docs-829/05-conventions/testing]]
- [[docs/ai/frontend-design-project-overlay]]
- `src/arona-clicker/contracts/runtime.ts`
- `src/arona-clicker/runtime.ts`
- `src/ui/runtime-editor/`
- `src/data-services/authoring/`
- 对应 `tests/data/`、`tests/engine/`、`tests/ui/`

## 验收

- 每张支持的基础包数据表均能在 UI 完成新增、读取、修改、删除和 Apply；用户在 UI 触发的删除只影响编辑态副本。
- 未编辑表、可选字段、嵌套列表、图片/资源和引用在 Apply、快照恢复与 base 回退中保持相同内容。
- 不合法引用和结构不能 Apply；失败时运行时与包快照不产生半提交。
- 发布基础 JSON 始终只读；被编辑的 base 仍可和发布或旧版本 base 交换回退。
- 定向 UI / Runtime / 数据服务测试、类型检查、架构检查、文档检查通过；涉及交互的区域完成桌面浏览器验收。

## 相关任务

- [[task-0175-base-packageization-editing-and-swap]]
