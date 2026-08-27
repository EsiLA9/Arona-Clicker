# docs-824 — 04h Affector 系统设计评审

> 本文回答：**Affector 系列（AffectorPackDef / AffectorEngine / zoneModifiers / GameNum 桥接）有哪些不合适的设计？**
> 覆盖：`src/engine/types/trigger.ts` 的 Affector 类型 → `src/engine/effect/affector-engine.ts` / `affector-text.ts` → `src/engine/expression/tag-effect.ts` / `game-num-tag.ts` → `src/engine/def-factory/affector-pack.ts`。
> 方法：读类型定义 + 核对运行时代码 + 追踪存档/加载/重置路径。

---

## 判定标准

- **严重**：功能错误或数据丢失风险，影响存档/加载/初始化的正确性。
- **高**：语义断裂或死字段/死逻辑，导致数据作者被误导、或引擎维护者困惑。
- **中**：设计冗余或隐式约定，增加维护成本但没有即时错误。
- **低**：代码风格/命名细节。

---

## 一、严重问题

### 1.1 Affector 实例不跨存档保存，读档后全部丢失

Affector 实例（`instances` Map）仅存在于 `AffectorEngine` 内存中，**不落存档**。`restoreFromSave`（save-codec.ts:126-169）只调了 `affectorEngine.setState(state)`，没有重挂载任何实例。读档后：

- **flows 彻底消失**：`applyActiveEffects` 的 `getActiveInstances()` 返回空，`tick` 中 `gameNumEval` 的 `scanActiveFlows`（game-num-eval.ts:379-397）也扫不到活跃实例 → 所有持续产出归零。
- **zoneModifiers 被主动清除**：`syncAffectorZoneEffects` 第一帧以空实例集覆盖 >> 移除了全部 `syncedAffectorSources` 对应的 tagEffects（syncAffectorZoneEffects 对 `system.syncedAffectorSources` 逐个 removeTagEffectsBySource）。如果 `syncedAffectorSources` 因之前的运行不为空，则旧 zoneModifier 数据被删除、新数据不注册。
- **addResource 一次性发放不重放**：Latent→Active 翻转不再发生。

无任何测试覆盖此路径（`tests/` 中无 `restoreFromSave` + `affector` 的匹配项）。

**根因**：Affector 实例的挂载完全由事件驱动（`itemCollected` / `enhancementAdded` / `spotLevelChanged`），但存档恢复不发射这些事件。没有「状态与实例的核对恢复」步骤。

**修复方向**：`restoreFromSave` 末尾（或下一个 tick 前）应遍历当前 PlayerState 中的物品/强化/Spot 等级，按需 mount 对应的 Affector 实例，并触发一次 `syncAffectorZoneEffects`。

### 1.2 初始状态/默认状态的物品和强化没有 Affector 挂载

`createDefaultPlayerState`（state-factory.ts）给定的初始物品、强化不触发 `itemCollected` / `enhancementAdded` 事件 → 它们的 `affectorPackIds` 永远不会被 mount。当前默认数据中无初始物品/强化，故本条未暴露；一旦数据作者添加就会中招。

**修复方向**：`init()` 流程末尾应扫描初始状态中的物品/强化/Spot 功能，统一 mount。

### 1.3 `Effect[]` 在 Affector 中「每 tick 执行」——类型失配

`AffectorEffect.effects` 是 `Effect[]`，与 `Talklet.effects` / `EntryEffectDef.effects` / `TriggerDef.effects` 类型相同。但在 Affector 中 **非 `addResource` 的效果每 tick 执行一次**（`applyActiveEffects` 第 348-353 行，只排除了 `addResource` / `setSpotMaxLevel` / `removeSpotMaxLevel`）。

这意味着 `addItem` / `grantCharacter` / `unlockInit` / `addEnhancement` / `triggerStory` 等**一次性语义的 op** 放在 Affector 里会每 tick 重复发放——无限物品、无限角色、无限触发剧情。`Effect[]` 类型没有区分「一次性」和「持续期每 tick」的语义，数据作者极易写错。

