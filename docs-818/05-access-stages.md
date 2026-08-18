# 05 — Access Stages 可知性/可达性/生效层级

---

## 1. AccessStage 五层模型

**定义位置**：[[src/engine/types/entities.ts]]

所有实体按 AccessStage 分层，自上而下层层收窄：

```
hidden → obfuscated → revealed → accessible → active
```

| 层级 | 含义 | 控制机制 |
|------|------|----------|
| `hidden` | 实体不出现于界面 | revealTriggers 的 existence 门槛 |
| `obfuscated` | 可见但数值以 ??? 遮挡 | 揭示条件未满足 |
| `revealed` | 可见且数值完整展示 | 揭示条件已满足 |
| `accessible` | 可进入/解锁/使用 | 解锁条件满足 |
| `active` | 运行时持续生效 | Affector / Trigger / Spot 功能 |

**顺序**：先看见，再看全，再进得去，才持续生效。

---

## 2. 可见性引擎

**文件**：[[src/engine/visibility-engine.ts]]

`compute(state)` 一次性算出全部实体可见性快照。

### 可见性判定

由 `revealTriggers` 中的 `existence` 目标承担：
- **无 existence 门槛** = 默认可见
- **有 existence 门槛** = 任一满足即可见（OR 语义）

### 快照结构

```typescript
interface VisibilitySnapshot {
  inits: Record<InitId, boolean>;
  areas: Record<AreaId, boolean>;
  spots: Record<SpotId, boolean>;
  enhancements: Record<EnhancementId, boolean>;
  items: Record<ItemId, boolean>;
  stories: Record<StoryId, boolean>;
}
```

### 单点查询

- `isInitVisible(initId, state)`
- `isAreaVisible(areaId, state)`
- `isSpotVisible(spotId, state)`
- `isEnhancementVisible(enhId, state)`

---

## 3. 揭示系统

**文件**：[[src/engine/reveal.ts]]

### RevealTrigger

**定义位置**：[[src/engine/types/entities.ts]]

```typescript
interface RevealTrigger {
  reveal: RevealTarget;        // 负责揭示的信息块
  condition?: Condition | ConditionGroup;  // 触发条件
}
```

### RevealTarget 揭示目标

| target | 含义 |
|--------|------|
| `existence` | 实体是否出现（原 visibilityCondition 的职责） |
| `name` | 名称 |
| `condition` | 解锁/获得条件 |
| `utility` | 效用（描述、产出等） |
| `unlock` | 实际解锁/自动解锁条件（engine 消费的可达性层） |

### 揭示规则

- **无该目标的 Trigger** = 无门槛（该级默认已知/可见）
- **有多个 Trigger** = 任一满足即揭示（OR）

### 纯函数 API

| 函数 | 说明 |
|------|------|
| `existenceTriggers(triggers)` | 取 existence 目标的 Trigger 列表 |
| `hasExistenceGate(triggers)` | 是否有存在性门槛 |
| `existenceCondition(triggers)` | 取存在性条件（供 UI 展示） |
| `existenceMet(triggers, evaluate)` | 存在性判定 |
| `unlockTriggers(triggers)` | 取 unlock 目标的 Trigger 列表 |
| `unlockCondition(triggers)` | 取解锁条件 |
| `unlockMet(triggers, evaluate)` | 解锁可达性判定 |

### RevealStage（UI 侧信息阶梯）

**定义位置**：[[src/engine/types/entities.ts]]

```
invisible → presence → partial → known → utility → purchaseable → owned
```

| 阶段 | 含义 |
|------|------|
| `invisible` | L0 不可见 |
| `presence` | L1 知晓这里有一个未解锁内容 |
| `partial` | L2 知晓名称 或 解锁条件 |
| `known` | L3 知晓名称与解锁条件 |
| `utility` | L4 并知晓效用 |
| `purchaseable` | L5 解锁条件满足，可购买 |
| `owned` | L6 已购买 |

---

## 4. 可达性判定

可达性（accessible）= 解锁条件满足后才可执行的操作。

### 各实体的可达性判定

| 实体 | 判定逻辑 |
|------|----------|
| **Init** | 已解锁 或 免费 或 当前资源足够支付购买费用 |
| **Area** | 已访问（visitedAreas 包含） |
| **Spot** | 可见 + 揭示信息足够（nameKnown && utilityKnown） |
| **Enhancement** | 解锁条件满足（unlockCondition 满足） |
| **Story** | 未完成 + 条件满足 + 名称已知 |

### 解锁 vs 自动解锁

`unlock` 目标是 engine 消费的可达性层：
- **手动解锁**：玩家购买/进入/使用前需满足 unlock 条件
- **自动解锁**：Spot 的 `revealTriggers` 中有 unlock 目标且条件满足时，Spot 无需购买即被授予（level=1）

---

## 5. 生效层

### Affector（持续效果）

每 tick 全量重估条件，Active 状态的效果才应用。

**实现位置**：[[src/engine/affector-engine.ts]]

### Trigger（事件触发）

事件命中 + 条件满足才执行。

**实现位置**：[[src/engine/trigger-system.ts]]

### Spot 功能

条件满足 + 已拥有才计入产出。

**实现位置**：[[src/engine/spot-functionality.ts]]

---

## 6. UI 侧揭示计算

**文件**：[[src/ui/components/tooltip.ts]]

UI 侧的揭示阶段计算在 `getXxxReveal` 函数中完成（读 state 推断，纯展示）。

### 核心函数

| 函数 | 说明 |
|------|------|
| `getSpotReveal(ctx, spot)` | Spot 揭示阶段 |
| `getEnhancementReveal(ctx, enh)` | Enhancement 揭示阶段 |
| `getInitReveal(ctx, init)` | Init 揭示阶段 |
| `getAreaReveal(ctx, area)` | Area 揭示阶段 |
| `getStoryReveal(ctx, story)` | Story 揭示阶段 |
| `resolveReveal(ctx, input)` | 统一揭示求值 |

### resolveReveal 逻辑

1. 已拥有 → `owned`
2. existence 不满足 → `invisible`
3. 揭示信息解析（nameKnown / conditionKnown / utilityKnown）
4. 可达性判定 → `purchaseable`
5. 按信息完整度 → `utility` / `known` / `partial` / `presence`

### 指纹刷新

UIController 每次事件后重算"揭示指纹"（所有实体 reveal stage 的拼接串），指纹变化才重建 DOM。

**实现位置**：[[src/ui/controller.ts]] `computeRevealFingerprint()` / `refreshRevealIfChanged()`
