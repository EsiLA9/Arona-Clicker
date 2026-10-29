# Unit task-0310-U01：独立区域地图契约

## Goal
声明 AreaMap、Area 入口和独立实体类型，供后续装载与查询消费。

## Must Read / Read Set
- Task0310 推荐数据模型；schema-sync；architecture-discipline。
- `src/data-services/contracts/world.ts`、`datapack.ts`、`src/data-services/index.ts`、`src/engine/core/entity-id.ts`。

## Context Budget
目标 10k tokens；历史 0；超出则拆分。

## Optional Read Set
无。

## Do Not Read by Default
归档与无关产品服务。

## Confirmed Facts
- Datapack.maps / Registry.maps 已为 GameplayMapDef；AreaDef 未含导航入口。
- ENTITY_TYPES 显式登记类型，parseEntityId 使用三段式格式。

## Constraints
遵守 Task0310 独立表与局部节点身份、schema-sync；不写业务状态。

## Allowed Files
- `src/data-services/contracts/area-map.ts`（新增）
- `src/data-services/contracts/world.ts`
- `src/data-services/contracts/datapack.ts`
- `src/data-services/index.ts`
- `src/engine/core/entity-id.ts`

## Explicit Non-goals
本 Unit 不实现装载、查询或 UI；Schema 生成留 U04。

## Stop Conditions
采用 PROJECT-CONSTITUTION 六条；范围差异先交由本任务负责人复核并修订 Unit。

## Completion Criteria
- [x] 独立 areaMaps / area-map / navigationMapId 源契约与导出完整。

## Verification
类型检查基线与修改后对比；后续 U02 用真实装载行为验证。

## Pre-flight
Goal 为独立契约；白名单如上五文件；不实施 Runtime/UI；遇范围、事实或验证冲突先停止本 Unit 复核。
