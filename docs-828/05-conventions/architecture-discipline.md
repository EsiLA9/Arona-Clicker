# 05-conventions/architecture-discipline — 架构纪律（不可破坏）

> 本文是 7 条架构纪律的权威定义与代码落点。任何改动违反任一条都视为破坏架构。

| # | 纪律 | 代码落点 / 守护机制 |
| --- | --- | --- |
| 1 | **单一写入口**：所有状态变更走 `StateMutationService`，禁止直接改 PlayerState | 写方法内联「改值→记统计→发事件」（[[docs-828/04-algorithms/state-mutation]]）；绕过会导致 GameNum 陈旧读与统计错漏 |
| 2 | **事件驱动**：新增联动逻辑优先做成 Trigger/Affector，不要塞进 GameInstance 方法体 | `EVENT_CATALOG` 登记所有事件（[[docs-828/04-algorithms/trigger-effect]]）；联动闭环示例：`ColorUnlockReactor` |
| 3 | **数据包声明式**：新机制优先设计成 Datapack 字段（Schema 协议同步），而非硬编码 | `src/engine/def-factory/` 26 个 builder + `npm run gen:schema`（[[docs-828/05-conventions/schema-sync]]） |
| 4 | **只读 UI**：UI 只消费 `getView()` / `createUIContext()`，不持有写引用 | 组件层类型面收窄为 `UIFacingGame`（18 个只读成员，无 `as never`）；controller 层才持完整 `GameInstance`（[[docs-828/02-modules/ui]]） |
| 5 | **三层状态**：新增「跨世界线保留」数据时想清楚放 global / per-Init 快照 / per-Init 当前 哪一层 | `PER_INIT_FIELD_SPECS` + 编译期键守卫（[[docs-828/01-architecture/state-layers]]）；角色域逐块声明 `characterPersistConfig` |
| 6 | **测试先行**：机制改动必须带 vitest 测试（`npm test` 通过才算完成） | `tests/engine/` 镜像 `src/engine/`（[[docs-828/05-conventions/testing]]） |
| 7 | **不做存档迁移**：PlayerState / Datapack 结构可随时破坏性变更，禁止编写任何存档迁移/版本兼容代码；旧存档失效直接清档重来 | 改状态结构时同步更新相关测试与文档即可；新字段一律标 `?:` 可选兼容分阶段构建 |

## 违反检测速查

- **纪律 1 违反**：`state.xxx =` 出现在 `StateMutationService` / `init-savepoint` 之外 → grep 审查；
- **纪律 2 违反**：`GameInstance` 方法体内出现跨系统联动（应改为发事件 + 订事件）；
- **纪律 3 违反**：行为差异硬编码在引擎、数据包无字段可表达；
- **纪律 4 违反**：`src/ui/components/` 内出现 `game.state.` 写引用或 `as never`；
- **纪律 5 违反**：`PER_INIT_KEY_GUARD` 编译报错（SPECS 与 InitSnapshot 键集不一致）。

## 相关文档

[[docs-828/01-architecture/overview]] · [[docs-828/06-adr/0001-architecture-consolidation]]（纪律的最近一次系统性加固）