**修复方向**：
- 方案 A：在 `AffectorEffect` 上单独定义 `perTickEffects` 字段，与 `edgeEffects`（仅在 Latent→Active 时执行）分离，从类型上禁止一次性 op 进入持续期。
- 方案 B（最小改）：在 `applyActiveEffects` 中拒绝对 `addItem` / `grantCharacter` / `unlockInit` / `triggerStory` / `addEnhancement` 等 op 的每 tick 执行，并给出 DevLog 警告。
- 无论如何，`flows` 已经是持续产出的最佳路径，`effects` 在 Affector 中应该只做 edge-triggered 的事。

---

## 二、高严重度问题

### 2.1 `persistent` 字段声明即死

`AffectorPackDef.persistent`（trigger.ts:38）在 builder 中可设置（affector-pack.ts:88），但**引擎从未读取此字段**。全库检索 `persistent` 仅出现在 builder 写入处（affector-pack.ts:88）。这是一个死字段——如果它意图是「实例跨 Init 持久」，当前未实现；如果已废弃，应移除。

### 2.2 `life` 三层语义无执行者，且缺省不一致

`TagEffectRecord.life`（tag-effect.ts:29）声明了 `'global' | 'init' | 'snapshot'` 三档生命周期，`clearTagEffectsByLife`（game-num-tag.ts:77）实现了按档清理，但**没有任何调用方**——`clearTagEffectsByLife` 是一个死函数。三档永远不会被清理，`life` 字段形同虚设。

同时缺省值不一致：
- `AffectorPackBuilder.modTag` / `modEntity`（affector-pack.ts:49,60）缺省 `'init'`
- `registerAffectorModifier`（game-num-tag.ts:206）缺省 `modifier.life ?? 'global'`

即 builder 生成的 pack 默认 `life='init'`，而引擎在遇到未显式声明的 `ZoneModifierDecl` 时默认 `'global'`。两个缺省不对齐，且两者都无实际效果（反正没人清理）。

### 2.3 `syncAffectorZoneEffects` 每 tick 全量重建

`applyActiveEffects`（affector-engine.ts:336-358）每 tick 调用 `syncAffectorZoneEffects`：
- 遍历所有活跃实例，对每个实例先 `removeTagEffectsBySource`（遍历 `tagEffects` 和 `entityEffects` 全表），再重新注册所有 modifier。
- `toValueNode`（game-num-tag.ts:142）使用 `Math.random().toString(36).slice(2)` 生成随机 id——非确定性、不可复现、测试困难、每次重建产生新节点 id 导致脏位传播。
- `removeTagEffectsBySource` 遍历 `tagEffects` 全部分组（O(tagKeys × records)），即便只有一个实例的 source 变化。

在 `life` 无人清理的现状下，affector 的 zoneModifier 数据在 `state.tagEffects` 中**只增不减**，除非 `removeTagEffectsBySource` 在 sync 时清理。但 sync 只清理当前活跃的 source——如果实例暂时失活，其 source 被清理，再激活时重新注册。这本身是对的，但全量重建的代价每 tick 都付出。

---

## 三、中严重度问题

### 3.1 `flow` 与 `effects[addResource]` 双通道

相同「持续产出」意图存在两种表达：

| 通道 | 时机 | 存放位置 |
| --- | --- | --- |
| `flows` | 每 tick 懒求值（GameNum） | `affector-engine.ts` 不处理，由 `game-num-eval.ts` 扫描 |
| `effects[addResource]` | `Latent→Active` 翻转时一次性发放 | `affector-engine.ts:172-179` 特殊处理 |

两者同时存在时**双重发放**（`addResource` 在翻转时发放一次，`flows` 每 tick 持续产出）。`recheck` 中过滤了 `addResource` 不让它每 tick 重复（第 348-349 行），但 edge-triggered 的翻转发放与 `flows` 的每 tick 持续如果并存，数据作者可能无意中拿到双倍。

**条件抖动风险**：`recheck` 注释明确说「翻转回 Latent 再激活会再次发放」——条件波动时 `addResource` 会重复发放一次性的量。

