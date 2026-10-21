# Unit task-0310-U18

## Goal
修复故事结束与入口 Reveal 变化后的 Hero/地图按钮原位准入刷新。

## Must Read / Read Set
浏览器 arrival 完成步骤；Controller refreshLight/refreshReveal；rail Hero/Map 入口；共享前台 gate。

## Context Budget
12k tokens；历史 0；超限拆分。

## Optional Read Set
直接调用方，不默认读取。

## Do Not Read by Default
归档与无关目录。

## Confirmed Facts
真实浏览器中 Story 已完成且区域邻接恢复，但 Hero/Map 按钮仍保留旧 disabled；此前 manager.refresh 在无 session 时直接返回。

## Constraints
Task0310；architecture-discipline；schema-sync。

## Allowed Files
- src/ui/workspace/area-map-controller.ts
- src/ui/components/rail.ts
- tests/ui/area-map-controller.test.ts

## Explicit Non-goals
仅本 Unit Goal；其余阶段不在本 Unit 实施。

## Stop Conditions
PROJECT-CONSTITUTION 六条；差异先交任务负责人复核与修订 Unit。

## Completion Criteria
- [x] 修复故事结束与入口 Reveal 变化后的 Hero/地图按钮原位准入刷新。

## Verification
回归验证故事开始/结束只补 disabled 属性，保留入口身份；Map入口关联变化局部增删；真实浏览器重验。

## Pre-flight
目标与白名单如上；不扩大机制；范围、事实或验证冲突先停止 Unit 并复核。
