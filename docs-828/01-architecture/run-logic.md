# 01-architecture/run-logic — 运行逻辑与时序

> 本文回答：**程序从启动到运行的主干时序——子系统如何装配、初始化做什么、每帧发生什么、业务操作与存档怎么走。**
> 装配代码在 `src/arona-clicker/runtime-wiring.ts`；运行时门面在 `src/arona-clicker/runtime-game-instance.ts`，状态初始化在 `src/arona-clicker/state/state-factory.ts`，视图组装在 `src/arona-clicker/read-model/game-view-builder.ts`，由 AronaClicker Runtime 负责组合产品领域服务与基础引擎机制。

## 总体调用链

```text
src/ui/main.ts（Vite UI 启动）
  └─ createAppRuntime()            AronaClicker Runtime 装配全部子系统（依赖顺序 + 事件接线）
       └─ init(datapacks)          加载数据包 → 校验 → 建索引 → 建产出树 → 进入默认 Init
            └─ start()             启动会话循环（1 tick/秒）
                 └─ tick()         每帧：生产结算 → Affector → 剧情 → 阻断复检 → 统计
                      │
                      ├─ getView()            UI 只读拉取快照
                      ├─ save() / load()      存档导出 / 恢复
                      ├─ travelToArea()       区域移动（可达性门槛链）
                      └─ ...                  各业务门面（升级/招募/培养/剧情…）
```

## 一、构造装配（依赖顺序）

构造器只剩 `new` + `wireGameInstance(g, hooks, options)` 调用；装配顺序即依赖顺序（先建被依赖的底层，再建上层门面）：

| 顺序 | 子系统 | 为什么先建 |
| --- | --- | --- |
| 1 | `EventBus` / `Registry` / `ValueSystem` / `ConditionSystem` / `FuncletExecutor` | 事件、注册表、表达式求值是最底层被依赖项 |
| 2 | `StatsService` + `StateMutationService` | 所有下层系统共用同一带统计的写入口；先给 conditionSystem 接 stat 读取器 |
| 3 | `SpotFunctionalitySystem` + `EffectEngine` | EffectEngine 依赖 mutations/valueSystem |
| 4 | Character 域：`CharacterSystem` / `RosterSystem` / `AvailabilityService` / `ColorSystem` / `ColorEquipmentSystem` | 用 registry 解析原型、曲线、色彩 |
| 5 | `GachaService` | 依赖 availability 与 initService（资源） |
| 6 | `mutations.setCharacterCatalog` | 给写入口接原型/曲线/色彩解析器 |
| 7 | `AffectorEngine` | 持续效果宿主，依赖 conditionSystem/mutations/effectEngine/spotFunctionality |
| 8 | `GameNumSystem` | 统一数值；**构造期自订阅 affector 事件**做区表重同步（T7 后单向依赖） |
| 9 | `TickSystem` / `TriggerSystem` / `LootSystem` / `VisibilityEngine` / `TagStatService` | 各自注册到 conditionSystem 的读取器 |
| 10 | `PassivePoolSystem` + 门面服务：`Story` / `Spot` / `Init` / `Session` / `Item` / `Enhancement` / `CharaProfile` / `Pic` | 依赖上面全部核心系统 |
| 11 | 收尾：`createDefaultState()` + `setState` 同步各子系统 | 让所有系统拿到初始状态引用 |

### 关键接线（为什么能「事件驱动」）

| 接线 | 作用 |
| --- | --- |
| `mutations` 持有 `eventBus` + `statsService` | 写状态即发事件、即计统计 |
| `setExtraReader` | Extra 三层合并视图统一读取入口（注入 value/condition/mutations） |
| `ColorUnlockReactor` | `characterAcquired` / `flagChanged` → 重算色彩/装备/设计解锁（位于 `arona-clicker/services/color-unlock-reactor.ts`） |
| `RuntimeEffectReactor` | AronaClicker 服务层消费演出类 effect 请求事件（`themeEffectRequested` / `storyEffectRequested` / `chatFlowEffectRequested`），编排 ColorSystem / StoryService / ChatFlowService |

## 二、初始化：init(datapacks) / reload

