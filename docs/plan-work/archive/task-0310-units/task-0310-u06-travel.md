# Unit task-0310-U06

## Goal
提取旅行共享预检，保证只读预览与原移动命令准入一致。

## Must Read / Read Set
InitService.travelToArea；GameInstance.travelToArea；GameReadModel；game-instance 测试；world-lifecycle。

## Context Budget
12k tokens；历史 0；超限拆分。

## Optional Read Set
直接调用方，不默认读取。

## Do Not Read by Default
归档与无关目录。

## Confirmed Facts
旅行先存在、同 Init、Story、AlreadyThere、邻接、可见；成功后才清 passive/改变位置/发事件。

## Constraints
Task0310；architecture-discipline；schema-sync。

## Allowed Files
- src/arona-clicker/services/init-service.ts
- src/arona-clicker/runtime-game-instance.ts
- src/arona-clicker/contracts/runtime.ts
- tests/engine/area-map-travel.test.ts

## Explicit Non-goals
仅本 Unit Goal；其余阶段不在本 Unit 实施。

## Stop Conditions
PROJECT-CONSTITUTION 六条；差异先交任务负责人复核与修订 Unit。

## Completion Criteria
- [x] 提取旅行共享预检，保证只读预览与原移动命令准入一致。

## Verification
新集成测试确认预检无副作用及错误顺序；game-instance 回归。

## Pre-flight
目标与白名单如上；不扩大机制；范围、事实或验证冲突先停止 Unit 并复核。
