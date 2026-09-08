# 04-mechanisms/trigger-effect — 事件联动：Trigger / Effect / Affector / Reveal

> 本文回答：**事件如何驱动联动。** 事件驱动是「机制优先做成 Trigger/Affector」纪律的落点；模块卡片见 [[docs/docs-828/02-modules/effect-trigger]] / [[docs/docs-828/02-modules/affector]]。

## Trigger（一次性/持续性条件触发）

- `TriggerDef`：{ id?, on, condition?, effects[], once?, extra? }；`on` 的 `TriggerEventDef.kind`（9 种）与 `Condition`/`Effect` 全枚举见 [[docs/docs-828/03-data-structures/declarative-dsl]] §3-5；
- kind 全集与 `TriggerSystem.ON_KIND_TO_EVENT` 双向锁合（新增侦测面 = 类型联合 + 映射表各 1 处）；
- 运行时订阅事件 → 条件满足（`evaluateGroup`）→ 执行 `effects`（经 [[docs/docs-828/04-mechanisms/state-mutation]]）；
- 触发状态（once 完成）持久化在 PlayerState（`triggerState`），匿名 Trigger 按派生 `anon:` id 持久。

## Effect（op 分发）

- `EffectOp` 25 种分发见 [[docs/docs-828/03-data-structures/declarative-dsl]] §4；
- 转发类演出 op **不落状态、经请求事件转发**（effect-engine 发、`RuntimeEffectReactor` 订）：`setTheme` → `themeEffectRequested`（ColorSystem 临时主题层）；`triggerStory` → `storyEffectRequested`（StoryService.startStory force）；聊天流族 5 种 → `chatFlowEffectRequested`（ChatFlowService）；
- `loot` 当前为 no-op 预留（effect-ops 中既不落状态也不转发，未接线）。

## Affector（挂载持续效果）

- `AffectorPackDef`：{ entries: [{ condition, effects[], perTickEffects?[], flows[], zoneModifiers[] }] }；
- entry 的效果分四条通道：
  - `effects`：**激活沿（Latent→Active 翻转）一次性执行**——`addResource` 一次性发放，setFlag/addItem 等一次性 op 同样只执行一次；声明类 op（setSpotMaxLevel/removeSpotMaxLevel）由 `getSpotMaxLevelOverrides` 动态读取，不经执行；
  - `perTickEffects`：Active 期间每帧执行（仅限幂等/维持类 op）；
  - `flows`：**唯一持续产出通道**，激活期间每帧经 GameNum `primitiveGain` 懒求值入账（Spot 功能的 linearYield 即转译为 flow）；按 `mountEntityId` **层级分发**：挂 spot → 该 spot 的 spotExtra；挂 area/init → 各自 Extra；挂 enhancement/item 等非层级实体 → 资源树根 global 兜底节点；
  - `zoneModifiers`：区效果，`syncAffectorZoneEffects` 并入 GameNumSystem 区表（按 source=`affector:<instanceId>` 反查撤回）；**不每 tick 全量重建**——仅在实例集合/激活 entry 翻转（mount/unmount/recheck）、enhancementRemoved、spotTagChanged、spotLevelChanged 及 `reconcileMounts` 时同步；
- 每帧 `affectorEngine.applyActiveEffects()`：先重估轮询实例（stat 宽依赖），再执行 Active 实例的 `perTickEffects`；
- **双通道警告**：`flows` 与 `effects[addResource]` 并存时语义不同但会叠加——激活沿发放一次 + 每帧持续入账 = **双倍**。数据作者应二选一；
- **实例生命周期**：实例不落存档；`reconcileMounts()` 按当前 PlayerState（inventory / unlockedEnhancements / spotLevels 的 linearYield 功能）对账重挂载，在 init / enterInit / restoreFromSave / reset 时调用；`mount` 幂等（已存在实例只 recheck 不重建，激活沿不重复发放）。
- 激活 entry 集在 Active 内变化（状态未翻转）发 `affectorEntriesChanged` → GameNum 重同步（单向依赖，T7）。

## ZoneModifier（区效果）

```text
{ category: 'flat'|'mul'|'custom'|'bound',
  target: { kind:'tag', tag } | { kind:'entity', ref: { kind:'spot'|'area'|'init'|'enhancement'|'global', id } },
  value: number | ValueExpression, resource?, multiplierId?, min?, max? }
flat    → 加到 flat 区（经 Extra 节点直加总产出，不进乘区）
mul     → 并入 mul 区（同区多条记录加法合并：1+Σ(v-1)）
custom  → 按 multiplierId 分组连乘（自定义乘区）
bound   → 夹取 min/max（可收紧不可放宽，折叠入 mul 区求值）
```

- `target.ref.id` 为 `'*'` 表示该类全部实体；`global` 为资源树全局层；`resource` 缺省 = 作用所有资源；
- `value` 支持 `ValueExpression`（builder `modTag`/`modEntity` 同步放宽）；`life` 字段已删。

## Reveal（信息可知阶梯）

- `revealTriggers`：{ reveal: 'existence'|'name'|'condition'|'utility', condition }；
- 阶梯：invisible → presence → partial → known → utility → purchaseable → owned；
- `get*Reveal`（tooltip-reveal 模块）统一求值，UI 按 stage 遮挡显示（`???`）。`AccessStage` 是另一套（见 [[docs/docs-828/02-modules/visibility]]）。

## GameEvent 事件目录（EventBus 订阅面）

