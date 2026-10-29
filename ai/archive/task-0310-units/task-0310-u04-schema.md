# Unit task-0310-U04

## Goal
生成区域地图 Schema 并注册最低限度独立编辑器表和引用元数据。

## Must Read / Read Set
schema-sync；Schema types/merge/editor-extras；生成器 parseEngineSchema；同步测试。

## Context Budget
12k tokens；历史 0；超限拆分。

## Optional Read Set
直接调用方，不默认读取。

## Do Not Read by Default
归档与无关目录。

## Confirmed Facts
Schema defMap 从 Datapack 推导；编辑器 TABLE_META/TableKey 显式登记；复杂字段可回退 JSON。

## Constraints
Task0310；architecture-discipline；schema-sync。

## Allowed Files
- tools/datapack-editor/schema/types.ts
- tools/datapack-editor/schema/editor-extras.ts
- tools/datapack-editor/schema/engine-schema.sync.test.ts
- tools/datapack-editor/schema/engine-defs.gen.json（仅由生成器写入）

## Explicit Non-goals
仅本 Unit Goal；其余阶段不在本 Unit 实施。

## Stop Conditions
PROJECT-CONSTITUTION 六条；差异先交任务负责人复核与修订 Unit。

## Completion Criteria
- [x] 生成区域地图 Schema 并注册最低限度独立编辑器表和引用元数据。

## Verification
`npm run gen:schema`；`npx vitest run tools/datapack-editor/schema/engine-schema.sync.test.ts`。

## Pre-flight
目标与白名单如上；不扩大机制；范围、事实或验证冲突先停止 Unit 并复核。
