# docs-824 — 04f 事件联动：Trigger / Effect / Affector / Reveal

> 原文出处：`04-core-algorithms.md` 六、七章。事件驱动是「机制优先做成 Trigger/Affector」纪律的落点。

## Trigger（一次性/持续性条件触发）

- `TriggerDef`：{ id, trigger (事件类型), condition, effects, maxRuns? }；
- 运行时订阅事件 → 条件满足（`evaluateGroup`）→ 执行 `effects`（经 [[docs-824/04a-state-mutation-pipeline]]）；
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
  - `flows`：**唯一持续产出通道**，激活期间每帧经 GameNum `primitiveGain` 懒求值入账（Spot 功能的 linearYield 即转译为 flow）；
  - `zoneModifiers`：区效果，`syncAffectorZoneEffects` 并入 GameNumSystem 区表（按 instanceId 反查撤回）；
- 每帧 `affectorEngine.applyActiveEffects()`：先重估轮询实例（stat 宽依赖），再执行 Active 实例的 `perTickEffects`；
- **双通道警告**：`flows` 与 `effects[addResource]` 并存时语义不同但会叠加——激活沿发放一次 + 每帧持续入账 = **双倍**。数据作者应二选一：一次性奖励用 `effects[addResource]`，持续产出用 `flows`；
- **实例生命周期**：实例不落存档；`reconcileMounts()` 按当前 PlayerState（inventory / unlockedEnhancements / spotLevels 的 linearYield 功能）对账重挂载，在 init / enterInit / restoreFromSave / reset 时调用；`mount` 幂等（已存在实例只 recheck 不重建，激活沿不重复发放）。

## ZoneModifier（区效果）

```text
{ category: 'mul'|'flat'|'bound', target: { kind:'tag'|'spot'|'area'|'init', ... }, value, resource?, min?, max? }
mul   → 乘到 tag/spot 的 mul 区（可多源连乘）
flat  → 加到 flat 区（add 树根）
bound → 夹取 min/max（可收紧不可放宽）
```

## Reveal（信息可知阶梯）

- `revealTriggers`：{ reveal: 'existence'|'name'|'condition'|'utility', condition }；
- 阶梯：invisible → presence → partial → known → utility → purchaseable → owned；
- `get*Reveal`（tooltip-reveal 模块）统一求值，UI 按 stage 遮挡显示（`???`）。

---

上一篇：[[docs-824/04e-color-derivation]] · 下一篇：[[docs-824/04g-roster]]