> **权威源是 `src/arona-clicker/contracts/event-catalog.ts`**：`GameEvent` 联合类型 + `EVENT_CATALOG`（`Record<GameEvent['type'], EventCatalogEntry>`，purpose / emit / subscribe 机器可查，新增/删除事件编译期强制同步）。下表为按域速览，契约以代码为准。总线 API 见 `src/engine/core/event-bus.ts`：`on(type, handler)` 定向订阅、`onAny(handler)` 通配、`off` / `emit` / `flush` / `clear`；基础总线支持泛型事件。每个事件对象额外携带可选 `stats?: StatsContext`。

**资源与生产**
- `resourceChanged { resource, delta, newValue }` — 生产失效驱动核心 · emit `state-mutation-service` · 订 condition-deps / game-num / trigger-system
- `spotProduced { spotId, resource, amount }` · `tick-system`（无专属订阅方）
- `tick { frame }` · `tick-system` · 订 trigger-system（every 分频）

**设施 Spot**
- `spotLevelChanged { spotId, newLevel }` · 订 affector-engine / condition-deps / game-num / tag-stats / trigger-system
- `managerChanged { spotId, newManager }` · 订 condition-deps / game-num
- `spotTagChanged { spotId, tag, added }` · emit `spot-service` · 订 affector-engine / condition-deps / game-num

**强化 / 物品**
- `enhancementAdded` / `enhancementRemoved { enhancementId }` · 订 affector-engine / condition-deps / game-num / tag-stats
- `itemCollected { itemId, count, newTotal }` · 订 affector-engine / condition-deps / trigger-system

**世界线 / 区域**
- `initEntered` / `areaEntered` · emit `init-service` · 订 condition-deps / tag-stats / trigger-system
- `initUnlocked { initId }` · 订 condition-deps / tag-stats
- `storyAreaTraveled { areaId }` — travelToArea 成功且 notice=true · emit `story-flow` · 订 UI

**剧情 Story**
- `storyTriggered { storyId }` · emit `story-flow` · 订 condition-deps（visitedStoryInChain）/ UI
- `storyCompleted { storyId }` · emit `state-mutation-service` · 订 condition-deps / tag-stats / trigger-system / UI
- `storyRewarded { storyId, source, effects, flags }` — 完结奖励结算后 · emit `story-jump` · 订 UI

**条件 / 状态位**
- `flagChanged { flag, value }` · 订 color-unlock-reactor / condition-deps
- `extraChanged { path, value? }` · 订 condition-deps / game-num
- `poolGateChanged { poolId, available }` — 闲聊池 gate 翻转 · 订 UI
- `tagCollectedChanged { kind }` — TagStat 集合增删（读档全量重建不发）· 订 condition-deps
- `conditionGroupMet`：**已删除**——原为全库无发射方/订阅方的死事件，T4 清理时移除（见 [[docs/0x-plan&work/completed/adr-0001-architecture-consolidation]]）

**Affector 生命周期**（均 emit `affector-engine`，订 game-num）
- `affectorMounted { instanceId, packId, mountEntityId }`
- `affectorStateChanged { instanceId, oldState, newState }`
- `affectorUnmounted { instanceId, reason }`
- `affectorEntriesChanged { instanceId }` — 激活 entry 集在 Active 内变化（状态未翻转）

**角色 / 色彩**（均 emit `state-mutation-service`）
- `characterAcquired { variantId, via, duplicate, shards, bonusResources }` · 订 color-unlock-reactor / tag-stats / trigger-system
- `cultivated { variantId, kind: 'exp'|'star', newLevel?, newStars? }` · 订 trigger-system
- `groupUnlocked { groupId }`（色彩组；旧名 `colorUnlocked` 已废）/ `equipmentCollected` / `equipmentEquipped`（均观测事件）
- `themeChanged { groupId: string | null, selection }` / `entityThemeChanged { entityKey }` / `entityDesignUnlocked { entityKey, designId }`（均观测）；`selection` 是当前 system / color-group / custom 全局来源。

**抽卡 / 社交 / 被动 / 好感**
- `gachaResolved { poolId, count }` · emit `gacha-service`（逐次结果以 characterAcquired 跟随）
- `passiveCooldownsChanged` / `studentBlockChanged` / `charaCustomChanged` / `chatReadChanged`（均 emit `state-mutation-service`，观测；chatReadChanged 当前无写入方）
- `affectionChanged { variantId, delta, newLevel, newExp, leveledUp }` · emit `state-mutation-service`（好感小值入账；condition-deps 按 variantId 失效 + UI 跨级提示）

**运行时效果请求**（EffectEngine 转发演出类 op → RuntimeEffectReactor 消费，不落状态）
- `themeEffectRequested { effect }` — setTheme → ColorSystem 临时主题层
- `storyEffectRequested { effect }` — triggerStory → StoryService.startStory（force）
- `chatFlowEffectRequested { effect }` — 聊天流族 5 种 → ChatFlowService

**聊天流演出**（Talklet 专用，均 emit `chat-flow-service`，订 UI controller-events）
- `chatFlowCleared` / `chatTextClearedAll`
- `chatTextShown { id, text?, talklet?, x?, y?, align?, kind?, style?, title?, buttonText?, targetStoryId? }`
- `chatTextCleared { id }`
- `openingTitleShown { title? }` — 开幕标题横幅呼出：首页声明的 `showOpeningTitle` 随剧情开始由 `story-flow` 发出；非首页/演出管线经 `chat-flow-service`。title 为 effect.value 文本，缺省时 UI 回退 `entry.openingTitle ?? StoryDef.name`

**全局兜底订阅**（不逐条列入 subscribe）：devLog 的 `onAny` 全量记录（`wiring.ts`）；UI 的 `onAny` 揭示刷新（`controller-events.ts`，跳过 tick/spotProduced）。

## 相关文档

[[docs/docs-828/02-modules/effect-trigger]] · [[docs/docs-828/03-data-structures/declarative-dsl]] · [[docs/docs-828/04-mechanisms/production]]（失效策略）

