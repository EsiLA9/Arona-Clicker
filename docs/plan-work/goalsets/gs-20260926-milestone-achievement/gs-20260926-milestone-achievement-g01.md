# G01：两个 Area 的可玩成就演示

## 对最终目标的贡献

玩家导入自包含示范包后，在一个 Init 的两个可前往 Area 中分别发现成就、积累资源或收集物品、看到进度并获得首次完成效果。

## 完成定义

- [x] 独立 JSON／ZIP 示例包自带 1 个 Init、2 个起初可前往的 Area；两处目标互不依赖，各自在首次进入对应 Area 后才显示和监听。
- [x] 成就页显示已发现目标的标题、线索、奖励说明、简单数值进度和完成状态；未到访 Area 的目标不提前出现，离开 Init 后已发现项仍可回看。
- [x] 一个目标使用该 Init 的累计资源统计，另一个使用收集品；完成后 Save 事实保持，Listener 自动执行可用 Effect 一次。读档、切换 Init 与追赶完成不重复发放。

## 依赖与边界

- 前置 Goal：无；复用已完成的 Milestone P0。
- 本阶段暂缓：Runtime Editor 创作、额外 `when`、前置成就、Init／全局目标、Roadmap、星野天台剧情等待包装。

## 立项时需固定的实现点

- 源码已核对：累计统计已有数值但 Milestone 不监听 `stat`；Area 到访事实已有但未接 Milestone 准入；Records 尚无 Achievement 投影。按 Task 固定统计唤醒、状态就绪后的准入对账及新声明的导入验证链。
- 内容选择：示例资源、收集品、标题和文案可在 Task 内确定，不改变上述验收语义。

## 完成记录

2026-09-26：[[task-0157-area-achievement-demo-v1]] 已完成并归档。真实 ZIP 导入、双区域正常玩法、Records 联动、一次性效果及全量测试均通过；后续作者能力仍由 G02/G03 承接。

## 正式文档入口

- Draft：[[draft-0156-area-achievement-demo]]
- Task：[[task-0157-area-achievement-demo-v1]]
- 当前机制：[[docs/docs-828/04-mechanisms/trigger-effect]]
