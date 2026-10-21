# Unit task-0310-U17

## Goal
将已验证的区域地图机制、路由、局部刷新与视觉复用写入现行文档。

## Must Read / Read Set
本 Task 实际源码/行为测试/浏览器结果；doc-maintenance；上述文档当前正文。

## Context Budget
12k tokens；历史 0；超限拆分。

## Optional Read Set
直接调用方，不默认读取。

## Do Not Read by Default
归档与无关目录。

## Confirmed Facts
独立 areaMaps/area-map，最终集引用预检、detached 查询与共享旅行准入、UI session/region，均由实现与测试核实。

## Constraints
Task0310；architecture-discipline；schema-sync。

## Allowed Files
- docs/docs-829/04-mechanisms/arona-clicker/area-map-navigation.md
- docs/docs-829/03-data-structures/datapack-contracts.md
- docs/docs-829/06-wiki/50-ui/workspace-routing.md
- docs/docs-829/06-wiki/50-ui/refresh-update.md
- ui-style/patterns.md

## Explicit Non-goals
仅本 Unit Goal；其余阶段不在本 Unit 实施。

## Stop Conditions
PROJECT-CONSTITUTION 六条；差异先交任务负责人复核与修订 Unit。

## Completion Criteria
- [x] 将已验证的区域地图机制、路由、局部刷新与视觉复用写入现行文档。

## Verification
check:docs 新链接无错误、diff --check；已有 8 个失效 Operation 路径独立记录。

## Pre-flight
目标与白名单如上；不扩大机制；范围、事实或验证冲突先停止 Unit 并复核。
