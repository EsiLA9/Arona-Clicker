# Unit task-0310-U09

## Goal
建立独立地图 UI 会话、历史/相机与稳定会话路由身份。

## Must Read / Read Set
Task0310 会话规则；workspace-router.ts；ui-surface.ts；PanelState。

## Context Budget
12k tokens；历史 0；超限拆分。

## Optional Read Set
直接调用方，不默认读取。

## Do Not Read by Default
归档与无关目录。

## Confirmed Facts
returnTo 仅一层；route-only Area 和 Map 通过镜像解析保留；同会话切图不应改变 surface。

## Constraints
Task0310；architecture-discipline；schema-sync。

## Allowed Files
- src/ui/workspace/area-map-session.ts
- src/ui/workspace/workspace-router.ts
- src/ui/update/ui-surface.ts
- src/ui/components/app-shell.ts
- tests/ui/area-map-session.test.ts

## Explicit Non-goals
仅本 Unit Goal；其余阶段不在本 Unit 实施。

## Stop Conditions
PROJECT-CONSTITUTION 六条；差异先交任务负责人复核与修订 Unit。

## Completion Criteria
- [x] 建立独立地图 UI 会话、历史/相机与稳定会话路由身份。

## Verification
新会话历史/相机/循环/自引用测试；workspace-router 回归。

## Pre-flight
目标与白名单如上；不扩大机制；范围、事实或验证冲突先停止 Unit 并复核。
