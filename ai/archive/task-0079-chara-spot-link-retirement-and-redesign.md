# Task：Manager 旧语义与 Chara—Spot 旧链接删除

状态：active — 🟡 删除范围已裁定，等待施工

## 目标

盘点并删除所有属于旧 `manager` 语义的角色—Spot 链接及其兼容结构。当前不设计新的 Chara—Spot 关系，不新增替代机制，只将已弃用内容从代码、Schema、状态、事件、UI 编辑入口和测试中清理掉。

## 结论摘要

- `spotManagers` / `manager` / `setManager` / `managerCount` 是旧的 Chara—Spot 轴，当前不应继续进入新编辑器设计。
- 旧轴目前没有生产加成消费者；生产系统只保留失效重建与门控兼容路径。
- 当前有效的“Spot → 角色服务”主要是 Gacha 入口和部分升级效果，不等同于角色驻扎、派遣或角色对 Spot 的持续作用。
- `CharacterVariantDef` 当前没有 Spot 引用字段，SpotDef 也没有角色关联字段；新的 Chara—Spot 关系不在本 Task 范围内。
- `owner`、`student` 主题作用域、角色好感、角色标签等是角色域或表现层关系，不应被误归入 Chara—Spot 关系。

## 一、应退役的 Manager 旧轴

| 层级 | 当前链接 | 代码 / 文档落点 | 处理建议 |
| --- | --- | --- | --- |
| 状态 | `PlayerState.spotManagers`、`InitSnapshot.spotManagers` | `src/arona-clicker/types/state.ts`、`src/arona-clicker/state/state-factory.ts`、`src/arona-clicker/state/per-init-fields.ts` | 先冻结新写入，后续决定是否移除状态字段 |
| 读模型 | `GameView.spotManagers` | `src/arona-clicker/read-model/game-view-builder.ts`、`src/arona-clicker/contracts/view.ts` | 退役后从 View 契约删除 |
| 写入口 | `StateMutationService.setManager` | `src/arona-clicker/state/state-mutation-service.ts`、`src/arona-clicker/contracts/mutation.ts`、`src/arona-clicker/contracts/effect-mutation.ts` | 删除或改为明确的 deprecated no-op，最终移除 |
| Effect | `EffectOp = setManager` | `src/engine/types/expression.ts`、`src/arona-clicker/state/effect-ops.ts`、`src/engine/effect/affector-text.ts` | 禁止新数据包使用；移除 Schema 与编码支持时同步改测试 |
| Condition | `ConditionTarget = manager` | `src/engine/types/expression.ts`、`src/engine/expression/condition-system.ts`、`src/data-services/authoring/content-policy-dsl.ts` | 从新 RuntimeEditor 目标列表移除；待退役后移除引擎语义 |
| Value | `ValueSource = managerCount` | `src/engine/contracts/expression.ts`、`src/engine/expression/value-system.ts` | 独立评估是否删除；不应被新 Chara—Spot 设计复用 |
| 事件 | `managerChanged` | `src/engine/types/events.ts`、`src/arona-clicker/contracts/event-catalog.ts`、`src/engine/expression/condition-deps.ts` | 退役写入口后删除事件及订阅 |
| 生产 | Manager 变化触发全树失效 | `src/engine/expression/game-num.ts`、`docs/docs-828/04-mechanisms/production.md` | 旧轴移除后删除该失效分支；保留其他实际生产依赖 |
| 生命周期清理 | Spot 删除 / Init 切换时清理 Manager | `src/arona-clicker/runtime.ts`、`src/arona-clicker/services/init-service.ts` | 随状态字段退役删除清理分支 |
| 测试 | Manager 无生产加成、旧协议冻结等测试 | `tests/engine/tick-system.test.ts`、`tests/engine/game-num.test.ts`、`tests/engine/character-system.test.ts`、`tests/engine/tag-stats.test.ts` | 改为退役验收测试，最终删除旧行为测试 |

### Manager 当前事实

- `manager` 条件只检查某个 Spot 是否存在非 `none` 的指派值。
- `managerCount` 只统计不同 Manager 值的数量。
- `setManager` 只写入状态并发出 `managerChanged`。
- 生产结算没有 Manager 加成；现有生产失效只是历史兼容路径。
- 当前 UI 没有独立的角色驻扎 / Manager 分配服务；新 RuntimeEditor 不应继续提供 Manager 条件配置。

## 二、应保留的间接 Spot—角色服务

