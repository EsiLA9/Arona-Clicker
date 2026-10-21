# Unit task-0310-U16

## Goal
保证直接 Runtime 初始化的地图引用失败不会提交半套内容，补齐作者输入契约。

## Must Read / Read Set
GameInstance.init；runtime.ts 启用集预检；RuntimeAreaInput；Task0310 装载原子性。

## Context Budget
12k tokens；历史 0；超限拆分。

## Optional Read Set
直接调用方，不默认读取。

## Do Not Read by Default
归档与无关目录。

## Confirmed Facts
Runtime 包应用已有临时 Registry 预检；GameInstance.init 在加载最终引用前已重置服务并清空当前 Registry，需要先预检。

## Constraints
Task0310；architecture-discipline；schema-sync。

## Allowed Files
- src/arona-clicker/runtime-game-instance.ts
- src/arona-clicker/contracts/runtime-content.ts
- tests/engine/area-map-runtime.test.ts

## Explicit Non-goals
仅本 Unit Goal；其余阶段不在本 Unit 实施。

## Stop Conditions
PROJECT-CONSTITUTION 六条；差异先交任务负责人复核与修订 Unit。

## Completion Criteria
- [x] 保证直接 Runtime 初始化的地图引用失败不会提交半套内容，补齐作者输入契约。

## Verification
失败后当前地图表/Area/存档不变的真实 init 测试；类型检查。

## Pre-flight
目标与白名单如上；不扩大机制；范围、事实或验证冲突先停止 Unit 并复核。
