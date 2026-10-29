# Unit task-0310-U13

## Goal
连接地图 Controller、同步移动锁、局部 dispatcher 与会话生命周期。

## Must Read / Read Set
U10/U11 结构；Controller render/requestUIUpdate/refreshPanels/refreshChatPanel/navigation；InitService generation；AreaMapQuery；共享 gate。

## Context Budget
12k tokens；历史 0；超限拆分。

## Optional Read Set
直接调用方，不默认读取。

## Do Not Read by Default
归档与无关目录。

## Confirmed Facts
scheduleRender 合并结构更新；dispatcher 需 surface token 当前且 DOM 已 mount；InitService generation 在读档/重建/换线失效；EventBus同步广播。

## Constraints
Task0310；architecture-discipline；schema-sync。

## Allowed Files
- src/ui/workspace/area-map-controller.ts
- src/ui/controller.ts
- src/ui/controller-core.ts
- src/ui/components/area-map-workspace.ts
- src/ui/workspace/area-map-dom.ts

## Explicit Non-goals
仅本 Unit Goal；其余阶段不在本 Unit 实施。

## Stop Conditions
PROJECT-CONSTITUTION 六条；差异先交任务负责人复核与修订 Unit。

## Completion Criteria
- [x] 连接地图 Controller、同步移动锁、局部 dispatcher 与会话生命周期。

## Verification
类型/架构检查；随后 U14 真实 Controller 鼠标/失效/返回/DOM 连续性集成测试。

## Pre-flight
目标与白名单如上；不扩大机制；范围、事实或验证冲突先停止 Unit 并复核。