这些链接不是旧 Manager 归属关系，应继续按各自机制维护，不在本 Task 中改造：

| 服务 | 关系 | 主要落点 | 后续任务 |
| --- | --- | --- | --- |
| Gacha Spot 入口 | Spot 的 `gacha` 功能打开卡池并产出 CharacterVariant | `SpotFunctionalityDef.kind = gacha`、`GachaService`、`CharacterAvailabilityService`、`RosterSystem` | 保留；只完善卡池候选、入口展示与角色获得闭环 |
| Spot 升级 / 效果获得角色 | Spot 的升级效果可以触发 `grantCharacter`，但不是角色驻扎 | `SpotLevelUpgradeDef.effects`、`EffectOp.grantCharacter`、`StateMutationService` | 保留；明确“奖励来源”与“角色作用于 Spot”两种方向 |
| Spot / Enhancement 标签与角色统计 | TagStatService 可统计角色和 Spot 两个域，条件可引用标签统计 | `TagStatService`、`tagCount`、`hasTag`、`countTags` | 保留；后续统一 Tag 域选择器，不建立隐式角色—设施关系 |
| 角色主题作用域 | 主题可作用于 `student` / Variant，也可作用于 Area / Spot 相关界面 | `ThemeEffectValue.scope`、`entityKey`、`ColorSystem` | 保留为表现层关系，不纳入 Chara—Spot 机制 |
| Story owner / 角色聊天空间 | Story / PassivePool 可按 Variant owner 隔离聊天空间 | `StoryEntry.owner`、`PassivePoolDef.owner`、`StoryService` | 保留为剧情关系，不与 Spot 归属混用 |

## 三、施工任务列表

### P0：冻结新入口

- [ ] 从 RuntimeEditor 原子条件目标列表移除 `manager`，不再为其设计专用输入控件。
- [ ] 在任务文档和设计约束中标记 Manager 为 deprecated，不把它当作 Chara—Spot 新方案。
- [ ] 检查 RuntimeEditor / Datapack authoring 是否仍能新建 `setManager` 或 `manager` 条件；决定是隐藏、警告还是拒绝。
- [ ] 为旧字段保留明确的未知 / 退役提示，避免静默改变既有 Draft 语义。

### P1：清理旧轴的非破坏性兼容面

- [ ] 统计 `spotManagers` 的所有读写与快照边界。
- [ ] 移除生产系统中仅为 Manager 服务的失效路径。
- [ ] 移除 `managerChanged` 的无消费者订阅。
- [ ] 移除 `managerCount`，或形成独立裁定说明其不属于 Chara—Spot。
- [ ] 更新 / 删除旧 Manager 测试，确保没有新的生产加成语义回归。

### P2：清理状态与 Effect 契约

- [ ] 从 Mutation / Effect / Engine 类型中移除 `setManager`。
- [ ] 从 PlayerState / InitSnapshot / GameView 中移除 `spotManagers`。
- [ ] 删除 Init 切换、Spot 删除和运行时恢复中的 Manager 清理代码。
- [ ] 按 Schema 同步协议重新生成编辑器 Schema。
- [ ] 不编写存档迁移；旧存档按项目纪律失效。

## 设计禁区

- 不把 `manager` 改名后继续作为新机制。
- 不用 `spotManagers` 偷渡角色驻扎、生产加成或角色关系数据。
- 不把 Gacha 入口、Story owner、学生主题作用域误合并成同一关系表。
- 本 Task 不新增 Character ↔ Spot 双向字段，也不规划替代关系。

## 当前核验（2026-09-16）

- 已完成全仓 `manager`、`spotManagers`、`managerCount`、`setManager`、`managerChanged` 检索。
- 当前事实与 `docs/docs-828/01-architecture/design-constraints.md` 一致：本轮不设计 Chara—Spot，Manager 只做门控，不承载生产加成。
- 当前没有发现 `CharacterVariantDef` → `SpotDef` 或 `SpotDef` → `CharacterVariantDef` 的直接关系字段。
- 当前任务只完成盘点与删除范围拆分，P0 尚未施工。

## 相关路由

[[task-0078-runtime-editor-condition-target-editors]]
[[docs/docs-828/01-architecture/design-constraints]]
[[docs/docs-828/03-data-structures/player-state]]
[[docs/docs-828/03-data-structures/declarative-dsl]]
[[docs/docs-828/04-mechanisms/production]]
[[docs/docs-828/04-mechanisms/roster]]
