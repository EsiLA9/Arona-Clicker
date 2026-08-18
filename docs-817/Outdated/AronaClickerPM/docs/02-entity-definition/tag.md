# Tag 标签系统

## 概念

Tag 是附加在 Registry 定义上的元数据标签。每种 TypeName 拥有独立的 Tag 命名空间。

```
area 拥有标签 "forest"    → 完整 Key: "area/forest"
init 拥有标签 "forest"    → 完整 Key: "init/forest"
两者语义隔离，统计独立。
```

## 在定义中的使用

所有 Registry 定义（init/area/spot/enhancement/story 等）均可携带 tags：

```
# 任意定义
Definition:
  - id: string                   # FullKey
  - ...
  - tags: string[]               # 标签列表，如 ["forest", "dangerous", "event"]
```

引擎在定义加载时，自动将 `TypeName/tagName` 注册到 Tag 索引中。

## Tag 统计的触发时机

```
元素购买/获得时（如 Spot）：
  → 遍历该定义的 tags[]
  → 对每个 tag，更新 TagStat：
     - totalCollected++
     - uniqueItems 添加该元素 FullKey
     - perInit[currentInit].collected++
  → EventBus.publish("tag/collected", { typeName: "spot", tag: "forest", total: N })

元素触发/演出时（如 Story Talklet）：
  → 遍历该定义的 tags[]
  → 对每个 tag，更新 TagStat：
     - totalTriggered++
     - perInit[currentInit].triggered++
  → EventBus.publish("tag/triggered", { typeName: "story", tag: "event", total: N })
```

## Registry 辅助索引

```
GameRegistry 辅助索引（参见[三层架构](../03-registry/three-layer.md)）:
  - tagsByType: Map<string, Map<string, string[]>>
      # TypeName → (tagName → FullKey[])
      # 例: "area" → ("forest" → ["arona/area/forest_01", ...])
```

## 参见

- [Player](player.md) — PlayerState.tagStats 保存统计数据
- [EventBus](event-bus.md) — Tag 统计变化发布 tag/collected 和 tag/triggered 事件
- [三层架构](three-layer.md) — Registry 中的 tagsByType 索引
