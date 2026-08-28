# docs-824 — 04f 事件联动：Trigger / Effect / Affector / Reveal

> 原文出处：`04-core-algorithms.md` 六、七章。事件驱动是「机制优先做成 Trigger/Affector」纪律的落点。

## Trigger（一次性/持续性条件触发）

- `TriggerDef`：{ id, trigger (事件类型), condition, effects, maxRuns? }；`on` 的 `TriggerEventDef.kind`（tick/resource/spotLevel/item/story/init/area）与 `Condition`/`Effect` 全枚举见 [[docs-824/03f-declarative-dsl]] ==new==；
- 运行时订阅事件（可订阅的事件全集见下文「GameEvent 事件目录」）→ 条件满足（`evaluateGroup`）→ 执行 `effects`（经 [[docs-824/04a-state-mutation-pipeline]]）；
- 未触发/触发中状态持久化在 PlayerState（`triggerState`）。

## Effect（op 分支）

- `EffectDef.op` 全列表见 04a；效果执行在 effect-ops 模块内按 op 分发；
- 特殊 op：`loot` → LootSystem（掉落表）、`triggerStory` → StoryService、`setTheme` → ColorSystem；
- 剧情差分效果 → `grantCharacter`（重复自动转碎片）。

## Affector（挂载持续效果）

- `AffectorPackDef`：{ entries: [{ condition, effects[], perTickEffects?[], flows[], zoneModifiers[] }] }；
- entry 的效果分四条通道：
  - `effects`：**激活沿（Latent→Active 翻转）一次性执行**——`addResource` 一次性发放，setFlag/addItem 等一次性 op 同样只执行一次；声明类 op（setSpotMaxLevel/removeSpotMaxLevel）由 `getSpotMaxLevelOverrides` 动态读取，不经执行；
  - `perTickEffects`：Active 期间每帧执行（仅限幂等/维持类 op）；
  - `flows`：**唯一持续产出通道**，激活期间每帧经 GameNum `primitiveGain` 懒求值入账（Spot 功能的 linearYield 即转译为 flow）；Phase 6 起按 `mountEntityId` **层级分发**：挂 spot → 该 spot 的 spotExtra（随 areaExtra 上抛）；挂 area/init → 各自 Extra；挂 enhancement/item 等非层级实体 → 资源树根 global 兜底节点（`affectorFlows` 节点带 `mount?` 字段，求值时过滤）==new==；
  - `zoneModifiers`：区效果，`syncAffectorZoneEffects` 并入 GameNumSystem 区表（按 source=`affector:<instanceId>` 反查撤回）；**不再每 tick 全量重建**——仅在实例集合/激活 entry 翻转（mount/unmount/recheck）、enhancementRemoved、spotTagChanged、spotLevelChanged 及 `reconcileMounts` 时同步 ==new==；
- 每帧 `affectorEngine.applyActiveEffects()`：先重估轮询实例（stat 宽依赖），再执行 Active 实例的 `perTickEffects`；
- **双通道警告**：`flows` 与 `effects[addResource]` 并存时语义不同但会叠加——激活沿发放一次 + 每帧持续入账 = **双倍**。数据作者应二选一：一次性奖励用 `effects[addResource]`，持续产出用 `flows`；
- **实例生命周期**：实例不落存档；`reconcileMounts()` 按当前 PlayerState（inventory / unlockedEnhancements / spotLevels 的 linearYield 功能）对账重挂载，在 init / enterInit / restoreFromSave / reset 时调用；`mount` 幂等（已存在实例只 recheck 不重建，激活沿不重复发放）。

## ZoneModifier（区效果）

```text
{ category: 'flat'|'mul'|'custom'|'bound',
  target: { kind:'tag', tag } | { kind:'entity', ref: { kind:'spot'|'area'|'init'|'enhancement'|'global', id } },
  value: number | ValueExpression, resource?, multiplierId?, min?, max? }
flat    → 加到 flat 区（经 Extra 节点直加总产出，不进乘区）
mul     → 并入 mul 区（同区多条记录加法合并：1+Σ(v-1)，Phase 1 决策项 1）
custom  → 按 multiplierId 分组连乘（自定义乘区）
bound   → 夹取 min/max（可收紧不可放宽，折叠入 mul 区求值）
```

- `target.ref.id` 为 `'*'` 表示该类全部实体；`global` 为资源树全局层（Phase 6）；`resource` 缺省 = 作用所有资源；==new==
- `value` 支持 `ValueExpression`（Phase 7：builder `modTag`/`modEntity` 同步放宽，不再只能走 `modifier()` 兜底）；`life` 字段已删（Phase 7，三档语义无执行者）==new==

## Reveal（信息可知阶梯）

