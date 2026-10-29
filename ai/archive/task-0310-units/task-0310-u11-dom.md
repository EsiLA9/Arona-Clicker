# Unit task-0310-U11

## Goal
协调地图局部 DOM，保持 SVG/节点/详情滚动宿主身份并处理缺失子区。

## Must Read / Read Set
U10 结构草图；AreaMapWorkspace renderer；Popover mutation range；workspace frame column selectors。

## Context Budget
12k tokens；历史 0；超限拆分。

## Optional Read Set
直接调用方，不默认读取。

## Do Not Read by Default
归档与无关目录。

## Confirmed Facts
SVG world 与 keyed nodes/edges 可独立更新；Popover 提供 dismissBeforeRootMutation(scope)/retainIfAnchored。

## Constraints
Task0310；architecture-discipline；schema-sync。

## Allowed Files
- src/ui/workspace/area-map-dom.ts
- src/ui/components/area-map-workspace.ts
- src/ui/css/area-map.css
- tests/ui/area-map-dom.test.ts

## Explicit Non-goals
仅本 Unit Goal；其余阶段不在本 Unit 实施。

## Stop Conditions
PROJECT-CONSTITUTION 六条；差异先交任务负责人复核与修订 Unit。

## Completion Criteria
- [x] 协调地图局部 DOM，保持 SVG/节点/详情滚动宿主身份并处理缺失子区。

## Verification
DOM identity、详情滚动、隐藏移除和缺失子区恢复测试。

## Pre-flight
目标与白名单如上；不扩大机制；范围、事实或验证冲突先停止 Unit 并复核。
