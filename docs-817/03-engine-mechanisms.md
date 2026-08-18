# 03 — 引擎机制（Engine Mechanisms）

所有系统在 `GameInstance` 构造函数中组装并接线（`game-instance.ts:132`），UI 与数据包通过公开 API 使用。
剧情流程逻辑在 `game/story-service.ts`、Spot 操作逻辑在 `game/spot-service.ts`（GameInstance 门面委托，见 04-代码地图）。

```
GameInstance
├─ registry          Registry            # 数据包注册表（只读 Map 集合 + 关系索引）
├─ eventBus          EventBus            # 事件总线
├─ mutations         StateMutationService # 唯一状态写入口
├─ valueSystem       ValueSystem         # ValueExpression 求值
├─ conditionSystem   ConditionSystem     # 条件求值（可接 tag/stat/extra 读取器）
├─ funcletExecutor   FuncletExecutor     # Funclet 执行
├─ effectEngine      EffectEngine        # 效果执行（先解析表达式再交给 mutations）
├─ tickSystem        TickSystem          # 帧推进
├─ gameNumSystem     GameNumSystem       # 统一数值注册 + 懒求值（产出主路径）
├─ affectorEngine    AffectorEngine      # 持续效果生命周期
├─ triggerSystem     TriggerSystem       # Trigger DSL 桥接
├─ visibilityEngine  VisibilityEngine    # 可见性快照
├─ lootSystem        LootSystem          # 掉落表
├─ characterSystem   CharacterSystem     # 角色数据/标签加成
├─ spotFunctionalitySystem  SpotFunctionalitySystem  # Spot 内源+外源功能
├─ statsService      StatsService        # 三层统计
└─ devLog            DevLog              # 运行时日志
```

## 1. EventBus（`event-bus.ts`）

- `on(type, handler)` 按类型订阅，返回取消函数；`onAny` 通配。
- `emit` 派发（支持 flushing 时排队）；`flush()` 批量清队列。
- 所有系统用事件解耦：TriggerSystem 用 `onAny` 侦测、AffectorEngine 订阅 item/spotLevel/enhancement 事件、UIController 用事件驱动重绘。

## 2. ValueSystem（`value-system.ts`）

求值 `ValueExpression` → number。`Value.source` 各来源：
- `const` 常量 · `res` 读 state.resources · `spotLevel` 读等级 · `spotCount` 某 Area 已拥有数量（前缀匹配 spotId）·
- `managerCount` 某 Init 已分配的不同 Manager 数 · `data` 读 Extra 三层视图 · `funclet` 调用命名公式（参数注入 flags 求值）。

## 3. ConditionSystem（`condition-system.ts`）

`evaluate(Condition)` / `evaluateGroup(ConditionGroup)` / `evaluateExpr(原子或组)`。
通过 setter 注入外部读取器：`setTagIndex`（registry.spotsWithTag）、`setStatReader`（StatsService.evaluate DSL）、
`setStoryRunChecker`、`setExtraReader`（GameInstance.getExtra）。求值全是纯函数（读 state）。

## 4. StateMutationService（`state-mutation-service.ts`）

所有 PlayerState 写入的唯一入口。方法：`changeResource` `setResource` `setSpotLevel` `addSpotLevel`
`setManager` `addEnhancement` `removeEnhancement` `addItem` `removeItem` `unlockInit` `setFlag`
`completeStory` `setStoryCooldown` `setExtra` `addExtra` `removeExtra` `applyEffect(s)`。
每个方法走固定管道：**写状态 → 同步统计 → emit 事件（带 stats 上下文）**。
资源路由：全局资源写 `globalResources`，其余写 `resources`。

## 5. GameNumSystem（`game-num.ts`）— 产出主路径

每个资源一棵 **primitiveGain 树**（`add` 根），构建时展开到最末端叶子：

```
primitiveGain:credit (add)
├── spot:credit_printer (mul)
│   ├── owned (叶子：等级>0 → 1)
│   ├── baseLine (add: base + levelLinear)
│   ├── managerBonus (叶子)
│   ├── tagMultiplier (叶子：角色标签加成累乘)
│   └── enhancementMultiplier (叶子：Enhancement 倍率累乘)
└── affectors:credit (叶子：所有活跃 Affector 的 addResource 之和)
```

- `buildAll()` 数据加载后构建一次；**求值全懒**（不缓存，每 tick 按当前 state 递归求值）。
- 每 tick：`evaluateResourceGain(resource, state)` → `mutations.changeResource` → emit `spotProduced`。
- 单 Spot 最终产出查询：`evaluateSpotYield(spotId)`（UI 实时显示用）。

## 6. TickSystem（`tick-system.ts`）

`TICK_INTERVAL_MS = 1000`。`tick()`：帧号+1 → GameNum 统一结算（有 gameNumSystem 时）→ emit `tick`。
旧路径（无 GameNum，仅测试用）：逐 Spot 计算 baseYield + managerBonus + tag 倍率 + enhancement 倍率，按 `baseCapacity` 封顶。

## 7. EffectEngine（`effect-engine.ts`）

