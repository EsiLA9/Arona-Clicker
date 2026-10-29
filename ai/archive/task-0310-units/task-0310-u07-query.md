# Unit task-0310-U07

## Goal
提供单图 detached Reveal 投影、入口查询和动作复验查询。

## Must Read / Read Set
Task0310；RevealTrigger/reveal.ts；tooltip-reveal.ts 仅作语义参考；ConditionQueryPort；GameInstance。

## Context Budget
12k tokens；历史 0；超限拆分。

## Optional Read Set
直接调用方，不默认读取。

## Do Not Read by Default
归档与无关目录。

## Confirmed Facts
RevealTrigger 使用 reveal 判别、同目标 OR、缺省条件恒真；UI 不可作为领域依赖；Registry 提供独立 areaMaps。

## Constraints
Task0310；architecture-discipline；schema-sync。

## Allowed Files
- src/arona-clicker/contracts/area-map-query.ts
- src/arona-clicker/services/area-map-query.ts
- src/arona-clicker/runtime-game-instance.ts
- src/arona-clicker/contracts/runtime.ts
- tests/engine/area-map-query.test.ts

## Explicit Non-goals
仅本 Unit Goal；其余阶段不在本 Unit 实施。

## Stop Conditions
PROJECT-CONSTITUTION 六条；差异先交任务负责人复核与修订 Unit。

## Completion Criteria
- [x] 提供单图 detached Reveal 投影、入口查询和动作复验查询。

## Verification
`npx vitest run tests/engine/area-map-query.test.ts --silent`；检查隐藏内容与无副作用、循环单图读取。

## Pre-flight
目标与白名单如上；不扩大机制；范围、事实或验证冲突先停止 Unit 并复核。
