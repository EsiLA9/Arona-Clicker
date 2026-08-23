# ACProgram 引擎效能调研报告

> 调研目标：在当前"事件驱动 + 统一数值路径（GameNum / primitiveGain 懒求值）+ 三层状态"架构下，找出随规模放大可能变慢的机制，给出可落地的改进点。
> 调研方法：通读引擎子系统源码（`src/engine/*`），定位每 Tick 主路径与各写入口，按"单位时间运算量 × 放大系数"评估热点。
> 引用约定：按 `文件:函数` 引用（与项目文档约定一致），避免行号漂移。

---

## 1. 每 Tick 主路径（数据流向）

`tick-system.ts:tick()` 每帧（默认 1Hz）执行：

1. 对 `state.primitiveGain` 的每个资源：`gameNum.evaluateResourceGain(resource)` → 递归 `evaluate(add 树)`
   - 每个 `spot` 子树（`mul`）：`base` × `enhancementMultiplier` × `tagMultiplier` × `lifetimeMultiplier`
   - `enhancementMultiplier`：遍历**全部** `state.unlockedEnhancements`，逐个用 `matchesTag` 做前缀比对
   - `tagMultiplier`：遍历**全部** `state.spotManagers`，对每个 manager 调 `characterSystem.getTagBonus`
   - `evaluateAffectorFlows`：调 `affectorEngine.getActiveInstances()`（每次新建过滤数组）遍历全部激活 effect 实例
2. 每个资源 `changeResource` → emit `resourceChanged`
3. emit `spotProduced`（每资源一次）
4. `affectorEngine.applyActiveEffects()`：再次 `getActiveInstances` × N，套用 delta / 上限覆盖 / spot 产出
5. emit `tick`

关键放大系数：设资源数 R、产出 spot 数 S、已解锁强化数 E、激活 effect 数 A、触发器数 M。
每 Tick 事件数 ≈ `2R + 1`，触发器全扫描被乘到这个系数上。

---

## 2. 发现的问题（按影响排序）

### 🔴 P0-1｜EventBus `onAny` + TriggerSystem 全量扫描（最大结构性浪费）

- **位置**：`event-bus.ts:emit`（先跑所有 `onAny` 监听器）、`trigger-system.ts`（构造里 `bus.onAny(processAllTriggers)`，`processAllTriggers` 遍历**全部**触发器做 `matchesEvent`）
- **机制**：所有事件（含每 Tick 的 `2R` 个 `resourceChanged`/`spotProduced`）都触发一次"遍历全部 M 个触发器"的扫描。
- **为何低效**：
  - 每个 `resourceChanged`/`spotProduced` 都让 M 个触发器各做一次 `matchesEvent`，每 Tick 触发扫描次数 = `(2R+1) × M`。
  - **`on.kind === 'tick'` 的触发器本应每 Tick 只跑一次，现在被 `resourceChanged`/`spotProduced` 也各扫一遍** —— 它们被多扫 `2R` 次。
  - 大量触发器关心的是 `resource/spot/item/story/init/area` 等具体类型，却要为每个不相关事件做匹配。
- **改进**：按事件类型分桶预索引触发器。
  - 构造期把触发器按 `on.kind`（及 `on.resource/spotId/itemId/storyId/initId/areaId` 具体值）分到 `Map<EventType, Trigger[]>`。
  - `emit` 时只派发本类型桶 + `onAny` 桶；`tick` 触发器仅在 `tick` 事件派发。
  - 预期：每 Tick 触发器匹配次数从 `(2R+1)×M` 降到 `M（tick 桶一次）+ Σ(本类型触发器数)`，且 `tick` 类不再被高频资源事件反复扫描。
- **风险**：低（纯派发优化，语义不变）。需同步处理 `every`/`frame` 的 tick 节流（目前 `matchesEvent` 内处理，分桶后仍保留）。

### 🔴 P0-2｜每次 emit 都急切构建完整 `StatsContext` 快照（生产代码无人消费）

