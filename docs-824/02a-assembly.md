# docs-824 — 02a 构造器：子系统装配顺序

> 原文出处：`02-run-logic.md` 二章。`GameInstance` 构造器是有向依赖装配：**先建最底层、被依赖的子系统，再建上层门面服务**。顺序即依赖顺序，见 `[[src/engine/game-instance.ts]]`。

| 顺序  | 子系统                                                                                                                                 | 为什么先建                                                                                                                                     |
| --- | ----------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `EventBus` / `Registry` / `ValueSystem` / `ConditionSystem` / `FuncletExecutor`                                                     | 事件、注册表、表达式求值是最底层被依赖项                                                                                                                      |
| 2   | `StatsService` + `StateMutationService`                                                                                             | **stats 与 mutations 先建**：所有下层系统共用同一带统计的写入口，保证统计同步记录（`game-instance.ts:143-146`）；先给 conditionSystem 接 `setStatReader`/`setStoryRunChecker` |
| 3   | `SpotFunctionalitySystem` + `EffectEngine`                                                                                          | EffectEngine 依赖 mutations/valueSystem；`setTheme`/`triggerStory` 处理器在 Character 域建好后接线（`game-instance.ts:167-174`）                         |
| 4   | Character 域：`CharacterSystem` / `RosterSystem` / `AvailabilityService` / `ColorSystem`                                              | 用 registry 解析原型、曲线、色彩；ColorSystem 供 theme effect 用                                                                                        |
| 5   | `GachaService`                                                                                                                      | 依赖 availability（可抽列表 drawableOf）与 initService（资源）                                                                                         |
| 6   | `mutations.setCharacterCatalog`                                                                                                     | 给写入口接原型/曲线/色彩解析器（差分目录接线，`game-instance.ts:184-188`）                                                                                       |
| 7   | `AffectorEngine`                                                                                                                    | 持续效果宿主，依赖 conditionSystem/mutations/effectEngine/spotFunctionality                                                                        |
| 8   | `GameNumSystem`                                                                                                                     | 统一数值，依赖 valueSystem/registry/characterSystem/affectorEngine/eventBus                                                                      |
| 9   | `TickSystem` / `TriggerSystem` / `LootSystem` / `VisibilityEngine` / `TagStatService`                                               | 各自注册到 conditionSystem 的读取器（tagIndex/tagCount/storyChain）                                                                                  |
| 10  | `PassivePoolSystem` + 门面服务：`StoryService` / `SpotService` / `InitService` / `SessionService` / `ItemService` / `EnhancementService` | 依赖上面全部核心系统；StoryService 需要 passivePools 与 travelToArea                                                                                    |
| 11  | 装配完成 → `createDefaultState()` + `setState` 同步各子系统                                                                                   | 让所有系统拿到初始状态引用（`game-instance.ts:315-319`）                                                                                                 |

## 构造器收尾

- 创建默认状态并同步给各子系统（`game-instance.ts:315-319`）；
- 挂全局事件日志（`eventBus.onAny` → devLog，`game-instance.ts:322`）；
- 事件联动：`characterAcquired` / `flagChanged` → 重算色彩解锁（`game-instance.ts:328-333`）。

## 关键接线（为什么能「事件驱动」）

| 接线 | 作用 |
| --- | --- |
| `mutations` 持有 `eventBus` + `statsService` | 写状态即发事件、即计统计 |
| `valueSystem/conditionSystem/mutations.setExtraReader(...)` | Extra 三层合并视图统一读取入口 |
| `conditionSystem.setTagIndex / setTagCountReader / setStoryRunChecker / setStoryChainChecker` | 条件可查 tag 反向索引、tag 收集数、本次运行完成、跳转链访问 |
| `effectEngine.themeEffectHandler` | `setTheme` effect → ColorSystem 运行时层 |
| `effectEngine.storyStarter` | `triggerStory` effect → StoryService.startStory（force 抢占被动闲聊） |

---

上一篇：[[docs-824/02-run-logic]] · 下一篇：[[docs-824/02b-init-sequence]]
