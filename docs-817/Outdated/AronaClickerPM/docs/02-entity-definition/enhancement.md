# Enhancement（购买式强化）

## 概念

Enhancement 是一次性购买的永久强化，购买后提供 Effect。**Enhancement 不提供升级**（只有 Spot 支持等级成长）。

Enhancement 分为两种作用域：

- **init 作用域（默认）** — 仅在当前 Init 内生效，切换 Init 后根据 `inheritEnhancements` 决定是否继承
- **global 作用域** — 在所有 Init 间贯穿，即使切换 Init 也保持拥有和状态

## 数据结构

```
EnhancementDefinition:
  - id: string                         # FullKey: ModName/enhancement/idName
  - name: string
  - description: string
  - icon: string
  - category: EnhancementCategory
  - scope: "init" | "global"           # 作用域（默认 init）
  - cost: ResourceCost                 # → [Resource](resource.md) ResourceCost（一次性）
  - effects: string[]                  # → [Effect](effect.md) 的 FullKey 列表
  - prerequisites: Condition[]         # → [Value & Condition](../01-foundation/value-condition.md) Condition
  - togglable?: boolean                # 玩家是否可以手动开启/关闭（默认 false）

  # 示例：
  # prerequisites:
  #   - { type: "has_enhancement", target: "arona/enhancement/click_boost" }
  #   - { type: "cmp", op: "gte", left: { type: "resource", target: "arona/resource/gold" }, right: { type: "const", value: 500 } }

EnhancementCategory:
  - "chat_boost"
  - "spot_boost"
  - "exploration"
  - "resource"
  - "talk"
  - "utility"

EnhancementState:
  - unlocked: boolean                    # 是否满足可见/购买条件
  - active: boolean                      # 是否开启（仅 scope=global 且 togglable=true 时有效）
  # 注意：Enhancement 不设 level。存在即拥有（player.enhancements 中有此 key = 已购买）。
```

## 全局 Enhancement 和休眠

### 全局购买页

玩家在 Init 选择界面可进入**全局资源购买页**（独立于任何 Init），消耗 persistent 资源购买 global Enhancement。

```
1. 进入条件：
   → 至少完成一个 Init（player.completedInits 非空）
   → 或当前不在任何 Init 中

2. 页面内容：
   → 只显示 scope = "global" 的 Enhancement
   → 消耗 persistent = true 的资源
   → 一次性购买，不设等级

3. 全局 Enhancement 的开关：
   → 若 togglable = true，玩家可手动切换 active 状态
   → 关闭时该 Enhancement 的 Effect 不参与运算
   → 开启时 Effect 生效

4. 作用范围：
   → active = true 时，Effect 在所有 Init 中生效
   → 即使当前不在任何 Init 中，Effect 仍参与运算
```

```
1. 进入条件：
   → 至少完成一个 Init（player.completedInits 非空）
   → 或当前不在任何 Init 中

2. 页面内容：
   → 只显示 scope = "global" 的 Enhancement
   → 使用全局资源（跨 Init 继承的资源）
   → 购买的 Enhancement 立即生效

3. 全局 Enhancement 的开关：
   → 若 togglable = true，玩家可手动切换 active 状态
   → 关闭时该 Enhancement 的 Effect 不参与运算
   → 开启时 Effect 生效

4. 作用范围：
   → active = true 时，Effect 在所有 Init 中生效
   → 即使当前不在任何 Init 中，Effect 仍参与运算（如聊天修正）
```

### 休眠机制

当玩家处于全局购买页或 Init 选择界面时，所有非全局实体进入**休眠**：

```
休眠状态：
  - 所有 scope = "init" 的 Spot → 停止自动产出
  - 所有 scope = "init" 的 Enhancement → Effect 不参与运算
  - 游戏 Tick 继续推进，但 Init 内的实体不响应
  - RuntimeCache 中对应的 productionCache 暂停更新

退出休眠：
  → 玩家选择一个 Init 进入
  → 恢复该 Init 内所有实体的运算
  → 重新计算 productionCache

全局 Enhancement 不受休眠影响：
  → scope = "global" 且 active = true 的 Enhancement
  → 其 Effect 即使在休眠中也持续生效
```

## 切换 Init 时的继承规则

```
切换 Init 时：

  scope = "global" 的 Enhancement:
    → 始终继承（不受 inheritEnhancements 影响）
    → unlocked / active 保持不变

  scope = "init" 的 Enhancement:
    → 若 inheritEnhancements = true → 继承
    → 若 inheritEnhancements = false → 重置为未购买状态
```

## 参见

- [Effect](effect.md) — Enhancement 提供的效果
- [Visibility](visibility.md) — Enhancement 的可见性等级
- [Value & Condition](value-condition.md) — prerequisites 使用的 Condition 和 Value
- [Resource](resource.md) — 购买消耗的资源
- [Save Construction](save-construction.md) — 全局实体跨 Init 继承
- [Player](player.md) — PlayerState 中保存 enhancements 状态