- **位置**：`state-mutation-service.ts:emit`（事件携带 `stats: this.statsService?.getContext()`），`stats.ts:getContext`
- **机制**：`getContext()` 会对 `global / init / session` 三层做多次深拷贝（`copyCounters` ×3 + `copyInitMap` + `resources` 展开 + `session` 展开）。
- **为何低效**：**每一个事件**（每 Tick 的 `2R+1` 个）都构建一次完整统计快照。经全仓检索，`event.stats` 在生产代码中**没有任何消费者** —— 触发器通过 `condition-system` 的 stat reader 读 `getView().stats` / `statsService.evaluate`，UI 读 `getView().stats`，只有 `stats.test.ts` 断言过它。
- **改进**：移除 `emit` 中的急切 `getContext()`；若确有监听器需要统计，改为惰性（首次访问时才构建并缓存于本次 emit）。预计每 Tick 省 `2R+1` 次多层深拷贝。
- **风险**：极低（去除死字段）。删除前确认无第三方依赖 `event.stats`。

### 🟠 P1-1｜`enhancementMultiplier` 每 Tick 全量重扫所有强化（主路径热点）

- **位置**：`game-num.ts:evaluate`（`enhancementMultiplier` 分支）、`tick-system.ts:tick` 同款逻辑
- **机制**：对每个 spot 子树，遍历**全部** `unlockedEnhancements`，`continue` 掉无 `productionMultiplier` 或 tag 不匹配的。
- **为何低效**：成本 = `R × S × E`（`matchesTag` 前缀比对虽无正则，但三重嵌套）。当 E 与 S 增长到数百时，这是每 Tick 最大的算术量。
- **改进**：构建**反向索引** `spotId → 适用的强化 id 列表`（仅含带 `productionMultiplier` 且 tag 匹配的强化），仅在"强化解锁/移除"或"spot tag 变化"时重建。使内层从 O(E) 降为 O(适用强化数)。
- **风险**：低（索引随解锁事件重建，与现有 `recheckByEntity` 机制同生命周期）。

### 🟠 P1-2｜产出系数缓存（经典放置游戏优化）

- **位置**：`game-num.ts`（整棵 `primitiveGain` 树每 Tick 重算）、`tick-system.ts:tick`
- **机制**：架构注释明确"节点只存定义，求值懒读 PlayerState，不缓存、按需计算"。这保证正确性，但每个 spot 的 `base × enh × tag × lifetime` 在 Tick 内只有层级变化（升级/解锁强化/指派经理/特质/激活 effect）时才变，资源余额不影响产出。
- **改进**：引入"产出版本号" `productionVersion`，在 spot 升级、强化解锁/移除、经理指派、影响产出 flag/特质变化、effect 挂载/卸载时自增；缓存每 spot 的产出系数 Map，版本未变直接命中。Tick 改为读缓存而非重走树。
- **风险**：中（失效键必须覆盖全，否则数值漂移）。建议**先上 P1-1 反向索引**降低 O(E) 压力，再视基准决定是否上缓存；缓存须配 vitest 断言（升级/解锁/指派后系数刷新）。

### 🟡 P2-1｜`getActiveInstances()` 每 Tick 多次新建过滤数组

- **位置**：`affector-engine.ts:getActiveInstances`（`[...this.instances.values()].filter(i => i.endedAt === null)`）
- **机制**：每 Tick 在 `evaluateAffectorFlows`（R 次）+ `applyActiveEffects`/`applyEntry`/`getSpotMaxLevelOverrides`/`evaluateSpotYield`（每个激活实例约 3 次）被调用，每次都 O(A) 过滤并分配新数组。
- **改进**：维护一个 `activeInstances` 缓存数组，`mountEntity`/`unmountEntity`/`endInstance` 时增量更新；或把已过滤列表沿调用链下传，避免重复过滤。
- **风险**：低。

### 🟡 P2-2｜ConditionSystem 线性扫描

- **位置**：`condition-system.ts:evaluateCondition`（`hasEnhancement` → `state.unlockedEnhancements.includes(cond.key)`；`hasReadStory`/`notReadStory` → `state.storyLog.some(s => s.storyId === cond.key)`）
- **机制**：每次条件求值都是 O(E) / O(S) 线性扫描。这些条件在**每次事件**对**每个触发器**的 `when` 上被求值，与 P0-1 的扫描次数相乘。
- **改进**：维护 `Set<EnhancementId>` 镜像供 O(1) 判定（`unlockedEnhancements` 数组仍保留用于序列化/视图）；`storyLog` 增加 `Set<storyId>` 镜像供 `hasReadStory` O(1) 判定。
- **风险**：低（镜像在对应写入口同步）。

