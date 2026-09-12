# 06-adr/0001 — 架构整理 T1-T7（装配外移 / 只读 UI / 快照元数据 / 事件目录 / 注册表化 / 表驱动 / 解环）

- **状态**：已完成（2026-08-28 当日全部收官）
- **决策者**：项目维护者 + AI 协作
- **来源**：架构基线评审的增量问题 + 全量依赖梳理（GameInstance / StateMutationService / Registry / 效果三引擎 / 三层状态同步 / UI 依赖方向）

## 背景

- `game-instance.ts` 889 行：构造器装配 28 个子系统 + 内联业务订阅 + 60+ 透传方法；
- 16 个 UI 文件直读 `game.state` 并用 `as never` 强转，纪律 4（只读 UI）被系统性绕过；
- per-Init 字段清单手写 5+ 处，加字段漏同步一处即存档不一致；
- 事件订阅方散落 10+ 文件无集中登记，事件契约不可审计；存在死事件 `conditionGroupMet`；
- Condition/Value/Effect 分发全部硬编码 switch；
- Registry 25 表 × 4 处手工同步，且 `addSpotTag` 运行时改数据包表（违反只读）；
- EffectEngine 靠 3 个反向回调接线服务层；AffectorEngine ↔ GameNumSystem 互持（环形依赖）。

**刻意不动的部分**（解耦反而破坏纪律）：单一写入口集中、Registry 全表 + schema 三向同步、EventBus 单向 emit 反向通道。

## 决策与执行（七项）

| # | 决策 | 关键落点 |
| --- | --- | --- |
| T1 | GameInstance 装配外移 + 门面收敛 | 装配移入 `game/wiring.ts`（`wireGameInstance`）；业务订阅外移 `system/color-unlock-reactor.ts`；新增子门面别名 `game.story/spot/inits/items/enhancements/charaProfiles/pics`；`game-instance.ts` 889→398 行 |
| T2 | UI 只读纪律恢复 | `as never` 15→0；`UIContext.game` 收窄为 `UIFacingGame`（18 个只读成员）；写方法/生命周期/存档移出组件类型面 |
| T3 | 三层状态快照元数据化 | `game/per-init-fields.ts` `PER_INIT_FIELD_SPECS` 17 项单一事实源 + `PER_INIT_KEY_GUARD` 编译期键守卫；`init-savepoint` 120→55 行；顺带修复 `storyReadLogs` 快照缺失 bug |
| T4 | 事件登记表 + Trigger 扩展 + 死事件清理 | `EVENT_CATALOG`（编译期穷尽）；删 `conditionGroupMet`；`TriggerEventDef` 新增 `character`/`cultivated` kind，`ON_KIND_TO_EVENT` 双向锁合 |
| T5 | 分发点注册表化 | `TARGET_EVALUATORS` / `SOURCE_EVALUATORS` / `BINARY_OPS`·`UNARY_OPS` / `DECLARATIVE_EFFECT_OPS` / effect-engine `runtimeForward`；扩展面收敛为「类型联合 + 1 处注册」 |
| T6 | Registry 表驱动 + spotTag 破口处置 | `tableSteps` 单一清单（merge/clear 同遍历）；删 `addSpotTag/removeSpotTag`，运行时标签改落 `state.spotTagOverrides`（global 层）经 `spotTagChanged` 事件；`effectiveSpotTags` 纯查询；Registry 恒只读 |
| T7 | 环形依赖解扣 | 演出 op 事件化（`themeEffectRequested`/`storyEffectRequested`/`chatFlowEffectRequested` → `RuntimeEffectReactor`）；Affector 不再持 GameNum，改纯事件发射（新增 `affectorEntriesChanged`），GameNum 自订阅重同步，依赖收敛为 GameNum → Affector 单向 |

## 后果

- **收益**：新增事件/Trigger kind/条件 target/EffectOp/Registry 表均收敛为「类型联合 + 1 处注册/登记」；装配与业务订阅分离；UI 写路径被类型系统强制阻断；依赖图无环。
- **代价**：`EVENT_CATALOG` / `tableSteps` / 注册表为新成员增加一层间接——由 [[docs/docs-828/04-mechanisms/trigger-effect]] 与模块卡片补偿可读性。
- **验证**：`npx tsc --noEmit` 零错误；`npm test` 926/926 全绿（演出/产出/存档往返全回归）。

## 纪律沉淀

1. 功能迭代不顺手重构——架构债独立分支独立提交；
2. 每完成一项沉淀惯例写回 [[docs/docs-828/05-conventions/refactoring]]；
3. 装配改动对照 `wiring.ts` 段落顺序（回调闭包时序敏感）。

## 相关文档

[[docs/docs-828/01-architecture/run-logic]]（装配流程）· [[docs/docs-828/05-conventions/architecture-discipline]]