- `revealTriggers`：{ reveal: 'existence'|'name'|'condition'|'utility', condition }；
- 阶梯：invisible → presence → partial → known → utility → purchaseable → owned；
- `get*Reveal`（tooltip-reveal 模块）统一求值，UI 按 stage 遮挡显示（`???`）。

## GameEvent 事件目录（EventBus 订阅面）==new==

> 权威枚举来自 `src/engine/types/events.ts` 的 `GameEvent` 联合类型（共 **41** 个）。总线 API 见 `src/engine/core/event-bus.ts`：`on(type, handler)` 定向订阅（返回反注册函数）、`onAny(handler)` 通配订阅、`off` / `emit` / `flush` / `clear`。派发顺序先特定后通配；`emit` 在 `flush` 期间入队、`flush()` 批量排空（重入保护）。**每个事件对象都额外携带可选字段 `stats?: StatsContext`（联合末尾 `& { stats?: StatsContext }`）。下表「发射方」为 `emit` 调用所在模块（`src/engine/` 下相对路径）。

**资源与生产**
- `resourceChanged { resource, delta, newValue }` — 资源增减（生产失效驱动核心）· `system/state-mutation-service`
- `spotProduced { spotId, resource, amount }` — 某 Spot 产出某资源 · `system/tick-system`
- `tick { frame }` — 每帧 · `system/tick-system`

**设施 Spot**
- `spotLevelChanged { spotId, newLevel }` · `system/state-mutation-service`
- `managerChanged { spotId, newManager }` · `system/state-mutation-service`
- `spotTagChanged { spotId, tag, added }` · `game/spot-service`

**强化 / 物品**
- `enhancementAdded { enhancementId }` · `system/state-mutation-service`
- `enhancementRemoved { enhancementId }` · `system/state-mutation-service`
- `itemCollected { itemId, count, newTotal }` · `system/state-mutation-service`

**世界线 / 区域**
- `initEntered { initId }` · `game/init-service`
- `initUnlocked { initId }` · `system/state-mutation-service`
- `areaEntered { areaId, fromAreaId }` · `game/init-service`
- `storyAreaTraveled { areaId }` — travelToArea 成功且 notice=true · `game/story-flow`

**剧情 Story**
- `storyTriggered { storyId }` · `game/story-flow`
- `storyCompleted { storyId }` · `system/state-mutation-service`
- `storyRewarded { storyId, source: 'first'|'repeat'|'conditional', effects, flags }` — 完结奖励结算后 · `game/story-jump`

**条件 / 状态位**
- `flagChanged { flag, value }` · `system/state-mutation-service`
- `extraChanged { path, value? }` · `system/state-mutation-service`
- `poolGateChanged { poolId, available }` — 闲聊池 gate 翻转 · `system/passive-pool-system`
- `tagCollectedChanged { kind }` — TagStat 集合增删（读档全量重建不发）· `stats/tag-stats`
- `conditionGroupMet { triggerId }` — ⚠️ 当前全库无发射方/订阅方（死事件，待清理或接线）

**Affector 生命周期**（均在 `effect/affector-engine`）
- `affectorMounted { instanceId, packId, mountEntityId }`
- `affectorStateChanged { instanceId, oldState, newState }`
- `affectorUnmounted { instanceId, reason }`

**角色（Character 重构）**（均在 `system/state-mutation-service`）
- `characterAcquired { variantId, via: 'gacha'|'story'|'event', duplicate, shards, bonusResources }`
- `cultivated { variantId, kind: 'exp'|'star', newLevel?, newStars? }`
- `colorUnlocked { colorId }`
- `equipmentCollected { equipmentId }`
- `equipmentEquipped { variantId, equipmentId }`

**主题**（均在 `system/state-mutation-service`）
- `themeChanged { colorId }`（null = 回默认）
- `entityThemeChanged { entityKey }`
- `entityDesignUnlocked { entityKey, designId }`

**抽卡 / 社交 / 被动**
- `gachaResolved { poolId, count }` · `system/gacha-service`
- `passiveCooldownsChanged { cooldowns }` · `system/state-mutation-service`
- `studentBlockChanged { variantId, blocked, entryId? }` · `system/state-mutation-service`
- `charaCustomChanged { character }` · `system/state-mutation-service`
- `chatReadChanged { messageId }` · `system/state-mutation-service`

**聊天流演出（Talklet 专用，UI 订阅后操作聊天流）**（均在 `game/chat-flow-service`）
- `chatFlowCleared`
- `chatTextClearedAll`
- `chatTextShown { id, text?, talklet?, x?, y?, align?, kind?, style?, title?, buttonText?, targetStoryId? }`
- `chatTextCleared { id }`

---

上一篇：[[docs-824/04e-color-derivation]] · 下一篇：[[docs-824/04g-roster]]