### 🟡 P2-3｜TriggerSystem once 触发器数组拷贝

- **位置**：`trigger-system.ts:fire`（`this.state.triggersCompleted = [...(this.state.triggersCompleted ?? []), trigger.id]`）
- **机制**：每次 `once` 触发器触发都整体拷贝数组，O(n) 每发。初始化若批量触发大量 once 触发器则 O(n²)。
- **改进**：维护 `Set` 镜像，序列化时再转数组；或直接 `push`（数组有序即可）。
- **风险**：极低。

### 🟡 P2-4｜`evaluateAffectorFlows` 每资源扫描全部实例

- **位置**：`game-num.ts:evaluateAffectorFlows`
- **机制**：对每个资源遍历全部 A 个激活实例，再按 `flow.from` 取该资源分量。
- **改进**：每 Tick（或版本变更时）预建 `resource → 流入实例列表` 索引，避免 R×A 全扫。
- **风险**：低。

### ⚪ P3｜次要

- `story-service.ts:recordStoryRead`：`[...readTalkletIndexes, idx].sort(...)` 每次推进都展开+排序。可改为有序插入或 `Set`。非 Tick 路径，优先级低。
- `character-system.ts:getTagBonus`：可预计算每 manager 的 spot tag 加成缓存（配合 P1-2 一起做更划算）。

---

## 3. 改进优先级矩阵

| 编号 | 改进 | 影响 | 风险 | 建议阶段 |
|------|------|------|------|----------|
| P0-1 | 触发器按事件类型分桶派发 | 高（消除 2R×M 扫描乘数） | 低 | 阶段一 |
| P0-2 | 移除急切 StatsContext 构建 | 高（消除 2R 次深拷贝） | 极低 | 阶段一 |
| P1-1 | 强化→spot 反向索引 | 高（产出主路径 O(E)→O(适用)） | 低 | 阶段一/二 |
| P2-1 | 缓存 activeInstances | 中 | 低 | 阶段一 |
| P2-2 | 条件判定用 Set | 中 | 低 | 阶段一 |
| P2-3 | once 触发用 push/Set | 低 | 极低 | 阶段一 |
| P1-2 | 产出系数缓存 + 版本号 | 高 | 中（失效键需全） | 阶段二（配基准） |
| P2-4 | 资源→流入实例索引 | 中 | 低 | 阶段二 |
| P3 | storyLog 有序插入等 | 低 | 低 | 按需 |

---

## 4. 落地与验证建议

1. **先建基准**：用现有 vitest 写一个"性能基线"测试（构造含 N 资源 / M spot / E 强化 / A effect / K 触发器的中型存档，测 `game.tick()` 耗时中位数）。所有改动以"不回归基线"为准。
2. **阶段一（纯结构，零语义风险）**：P0-1、P0-2、P1-1、P2-1~P2-3。改后跑 `npm test` 全绿 + 基准对比。
3. **阶段二（缓存）**：仅当基准显示 P1-2 仍有必要才做；必须配 vitest 断言"升级/解锁强化/指派经理/挂载 effect 后产出系数正确刷新"，且不破坏"统一数值路径"契约。
4. **纪律**：遵循项目 AGENTS.md —— 机制改动带测试、不破坏"单一写入口 / 事件驱动 / 只读 UI / 三层状态"。

---

## 5. 结论

当前架构的"避免重复运算"思路（事件驱动、懒求值、缓存三层状态、active 实例增量挂载）方向正确，**不需要重写**。真正的放大瓶颈集中在三处：

1. **派发层**：`onAny` 全扫描把触发器匹配放大到 `2R×M`；
2. **产出主路径**：`enhancementMultiplier` 每 Tick 全量扫 E 个强化；
3. **每事件开销**：急切构建无人消费的 `StatsContext` 快照。

阶段一的结构性改动即可在不触碰数值语义的前提下，把每 Tick 运算量从 `O(R·S·E + 2R·M)` 量级显著压低，且风险极低。是否进一步上产出系数缓存（P1-2）应交给基准数据决定。
