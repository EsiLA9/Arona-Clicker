# PlayerState（玩家状态）

## 数据结构

```
PlayerState:
  # 存档元信息
  - saveVersion: number
  - createdAt: GameTick
  - lastSaveAt: GameTick

  # 当前所处位置（FullKey）
  - currentInit: string               # → [Init](init.md)
  - currentArea: string               # → [Area](area.md)
  - unlockedInits: string[]
  - completedInits: string[]

  # ── 区域状态 ──

  # Area运行时状态（AreaId → AreaState）
  - areaStates: Record<string, AreaState>  # → [Area](area.md) AreaState

  # ── 资源系统 ──

  # 资源当前持有量（FullKey → 数量）
  - resources: Record<string, number>  # → [Resource](resource.md)

  # 资源自动日志（存档持久化）
  - resourceLog: Record<string, ResourceLog>

  # ── 实体状态 ──

  # Spot状态（FullKey → SpotState）
  - spots: Record<string, SpotState>  # → [Spot](spot.md)

  # Enhancement状态（FullKey → EnhancementState）
  - enhancements: Record<string, EnhancementState>  # → [Enhancement](enhancement.md)

  # Story执行档案（activeStoryEntry/passiveStoryEntry FullKey → StoryInstance）
  # Story执行档案（activeStoryEntry/passiveStoryEntry FullKey → StoryInstance）
  - storyInstances: Record<string, StoryInstance>  # → [StoryEntry](story-entry.md)

  # ── Tag 统计 ──

  # Tag统计（"TypeName/tagName" → TagStat）
  - tagStats: Record<string, TagStat>  # → [Tag](tag.md)

  # ── 聊天历史 ──

  - chatHistory: ChatHistoryEntry[]   # → [Chat](chat.md)
  - totalClicks: number
  - totalStorySeen: number

  # ── 可见性系统 ──

  # 统一可见性状态（FullKey → VisibilityLevel 0-5）
  - visibilityState: Record<string, VisibilityLevel>  # → [Visibility](visibility.md)

  # ── 故事互斥 ──

  - mutuallyExcluded: Record<string, string[]>  # → [StoryEntry](story-entry.md) 互斥

  # 游戏Flag（数据包自定义标记）
  - flags: Record<string, any>
```

## ResourceLog

```
ResourceLog:
  - totalGained: number                          # 存档总获得
  - totalConsumed: number                        # 存档总消耗
  - perInit: Record<string, {                    # 按 Init 细分
      gained: number
      consumed: number
    }>
```

## TagStat

```
TagStat:
  - totalCollected: number                       # 拥有此tag的元素累计收集次数
  - totalTriggered: number                       # 拥有此tag的元素累计触发次数
  - uniqueItems: string[]                        # 拥有此tag的唯一元素 FullKey 列表
  - perInit: Record<string, {                    # 按 Init 细分
      collected: number
      triggered: number
    }>
```

## 参见

- [Engine](engine.md) — GameInstance 包含 PlayerState + RuntimeCache
- [Save Construction](save-construction.md) — 全局实体继承与休眠
- [Visibility](visibility.md) — visibilityState 使用
- [三层架构](three-layer.md) — 实例层说明
