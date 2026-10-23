# 03-data-structures/game-view — GameView 只读投影

本文说明 `GameView` 如何把产品状态和运行时派生快照投影给 UI。它描述当前构造器的输出边界，不将 GameView 当成完整存档或玩家状态。

把 GameView 想成游戏画面查询用的“当前摘要”：它把 UI 常要同时显示的部分玩家状态和计算结果放在一个读取接口里。界面应读取它或更窄的专用 ReadModel，而不是把 GameView 当成新的权威存档或状态写入口。

## 构建输入

`buildGameView()` 接受 `ViewBuildContext`：只读 PlayerState、VisibilitySnapshot、当前 StoryView、活跃 Affector 列表和 StatsSnapshot。它组合为 `GameView`，供 Runtime 的查询接口向上暴露。

## 输出

当前 `GameView` 提供活动 Init、当前位置、已访问区域、帧计数、资源、Spot 等级与管理者、解锁项、物品、已完成剧情、flags、visibility、当前剧情、活跃 Affectors 和统计。

构造器会复制部分数组与对象映射，复制 StoryLog 和 Affector 的 `activeEntryIds`。资源视图将 globalResources 与 resources 合并，局部同名键覆盖全局值。Visibility 的各类映射也会复制。此投影并不承诺深拷贝所有嵌套对象，新增字段需核对引用语义。

具体地，`src/arona-clicker/read-model/game-view-builder.ts` 的 `buildGameView()` 会复制已访问区域、资源/Spot/物品等映射、解锁列表、剧情记录以及 Visibility 子表；`currentStory` 与 `stats` 则直接放入结果，Affectors 会复制数组、条目对象和 `activeEntryIds`。因此“投影”表示输出形状面向读取，不等于所有嵌套对象都被深拷贝或冻结。

角色 roster、培养细节、聊天游标等并非当前 GameView 接口的通用字段；相应 UI 查询可由专门的 ReadModel/查询端口提供。不要因 UI 需要数据就把所有运行数据塞入 PlayerState 或 GameView。

## 数据流

```text
PlayerState ───────┐
Visibility / Stats ├─ buildGameView() → Runtime getView() → UI Context → UI
Story / Affectors ─┘
```

领域写入与派生系统如何协作见 [[1-项目/ACProgram/docs/docs-829/04-mechanisms/arona-clicker/state-mutation]]；架构数据流见 [[docs/docs-829/01-architecture/data-flow]]。

## 从哪里核对

- 输入和字段：`src/arona-clicker/read-model/game-view-builder.ts` 的 `ViewBuildContext`、`buildGameView()`；Runtime 在 `src/arona-clicker/runtime/runtime-game-instance.ts` 的 `getView()` 调用构造器。
- 相关验证：`tests/engine/state-mutation-service.test.ts` 证明状态写入与资源事件的路径；`tests/engine/achievement-view.test.ts` 验证一类专用只读投影会利用当前状态和历史 Init 快照。本次 Read Set 内未找到单独直接调用 `buildGameView()` 的测试；builder 的字段复制细节以当前实现核对，不把相邻测试夸大为直接覆盖。
- 再往前追写入：[[docs/docs-829/06-wiki/30-arona-clicker-domain/state-and-mutation]]；按玩家问题查功能协作：[[docs/docs-829/06-wiki/00-index]]。
