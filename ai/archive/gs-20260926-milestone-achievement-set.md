# Goal Set：区域探索成就与隐藏 Milestone

Set ID：gs-20260926-milestone-achievement

## 最终玩家与作者体验

- 玩家只看到 Achievement：首次到访 Area 后显示该区域目标；成就页按 Init、Area、全局分组，当前区域优先。简单数值目标展示“当前／目标”，组合目标展示条件状态、作者线索和奖励说明。
- 隐藏的 Milestone 记录曾满足目标条件的事实。Listener 在目标首次完成时自动执行当前真正可执行的 Effect；玩家已满足条件时可追赶完成，完成与已发现的展示只进不出。
- 首个可玩版本由手写独立数据包交付；之后让作者在 Runtime Editor 的单一成就创作流程中填写归属、引入条件、完成条件、效果和展示文案。
- 权威完成事实沿用 Save 级 `milestoneProgress.completed`；运行时监听可撤出重建。Area 目标在首次到访后引入，当前 Init 内已引入目标保持监听，离开 Init 时撤出。

## 阶段全图

| Goal | 独立完成结果 | 前置依赖 | 当前 Draft / Task |
| --- | --- | --- | --- |
| [[gs-20260926-milestone-achievement-g01]] | 独立数据包提供两个 Area 的可玩成就闭环 | 已实现的 Milestone P0 | [[draft-0156-area-achievement-demo]] · [[task-0157-area-achievement-demo-v1]] |
| [[gs-20260926-milestone-achievement-g02]] | Area、Init、全局目标及前置关系与条件能力完整可用 | G01 | 待建立 |
| [[gs-20260926-milestone-achievement-g03]] | Runtime Editor 单流程创作并无损导出成就内容 | G02 的声明契约 | 待建立 |

## 长期边界

- `then` 属于 Listener；Achievement 只展示，不单独发奖或领奖。已完成 ID 不因效果失败或数据包更新而重开；效果失败记错误，不自动补发。
- B 目标在自身填写多个前置 Achievement，全部完成后再检查自己的引入条件；不维护反向 `next` 列表。额外引入条件不能绕过 Area 首访门槛。
- 首期不做 Roadmap、重复完成、按 Init 分割完成历史、多阶段成就或独立数据包编辑器支持。星野天台已有 `StoryFollowUp` 专用实现，保持在本 Goal Set 外；将来若要扩展通用剧情等待玩法，再另行讨论。
- 历史依据见 [[draft-0152-milestone-listener-and-achievement-packaging]] 与 [[task-0153-milestone-listener-admission-and-reactive-coverage-audit]]；本轮前置关系改为由后继目标单向声明。当前实现以源码、测试和 `docs/docs-828/` 为准。

## 下一步

- 当前推进的 Goal：G01，先交付手写独立数据包的可玩样例。
- 首个施工入口：[[task-0157-area-achievement-demo-v1]]；Runtime Editor 创作服务留待 G03。
