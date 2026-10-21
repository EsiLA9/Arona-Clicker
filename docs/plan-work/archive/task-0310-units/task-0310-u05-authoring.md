# Unit task-0310-U05

## Goal
保留 Area 编辑导航入口并验证引用，补作者图鉴确定引用。

## Must Read / Read Set
content-policies.ts；content-policy.ts buildAuthoringDef；registry.ts validateAreaCandidate；runtime-content-reference-rules；Area 编辑 state.ts 的 spread 编解码。

## Context Budget
12k tokens；历史 0；超限拆分。

## Optional Read Set
直接调用方，不默认读取。

## Do Not Read by Default
归档与无关目录。

## Confirmed Facts
Area 作者策略显式列字段；buildAuthoringDef 只输出登记字段；现有 UI Area 编解码以 spread 保留字段；图鉴从 Registry getter 发现表。

## Constraints
Task0310；architecture-discipline；schema-sync。

## Allowed Files
- src/data-services/authoring/content-policies.ts
- src/data-services/registry/registry.ts
- src/data-services/registry/runtime-content-reference-rules.ts
- tests/data/area-map-authoring.test.ts

## Explicit Non-goals
仅本 Unit Goal；其余阶段不在本 Unit 实施。

## Stop Conditions
PROJECT-CONSTITUTION 六条；差异先交任务负责人复核与修订 Unit。

## Completion Criteria
- [x] 保留 Area 编辑导航入口并验证引用，补作者图鉴确定引用。

## Verification
新作者投影与局部 mutation 测试；现有 World policy 与引用规则回归。

## Pre-flight
目标与白名单如上；不扩大机制；范围、事实或验证冲突先停止 Unit 并复核。
