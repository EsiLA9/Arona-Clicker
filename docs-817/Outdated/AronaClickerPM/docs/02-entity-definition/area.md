# Area（区域）

## 概念

Area 是 Init 内的可探索区域。玩家在**左侧栏**切换/旅行到不同的 Area。每个 Area 包含自己的 Spot 列表、Story（通过 ActiveStoryEntry/PassiveStoryEntry 挂载）列表。

## 数据结构

```
AreaDefinition:
  - id: string                         # FullKey: ModName/area/idName
  - name: string
  - description: string
  - parentInit: string                 # → [Init](init.md) 的 FullKey
  - visibility?: Record<1|2|3|4, Condition>  # → [Visibility](visibility.md)
  - unlockCondition?: Condition              # @deprecated 使用 visibility.4 替代
  - adjacentAreas?: string[]                 # 直接连通的 Area FullKey 列表
  - discoveryCost?: ResourceCost       # 发现此 Area 的消耗（一次性的可见性解锁）
  - purchaseCost?: ResourceCost        # 购买此 Area 的消耗（一次性的进入权限解锁）
  - spots: string[]                    # → [Spot](spot.md) 的 FullKey 列表
  - passiveStoryEntries: string[]       # → [StoryEntry](story-entry.md) passiveStoryEntry 的 FullKey 列表
  - activeStoryEntries: string[]        # → [StoryEntry](story-entry.md) activeStoryEntry 的 FullKey 列表
  - explorationMax: number
  - isExitPoint?: boolean              # 此 Area 提供"离开 Init"功能（见 init.md）
  - travelCost?: ResourceCost          # → [Resource](resource.md) ResourceCost（已废弃，备用）
  - environmentTags: string[]
```

## AreaState（运行时状态）

每个 Area 在 PlayerState 中拥有独立的状态记录：

```
# PlayerState.areaStates: Record<AreaId, AreaState>

AreaState:
  - discovered: boolean            # 是否发现（可见，但可能未解锁）
  - unlocked: boolean              # 是否解锁（可进入/旅行到）
  - explorationProgress: number    # 当前探索度
```

### 状态转换

```
unknown → discovered: 发现
  └─ discoveryCost（一次性消耗）

discovered → unlocked: 解锁
  └─ purchaseCost（一次性消耗）或通过故事/Enhancement赠送

unlocked: 可自由进出（旅行本身无损耗）
```

## 连通性与旅行

### 基础模型：单节点连通图

每个 Area 通过 `adjacentAreas` 声明直接连通的邻居，形成最基础的图结构。

```
示例连通图：
  hometown ── forest ── cave
      │                    │
      └── lake ────────────┘

hometown.adjacentAreas = ["forest", "lake"]
forest.adjacentAreas = ["hometown", "cave"]
cave.adjacentAreas = ["forest", "lake"]
lake.adjacentAreas = ["hometown", "cave"]
```

### 旅行流程

```
玩家点击目标 Area → Area 切换请求:

  1. 检查 targetArea.adjacentAreas 是否包含 currentArea
     → 若不包含 → 不可达（提示无连通路径）
     → 若包含 → 进入第 2 步

  2. 检查 targetArea AreaState:
     ┌─ discovered == false
     │  → 若 discoveryCost 存在 → 弹出确认窗口
     │  → 消耗资源 → discovered = true → 进入第 3 步
     │  → 若 discoveryCost 不存在或被跳过 → 强制设为 discovered
     │
     ├─ unlocked == false
     │  → 若 purchaseCost 存在 → 弹出确认窗口
     │  → 消耗资源 → unlocked = true → 进入第 4 步
     │  → 若无 purchaseCost → 直接设为 unlocked
     │
     └─ unlocked == true → 进入第 4 步

  3. 检查 currentArea → targetArea 的连通路径是否有效
     → 有效 → player.currentArea = targetArea
     → 无效 → 停留在当前 Area（保险逻辑）

  4. EventBus.publish("area/entered", { from: oldArea, to: newArea, init })
```

### 注意

- 旅行本身**无损耗**（不消耗资源）
- 发现（discovery）和解锁（purchase）是**一次性消耗**，后续重进不再收费
- 通过 Story/Enhancement 的 Funclet `travel_to_area` 可直接跳过发现/解锁流程
- 若 `travel_to_area` 执行后目标 Area 状态异常 → 自动传送回 startingArea 作为保险

## Map 概念（预留）

后续版本可能引入 Map 层，允许 Area 从属于一个 Map：

```
MapDefinition（未来预留）:
  - id: string                 # FullKey: ModName/map/idName
  - name: string
  - areas: string[]            # 该 Map 包含的 Area FullKey
  - exitAreas?: string[]       # 离开本 Map 到其他 Map 的出口 Area

作用：
  - 跨 Map 快速移动
  - Map 作为 Area 的更高层分组
  - 一个 Area 可被多个 Map 引用（非独占）
```

当前版本不使用 Map，所有 Area 平铺在 Init 下。

## 参见

- [Init](init.md) — 所属世界线
- [Spot](spot.md) — 区域内的产出设备
- [StoryEntry](story-entry.md) — 挂载在区域上的故事入口
- [Visibility](visibility.md) — Area 的可见性等级
- [Value & Condition](value-condition.md) — visibility 使用的 Condition
- [Save Construction](save-construction.md) — 新游戏时 AreaState 的初始化
- [Player](player.md) — PlayerState 中保存 currentArea 和 areaStates
