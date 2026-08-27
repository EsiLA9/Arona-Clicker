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

- `AffectorPackDef`：{ entries: [{ condition, zoneModifiers[] }] }；
- 每帧 `affectorEngine.apply()`：
  - 实例 = 条件满足的 entry → 收集其 `zoneModifiers`；
  - `syncAffectorZoneEffects` 把 zone 效果并入 GameNumSystem 区表（按 instanceId 反查撤回）；
- 源是「持久挂载」→ 区效果在**每帧产出**生效，不改状态。

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