```text
init(datapacks)
 1. 组装 Registry：全部 Datapack → 表 + 关系索引 + 名称解析（表驱动 merge）
 2. 建产出树：gameNumSystem.buildAll()（四级层级树，见 [[docs-828/04-mechanisms/production]]）
 3. 进入默认世界线：解锁 + 建 per-init 状态 + 挂载专属 Trigger（mountInitTriggers）+ 发 `initEntered`
 4. affectorEngine.reconcileMounts()：按初始状态对账挂载物品/强化/功能的 Affector 实例
```

- 新建状态：`createDefaultState()`（`arona-clicker/state/state-factory.ts`），per-Init 字段统一由 `arona-clicker/state/per-init-fields.ts` 的 `PER_INIT_FIELD_SPECS` 单一事实源管理（T3）。
- 读档：`load(data)` 校验 version（不符抛错，**不做存档迁移**）→ 替换 `state` → `syncSubsystems()` → `rebuildRuntime()`（visibility 重算 + tag 索引重建 + runId 恢复）。

## 三、运行循环：start / tick

```text
start() → SessionService.start() → 离线收益补算（最多 8 小时）→ setInterval(doTick, 1000)
```

```text
tick()
 ├─ 1. tickSystem.run()            生产结算：逐 Resource 走 GameNum primitiveGain 树（唯一路径）
 ├─ 2. affectorEngine.applyActiveEffects()
 │       ├─ 先重估轮询实例（stat 宽依赖）
 │       └─ 执行 Active 实例的 perTickEffects（effects 仅激活沿执行一次，不在每帧路径）
 ├─ 3. recheckStudentBlocks()      阻断复检（纯只读判定 + 发事件，不改状态）
 ├─ 4. statsService.recordTick()   帧统计累计
 ├─ 5. devLog.recordTick()         记录本帧生产结果
 └─ 6. TickSystem 发出 `tick`，SessionService 随后 flush EventBus
```

- **失效策略（事件驱动）**：tick 不再每帧失效产出树——状态变更经 `StateMutationService` 发事件定向失效（`resourceChanged` 三路定向）；未受影响子树跨帧保持缓存。绕过写入口直改 state 会得到陈旧读数。详见 [[docs-828/04-mechanisms/production]]。
- **时机约定**：帧先产出、后算持续效果（Affector 影响的是下一帧可观察结果）；阻断复检在帧尾且只读。剧情推进不在 Runtime 的 tick 主循环中独立调用。

## 四、业务门面操作与 UI 只读消费

| 操作 | 入口 | 前置门槛 | 写状态 |
| --- | --- | --- | --- |
| 升级 Spot | `upgradeSpot` | `canUpgradeSpot`（花费 + 等级上限 + 条件） | setSpotLevel + 扣费 |
| 购买 Spot | `purchaseSpot` | reveal 到 `purchaseable` | 解锁 + 扣费 |
| 招募 | `gachaService.roll` | 卡池 drawable + 货币足够 | 变体/碎片/货币 |
| 培养 | `cultivateSystem.applyExp` | 曲线 + 突破判定 | exp/star |
| 剧情 | `storyService.*` | reveal 门槛 + triggerCondition | storyLog + 奖励 |

- 门面做**只读判定**（canXxx）与**顺序编排**；真正改状态只经 `StateMutationService`（写方法内：改值 → 记统计 → 发事件）。
- UI（`src/ui/controller.ts`）只调用 `getView()` / `createUIContext()`；组件类型面为 AronaClicker `GameReadModel`，写方法不可触达。

## 五、存档 / 读档 / 重置

```text
save() → 深拷贝 state → AronaClicker SaveData（version + PlayerState + stats + chatHistories）→ 泛型 SaveSystem
         聊天历史由 UI 层 withHistories 注入（不污染引擎状态）
load() → 校验 version → 替换 state → syncSubsystems → rebuildRuntime → UI restoreHistories
```

| 重置路径 | 触发 | 保留 | 清空 |
| --- | --- | --- | --- |
| `restartInit`（保存式） | 软重启 | Global + 当前 Init 快照 | 当前 per-init 运行时 |
| `resetInitProgress`（不保存） | 硬重启（有确认） | Global | 当前 Init 全部（含快照） |
| `travelToInit` | 世界线切换 | 各 Init 快照 | — |
| `reset()` + 删存档 | 彻底重置 | 无 | 全部 |

三条路径都会回到世界线选择页（`resetSessionPanel`）。

---

下一步读 [[docs-828/01-architecture/state-layers]]（运行时持有的 PlayerState 长什么样）。
