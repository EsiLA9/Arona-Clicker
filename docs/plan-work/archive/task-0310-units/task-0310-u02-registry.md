# Unit task-0310-U02：地图登记与两阶段验证

## Goal
在逐包阶段验证形状，在最终有效表验证直接引用，允许跨包前向和循环引用。

## Must Read / Read Set
Task0310；registry.ts 的 tableSteps/load/validate；registry-validate.ts 的 validateDatapack；area-map.ts；testing。

## Context Budget
目标 12k tokens；历史 0；超限拆分。

## Optional Read Set
现有 registry 测试。

## Do Not Read by Default
UI、归档、无关服务。

## Confirmed Facts
Registry.load 先 validateDatapack 再 merge；tableSteps 共管 merge/clear；最终引用检查有 validateCharacterRefs 先例。

## Constraints
Task0310；architecture-discipline；查询和验证不写游戏状态。

## Allowed Files
- src/data-services/registry/registry.ts
- src/data-services/registry/registry-validate.ts
- src/data-services/registry/area-map-validation.ts（新增）
- tests/data/area-map-registry.test.ts（新增）

## Explicit Non-goals
不接 Runtime finalize、不改 parser、不做 UI。

## Stop Conditions
PROJECT-CONSTITUTION 六条；差异由负责人先修订范围。

## Completion Criteria
- [x] 登记/clear、非法形状拒绝、最终引用与循环引用行为有测试。

## Verification
`npx vitest run tests/data/area-map-registry.test.ts`；类型检查随 P1 收敛。

## Pre-flight
目标与四文件白名单如上；不做包解析与 UI；范围/事实/验证冲突先停止 Unit 复核。
