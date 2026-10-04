# 03-data-structures/game-view — GameView 只读投影

本文说明 `GameView` 如何把产品状态和运行时派生快照投影给 UI。它描述当前构造器的输出边界，不将 GameView 当成完整存档或玩家状态。

## 构建输入

`buildGameView()` 接受 `ViewBuildContext`：只读 PlayerState、VisibilitySnapshot、当前 StoryView、活跃 Affector 列表和 StatsSnapshot。它组合为 `GameView`，供 Runtime 的查询接口向上暴露。

## 输出

当前 `GameView` 提供活动 Init、当前位置、已访问区域、帧计数、资源、Spot 等级与管理者、解锁项、物品、已完成剧情、flags、visibility、当前剧情、活跃 Affectors 和统计。

构造器会复制部分数组与对象映射，复制 StoryLog 和 Affector 的 `activeEntryIds`。资源视图将 globalResources 与 resources 合并，局部同名键覆盖全局值。Visibility 的各类映射也会复制。此投影并不承诺深拷贝所有嵌套对象，新增字段需核对引用语义。

角色 roster、培养细节、聊天游标等并非当前 GameView 接口的通用字段；相应 UI 查询可由专门的 ReadModel/查询端口提供。不要因 UI 需要数据就把所有运行数据塞入 PlayerState 或 GameView。

## 数据流

```text
PlayerState ───────┐
Visibility / Stats ├─ buildGameView() → Runtime getView() → UI Context → UI
Story / Affectors ─┘
```

领域写入与派生系统如何协作见 [[docs/docs-829/04-mechanisms/arona-clicker/state-mutation]]；架构数据流见 [[docs/docs-829/01-architecture/data-flow]]。
