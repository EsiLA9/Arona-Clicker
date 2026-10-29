# Unit task-0310-U03

## Goal
贯通 JSON/ZIP 解析并在 Runtime 完整启用集上校验地图引用。

## Must Read / Read Set
Task0310；fragment-parser.ts、pack-parser.test.ts、runtime.ts 的三个装载验证入口、GameInstance.init。

## Context Budget
12k tokens；历史 0；超限拆分。

## Optional Read Set
直接调用方，不默认读取。

## Do Not Read by Default
归档与无关目录。

## Confirmed Facts
DATAPACK_LIST_FIELDS 显式列举且缺 maps；mergeFragments 显式写回。Runtime 配置/选择/通用 apply 各自装载临时 Registry，GameInstance 有最终 validateCharacterRefs。

## Constraints
Task0310；architecture-discipline；schema-sync。

## Allowed Files
- src/data-services/datapack/fragment-parser.ts
- src/arona-clicker/runtime.ts
- src/arona-clicker/runtime-game-instance.ts
- tests/data/area-map-pack.test.ts

## Explicit Non-goals
仅本 Unit Goal；其余阶段不在本 Unit 实施。

## Stop Conditions
PROJECT-CONSTITUTION 六条；差异先交任务负责人复核与修订 Unit。

## Completion Criteria
- [x] 贯通 JSON/ZIP 解析并在 Runtime 完整启用集上校验地图引用。

## Verification
`npx vitest run tests/data/area-map-pack.test.ts tests/data/fragment-parser.test.ts tests/data/pack-parser.test.ts`；类型检查。

## Pre-flight
目标与白名单如上；不扩大机制；范围、事实或验证冲突先停止 Unit 并复核。