`applyEffects(effects)`：先把 value 为 ValueExpression 的效果**按当前状态求值为数字**，再交给 `mutations.applyEffects`。
`loot` / `triggerStory` 两种 op 在状态层被忽略（由上层系统处理：`GameInstance.rollDropTable`、story 启动）。

## 8. AffectorEngine（`affector-engine.ts`）— 持续效果

- **生命周期**：`mount(packId, entityId)` → 实例 `Latent`；条件满足 → `Active`；卸载 → `Removed`。
- **挂载源**：物品（item.affectorPackIds）、强化（enh.affectorPackIds）、Spot 功能（linearYield 动态构造 pack）。
- **每 tick**：`applyActiveEffects()` 全量 `recheck` → 对 Active 实例执行**非 addResource** 效果
  （addResource 合流进 GameNum 的 affectorFlows 叶子；maxLevel 效果只做覆盖表查询）。
- **等级上限覆盖**：`getSpotMaxLevelOverrides()` → `{lifted, maxLevels}`，优先级 `removeSpotMaxLevel > 多个 setSpotMaxLevel 取最高 > SpotDef.maxLevel`。
- 事件订阅：itemCollected / spotLevelChanged / enhancementAdded / enhancementRemoved / spotTagChanged → 自动挂载/卸载/重估。

## 9. TriggerSystem（`trigger-system.ts`）— 事件→条件→执行 DSL

- 数据包侧只暴露 `TriggerDef`（`on` 事件模式 + `condition` + `effects` + `once`）。
- 内部 `eventBus.onAny` → `matchesEvent(on, event)`（tick 支持 `every` 帧间隔）→ 条件求值 → `fire`。
- `once` 先落账再执行（防级联重复触发），完成记录持久化进 `state.triggersCompleted`。
- 分组：`mount(def, group)` / `unmountGroup(group)`，世界线专属 Trigger 以 `init:<id>` 分组进出时挂/卸。

## 10. 揭示系统：Reveal + VisibilityEngine

- `reveal.ts` 纯函数：`existenceMet` / `unlockMet` / `existenceCondition` / `unlockCondition` 等。
  **规则：无某目标的 Trigger = 该级默认可见；多个 Trigger = 任一满足即揭示（OR）。**
- `visibility-engine.ts`：`compute(state)` 一次性算出全部实体可见性快照（inits/areas/spots/enhancements/items/stories）；
  `isAreaVisible` 等单点查询供移动规则使用。
- UI 揭示阶段（partial/known/utility）在 `src/ui/components/tooltip.ts` 的 `getXxxReveal` 中计算（读 state 推断，纯展示）。

## 11. StatsService（`stats.ts`）— 三层统计

- 三层：`global`（贯穿所有世界线）/ `init[id]`（各世界线，含 framesInInit）/ `session`（本次游玩）。
- 记录点全部在 StateMutationService 的同步钩子里（原子）。
- **统计查询 DSL**（`stat-dsl.ts`）：受限函数库，如 `$GlobalProducedAmount base:resource:credit`、
  `$InitCompletedStories base:init:schale_office`。供条件 `stat` target 引用。

## 12. LootSystem（`loot-system.ts`）

`rollTable(tableId)`：条件过滤 → guaranteed 保底 → maxRolls 次加权抽选（min~max 随机数量）。

## 13. CharacterSystem（`character-system.ts`）

角色数据 + `spotTagBonus`（角色对 Spot 标签的倍率，层级匹配）+ `characterBonuses`（spot→角色→倍率表）。
解锁判定：被分配到 Spot 或 flag `char_unlock_<id>`。
`getUnlocked` / `getAssignable` 供 UI 分配 Manager。

## 14. SpotFunctionalitySystem（`spot-functionality.ts`）

Spot 功能 = 内源（`spot.functionalities`）+ 外源（Enhancement `addsFunctionalities` 按 tag 注入）。
`linearYield`（每级额外产出，走 Affector 挂载）· `restartInit` / `hardResetInit`（UI 提供操作入口）。

## 15. Extra 系统（`extra.ts`）

构造 / 路径读写 / 深合并 / 扁平键展开 / 校验 / 宽松读取（toNumber/toString/toBool）。
三层合并视图读取器接线在 GameInstance 构造器（value/condition/mutations 各设 reader）。

## 16. DevLog（`dev-log.ts`）

运行时追踪日志，`record(message, {level,source,details,frame})` + 事件自动转日志 +
`recordTick` 汇总（非 verbose 每 30 帧一条）+ `export()` 导出 JSON 排障。

## 17. Registry（`registry.ts`）

- 主存储：inits/areas/spots/enhancements/stories/items/dropTables/funcletDefs/characters/characterBonuses/resourceDisplays/extras。
- 关系索引：`areasOfInit` / `spotsOfArea` / `spotsOfInit` / `spotsWithTag`（层级标签前缀索引，父含子）。
- `load()` = validate + merge；运行时 `addSpotTag` / `removeSpotTag` 同步更新索引。
- 校验项：ID 唯一、引用完整（area→init、spot→area、defaultAreas/defaultSpots）、Extra 合法。