### 3.2 同一 pack 内多个 entry 共用 id 导致隐式 OR

`recheck`（affector-engine.ts:165-167）：
```ts
const activeEntryIds = pack.entries
  .filter(entry => !entry.condition || this.conditionSystem.evaluateGroup(entry.condition, this.state!))
  .map(entry => entry.id);
```
之后 `applyActiveEffects` 用 `instance.activeEntryIds.includes(entry.id)` 判断。如果两条 entry 声明了相同 id，只要任一条件通过，该 id 就出现在 `activeEntryIds` 中，**两条 entry 都被视为激活**。没有任何校验或警告。

### 3.3 `mount` 无条件覆盖已有实例，导致 addResource 重复发放

`mount()`（affector-engine.ts:128）：
```ts
this.instances.set(instance.instanceId, instance);
```
如果该实例已存在（例如 `itemCollected` 因重复获得同一物品再次触发），旧实例被覆盖，新实例 `state: 'Latent'` → `recheck` → `Latent→Active` 翻转 → `addResource` 再次发放。对于「持有即生效」的物品，重复获得会重复触发一次性奖励。

### 3.4 `syncSpotFunctionalities` 的 pack 键冗余

`buildSpotFunctionalityPack` 把 pack 注册为 `${fn.id}@${spotId}`（affector-engine.ts:308），然后 `mount` 把 `instanceId` 拼成 `${packId}@${mountEntityId}` = `${fn.id}@${spotId}@${spotId}`（mountEntityId 也是 spotId）。pack 键已含 spotId，实例 id 又拼一次。冗余但无害。

### 3.5 `getSpotMaxLevelOverrides` 每调用全量扫描

每次调用（spot-service.ts:165 按需）遍历所有活跃实例的活跃 entry，扫描 setSpotMaxLevel / removeSpotMaxLevel 效果。O(instances×entries)。当前数据量小不是问题，但架构上无隔离。

---

## 四、低严重度 / 细节

### 4.1 `toValueNode` 使用随机 id

```ts
// game-num-tag.ts:142
return { id: `const:${Math.random().toString(36).slice(2)}`, kind: 'const', value: ... };
```
非确定性 id 生成 → 测试不可复现、每次重建生成新 id 但无 parent 关系（const 节点无子节点），所以实际影响很小。但属于代码坏味道。

### 4.2 `describeValue` 的 spotCount 参数名与语义不符

```ts
// affector-text.ts:58
case 'spotCount': return `${nameOf('area', String(p.area ?? ''))}设施数`;
```
`spotCount` 的 params 是 `area`，命名与语义不匹配（应为 `area` 或 `spotCount` 明示）。

### 4.3 `modTag` / `modEntity` 仅接受 `number` 值

Builder 的 `modTag` / `modEntity`（affector-pack.ts:49,60）只接受 `number` 类型，不支持 `ValueExpression`。需要表达式值的 modifier 必须走 `modifier()` 兜底。API 不一致。

### 4.4 `affector-text.ts` 的穷尽式 switch 设计良好

`describeEffect` 使用 `never` 守卫（第 122 行），`EffectOp` 新增成员时编译报错。这是值得推广的枚举处理模式。

---

## 五、已在前文 03e 中覆盖的问题（此篇不再重复）

- `affectorPackIds: string | AffectorPackDef` 双通道引用（03e §3）
- `SpotFunctionalityDef.id` 兼作 pack 命名空间键、内外源隐式覆盖（03e §3）
- 字符串 ID 泛滥（03e §5）

---

## 六、总结：最需要优先修复的三件事

1. **存档恢复缺失 Affector 实例重挂载**（§1.1）——功能正确性bug，影响所有使用了 affector 的存档。
2. **`Effect[]` 在 Affector 中全量每 tick 执行**（§1.3）——类型失配陷阱，数据作者极易写出无限物品/无限角色。
3. **`persistent` 死字段 + `life` 死语义**（§2.1, §2.2）——声明即存但永不生效，误导数据作者。

---

上一篇：[[docs-824/04g-roster]]