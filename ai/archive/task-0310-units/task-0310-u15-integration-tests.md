# Unit task-0310-U15

## Goal
用真实数据包与 Controller 鼠标操作验证浏览、移动、门控、失效与 DOM 连续性。

## Must Read / Read Set
演示 JSON/FolderPackSource；Controller/地图 adapter；Story 启动；既有 workspace-lifecycle 测试。

## Context Budget
12k tokens；历史 0；超限拆分。

## Optional Read Set
直接调用方，不默认读取。

## Do Not Read by Default
归档与无关目录。

## Confirmed Facts
U13 源码类型与架构通过；示例 b 首访触发原 Story effect，可验证成功移动后的故事与通知顺序。

## Constraints
Task0310；architecture-discipline；schema-sync。

## Allowed Files
- tests/ui/area-map-controller.test.ts
- tests/data/area-map-demo.test.ts

## Explicit Non-goals
仅本 Unit Goal；其余阶段不在本 Unit 实施。

## Stop Conditions
PROJECT-CONSTITUTION 六条；差异先交任务负责人复核与修订 Unit。

## Completion Criteria
- [x] 用真实数据包与 Controller 鼠标操作验证浏览、移动、门控、失效与 DOM 连续性。

## Verification
本 Unit 测试；发现问题停止本 Unit，负责人在原实现 Unit 白名单内修复并回归。

## Pre-flight
目标与白名单如上；不扩大机制；范围、事实或验证冲突先停止 Unit 并复核。
