# Effect（效果系统）

## 概念

Effect 是游戏中最底层的效果单元。所有 Spot 产出、Enhancement 收益、聊天加成等最终都映射为 Effect。

## 数据结构

```
EffectType:
  # ── 产出/收益修正 ──
  - "spot_production_multiply"    # 乘法：指定Spot产出 ×N
  - "spot_production_add"         # 加法：指定Spot产出 +N
  - "spot_interval_reduce"        # 减少Spot产出间隔
  - "chat_reward_multiply"       # 聊天点击收益 ×N
  - "chat_reward_add"            # 聊天点击收益 +N
  - "resource_gain_multiply"     # 指定资源获取 ×N
  - "resource_gain_add"          # 指定资源获取 +N
  - "passive_story_entry_weight"  # 调整PassiveStoryEntry的抽取权重
  - "exploration_boost"          # 探索度获取提升
  - "travel_cost_reduce"         # 旅行消耗减少

  # ── 可见性授予（→ [Visibility](visibility.md)）──
  - "reveal_entity"              # 直接提升某实体的可见性等级
                                 # target.id = 目标 FullKey
                                 # value = VisibilityLevel（1-4）

  - "grant_purchase_access"      # 快捷：直接设为 Lv.4 可购买
                                 # target.id = 目标 FullKey

  # ── 解锁（遗留，逐步迁移到可见性系统）──
  - "unlock_area"                # 解锁区域（已废弃，使用 grant_purchase_access）
  - "unlock_enhancement"         # 解锁升级
  - "unlock_story"              # 解锁activeStoryEntry/passiveStoryEntry

  # ── 扩展 ──
  - "custom"                     # 数据包自定义

EffectTarget:
  - scope: "global" | "init" | "area" | "spot"
  - id?: string                  # 目标的 FullKey（可见性授予时 = 目标实体的 FullKey）

EffectDefinition:
  - id: string                   # FullKey: ModName/effect/idName
  - type: EffectType
  - target: EffectTarget
  - operation: "add" | "multiply" | "percent" | "set"
  - value: number                # 可见性授予时 = VisibilityLevel（1-4）
  - duration?: number            # 持续时间（刻），空=永久
```

## 参见

- [Visibility](visibility.md) — reveal_entity / grant_purchase_access 的效果目标
- [Spot](spot.md) — Spot 通过 Effect 提供加成
- [Enhancement](enhancement.md) — Enhancement 通过 Effect 提供加成
- [Chat](chat.md) — 聊天收益受 Effect 修正
